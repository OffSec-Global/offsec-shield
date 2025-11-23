use portal_ext::{app_router, build_state, OffsecConfig};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = OffsecConfig::from_env();
    let state = build_state(config.clone());

    let app = app_router(state).layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&config.listen)
        .await
        .expect("Failed to bind listener");

    tracing::info!("OffSec Portal Extension listening on {}", &config.listen);

    axum::serve(listener, app).await.expect("Server failed");
}
