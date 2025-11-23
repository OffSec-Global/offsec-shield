use std::fs;
use std::path::PathBuf;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use blake3;
use serde::Deserialize;
use serde_json::Value;

use crate::merkle::MerklePathElement;
use crate::mesh::envelope::MeshEnvelope;
use crate::mesh::util::{find_peer, verify_signature};
use crate::models::ErrorResponse;
use crate::AppState;

#[derive(Debug, Deserialize)]
struct ProofBundle {
    leaf: String,
    path: Vec<MerklePathElement>,
    root: String,
    #[serde(rename = "anchor")]
    _anchor: Option<Value>,
    #[serde(rename = "receiptId")]
    receipt_id: Option<String>,
    #[serde(rename = "eventType")]
    event_type: Option<String>,
    ts: Option<String>,
    #[serde(rename = "source_node")]
    _source_node: Option<String>,
    #[serde(rename = "realm")]
    _realm: Option<String>,
}

fn is_hex(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn verify_merkle(bundle: &ProofBundle) -> Result<(), String> {
    if !is_hex(&bundle.leaf) {
        return Err("leaf is not valid hex".to_string());
    }
    if !is_hex(&bundle.root) {
        return Err("root is not valid hex".to_string());
    }

    let mut h = bundle.leaf.clone();
    for (i, step) in bundle.path.iter().enumerate() {
        if !is_hex(&step.sibling) {
            return Err(format!("path[{i}].sibling is not valid hex"));
        }
        let combined = match step.position.as_str() {
            "left" => format!("{}{}", step.sibling, h),
            "right" => format!("{}{}", h, step.sibling),
            other => return Err(format!("invalid position {other} at path[{i}]")),
        };
        h = blake3::hash(combined.as_bytes()).to_hex().to_string();
    }

    if h != bundle.root {
        return Err("merkle proof does not match root".to_string());
    }

    Ok(())
}

pub async fn mesh_proof(
    State(state): State<AppState>,
    Json(env): Json<MeshEnvelope>,
) -> Result<Json<Value>, (StatusCode, Json<ErrorResponse>)> {
    let peer = find_peer(&state.config, &env.node_id).ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "unknown mesh peer".to_string(),
                details: Some(env.node_id.clone()),
            }),
        )
    })?;

    if env.kind != "proof_bundle" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid mesh kind (expected proof_bundle)".to_string(),
                details: Some(env.kind),
            }),
        ));
    }

    if let Err(e) = verify_signature(&peer.pubkey, &env.sig, &env.payload) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "mesh signature verification failed".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    let bundle: ProofBundle = serde_json::from_value(env.payload.clone()).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid proof bundle payload".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    if let Err(msg) = verify_merkle(&bundle) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "merkle proof verification failed".to_string(),
                details: Some(msg),
            }),
        ));
    }

    let data_dir = &state.config.data_dir;
    let node_id = &peer.id;
    let receipt_id = bundle
        .receipt_id
        .clone()
        .unwrap_or_else(|| format!("remote-{}-{}", node_id, bundle.leaf));

    let dir = PathBuf::from(data_dir).join("mesh/proofs").join(node_id);
    if let Err(e) = fs::create_dir_all(&dir) {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "failed to create mesh proofs dir".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    let payload_bytes = serde_json::to_vec_pretty(&env.payload).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "failed to serialize mesh proof bundle".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    let path = dir.join(format!("{receipt_id}.json"));
    if let Err(e) = fs::write(&path, payload_bytes) {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "failed to write mesh proof bundle".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    let event_type = bundle
        .event_type
        .clone()
        .unwrap_or_else(|| "offsec.mesh.proof_received".to_string());
    let ts = bundle.ts.clone().unwrap_or_else(|| env.ts.clone());
    let root = bundle.root.clone();

    let ws_payload = serde_json::json!({
        "type": "mesh.proof_received",
        "data": {
            "from": node_id,
            "receiptId": receipt_id,
            "eventType": event_type,
            "root": root,
            "ts": ts
        }
    });

    state.ws.send_json(&ws_payload);

    Ok(Json(serde_json::json!({ "status": "accepted" })))
}

pub async fn get_mesh_proof(
    State(state): State<AppState>,
    Path((node, id)): Path<(String, String)>,
) -> Result<Json<Value>, (StatusCode, Json<ErrorResponse>)> {
    let path = PathBuf::from(&state.config.data_dir)
        .join("mesh/proofs")
        .join(&node)
        .join(format!("{id}.json"));

    let contents = fs::read_to_string(&path).map_err(|e| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "mesh proof not found".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    let json: Value = serde_json::from_str(&contents).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "mesh proof parse error".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    Ok(Json(json))
}
