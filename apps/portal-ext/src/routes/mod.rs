pub mod action;
pub mod action_apply;
pub mod action_update;
pub mod anchor;
pub mod ingest;
pub mod mesh_proof;
pub mod mesh_root;
pub mod proof;

use crate::{offsec_ledger, receipts, ws, AppState};
use axum::{
    extract::Path,
    http::{header::AUTHORIZATION, HeaderMap},
    routing::{get, post},
    Json, Router,
};
use civilization_ledger_core::infrastructure::InfrastructureEvent;
use serde_json::json;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(health_check))
        .route("/offsec/ingest", post(ingest::ingest_event))
        .route("/offsec/action", post(action::submit_action))
        .route("/offsec/action/apply", post(action_apply::apply))
        .route("/offsec/action/update", post(action_update::update))
        .route("/offsec/anchor", post(anchor::anchor))
        .route("/offsec/receipts", get(receipts::list_receipts))
        .route("/offsec/root", get(receipts::current_root))
        .route("/offsec/proof/:id", get(proof::proof))
        .route("/offsec/mesh/proof", post(mesh_proof::mesh_proof))
        .route(
            "/offsec/mesh/proof/:node/:id",
            get(mesh_proof::get_mesh_proof),
        )
        .route("/offsec/mesh/root", post(mesh_root::mesh_root))
        .route("/api/offsec/events", post(post_offsec_event))
        .route("/api/offsec/incidents/:id", get(get_offsec_incident))
        .route("/offsec/ws", get(ws::stream::handler))
        .with_state(state)
}

async fn health_check() -> &'static str {
    "ok"
}

async fn post_offsec_event(
    headers: HeaderMap,
    Json(ev): Json<InfrastructureEvent>,
) -> Json<serde_json::Value> {
    // Extract Bearer token
    let auth_header = headers
        .get(AUTHORIZATION)
        .and_then(|hv| hv.to_str().ok())
        .unwrap_or("");

    let mut parts = auth_header.split_whitespace();
    match (parts.next(), parts.next()) {
        (Some("Bearer"), Some(token_b64)) => {
            if let Err(e) =
                offsec_ledger::validate_capability_base64(token_b64, "infrastructure:write")
            {
                return Json(
                    json!({"status":"error","error": format!("invalid capability: {}", e)}),
                );
            }
        }
        _ => {
            return Json(json!({"status":"error","error":"missing or invalid authorization"}));
        }
    }

    match offsec_ledger::handle_infra_event(ev) {
        Ok((incident_id, receipt_id)) => Json(json!({
            "status": "ok",
            "incident_id": incident_id,
            "receipt_id": receipt_id
        })),
        Err(e) => Json(json!({
            "status": "error",
            "error": e.to_string()
        })),
    }
}

async fn get_offsec_incident(Path(id): Path<String>) -> Json<serde_json::Value> {
    if let Some(chain) = offsec_ledger::get_incident(&id) {
        Json(json!({
            "incident_id": chain.incident_id,
            "receipts": chain.receipts
        }))
    } else {
        Json(json!({ "error": "not_found" }))
    }
}
