use std::{collections::HashMap, env, fs};

use base64;
use civilization_ledger_core::capability::Capability;
use ed25519_dalek::{Signer, SigningKey};
use hex;
use rand::rngs::OsRng;

#[test]
fn capability_validation_roundtrip() {
    // generate keypair
    let mut csprng = OsRng {};
    let kp = SigningKey::generate(&mut csprng);

    // write trusted_issuers.json into temp dir and set OFFSEC_DATA_DIR
    let tmpdir = tempfile::tempdir().expect("tmpdir");
    let base = tmpdir.path().to_path_buf();
    env::set_var("OFFSEC_DATA_DIR", base.to_str().unwrap());

    let vk_hex = hex::encode(kp.verifying_key().to_bytes());
    let mut issuers = HashMap::new();
    issuers.insert("did:vm:node:test".to_string(), vk_hex.clone());
    let issuers_json = serde_json::to_string(&issuers).expect("json");
    fs::write(base.join("trusted_issuers.json"), issuers_json).expect("write issuers");

    // Build capability struct (no signature)
    let exp = chrono::Utc::now() + chrono::Duration::seconds(3600);
    let mut cap = Capability {
        sub: "test-sub".to_string(),
        scopes: vec!["infrastructure:write".to_string()],
        constraints: serde_json::json!({}),
        issued_by: "did:vm:node:test".to_string(),
        exp,
        signature: String::new(),
    };

    // Build canonical unsigned json: { sub, scopes, constraints, issued_by, exp }
    let unsigned = serde_json::json!({
        "sub": cap.sub.clone(),
        "scopes": cap.scopes.clone(),
        "constraints": cap.constraints.clone(),
        "issued_by": cap.issued_by.clone(),
        "exp": cap.exp.clone(),
    });
    let unsigned_bytes = serde_json::to_vec(&unsigned).expect("unsigned bytes");

    // Sign
    let sig = kp.sign(&unsigned_bytes);
    cap.signature = hex::encode(sig.to_bytes());

    // Build final JSON, base64 encode
    let cap_json = serde_json::to_vec(&cap).expect("cap json");
    let cap_b64 = base64::encode(&cap_json);

    // Call the validate function from offsec_ledger.rs
    let parsed =
        portal_ext::offsec_ledger::validate_capability_base64(&cap_b64, "infrastructure:write")
            .expect("validation failed");

    assert_eq!(parsed.issued_by, "did:vm:node:test");
    assert!(parsed.scopes.iter().any(|s| s == "infrastructure:write"));
}
