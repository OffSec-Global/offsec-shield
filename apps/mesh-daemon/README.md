# OffSec Mesh Daemon

The mesh daemon gossips **Merkle roots** and **proof bundles** between OffSec Shield nodes using the MeshEnvelope format defined in `docs/MESH_SPEC.md`.

It runs next to `portal-ext` and:

1. Reads `ROOT.txt` and optional `ANCHOR.json` from `OFFSEC_DATA_DIR`.
2. Fetches recent receipts and proof bundles from the OffSec API.
3. Wraps them in signed Mesh Envelopes and pushes to `/offsec/mesh/root` and `/offsec/mesh/proof` on configured peers.

## Configuration

Environment:

```bash
export OFFSEC_MESH_NODE_ID="shield-lon-01"
export OFFSEC_MESH_PRIVKEY_FILE="config/mesh-node.key"
export OFFSEC_MESH_PEERS='[
  {"id":"shield-nyc-01","url":"https://nyc-shield.example.com","pubkey":"base64-ed25519-pubkey"}
]'
export OFFSEC_API_URL="http://localhost:9115"
export OFFSEC_DATA_DIR="./data"
export OFFSEC_MESH_INTERVAL_SECONDS=60
export OFFSEC_MESH_RECEIPTS_LIMIT=10
```

## Running

From `apps/mesh-daemon`:

```bash
poetry install
OFFSEC_MESH_NODE_ID="shield-lon-01" \
OFFSEC_MESH_PRIVKEY_FILE="../config/mesh-node.key" \
OFFSEC_MESH_PEERS='[{"id":"shield-nyc-01","url":"http://localhost:9117","pubkey":"..."}]' \
OFFSEC_API_URL="http://localhost:9115" \
OFFSEC_DATA_DIR="../data-lon" \
poetry run mesh-daemon
```

This will:

- periodically POST `root_announce` envelopes to `…/offsec/mesh/root`;
- POST `proof_bundle` envelopes for recent receipts to `…/offsec/mesh/proof`.

## Alignment with Rust Mesh

- Rust verifies signatures over `BLAKE3(canonical(payload))`; the daemon signs exactly that using sorted-key JSON and BLAKE3.
- Payloads match `ProofBundle` from `/offsec/proof/:id` plus `source_node` and `realm`.
- Envelope layout matches `docs/MESH_SPEC.md`: `{ node_id, ts, kind, payload, sig }`.
