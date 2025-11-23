use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::json;

use crate::{
    capabilities,
    capabilities::{denial_payload, ensure_action, error_response, verify_token, CapabilityError},
    models::{ActionRequest, ActionUpdate, ErrorResponse},
    receipts::write_receipt,
    AppState,
};

pub async fn submit_action(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(action): Json<ActionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let Some(token) = capabilities::extract_token(&headers) else {
        let denial = denial_payload(None, &action.action, "missing token");
        state.ws.send_json(&denial);
        let (code, err) = error_response(CapabilityError::Missing);
        return Err((code, Json(err)));
    };

    let claims = match verify_token(&token, &state.config) {
        Ok(c) => c,
        Err(err) => {
            let denial = denial_payload(None, &action.action, "invalid token");
            state.ws.send_json(&denial);
            let (code, err) = error_response(err);
            return Err((code, Json(err)));
        }
    };

    if let Err(err) = ensure_action(&claims, &action.action) {
        let denial = denial_payload(Some(&claims.sub), &action.action, "action not allowed");
        state.ws.send_json(&denial);
        let (code, err) = error_response(err);
        return Err((code, Json(err)));
    }

    let mut action = action;
    if action.guardian_id.is_none() {
        action.guardian_id = Some(claims.sub.clone());
    }
    if action.guardian_tags.is_empty() {
        if let Some(tags_val) = claims.extra.get("tags").and_then(|v| v.as_array()) {
            let tags: Vec<String> = tags_val
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            action.guardian_tags = tags;
        }
    }

    let update = ActionUpdate {
        id: action.id.clone(),
        action: action.action.clone(),
        status: "accepted".to_string(),
        guardian_id: action.guardian_id.clone(),
        guardian_tags: action.guardian_tags.clone(),
        created_at: action.created_at.clone(),
        executed_at: "".to_string(),
    };

    let payload = json!({
        "type": "action_update",
        "data": update
    });
    state.ws.send_json(&payload);

    match write_receipt(
        &state,
        &format!("offsec.action.{}", action.action),
        action.guardian_id.as_deref(),
        &action.guardian_tags,
        &payload,
    ) {
        Ok(receipt) => {
            state
                .ws
                .send_json(&serde_json::json!({ "type": "receipt", "data": receipt }));
        }
        Err(err) => {
            tracing::warn!("Failed to write receipt: {}", err);
        }
    }

    Ok(Json(json!({"status": "accepted"})))
}
