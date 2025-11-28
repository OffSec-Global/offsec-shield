use portal_ext::receipts::{read_receipts, write_receipt};
use portal_ext::{build_state, OffsecConfig};
use serde_json::json;
use std::env;
use tempfile::tempdir;

#[tokio::test]
async fn writes_receipt_and_updates_root() {
    let dir = tempdir().expect("tempdir");
    env::set_var("OFFSEC_JWT_HS256_SECRET", "test-secret");

    let mut config = OffsecConfig::from_env();
    config.data_dir = dir.path().to_string_lossy().into_owned();
    let state = build_state(config);
    let payload = json!({ "id": "evt-123", "foo": "bar" });
    let tags: Vec<String> = vec![];

    let receipt = write_receipt(&state, "test", Some("guardian-alpha"), &tags, &payload)
        .expect("receipt write");

    assert!(receipt.hash.len() == 64);
    assert!(receipt.id.starts_with("offsec-"));
    assert!(receipt.merkle_root.len() == 64);
    assert!(receipt.merkle_path.is_empty());

    let root_txt = std::fs::read_to_string(dir.path().join("ROOT.txt")).unwrap();
    assert!(root_txt.trim().len() >= 64);

    let receipts_dir = dir.path().join("receipts/offsec");
    assert!(receipts_dir.exists());
    let file_count = std::fs::read_dir(&receipts_dir).unwrap().count();
    assert_eq!(file_count, 1);

    let receipts = read_receipts(dir.path().to_str().unwrap(), 10);
    assert_eq!(receipts.len(), 1);
}

#[tokio::test]
async fn receipt_includes_merkle_path_on_subsequent_entries() {
    let dir = tempdir().expect("tempdir");
    env::set_var("OFFSEC_JWT_HS256_SECRET", "test-secret");

    let mut config = OffsecConfig::from_env();
    config.data_dir = dir.path().to_string_lossy().into_owned();
    let state = build_state(config);
    let payload = json!({ "id": "evt-123", "foo": "bar" });
    let tags: Vec<String> = vec![];

    let _ = write_receipt(&state, "test", Some("guardian-alpha"), &tags, &payload)
        .expect("receipt write");
    let second = write_receipt(&state, "test", Some("guardian-alpha"), &tags, &payload)
        .expect("receipt write");

    assert!(!second.merkle_path.is_empty());
    assert!(second.merkle_root.len() == 64);
}
