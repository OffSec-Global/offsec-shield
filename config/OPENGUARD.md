# OpenGuard Configuration

OpenGuard is the standardized configuration format for OffSec Shield Guardian threat detection and response system.

## Quick Start

**Using TOML (recommended):**
```bash
cp config/openguard.toml config/guardian.toml
export GUARDIAN_CONFIG=config/guardian.toml
poetry run guardian run
```

**Using YAML:**
```bash
cp config/openguard.yaml config/guardian.yaml
export GUARDIAN_CONFIG=config/guardian.yaml
poetry run guardian run
```

## Configuration Files

- `openguard.toml` - TOML format (recommended, matches existing dev.toml structure)
- `openguard.yaml` - YAML format (alternative, more readable for complex configs)

## Environment Variables

OpenGuard supports environment variable substitution using `${VAR_NAME:-default}` syntax:

### Required
- `OFFSEC_GUARDIAN_ID` - Unique guardian identifier
- `OFFSEC_PORTAL_URL` - Portal-Ext API endpoint
- `GUARDIAN_JWT_HS256_SECRET` - Shared secret with Portal-Ext

### Optional
- `OFFSEC_CAPABILITY_B64` - Base64-encoded capability token
- `GUARDIAN_JWT_PRIVATE_KEY_PATH` - Ed25519 private key path
- `OFFSEC_ACTION_SERVER_PORT` - Action server port (default: 9120)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `DEPLOY_ENV` - Environment tag (dev/staging/prod)
- `OPERATOR_IP` - Operator IP for whitelist

## Configuration Sections

### 1. Guardian Core

```toml
[guardian]
id = "guardian-prod-01"
tags = ["prod", "datacenter-us-east"]
api_url = "http://localhost:9115"
```

Controls guardian identity and Portal-Ext connection.

### 2. Log Sources

```toml
[log_sources.ssh]
enabled = true
paths = ["/var/log/auth.log"]
watch_mode = "tail"
```

Supported sources:
- **ssh** - SSH authentication logs
- **nginx** - Web server access/error logs
- **firewall** - UFW/iptables logs
- **portal** - VaultMesh Portal API
- **syslog** - Syslog receiver

### 3. Detectors

```toml
[detectors]
enabled = ["brute_force", "scanner", "anomaly_simple"]

[detectors.brute_force]
threshold_attempts = 5
window_secs = 300
```

Available detectors:
- **brute_force** - Failed login attempts
- **scanner** - Port scans / vulnerability scanners
- **anomaly_simple** - Statistical anomalies
- **rate_limit** - Request rate violations
- **geo_anomaly** - Geolocation-based threats (requires GeoIP)

### 4. Actions

```toml
[actions]
allowed = ["block_ip", "alert_human"]

[actions.block_ip]
method = "iptables"
default_duration_secs = 3600
whitelist = ["127.0.0.1"]
```

Available actions:
- **block_ip** - Firewall-based IP blocking
- **alert_human** - Send alerts via webhook/email/Slack
- **quarantine** - Network quarantine (stub)
- **rate_limit** - Apply rate limiting
- **log_only** - Log without taking action

### 5. Action Server

```toml
[action_server]
enabled = true
listen = "0.0.0.0:9120"

[action_server.auth]
require_capability = true
```

HTTP server for receiving action execution requests from Portal-Ext.

### 6. Observability

```toml
[observability.metrics]
enabled = true
prometheus_port = 9121

[observability.logging]
format = "json"
level = "info"
```

Prometheus metrics and structured logging.

### 7. Ledger Integration

```toml
[ledger]
enabled = true
emit_receipts = true
proof_generation = true
```

Integration with Civilization Ledger for cryptographic proofs.

### 8. Mesh Federation

```toml
[mesh]
enabled = false
node_id = "guardian-alpha"
peers = "https://beta.mesh.local,https://gamma.mesh.local"
```

Peer-to-peer proof sharing and threat intelligence (experimental).

## Migration from dev.toml

```bash
# Backup existing config
cp config/dev.toml config/dev.toml.bak

# Copy OpenGuard template
cp config/openguard.toml config/dev.toml

# Update environment-specific values
nano config/dev.toml
```

**Key changes:**
- New `[metadata]` section for version tracking
- Split `[guardian.auth]` from `[guardian]`
- Added `[guardian.performance]` tuning
- Expanded detector configurations
- New `[actions.global]` settings
- Added `[rate_limits]` section
- New `[features]` flags

## Production Checklist

- [ ] Set unique `guardian.id` per instance
- [ ] Configure proper `guardian.auth.jwt_hs256_secret`
- [ ] Enable only required detectors
- [ ] Set `actions.global.require_approval = true`
- [ ] Configure IP whitelist in `actions.block_ip.whitelist`
- [ ] Enable metrics (`observability.metrics.enabled = true`)
- [ ] Set appropriate `rate_limits`
- [ ] Disable `debug.*` flags
- [ ] Configure alert channels in `actions.alert_human`
- [ ] Set proper log retention (`storage.retention_days`)

## Validation

```bash
# Test config loading
poetry run python -c "
from guardian.config import config
print(f'Guardian ID: {config.get(\"guardian.id\")}')
print(f'Enabled detectors: {config.get(\"detectors.enabled\")}')
"

# Dry run
poetry run guardian run --dry-run
```

## Examples

### Minimal Dev Config

```toml
[guardian]
id = "guardian-dev"
api_url = "http://localhost:9115"

[guardian.auth]
jwt_hs256_secret = "dev-secret"

[detectors]
enabled = ["brute_force"]

[actions]
allowed = ["log_only"]
```

### Production High-Security

```toml
[guardian]
id = "guardian-prod-01"
tags = ["prod", "high-security"]
api_url = "https://portal.mesh.local"

[guardian.auth]
jwt_hs256_secret = "${GUARDIAN_JWT_SECRET}"
jwt_private_key_path = "/etc/guardian/guardian.ed25519"

[detectors]
enabled = ["brute_force", "scanner", "rate_limit", "geo_anomaly"]

[detectors.brute_force]
threshold_attempts = 3
window_secs = 180

[detectors.geo_anomaly]
enabled = true
blocked_countries = ["CN", "RU", "KP", "IR"]

[actions]
allowed = ["block_ip", "alert_human"]

[actions.global]
require_approval = false  # Auto-remediation

[actions.block_ip]
method = "iptables"
default_duration_secs = 86400
whitelist = ["${OPERATOR_IP}"]

[observability.metrics]
enabled = true
prometheus_port = 9121
```

## Troubleshooting

**Config not loading:**
```bash
export GUARDIAN_CONFIG=/absolute/path/to/config.toml
```

**Environment variables not expanding:**
- Ensure variables are exported before running guardian
- Use `${VAR:-default}` syntax for defaults

**Action server won't start:**
- Check port availability: `lsof -i :9120`
- Verify `action_server.enabled = true`

## Schema Reference

See `config/openguard-schema.json` (TODO) for JSON Schema validation.

## Further Reading

- [AGENT.md](../AGENT.md) - Operational handbook
- [docs/OPERATOR_HANDBOOK.md](../docs/OPERATOR_HANDBOOK.md) - Runbook
- [Guardian README](../apps/guardian/README.md) - Guardian architecture
