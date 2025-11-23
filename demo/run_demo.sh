#!/usr/bin/env bash
# One-command OffSec Shield E2E demo:
# Portal-ext + UI + Guardian + signed ingest → receipt + Merkle root + UI update.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OFFSEC_DATA_DIR="${OFFSEC_DATA_DIR:-$ROOT_DIR/data}"
OFFSEC_API_PORT="${OFFSEC_API_PORT:-9115}"
OFFSEC_UI_PORT="${OFFSEC_UI_PORT:-3001}"
OFFSEC_JWT_HS256_SECRET="${OFFSEC_JWT_HS256_SECRET:-dev-secret}"
OFFSEC_GUARDIAN_ID="${OFFSEC_GUARDIAN_ID:-guardian-demo}"
OFFSEC_SKIP_UI="${OFFSEC_SKIP_UI:-0}"
OFFSEC_SKIP_GUARDIAN="${OFFSEC_SKIP_GUARDIAN:-0}"

UI_PID=""
GUARDIAN_PID=""

echo "[demo] Root dir:           $ROOT_DIR"
echo "[demo] OFFSEC_DATA_DIR:    $OFFSEC_DATA_DIR"
echo "[demo] OFFSEC_API_PORT:    $OFFSEC_API_PORT"
echo "[demo] OFFSEC_UI_PORT:     $OFFSEC_UI_PORT"
echo "[demo] HS256 demo secret:  $OFFSEC_JWT_HS256_SECRET"
echo

mkdir -p "$OFFSEC_DATA_DIR"

# Start portal-ext
echo "[demo] Starting portal-ext (cargo run) ..."
(
  cd "$ROOT_DIR/apps/portal-ext"
  OFFSEC_DATA_DIR="$OFFSEC_DATA_DIR" \
  OFFSEC_JWT_HS256_SECRET="$OFFSEC_JWT_HS256_SECRET" \
  OFFSEC_CAP_AUD="offsec-portal" \
  cargo run
) >"$OFFSEC_DATA_DIR/portal-ext.log" 2>&1 &
PORTAL_PID=$!
echo "[demo] portal-ext PID: $PORTAL_PID"

# Start UI
if [ "$OFFSEC_SKIP_UI" != "1" ]; then
  echo "[demo] Starting OffSec Shield UI (npm run dev) ..."
  (
    cd "$ROOT_DIR/apps/ui"
    export NEXT_PUBLIC_OFFSEC_API_URL="http://localhost:${OFFSEC_API_PORT}"
    export NEXT_PUBLIC_OFFSEC_WS="ws://localhost:${OFFSEC_API_PORT}/offsec/ws"
    npm run dev
  ) >"$OFFSEC_DATA_DIR/ui.log" 2>&1 &
  UI_PID=$!
  echo "[demo] UI PID:         $UI_PID"
else
  echo "[demo] Skipping UI (OFFSEC_SKIP_UI=1)"
fi

# Start Guardian
if [ "$OFFSEC_SKIP_GUARDIAN" != "1" ]; then
  echo "[demo] Starting Guardian (poetry run guardian run) ..."
  (
    cd "$ROOT_DIR/apps/guardian"
    OFFSEC_JWT_HS256_SECRET="$OFFSEC_JWT_HS256_SECRET" \
    OFFSEC_GUARDIAN_ID="$OFFSEC_GUARDIAN_ID" \
    GUARDIAN_CAP_AUD="offsec-portal" \
    poetry run guardian run
  ) >"$OFFSEC_DATA_DIR/guardian.log" 2>&1 &
  GUARDIAN_PID=$!
  echo "[demo] Guardian PID:   $GUARDIAN_PID"
else
  echo "[demo] Skipping Guardian (OFFSEC_SKIP_GUARDIAN=1)"
fi

echo
echo "[demo] Waiting for services to boot ..."
for i in {1..20}; do
  if curl -sf "http://localhost:${OFFSEC_API_PORT}/healthz" >/dev/null; then
    break
  fi
  sleep 1
done

echo "[demo] Generating demo JWT & sending /offsec/ingest event ..."

TOKEN=$(cd "$ROOT_DIR/apps/guardian" && OFFSEC_JWT_HS256_SECRET="$OFFSEC_JWT_HS256_SECRET" poetry run python - <<'PY'
import time, os, jwt
secret = os.environ["OFFSEC_JWT_HS256_SECRET"]
now = int(time.time())
claims = {
    "sub": os.environ.get("OFFSEC_GUARDIAN_ID", "guardian-demo"),
    "aud": "offsec-portal",
    "iat": now,
    "exp": now + 300,
    "actions": ["ingest"],
    "nonce": "demo-nonce-001"
}
print(jwt.encode(claims, secret, algorithm="HS256"))
PY
)

curl -s -X POST "http://localhost:${OFFSEC_API_PORT}/offsec/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"demo-evt-1\",
    \"timestamp\": \"$(date -Iseconds)\",
    \"severity\": \"high\",
    \"event_type\": \"guardian.demo_event\",
    \"source\": \"run_demo.sh\",
    \"description\": \"Synthetic OffSec Shield demo event\",
    \"affected\": [\"192.0.2.123\"],
    \"metadata\": {\"attempts\": 7}
  }" >/dev/null || true

sleep 2

echo "[demo] Fetching latest receipt id via API..."
if command -v jq >/dev/null 2>&1; then
  LATEST_ID=$(curl -sf "http://localhost:${OFFSEC_API_PORT}/offsec/receipts?limit=1" \
    | jq -r '.[0].id // .[0].receipt_id' 2>/dev/null || true)
else
  echo "[demo] jq not found; skipping API receipt lookup."
  LATEST_ID=""
fi

if [ -n "${LATEST_ID:-}" ] && [ "${LATEST_ID:-null}" != "null" ]; then
  PROOF_PATH="$OFFSEC_DATA_DIR/demo-proof-${LATEST_ID}.json"
  echo "[demo] Latest receipt id: $LATEST_ID"
  echo "[demo] Downloading proof bundle to $PROOF_PATH ..."
  if curl -sf "http://localhost:${OFFSEC_API_PORT}/offsec/proof/${LATEST_ID}" -o "$PROOF_PATH"; then
    if command -v offsec-proof-verify >/dev/null 2>&1; then
      echo "[demo] Verifying proof bundle with offsec-proof-verify..."
      if offsec-proof-verify "$PROOF_PATH"; then
        echo "[demo] Proof verification ✅"
      else
        echo "[demo] Proof verification ❌"
        exit 1
      fi
    else
      echo "[demo] offsec-proof-verify not found on PATH; skipping verification."
    fi
  else
    echo "[demo] Failed to download proof bundle for $LATEST_ID"
  fi
else
  echo "[demo] Could not resolve latest receipt id; skipping proof verification."
fi

RECEIPTS_DIR="$OFFSEC_DATA_DIR/receipts/offsec"
ROOT_FILE="$OFFSEC_DATA_DIR/ROOT.txt"
LATEST_RECEIPT=$(ls -1t "$RECEIPTS_DIR" 2>/dev/null | head -1 || true)

echo
echo "=== Demo Outputs ==="
echo "Receipts dir: $RECEIPTS_DIR"
echo "Latest receipt: ${LATEST_RECEIPT:-none yet}"
if [ -n "${LATEST_RECEIPT:-}" ]; then
  echo "--- Receipt preview ---"
  head -n 20 "$RECEIPTS_DIR/$LATEST_RECEIPT"
fi
echo
echo "Merkle ROOT.txt:"
cat "$ROOT_FILE" 2>/dev/null || echo "ROOT.txt not yet created"
echo
if [ -n "$UI_PID" ]; then
  echo "UI: http://localhost:${OFFSEC_UI_PORT}"
fi
STOP_PIDS="$PORTAL_PID"
[ -n "$UI_PID" ] && STOP_PIDS="$STOP_PIDS $UI_PID"
[ -n "$GUARDIAN_PID" ] && STOP_PIDS="$STOP_PIDS $GUARDIAN_PID"
echo "Stop with: kill $STOP_PIDS"
