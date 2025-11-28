#!/usr/bin/env bash
# Inject test threat events for OffSec Shield UI testing
# These events flow through Portal-Ext to WebSocket and are received by the UI
# 
# Usage:
#   ./scripts/inject-test-event.sh                    # SSH bruteforce
#   ./scripts/inject-test-event.sh port-scan          # Port scanning
#   ./scripts/inject-test-event.sh anomaly 192.168.1.50  # Anomaly on specific IP

set -euo pipefail

OFFSEC_API_URL="${OFFSEC_API_URL:-http://localhost:9115}"
OFFSEC_JWT_HS256_SECRET="${OFFSEC_JWT_HS256_SECRET:-dev-secret}"
GUARDIAN_ID="${OFFSEC_GUARDIAN_ID:-guardian-test}"

THREAT_TYPE="${1:-ssh.bruteforce}"
TARGET_IP="${2:-203.0.113.42}"

# Use Guardian's venv which has PyJWT
source /home/sovereign/.cache/pypoetry/virtualenvs/offsec-guardian-cYAu6nz6-py3.13/bin/activate 2>/dev/null || true

# Generate JWT token with ingest action
mint_token() {
  python3 << 'PY'
import os, time, jwt
secret = os.environ.get("OFFSEC_JWT_HS256_SECRET", "dev-secret")
guardian_id = os.environ.get("GUARDIAN_ID", "guardian-test")
aud = "offsec-portal"
now = int(time.time())
claims = {
    "sub": guardian_id,
    "aud": aud,
    "iat": now,
    "exp": now + 900,
    "actions": ["ingest"],
}
print(jwt.encode(claims, secret, algorithm="HS256"))
PY
}

echo "[*] Generating JWT token..."
TOKEN=$(GUARDIAN_ID="$GUARDIAN_ID" OFFSEC_JWT_HS256_SECRET="$OFFSEC_JWT_HS256_SECRET" mint_token)

# Build event description based on threat type
case "$THREAT_TYPE" in
  ssh.bruteforce)
    DESCRIPTION="SSH brute-force attack detected"
    TAGS='["ssh", "authentication", "critical"]'
    ;;
  port-scan)
    DESCRIPTION="Port scanning activity detected on network segment"
    TAGS='["network", "reconnaissance", "high"]'
    ;;
  anomaly)
    DESCRIPTION="Anomalous behavior detected on host"
    TAGS='["anomaly", "behavior", "medium"]'
    ;;
  *)
    DESCRIPTION="Security threat detected: $THREAT_TYPE"
    TAGS='["custom", "test"]'
    ;;
esac

TIMESTAMP=$(date -Iseconds)
EVENT_ID="test-$THREAT_TYPE-$(date +%s)"

echo "[*] Injecting $THREAT_TYPE event from $TARGET_IP to $OFFSEC_API_URL/offsec/ingest"

PAYLOAD=$(cat <<EOF
{
  "id": "$EVENT_ID",
  "timestamp": "$TIMESTAMP",
  "severity": "critical",
  "event_type": "threat.detected",
  "source": "$GUARDIAN_ID",
  "description": "$DESCRIPTION",
  "guardian_id": "$GUARDIAN_ID",
  "guardian_tags": $TAGS,
  "affected": ["$TARGET_IP"]
}
EOF
)

echo "[*] Event payload:"
echo "$PAYLOAD" | jq .

RESPONSE=$(curl -s -X POST "$OFFSEC_API_URL/offsec/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo ""
echo "[*] Portal response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Show updated receipt count
RECEIPT_COUNT=$(curl -s "$OFFSEC_API_URL/offsec/receipts" | jq 'length')
echo ""
echo "[✓] Event injected. Total receipts: $RECEIPT_COUNT"
echo "[→] Check UI at http://localhost:3000 (may need refresh)"
echo "[→] Check WebSocket messages: ws://localhost:9115/offsec/ws"
