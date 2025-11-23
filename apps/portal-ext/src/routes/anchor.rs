use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{models::ErrorResponse, receipts::write_receipt, AppState};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnchorPayload {
    pub root: String,
    pub ts: String,
    pub chain: String,
    pub txid: String,
    pub status: String,
}

pub async fn anchor(
    State(state): State<AppState>,
    Json(payload): Json<AnchorPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let event = json!({
        "type": "offsec.anchor",
        "data": payload
    });
    state.ws.send_json(&event);

    // Optional: emit receipt, best-effort
    let receipt_payload = json!({
        "root": event["data"]["root"],
        "ts": event["data"]["ts"],
        "chain": event["data"]["chain"],
        "txid": event["data"]["txid"],
        "status": event["data"]["status"],
    });
    if let Err(err) = write_receipt(&state, "offsec.anchor", None, &[], &receipt_payload) {
        tracing::warn!("Failed to write anchor receipt: {}", err);
    }

    Ok(Json(json!({"status": "ok"})))
}
