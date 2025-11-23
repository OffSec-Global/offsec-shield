# OffSec Shield Event & Receipt Schemas

Canonical payloads exchanged between Guardian, Portal-Ext, and the UI. Keep these stable to avoid breaking downstream integrations.

## ThreatEvent (Guardian → Portal-Ext → UI)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | Event identifier |
| `timestamp` | RFC 3339 string | UTC time detected |
| `severity` | `critical|high|medium|low` | Drives UI color & alerting |
| `event_type` | string | `brute_force|scanner|anomaly|...` |
| `source` | string | `ssh|nginx|firewall|portal` |
| `description` | string | Human-readable |
| `affected` | string[] | IPs/users/hosts |
| `metadata` | object | Detector-specific fields |

Example:

```json
{
  "id": "d5d33c04-4e3b-4d09-bd9e-3b71a6d6dcec",
  "timestamp": "2025-11-23T01:33:22.372Z",
  "severity": "high",
  "event_type": "brute_force",
  "source": "ssh",
  "description": "Repeated failed auth from 192.168.1.100",
  "affected": ["192.168.1.100"],
  "metadata": { "attempts": 7 }
}
```

## ActionRequest (UI/Guardian → Portal-Ext)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | Action id |
| `event_id` | string (uuid) | Link to ThreatEvent |
| `action` | `block_ip|alert_human|quarantine|isolate_host` | Capability-gated |
| `target` | string | IP/user/host |
| `reason` | string | Why this action |
| `created_at` | RFC 3339 string | When requested |

## Receipt (Portal-Ext → VaultMesh + UI)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | Receipt id |
| `action_id` | string (uuid) | Action link |
| `timestamp` | RFC 3339 string | When recorded |
| `hash` | string | sha256(action_id + timestamp + secret) |
| `proof` | string | Merkle/ledger proof (opaque) |

## WebSocket Frames (Portal-Ext → UI)

```json
{ "type": "threat_event", "data": { ...ThreatEvent } }
{ "type": "action_update", "data": { "id": "...", "status": "executed" } }
{ "type": "receipt", "data": { ...Receipt } }
```

UI should treat unknown `type` values as no-ops for forward compatibility.
