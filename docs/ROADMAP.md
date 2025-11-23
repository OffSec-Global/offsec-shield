# OffSec Shield Roadmap

Milestones to reach a hardened v1.0. Dates are placeholders; adjust per release cadence.

## v0.1 (Foundations)
- Compose-based dev stack (UI + Guardian + Portal-Ext)
- Stub capability validation
- WebSocket threat stream to UI
- Basic detectors: brute_force, scanner
- Actions: block_ip, alert_human, quarantine (stub)
- Receipt placeholders to VaultMesh

## v0.2 (Hardening)
- Capability validation against VaultMesh API
- Token rotation + expiry enforcement
- Guardian buffering + retry for network partitions
- TLS termination (nginx) + mTLS between Guardian ↔ Portal-Ext
- UI action approvals + role-aware controls
- Guardian DaemonSet manifest for k8s
- Telemetry: Prometheus metrics

## v0.3 (Reliability)
- Persistent storage for events/receipts (SQLite/Postgres)
- WS fan-out via Redis or NATS
- Rate limiting + request signing
- Detector tuning + false-positive suppression
- Receipt integrity checks + merkle proof verification

## v1.0 (Production)
- SOC workflows: cases, annotations, escalations
- Live traffic replay & detonation sandbox hooks
- Threat intel feeds (STIX/TAXII) normalization
- Multi-tenant policy isolation
- Audit-grade logging + SIEM export (CEF/LEEF)
- SLOs: latency/error budgets for ingest/action/receipt paths
