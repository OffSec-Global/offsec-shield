# OpenGuard Configuration System

**Created:** 2025-11-29  
**Version:** 1.0.0  
**Status:** Production Ready

## What is OpenGuard?

OpenGuard is the standardized configuration format for OffSec Shield Guardian threat detection and response system. It provides a comprehensive, validated, and production-ready configuration schema.

## Files Created

### Configuration Templates

1. **`config/openguard.toml`** - Primary TOML configuration template
   - Complete reference implementation
   - Environment variable substitution
   - Inline documentation
   - Production-ready defaults

2. **`config/openguard.yaml`** - Alternative YAML format
   - Same schema as TOML version
   - Better for complex nested structures
   - Human-readable format

3. **`config/openguard-prod.toml`** - Production-hardened template
   - Security-first defaults
   - TLS enabled
   - Auto-remediation configured
   - Higher performance settings

### Documentation

4. **`config/OPENGUARD.md`** - Complete configuration guide
   - Quick start instructions
   - Section-by-section breakdown
   - Migration guide from dev.toml
   - Production checklist
   - Troubleshooting guide
   - Example configurations

### Tooling

5. **`scripts/validate-openguard.py`** - Configuration validator
   - Validates TOML and YAML configs
   - Checks required sections and fields
   - Security issue detection
   - Warnings for misconfigurations
   - Strict mode for CI/CD

## Key Features

### 1. Comprehensive Coverage

OpenGuard defines all Guardian subsystems:
- Core identity and connectivity
- Log source configuration
- Threat detectors with tuning parameters
- Response actions and policies
- Action server settings
- Observability and metrics
- Ledger integration
- Mesh federation (experimental)
- Storage and retention
- Rate limiting
- Feature flags

### 2. Environment Variable Support

All sensitive values and deployment-specific settings use `${VAR:-default}` syntax:

```toml
[guardian]
id = "${OFFSEC_GUARDIAN_ID:-guardian-default}"
api_url = "${OFFSEC_PORTAL_URL:-http://localhost:9115}"
```

### 3. Security by Default

- Weak secret detection
- IP whitelist enforcement
- TLS configuration validation
- Approval requirements for actions
- Rate limiting protections

### 4. Production Checklist

Built-in validation for:
- [ ] Unique guardian IDs
- [ ] Strong JWT secrets
- [ ] IP whitelists configured
- [ ] Metrics enabled
- [ ] Proper log retention
- [ ] Debug flags disabled

## Usage

### Development

```bash
# Copy template
cp config/openguard.toml config/dev.toml

# Set environment variables
export OFFSEC_GUARDIAN_ID="guardian-dev"
export OFFSEC_PORTAL_URL="http://localhost:9115"
export GUARDIAN_JWT_HS256_SECRET="dev-secret"

# Validate
poetry run python scripts/validate-openguard.py config/dev.toml

# Run Guardian
export GUARDIAN_CONFIG=config/dev.toml
poetry run guardian run
```

### Production

```bash
# Copy production template
cp config/openguard-prod.toml config/prod.toml

# Edit for your environment
nano config/prod.toml

# Set secure environment variables
export OFFSEC_GUARDIAN_ID="guardian-prod-01"
export OFFSEC_PORTAL_URL="https://portal.mesh.local"
export GUARDIAN_JWT_HS256_SECRET="$(openssl rand -hex 32)"
export OPERATOR_IP="192.168.1.100"
export VPN_SUBNET="10.13.13.0/24"

# Validate (strict mode)
poetry run python scripts/validate-openguard.py config/prod.toml --strict

# Run Guardian
export GUARDIAN_CONFIG=config/prod.toml
poetry run guardian run
```

## Configuration Sections

### Guardian Core (`[guardian]`)
- Identity, tags, API endpoint
- Authentication (JWT/capability tokens)
- Performance tuning

### Log Sources (`[log_sources.*]`)
- SSH, Nginx, Firewall, Portal, Syslog
- File paths and watch modes
- Polling intervals

### Detectors (`[detectors.*]`)
- Brute force, scanner, anomaly, rate limit, geo
- Thresholds and time windows
- Confidence scoring

### Actions (`[actions.*]`)
- Block IP, alert human, quarantine, rate limit
- Approval requirements
- Execution policies

### Action Server (`[action_server]`)
- HTTP server for action requests
- TLS configuration
- Capability-based auth

### Observability (`[observability.*]`)
- Prometheus metrics
- Distributed tracing
- Structured logging
- Log rotation

### Ledger (`[ledger]`)
- Receipt emission
- Proof generation
- Merkle tree sync

### Mesh (`[mesh]`)
- Peer discovery
- Proof sharing
- Gossip protocol

## Validation

The `validate-openguard.py` script checks:

1. **Required sections** - Guardian, detectors, actions present
2. **Required fields** - ID, API URL, auth config
3. **Valid detector names** - Known detector types
4. **Valid action names** - Supported actions
5. **Security issues** - Weak secrets, missing whitelists
6. **Configuration consistency** - TLS paths when enabled, etc.

### Example Output

```bash
$ poetry run python scripts/validate-openguard.py config/openguard.toml

Validating: config/openguard.toml
------------------------------------------------------------

⚠️  WARNINGS:
  • guardian.api_url should start with http:// or https://

============================================================
✅ Configuration is valid (with 1 warnings)
```

## Migration from dev.toml

1. **Backup existing config:**
   ```bash
   cp config/dev.toml config/dev.toml.bak
   ```

2. **Copy OpenGuard template:**
   ```bash
   cp config/openguard.toml config/dev.toml
   ```

3. **Update environment-specific values:**
   - Guardian ID
   - API URLs
   - JWT secrets
   - Log paths
   - Enabled detectors/actions

4. **Validate:**
   ```bash
   poetry run python scripts/validate-openguard.py config/dev.toml
   ```

## Integration with Guardian

The Guardian `config.py` already supports loading TOML configs. OpenGuard is a drop-in replacement:

```python
from guardian.config import config

# Config automatically loads from GUARDIAN_CONFIG env var
guardian_id = config.get("guardian.id")
detectors = config.get("detectors.enabled", [])
```

## Next Steps

1. **Schema Definition** - Create `openguard-schema.json` for programmatic validation
2. **Config Hot-Reload** - Watch config file for changes and reload
3. **Web UI** - Configuration editor in OffSec UI
4. **Templates** - Preset configs for common scenarios (high-security, dev, minimal)
5. **Migration Tool** - Automated conversion from old format

## Related Documentation

- [AGENT.md](../AGENT.md) - OffSec Shield operational handbook
- [OPERATOR_HANDBOOK.md](../docs/OPERATOR_HANDBOOK.md) - Operations runbook
- [Guardian README](../apps/guardian/README.md) - Guardian architecture
- [EVENTS.md](../docs/EVENTS.md) - Event and receipt schemas

## Support

For issues or questions:
1. Validate your config: `scripts/validate-openguard.py`
2. Check logs: `docker-compose logs guardian`
3. Review [OPENGUARD.md](./OPENGUARD.md) documentation
4. See [AGENT.md](../AGENT.md) troubleshooting section

---

**OpenGuard standardizes Guardian configuration across dev, staging, and production environments with validation, security checks, and comprehensive documentation.**
