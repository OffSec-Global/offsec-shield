#!/usr/bin/env bash
# Wrapper to run named incident simulations (attack stories) against a running OffSec Shield stack.
# Usage: demo/run_incident.sh ssh_bruteforce [--auto-block] [--ip 203.0.113.10]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INCIDENT_DIR="$ROOT_DIR/demo/incidents"

if [ $# -lt 1 ]; then
  echo "usage: $0 <scenario> [args]" >&2
  echo "available scenarios:" >&2
  find "$INCIDENT_DIR" -maxdepth 1 -type f -name "*.sh" -not -name "run_incident.sh" -exec basename {} .sh \; | sort >&2
  exit 1
fi

SCENARIO="$1"
shift || true
SCRIPT="$INCIDENT_DIR/${SCENARIO}.sh"

if [ ! -x "$SCRIPT" ]; then
  echo "unknown scenario: $SCENARIO" >&2
  exit 1
fi

OFFSEC_API_URL="${OFFSEC_API_URL:-http://localhost:9115}"
export OFFSEC_API_URL

if ! curl -sf "$OFFSEC_API_URL/healthz" >/dev/null 2>&1; then
  echo "[warn] portal-ext not reachable at $OFFSEC_API_URL/healthz; did you run demo/run_demo.sh or make dev?" >&2
fi

exec "$SCRIPT" "$@"
