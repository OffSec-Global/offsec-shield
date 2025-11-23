use std::env;

#[derive(Clone)]
pub struct OffsecConfig {
    pub listen: String,
    pub vaultmesh_url: String,
    pub capability_audience: String,
    pub jwt_public_key_pem: Option<String>,
    pub jwt_hs256_secret: Option<String>,
    pub data_dir: String,
    pub guardian_url: Option<String>,
}

impl OffsecConfig {
    pub fn from_env() -> Self {
        Self {
            listen: env::var("OFFSEC_LISTEN").unwrap_or_else(|_| "0.0.0.0:9115".to_string()),
            vaultmesh_url: env::var("VAULTMESH_URL")
                .unwrap_or_else(|_| "http://localhost:9110".to_string()),
            capability_audience: env::var("OFFSEC_CAP_AUD")
                .unwrap_or_else(|_| "offsec-portal".to_string()),
            jwt_public_key_pem: env::var("OFFSEC_JWT_PUBLIC_KEY").ok(),
            jwt_hs256_secret: env::var("OFFSEC_JWT_HS256_SECRET")
                .ok()
                .or_else(|| Some("dev-secret".to_string())),
            data_dir: env::var("OFFSEC_DATA_DIR").unwrap_or_else(|_| "data".to_string()),
            guardian_url: env::var("OFFSEC_GUARDIAN_URL").ok(),
        }
    }
}
