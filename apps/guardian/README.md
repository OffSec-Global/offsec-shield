# OffSec Guardian
Real-time threat detection agent with autonomous response capabilities.

## Features
- Log ingestion from SSH, Nginx, firewall, and VaultMesh Portal (stubs in `log_sources/`)
- Modular detectors (`detectors/`) for brute force, scanner, anomaly (stub)
- Capability-based action execution (`actions/`)
- Event/receipt handoff to Portal-Ext via HTTP

## Quick Start

```bash
poetry install
poetry run guardian run
```

## Configuration

Copy `config/dev.example.toml` (repo root) to `config/dev.toml` and point `GUARDIAN_CONFIG` to it.

## Architecture

```
Log Sources → Detectors → Actions → Portal-Ext (receipts + WS)
```

## Testing

```bash
poetry run pytest tests/ -v
```
