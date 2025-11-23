#!/usr/bin/env bash
# Scenario: SSH brute-force from a noisy source IP. Emits multiple failed-login events and (optionally) auto-blocks.

set -euo pipefail

OFFSEC_API_URL="${OFFSEC_API_URL:-http://localhost:9115}"
OFFSEC_JWT_HS256_SECRET="${OFFSEC_JWT_HS256_SECRET:-dev-secret}"
GUARDIAN_ID="${OFFSEC_GUARDIAN_ID:-${GUARDIAN_ID:-guardian-demo}}"
GUARDIAN_TAGS="${GUARDIAN_TAGS:-bastion,lab}"
GUARDIAN_CAP_AUD="${GUARDIAN_CAP_AUD:-offsec-portal}"

ATTEMPTS=6
SOURCE_IP="203.0.113.10"
USERNAME="root"
DELAY="0.4"
AUTO_BLOCK=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --attempts) ATTEMPTS="${2:-6}"; shift 2 ;;
    --ip) SOURCE_IP="${2:-$SOURCE_IP}"; shift 2 ;;
    --username) USERNAME="${2:-$USERNAME}"; shift 2 ;;
    --delay) DELAY="${2:-$DELAY}"; shift 2 ;;
    --auto-block) AUTO_BLOCK=1; shift ;;
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
    "actions": ["ingest", "offsec.action.block_ip", "offsec.action.alert_human", "offsec.action.quarantine"],
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

echo "[ssh_bruteforce] API: $OFFSEC_API_URL, guardian_id: $GUARDIAN_ID, source_ip: $SOURCE_IP, attempts: $ATTEMPTS"

for i in $(seq 1 "$ATTEMPTS"); do
  EVENT_ID="ssh-bruteforce-$SOURCE_IP-$i-$(date +%s)"
  TS="$(date -Iseconds)"
  LOG_LINE="sshd[$((4000+i))]: Failed password for $USERNAME from $SOURCE_IP port $((1024+i))"
  PAYLOAD=$(cat <<EOF
{
  "id": "$EVENT_ID",
  "timestamp": "$TS",
  "severity": "high",
  "event_type": "guardian.bruteforce",
  "source": "sshd",
  "source_host": "$SOURCE_HOST",
  "guardian_id": "$GUARDIAN_ID",
  "guardian_tags": $TAGS_JSON,
  "description": "Repeated SSH password failures from $SOURCE_IP",
  "affected": ["$SOURCE_IP"],
  "metadata": {
    "attempt": $i,
    "total_attempts": $ATTEMPTS,
    "username": "$USERNAME",
    "log": "$LOG_LINE"
  }
}
EOF
)

  curl -s -o /dev/null -w "%{http_code}" -X POST "$OFFSEC_API_URL/offsec/ingest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" | { read -r code; echo "  -> event $i/$ATTEMPTS (http $code)"; }
  sleep "$DELAY"
done

if [ "$AUTO_BLOCK" -eq 1 ]; then
  ACTION_ID="block-$SOURCE_IP-$(date +%s)"
  echo "[ssh_bruteforce] Auto-blocking $SOURCE_IP via ActionPanel API (action_id=$ACTION_ID)"
  curl -s -o /dev/null -w "%{http_code}" -X POST "$OFFSEC_API_URL/offsec/action/apply" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"action_id\": \"$ACTION_ID\",
      \"action_type\": \"offsec.action.block_ip\",
      \"guardian_id\": \"$GUARDIAN_ID\",
      \"target\": {\"ip\": \"$SOURCE_IP\"},
      \"reason\": \"Auto-block after SSH brute-force simulation\",
      \"requested_by\": \"incident-pack\",
      \"ts\": \"$(date -Iseconds)\"
    }" | { read -r code; echo "  -> action request (http $code)"; }
fi

echo "[ssh_bruteforce] Done. Check ThreatStream + ProofLedger for guardian_id=$GUARDIAN_ID."
