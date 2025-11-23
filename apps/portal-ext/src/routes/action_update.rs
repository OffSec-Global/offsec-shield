use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{models::ErrorResponse, receipts::write_receipt, AppState};

#[derive(Debug, Deserialize)]
pub struct ActionUpdatePayload {
    pub action_id: String,
    pub action_type: String,
    pub status: String,
    #[serde(default)]
    pub details: serde_json::Value,
    pub ts: String,
}

pub async fn update(
    State(state): State<AppState>,
    Json(update): Json<ActionUpdatePayload>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let payload = json!({
        "action_id": update.action_id,
        "action_type": update.action_type,
        "status": update.status,
        "details": update.details,
        "ts": update.ts,
    });

    let receipt =
        write_receipt(&state, "offsec.action.result", "guardian", &payload).map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "receipt_write_failed".to_string(),
                    details: Some(e),
                }),
            )
        })?;

    state.ws.send_json(&json!({
        "type": "offsec.action.result",
        "data": {
            "action_id": update.action_id,
            "action_type": update.action_type,
            "status": update.status,
            "details": update.details,
            "ts": update.ts,
            "receipt_id": receipt.id,
        }
    }));

    Ok(Json(json!({ "status": "ok" })))
}
