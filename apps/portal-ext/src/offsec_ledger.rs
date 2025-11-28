//! OffSec Shield ↔ Civilization Ledger adapter (reference).
//!
//! This is intended to be copied into the Portal-Ext (Rust) repo and
//! wired into its Axum router. It assumes the engine workspace provides:
//! - civilization-ledger-core
//!
//! ## Usage
//!
//! 1. Add to your Portal-Ext Cargo.toml:
//!    ```toml
//!    [dependencies]
//!    civilization-ledger-core = { path = "../engine/crates/civilization-ledger-core" }
//!    once_cell = "1.0"
//!    ```
//!
//! 2. Wire into Axum router:
//!    ```rust
//!    use axum::{routing::{post, get}, Router, Json, extract::Path};
//!    use civilization_ledger_core::infrastructure::InfrastructureEvent;
//!
//!    async fn post_offsec_event(Json(ev): Json<InfrastructureEvent>) -> Json<serde_json::Value> {
//!        match offsec_ledger::handle_infra_event(ev) {
//!            Ok((incident_id, receipt_id)) => Json(serde_json::json!({
//!                "status": "ok",
//!                "incident_id": incident_id,
//!                "receipt_id": receipt_id
//!            })),
//!            Err(e) => Json(serde_json::json!({
//!                "status": "error",
//!                "error": e.to_string()
//!            })),
//!        }
//!    }
//!
//!    async fn get_offsec_incident(Path(id): Path<String>) -> Json<serde_json::Value> {
//!        if let Some(chain) = offsec_ledger::get_incident(&id) {
//!            Json(serde_json::json!({
//!                "incident_id": chain.incident_id,
//!                "receipts": chain.receipts
//!            }))
//!        } else {
//!            Json(serde_json::json!({ "error": "not_found" }))
//!        }
//!    }
//!
//!    pub fn offsec_routes() -> Router {
//!        Router::new()
//!            .route("/api/offsec/events", post(post_offsec_event))
//!            .route("/api/offsec/incidents/:id", get(get_offsec_incident))
//!    }
//!    ```

use civilization_ledger_core::{
    infrastructure::{promote_event, InfrastructureEvent},
    types::Receipt,
    FileStore, NodeKeys,
};
use ed25519_dalek::{Signature, VerifyingKey};
use once_cell::sync::Lazy;
use std::{collections::HashMap, convert::TryInto, sync::Mutex};
use walkdir::WalkDir;

/// Where to keep receipts/proofs on disk.
const DEFAULT_DATA_DIR: &str = "./data-offsec";

/// Issuer identifier for receipts created by the OffSec Shield node.
const ISSUER_ID: &str = "did:vm:node:offsec-shield";

static STORE: Lazy<FileStore> = Lazy::new(|| {
    let base = std::env::var("OFFSEC_DATA_DIR").unwrap_or_else(|_| DEFAULT_DATA_DIR.into());
    FileStore::new(base).expect("failed to init FileStore")
});

static KEYS: Lazy<NodeKeys> = Lazy::new(NodeKeys::generate);

/// In-memory list of incidents for the reference implementation.
static INCIDENTS: Lazy<Mutex<Vec<IncidentChain>>> = Lazy::new(|| Mutex::new(Vec::new()));

/// Simplified incident chain for the integration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IncidentChain {
    pub incident_id: String,
    pub receipts: Vec<Receipt>,
}

impl IncidentChain {
    fn new(incident_id: String) -> Self {
        Self {
            incident_id,
            receipts: Vec::new(),
        }
    }

    fn add_receipt(&mut self, receipt: Receipt) {
        self.receipts.push(receipt);
    }
}

/// Trusted issuers loader: JSON file at $OFFSEC_DATA_DIR/trusted_issuers.json
/// Format: { "did:vm:node:alice": "02aabbcc...", ... } where value is hex of verifying key bytes
fn load_trusted_issuers() -> Result<HashMap<String, VerifyingKey>, Box<dyn std::error::Error>> {
    use std::fs::File;
    use std::io::BufReader;

    let base = std::env::var("OFFSEC_DATA_DIR").unwrap_or_else(|_| DEFAULT_DATA_DIR.into());
    let path = std::path::Path::new(&base).join("trusted_issuers.json");
    let mut map = HashMap::new();

    if !path.exists() {
        // No trusted issuers yet — that's fine; the operator can provision the file.
        return Ok(map);
    }

    let f = File::open(&path)?;
    let reader = BufReader::new(f);
    let raw: HashMap<String, String> = serde_json::from_reader(reader)?;
    for (did, key_hex) in raw {
        let key_bytes = hex::decode(key_hex)?;
        let key_arr: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| "verifying key must be 32 bytes")?;
        let vk = VerifyingKey::from_bytes(&key_arr)?;
        map.insert(did, vk);
    }
    Ok(map)
}

/// Validate a capability passed as base64(JSON). Returns parsed capability on success.
pub fn validate_capability_base64(
    token_b64: &str,
    required_scope: &str,
) -> Result<civilization_ledger_core::capability::Capability, Box<dyn std::error::Error>> {
    use base64::engine::general_purpose::STANDARD as base64_std;
    use base64::Engine;

    // decode
    let json_bytes = base64_std.decode(token_b64)?;
    let cap: civilization_ledger_core::capability::Capability =
        serde_json::from_slice(&json_bytes)?;

    // check expiry
    let now = chrono::Utc::now();
    if cap.exp <= now {
        return Err("capability expired".into());
    }

    // check scope
    let mut has_scope = false;
    for s in &cap.scopes {
        if s == required_scope
            || s == &format!("{}:*", required_scope.split(':').next().unwrap_or(""))
        {
            has_scope = true;
            break;
        }
    }
    if !has_scope {
        return Err("capability missing required scope".into());
    }

    // load trusted issuers
    let issuers = load_trusted_issuers()?;
    let issuer_vk = issuers
        .get(&cap.issued_by)
        .ok_or_else(|| format!("unknown capability issuer: {}", cap.issued_by))?;

    // prepare canonical bytes for verification (must match issuer signing)
    let unsigned = serde_json::json!({
        "sub": cap.sub.clone(),
        "scopes": cap.scopes.clone(),
        "constraints": cap.constraints.clone(),
        "issued_by": cap.issued_by.clone(),
        "exp": cap.exp.clone(),
    });
    let unsigned_bytes = serde_json::to_vec(&unsigned)?;

    let sig_bytes = hex::decode(&cap.signature)?;
    let sig_arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| "signature must be 64 bytes")?;
    let sig = Signature::from_bytes(&sig_arr);

    issuer_vk
        .verify_strict(&unsigned_bytes, &sig)
        .map_err(|e| -> Box<dyn std::error::Error> {
            format!("signature verification failed: {}", e).into()
        })?;

    Ok(cap)
}

/// Handle a single InfrastructureEvent from Guardian:
/// - create or extend an IncidentChain
/// - write receipts to disk
/// - optionally build a proof
pub fn handle_infra_event(
    ev: InfrastructureEvent,
) -> Result<(String, String), Box<dyn std::error::Error>> {
    let mut incidents = INCIDENTS.lock().unwrap();

    // Determine incident ID
    let incident_id = ev
        .ref_id
        .clone()
        .unwrap_or_else(|| format!("inc-{}", chrono::Utc::now().format("%Y%m%d-%H%M%S%.3f")));

    // Find or create incident chain
    let chain = if let Some(c) = incidents.iter_mut().find(|c| c.incident_id == incident_id) {
        c
    } else {
        let new_chain = IncidentChain::new(incident_id.clone());
        incidents.push(new_chain);
        incidents.last_mut().unwrap()
    };

    // Promote event to receipt
    let prev_id = chain.receipts.last().map(|r| r.id.clone());
    let receipt = promote_event(&KEYS, ISSUER_ID, ev, prev_id)?;
    let receipt_id = receipt.id.clone();

    // Store receipt and keep a copy for the in-memory chain
    STORE.write_receipt(&receipt)?;
    chain.add_receipt(receipt);

    // Build proof periodically (every 5 receipts)
    if chain.receipts.len() % 5 == 0 {
        use civilization_ledger_core::{build_proof, types::Scroll};
        let ids: Vec<String> = chain.receipts.iter().map(|r| r.id.clone()).collect();
        let proof = build_proof(&KEYS, ISSUER_ID, vec![Scroll::Infrastructure], ids)?;
        STORE.write_proof(&proof)?;
    }

    Ok((incident_id, receipt_id))
}

/// Rebuild the incident index from receipts on disk.
/// Call this at startup to populate INCIDENTS from existing files.
pub fn rebuild_index() -> Result<(), Box<dyn std::error::Error>> {
    let base = std::env::var("OFFSEC_DATA_DIR").unwrap_or_else(|_| DEFAULT_DATA_DIR.into());
    let rec_dir = std::path::Path::new(&base)
        .join("receipts")
        .join("infrastructure");

    if !rec_dir.exists() {
        return Ok(());
    }

    let mut incidents_map: HashMap<String, Vec<Receipt>> = HashMap::new();

    for entry in WalkDir::new(&rec_dir)
        .min_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let f = match std::fs::File::open(path) {
            Ok(f) => f,
            Err(e) => {
                tracing::warn!("rebuild_index: failed to open {:?}: {}", entry.path(), e);
                continue;
            }
        };
        let r: Receipt = match serde_json::from_reader(std::io::BufReader::new(f)) {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("rebuild_index: failed to parse {:?}: {}", entry.path(), e);
                continue;
            }
        };

        // determine incident id: first check body.ref_id, then extra.incident_id
        let mut incident_id_opt: Option<String> = None;
        if let Some(ref_id) = &r.body.ref_id {
            incident_id_opt = Some(ref_id.clone());
        } else if let Some(extra_obj) = r.body.extra.as_object() {
            if let Some(val) = extra_obj.get("incident_id") {
                if let Some(s) = val.as_str() {
                    incident_id_opt = Some(s.to_string());
                }
            }
        }

        // if no incident id, group under a per-receipt chain id
        let incident_id = incident_id_opt.unwrap_or_else(|| format!("orphan-{}", r.id.clone()));

        incidents_map.entry(incident_id).or_default().push(r);
    }

    // convert map into INCIDENTS vector
    let mut incidents_vec = INCIDENTS.lock().unwrap();
    incidents_vec.clear();
    for (k, mut receipts) in incidents_map.into_iter() {
        receipts.sort_by_key(|r| r.ts);
        incidents_vec.push(IncidentChain {
            incident_id: k,
            receipts,
        });
    }

    Ok(())
}

/// Read an incident chain by id.
pub fn get_incident(id: &str) -> Option<IncidentChain> {
    INCIDENTS
        .lock()
        .unwrap()
        .iter()
        .find(|c| c.incident_id == id)
        .cloned()
}

/// List all incident IDs (for optional list endpoint)
pub fn list_incident_ids() -> Vec<String> {
    INCIDENTS
        .lock()
        .unwrap()
        .iter()
        .map(|c| c.incident_id.clone())
        .collect()
}
