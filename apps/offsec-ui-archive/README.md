# OffSec Shield — Security Operations Console

**Rubedo Edition** — Battle-ready security operations dashboard with real-time threat streaming, autonomous action control, and cryptographic proof ledger.

## Features

- **Threat Stream** — Live WebSocket feed of security events with severity indicators
- **Action Panel** — Approve/reject autonomous actions, trigger manual responses
- **Proof Ledger** — Merkle tree receipts with downloadable proof bundles
- **Guardian Status** — Real-time visibility into distributed detector agents
- **Defense Mode** — Visual indicator of active defense posture

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_OFFSEC_API_URL` | `http://localhost:9115` | Portal-ext API URL |
| `NEXT_PUBLIC_OFFSEC_WS` | `ws://localhost:9115/offsec/ws` | WebSocket endpoint |

## Project Structure

```
offsec-ui/
├── page.tsx              # Main console page component
├── layout.tsx            # Root layout with fonts
├── globals.css           # Rubedo design system CSS
├── rubedo.tailwind.ts    # Tailwind config extension
├── tailwind.config.ts    # Tailwind configuration
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
```

## Design System: Rubedo

The UI implements the **Rubedo Design System** — an alchemical-cyber aesthetic:

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#050507` | Onyx Shadow — page background |
| `--platinum` | `#EDEDF2` | Platinum Veil — primary text |
| `--emerald` | `#00E79E` | Neon Emerald — healthy/success |
| `--ruby` | `#FF005D` | Neon Ruby — critical/active defense |
| `--amber` | `#FFC93C` | Amber — warning/degraded |
| `--cyan` | `#00D4FF` | Cyan — info/network |

### Typography

- **Display**: Space Grotesk — headers, labels
- **Mono**: JetBrains Mono — data, metrics, code

### Spacing

8px rhythm grid system: `--rhythm`, `--rhythm-2`, etc.

### Visual Elements

- 3px left accent bars on cards (status-colored)
- Alchemical watermark (⬡) on panels
- Ambient background with emerald/ruby gradients
- Grid overlay for depth
- Pulsing status dots with glow effects

## API Integration

The console connects to the **OffSec Shield Portal-Ext** backend:

### WebSocket Events

```typescript
{ type: 'threat_event', data: ThreatEvent }
{ type: 'offsec.action.requested', data: ActionRequest }
{ type: 'offsec.action.result', data: ActionResult }
{ type: 'receipt', data: Receipt }
```

### REST Endpoints

- `GET /offsec/receipts?limit=N` — Recent receipts
- `GET /offsec/root` — Current Merkle root
- `GET /offsec/proof/:id` — Download proof bundle
- `POST /offsec/action/apply` — Trigger action

## Usage with OffSec Shield

This UI is designed to work with the full OffSec Shield stack:

```bash
# From repo root
make dev

# Or manually:
# Terminal 1: Portal-ext
cd apps/portal-ext && cargo run

# Terminal 2: Guardian
cd apps/guardian && poetry run guardian run

# Terminal 3: UI
cd apps/ui && npm run dev
```

Then open http://localhost:3001

## License

MIT — VaultMesh Technologies

---

*"Defense without proof is theater. OffSec Shield is both shield and witness."*
