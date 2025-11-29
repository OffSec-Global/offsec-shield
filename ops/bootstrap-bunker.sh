#!/bin/bash
# bootstrap-bunker.sh — Deploy OffSec Shield on bunker-de (main receipts node)
# Run this ON the bunker-de server after SSH'ing in
#
# Prerequisites:
#   - Debian/Ubuntu with sudo access
#   - SSH key from gamma already in authorized_keys
#
# Usage: curl -fsSL https://raw.githubusercontent.com/.../ | bash
#        OR: scp this script to bunker-de and run it

set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OffSec Shield - Bunker Node Bootstrap"
echo "  Role: Main Receipts Node (Federation Primary)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# === Configuration ===
NODE_ID="shield-bunker"
OFFSEC_DIR="$HOME/offsec-shield"
DATA_DIR="$HOME/offsec-data"
CONFIG_DIR="$HOME/offsec-config"
LISTEN_PORT=9115

# === Step 1: Install dependencies ===
echo "[1/7] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    curl git build-essential pkg-config libssl-dev \
    python3 python3-pip python3-venv \
    jq

# === Step 2: Install Rust ===
if ! command -v cargo &> /dev/null; then
    echo "[2/7] Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "[2/7] Rust already installed"
fi

# === Step 3: Clone repositories ===
echo "[3/7] Cloning offsec-shield and engine..."
mkdir -p "$HOME/workspace"
cd "$HOME/workspace"

if [[ ! -d "$OFFSEC_DIR" ]]; then
    # Clone from gamma or GitHub (update URL as needed)
    echo "NOTE: Clone offsec-shield manually or rsync from gamma"
    echo "  rsync -avz gamma:~/offsec-shield/ $OFFSEC_DIR/"
    mkdir -p "$OFFSEC_DIR"
fi

if [[ ! -d "$HOME/engine" ]]; then
    echo "NOTE: Clone engine manually or rsync from gamma"
    echo "  rsync -avz gamma:~/engine/ $HOME/engine/"
    mkdir -p "$HOME/engine"
fi

# === Step 4: Setup directories ===
echo "[4/7] Creating data directories..."
mkdir -p "$DATA_DIR/receipts/offsec"
mkdir -p "$DATA_DIR/proofs"
mkdir -p "$DATA_DIR/mesh/roots"
mkdir -p "$DATA_DIR/mesh/proofs"
mkdir -p "$CONFIG_DIR/mesh-keys"

# === Step 5: Generate node keys ===
echo "[5/7] Generating mesh keys..."
if [[ ! -f "$CONFIG_DIR/mesh-keys/$NODE_ID.key" ]]; then
    pip3 install --quiet pynacl

    python3 << KEYGEN
import os
import base64
from nacl.signing import SigningKey

node_id = "$NODE_ID"
key_dir = "$CONFIG_DIR/mesh-keys"

sk = SigningKey.generate()
vk = sk.verify_key

# Write private key
with open(f"{key_dir}/{node_id}.key", 'wb') as f:
    f.write(bytes(sk))
os.chmod(f"{key_dir}/{node_id}.key", 0o600)

# Write public key (base64)
vk_b64 = base64.b64encode(bytes(vk)).decode('ascii')
with open(f"{key_dir}/{node_id}.pub", 'w') as f:
    f.write(vk_b64)

print(f"Generated keys for {node_id}")
print(f"Public key: {vk_b64}")
KEYGEN
else
    echo "Keys already exist"
fi

# === Step 6: Create environment file ===
echo "[6/7] Creating environment configuration..."
cat > "$CONFIG_DIR/bunker.env" << ENV
# OffSec Shield - Bunker Node Configuration
# Generated: $(date -Iseconds)

# Node Identity
OFFSEC_MESH_NODE_ID=$NODE_ID
OFFSEC_MESH_PRIVKEY_FILE=$CONFIG_DIR/mesh-keys/$NODE_ID.key

# Portal-Ext Settings
OFFSEC_LISTEN=0.0.0.0:$LISTEN_PORT
OFFSEC_DATA_DIR=$DATA_DIR
OFFSEC_CAP_AUD=offsec-portal

# JWT Secret (REPLACE WITH REAL SECRET!)
# Generate with: openssl rand -hex 32
OFFSEC_JWT_HS256_SECRET=REPLACE_ME_$(openssl rand -hex 16)

# Mesh Peers (add gamma and akash nodes here)
# Format: JSON array of {id, url, pubkey}
OFFSEC_MESH_PEERS='[]'

# Mesh Daemon Settings
OFFSEC_API_URL=http://localhost:$LISTEN_PORT
OFFSEC_MESH_INTERVAL_SECONDS=60
OFFSEC_MESH_RECEIPTS_LIMIT=20
ENV

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Bootstrap Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Node ID:     $NODE_ID"
echo "Public Key:  $(cat $CONFIG_DIR/mesh-keys/$NODE_ID.pub)"
echo "Listen:      0.0.0.0:$LISTEN_PORT"
echo "Data Dir:    $DATA_DIR"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit $CONFIG_DIR/bunker.env"
echo "   - Set OFFSEC_JWT_HS256_SECRET (openssl rand -hex 32)"
echo "   - Add mesh peers to OFFSEC_MESH_PEERS"
echo ""
echo "2. Sync code from gamma:"
echo "   rsync -avz gamma:~/offsec-shield/ $OFFSEC_DIR/"
echo "   rsync -avz gamma:~/engine/ $HOME/engine/"
echo ""
echo "3. Build and run:"
echo "   source $CONFIG_DIR/bunker.env"
echo "   cd $OFFSEC_DIR/apps/portal-ext"
echo "   cargo build --release"
echo "   ./target/release/portal-ext"
echo ""
echo "4. Add this node to gamma's peer config:"
echo '   {'
echo "     \"id\": \"$NODE_ID\","
echo "     \"url\": \"http://134.122.64.228:$LISTEN_PORT\","
echo "     \"pubkey\": \"$(cat $CONFIG_DIR/mesh-keys/$NODE_ID.pub)\""
echo '   }'
