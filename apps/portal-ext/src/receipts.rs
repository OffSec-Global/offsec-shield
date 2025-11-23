use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use blake3;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::{merkle::MerklePathElement, AppState};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OffsecReceipt {
    pub id: String,
    pub event_type: String,
    pub agent_id: String,
    pub timestamp: String,
    #[serde(default)]
    pub ts: String,
    pub hash: String,
    pub merkle_root: String,
    #[serde(default)]
    pub merkle_path: Vec<MerklePathElement>,
}

pub fn write_receipt(
    state: &AppState,
    event_type: &str,
    agent_id: &str,
    payload: &serde_json::Value,
) -> Result<OffsecReceipt, String> {
    let serialized = serde_json::to_vec(payload).map_err(|e| e.to_string())?;
    let leaf_hash = blake3::hash(&serialized).to_hex().to_string();

    let (merkle_root, merkle_path) = {
        let mut frontier = state
            .frontier
            .lock()
            .map_err(|_| "frontier lock poisoned".to_string())?;
        frontier.append_with_path(leaf_hash.clone())
    };

    let timestamp = Utc::now().to_rfc3339();
    let receipt_id = format!("offsec-{}", leaf_hash);
    let receipt = OffsecReceipt {
        id: receipt_id.clone(),
        event_type: event_type.to_string(),
        agent_id: agent_id.to_string(),
        timestamp: timestamp.clone(),
        ts: timestamp.clone(),
        hash: leaf_hash.clone(),
        merkle_root: merkle_root.clone(),
        merkle_path: merkle_path.clone(),
    };

    let receipts_dir = Path::new(&state.config.data_dir).join("receipts/offsec");
    fs::create_dir_all(&receipts_dir).map_err(|e| e.to_string())?;
    let path = receipts_dir.join(format!("{}.json", &receipt_id));
    let content = serde_json::to_vec_pretty(&receipt).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;

    let root_path = Path::new(&state.config.data_dir).join("ROOT.txt");
    let mut root_file = fs::File::create(root_path).map_err(|e| e.to_string())?;
    root_file
        .write_all(format!("{}\n", merkle_root).as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(receipt)
}

pub fn read_receipts(data_dir: &str, limit: usize) -> Vec<OffsecReceipt> {
    let dir = PathBuf::from(data_dir).join("receipts/offsec");
    let mut receipts = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(r) = serde_json::from_str::<OffsecReceipt>(&content) {
                    receipts.push(r);
                }
            }
        }
    }

    receipts.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    receipts.truncate(limit);
    receipts
}

pub async fn list_receipts(State(state): State<AppState>) -> impl IntoResponse {
    let receipts = read_receipts(&state.config.data_dir, 50);
    (StatusCode::OK, Json(receipts))
}

pub async fn current_root(State(state): State<AppState>) -> impl IntoResponse {
    let root = state
        .frontier
        .lock()
        .map(|f| f.current_root())
        .unwrap_or_else(|_| "0".repeat(64));
    (StatusCode::OK, Json(serde_json::json!({ "root": root })))
}
