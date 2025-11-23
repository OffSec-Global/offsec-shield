# OffSec Shield Operator Handbook (Ops Edition 0.1)

> Aim: any on-call engineer with a laptop, git, and basic dev tools can run and verify OffSec Shield without hand-holding.

## 1) What OffSec Shield Is
- Shield = **UI** (dashboards) + **Guardian** (detectors/actions) + **Portal-ext** (capability + receipts) + **Proof loop** (Merkle + anchor + bundle download).
- Flow: Guardian detects → sends signed events → Portal-ext validates + writes receipts → UI streams events/actions/proofs → operator responds and can export/verify proof bundles.
- Diagram: see `docs/ARCHITECTURE.md` for the component/port map.

## 2) Quickstart: Local Ops
**Requirements**: Rust (cargo), Node 18+, Python 3.10+, Docker (for optional extras), `make`.

**Setup & run (happy path):**
```bash
make tools-install   # installs Rust, Node, Python deps
make dev             # builds portal-ext, installs UI + Guardian deps
demo/run_demo.sh     # boots portal-ext + UI + Guardian, emits a demo event + action + proof
```

**Manual terminals (if you prefer explicit control):**
1) Portal-ext: `cd apps/portal-ext && OFFSEC_DATA_DIR=./data cargo run`
2) UI: `cd apps/ui && NEXT_PUBLIC_OFFSEC_API_URL=http://localhost:9115 NEXT_PUBLIC_OFFSEC_WS=ws://localhost:9115/offsec/ws npm run dev`
3) Guardian: `cd apps/guardian && OFFSEC_JWT_HS256_SECRET=dev-secret OFFSEC_GUARDIAN_ID=guardian-demo poetry run guardian run`

**Demo script variants:**
- `demo/run_demo.sh`: single-command E2E; writes receipts under `data/receipts/offsec`, updates `ROOT.txt`, attempts proof verify if `offsec-proof-verify` is on PATH.
- `demo/run_incident.sh <scenario>` (added in the Incident Simulation Pack) to trigger specific attack stories once the stack is up.

## 3) Core Dashboards (UI at http://localhost:3001)
- **ThreatStream**: live events. Each row shows severity, event type, source, description, and the Guardian that emitted it.
- **Action Panel**: issue operator actions (e.g., `block_ip`) and watch statuses progress (requested → accepted → applied/failed), tagged by Guardian.
- **Proof Ledger**: rolling receipts with Merkle proof explorer + latest root/anchor badge. Receipts are also on disk at `$OFFSEC_DATA_DIR/receipts/offsec/*.json`.
- **Filters**: pick a Guardian to scope ThreatStream/ActionPanel/ProofLedger (useful for multi-guardian setups).

## 4) Running an End-to-End Scenario
Baseline: run `demo/run_demo.sh` (or keep the stack running via `make dev` + the three terminals above).

Then walk it:
1. **Generate events**: run `demo/run_incident.sh ssh_bruteforce` (or `suspicious_scan`) to emit synthetic Guardian events.
2. **Watch UI**: ThreatStream should show the new event with the correct `guardian_id`.
3. **Trigger action**: in the Action Panel, block the offending IP (or use the script’s suggested target).
4. **Observe receipts**:
   - Action request/result receipts in `data/receipts/offsec/` (filenames: `offsec-*.json`).
   - Latest Merkle root in `data/ROOT.txt`.
   - Anchor (if root-watcher is running) in `data/ANCHOR.json`.
5. **Export proof**: download from the UI or via `curl http://localhost:9115/offsec/proof/<receipt_id> -o proof.json`.
6. **Verify proof**: `offsec-proof-verify proof.json` (tool from `apps/proof-verify` or installed globally).

Artifacts you should see:
- Threat event log line in UI + action.request/action.result entries.
- Receipt JSON written locally; Merkle root updated; proof bundle downloadable and verifiable.

## 5) On-Call Playbook (examples)
- **If you see brute-force events**:
  - Confirm repeated source IP/host in ThreatStream metadata.
  - Issue `block_ip` via Action Panel (or `demo/run_incident.sh ssh_bruteforce --auto-block`).
  - Check action.request and action.result receipts; ensure status = `applied`.
  - Export proof bundle and verify (`offsec-proof-verify`), attach to incident ticket.
- **If Guardian dies/misbehaves**:
  - Restart: `cd apps/guardian && poetry run guardian run` (ensure `OFFSEC_GUARDIAN_ID` set).
  - Confirm it is sending events: look for its `guardian_id` in ThreatStream and new receipts on disk.
  - If capability errors appear, rotate HS secret or key and restart both Guardian and portal-ext with matching secrets.

## 6) Ops Hygiene
- **Rotate secrets**: `OFFSEC_JWT_HS256_SECRET` (portal-ext) and Guardian JWT keys (`GUARDIAN_JWT_PRIVATE_KEY` or HS secret). Restart both ends.
- **Guardian identity**: set `OFFSEC_GUARDIAN_ID`/`GUARDIAN_ID` per host; optional `GUARDIAN_TAGS="bastion,eu-west-1"`.
- **Backups**: snapshot `$OFFSEC_DATA_DIR` (receipts + ROOT.txt + ANCHOR.json). These are the auditable artifacts.
- **Cleaning old receipts**: move/archive `data/receipts/offsec/*.json` after copying `ROOT.txt`/`ANCHOR.json`; do not edit files in place.
- **Ports**: UI 3001, portal-ext 9115 (`/offsec/*` + `/offsec/ws`), Guardian action server 9120 (by default).

## 7) Appendix
- **Env vars (common)**:
  - Portal-ext: `OFFSEC_LISTEN`, `OFFSEC_JWT_HS256_SECRET`, `OFFSEC_JWT_PUBLIC_KEY`, `OFFSEC_CAP_AUD`, `OFFSEC_DATA_DIR`, `OFFSEC_GUARDIAN_URL`.
  - Guardian: `GUARDIAN_CONFIG` (TOML path), `OFFSEC_GUARDIAN_ID`/`GUARDIAN_ID`, `GUARDIAN_TAGS`, `GUARDIAN_JWT_PRIVATE_KEY`, `GUARDIAN_JWT_HS256_SECRET`, `GUARDIAN_CAP_AUD`, `OFFSEC_PORTAL_URL`, `OFFSEC_ACTION_SERVER_PORT`.
  - UI: `NEXT_PUBLIC_OFFSEC_API_URL`, `NEXT_PUBLIC_OFFSEC_WS`, `NEXT_PUBLIC_OFFSEC_ACTION_TOKEN` (optional bearer for /offsec/action/apply).
- **Endpoints**:
  - `POST /offsec/ingest` (capability required): threat events.
  - `POST /offsec/action` (capability): Guardian-initiated action.
  - `POST /offsec/action/apply` (capability): operator-issued action.
  - `POST /offsec/action/update`: Guardian posts action result.
  - `GET /offsec/receipts?guardian_id=`: recent receipts.
  - `GET /offsec/proof/:id`: proof bundle by receipt id.
- **File outputs**:
  - Receipts: `$OFFSEC_DATA_DIR/receipts/offsec/*.json`
  - Latest Merkle root: `$OFFSEC_DATA_DIR/ROOT.txt`
  - Anchor (if watcher enabled): `$OFFSEC_DATA_DIR/ANCHOR.json`

Hand this doc plus `demo/run_incident.sh` to a teammate—they should be able to run a scenario, trigger an action, and verify a proof without further guidance.
