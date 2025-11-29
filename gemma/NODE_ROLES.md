# VaultMesh Node Roles & Architecture

**Version:** 2.0 (Updated with BETA cold-node)  
**Date:** November 28, 2025  
**Status:** Production Architecture

---

## Executive Summary

VaultMesh operates as a hybrid hot/cold infrastructure mesh:

- **HOT NODES** (always-on, provide authoritative services)
  - GAMMA - Root node, DNS authority, mesh coordinator
  - BRICK - Compute, GitLab runners, dev plane
  - BUNKER-DE - Cloud vault, OffSec node, receipts
  - AKASH-x - Disposable compute bursts (stateless)

- **COLD NODES** (offline-capable, non-authoritative)
  - BETA - Backup, cold storage, offline verification

---

## Network Topology

```
┌─────────────────────────────────────────────────────┐
│              OPERATOR (MAC)                         │
│          Control plane / Admin terminal             │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        │              │              │              │
        ▼              ▼              ▼              ▼
    
  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
  │  GAMMA   │   │  BRICK   │   │ BUNKER   │   │ AKASH   │
  │          │   │          │   │   DE     │   │  (N)    │
  │ DNS ROOT │   │ COMPUTE  │   │ VAULT    │   │STATELESS│
  │ PKI CORE │   │ RUNNERS  │   │ OFFSC    │   │COMPUTE  │
  │ MESH HUB │   │ PORTAL   │   │ RECEIPTS │   │BURSTS   │
  │  HOT 🟢  │   │  HOT 🟦   │   │  HOT 🟠   │   │ HOT    │
  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬────┘
       │              │              │              │
       └──────────────┼──────────────┼──────────────┘
                      │
                  MESH NETWORK
                (Coordinated by GAMMA)
                      │
                      │
                      │
                      ▼
                  ┌──────────┐
                  │   BETA   │
                  │          │
                  │ COLD     │
                  │ BACKUP   │
                  │ STORAGE  │
                  │ OFFLINE  │
                  │ COLD 🔵   │
                  └──────────┘
              (Optional, 0-uptime)
```

---

## Node Classifications

### HOT NODES

**Definition:** Always-on, provide authoritative services, coordinated by mesh brain.

#### 🟢 GAMMA - Root Node (Primary)

**Purpose:**
- DNS authority (authoritative nameserver)
- PKI & key management root
- Mesh coordinator (peer registry, service discovery)
- Operator terminal (future, when Mac is retired)

**Criticality:** CRITICAL - Mesh cannot function without GAMMA online

**Must run:**
- dnsmasq (authoritative DNS for `.mesh` domain)
- mesh-daemon (peer coordination, registry)
- ssh (secure access)
- wireguard/tailscale (mesh connectivity)

**Must NOT run:**
- Services dependent on other nodes
- Volatile stateful workloads
- Anything that fails if offline resources appear

**Network:**
- LAN: 192.168.0.191
- Tailscale: DYNAMIC (check `tailscale status`)
- DNS: gamma.mesh
- SSH Aliases: gamma, gamma.local, gamma.mesh, alpha

**Responsibilities:**
- ✓ Authoritative DNS resolution for mesh
- ✓ PKI operations (cert signing, key distribution)
- ✓ Peer registry (who's online, what services available)
- ✓ Mesh daemon (coordinates node communication)
- ✓ Gateway routing (to Tailscale, internet)
- ✓ Time sync (NTP server for other nodes)

**When GAMMA is down:**
- Nodes cannot resolve mesh hostnames
- New nodes cannot join mesh
- Service discovery breaks
- Runners cannot find job coordinators
- BUNKER-DE cannot validate mesh origin
- **ENTIRE MESH IS OFFLINE**

---

#### 🟦 BRICK - Local Compute & Runners

**Purpose:**
- Heavy compute, parallel processing
- GitLab CI/CD runners
- Portal-ext development plane
- Backup operator terminal (if GAMMA fails)

**Criticality:** HIGH - Required for CI/CD, but mesh continues without it

**Must run:**
- gitlab-runner
- compute workloads
- ssh
- mesh-agent (connects to GAMMA)
- optional: backup DNS forwarder (queries GAMMA)

**Must NOT run:**
- Authoritative DNS (use GAMMA via forwarder)
- PKI root (use GAMMA)
- Mesh registry (use GAMMA)
- Long-term data storage (use BUNKER-DE or BETA)

**Network:**
- LAN: 192.168.0.120
- DNS: brick.mesh
- SSH Aliases: brick, brick.local, brick.mesh, beta (legacy)

**Responsibilities:**
- ✓ Run compute workloads (builds, tests, analysis)
- ✓ Execute GitLab CI/CD jobs
- ✓ Portal-ext (dev environment)
- ✓ Forward DNS queries to GAMMA
- ✓ Join mesh (register with GAMMA)
- ✓ Health reporting to GAMMA

**When BRICK is down:**
- CI/CD pipelines fail or queue
- Compute bursts cannot run
- Portal-ext unavailable
- Other nodes continue normally

---

#### 🟠 BUNKER-DE - Cloud Vault & OffSec

**Purpose:**
- Persistent cloud storage (receipts, verification data)
- OffSec operations node
- API gateway for external verification
- Encrypted backup target

**Criticality:** HIGH - Responsible for data retention and OffSec

**Must run:**
- secure storage (encrypted filesystem)
- receipts API
- verification services
- ssh
- mesh-agent (connects to GAMMA)
- optional: backup DNS forwarder (queries GAMMA)

**Must NOT run:**
- Authoritative DNS (use GAMMA via forwarder)
- PKI root (use GAMMA)
- Mesh registry (use GAMMA)
- Unencrypted storage
- Root authority (queries GAMMA for everything)

**Network:**
- Public IP: 134.122.64.228
- Tailscale: 100.97.95.128
- DNS: bunker-de.mesh
- SSH Aliases: bunker, bunker-de, bunker-mesh, bunker-ts, server-node

**Responsibilities:**
- ✓ Persistent encrypted storage
- ✓ Receipts/verification database
- ✓ OffSec tools and operations
- ✓ External API (for Akash, external services)
- ✓ Forward DNS queries to GAMMA
- ✓ Backup target for sensitive data
- ✓ Join mesh (register with GAMMA)

**When BUNKER-DE is down:**
- Data operations pause
- OffSec operations unavailable
- Akash nodes may timeout on API calls
- Other nodes continue normally
- Data remains safe (encrypted offline)

---

#### 🟡 AKASH-001..N - Disposable Compute

**Purpose:**
- Ephemeral, stateless compute bursts
- Externally controlled (by GAMMA)
- High-performance parallel workloads
- Scale up/down automatically

**Criticality:** LOW - Stateless, can disappear at any time

**Must run:**
- compute workload only
- ssh
- mesh-agent (connects to GAMMA)
- DO NOT store persistent data

**Must NOT run:**
- Storage services
- DNS
- Mesh registry
- Stateful data
- Keys or secrets

**Network:**
- IP: DYNAMIC (assigned by Akash protocol)
- DNS: akash-001.mesh, akash-002.mesh, etc.
- SSH Aliases: akash-001, akash-002, ...

**Responsibilities:**
- ✓ Run assigned compute job
- ✓ Report status to GAMMA
- ✓ Shutdown when job completes
- ✓ Forward DNS to GAMMA
- ✓ Refuse any persistent storage requests

**When AKASH nodes are down:**
- Compute bursts queue or fail
- Other mesh services continue
- Mesh does NOT wait for Akash

---

### COLD NODES

**Definition:** Offline-capable, no authoritative services, only joined to mesh when explicitly brought online.

#### 🔵 BETA - Cold Backup & Offline Storage

**Purpose:**
- Cold storage for mesh snapshots
- Offline verification & forensics
- Backup operator terminal (if GAMMA + BRICK fail)
- Secured staging environment
- Dark-runner (emergency workloads)

**Criticality:** NONE - Completely optional, unplugged by default

**Can run:**
- Local verification tools (verify-root, verify-read, integrity checks)
- Offline cryptographic operations
- Archive tools (tar, rsync, incremental backup)
- Build/compile environment (isolated from production)
- Forensics & security audit tools
- OffSec shield testing (no user traffic)

**Must NOT run:**
- DNS service (even if online)
- Mesh registry
- Any authoritative service
- Service that breaks other nodes if BETA is slow/offline

**Network:**
- LAN: 192.168.0.236
- DNS: beta.mesh (but BETA cannot serve DNS)
- SSH Aliases: beta, beta.local, beta.mesh, beta.cold

**Key Characteristic:**
- Can be powered off for weeks/months
- Can be disconnected from network
- Data is always encrypted
- No persistent state required
- No dependencies from other nodes

**Responsibilities (when online):**
- ✓ Store/restore mesh snapshots
- ✓ Verify integrity of mesh state
- ✓ Backup sensitive keys (cold copy)
- ✓ Run offline tests & audits
- ✓ Report status to GAMMA (while online)
- ✓ ZERO ongoing operations while offline

**When BETA is down (offline):**
- **NOTHING breaks** - mesh is unaffected
- **NO timeouts** - other nodes do NOT wait for BETA
- **NO fallback** - BETA is not a failover target
- Cold backups unavailable temporarily
- Offline verification unavailable temporarily

**When BETA is online:**
- Serves as backup operator terminal (emergency only)
- Can receive snapshots from GAMMA
- Can perform full mesh audits
- Can run intensive verification
- Then goes offline again

---

## Service Allocation Matrix

| Service | GAMMA | BRICK | BUNKER-DE | AKASH | BETA |
|---------|:-----:|:-----:|:---------:|:-----:|:----:|
| **DNS (authoritative)** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **DNS (forwarder)** | — | ✓ | ✓ | ✓ | ✗ |
| **PKI Root** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Mesh Registry** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Mesh Daemon** | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Compute/CI** | ✗ | ✓ | ✗ | ✓ | ✗ |
| **Storage** | ✗ | ✗ | ✓ | ✗ | ✓ |
| **OffSec** | ✗ | ✗ | ✓ | ✗ | ✗ |
| **SSH** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Operator Terminal** | ✓ | ✓ (backup) | ✗ | ✗ | ✓ (cold) |

---

## Failover Scenarios

### Scenario 1: GAMMA Offline
**Impact:** CRITICAL - Entire mesh offline
**Why:** DNS, PKI, mesh registry all on GAMMA
**Recovery:** Bring GAMMA back online (1-5 min)
**No substitute:** BETA, BRICK, BUNKER-DE cannot replace GAMMA

### Scenario 2: BRICK Offline
**Impact:** MEDIUM - CI/CD paused, compute blocked
**Why:** Only node running runners
**Recovery:** Bring BRICK online or reroute to AKASH
**Substitute:** None (AKASH is stateless, not persistent)

### Scenario 3: BUNKER-DE Offline
**Impact:** MEDIUM - Data operations paused
**Why:** Only node with persistent encrypted storage
**Recovery:** Bring BUNKER-DE online
**Substitute:** BETA can restore from cold backup (slow)

### Scenario 4: AKASH Nodes Offline
**Impact:** LOW - Compute bursts queue
**Why:** Stateless, can be replaced
**Recovery:** Spin up new AKASH nodes (automatic)
**Substitute:** Route to BRICK (slower but works)

### Scenario 5: BETA Offline
**Impact:** NONE - Mesh continues normally
**Why:** BETA is not authoritative for anything
**Recovery:** None needed (BETA is cold-storage only)
**Substitute:** N/A (BETA is optional)

---

## Operational Rules

### Rule 1: Never Make BETA Authoritative
- BETA can go offline without notice
- No service should depend on BETA being online
- No DNS queries should resolve to BETA as authority
- No PKI operations should use BETA

### Rule 2: GAMMA is Single Point of Truth
- GAMMA is the DNS authority for `.mesh`
- GAMMA holds the mesh registry
- GAMMA issues all certificates
- GAMMA validates all node joins
- **If GAMMA is down, mesh is down**

### Rule 3: All HOT Nodes Use GAMMA as DNS Upstream
```
BRICK → dnsmasq → forward to GAMMA
BUNKER-DE → dnsmasq → forward to GAMMA
AKASH → dnsmasq → forward to GAMMA
```

### Rule 4: BETA Only Serves Itself
- BETA can run local tools
- BETA can provide cold storage
- BETA cannot serve DNS
- BETA cannot provide PKI
- BETA cannot provide mesh coordination

### Rule 5: Graceful Degradation
- Mesh continues with GAMMA + 1+ HOT node
- Mesh survives BRICK offline
- Mesh survives BUNKER-DE offline
- Mesh survives all AKASH offline
- Mesh is unaffected by BETA online/offline

---

## Deployment Checklist

- [ ] **GAMMA Setup**
  - [ ] Install dnsmasq (authoritative DNS)
  - [ ] Configure mesh-daemon
  - [ ] Initialize PKI
  - [ ] Set up mesh-peers registry
  - [ ] Configure Tailscale gateway

- [ ] **BRICK Setup**
  - [ ] Configure DNS forwarder (→ GAMMA)
  - [ ] Install gitlab-runner
  - [ ] Join mesh (register with GAMMA)
  - [ ] Test compute jobs

- [ ] **BUNKER-DE Setup**
  - [ ] Configure encrypted storage
  - [ ] Configure DNS forwarder (→ GAMMA)
  - [ ] Initialize receipts API
  - [ ] Join mesh (register with GAMMA)

- [ ] **AKASH Setup (per node)**
  - [ ] Configure DNS forwarder (→ GAMMA)
  - [ ] Join mesh (register with GAMMA)
  - [ ] Test job execution
  - [ ] Validate stateless operation

- [ ] **BETA Setup**
  - [ ] Initialize cold storage
  - [ ] Do NOT configure DNS service
  - [ ] Do NOT initialize mesh-daemon (on cold)
  - [ ] Set up backup tools
  - [ ] Prepare offline verification environment

---

## DNS Resolution Example

**Query: `gamma.mesh` from BRICK**

```
BRICK$ dig gamma.mesh
  ↓
Local dnsmasq forwarder on BRICK
  ↓
Forward to GAMMA (192.168.0.191:53)
  ↓
GAMMA authoritative DNS
  ↓
Answer: gamma.mesh A 192.168.0.191
  ↓
BRICK$ dig gamma.mesh → 192.168.0.191 ✓
```

**Query: `beta.mesh` from AKASH**

```
AKASH$ dig beta.mesh
  ↓
Local dnsmasq forwarder on AKASH
  ↓
Forward to GAMMA (192.168.0.191:53)
  ↓
GAMMA authoritative DNS
  ↓
Answer: beta.mesh A 192.168.0.236 (or NXDOMAIN if offline)
  ↓
AKASH: If BETA is offline, query returns NXDOMAIN
AKASH: Does NOT wait for BETA, continues normally
```

---

## Why This Architecture?

### Single Root of Truth
- GAMMA is always authoritative
- No split-brain DNS
- No race conditions
- No stale cache inconsistencies

### Graceful Offline-Capability
- BETA can vanish without breaking anything
- AKASH can spin up/down at will
- BRICK can be rebooted without mesh failure
- BUNKER-DE can be backed up without stopping mesh

### Zero-Trust Verification
- BETA can perform offline verification
- No live connection needed
- Cryptographic proofs work offline
- Audits can be independent

### Operational Simplicity
- No DNS failover logic needed
- No cache invalidation problems
- No gossip protocols
- No "eventual consistency" waiting

---

## Future Enhancements

- [ ] GAMMA DNS caching layer (reduce latency)
- [ ] GAMMA peer-to-peer replication to BETA (snapshot)
- [ ] Automated BETA cold backup scheduling
- [ ] GAMMA → BRICK → BUNKER DNS chain (redundancy)
- [ ] Emergency: GAMMA ring (2-3 redundant GAMMA nodes)
- [ ] BETA forensics toolkit pre-installed
- [ ] Automated mesh topology audit (from BETA)

---

## Quick Reference

```
CRITICAL RULES:
1. GAMMA is DNS authority (non-negotiable)
2. BETA must never serve DNS (always)
3. All nodes query GAMMA for authority
4. BETA can be offline indefinitely
5. No service depends on BETA

DEPLOYMENT ORDER:
1. GAMMA (DNS, PKI, mesh registry)
2. BRICK (compute, joins mesh)
3. BUNKER-DE (storage, joins mesh)
4. AKASH nodes (compute, join mesh)
5. BETA (cold storage, joined on-demand)

FAILOVER HIERARCHY:
1. GAMMA: No failover (must restore) — CRITICAL
2. BRICK: Can reroute to AKASH — HIGH
3. BUNKER-DE: Can restore from BETA — HIGH
4. AKASH: Can scale up others — LOW
5. BETA: No failover needed — NONE
```

---

**This architecture supports VaultMesh's hybrid hot/cold operational model.**
