use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct MeshPeer {
    pub id: String,
    pub url: String,
    pub pubkey: String, // base64-encoded Ed25519 public key
}

#[derive(Debug, Clone, Deserialize)]
pub struct MeshConfig {
    pub node_id: String,
    pub privkey_file: String,
    pub pubkey_file: Option<String>,
    #[serde(default)]
    pub peers: Vec<MeshPeer>,
    #[serde(default = "MeshConfig::default_interval")]
    pub interval_seconds: u64,
}

impl MeshConfig {
    fn default_interval() -> u64 {
        60
    }
}

#[derive(Clone, Deserialize, Debug)]
pub struct OffsecConfig {
    pub listen: String,
    pub vaultmesh_url: String,
    pub capability_audience: String,
    pub jwt_public_key_pem: Option<String>,
    pub jwt_hs256_secret: Option<String>,
    pub data_dir: String,
    pub guardian_url: Option<String>,
    #[serde(default)]
    pub mesh: Option<MeshConfig>,
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
            mesh: None,
        }
    }
}
