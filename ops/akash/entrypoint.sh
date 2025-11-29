#!/bin/bash
# entrypoint.sh — Akash runner node startup
# Starts Portal-Ext and Mesh-Daemon concurrently

set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OffSec Shield - Akash Runner Node"
echo "  Node ID: ${OFFSEC_MESH_NODE_ID:-unknown}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Validate required env vars
if [[ -z "${OFFSEC_JWT_HS256_SECRET:-}" ]]; then
    echo "ERROR: OFFSEC_JWT_HS256_SECRET must be set"
    exit 1
fi

# Create data directories
mkdir -p "${OFFSEC_DATA_DIR}/receipts/offsec"
mkdir -p "${OFFSEC_DATA_DIR}/proofs"
mkdir -p "${OFFSEC_DATA_DIR}/mesh/roots"
mkdir -p "${OFFSEC_DATA_DIR}/mesh/proofs"

# Generate node keys if not provided
KEY_FILE="${OFFSEC_DATA_DIR}/node.key"
if [[ ! -f "$KEY_FILE" ]]; then
    echo "Generating node keys..."
    python3 << 'KEYGEN'
import os
import base64
from nacl.signing import SigningKey

key_file = os.environ.get("KEY_FILE", "/data/node.key")
sk = SigningKey.generate()
vk = sk.verify_key

with open(key_file, 'wb') as f:
    f.write(bytes(sk))
os.chmod(key_file, 0o600)

with open(key_file + ".pub", 'w') as f:
    f.write(base64.b64encode(bytes(vk)).decode('ascii'))

print(f"Public key: {base64.b64encode(bytes(vk)).decode('ascii')}")
KEYGEN
fi

export OFFSEC_MESH_PRIVKEY_FILE="$KEY_FILE"

echo "Starting Portal-Ext on ${OFFSEC_LISTEN}..."
/app/portal-ext &
PORTAL_PID=$!

# Wait for Portal-Ext to start
sleep 3

echo "Starting Mesh-Daemon..."
cd /app/mesh-daemon
python3 -m mesh_daemon.main &
DAEMON_PID=$!

# Handle shutdown
trap 'kill $PORTAL_PID $DAEMON_PID 2>/dev/null; exit 0' SIGTERM SIGINT

echo "All services started. Waiting..."
wait $PORTAL_PID $DAEMON_PID
