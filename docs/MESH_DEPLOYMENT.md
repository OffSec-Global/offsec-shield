# Mesh Federation Deployment Guide

## Architecture Overview

```
         GAMMA (sovereign home)
         192.168.0.191 / 100.80.246.127 (Tailscale)
        /            |            \
       /             |             \
  BUNKER-DE      AKASH-001      AKASH-002 ...
  134.122.64.228   (dynamic)      (dynamic)
  Main Receipts    Runner         Runner
       \             |             /
        \            |            /
         ←── MESH FEDERATION ───→
              (Ed25519 signed gossip)
```

## Node Roles

| Node | Role | Responsibilities |
|------|------|------------------|
| **shield-gamma** | Origin | Guardian, event generation, local receipts |
| **shield-bunker** | Primary Store | Main receipt storage, proof anchoring |
| **shield-akash-**** | Runners | Distributed detection, federated receipts |

## Quick Start

### 1. Generate Keys on Gamma

```bash
cd ~/offsec-shield
./ops/generate-mesh-keys.sh shield-gamma config/mesh-keys
```

### 2. Bootstrap Bunker-DE

```bash
# SSH to bunker-de
ssh 134.122.64.228

# Run bootstrap
curl -fsSL https://raw.githubusercontent.com/.../bootstrap-bunker.sh | bash

# Or copy and run manually:
scp ops/bootstrap-bunker.sh sovereign@134.122.64.228:~
ssh 134.122.64.228 ./bootstrap-bunker.sh
```

### 3. Exchange Public Keys

**From bunker-de**, get the public key:
```bash
cat ~/offsec-config/mesh-keys/shield-bunker.pub
# e.g.: abc123...base64...xyz789
```

**On gamma**, add bunker as peer:
```bash
./ops/configure-mesh-peers.sh
# Enter: shield-bunker, http://134.122.64.228:9115, <pubkey>
```

**On bunker-de**, add gamma as peer:
```bash
# Edit ~/offsec-config/bunker.env
OFFSEC_MESH_PEERS='[{"id":"shield-gamma","url":"http://100.80.246.127:9115","pubkey":"<gamma-pubkey>"}]'
```

### 4. Deploy Akash Runners

```bash
cd ~/offsec-shield/ops/akash

# Build and push container
docker build -t ghcr.io/vaultmesh/offsec-shield:latest -f Dockerfile ../..
docker push ghcr.io/vaultmesh/offsec-shield:latest

# Deploy to Akash
akash tx deployment create deploy.yaml --from wallet
```

## Environment Variables

### Portal-Ext (Rust)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OFFSEC_JWT_HS256_SECRET` | **YES** | - | JWT signing secret |
| `OFFSEC_LISTEN` | No | `0.0.0.0:9115` | Listen address |
| `OFFSEC_DATA_DIR` | No | `./data-offsec` | Data directory |
| `OFFSEC_MESH_NODE_ID` | For mesh | - | Node identity |
| `OFFSEC_MESH_PRIVKEY_FILE` | For mesh | - | Ed25519 private key |
| `OFFSEC_MESH_PEERS` | For mesh | `[]` | JSON array of peers |

### Mesh-Daemon (Python)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OFFSEC_API_URL` | No | `http://localhost:9115` | Local Portal-Ext |
| `OFFSEC_MESH_INTERVAL_SECONDS` | No | `60` | Announce interval |
| `OFFSEC_MESH_RECEIPTS_LIMIT` | No | `10` | Receipts per sync |

## Peer Configuration Format

```json
{
  "id": "shield-bunker",
  "url": "http://134.122.64.228:9115",
  "pubkey": "base64-encoded-ed25519-public-key"
}
```

## Verification

### Check Mesh Connectivity

```bash
# On gamma, after starting mesh-daemon
curl http://localhost:9115/offsec/receipts | jq '.[0]'

# Check if bunker received the root
ssh 134.122.64.228 'ls ~/offsec-data/mesh/roots/shield-gamma/'
```

### Verify Proof Bundle

```bash
# Fetch proof from peer
curl http://134.122.64.228:9115/offsec/mesh/proof/shield-gamma/offsec-abc123 -o proof.json

# Verify locally
./apps/proof-verify/target/release/offsec-proof-verify proof.json
```

## Troubleshooting

### Mesh messages rejected (403)

- Check peer is in `OFFSEC_MESH_PEERS`
- Verify public key matches
- Ensure node ID matches exactly

### Signature verification failed

- Keys must be raw 32-byte Ed25519
- Public key must be base64-encoded in peer config
- Check for trailing whitespace in key files

### Connection refused

- Firewall: allow port 9115
- Check `OFFSEC_LISTEN` binding
- Verify network connectivity between nodes

## File Structure

```
~/offsec-shield/
├── config/
│   └── mesh-keys/
│       ├── shield-gamma.key    # Private (chmod 600)
│       └── shield-gamma.pub    # Public (base64)
├── apps/
│   ├── portal-ext/
│   │   └── data-offsec/
│   │       ├── receipts/offsec/
│   │       ├── mesh/roots/<peer-id>/
│   │       └── mesh/proofs/<peer-id>/
│   └── mesh-daemon/
└── ops/
    ├── generate-mesh-keys.sh
    ├── configure-mesh-peers.sh
    ├── bootstrap-bunker.sh
    └── akash/
        ├── deploy.yaml
        ├── Dockerfile
        └── entrypoint.sh
```
