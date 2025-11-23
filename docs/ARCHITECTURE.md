# Architecture & Flows

## System Topology

```
                          [Users]
                            │
              ┌─────────────┴─────────────┐
              │                           │
         [Nginx]                      [Guardian]
          (reverse                   (log agent)
           proxy)                        │
           │                            │
    ┌──────▼──────────────────────────┐ │
    │                                 │ │
    │    ┌─────────────────────────┐  │ │
    │    │    OffSec UI            │  │ │
    │    │  (Next.js/React)        │  │ │
    │    │  :3000 / :3001          │  │ │
    │    └──────────┬──────────────┘  │ │
    │               │                 │ │
    │     ┌─────────▼────────────┐    │ │
    │     │  HTTP + WebSocket    │    │ │
    │     │  /offsec/*           │    │ │
    │     └─────────┬────────────┘    │ │
    │               │                 │ │
    │ ┌─────────────▼───────────────┐ │ │
    │ │  Portal Extension (Rust)    │◄──┘
    │ │  :9115 / :80→/offsec/       │
    │ │  • Ingest events            │
    │ │  • Execute actions          │
    │ │  • Broadcast via WS         │
    │ │  • Emit receipts            │
    │ └─────────────┬───────────────┘
    │               │
    └──────────────┬────────────────────
                   │
        ┌──────────▼─────────┐
        │  VaultMesh Portal  │
        │  :9110             │
        │  • Validate caps   │
        │  • Write receipts  │
        └────────────────────┘
```

## Event Flow

```
1. Host Event
   └─> SSH: failed login attempt
   └─> Nginx: 404 scanning
   └─> Firewall: port sweep
   └─> Portal: auth event

2. Guardian Ingestion
   └─> Tail log file (polling or inotify)
   └─> Parse & match patterns
   └─> Hand to detector

3. Detector Analysis
   BruteForceDetector:
   └─> Count failed attempts per IP
   └─> If >= threshold → emit ThreatEvent
   └─> Include severity, affected IPs, metadata

4. Event Transmission
   Guardian → Portal-Ext (HTTP POST /offsec/ingest)
   ├─ Auth header: Bearer {capability_token}
   └─ Body: ThreatEvent JSON

5. Portal-Ext Processing
   ├─ Validate token with VaultMesh
   ├─ Broadcast event via WebSocket to UI
   ├─ Store in event log
   └─ Emit receipt

6. UI Visualization
   ├─ WebSocket recv → append to threat stream
   ├─ Parse severity → color code (green/yellow/red)
   └─ Render in Threat Stream panel

7. Action Execution
   User clicks "Block IP" in UI
   ├─ Submit to Portal-Ext: POST /offsec/action
   │  Body: { event_id, action: "block_ip", target: "192.168.1.100" }
   ├─ Portal-Ext validates action is allowed
   ├─ Guardian receives & executes (firewall API call)
   └─ Portal-Ext emits Receipt to VaultMesh

8. Proof Ledger
   ├─ Receipt stored in VaultMesh merkle tree
   ├─ Hash: sha256(action_id + timestamp + secret)
   ├─ UI fetches from /offsec/receipts
   └─ Display in Proof Ledger panel (proof of execution)
```

## Component Interactions

### Guardian ↔ Portal-Ext

```
Guardian                          Portal-Ext
  │                                  │
  ├─ POST /offsec/ingest (ThreatEvent)
  │                     token ──────→
  │                                  │
  │ ← 200 OK                         ├─ Validate cap
  │                                  ├─ Broadcast WS
  │                                  └─ Log event
  │
  │ POST /offsec/action (ActionRequest)
  │                     token ──────→
  │                                  │
  │ ← 200 OK                         ├─ Validate action allowed
  │                                  ├─ Emit receipt
  │                                  └─ Broadcast WS
```

### UI ↔ Portal-Ext

```
UI (Browser)                      Portal-Ext
  │                                  │
  ├─ WebSocket upgrade: GET /offsec/ws
  │                              ───→
  │                                  ├─ Accept WS conn
  │                                  └─ Subscribe to events
  │
  ← Message: {"type": "threat_event", "data": {...}}
  │ (whenever event arrives from Guardian)
  │
  │ POST /offsec/receipts ────────→
  │                                  └─ Return receipt log
  │ ← 200 JSON
```

## Data Flow Diagrams

### Brute Force Detection Chain

```
SSH Log:
  "sshd[1234]: Failed password for user admin from 192.168.1.100"
       │
       ▼
Guardian BruteForceDetector
  ├─ Parse IP: 192.168.1.100
  ├─ Increment counter[192.168.1.100] → 3
  ├─ Check if >= threshold (5) → NO
  │
  [next attempt]
  ├─ Increment counter[192.168.1.100] → 5
  ├─ Check if >= threshold (5) → YES
  │
  └─ Emit ThreatEvent {
       id: uuid,
       severity: "high",
       event_type: "brute_force",
       affected: ["192.168.1.100"],
       metadata: { attempts: 5 }
     }
       │
       ▼
  POST /offsec/ingest → Portal-Ext
       │
       ▼
  Portal-Ext receives + validates token
       │
       ├─ Broadcast via WS to UI
       │
       └─ Log to database
           │
           ▼
       UI Threat Stream:
       ├─ Append event
       ├─ Color: yellow (high severity)
       ├─ Display: "Brute force attack detected from 192.168.1.100"
       └─ Timestamp: 2025-11-23T01:33:22Z
```

### Action Approval Flow

```
[Action Pending]
┌─────────────────────────────────────────┐
│ Event: Brute Force                      │
│ Action: Block IP 192.168.1.100          │
│ Status: PENDING                         │
│ ┌───────────────┐ ┌──────────────────┐ │
│ │ [Approve]     │ │ [Reject]         │ │
│ └───────────────┘ └──────────────────┘ │
└─────────────────────────────────────────┘
                 │
             [User clicks Approve]
                 │
                 ▼
        Portal-Ext receives:
        POST /offsec/action
        {
          "id": "action-uuid",
          "event_id": "event-uuid",
          "action": "block_ip",
          "target": "192.168.1.100",
          "created_at": "2025-11-23T01:33:22Z"
        }
                 │
                 ├─ Validate capability
                 ├─ Check: "block_ip" in allowed_actions
                 │
                 ▼
        Guardian executes:
        sudo iptables -A INPUT -s 192.168.1.100 -j DROP
                 │
                 ├─ Success
                 │
                 ▼
        Portal-Ext emits Receipt:
        {
          "id": "receipt-uuid",
          "action_id": "action-uuid",
          "hash": "sha256(...)",
          "timestamp": "2025-11-23T01:33:23Z"
        }
        To VaultMesh Portal (merkle tree)
                 │
                 ├─ UI updates: Status = EXECUTED
                 ├─ Proof Ledger: new entry
                 └─ Firewall rule applied ✓
```

## Ports & Networking

| Component | Port | Protocol | Internal? | Notes |
|-----------|------|----------|-----------|-------|
| UI | 3000 | HTTP | Dev only | Next.js dev server |
| UI (prod) | 3001 | HTTP | Via nginx | Behind nginx @ :80 |
| Guardian | 8001 | – | N/A | No external listen (agent mode) |
| Portal-Ext | 9115 | HTTP/WS | Internal | Behind nginx @ /offsec/ |
| Nginx | 80 | HTTP | External | Reverse proxy |
| Nginx | 443 | HTTPS | External | TLS termination (prod) |
| VaultMesh Portal | 9110 | HTTP | Internal | For receipts + cap validation |

## Deployment Modes

### Local Development
```
make dev
→ UI: http://localhost:3001
→ Guardian: attached to shell
→ Portal-Ext: http://localhost:9115
```

### Docker Compose (Single Host)
```
docker-compose up -d
→ Nginx @ :80 → /offsec/ → Portal-Ext:9115
→ Nginx @ :80 → / → UI:3000
→ Guardian in container (no log access)
```

### Kubernetes (v0.2+)
```
infra/k8s/
├─ portal-ext-deployment.yaml   (3 replicas, load balanced)
├─ ui-deployment.yaml           (1-2 replicas)
├─ guardian-daemonset.yaml      (one per node)
├─ service.yaml                 (expose :80)
└─ ingress.yaml                 (DNS + TLS)
```

## Error Handling

### Invalid Capability Token

```
Guardian: POST /offsec/ingest
  ├─ token: "invalid-token"
  
Portal-Ext:
  ├─ Validate with VaultMesh → NOT FOUND
  ├─ Response: 401 Unauthorized
  │  { "error": "invalid_capability_token" }
  │
  └─ Guardian logs & alerts SOC
```

### Action Not in Allowed Set

```
Guardian wants to: quarantine host
  ├─ Capability token allows: [block_ip, alert_human]
  ├─ "quarantine" NOT in set
  │
Portal-Ext:
  ├─ Response: 403 Forbidden
  │  { "error": "action_not_allowed" }
  │
  └─ Guardian logs & escalates to human review
```

### Network Partition

```
Guardian can't reach Portal-Ext:9115
  ├─ Retry with exponential backoff
  ├─ After N retries: buffer events locally
  ├─ Emit alert: "Portal-Ext unreachable"
  │
Portal-Ext can't reach VaultMesh:9110
  ├─ Accept event
  ├─ Buffer receipt locally
  ├─ Retry emission on next heartbeat
  │
Result: eventual consistency (not at-least-once for receipts yet)
```

---

**See SPEC.md for data models, configuration, and security notes.**
