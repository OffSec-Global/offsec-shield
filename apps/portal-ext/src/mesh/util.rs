use std::collections::BTreeMap;

use anyhow::{anyhow, Result};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use blake3;
use ed25519_dalek::{Signature, VerifyingKey};
use serde_json::Value;

use crate::config::{MeshPeer, OffsecConfig};

/// Find a peer by node_id from config.mesh
pub fn find_peer<'a>(cfg: &'a OffsecConfig, node_id: &str) -> Option<&'a MeshPeer> {
    cfg.mesh
        .as_ref()
        .and_then(|m| m.peers.iter().find(|p| p.id == node_id))
}

/// Canonicalize JSON by sorting object keys recursively.
pub fn canonical_json(value: &Value) -> Result<Vec<u8>> {
    fn sort_value(v: &Value) -> Value {
        match v {
            Value::Object(map) => {
                let mut btree = BTreeMap::new();
                for (k, v) in map.iter() {
                    btree.insert(k.clone(), sort_value(v));
                }
                Value::Object(btree.into_iter().collect())
            }
            Value::Array(arr) => Value::Array(arr.iter().map(sort_value).collect()),
            _ => v.clone(),
        }
    }

    let sorted = sort_value(value);
    let bytes = serde_json::to_vec(&sorted)?;
    Ok(bytes)
}

pub fn compute_payload_hash(payload: &Value) -> Result<[u8; 32]> {
    let bytes = canonical_json(payload)?;
    let hash = blake3::hash(&bytes);
    Ok(*hash.as_bytes())
}

pub fn verify_signature(pubkey_b64: &str, sig_b64: &str, payload: &Value) -> Result<()> {
    let pk_vec = BASE64
        .decode(pubkey_b64)
        .map_err(|e| anyhow!("invalid mesh peer pubkey base64: {e}"))?;
    let pk_bytes: [u8; 32] = pk_vec
        .try_into()
        .map_err(|_| anyhow!("invalid mesh peer pubkey length"))?;
    let vk = VerifyingKey::from_bytes(&pk_bytes)
        .map_err(|e| anyhow!("invalid mesh peer pubkey: {e}"))?;

    let sig_vec = BASE64
        .decode(sig_b64)
        .map_err(|e| anyhow!("invalid mesh signature base64: {e}"))?;
    let sig_bytes: [u8; 64] = sig_vec
        .try_into()
        .map_err(|_| anyhow!("invalid mesh signature length"))?;
    let sig = Signature::from_bytes(&sig_bytes);

    let h = compute_payload_hash(payload)?;

    vk.verify_strict(&h, &sig)
        .map_err(|e| anyhow!("mesh signature verification failed: {e}"))
}
