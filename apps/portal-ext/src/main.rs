use portal_ext::{app_router, build_state, OffsecConfig};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = OffsecConfig::from_env();

    if let Err(e) = portal_ext::offsec_ledger::rebuild_index() {
        tracing::warn!("failed to rebuild incident index: {}", e);
    } else {
        tracing::info!("incident index rebuilt from receipts");
    }

    let state = build_state(config.clone());

    let app = app_router(state).layer(TraceLayer::new_for_http());

    let listener = match tokio::net::TcpListener::bind(&config.listen).await {
        Ok(l) => {
            tracing::info!("Successfully bound to {}", &config.listen);
            l
        }
        Err(e) => {
            tracing::error!(
                "Failed to bind to {}: {}. Check if port is already in use (lsof -i :{})",
                &config.listen,
                e,
                config.listen.split(':').last().unwrap_or("9115")
            );
            std::process::exit(1);
        }
    };

    tracing::info!("OffSec Portal Extension listening on {}", &config.listen);

    axum::serve(listener, app).await.expect("Server failed");
}
