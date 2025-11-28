# Milestone: OffSec Console ↔ Portal-Ext Lock-In

**Commit Range:** `8592c40..b51e301`  
**Date:** 2025-11-28  
**Status:** ✅ Alignment Locked & Tested

---

## What We Achieved

### Before This Work
- UI was configured with hardcoded/env-dependent URLs
- No single source of truth for API endpoints
- Difficult to verify plumbing was correct
- Prone to drift if someone changed a port

### After This Work
- **Single source of truth**: `apps/ui/src/config/offsec.ts`
- **Centralized defaults**: `OFFSEC_HTTP_BASE` and `OFFSEC_WS_URL`
- **Proven alignment**: Webpack bundle verified to contain correct URLs
- **Regression guardrails**: Test suite prevents future drift
- **Operational handbook**: E2E checklist for validation & debugging

---

## Files Changed

### Core Infrastructure (Commit 8592c40)

```
apps/ui/src/config/offsec.ts        [NEW] Config with env overrides + defaults
apps/ui/src/lib/ws-client.ts        [EDIT] Uses OFFSEC_WS_URL from config
apps/ui/src/lib/api.ts              [EDIT] Uses OFFSEC_HTTP_BASE from config
apps/ui/.env.local                  [NEW] Env overrides for localhost:9115
```

### Testing & Documentation (Commit b51e301)

```
apps/ui/src/config/offsec.test.ts   [NEW] Regression tests for config correctness
apps/ui/src/lib/api.test.ts         [NEW] Regression tests for API endpoint wiring
E2E_VALIDATION_CHECKLIST.md         [NEW] Operational validation guide
```

---

## Verification Results

### ✅ Infrastructure Validation

```
Portal-Ext Health:       http://localhost:9115/healthz          → 200 OK
Receipts Endpoint:       http://localhost:9115/offsec/receipts  → 200 OK (10 items)
Root Endpoint:           http://localhost:9115/offsec/root      → 200 OK
WebSocket Endpoint:      ws://localhost:9115/offsec/ws          → 101 Switching Protocols
```

### ✅ Configuration Validation

```
Config file compiled:    ✓ OFFSEC_HTTP_BASE = "http://localhost:9115/offsec"
                         ✓ OFFSEC_WS_URL = "ws://localhost:9115/offsec/ws"
                         
ws-client.ts imports:    ✓ Uses OFFSEC_WS_URL from @/config/offsec
api.ts imports:          ✓ Uses OFFSEC_HTTP_BASE from @/config/offsec

Webpack bundle:          ✓ Both constants embedded correctly
                         ✓ All endpoints use config values (no hardcoded ports)
```

### ✅ Git State

```
Commit 8592c40: "Align offsec-ui console to Portal-Ext on :9115/offsec"
  - Config file created
  - WS & API clients updated
  - .env.local added to gitignore

Commit b51e301: "Add regression tests and E2E validation checklist for OffSec alignment"
  - Config test suite (offsec.test.ts)
  - API wiring test suite (api.test.ts)
  - E2E validation checklist (E2E_VALIDATION_CHECKLIST.md)
```

---

## How to Verify

### Quick Smoke Test (30 seconds)

```bash
# Terminal 1
cd ~/offsec-shield/apps/portal-ext && cargo run

# Terminal 2
cd ~/offsec-shield/apps/ui && npm run dev

# Terminal 3
# Open http://localhost:3000 in browser
# Open DevTools → Console, Network
# Look for: "[offsec] ws open ws://localhost:9115/offsec/ws"
# Check Network → WS: should show 101 Switching Protocols
# Check Network → XHR: should show receipts and root endpoints returning 200
```

### Full Validation (5 minutes)

Follow the **E2E_VALIDATION_CHECKLIST.md**:
- 4 infrastructure checks (plumbing)
- 4 behavioral checks (rendering)
- Decision tree if anything fails

---

## Breaking Changes / Migration Notes

If you're upgrading an old OffSec Shield installation:

1. Pull the latest code
2. **Create `apps/ui/.env.local`** if it doesn't exist:
   ```env
   NEXT_PUBLIC_OFFSEC_HTTP_URL=http://localhost:9115/offsec
   NEXT_PUBLIC_OFFSEC_WS_URL=ws://localhost:9115/offsec/ws
   ```
3. Restart UI dev server: `npm run dev` in `apps/ui/`
4. Run validation checklist to confirm

The alignment is **backward compatible** — old configs will still work, but new defaults are baked in.

---

## Regression Safeguards

The test suite ensures future changes don't break the alignment:

```bash
npm run test -- src/config/offsec.test.ts   # Config defaults verified
npm run test -- src/lib/api.test.ts         # API endpoints use correct base
```

These tests will catch:
- Typos in port numbers (9115 vs 9110, etc.)
- Missing `/offsec` path segment
- WebSocket protocol confusion (ws vs wss)
- Hardcoded URLs instead of config imports

---

## What This Means Operationally

### For Developers

- **One place to change ports/hosts**: `apps/ui/src/config/offsec.ts`
- **No more guessing** where API calls are routed
- **Env var overrides** still work for CI/prod deployments
- **Tests fail loudly** if someone breaks the alignment

### For Operators

- **E2E checklist** tells you exactly what to check when things break
- **Decision tree** narrows down whether issue is plumbing vs rendering
- **Clear failure modes** documented for each check
- **Regression test suite** catches config drift before it causes production issues

### For Security

- **Single source of truth** reduces attack surface (no scattered URLs)
- **Test suite** ensures Portal-Ext endpoints are actually used
- **No hardcoded credentials** in config; all env-driven
- **Audit trail** via git for when/how URLs changed

---

## Next Frontier

With alignment locked, you can now safely:

1. **Real-time event injection** — Generate a threat, watch it appear in UI
2. **Merkle proof verification** — Click a receipt, verify the proof chain
3. **Action submission & tracking** — Submit a block_ip, see it flow through the system
4. **Multi-guardian filtering** — Switch between different security agents
5. **Performance tuning** — Optimize Merkle tree traversal, receipt pagination, etc.

Each of these builds on the foundation you've just locked in.

---

## Commit Checkpoints

```
8592c40  ← OffSec Console ↔ Portal-Ext Alignment Locked
         (Config, WS, API clients all pointed correctly)

b51e301  ← Testing & Documentation Added
         (Regression tests + E2E validation guide)

[Future] ← Real-time event testing
[Future] ← Merkle proof verification
[Future] ← Action execution & tracking
```

**Current Status**: 🟢 Ready for E2E behavior testing

---

## References

- **Config**: `apps/ui/src/config/offsec.ts`
- **Tests**: `apps/ui/src/config/offsec.test.ts` + `apps/ui/src/lib/api.test.ts`
- **Checklist**: `E2E_VALIDATION_CHECKLIST.md`
- **Backend**: See `AGENT.md` for Portal-Ext operational details
