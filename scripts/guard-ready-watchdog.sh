#!/usr/bin/env bash
#
# Simple readiness watchdog that posts to an alert webhook when guardian readiness
# fails repeatedly. Intended for host/systemd usage.
#
set -euo pipefail

CHECK_URL="${CHECK_URL:-http://127.0.0.1:9120/healthz/ready}"
WEBHOOK="${OFFSEC_READY_WEBHOOK:-}"
THRESHOLD="${OFFSEC_READY_THRESHOLD:-3}"
SLEEP="${OFFSEC_READY_INTERVAL:-60}"

if [ -z "$WEBHOOK" ]; then
  echo "[watchdog] OFFSEC_READY_WEBHOOK not set, exiting."
  exit 0
fi

count=0
while true; do
  if curl -fsS "$CHECK_URL" >/dev/null 2>&1; then
    count=0
  else
    count=$((count + 1))
    echo "[watchdog] readiness failed ($count)"
    if [ "$count" -ge "$THRESHOLD" ]; then
      payload="{\"text\":\"OffSec Guardian readiness failing (${count} checks). Host: $(hostname)\"}"
      curl -s -X POST -H "Content-Type: application/json" -d "$payload" "$WEBHOOK" >/dev/null 2>&1 || true
      count=0
    fi
  fi
  sleep "$SLEEP"
done
