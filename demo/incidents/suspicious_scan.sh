#!/usr/bin/env bash
# Scenario: Low-and-slow port scan/recon. Emits a handful of recon events and optionally raises an alert_human action.

set -euo pipefail

OFFSEC_API_URL="${OFFSEC_API_URL:-http://localhost:9115}"
OFFSEC_JWT_HS256_SECRET="${OFFSEC_JWT_HS256_SECRET:-dev-secret}"
GUARDIAN_ID="${OFFSEC_GUARDIAN_ID:-${GUARDIAN_ID:-guardian-demo}}"
GUARDIAN_TAGS="${GUARDIAN_TAGS:-sensor,edge}"
GUARDIAN_CAP_AUD="${GUARDIAN_CAP_AUD:-offsec-portal}"

BURSTS=3
DELAY="0.6"
SOURCE_IP="198.51.100.42"
ALERT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bursts) BURSTS="${2:-3}"; shift 2 ;;
    --ip) SOURCE_IP="${2:-$SOURCE_IP}"; shift 2 ;;
    --delay) DELAY="${2:-$DELAY}"; shift 2 ;;
    --alert) ALERT=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

mint_token() {
  python - <<'PY'
import os, time, jwt
secret = os.environ.get("OFFSEC_JWT_HS256_SECRET", "dev-secret")
guardian_id = os.environ.get("GUARDIAN_ID") or os.environ.get("OFFSEC_GUARDIAN_ID") or "guardian-demo"
aud = os.environ.get("GUARDIAN_CAP_AUD", "offsec-portal")
now = int(time.time())
claims = {
    "sub": guardian_id,
    "aud": aud,
    "iat": now,
    "exp": now + 900,
    "actions": ["ingest", "offsec.action.alert_human"],
}
print(jwt.encode(claims, secret, algorithm="HS256"))
PY
}

TOKEN="$(GUARDIAN_ID="$GUARDIAN_ID" OFFSEC_GUARDIAN_ID="$GUARDIAN_ID" GUARDIAN_CAP_AUD="$GUARDIAN_CAP_AUD" OFFSEC_JWT_HS256_SECRET="$OFFSEC_JWT_HS256_SECRET" mint_token)"

build_tags() {
  local tags_csv="$1"
  if [ -z "$tags_csv" ]; then
    echo "[]"
    return
  fi
  IFS=',' read -ra TAG_ARR <<< "$tags_csv"
  local out=""
  for tag in "${TAG_ARR[@]}"; do
    tag_trimmed="$(echo "$tag" | xargs)"
    [ -z "$tag_trimmed" ] && continue
    out+="\"$tag_trimmed\","
  done
  out="${out%,}"
  echo "[${out}]"
}

TAGS_JSON="$(build_tags "$GUARDIAN_TAGS")"
SOURCE_HOST="$(hostname -s 2>/dev/null || echo "unknown-host")"

echo "[suspicious_scan] API: $OFFSEC_API_URL, guardian_id: $GUARDIAN_ID, source_ip: $SOURCE_IP, bursts: $BURSTS"

for i in $(seq 1 "$BURSTS"); do
  EVENT_ID="port-scan-$SOURCE_IP-$i-$(date +%s)"
  PORTS=$((8000 + i)),$((9000 + i))
  TS="$(date -Iseconds)"
  PAYLOAD=$(cat <<EOF
{
  "id": "$EVENT_ID",
  "timestamp": "$TS",
  "severity": "medium",
  "event_type": "guardian.port_scan",
  "source": "netfilter",
  "source_host": "$SOURCE_HOST",
  "guardian_id": "$GUARDIAN_ID",
  "guardian_tags": $TAGS_JSON,
  "description": "Suspicious scan burst against exposed ports",
  "affected": ["$SOURCE_IP"],
  "metadata": {
    "ports": "$PORTS",
    "burst": $i,
    "sensor": "iptables"
  }
}
EOF
)

  curl -s -o /dev/null -w "%{http_code}" -X POST "$OFFSEC_API_URL/offsec/ingest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" | { read -r code; echo "  -> scan burst $i/$BURSTS (http $code)"; }
  sleep "$DELAY"
done

if [ "$ALERT" -eq 1 ]; then
  ACTION_ID="alert-${SOURCE_IP}-$(date +%s)"
  echo "[suspicious_scan] Raising alert_human (action_id=$ACTION_ID)"
  curl -s -o /dev/null -w "%{http_code}" -X POST "$OFFSEC_API_URL/offsec/action/apply" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"action_id\": \"$ACTION_ID\",
      \"action_type\": \"offsec.action.alert_human\",
      \"guardian_id\": \"$GUARDIAN_ID\",
      \"target\": {\"ip\": \"$SOURCE_IP\"},
      \"reason\": \"Recon detected by suspicious_scan scenario\",
      \"requested_by\": \"incident-pack\",
      \"ts\": \"$(date -Iseconds)\"
    }" | { read -r code; echo "  -> alert request (http $code)"; }
fi

echo "[suspicious_scan] Done. Filter UI by guardian_id=$GUARDIAN_ID to view."
