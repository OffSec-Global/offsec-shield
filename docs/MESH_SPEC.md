# OffSec Shield — Mesh Federation v0.1

Mesh v0.1 allows multiple OffSec Shield nodes to exchange **Merkle proof bundles** and **Merkle roots** in a simple, authenticated, verifiable way.

This is not consensus or a blockchain. It is a signed gossip layer:

> Nodes send each other roots and proofs; receivers verify, persist, and surface them to operators.

---

## 1. Concepts

- **Shield Node** – a running OffSec Shield stack (portal-ext + guardian + UI).
- **Mesh Node ID** – stable identifier for a node (for example, `shield-lon-01`).
- **Mesh Peer** – another Shield node we are willing to accept mesh messages from.
- **Proof Bundle** – the existing OffSec Shield proof JSON (leaf/path/root/anchor plus metadata), extended with mesh fields.
- **Root Announcement** – a node’s current Merkle root plus optional anchor info.
- **Mesh Envelope** – signed wrapper that carries a proof bundle or root announcement between peers.

---

## 2. Mesh Configuration

Portal-ext loads mesh settings from its config (TOML/env).

### 2.1 Example (TOML)

```toml
[mesh]
node_id = "shield-lon-01"
privkey_file = "config/mesh-node.key"  # Ed25519 secret key (not in git)
pubkey_file  = "config/mesh-node.pub"  # optional; can be derived
interval_seconds = 60                  # how often to announce root / proofs

[[mesh.peers]]
id = "shield-nyc-01"
url = "https://nyc-shield.example.com"
pubkey = "base64-ed25519-pubkey"

[[mesh.peers]]
id = "shield-ber-01"
url = "https://berlin-shield.example.com"
pubkey = "base64-ed25519-pubkey"
```

### 2.2 Requirements

- `node_id` MUST be unique within the mesh.
- `privkey_file` MUST be readable only by the Shield process (for example, `0600`).
- Each peer MUST include a `pubkey` (base64-encoded Ed25519 public key).
- Peers are configured manually in v0.1; there is no auto-discovery.

---

## 3. Mesh Envelope

All mesh messages are sent as a JSON envelope:

```json
{
  "node_id": "shield-lon-01",
  "ts": "2025-11-23T13:37:00Z",
  "kind": "proof_bundle",
  "payload": { /* kind-specific */ },
  "sig": "base64-ed25519-signature"
}
```

- `kind` is `proof_bundle` or `root_announce`.
- `sig` is computed over `BLAKE3(canonical_json(payload))`.

### 3.1 Canonical JSON

To avoid ambiguity, `payload` is canonicalised before signing:

- JSON encoded with sorted keys.
- No extra whitespace (`separators=(",", ":")` in Python terms).
- BLAKE3 digest computed over the resulting UTF-8 bytes.

The sender computes:

```
h = BLAKE3(canonical_json(payload))
sig = Ed25519_sign(privkey, h)
```

The receiver recomputes `h` from `payload` and verifies `sig` against the peer’s configured public key.

If `node_id` is unknown or the signature check fails, the message MUST be rejected with `403` or `400`.

---

## 4. Payloads

### 4.1 Proof Bundle Payload

Payload kind: `proof_bundle`.

This wraps the existing OffSec Proof Bundle format (see `docs/PROOF_BUNDLE.md`) with a few mesh fields.

```json
{
  "leaf": "a1b2c3d4…",
  "path": [
    { "sibling": "deadbeef…", "position": "left" },
    { "sibling": "cafebabe…", "position": "right" }
  ],
  "root": "abcd1234…",
  "anchor": {
    "root": "abcd1234…",
    "ts": "2025-11-23T12:34:56Z",
    "chain": "vm-spawn",
    "txid": "0x1234abcd…",
    "status": "anchored"
  },
  "receiptId": "offsec-a1b2c3…",
  "eventType": "offsec.action.block_ip",
  "ts": "2025-11-23T12:34:50Z",

  "source_node": "shield-lon-01",
  "realm": "default"
}
```

Rules:

- `leaf`, `root`, and all `path[*].sibling` fields MUST be valid hex.
- `source_node` SHOULD equal the sending node’s `node_id`, but the receiver trusts the envelope signature, not this value alone.
- `anchor.root` SHOULD equal `root` when present.

### 4.2 Root Announcement Payload

Payload kind: `root_announce`.

```json
{
  "root": "abcd1234…",
  "ts": "2025-11-23T13:37:00Z",
  "anchor": {
    "root": "abcd1234…",
    "ts": "2025-11-23T13:37:05Z",
    "chain": "vm-spawn",
    "txid": "0x1234abcd…",
    "status": "anchored"
  }
}
```

Rules:

- `root` MUST be hex.
- If `anchor` is present, `anchor.root` SHOULD match `root`.

---

## 5. Inbound Mesh API (portal-ext)

Portal-ext exposes two new endpoints that accept Mesh Envelopes. All endpoints live on the same host and port as the rest of the OffSec API.

### 5.1 POST /offsec/mesh/proof

Body: `MeshEnvelope` with `kind: "proof_bundle"`.

Behaviour:

1. Look up `node_id` in `mesh.peers`. If not found, return `403` with error JSON.
2. Canonicalise `payload`, recompute BLAKE3 hash, and verify the Ed25519 signature using the peer’s configured `pubkey`. On failure, return `403` or `400`.
3. Verify the inner Merkle proof: rebuild the Merkle root from `leaf` plus `path` using BLAKE3 and ensure the computed root equals `root` in the payload.
4. If verification passes:
   - Persist the bundle under `data/mesh/proofs/<node_id>/<receiptId>.json`.
   - Optionally emit a local receipt (for example, `offsec.mesh.proof_received`).
   - Broadcast a WebSocket event:

```json
{
  "type": "mesh.proof_received",
  "data": {
    "from": "<node_id>",
    "receiptId": "<receiptId>",
    "eventType": "<eventType>",
    "root": "<root>",
    "ts": "<ts>"
  }
}
```

5. Respond with:

```json
{ "status": "accepted" }
```

If the inner proof fails, the server SHOULD respond with `400` and an error message and MUST NOT persist the payload.

### 5.2 POST /offsec/mesh/root

Body: `MeshEnvelope` with `kind: "root_announce"`.

Behaviour:

1. Authenticate and verify the envelope as above (peer lookup plus Ed25519).
2. Optionally check that `anchor.root` (if present) matches `root`.
3. Persist root announcement under `data/mesh/roots/<node_id>/<ts>.json`.
4. Broadcast WebSocket event:

```json
{
  "type": "mesh.root_announce",
  "data": {
    "from": "<node_id>",
    "root": "<root>",
    "ts": "<ts>",
    "anchor": { /* as provided, optional */ }
  }
}
```

5. Respond with:

```json
{ "status": "accepted" }
```

---

## 6. Mesh Daemon (Outbound)

A lightweight daemon (`apps/mesh-daemon/`) runs next to portal-ext and:

1. Periodically reads the local `ROOT.txt` and `ANCHOR.json`.
2. Builds a `root_announce` payload and sends it to all configured peers.
3. Optionally selects recent receipts, builds proof bundles for them using the existing `/offsec/proof/:id` logic, wraps them in `proof_bundle` envelopes, and sends them to peers.

The daemon:

- uses the mesh `node_id` and `privkey_file` to sign envelopes;
- respects `mesh.interval_seconds` for scheduling;
- is configured via env/TOML to know:
  - data directory (`OFFSEC_DATA_DIR`);
  - portal-ext base URL (`OFFSEC_API_URL`);
  - mesh config path.

Detailed daemon behaviour is described in `apps/mesh-daemon/README.md`.

---

## 7. WebSocket Events and UI

When mesh events arrive, portal-ext emits them on the existing WebSocket channel.

UI components can subscribe to:

- `mesh.root_announce` – list of recent roots per peer.
- `mesh.proof_received` – list of remote proofs received.

The Mesh panel displays:

- recent roots per peer (with anchor status);
- recent proofs per peer (event type, receipt id, root).

---

## 8. Security Considerations

- Mesh v0.1 assumes a manually curated peer set: peers are added out-of-band with their public keys.
- A compromised peer can send validly signed but false claims about its own ledger; it cannot forge valid Merkle proofs for your receipts.
- Operators should treat remote proofs as claims, not as local facts; use anchor verification and additional context before acting.
- Future versions may add peer revocation lists, quorum-based policies for adopting remote roots, and multi-tenant realms or more complex trust topologies.

---

## 9. Future Work (v0.2+)

- Peer discovery and dynamic peering.
- On-chain anchor verification for remote roots.
- Consensus-style reconciliation between multiple ledgers.
- Multi-realm federation (per-customer or per-tenant meshes).
- More granular mesh capabilities (for example, `share_roots_only`).

Mesh v0.1 is intentionally small: a signed, verifiable gossip layer that turns multiple OffSec Shield nodes into a defensive mesh.
