# AGENT.md — OffSec Shield Operational Handbook

**State:** Development / Pre-production
**Goal:** Give operators the minimum needed to run, diagnose, and verify the proof pipeline.

---

## 1. System Map (Mental Model)

**Event Flow**

```
Host Logs (SSH, nginx, firewall)
        ↓
Guardian (detectors parse + match)
        ↓
ThreatEvent JSON (with capability token)
        ↓
Portal-Ext /offsec/ingest (validates token)
        ↓
Receipt created + stored in Merkle tree
        ↓
WebSocket broadcast → UI
        ↓
ROOT.txt updated → ANCHOR.json (optional)
```

**Components**

| Component | Language | Port | Role |
|-----------|----------|------|------|
| Portal-Ext | Rust/Axum | 9115 | Capability auth, receipt emission, WebSocket |
| Guardian | Python | 9120 | Log ingestion, threat detection, action execution |
| UI | Next.js | 3001 | Real-time dashboard |
| Root-Watcher | Python | — | Anchors Merkle roots |
| Mesh-Daemon | Python | — | Federates proofs to peers |
| Proof-Verify | Rust | — | CLI proof verification |

**Data Directories**

- Receipts: `$OFFSEC_DATA_DIR/receipts/offsec/*.json`
- Proofs: `$OFFSEC_DATA_DIR/proofs/`
- Merkle root: `$OFFSEC_DATA_DIR/ROOT.txt`
- Anchor: `$OFFSEC_DATA_DIR/ANCHOR.json`
- Trusted issuers: `$OFFSEC_DATA_DIR/trusted_issuers.json`

**Engine Dependency**

Portal-Ext imports `civilization-ledger-core` from `~/engine` for:
- `promote_event()` — event → signed receipt
- `FileStore` — disk persistence
- `Capability` — token validation

---

## 2. Immediate Red Flags

Check these first when something breaks:

1. **Capability token expired** — tokens have short TTL (5min default)
2. **Guardian not sending events** — check `OFFSEC_PORTAL_URL` and token
3. **WebSocket disconnected** — UI won't show real-time updates
4. **Receipts not written** — check `OFFSEC_DATA_DIR` permissions
5. **ROOT.txt not updating** — Merkle frontier may be stale
6. **Port conflicts** — 9115, 3001, 9120 must be available
7. **Engine crate missing** — `cargo build` fails if engine repo unavailable

---

## 3. Daily Operator Checklist

### A. Services Running

```bash
# Portal-Ext
curl http://localhost:9115/healthz
# Expected: {"status":"ok"}

# UI
curl -I http://localhost:3001
# Expected: 200 OK

# Guardian (if action server enabled)
curl http://localhost:9120/health
```

### B. Events Flowing

```bash
# Recent receipts exist
ls -la data-offsec/receipts/offsec/ | tail -5

# WebSocket streaming
websocat ws://localhost:9115/offsec/ws
# Should see JSON messages on events
```

### C. Proof Pipeline

```bash
# ROOT.txt exists and is recent
cat data-offsec/ROOT.txt
stat data-offsec/ROOT.txt

# Download and verify a proof
curl http://localhost:9115/offsec/proof/<receipt_id> -o proof.json
offsec-proof-verify proof.json
```

### D. Guardian Detectors

```bash
# Check Guardian logs for detections
cd apps/guardian && poetry run guardian run --dry-run

# Verify detector config
cat apps/guardian/config/detectors.yaml
```

---

## 4. What's Currently Working

**Portal-Ext**
- Event ingestion via `/offsec/ingest`
- Capability validation (HS256 and Ed25519)
- Receipt creation and Merkle tree updates
- WebSocket broadcasting to UI
- Proof bundle export via `/offsec/proof/:id`

**Guardian**
- Brute-force detector (SSH failed logins)
- Scanner detector (port scans, vuln probes)
- Anomaly detector (statistical outliers)
- Action execution (block_ip, alert, quarantine stubs)

**UI**
- ThreatStream (real-time event list)
- ActionPanel (submit and track actions)
- ProofLedger (receipt list + Merkle explorer)
- GuardianFilter (scope by guardian_id)

**Integration**
- `civilization-ledger-core` receipts and proofs
- Ed25519 signatures on all receipts
- BLAKE3 hashing for Merkle trees

---

## 5. What's Not Yet Production-Ready

**Auth & Security**
- No TLS on Portal-Ext (HTTP only)
- Default `dev-secret` for JWT HS256
- `trusted_issuers.json` manually provisioned

**Mesh Federation**
- Mesh-Daemon gossip implemented but not battle-tested
- No peer discovery (manual peer list)
- Root announcements not anchored to external systems

**Anchoring**
- Root-Watcher writes `ANCHOR.json` but no blockchain/TSA integration
- Anchor signatures not verified by third parties

**Monitoring**
- No Prometheus metrics exported
- No alerting pipeline

---

## 6. Recovery Playbook

### If Portal-Ext Won't Start

```bash
# Check for port conflict
lsof -i :9115

# Verify Rust build
cd apps/portal-ext && cargo build

# Check engine dependency
cargo tree | grep civilization-ledger

# Run with debug logging
RUST_LOG=debug cargo run
```

### If Guardian Isn't Sending Events

```bash
# Verify Portal-Ext URL
echo $OFFSEC_PORTAL_URL  # should be http://localhost:9115

# Check capability token
echo $OFFSEC_CAPABILITY_B64 | base64 -d | jq .

# Test manual event
python3 integration/offsec_event_demo.py
```

### If UI Shows No Events

```bash
# Check WebSocket URL in browser console
# Should be: ws://localhost:9115/offsec/ws

# Test WebSocket manually
websocat ws://localhost:9115/offsec/ws

# Verify Portal-Ext is broadcasting
curl http://localhost:9115/offsec/receipts
```

### If Receipts Aren't Written

```bash
# Check data directory exists and is writable
ls -la data-offsec/
mkdir -p data-offsec/receipts/offsec

# Check OFFSEC_DATA_DIR env var
echo $OFFSEC_DATA_DIR

# Verify disk space
df -h .
```

### If Proof Verification Fails

```bash
# Build proof verifier
cd apps/proof-verify && cargo build --release

# Check proof bundle structure
cat proof.json | jq '.leaf, .root, .path'

# Verify Merkle path manually
# leaf → hash with siblings → should equal root
```

---

## 7. End-to-End Verification

**Full Pipeline Test**

```bash
# 1. Start stack
make dev
# Or in separate terminals:
cd apps/portal-ext && cargo run
cd apps/ui && npm run dev
cd apps/guardian && poetry run guardian run

# 2. Run demo
demo/run_demo.sh

# 3. Check outputs
ls data-offsec/receipts/offsec/*.json
cat data-offsec/ROOT.txt

# 4. Verify proof
RECEIPT_ID=$(ls data-offsec/receipts/offsec/ | tail -1 | sed 's/.json//')
curl http://localhost:9115/offsec/proof/$RECEIPT_ID -o proof.json
offsec-proof-verify proof.json

# 5. Check UI at http://localhost:3001
# Should see: events in ThreatStream, receipts in ProofLedger
```

---

## 8. Operator Command Block (Copy/Paste)

**Start Stack**
```bash
cd ~/offsec-shield
make dev
```

**Restart Portal-Ext**
```bash
cd ~/offsec-shield/apps/portal-ext
pkill -f "cargo run" && cargo run
```

**Restart Guardian**
```bash
cd ~/offsec-shield/apps/guardian
pkill -f guardian && poetry run guardian run
```

**Check Health**
```bash
curl http://localhost:9115/healthz
curl http://localhost:3001 -I
```

**Get Recent Receipts**
```bash
curl http://localhost:9115/offsec/receipts | jq '.[0:5]'
```

**Export Proof**
```bash
curl http://localhost:9115/offsec/proof/<id> -o proof.json
```

**Verify Proof**
```bash
~/offsec-shield/apps/proof-verify/target/release/offsec-proof-verify proof.json
```

**Generate Capability Token**
```bash
python3 tools/make_capability.py \
  --issuer did:vm:node:sovereign \
  --sk $PRIVATE_KEY_HEX \
  --scopes infrastructure:write \
  --exp-secs 3600
```

---

## 9. Environment Reference

### Portal-Ext

| Variable | Default | Purpose |
|----------|---------|---------|
| `OFFSEC_LISTEN` | `0.0.0.0:9115` | Bind address |
| `OFFSEC_DATA_DIR` | `./data-offsec` | Receipt/proof storage |
| `OFFSEC_JWT_HS256_SECRET` | `dev-secret` | JWT signing secret |
| `OFFSEC_JWT_PUBLIC_KEY` | — | Ed25519 PEM for capability validation |
| `OFFSEC_CAP_AUD` | `offsec-portal` | Expected audience in tokens |
| `OFFSEC_GUARDIAN_URL` | — | Guardian action server URL |
| `VAULTMESH_URL` | `http://localhost:9110` | VaultMesh Portal (optional) |

### Guardian

| Variable | Default | Purpose |
|----------|---------|---------|
| `OFFSEC_GUARDIAN_ID` | `guardian-default` | Unique guardian identifier |
| `OFFSEC_PORTAL_URL` | `http://localhost:9115` | Portal-Ext URL |
| `GUARDIAN_TAGS` | — | Comma-separated tags |
| `GUARDIAN_JWT_HS256_SECRET` | — | Shared secret with Portal-Ext |
| `OFFSEC_ACTION_SERVER_PORT` | `9120` | Action server port |

### UI

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_OFFSEC_API_URL` | `http://localhost:9115` | Portal-Ext API |
| `NEXT_PUBLIC_OFFSEC_WS` | `ws://localhost:9115/offsec/ws` | WebSocket URL |

---

## 10. API Endpoints

### Core

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/offsec/ingest` | Bearer | Receive ThreatEvent |
| POST | `/offsec/action` | Bearer | Submit action request |
| POST | `/offsec/action/apply` | Bearer | Operator-issued action |
| POST | `/offsec/action/update` | — | Guardian posts result |
| GET | `/offsec/receipts` | — | List recent receipts |
| GET | `/offsec/root` | — | Current Merkle root |
| GET | `/offsec/proof/:id` | — | Download proof bundle |
| GET | `/offsec/ws` | — | WebSocket upgrade |
| GET | `/healthz` | — | Health check |

### Ledger Integration

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/offsec/events` | Bearer | InfrastructureEvent → Receipt |
| GET | `/api/offsec/incidents/:id` | — | Incident receipt chain |

### Mesh (if enabled)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/offsec/mesh/root` | Receive root announcement |
| POST | `/offsec/mesh/proof` | Receive proof bundle |
| GET | `/offsec/mesh/proof/:node/:id` | Fetch peer proof |

---

## 11. What NOT To Do

- Don't edit receipt JSON files — they are immutable and signed
- Don't use `dev-secret` in production — rotate JWT secrets
- Don't expose 9115 to the internet without TLS and auth
- Don't commit `.env` or capability tokens to git
- Don't trust ROOT.txt without verifying the Merkle path
- Don't restart Portal-Ext during active incident without draining

---

Hand this doc to a teammate — they should be able to run the stack, trigger a detection, verify a proof, and diagnose common failures.
