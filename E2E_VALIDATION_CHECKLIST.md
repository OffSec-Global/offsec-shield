# OffSec Shield — E2E Behavior Validation Checklist

**Commit:** 8592c40 (OffSec Console ↔ Portal-Ext alignment locked)

This checklist verifies that the OffSec Shield console is properly wired to Portal-Ext and all data flows are operational.

---

## Quick Start (2 terminals)

```bash
# Terminal 1: Start Portal-Ext backend
cd ~/offsec-shield/apps/portal-ext
cargo run

# Terminal 2: Start UI console
cd ~/offsec-shield/apps/ui
npm run dev
```

Then open: **http://localhost:3000** (or 3001 if configured)

---

## Infrastructure Checklist

These verify that the **plumbing is correct** (URLs, ports, WebSocket upgrade).

### 1. Backend Health

```bash
curl http://localhost:9115/healthz
# Expected: {"status":"ok"}
```

**Pass?** ☐ Yes ☐ No

---

### 2. WebSocket Connectivity

Open DevTools → **Network → WS** tab:

- [ ] Entry for `ws://localhost:9115/offsec/ws` exists
- [ ] Status is `101 Switching Protocols`
- [ ] Connection stays open (not immediately closing)

If WebSocket shows error:
- Verify Portal-Ext is running and listening on 9115
- Check browser console for connection logs

**Pass?** ☐ Yes ☐ No

---

### 3. HTTP Endpoints

Open DevTools → **Network → Fetch/XHR** tab:

Check these requests exist and return 200:

```
GET http://localhost:9115/offsec/receipts
Expected: 200 OK, JSON array length 10 (or more)

GET http://localhost:9115/offsec/root
Expected: 200 OK, { "root": "bce499be..." }
```

**Receipts 200?** ☐ Yes ☐ No  
**Root 200?** ☐ Yes ☐ No

If HTTP calls are failing:
- Check Portal-Ext logs for errors
- Verify data directory exists: `data-offsec/receipts/offsec/`

---

### 4. Console Logs

Open DevTools → **Console** tab:

Look for:
```
[offsec] ws open ws://localhost:9115/offsec/ws
```

This log confirms the WebSocket connection was established with the **correct URL**.

**Log present?** ☐ Yes ☐ No

If missing:
- Check if there are any JS errors in console
- Verify `.env.local` was picked up by Next.js (shown in build output)

---

## Behavioral Checklist

These verify that the **UI is rendering and responding to data**.

### 5. Threat Stream Panel

Expected to show **10 threat events** (from the test data you already injected):

- [ ] Panel is visible and labeled "Threat Stream"
- [ ] Shows at least 5 events
- [ ] Each event has: severity badge (critical/high/medium), event_type, source, timestamp
- [ ] Events are sorted (newest first)

**Pass?** ☐ Yes ☐ No

If empty:
- Check if receipts fetched successfully (step 3)
- Look for any network errors in DevTools
- Add console log in component: `console.log("[offsec] receipts", receipts)`

---

### 6. Proof Ledger Panel

Expected to show **10 receipts** (matching Threat Stream events):

- [ ] Panel is visible and labeled "Proof Ledger"
- [ ] Shows exactly 10 receipt entries
- [ ] Each receipt shows: ID, timestamp, Merkle root (truncated)
- [ ] Clickable or selectable entries

**Pass?** ☐ Yes ☐ No

If empty:
- Verify `getCurrentRoot()` call succeeded (check Network tab)
- Check if receipts state is being updated from API response

---

### 7. Stats Card Row

Expected to show non-zero counts:

- [ ] "Threats" card shows: 10 (or more)
- [ ] "Receipts" card shows: 10 (or more)
- [ ] "Actions" card shows: 0 or more
- [ ] "Guardians" card shows: at least 1

**Pass?** ☐ Yes ☐ No

If zeros:
- Verify WS and HTTP are both connected (steps 2–3)
- Check component re-renders when state updates

---

### 8. Connection Status

Look for a connection indicator (usually top-right or header):

- [ ] Shows "Connected" or similar (not "Disconnected")
- [ ] Indicator changes color based on status (green = connected)

**Pass?** ☐ Yes ☐ No

If shows "Disconnected":
- WebSocket connection is open (101) but the state isn't wired
- Check `src/app/page.tsx` for `setConnected(true)` in ws.onopen callback

---

## Debug Decision Tree

If something fails above, use this to narrow down:

```
IF Infra (steps 1-4) all pass:
  → Issue is React state / rendering
  → Look at component that should display data
  → Add console.log to see if data arrived

IF WS fails (step 2):
  → WebSocket URL is wrong OR Portal-Ext not listening
  → Verify: curl -v ws://localhost:9115/offsec/ws
  → Check .env.local was applied (restart UI dev server)

IF HTTP fails (step 3):
  → Portal-Ext may be down OR receipts not written
  → Check: curl http://localhost:9115/healthz
  → Verify: ls data-offsec/receipts/offsec/ | wc -l

IF Console log missing (step 4):
  → UI may not have restarted after .env.local change
  → Stop `npm run dev`, clear .next, restart

IF Stats/Panels empty but Network is 200 (steps 5-7):
  → Components not reading API response OR not re-rendering
  → Add logging: console.log("state:", events, receipts, currentRoot)
  → Check that useEffect dependencies are correct
```

---

## Regression Test Suite

Run these to ensure future changes don't break the alignment:

```bash
cd ~/offsec-shield/apps/ui

# Config tests (OFFSEC_HTTP_BASE, OFFSEC_WS_URL)
npm run test -- src/config/offsec.test.ts

# API wiring tests (endpoints use correct base URL)
npm run test -- src/lib/api.test.ts

# Full test suite
npm run test
```

All tests should pass. If they fail:
- Recheck that `src/config/offsec.ts` exports the correct defaults
- Verify `src/lib/api.ts` and `src/lib/ws-client.ts` import from config

---

## "OffSec Shield is Operational" Criteria

✅ **All of the following must be true:**

1. Infrastructure checks (steps 1–4): All pass
2. Behavioral checks (steps 5–8): All pass
3. Regression tests: All pass (`npm run test`)
4. No errors in browser console (beyond warnings)

---

## Next Steps After Validation

Once this checklist passes:

- [ ] Real-time event injection test (generate a new threat, see it appear in UI)
- [ ] Merkle proof verification flow (click a receipt, verify proof)
- [ ] Action submission and tracking (submit a block_ip action, see it in Actions panel)
- [ ] Guardian multi-filter (select different guardians, verify filtering works)

---

## Notes

- **Timestamps**: All times should be ISO 8601 and recent (within the last hour)
- **Merkle Roots**: Should be hex strings (64 chars) like `bce499be3c5f6c62...`
- **IDs**: Receipt IDs start with `offsec-` or similar
- **Rate Limit**: WebSocket is live-streamed; don't expect data to be backfilled. Only new events appear after you refresh the page.

---

**Last Updated:** 2025-11-28  
**Alignment Locked At:** `8592c40`
