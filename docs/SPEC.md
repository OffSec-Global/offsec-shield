# OffSec Shield Specification v0.1

## Overview

OffSec Shield is a **real-time threat detection and autonomous response platform** designed for security operations teams. It integrates with VaultMesh Portal as a capability-gated extension, enabling:

- **Log ingestion** from SSH, nginx, firewalls, and application logs
- **Real-time threat detection** via heuristic and ML-based detectors
- **Autonomous response actions** (block IP, alert, quarantine) when capability permits
- **Cryptographic proof ledger** of all actions via VaultMesh receipts
- **Web UI** for threat stream visualization, action control, and ledger audit

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OffSec Shield UI                         │
│              (Next.js, black/green terminal)                │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│               Portal Extension (Rust/Axum)                  │
│  • Ingest events & actions                                 │
│  • WebSocket broadcast to UI                               │
│  • Validate guardian capabilities                          │
│  • Emit receipts to VaultMesh                              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (events/actions)
┌────────────────────────▼────────────────────────────────────┐
│             Guardian Agent (Python)                         │
│  • Log tail & parse (SSH, nginx, FW)                       │
│  • Run detectors (brute_force, scanner, anomaly)           │
│  • Execute actions (if capability permits)                 │
│  • Send events to portal-ext                               │
└────────────────────────┬────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
       ┌────▼─────┐           ┌──────▼──────┐
       │  SSH/    │           │   Firewall  │
       │ Nginx    │           │   & IDS     │
       └──────────┘           └─────────────┘

VaultMesh Portal ◄── Receipt Emission (proof ledger)
```

## Components

### UI (Next.js + TypeScript)

**Port**: `3000` (dev), `3001` (prod via nginx)

**Features**:
- Threat stream (real-time event list)
- Action panel (pending/approved/executed)
- Proof ledger (receipt history)
- Status dashboard (guardian uptime, detection rates)

**Tech**:
- React 18 + Next.js 14
- Black/green terminal aesthetics
- WebSocket for real-time updates
- REST API to portal-ext

### Guardian (Python 3.10+)

**Port**: `8001` (for local dev; no external port in production)

**Features**:
- Log ingestion (tail `/var/log/auth.log`, `/var/log/nginx/access.log`, etc.)
- Pluggable detector system
- Capability-based action execution
- Async/await architecture

**Detectors**:
- `brute_force`: Failed login attempts (SSH, nginx)
- `scanner`: Port scans, vulnerability scanners (firewall logs)
- `anomaly`: Statistical anomalies (ML stub for v0.2)

**Actions**:
- `block_ip`: Add to firewall blocklist
- `alert_human`: Send Slack/email alert
- `quarantine`: Isolate host (systemd/container stop)
- `isolate_host`: Network segmentation (future)

### Portal Extension (Rust + Axum)

**Port**: `9115`

**Endpoints**:
- `POST /offsec/ingest` — Receive threat events from Guardian
- `POST /offsec/action` — Execute action, emit receipt
- `GET /offsec/receipts` — Fetch proof ledger
- `GET /offsec/ws` — WebSocket for UI real-time stream

**Responsibilities**:
- Validate Guardian capability token
- Broadcast events to connected UI clients
- Emit cryptographic receipts through VaultMesh
- Rate limiting & DDoS protection (future)

## Data Models

### ThreatEvent

```json
{
  "id": "uuid",
  "timestamp": "2025-11-23T01:33:22.372Z",
  "severity": "critical|high|medium|low",
  "event_type": "brute_force|scanner|anomaly|lateral_movement",
  "source": "ssh|nginx|firewall|portal",
  "description": "string",
  "affected": ["ip|hostname|user"],
  "metadata": { "attempts": 5 }
}
```

### ActionRequest

```json
{
  "id": "uuid",
  "event_id": "uuid",
  "action": "block_ip|alert_human|quarantine|isolate_host",
  "target": "192.168.1.1",
  "reason": "Brute force from this IP",
  "created_at": "2025-11-23T01:33:22.372Z"
}
```

### Receipt (Proof)

```json
{
  "id": "uuid",
  "action_id": "uuid",
  "timestamp": "2025-11-23T01:33:22.372Z",
  "hash": "sha256(action + timestamp + secret)",
  "proof": "merkle_branch_to_ledger"
}
```

## Capability System

Guardian holds a **capability token** (short-lived JWT) that grants:
- Allowed detector types (e.g., only `brute_force`, not `anomaly`)
- Allowed actions (e.g., `block_ip` only, no `quarantine`)
- Rate limits (e.g., max 10 actions/min)
- Log sources accessible (e.g., only SSH, not Nginx)

Validation flow:
1. Guardian requests action → sends token
2. Portal-Ext validates token with VaultMesh Core
3. If valid & action in allowed set → execute + emit receipt
4. If invalid → reject + alert SOC

## Deployment

### Development

```bash
make tools-install
make dev
```

### Docker Compose

```bash
docker-compose up -d
```

### Kubernetes (v0.2+)

Manifests in `infra/k8s/`:
- Guardian DaemonSet (node agent)
- Portal-Ext Deployment (stateless)
- UI Deployment (web)
- Redis (caching)

## Configuration

See `config/dev.example.toml` and `config/prod.example.toml`.

Key settings:
- `server.listen` — Portal-Ext listen address
- `vaultmesh.portal_url` — VaultMesh integration
- `guardian.capability_token` — Capability grant
- `detectors.enabled` — Active detector set
- `logging.level` — Verbosity

## Testing

```bash
make test
```

Covers:
- Detector unit tests (false positives, edge cases)
- Integration tests (event → action → receipt flow)
- Portal-Ext route validation
- UI component snapshots

## Roadmap

### v0.1 (Current)
✓ Core architecture
✓ Guardian + Portal-Ext + UI
✓ Brute force & scanner detectors
✓ Basic capability validation
✓ Docker Compose stack

### v0.2 (Q1 2025)
- ML-based anomaly detection
- Lateral movement detection
- Redis caching
- Prometheus metrics
- Detailed UI graphs

### v0.3 (Q2 2025)
- Kubernetes deployment
- Multi-tenancy (org isolation)
- Webhook integrations (SOAR)
- Custom detector DSL

### v1.0 (Q3 2025)
- Production hardening
- HA/clustering
- Advanced analytics
- Enterprise support

## Security Notes

- All actions require capability token
- Receipts are cryptographically signed
- Guardian runs with minimal privileges
- Portal-Ext validates all input (OWASP Top 10)
- TLS in production
- No secrets in config files (use env vars)

## Support

Questions? File an issue or contact the team.
