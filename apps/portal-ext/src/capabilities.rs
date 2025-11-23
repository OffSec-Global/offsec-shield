use axum::http::{HeaderMap, StatusCode};
use chrono::Utc;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::{config::OffsecConfig, models::ErrorResponse};

const BEARER_PREFIX: &str = "Bearer ";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub aud: String,
    pub exp: usize,
    pub iat: usize,
    #[serde(default)]
    pub actions: Vec<String>,
    #[serde(default)]
    pub nonce: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug)]
pub enum CapabilityError {
    Missing,
    Invalid(String),
    NotAllowed(String),
}

pub fn extract_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix(BEARER_PREFIX))
        .map(|v| v.trim().to_string())
}

fn decoding_key(config: &OffsecConfig) -> Option<(DecodingKey, Algorithm)> {
    if let Some(pem) = &config.jwt_public_key_pem {
        if let Ok(key) = DecodingKey::from_ed_pem(pem.as_bytes()) {
            return Some((key, Algorithm::EdDSA));
        }
    }

    if let Some(secret) = &config.jwt_hs256_secret {
        return Some((
            DecodingKey::from_secret(secret.as_bytes()),
            Algorithm::HS256,
        ));
    }

    None
}

pub fn verify_token(token: &str, config: &OffsecConfig) -> Result<Claims, CapabilityError> {
    let Some((key, alg)) = decoding_key(config) else {
        return Err(CapabilityError::Invalid(
            "no capability verification key configured".to_string(),
        ));
    };

    let mut validation = Validation::new(alg);
    validation.set_audience(&[config.capability_audience.as_str()]);

    let token_data = decode::<Claims>(token, &key, &validation)
        .map_err(|e| CapabilityError::Invalid(e.to_string()))?;

    let claims = token_data.claims;
    let now = Utc::now().timestamp() as usize;
    if claims.exp <= now {
        return Err(CapabilityError::Invalid("token expired".to_string()));
    }

    Ok(claims)
}

pub fn ensure_action(claims: &Claims, action: &str) -> Result<(), CapabilityError> {
    if claims.actions.iter().any(|a| a == action) {
        Ok(())
    } else {
        Err(CapabilityError::NotAllowed(action.to_string()))
    }
}

pub fn denial_payload(guardian: Option<&str>, action: &str, reason: &str) -> serde_json::Value {
    serde_json::json!({
        "type": "capability_denied",
        "data": {
            "id": uuid::Uuid::new_v4().to_string(),
            "timestamp": Utc::now().to_rfc3339(),
            "severity": "high",
            "event_type": "capability_denied",
            "source": "portal-ext",
            "description": format!("Capability denied for action '{}' ({})", action, reason),
            "affected": guardian.map(|g| vec![g.to_string()]).unwrap_or_default(),
            "metadata": {
                "reason": reason,
                "action": action,
            }
        }
    })
}

pub fn error_response(err: CapabilityError) -> (StatusCode, ErrorResponse) {
    match err {
        CapabilityError::Missing => (
            StatusCode::UNAUTHORIZED,
            ErrorResponse {
                error: "missing_capability_token".to_string(),
                details: Some("Authorization: Bearer <token> required".to_string()),
            },
        ),
        CapabilityError::Invalid(reason) => (
            StatusCode::UNAUTHORIZED,
            ErrorResponse {
                error: "invalid_capability_token".to_string(),
                details: Some(reason),
            },
        ),
        CapabilityError::NotAllowed(reason) => (
            StatusCode::FORBIDDEN,
            ErrorResponse {
                error: "action_not_allowed".to_string(),
                details: Some(reason),
            },
        ),
    }
}
