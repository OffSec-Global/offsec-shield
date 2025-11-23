use std::fs;
use std::path::PathBuf;

use axum::{extract::Path, extract::State, http::StatusCode, Json};
use serde::Serialize;

use crate::merkle::MerklePathElement;
use crate::models::ErrorResponse;
use crate::receipts::OffsecReceipt;
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct AnchorBundle {
    root: Option<String>,
    ts: Option<String>,
    chain: Option<String>,
    txid: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProofBundle {
    leaf: String,
    path: Vec<MerklePathElement>,
    root: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    anchor: Option<AnchorBundle>,
    #[serde(rename = "receiptId", skip_serializing_if = "Option::is_none")]
    receipt_id: Option<String>,
    #[serde(rename = "eventType", skip_serializing_if = "Option::is_none")]
    event_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ts: Option<String>,
}

pub async fn proof(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ProofBundle>, (StatusCode, Json<ErrorResponse>)> {
    let receipt_path = PathBuf::from(&state.config.data_dir)
        .join("receipts/offsec")
        .join(format!("{id}.json"));

    let receipt_json = fs::read_to_string(&receipt_path).map_err(|e| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "receipt not found".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    let receipt: OffsecReceipt = serde_json::from_str(&receipt_json).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "receipt parse error".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    // Optional anchor bundle
    let anchor_path = PathBuf::from(&state.config.data_dir).join("ANCHOR.json");
    let anchor = match fs::read_to_string(&anchor_path) {
        Ok(contents) => match serde_json::from_str::<serde_json::Value>(&contents) {
            Ok(v) => Some(AnchorBundle {
                root: v.get("root").and_then(|x| x.as_str()).map(|s| s.to_string()),
                ts: v.get("ts").and_then(|x| x.as_str()).map(|s| s.to_string()),
                chain: v.get("chain").and_then(|x| x.as_str()).map(|s| s.to_string()),
                txid: v.get("txid").and_then(|x| x.as_str()).map(|s| s.to_string()),
                status: v
                    .get("status")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
            }),
            Err(e) => {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "anchor parse error".to_string(),
                        details: Some(e.to_string()),
                    }),
                ))
            }
        },
        Err(_) => None,
    };

    let bundle = ProofBundle {
        leaf: receipt.hash.clone(),
        path: receipt.merkle_path.clone(),
        root: receipt.merkle_root.clone(),
        anchor,
        receipt_id: Some(receipt.id.clone()),
        event_type: Some(receipt.event_type.clone()),
        ts: Some(receipt.ts.clone()),
    };

    Ok(Json(bundle))
}
