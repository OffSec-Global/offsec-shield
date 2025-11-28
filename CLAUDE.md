# CLAUDE.md - offsec-shield

> Battle-ready security operations platform with cryptographic proof ledger.
> See **AGENT.md** for complete operational documentation.

## Quick Reference

**Stack**: Rust (Portal-Ext) + Python (Guardian) + Next.js (UI)
**Ports**: UI 3001, Portal-Ext 9115, Guardian Action Server 9120
**Data**: `$OFFSEC_DATA_DIR` (default: `./data-offsec`)

## Essential Commands

```bash
# Development (from ~/offsec-shield)
make tools-install            # First-time setup
make dev                      # Build and install deps
demo/run_demo.sh              # Full E2E demo

# Individual components
cd apps/portal-ext && cargo run                    # Rust service
cd apps/ui && npm run dev                          # Next.js dashboard
cd apps/guardian && poetry run guardian run        # Python detector

# Testing
make test                     # All test suites
make format                   # Format all code
make lint                     # Lint all code
```

## Core Services

| Service | Port | Purpose |
|---------|------|---------|
| Portal-Ext | 9115 | Event ingestion, capability auth, receipts, WebSocket |
| UI | 3001 | Real-time threat stream, action panel, proof ledger |
| Guardian | 9120 | Log tailing, threat detection, action execution |

## Key Files

| File | Purpose |
|------|---------|
| `AGENT.md` | Full operational handbook |
| `docs/SPEC.md` | Technical specification |
| `docs/ARCHITECTURE.md` | System design and flows |
| `docs/EVENTS.md` | Event/receipt schemas |
| `docs/OPERATOR_HANDBOOK.md` | Ops runbook |

## Agent Rules

1. **Never print secrets** — `.env`, JWT keys, capability tokens
2. **Validate before changes** — `cargo check`, `npm run build`, `poetry check`
3. **Read code before editing** — understand existing patterns
4. **Test after changes** — `make test` or component-specific tests
5. **Receipts are immutable** — never edit files in `data-offsec/receipts/`
6. **Capability tokens expire** — regenerate if auth fails

## Architecture

```
Guardian (detect) → Portal-Ext (validate + receipt) → UI (stream)
                           ↓
                    Merkle Tree → ROOT.txt → ANCHOR.json
```

## Engine Integration

OffSec Shield depends on `civilization-ledger-core` from `~/engine`:

```toml
# apps/portal-ext/Cargo.toml
civilization-ledger-core = { git = "https://github.com/VaultSovereign/engine.git" }
```

Key integration points:
- `promote_event()` — converts events to signed receipts
- `FileStore` — persists receipts to disk
- `Capability` — validates Bearer tokens

## Environment Variables

**Portal-Ext**:
- `OFFSEC_LISTEN` — bind address (default: `0.0.0.0:9115`)
- `OFFSEC_DATA_DIR` — data directory (default: `./data-offsec`)
- `OFFSEC_JWT_HS256_SECRET` — JWT secret (default: `dev-secret`)

**Guardian**:
- `OFFSEC_GUARDIAN_ID` — unique guardian identifier
- `OFFSEC_PORTAL_URL` — Portal-Ext URL
- `GUARDIAN_TAGS` — comma-separated tags

**UI**:
- `NEXT_PUBLIC_OFFSEC_API_URL` — Portal-Ext URL
- `NEXT_PUBLIC_OFFSEC_WS` — WebSocket URL

## API Quick Reference

```bash
# Ingest event (requires capability token)
curl -X POST http://localhost:9115/offsec/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"security.alert",...}'

# Get receipts
curl http://localhost:9115/offsec/receipts

# Get proof bundle
curl http://localhost:9115/offsec/proof/<receipt_id>

# Health check
curl http://localhost:9115/healthz
```

---

## Claude Code Capabilities

### Useful Workflows

**Debugging Events**:
```
"Why isn't my event showing in the UI?"
→ Check Portal-Ext logs, capability token, WebSocket connection
```

**Receipt Verification**:
```
"Verify the latest proof bundle"
→ Export proof, run offsec-proof-verify, check Merkle path
```

**Guardian Issues**:
```
"Guardian isn't detecting threats"
→ Check log sources, detector config, OFFSEC_PORTAL_URL
```

### MCP Server Integrations

```bash
claude mcp add github -- npx @modelcontextprotocol/server-github
claude mcp add filesystem -- npx @modelcontextprotocol/server-filesystem /home/sovereign
```

### Custom Commands

Create in `.claude/commands/`:

```markdown
<!-- .claude/commands/verify-proof.md -->
Verify a proof bundle from the latest receipt.

1. Get latest receipt ID from /offsec/receipts
2. Download proof bundle
3. Run offsec-proof-verify
4. Report verification result
```
