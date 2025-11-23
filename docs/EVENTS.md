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
| `source_host` | string | Hostname emitting the event |
| `source_role` | string | e.g. `bastion|worker|edge` |
| `guardian_id` | string | REQUIRED: identity of the Guardian |
| `guardian_tags` | string[] | Optional tags, e.g. `["bastion","eu-west-1"]` |
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
  "source_host": "guardian-a",
  "guardian_id": "guardian-a",
  "guardian_tags": ["bastion", "eu-west-1"],
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
| `target` | string or object | IP/user/host (UI uses `{ip: "203.0.113.5"}`) |
| `reason` | string | Why this action |
| `created_at` | RFC 3339 string | When requested |
| `guardian_id` | string | REQUIRED: Guardian requesting/owning the action |
| `guardian_tags` | string[] | Optional |
| `requested_by` | string | Optional UI/operator id |

## Receipt (Portal-Ext → VaultMesh + UI)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | Receipt id |
| `action_id` | string (uuid) | Action link |
| `timestamp` | RFC 3339 string | When recorded |
| `hash` | string | sha256(action_id + timestamp + secret) |
| `proof` | string | Merkle/ledger proof (opaque) |
| `guardian_id` | string | Guardian responsible for the event/action |
| `guardian_tags` | string[] | Optional |
| `agent_id` | string | Deprecated alias for `guardian_id` |

## WebSocket Frames (Portal-Ext → UI)

```json
{ "type": "threat_event", "data": { ...ThreatEvent } }
{ "type": "action_update", "data": { "id": "...", "status": "executed", "guardian_id": "guardian-a" } }
{ "type": "receipt", "data": { ...Receipt } }
{ "type": "offsec.action.requested", "data": { "action_id": "...", "guardian_id": "guardian-a", ... } }
{ "type": "offsec.action.result", "data": { "action_id": "...", "status": "applied", "guardian_id": "guardian-a" } }
```

UI should treat unknown `type` values as no-ops for forward compatibility.
