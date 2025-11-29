#!/usr/bin/env bash
set -euo pipefail
DIR="$HOME/.vaultmesh/keys"
mkdir -p "$DIR"
PRV="$DIR/node_ed25519"
PUB="$DIR/node_ed25519.pub"
OPENSSL_BIN="/opt/homebrew/opt/openssl@3/bin/openssl"
[ -x "$OPENSSL_BIN" ] || OPENSSL_BIN="$(command -v openssl)"
if [ -f "$PRV" ] && [ -f "$PUB" ]; then
  echo "Keys already exist: $PRV, $PUB"; exit 0
fi
"$OPENSSL_BIN" version || true
"$OPENSSL_BIN" genpkey -algorithm Ed25519 -out "$PRV"
chmod 600 "$PRV"
"$OPENSSL_BIN" pkey -in "$PRV" -pubout -out "$PUB"
chmod 644 "$PUB"
echo "Generated keys: $PRV (priv), $PUB (pub)"
