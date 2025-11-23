#!/usr/bin/env bash
set -euo pipefail

API=${API:-http://localhost:9115}
PEER=$1
RECEIPT_ID=$2
OUT="/tmp/offsec-mesh-proof-${PEER}-${RECEIPT_ID}.json"

echo "[mesh-verify] fetching bundle from ${API}/offsec/mesh/proof/${PEER}/${RECEIPT_ID}"
curl -sf "${API}/offsec/mesh/proof/${PEER}/${RECEIPT_ID}" -o "$OUT" || { echo "fetch failed"; exit 2; }

if ! command -v offsec-proof-verify >/dev/null 2>&1; then
  echo "offsec-proof-verify not found on PATH. Build it in apps/proof-verify (cargo build --release)."
  echo "Bundle saved to: $OUT"
  exit 0
fi

echo "[mesh-verify] running offsec-proof-verify $OUT"
offsec-proof-verify "$OUT"
