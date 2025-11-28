# OffSec Shield — Quick Operational Check

**Use this 2-minute check to verify OffSec is operational.**

---

## The Ritual (Do This Each Morning)

```bash
# Terminal 1: Backend
cd ~/offsec-shield/apps/portal-ext
cargo run

# Wait for "listening on 0.0.0.0:9115"

# Terminal 2: UI
cd ~/offsec-shield/apps/ui
npm run dev

# Wait for "Ready in X.Xs"

# Terminal 3: Validation
curl http://localhost:9115/healthz
# Expected: {"status":"ok"}
```

---

## Browser Check (30 Seconds)

1. Open **http://localhost:3000**
2. Open DevTools (F12)
3. Go to **Console** tab
4. Look for: `[offsec] ws open ws://localhost:9115/offsec/ws`
5. Go to **Network → WS** tab
6. Look for: `ws://localhost:9115/offsec/ws` with status `101`
7. Go to **Network → XHR** tab
8. Look for: `receipts` request → 200 OK

---

## If Anything Fails

| What Failed | Check This | Fix |
|---|---|---|
| `[offsec] ws open` not in console | Check if page fully loaded | Refresh browser, check Network tab for errors |
| WS tab is empty or shows error | Portal-Ext listening? | `curl http://localhost:9115/healthz` |
| No `receipts` XHR request | Check Network tab timing | Receipts fetch happens on mount, may be fast |
| Any 404 or 500 in Network | Check Portal-Ext logs | See AGENT.md for debugging |

---

## UI Shows Data? ✅

If you see:
- Threat Stream panel with events
- Proof Ledger panel with receipts
- Stats showing non-zero counts

**OffSec Shield is operational.**

---

## UI Is Empty? 🔍

Follow the decision tree in `E2E_VALIDATION_CHECKLIST.md`:
1. Infrastructure working? (WS 101, HTTP 200)
2. State management issue? (Logs show data but JSX empty)
3. Component not rendering? (Add console.log to verify)

---

## Can't Remember the Port?

```bash
# From project root
grep "OFFSEC_HTTP_BASE\|OFFSEC_WS_URL" apps/ui/src/config/offsec.ts

# Expected:
# OFFSEC_HTTP_BASE = "http://localhost:9115/offsec"
# OFFSEC_WS_URL = "ws://localhost:9115/offsec/ws"
```

---

## Alignment Locked Commits

```
8592c40  Config + wiring aligned
b51e301  Tests + checklist added
50de8c5  Milestone summary documented
```

**Never commit `.env.local` — it's in `.gitignore`.**

---

**Status**: 🟢 Ready  
**Last Check**: 2025-11-28  
**Validation Guide**: See `E2E_VALIDATION_CHECKLIST.md`
