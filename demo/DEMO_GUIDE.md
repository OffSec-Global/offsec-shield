# OffSec Shield — End-to-End Demo Guide

Guardian → Portal-ext → Capability verification → Receipt → Merkle root → UI

You will see:
- Live ThreatStream updates (WebSocket)
- Cryptographic receipts written to disk
- Merkle root updates in `ROOT.txt`

---

## 1. Prerequisites
- Rust + Cargo installed
- Node.js + npm installed
- Python + Poetry installed
- `tmux` installed (optional, for the orchestrated demo)
- Repo layout contains `apps/portal-ext`, `apps/ui`, `apps/guardian`, `demo/`

---

## 2. Environment

Recommended env vars:
```bash
export OFFSEC_DATA_DIR=./data
export OFFSEC_API_PORT=9115
export OFFSEC_UI_PORT=3001
export OFFSEC_JWT_HS256_SECRET=dev-secret
```
`OFFSEC_DATA_DIR` will contain:
- `receipts/offsec/*.json`
- `ROOT.txt`

---

## 3. Fast Path: One-Command Demo
From the repo root:
```bash
./demo/run_demo.sh
```

What happens:
1. Starts **portal-ext** (`cargo run`) with JWT guardrail, receipts, Merkle frontier, ROOT.txt, WS broadcast.
2. Starts **OffSec Shield UI** (`npm run dev`) with ThreatStream + Proof/Receipts over WS.
3. Starts **Guardian** (`poetry run guardian run`).
4. Generates a short-lived **HS256 JWT** for `guardian-demo`.
5. Sends a synthetic `/offsec/ingest` event (`guardian.demo_event`).
6. Portal-ext verifies JWT, writes receipt to `OFFSEC_DATA_DIR/receipts/offsec/`, updates `ROOT.txt`, broadcasts event + receipt.
7. UI shows the threat and the receipt live.

Verify:
- Open `http://localhost:3001` → ThreatStream shows the event; Proof panel shows receipt.
- On disk:
  ```bash
  ls -1 $OFFSEC_DATA_DIR/receipts/offsec
  cat $(ls -1 $OFFSEC_DATA_DIR/receipts/offsec | tail -n 1)
  cat $OFFSEC_DATA_DIR/ROOT.txt
  ```

---

## 4. Orchestrated Demo (tmux cockpit)
For a live cockpit:
```bash
./demo/tmux_demo.sh
```
Creates a `tmux` session `offsec_demo`:
- Window `offsec-shield`
  - Pane 1: portal-ext logs
  - Pane 2: guardian logs
  - Pane 3: UI logs
  - Pane 4: `watch` on `receipts/offsec/`
- Window `control`
  - Pane: shell for `./demo/run_demo.sh` or custom curls/JWT experiments

Attach/re-attach:
```bash
tmux attach -t offsec_demo
```

---

## 5. Run a Custom Demo Event
From repo root (or tmux control pane):
```bash
OFFSEC_JWT_HS256_SECRET=dev-secret OFFSEC_API_PORT=9115 \
python - << 'PY'
import time, jwt, requests
secret = "dev-secret"
port = 9115
now = int(time.time())
claims = {
    "sub": "guardian-demo",
    "aud": "offsec-portal",
    "iat": now,
    "exp": now + 300,
    "actions": ["ingest", "offsec.action.block_ip"],
    "tags": ["demo", "lab"],
    "nonce": "manual-demo-001"
}
token = jwt.encode(claims, secret, algorithm="HS256")

event = {
    "id": f"manual-{now}",
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "severity": "medium",
    "event_type": "guardian.manual_demo",
    "source": "manual-demo",
    "source_host": "demo-shell",
    "guardian_id": "guardian-demo",
    "guardian_tags": ["demo", "lab"],
    "description": "Manual demo event triggered from shell.",
    "affected": ["198.51.100.77"],
    "metadata": {"notes": "manual demo payload"}
}

resp = requests.post(
    f"http://localhost:{port}/offsec/ingest",
    headers={"Authorization": f"Bearer {token}"},
    json=event,
    timeout=5,
)
print("Status:", resp.status_code)
print("Body:", resp.text)
PY
```
Watch:
- ThreatStream updates
- New receipt appears
- `ROOT.txt` changes

---

## 6. What This Demo Proves
1. **Capability Guardrail**: no action without valid, scoped JWT; denied actions broadcast as `capability_denied`.
2. **Receipts + Merkle Frontier**: every ingest/action writes a BLAKE3 receipt; Merkle root evolves; `ROOT.txt` is the ledger tip.
3. **Civilization Defense Node**: Shield is both actor and witness.

---

## 7. Next Steps
- Auto-anchor `ROOT.txt` to Ethereum/Bitcoin for planetary proofs.
- Federation: multi-node sharing signed threat intel.
- Turn the demo into a recorded video / live pitch / reproducible artifact for collaborators.

“Defense without proof is theater. OffSec Shield is both shield and witness.”

---

## 8. Exporting and Verifying a Proof Bundle

Every receipt can be exported as a **proof bundle**:

- leaf = receipt hash
- path = Merkle path elements
- root = Merkle root (ROOT.txt)
- anchor = optional on-chain anchor metadata

The portal exposes:
```bash
GET /offsec/proof/:id
```
Where `:id` is the OffSec receipt id (e.g., `offsec-<hash>`).

Example:
```bash
# List latest receipt via API
curl "http://localhost:9115/offsec/receipts?limit=1" | jq '.[0].id'

# Export its proof bundle
curl "http://localhost:9115/offsec/proof/offsec-<hash>" -o offsec-proof.json
```

Verify this bundle independently using the CLI verifier:
```bash
cd apps/proof-verify
cargo build --release
./target/release/offsec-proof-verify offsec-proof.json
```

If the Merkle path and anchor match the bundle’s root, you’ll see:
```
✅ Proof bundle verified successfully.
```

Operators can either click **Download proof** in the UI or hit `/offsec/proof/:id`, then run `offsec-proof-verify` anywhere to check inclusion + anchor without trusting the original node.

---

## 9. Mesh Demo (Two-Nodes)

To see federation in action:

1. Start two OffSec Shield nodes on different ports or hosts (`shield-lon-01` and `shield-nyc-01`), each with:
   - its own `OFFSEC_DATA_DIR`
   - a unique `mesh.node_id`
   - its own Ed25519 keypair
   - the other node listed under `[mesh.peers]`
2. On node A, run the standard demo:

   ```bash
   ./demo/run_demo.sh
   ```

   This generates events, actions, receipts, roots, and anchors locally.
3. Run the mesh daemon on node A:

   ```bash
   cd apps/mesh-daemon
   OFFSEC_DATA_DIR=../data-lon \
   OFFSEC_API_URL=http://localhost:9115 \
   poetry run mesh-daemon
   ```

4. On node B, open the UI and watch the Mesh panel:
   - new `mesh.root_announce` entries appear from `shield-lon-01`;
   - `mesh.proof_received` entries show remote proofs arriving.
5. Optionally, export a remote proof bundle from node B and verify it:

   ```bash
   offsec-proof-verify path/to/offsec-proof-*.json
   ```

This demonstrates that OffSec Shield can export proofs from one node, ship them across the mesh, and have another node verify and display them.
