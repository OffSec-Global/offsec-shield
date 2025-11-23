pub mod action;
pub mod anchor;
pub mod ingest;
pub mod proof;

use crate::{receipts, ws, AppState};
use axum::{
    routing::{get, post},
    Router,
};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(health_check))
        .route("/offsec/ingest", post(ingest::ingest_event))
        .route("/offsec/action", post(action::submit_action))
        .route("/offsec/anchor", post(anchor::anchor))
        .route("/offsec/receipts", get(receipts::list_receipts))
        .route("/offsec/root", get(receipts::current_root))
        .route("/offsec/proof/:id", get(proof::proof))
        .route("/offsec/ws", get(ws::stream::handler))
        .with_state(state)
}

async fn health_check() -> &'static str {
    "ok"
}
