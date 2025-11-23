use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::json;

use crate::{
    capabilities,
    capabilities::{denial_payload, ensure_action, error_response, verify_token, CapabilityError},
    models::{ErrorResponse, ThreatEvent},
    receipts::write_receipt,
    AppState,
};

pub async fn ingest_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(event): Json<ThreatEvent>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let Some(token) = capabilities::extract_token(&headers) else {
        let denial = denial_payload(None, "ingest", "missing token");
        state.ws.send_json(&denial);
        let (code, err) = error_response(CapabilityError::Missing);
        return Err((code, Json(err)));
    };

    let claims = match verify_token(&token, &state.config) {
        Ok(c) => c,
        Err(err) => {
            let denial = denial_payload(None, "ingest", "invalid token");
            state.ws.send_json(&denial);
            let (code, err) = error_response(err);
            return Err((code, Json(err)));
        }
    };

    if let Err(err) = ensure_action(&claims, "ingest") {
        let denial = denial_payload(Some(&claims.sub), "ingest", "action not allowed");
        state.ws.send_json(&denial);
        let (code, err) = error_response(err);
        return Err((code, Json(err)));
    }

    let payload = json!({
        "type": "threat_event",
        "data": event
    });
    state.ws.send_json(&payload);

    match write_receipt(&state, "offsec.ingest", &claims.sub, &payload) {
        Ok(receipt) => {
            state
                .ws
                .send_json(&serde_json::json!({ "type": "receipt", "data": receipt }));
        }
        Err(err) => {
            tracing::warn!("Failed to write receipt: {}", err);
        }
    }

    Ok(Json(json!({ "status": "received" })))
}
