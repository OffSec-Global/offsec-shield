#!/bin/bash
# configure-mesh-peers.sh — Generate mesh peer configuration for gamma
# Creates the environment file with all mesh peers
#
# Usage: ./configure-mesh-peers.sh

set -euo pipefail

CONFIG_DIR="${CONFIG_DIR:-/home/sovereign/offsec-shield/config}"
MESH_ENV="${CONFIG_DIR}/mesh-peers.env"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OffSec Shield - Mesh Peer Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p "$CONFIG_DIR/mesh-keys"

# === Generate gamma keys if not exist ===
GAMMA_KEY="$CONFIG_DIR/mesh-keys/shield-gamma.key"
if [[ ! -f "$GAMMA_KEY" ]]; then
    echo "Generating keys for shield-gamma..."
    cd /home/sovereign/offsec-shield
    ./ops/generate-mesh-keys.sh shield-gamma "$CONFIG_DIR/mesh-keys"
fi

GAMMA_PUBKEY=$(cat "$CONFIG_DIR/mesh-keys/shield-gamma.pub")
echo "Gamma public key: $GAMMA_PUBKEY"
echo ""

# === Collect peer information ===
echo "Enter peer information (leave blank to finish):"
echo ""

PEERS="["
FIRST=true

while true; do
    read -p "Peer ID (e.g., shield-bunker): " PEER_ID
    [[ -z "$PEER_ID" ]] && break

    read -p "Peer URL (e.g., http://134.122.64.228:9115): " PEER_URL
    read -p "Peer public key (base64): " PEER_PUBKEY

    if [[ "$FIRST" == "true" ]]; then
        FIRST=false
    else
        PEERS+=","
    fi

    PEERS+="{\"id\":\"$PEER_ID\",\"url\":\"$PEER_URL\",\"pubkey\":\"$PEER_PUBKEY\"}"
    echo "Added: $PEER_ID"
    echo ""
done

PEERS+="]"

# === Write configuration ===
cat > "$MESH_ENV" << ENV
# OffSec Shield - Mesh Configuration for Gamma
# Generated: $(date -Iseconds)
#
# Source this file before starting Portal-Ext and Mesh-Daemon:
#   source $MESH_ENV

# === Gamma Node Identity ===
export OFFSEC_MESH_NODE_ID="shield-gamma"
export OFFSEC_MESH_PRIVKEY_FILE="$GAMMA_KEY"

# === Portal-Ext Settings ===
export OFFSEC_LISTEN="0.0.0.0:9115"
export OFFSEC_DATA_DIR="/home/sovereign/offsec-shield/apps/portal-ext/data-offsec"
export OFFSEC_API_URL="http://localhost:9115"

# === Mesh Peers ===
export OFFSEC_MESH_PEERS='$PEERS'

# === Mesh Daemon Settings ===
export OFFSEC_MESH_INTERVAL_SECONDS=60
export OFFSEC_MESH_RECEIPTS_LIMIT=20
ENV

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Configuration saved to: $MESH_ENV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To activate:"
echo "  source $MESH_ENV"
echo ""
echo "Share this with peers so they can add gamma:"
echo '  {'
echo "    \"id\": \"shield-gamma\","
echo '    "url": "http://<gamma-external-ip>:9115",'
echo "    \"pubkey\": \"$GAMMA_PUBKEY\""
echo '  }'
