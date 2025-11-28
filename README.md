# OffSec Shield

**Battle-ready security operations intelligence platform** — real-time threat detection, autonomous response, and cryptographic proof ledger.

## 🎯 Quick Start

```bash
# Install tools (Rust, Node, Python)
make tools-install

# Local dev stack
make dev

# Run all tests
make test

# Format & lint
make format
```

Open http://localhost:3001 for the UI. Portal extension runs on http://localhost:9115.

## 📦 Structure

```
apps/ui/          # Next.js black/green dashboard
apps/guardian/    # Python AI threat detector
apps/portal-ext/  # Rust integration with VaultMesh Portal
docs/             # spec, architecture, events, roadmap, customers
infra/k8s/        # starter Deployment/Service/DaemonSet
infra/nginx/      # reverse proxy
infra/systemd/    # unit files
config/           # example configs (dev, prod, logging)
scripts/          # dev-up/down, format, test
```

## 🔌 Components

| Component | Tech | Role |
|-----------|------|------|
| **UI** | Next.js + TypeScript | Real-time threat stream, proof ledger, action panel |
| **Guardian** | Python | Log ingestion, heuristic detectors, action orchestration |
| **Portal-Ext** | Rust + Axum | Capability validation, receipt emission, WebSocket stream to UI |

## 🚀 Development

### Requirements
- Node.js 18+
- Python 3.10+
- Rust 1.70+
- Docker & docker-compose

### Install & Run

```bash
# First time
make tools-install
make dev

# Then open VSCode
code .

# In VSCode terminals:
# Terminal 1: cd apps/ui && npm run dev
# Terminal 2: cd apps/guardian && poetry run guardian run
# Terminal 3: cd apps/portal-ext && cargo run

# UI config (defaults are set)
# export NEXT_PUBLIC_OFFSEC_API_URL=http://localhost:9115
# export NEXT_PUBLIC_OFFSEC_WS=ws://localhost:9115/offsec/ws
```

## 📚 Documentation

- [OPERATOR_HANDBOOK.md](docs/OPERATOR_HANDBOOK.md) — How to run, operate, and verify Shield end-to-end
- [INCIDENT_PLAYBOOKS.md](docs/INCIDENT_PLAYBOOKS.md) — Runnable attack stories and rehearsal steps
- [SPEC.md](docs/SPEC.md) — Complete technical specification
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design, flows, ports
- [EVENTS.md](docs/EVENTS.md) — Event/action/receipt schema
- [ROADMAP.md](docs/ROADMAP.md) — v0.1 → v1.0 timeline
- [CUSTOMERS.md](docs/CUSTOMERS.md) — Personas and operating modes

Receipts are written to `data-offsec/receipts/infrastructure/*.json` with proofs in `data-offsec/proofs/` (configurable via `OFFSEC_DATA_DIR`, default `./data-offsec`).
Anchoring stub: run `scripts/root_watcher.py` to watch `ROOT.txt`, write `ANCHOR.json`, and (optionally) broadcast `offsec.anchor.*` events via HTTP.

## 🧪 Ledger Integration Demo

1. `export OFFSEC_DATA_DIR=./data-offsec` (or point elsewhere; issuer defaults to `did:vm:node:offsec-shield`).
2. Provision `data-offsec/trusted_issuers.json` with trusted DIDs → verifying key hex (Ed25519).
3. Generate a capability token (base64 of signed capability JSON) and `export OFFSEC_CAPABILITY_B64=<token>`.
4. Start Portal-Ext: `cd apps/portal-ext && cargo run`.
5. One-time dependency: `python3 -m pip install requests`.
6. Send a sample infra event: `python3 integration/offsec_event_demo.py` (uses `OFFSEC_CAPABILITY_B64`).
7. Inspect receipts/proofs in `data-offsec/` and fetch the incident: `curl http://localhost:9115/api/offsec/incidents/<incident_id>`.

Helper to mint a capability token for testing:
`python3 -m pip install pynacl` then `python3 tools/make_capability.py --issuer did:vm:node:sovereign --sk <hex_priv> --scopes infrastructure:write --exp-secs 3600` then `export OFFSEC_CAPABILITY_B64=<output>`

API:
- `POST /api/offsec/events` — accepts InfrastructureEvent JSON with `Authorization: Bearer <base64-capability>` and returns `incident_id` + `receipt_id`.
- `GET /api/offsec/incidents/:id` — returns receipts for a chain.

## 📝 License

MIT — See [LICENSE](LICENSE)
