# Task: Rust/Axum route for OffSec Shield ingest

Generate a Rust function using Axum that handles POST `/offsec/ingest`, with these requirements:
- Accept JSON body matching schema:
  {
    "agent_id": String,
    "event_type": String,
    "payload": Object
  }
- Expect header `X-Cap-Sig`: Ed25519 signature over `agent_id || event_type || payload_hash`
- Use BLAKE3 to compute `payload_hash` (hex lowercase)
- Validate signature against the agent’s public key (use placeholder `AGENT_PUBKEY_DB`)
- On success:
    • call `receipt_write(agent_id, event_type, payload_hash, ts)` (you can assume function exists)
    • return HTTP 200 JSON:
        {
          "receipt_id": String,
          "merkle_root": String
        }
- On failure: return HTTP 400 with error message.
- Include tests (at least one successful, one failure) using `#[tokio::test]`.

Constraints:
- Use only ASCII characters.
- Follow Rust 2021 edition.
- Keep dependencies minimal; use `blake3`, `axum`, `serde`, `tokio`.
- Do not modify existing files outside `src/routes/ingest.rs`.

Output:
- Provide full `src/routes/ingest.rs` file content.
- Provide test file `tests/ingest_tests.rs`.
