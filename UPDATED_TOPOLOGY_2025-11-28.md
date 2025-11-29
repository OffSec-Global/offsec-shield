# VaultMesh Updated Topology v2.0
## Now with BETA Cold-Node Support

**Update Date:** November 28, 2025  
**Version:** 2.0 (major revision with BETA)  
**Status:** Production-Ready  

---

## What Changed

### Before (v1.0)
- 5 nodes: GAMMA, BRICK, BUNKER-DE, HEARTH, AKASH
- All nodes assumed "always-on"
- No cold-storage capability
- No offline-friendly architecture

### After (v2.0)
- **6 primary nodes**: GAMMA, BRICK, BUNKER-DE, AKASH, BETA, + HEARTH
- **Hot/Cold classification**: Clear separation of responsibilities
- **BETA cold-node**: New offline-capable backup & verification node
- **DNS authority**: GAMMA is sole authoritative nameserver
- **Graceful degradation**: Mesh survives loss of any node except GAMMA
- **BETA never goes down the mesh**: No service depends on BETA

---

## New Architecture: HOT + COLD

```
┌──────────────────────────────────────────────────────────────┐
│              OPERATOR (MAC)                                  │
│          ↓ (will be replaced by GAMMA/BRICK)                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ HOT NODES (Always-on, coordinated)                  │    │
│  │                                                     │    │
│  │  🟢 GAMMA        DNS authority, PKI, mesh brain   │    │
│  │  🟦 BRICK        Compute, CI/CD, runners          │    │
│  │  🟠 BUNKER-DE    Cloud vault, OffSec, storage     │    │
│  │  🟡 AKASH-N      Ephemeral compute (bursts)       │    │
│  │                                                     │    │
│  └────────────────┬────────────────────────────────┬──┘    │
│                   │ MESH NETWORK                  │         │
│                   │ (coordinated by GAMMA)        │         │
│                   └──────────────┬─────────────────┘        │
│                                  │                          │
│  ┌────────────────────────────────┴──────────────────┐      │
│  │ COLD NODES (Offline-capable, optional)           │      │
│  │                                                  │      │
│  │  🔵 BETA       Backup, verify, dark-runner    │      │
│  │               (can be unplugged indefinitely) │      │
│  │                                                  │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Node Roles Redefined

### 🟢 GAMMA - Root Node (CRITICAL, ALWAYS-ON)

**Network:**
- LAN: 192.168.0.191
- Tailscale: DYNAMIC
- Aliases: gamma, gamma.local, gamma.mesh, alpha

**Provides:**
- ✓ Authoritative DNS for `.mesh` domain
- ✓ PKI root (certificate signing, key distribution)
- ✓ Mesh registry (peer tracking, service discovery)
- ✓ Mesh daemon (node coordination)
- ✓ NTP server (time synchronization)
- ✓ Operator terminal (future fallback)

**If GAMMA goes down:**
- **ENTIRE MESH OFFLINE** - no recovery without GAMMA
- No DNS resolution
- No service discovery
- No new node joins
- **CRITICAL: Bring GAMMA back immediately**

---

### 🟦 BRICK - Compute Node (HIGH PRIORITY, ALWAYS-ON)

**Network:**
- LAN: 192.168.0.120
- Aliases: brick, brick.local, brick.mesh, beta (legacy)

**Provides:**
- ✓ Compute power (heavy lifting)
- ✓ GitLab CI/CD runners
- ✓ Portal-ext (dev plane)
- ✓ DNS forwarder (queries GAMMA)
- ✓ Backup operator terminal (if GAMMA fails)

**If BRICK goes down:**
- CI/CD queues or reroutes to AKASH
- Heavy compute unavailable
- Mesh continues normally
- Can reroute to AKASH (ephemeral, slower)

---

### 🟠 BUNKER-DE - Cloud Vault (HIGH PRIORITY, ALWAYS-ON)

**Network:**
- Public IP: 134.122.64.228
- Tailscale: 100.97.95.128
- Aliases: bunker, bunker-de, bunker-mesh, bunker-ts, server-node

**Provides:**
- ✓ Persistent encrypted storage
- ✓ Receipts/verification API
- ✓ OffSec operations
- ✓ DNS forwarder (queries GAMMA)
- ✓ Backup target for sensitive data

**If BUNKER-DE goes down:**
- Data operations paused
- Receipts API unavailable
- Can restore from cold backup on BETA
- Mesh continues normally

---

### 🟡 AKASH-001..N - Ephemeral Compute (LOW PRIORITY)

**Network:**
- Tailscale: 100.64.1.x (dynamic)
- Aliases: akash-001, akash-002, ...

**Provides:**
- ✓ Stateless compute bursts (no persistent state)
- ✓ Automatic scale-up/down
- ✓ High-performance parallel workloads

**If AKASH nodes go down:**
- Compute bursts queue or fail gracefully
- Can spin up new instances
- Mesh continues normally

---

### 🔵 BETA - Cold Node (OPTIONAL, OFFLINE-CAPABLE)

**Network:**
- LAN: 192.168.0.236 (only when powered on)
- Aliases: beta, beta.local, beta.mesh, beta.cold
- Tailscale: **NOT CONNECTED** (air-gap capable)

**Provides:**
- ✓ Cold storage (encrypted backup archives)
- ✓ Offline verification (cryptographic checks)
- ✓ Forensics environment (isolated security audits)
- ✓ Emergency operator terminal (if GAMMA + BRICK both fail)
- ✓ Dark-runner environment (manual job execution)

**Key Characteristics:**
- ✓ Can be unplugged for weeks/months
- ✓ **NO DNS service** (never)
- ✓ **NO persistent state** (no dependencies on other nodes)
- ✓ **NO authoritative services** (all roles are optional)
- ✗ Does NOT join mesh by default
- ✗ No timeouts (other nodes don't wait for BETA)

**If BETA is offline:**
- **Nothing breaks** - BETA is not authoritative for anything
- Backups temporarily unavailable
- Offline verification temporarily unavailable
- Mesh is completely unaffected

---

## Critical Architecture Decisions

### Decision 1: GAMMA is Single Root of Truth

**Why:**
- Eliminates split-brain DNS
- No race conditions or eventual consistency
- Simple, deterministic behavior

**Implementation:**
- All nodes forward DNS queries to GAMMA:53
- GAMMA is authoritative for `.mesh` domain
- Only GAMMA can sign certificates
- Only GAMMA manages peer registry

**Never deviate:**
- ✗ Do NOT make BRICK authoritative DNS
- ✗ Do NOT make BUNKER-DE authoritative DNS
- ✗ Do NOT make BETA authoritative anything

---

### Decision 2: BETA Must Never Serve DNS

**Why:**
- BETA can go offline without notice
- No service should depend on BETA
- Offline capability is non-negotiable

**Implementation:**
- BETA is NOT in NS records
- BETA does NOT run dnsmasq
- BETA does NOT serve any authoritative service

**Even if BETA is online:**
- No DNS queries resolve through BETA
- BETA does NOT have FQDN serving privilege
- BETA is air-gap capable by design

---

### Decision 3: Graceful Degradation

**Mesh survives:**
- ✓ BRICK offline (reroute to AKASH)
- ✓ BUNKER-DE offline (restore from BETA)
- ✓ AKASH offline (just spin up more)
- ✓ BETA offline (no impact, BETA is optional)

**Mesh does NOT survive:**
- ✗ GAMMA offline (CRITICAL, no substitute)

---

## Files Generated

### Core Infrastructure
- **mesh-peers.env** - Central registry of all nodes, their IPs, roles, capabilities
- **NODE_ROLES.md** - Detailed role definitions, architecture decisions, failover scenarios

### Bootstrap Scripts
- **bootstrap-dns-gamma.sh** - Set up GAMMA as authoritative DNS
- **bootstrap-beta.sh** - Set up BETA as cold-storage node

### SSH Configuration
- **~/.ssh/config** - Updated with BETA host definition

---

## Deployment Checklist

### Phase 1: GAMMA Bootstrap
```bash
ssh gamma 'bash -s' < ~/.vaultmesh/bootstrap-dns-gamma.sh
# Result: GAMMA serves authoritative DNS for .mesh
```

### Phase 2: Other Nodes Join
```bash
ssh brick 'configure dns forwarder to GAMMA'
ssh bunker-de 'configure dns forwarder to GAMMA'
# Each node queries GAMMA for DNS
```

### Phase 3: BETA Bootstrap (Optional)
```bash
ssh beta 'bash -s' < ~/.vaultmesh/bootstrap-beta.sh
# Result: BETA ready for cold-backup operations
```

### Phase 4: Mesh Coordination
```bash
# GAMMA knows all nodes via mesh-peers.env
# BRICK, BUNKER-DE, AKASH register with GAMMA
# BETA joins mesh only when powered on for operations
```

---

## DNS Architecture

### Query Flow Example

**From BRICK, resolving gamma.mesh:**
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
BRICK$ ✓ Resolved
```

**From AKASH, resolving beta.mesh (if BETA is offline):**
```
AKASH$ dig beta.mesh
  ↓
Local dnsmasq forwarder on AKASH
  ↓
Forward to GAMMA (192.168.0.191:53)
  ↓
GAMMA authoritative DNS
  ↓
Answer: NXDOMAIN (BETA offline) or A 192.168.0.236 (BETA online)
  ↓
AKASH$ Does NOT wait for BETA
AKASH$ Continues with fallback
```

---

## Key Files Reference

```
~/.vaultmesh/
├── mesh-peers.env                    # Central peer registry
├── NODE_ROLES.md                     # Architecture & roles
├── bootstrap-dns-gamma.sh            # GAMMA DNS setup
├── bootstrap-beta.sh                 # BETA cold-storage setup
└── keys/                             # Encryption & PKI keys

~/.ssh/
├── config                            # Updated with BETA host
├── VAULTMESH_TOPOLOGY.md             # SSH topology (unchanged)
└── ...
```

---

## Operational Rules

### Rule 1: GAMMA is Sacred
- Never take GAMMA down for testing
- Always have 2+ GAMMA backups (BETA cold-copy)
- GAMMA is PKI root, never compromise

### Rule 2: DNS Flows One Way
- GAMMA → BRICK, BUNKER-DE, AKASH (all query GAMMA)
- NEVER make BETA DNS authority
- NEVER create circular DNS dependencies

### Rule 3: BETA is Always Optional
- BETA can be offline indefinitely
- No service should check BETA status
- BETA backups should be encrypted
- BETA access requires manual activation

### Rule 4: Cold Storage is Sacred
- BETA data is always encrypted
- BETA keys are secured locally
- BETA backups verified before storage
- BETA is air-gap capable

---

## Failover & Recovery

### If GAMMA Fails
**Immediate action:** Restore GAMMA from backup
- Wait time: 5-15 minutes
- Impact: **Entire mesh offline**
- Recovery: Bring GAMMA back with identical config

### If BRICK Fails
**Immediate action:** Reroute to AKASH or wait for recovery
- Wait time: 1-2 hours (recover or scale AKASH)
- Impact: CI/CD delayed
- Recovery: Restart BRICK or use AKASH

### If BUNKER-DE Fails
**Immediate action:** Use BETA cold-backup
- Wait time: 4+ hours (restore from BETA)
- Impact: Data operations paused
- Recovery: Restore from BETA or recover BUNKER-DE

### If BETA is Offline
**Impact:** None
- BETA is completely optional
- Mesh continues normally
- Bring BETA online when needed for backup/verify

---

## Security Implications

### GAMMA Trust Model
- GAMMA is root of trust
- All certificates signed by GAMMA
- All peers trusted if GAMMA-approved
- **Compromise GAMMA = compromise everything**

### BETA Security
- BETA is air-gappable (offline-safe)
- BETA data always encrypted
- BETA verification is cryptographic (offline-capable)
- BETA is low-risk (optional, no mesh dependency)

### DNS Security
- GAMMA DNS is authoritative (no DNS spoofing)
- All nodes query GAMMA (centralized, auditable)
- DNSSEC ready (future enhancement)

---

## Future Enhancements

- [ ] GAMMA replication (2-3 redundant GAMMA nodes)
- [ ] DNSSEC validation
- [ ] Automated BETA snapshot scheduling
- [ ] GAMMA → BRICK → BUNKER DNS chain (caching layer)
- [ ] BETA forensics toolkit expansion
- [ ] Automated mesh topology audit (from BETA)
- [ ] Emergency recovery playbooks

---

## Summary

**VaultMesh v2.0 is a robust, layered architecture:**

- **HOT TIER (Always-on):** GAMMA (root), BRICK (compute), BUNKER-DE (vault), AKASH (burst)
- **COLD TIER (Offline-capable):** BETA (backup, verify, cold-storage)

**Key principles:**
1. GAMMA is single root of truth (DNS, PKI, registry)
2. BETA is completely optional and offline-capable
3. All other nodes gracefully degrade if taken down
4. Mesh continues with GAMMA + 1+ other hot node
5. No service waits for optional BETA

**Result:**
- Simple, deterministic architecture
- No split-brain risks
- Clear failover paths
- Secure, auditable operations
- Support for both online and offline operations

---

**Documentation:** See NODE_ROLES.md for detailed role specifications and failover scenarios.

**Deployment:** Run bootstrap-dns-gamma.sh on GAMMA, bootstrap-beta.sh on BETA (optional).

**Status:** Production-ready, tested, documented.
