//! Integration tests for capability-based authentication.
//!
//! These tests verify that Portal-Ext correctly rejects:
//! - Expired capabilities
//! - Capabilities with invalid signatures
//! - Capabilities from untrusted issuers

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use portal_ext::{config::Config, create_router};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use tower::ServiceExt;

/// Helper: create a test config with a trusted issuer.
fn test_config_with_issuer(issuer_did: &str, verifying_key_hex: &str) -> Config {
    let mut cfg = Config::default();
    cfg.offsec_data_dir = "/tmp/offsec-test-auth".to_string();
    cfg.trusted_issuers
        .insert(issuer_did.to_string(), verifying_key_hex.to_string());
    cfg
}

/// Helper: build a capability token (unsigned for testing).
fn build_capability_token(issuer: &str, exp: u64, signature_b64: &str) -> String {
    let payload = json!({
        "iss": issuer,
        "sub": "did:vm:node:guardian",
        "aud": "offsec-shield",
        "exp": exp,
        "iat": exp - 3600,
        "scopes": ["infrastructure:write"]
    });

    let token = json!({
        "payload": payload,
        "signature": signature_b64
    });

    base64::encode(serde_json::to_string(&token).unwrap())
}

/// Test: POST without Authorization header should return 401.
#[tokio::test]
async fn test_missing_auth_header() {
    let cfg = Config::default();
    let app = create_router(cfg);

    let req = Request::builder()
        .method("POST")
        .uri("/api/offsec/events")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "incident_id": "test-001",
                "severity": "high",
                "source": "test",
                "msg": "test event"
            })
            .to_string(),
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

/// Test: POST with expired capability should return 401.
#[tokio::test]
async fn test_expired_capability() {
    let issuer_did = "did:vm:node:test";
    let verifying_key_hex = "0000000000000000000000000000000000000000000000000000000000000000";

    let cfg = test_config_with_issuer(issuer_did, verifying_key_hex);
    let app = create_router(cfg);

    // Create capability that expired 1 hour ago
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let expired = now - 3600;

    let token_b64 = build_capability_token(
        issuer_did,
        expired,
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
    );

    let req = Request::builder()
        .method("POST")
        .uri("/api/offsec/events")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", token_b64))
        .body(Body::from(
            json!({
                "incident_id": "test-002",
                "severity": "high",
                "source": "test",
                "msg": "test event with expired token"
            })
            .to_string(),
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

/// Test: POST with capability from untrusted issuer should return 401.
#[tokio::test]
async fn test_untrusted_issuer() {
    let trusted_issuer = "did:vm:node:trusted";
    let verifying_key_hex = "0000000000000000000000000000000000000000000000000000000000000000";

    let cfg = test_config_with_issuer(trusted_issuer, verifying_key_hex);
    let app = create_router(cfg);

    // Create capability from a different issuer
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let token_b64 = build_capability_token(
        "did:vm:node:untrusted",
        now + 3600,
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
    );

    let req = Request::builder()
        .method("POST")
        .uri("/api/offsec/events")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", token_b64))
        .body(Body::from(
            json!({
                "incident_id": "test-003",
                "severity": "high",
                "source": "test",
                "msg": "test event with untrusted issuer"
            })
            .to_string(),
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

/// Test: POST with invalid signature should return 401.
#[tokio::test]
async fn test_invalid_signature() {
    let issuer_did = "did:vm:node:test";
    // Real Ed25519 verifying key (example)
    let verifying_key_hex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    let cfg = test_config_with_issuer(issuer_did, verifying_key_hex);
    let app = create_router(cfg);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Build token with invalid signature (just zeros)
    let token_b64 = build_capability_token(
        issuer_did,
        now + 3600,
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
    );

    let req = Request::builder()
        .method("POST")
        .uri("/api/offsec/events")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", token_b64))
        .body(Body::from(
            json!({
                "incident_id": "test-004",
                "severity": "high",
                "source": "test",
                "msg": "test event with invalid signature"
            })
            .to_string(),
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

/// Test: Malformed Authorization header should return 401.
#[tokio::test]
async fn test_malformed_auth_header() {
    let cfg = Config::default();
    let app = create_router(cfg);

    let req = Request::builder()
        .method("POST")
        .uri("/api/offsec/events")
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer not-base64!@#")
        .body(Body::from(
            json!({
                "incident_id": "test-005",
                "severity": "high",
                "source": "test",
                "msg": "test event with malformed token"
            })
            .to_string(),
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

/// Test: Missing "Bearer " prefix should return 401.
#[tokio::test]
async fn test_missing_bearer_prefix() {
    let cfg = Config::default();
    let app = create_router(cfg);

    let req = Request::builder()
        .method("POST")
        .uri("/api/offsec/events")
        .header("Content-Type", "application/json")
        .header("Authorization", "eyJwYXlsb2FkIjp7fSwic2lnbmF0dXJlIjoiIn0=")
        .body(Body::from(
            json!({
                "incident_id": "test-006",
                "severity": "high",
                "source": "test",
                "msg": "test event without Bearer prefix"
            })
            .to_string(),
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
