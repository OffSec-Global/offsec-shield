# OffSec Root Watcher

Daemon that watches `ROOT.txt`, anchors new roots, writes `ANCHOR.json` + `anchors/*.json`, and notifies portal-ext so it can broadcast and/or emit receipts.

## Quick Start

```bash
cd apps/root-watcher
poetry install

OFFSEC_DATA_DIR=./data \
OFFSEC_API_URL=http://localhost:9115 \
OFFSEC_ANCHOR_MODE=dev-null \
poetry run root-watcher
```

## Environment

- `OFFSEC_DATA_DIR` (default: `./data`)
- `OFFSEC_API_URL` (default: `http://localhost:9115`)
- `OFFSEC_ROOT_POLL_INTERVAL` (default: `10`)
- `OFFSEC_ANCHOR_MODE` (`vm-spawn` | `dev-null`, default: `vm-spawn`)
- `OFFSEC_ANCHOR_SPAWN_CMD` (default: `vm-spawn anchor --root {root} --tag offsec-shield`)

Anchors are saved under `$OFFSEC_DATA_DIR/anchors/` and the latest anchor lives at `$OFFSEC_DATA_DIR/ANCHOR.json`.
