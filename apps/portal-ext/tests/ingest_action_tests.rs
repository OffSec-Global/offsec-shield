use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::json;
use tower::util::ServiceExt;

#[tokio::test]
async fn ingest_requires_token() {
    let dir = tempfile::tempdir().unwrap();
    std::env::set_var("OFFSEC_JWT_HS256_SECRET", "test-secret");
    std::env::set_var("OFFSEC_CAP_AUD", "offsec-portal");
    std::env::set_var("OFFSEC_DATA_DIR", dir.path());
    let state = portal_ext::build_state(portal_ext::OffsecConfig::from_env());
    let app = portal_ext::app_router(state);

    let payload = json!({
        "id": "evt-1",
        "timestamp": "2025-11-23T01:33:22Z",
        "severity": "high",
        "event_type": "brute_force",
        "source": "ssh",
        "description": "failed auth",
        "affected": ["192.168.1.1"],
        "metadata": {}
    });

    let response = app
        .oneshot(
            Request::post("/offsec/ingest")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn action_flow_allows_valid_token() {
    let dir = tempfile::tempdir().unwrap();
    std::env::set_var("OFFSEC_JWT_HS256_SECRET", "test-secret");
    std::env::set_var("OFFSEC_CAP_AUD", "offsec-portal");
    std::env::set_var("OFFSEC_DATA_DIR", dir.path());
    let state = portal_ext::build_state(portal_ext::OffsecConfig::from_env());
    let app = portal_ext::app_router(state);

    let payload = json!({
        "id": "action-1",
        "event_id": "evt-1",
        "action": "block_ip",
        "target": "192.168.1.100",
        "reason": "test",
        "created_at": "2025-11-23T01:33:22Z"
    });

    let token = signed_token(vec!["block_ip", "ingest"]);

    let response = app
        .oneshot(
            Request::post("/offsec/action")
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::AUTHORIZATION, format!("Bearer {}", token))
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

fn signed_token(actions: Vec<&str>) -> String {
    #[derive(serde::Serialize)]
    struct Claims {
        sub: String,
        aud: String,
        exp: usize,
        iat: usize,
        actions: Vec<String>,
        nonce: String,
    }

    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: "test-guardian".to_string(),
        aud: "offsec-portal".to_string(),
        exp: now + 600,
        iat: now,
        actions: actions.into_iter().map(|a| a.to_string()).collect(),
        nonce: "unit-test".to_string(),
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret("test-secret".as_bytes()),
    )
    .expect("failed to sign token")
}
