use axum::{extract::State, http::HeaderMap, Json};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    capabilities::{ensure_action, extract_token, verify_token},
    models::ErrorResponse,
    receipts::write_receipt,
    AppState,
};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ActionTarget {
    #[serde(default)]
    pub ip: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ActionRequestPayload {
    pub action_id: String,
    pub action_type: String,
    pub target: ActionTarget,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub requested_by: Option<String>,
    pub ts: String,
}

#[derive(Debug, Serialize)]
pub struct ActionApplyResponse {
    pub status: String,
}

pub async fn apply(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ActionRequestPayload>,
) -> Result<Json<ActionApplyResponse>, (axum::http::StatusCode, Json<ErrorResponse>)> {
    // Capability check
    let Some(token) = extract_token(&headers) else {
        let (code, err) =
            crate::capabilities::error_response(crate::capabilities::CapabilityError::Missing);
        return Err((code, Json(err)));
    };

    let claims = match verify_token(&token, &state.config) {
        Ok(c) => c,
        Err(err) => {
            let (code, err) = crate::capabilities::error_response(err);
            return Err((code, Json(err)));
        }
    };

    if let Err(err) = ensure_action(&claims, &req.action_type) {
        let (code, err) = crate::capabilities::error_response(err);
        return Err((code, Json(err)));
    }

    // Receipt for action request
    let payload = json!({
        "action_id": req.action_id,
        "action_type": req.action_type,
        "target": req.target,
        "reason": req.reason,
        "requested_by": req.requested_by,
        "ts": req.ts,
    });
    let receipt =
        write_receipt(&state, "offsec.action.request", &claims.sub, &payload).map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "receipt_write_failed".to_string(),
                    details: Some(e),
                }),
            )
        })?;

    // Broadcast WS
    state.ws.send_json(&json!({
        "type": "offsec.action.requested",
        "data": {
            "action_id": req.action_id,
            "action_type": req.action_type,
            "target": req.target,
            "reason": req.reason,
            "requested_by": req.requested_by,
            "ts": req.ts,
            "receipt_id": receipt.id,
        }
    }));

    // Forward to guardian (best-effort)
    if let Err(err) = forward_to_guardian(&state, &req).await {
        tracing::warn!("forward_to_guardian failed: {}", err);
    }

    Ok(Json(ActionApplyResponse {
        status: "accepted".to_string(),
    }))
}

async fn forward_to_guardian(state: &AppState, req: &ActionRequestPayload) -> Result<(), String> {
    let guardian_url = state
        .config
        .guardian_url
        .clone()
        .unwrap_or_else(|| "http://localhost:9120".to_string());
    let url = format!("{guardian_url}/actions/apply");

    let client = Client::new();
    client
        .post(url)
        .json(req)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    Ok(())
}
