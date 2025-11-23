# OffSec Shield — Proof Bundle Format

A **Proof Bundle** is the minimal JSON structure required to verify that:

1. A given receipt hash (`leaf`) is included in a Merkle tree.
2. The Merkle root (`root`) matches the current ledger tip.
3. Optionally, that the root has been anchored on a public chain.

This format is used by:

- The UI “Download proof” button.
- Future cross-node validation / federation.
- External auditors or verifiers.

---

## 1. JSON Schema

```jsonc
{
  "leaf": "string",               // hex-encoded receipt hash
  "path": [
    {
      "sibling": "string",        // hex-encoded sibling hash
      "position": "left|right"    // sibling position relative to the running hash
    }
  ],
  "root": "string",               // hex-encoded Merkle root
  "anchor": {
    "root": "string",             // anchored root (should match root)
    "ts": "string",               // ISO-8601 timestamp
    "chain": "string",            // e.g. "ethereum", "bitcoin", "vm-spawn"
    "txid": "string",             // transaction / proof identifier
    "status": "string"            // "anchored" | "pending" | "error:…"
  },
  "receiptId": "string",          // OffSec receipt id (optional)
  "eventType": "string",          // e.g. "offsec.ingest"
  "ts": "string"                  // receipt timestamp
}
```

---

## 2. Example Bundle

```json
{
  "leaf": "a1b2c3d4e5f6...",
  "path": [
    {
      "sibling": "deadbeef01...",
      "position": "left"
    },
    {
      "sibling": "cafebabe02...",
      "position": "right"
    }
  ],
  "root": "abcd1234ef5678...",
  "anchor": {
    "root": "abcd1234ef5678...",
    "ts": "2025-11-23T12:34:56Z",
    "chain": "vm-spawn",
    "txid": "0x1234abcd...",
    "status": "anchored"
  },
  "receiptId": "offsec-a1b2c3...",
  "eventType": "offsec.ingest",
  "ts": "2025-11-23T12:34:50Z"
}
```

---

## 3. Verification Procedure

1. **Leaf Check**
   - Hash the serialized receipt payload using the configured hash (BLAKE3/BLAKE2b).
   - Ensure the result matches `leaf`.
2. **Merkle Path Reconstruction**
   - Start with `h = leaf`.
   - For each path element:
     - If `position == "left"` => `h = H(sibling || h)`
     - If `position == "right"` => `h = H(h || sibling)`
   - After applying all path steps, verify `h == root`.
3. **Anchor Check (Optional)**
   - Confirm `anchor.root == root`.
   - Verify the chain-specific proof of inclusion of `root` (e.g. transaction lookup).

If all checks pass, the bundle proves:

> This receipt is included in the ledger with root `root`, and that root is (optionally) anchored on chain `anchor.chain`.

---

## 4. Intended Uses

- Node-to-node proof exchange.
- Forensic export from OffSec Shield.
- Third-party verification tools.
- Long-term archival of critical security events.
