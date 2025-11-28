pub mod capabilities;
pub mod config;
pub mod merkle;
pub mod mesh;
pub mod models;
pub mod offsec_ledger;
pub mod receipts;
pub mod routes;
pub mod ws;

use axum::Router;
use std::sync::{Arc, Mutex};
use ws::WsBroadcaster;

#[derive(Clone)]
pub struct AppState {
    pub ws: WsBroadcaster,
    pub config: config::OffsecConfig,
    pub frontier: Arc<Mutex<merkle::MerkleFrontier>>,
}

pub fn build_state(config: config::OffsecConfig) -> AppState {
    AppState {
        ws: WsBroadcaster::new(),
        config,
        frontier: Arc::new(Mutex::new(merkle::MerkleFrontier::new())),
    }
}

pub fn app_router(state: AppState) -> Router {
    routes::router(state)
}

pub use config::OffsecConfig;
