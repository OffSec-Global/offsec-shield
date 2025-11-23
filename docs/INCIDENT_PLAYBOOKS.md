# OffSec Shield Incident Simulation Pack

Purpose: runnable “attack stories” that exercise detection → action → proof. Each scenario ships with a script and a short playbook so an operator can rehearse incidents on demand.

## Prereqs
- OffSec Shield stack running (use `demo/run_demo.sh` or `make dev` + manual terminals).
- `OFFSEC_JWT_HS256_SECRET` and `OFFSEC_GUARDIAN_ID` aligned between Guardian and portal-ext (defaults: `dev-secret`, `guardian-demo`).
- `curl` + `python` with PyJWT (installed via `make dev` in `apps/guardian`).

Common entrypoint:
```bash
demo/run_incident.sh <scenario> [flags]
```
Scenarios live in `demo/incidents/`. Filter the UI by `guardian_id` to focus on a single Guardian.

## Scenario 1 — SSH Brute Force (full walk)
**Script**: `demo/incidents/ssh_bruteforce.sh`  
**What it does**: emits N failed SSH login events with `guardian_id`/tags, then optionally auto-issues a `block_ip`.

Run it:
```bash
demo/run_incident.sh ssh_bruteforce --attempts 6 --ip 203.0.113.10 --auto-block
```
- Flags: `--attempts`, `--ip`, `--username`, `--delay`, `--auto-block`.

Observe:
- ThreatStream: `guardian.bruteforce` events from `guardian_id` you set.
- ActionPanel: `offsec.action.block_ip` request + result (status should reach `applied`).
- ProofLedger: new receipts with that `guardian_id`; click to view Merkle path; `ROOT.txt` updated on disk; optional `ANCHOR.json` if watcher is running.

Proof bundle:
```bash
RECEIPT_ID=<from UI or latest receipt file>
curl -s "http://localhost:9115/offsec/proof/${RECEIPT_ID}" -o proof.json
offsec-proof-verify proof.json
```

## Scenario 2 — Port Scanner / Recon
**Script**: `demo/incidents/suspicious_scan.sh`  
**What it does**: emits a few medium-severity `guardian.port_scan` bursts; optional `alert_human`.

Run it:
```bash
demo/run_incident.sh suspicious_scan --bursts 3 --ip 198.51.100.42 --alert
```
- Flags: `--bursts`, `--ip`, `--delay`, `--alert` (raises `offsec.action.alert_human`).

Observe:
- ThreatStream: recon bursts labeled with the Guardian.
- If `--alert`, ActionPanel shows the alert request/result receipt.
- ProofLedger: receipts tagged with the Guardian, downloadable as proof bundles.

## DIY / Extend
- Add new scripts to `demo/incidents/*.sh` and they’ll be discoverable via `demo/run_incident.sh`.
- Use the shared env vars: `OFFSEC_API_URL`, `OFFSEC_JWT_HS256_SECRET`, `OFFSEC_GUARDIAN_ID`, `GUARDIAN_TAGS`, `GUARDIAN_CAP_AUD`.
- Keep scenarios small (<30s) so they’re friendly for CI smoke tests.

## Definition of Done
- At least one fully documented scenario (SSH brute-force) can be run via a single script and maps synthetic trigger → Guardian event → UI → action → proof.
- Operator can export and verify a proof bundle after running a scenario without extra hand-holding.
