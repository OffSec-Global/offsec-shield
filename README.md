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

- [SPEC.md](docs/SPEC.md) — Complete technical specification
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design, flows, ports
- [EVENTS.md](docs/EVENTS.md) — Event/action/receipt schema
- [ROADMAP.md](docs/ROADMAP.md) — v0.1 → v1.0 timeline
- [CUSTOMERS.md](docs/CUSTOMERS.md) — Personas and operating modes

Receipts are written to `data/receipts/offsec/*.json` with a rolling `ROOT.txt` merkle root (configurable via `OFFSEC_DATA_DIR`).
Anchoring stub: run `scripts/root_watcher.py` to watch `ROOT.txt`, write `ANCHOR.json`, and (optionally) broadcast `offsec.anchor.*` events via HTTP.

## 📝 License

MIT — See [LICENSE](LICENSE)
