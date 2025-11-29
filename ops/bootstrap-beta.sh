#!/bin/bash
# bootstrap-beta.sh — Setup BETA as cold-storage / offline node
#
# BETA is an OFFLINE-CAPABLE node for:
#   - Cold storage of mesh archives
#   - Backup of signing keys (encrypted)
#   - Forensics and offline verification
#   - Blast zone testing
#   - Emergency dark-runner
#
# This script prepares BETA for intermittent operation.
# It does NOT set up DNS or mesh coordination.
#
# Usage: ./bootstrap-beta.sh

set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  BETA Cold Storage Node Bootstrap"
echo "  Role: Offline Archive / Backup / Forensics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  BETA is a COLD node. It should NOT:"
echo "    - Run DNS"
echo "    - Act as mesh coordinator"
echo "    - Host persistent services"
echo ""

# === Configuration ===
NODE_ID="shield-beta"
BETA_HOME="${BETA_HOME:-$HOME}"
CONFIG_DIR="$BETA_HOME/offsec-config"
DATA_DIR="$BETA_HOME/offsec-data"
ARCHIVE_DIR="$BETA_HOME/mesh-archives"
KEYS_DIR="$CONFIG_DIR/mesh-keys"

# === Step 1: Create directory structure ===
echo "[1/6] Creating directory structure..."
mkdir -p "$CONFIG_DIR"
mkdir -p "$KEYS_DIR"
mkdir -p "$DATA_DIR/receipts/offsec"
mkdir -p "$DATA_DIR/proofs"
mkdir -p "$DATA_DIR/mesh/roots"
mkdir -p "$DATA_DIR/mesh/proofs"
mkdir -p "$ARCHIVE_DIR/receipts"
mkdir -p "$ARCHIVE_DIR/proofs"
mkdir -p "$ARCHIVE_DIR/keys"
mkdir -p "$ARCHIVE_DIR/snapshots"

# === Step 2: Install dependencies ===
echo "[2/6] Checking dependencies..."
MISSING=""
command -v python3 &>/dev/null || MISSING="$MISSING python3"
command -v rsync &>/dev/null || MISSING="$MISSING rsync"
command -v gpg &>/dev/null || MISSING="$MISSING gpg"
command -v jq &>/dev/null || MISSING="$MISSING jq"

if [[ -n "$MISSING" ]]; then
    echo "Installing missing packages:$MISSING"
    if command -v apt-get &>/dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y $MISSING
    elif command -v pacman &>/dev/null; then
        sudo pacman -S --noconfirm $MISSING
    fi
fi

pip3 install --quiet pynacl httpx 2>/dev/null || true

# === Step 3: Generate node keys ===
echo "[3/6] Generating mesh keys for $NODE_ID..."
if [[ ! -f "$KEYS_DIR/$NODE_ID.key" ]]; then
    python3 << KEYGEN
import os
import base64
from nacl.signing import SigningKey

node_id = "$NODE_ID"
key_dir = "$KEYS_DIR"

sk = SigningKey.generate()
vk = sk.verify_key

# Write private key (raw 32 bytes)
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
    echo "Keys already exist at $KEYS_DIR/$NODE_ID.key"
fi

# === Step 4: Create environment file ===
echo "[4/6] Creating environment configuration..."
cat > "$CONFIG_DIR/beta.env" << ENV
# BETA Cold Storage Node Configuration
# Generated: $(date -Iseconds)
#
# Source this file when bringing BETA online:
#   source $CONFIG_DIR/beta.env

# === Node Identity ===
export OFFSEC_MESH_NODE_ID="$NODE_ID"
export OFFSEC_MESH_PRIVKEY_FILE="$KEYS_DIR/$NODE_ID.key"

# === Network (when online) ===
export OFFSEC_LISTEN="0.0.0.0:9115"
export OFFSEC_DATA_DIR="$DATA_DIR"
export OFFSEC_API_URL="http://localhost:9115"

# === Mesh Settings ===
export OFFSEC_MESH_INTERVAL_SECONDS=120  # Slower sync for cold node
export OFFSEC_MESH_RECEIPTS_LIMIT=50     # Pull more when online

# === Peers (pull from GAMMA and BUNKER only) ===
# Update these with actual public keys!
export OFFSEC_MESH_PEERS='[
  {"id":"shield-gamma","url":"http://192.168.0.191:9115","pubkey":"GAMMA_PUBKEY_HERE"},
  {"id":"shield-bunker","url":"http://134.122.64.228:9115","pubkey":"BUNKER_PUBKEY_HERE"}
]'

# === Archive Paths ===
export ARCHIVE_DIR="$ARCHIVE_DIR"
export ARCHIVE_RECEIPTS="$ARCHIVE_DIR/receipts"
export ARCHIVE_PROOFS="$ARCHIVE_DIR/proofs"
export ARCHIVE_KEYS="$ARCHIVE_DIR/keys"
export ARCHIVE_SNAPSHOTS="$ARCHIVE_DIR/snapshots"
ENV

# === Step 5: Create operational scripts ===
echo "[5/6] Creating operational scripts..."

# --- Archive sync script ---
cat > "$CONFIG_DIR/sync-archives.sh" << 'SYNC_SCRIPT'
#!/bin/bash
# sync-archives.sh — Pull archives from mesh when BETA is online
set -euo pipefail

source "$(dirname "$0")/beta.env"

echo "Syncing archives from mesh..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Sync receipts from GAMMA
echo "Pulling receipts from GAMMA..."
rsync -avz --progress \
    sovereign@192.168.0.191:~/offsec-shield/apps/portal-ext/data-offsec/receipts/ \
    "$ARCHIVE_RECEIPTS/gamma-$TIMESTAMP/"

# Sync receipts from BUNKER
echo "Pulling receipts from BUNKER..."
rsync -avz --progress \
    sovereign@134.122.64.228:~/offsec-data/receipts/ \
    "$ARCHIVE_RECEIPTS/bunker-$TIMESTAMP/"

# Sync proofs
echo "Pulling proofs..."
rsync -avz --progress \
    sovereign@192.168.0.191:~/offsec-shield/apps/portal-ext/data-offsec/proofs/ \
    "$ARCHIVE_PROOFS/gamma-$TIMESTAMP/"

# Snapshot mesh-peers registry
echo "Snapshotting mesh configuration..."
scp sovereign@192.168.0.191:~/offsec-shield/config/mesh-peers-full.env \
    "$ARCHIVE_SNAPSHOTS/mesh-peers-$TIMESTAMP.env"

echo "Archive sync complete: $TIMESTAMP"
ls -la "$ARCHIVE_DIR"
SYNC_SCRIPT
chmod +x "$CONFIG_DIR/sync-archives.sh"

# --- Offline verify script ---
cat > "$CONFIG_DIR/verify-offline.sh" << 'VERIFY_SCRIPT'
#!/bin/bash
# verify-offline.sh — Verify receipts and proofs offline
set -euo pipefail

source "$(dirname "$0")/beta.env"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <proof-file.json>"
    echo "       $0 --all (verify all archived proofs)"
    exit 1
fi

if [[ "$1" == "--all" ]]; then
    echo "Verifying all archived proofs..."
    find "$ARCHIVE_PROOFS" -name "*.json" -type f | while read proof; do
        echo -n "Verifying $proof... "
        if ~/offsec-shield/apps/proof-verify/target/release/offsec-proof-verify "$proof" 2>/dev/null; then
            echo "✓"
        else
            echo "✗ FAILED"
        fi
    done
else
    echo "Verifying: $1"
    ~/offsec-shield/apps/proof-verify/target/release/offsec-proof-verify "$1"
fi
VERIFY_SCRIPT
chmod +x "$CONFIG_DIR/verify-offline.sh"

# --- Startup script ---
cat > "$CONFIG_DIR/start-beta.sh" << 'START_SCRIPT'
#!/bin/bash
# start-beta.sh — Bring BETA online and join mesh temporarily
set -euo pipefail

source "$(dirname "$0")/beta.env"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Starting BETA (Cold Storage Node)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Node ID: $OFFSEC_MESH_NODE_ID"
echo "Data:    $OFFSEC_DATA_DIR"
echo "Listen:  $OFFSEC_LISTEN"
echo ""

# Check network
if ! ping -c 1 192.168.0.191 &>/dev/null; then
    echo "⚠️  Cannot reach GAMMA (192.168.0.191)"
    echo "   Running in OFFLINE mode."
    exit 0
fi

echo "Starting Portal-Ext..."
cd ~/offsec-shield/apps/portal-ext
cargo run &
PORTAL_PID=$!

sleep 3

echo "Starting Mesh-Daemon..."
cd ~/offsec-shield/apps/mesh-daemon
python3 -m mesh_daemon.main &
DAEMON_PID=$!

echo ""
echo "BETA is now ONLINE and connected to mesh."
echo "Portal-Ext PID: $PORTAL_PID"
echo "Mesh-Daemon PID: $DAEMON_PID"
echo ""
echo "To sync archives: ./sync-archives.sh"
echo "To verify proofs: ./verify-offline.sh <file>"
echo "To shutdown: kill $PORTAL_PID $DAEMON_PID"
START_SCRIPT
chmod +x "$CONFIG_DIR/start-beta.sh"

# --- Shutdown script ---
cat > "$CONFIG_DIR/shutdown-beta.sh" << 'SHUTDOWN_SCRIPT'
#!/bin/bash
# shutdown-beta.sh — Gracefully shutdown BETA
set -euo pipefail

echo "Shutting down BETA services..."

pkill -f "portal-ext" 2>/dev/null || true
pkill -f "mesh_daemon" 2>/dev/null || true

sleep 2

echo "Compressing today's archives..."
ARCHIVE_DIR="${ARCHIVE_DIR:-$HOME/mesh-archives}"
TODAY=$(date +%Y%m%d)

if [[ -d "$ARCHIVE_DIR/receipts" ]]; then
    tar -czf "$ARCHIVE_DIR/receipts-$TODAY.tar.gz" -C "$ARCHIVE_DIR" receipts/ 2>/dev/null || true
fi

echo "BETA shutdown complete."
echo "Safe to power off."
SHUTDOWN_SCRIPT
chmod +x "$CONFIG_DIR/shutdown-beta.sh"

# === Step 6: Create key backup script ===
cat > "$CONFIG_DIR/backup-keys.sh" << 'BACKUP_SCRIPT'
#!/bin/bash
# backup-keys.sh — Encrypted backup of mesh signing keys
# Uses GPG symmetric encryption
set -euo pipefail

source "$(dirname "$0")/beta.env"

echo "Creating encrypted key backup..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$ARCHIVE_KEYS/mesh-keys-$TIMESTAMP.tar.gz.gpg"

# Collect keys
TEMP_DIR=$(mktemp -d)
cp -r "$HOME/offsec-config/mesh-keys" "$TEMP_DIR/"

# Create encrypted tarball
tar -czf - -C "$TEMP_DIR" mesh-keys | \
    gpg --symmetric --cipher-algo AES256 --output "$BACKUP_FILE"

rm -rf "$TEMP_DIR"

echo "Encrypted backup created: $BACKUP_FILE"
echo ""
echo "To restore:"
echo "  gpg -d $BACKUP_FILE | tar -xzf -"
BACKUP_SCRIPT
chmod +x "$CONFIG_DIR/backup-keys.sh"

# === Done ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  BETA Bootstrap Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Node ID:     $NODE_ID"
echo "Public Key:  $(cat "$KEYS_DIR/$NODE_ID.pub")"
echo "Config:      $CONFIG_DIR"
echo "Data:        $DATA_DIR"
echo "Archives:    $ARCHIVE_DIR"
echo ""
echo "Scripts created:"
echo "  $CONFIG_DIR/start-beta.sh      — Bring BETA online"
echo "  $CONFIG_DIR/shutdown-beta.sh   — Graceful shutdown"
echo "  $CONFIG_DIR/sync-archives.sh   — Pull archives from mesh"
echo "  $CONFIG_DIR/verify-offline.sh  — Offline proof verification"
echo "  $CONFIG_DIR/backup-keys.sh     — Encrypted key backup"
echo ""
echo "To bring BETA online:"
echo "  source $CONFIG_DIR/beta.env"
echo "  $CONFIG_DIR/start-beta.sh"
echo ""
echo "To use offline (no network):"
echo "  source $CONFIG_DIR/beta.env"
echo "  $CONFIG_DIR/verify-offline.sh --all"
echo ""
echo "Add BETA to GAMMA's peer list:"
echo '  {"id":"shield-beta","url":"http://192.168.0.189:9115","pubkey":"'"$(cat "$KEYS_DIR/$NODE_ID.pub")"'","role":"cold-storage","status":"cold"}'
