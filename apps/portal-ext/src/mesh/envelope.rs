use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct MeshEnvelope {
    pub node_id: String,
    pub ts: String,
    pub kind: String, // "proof_bundle" | "root_announce"
    pub payload: Value,
    pub sig: String, // base64 Ed25519 signature over BLAKE3(canonical_json(payload))
}
