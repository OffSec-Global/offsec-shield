#!/bin/bash
# generate-mesh-keys.sh — Generate Ed25519 keypairs for mesh federation
# Usage: ./generate-mesh-keys.sh <node-name> [key-dir]
# Example: ./generate-mesh-keys.sh shield-gamma

set -euo pipefail

NODE_NAME="${1:-}"
if [[ -z "$NODE_NAME" ]]; then
    echo "Usage: $0 <node-name> [key-dir]"
    echo "Example: $0 shield-gamma"
    exit 1
fi

KEY_DIR="${2:-./config/mesh-keys}"
mkdir -p "$KEY_DIR"

PRIV_KEY="$KEY_DIR/${NODE_NAME}.key"
PUB_KEY="$KEY_DIR/${NODE_NAME}.pub"

if [[ -f "$PRIV_KEY" ]]; then
    echo "Key already exists: $PRIV_KEY"
    echo "Remove it first if you want to regenerate."
    exit 1
fi

echo "Generating Ed25519 keypair for: $NODE_NAME"

NODE_NAME="$NODE_NAME" KEY_DIR="$KEY_DIR" python3 << 'KEYGEN'
import sys
import os
import base64

try:
    from nacl.signing import SigningKey
except ImportError:
    print("ERROR: PyNaCl not installed. Run: pip install pynacl")
    sys.exit(1)

node_name = os.environ.get("NODE_NAME")
key_dir = os.environ.get("KEY_DIR")

# Generate keypair
sk = SigningKey.generate()
vk = sk.verify_key

# Raw 32-byte keys
sk_bytes = bytes(sk)
vk_bytes = bytes(vk)

# Base64 for config files
vk_b64 = base64.b64encode(vk_bytes).decode('ascii')

# Write private key (raw 32 bytes)
priv_path = f"{key_dir}/{node_name}.key"
with open(priv_path, 'wb') as f:
    f.write(sk_bytes)
os.chmod(priv_path, 0o600)

# Write public key (base64 for easy copy-paste)
pub_path = f"{key_dir}/{node_name}.pub"
with open(pub_path, 'w') as f:
    f.write(vk_b64)
os.chmod(pub_path, 0o644)

print(f"Private key: {priv_path} (32 bytes, chmod 600)")
print(f"Public key:  {pub_path}")
print(f"")
print(f"Public key (base64) for peer config:")
print(f"  {vk_b64}")
KEYGEN

echo ""
echo "Add this node as a peer on other nodes:"
echo ""
echo '  {'
echo "    \"id\": \"$NODE_NAME\","
echo '    "url": "http://<this-node-ip>:9115",'
echo "    \"pubkey\": \"$(cat "$PUB_KEY")\""
echo '  }'
