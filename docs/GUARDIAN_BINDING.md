# Guardian Binding & Production Exposure

This note captures the safe defaults and toggles for how Guardian is exposed.

## Default (production) — internal only
- Do not publish Guardian ports in `docker-compose.yml`.
- Reach Guardian only via the Docker network, WireGuard, or an explicit reverse proxy (pfSense/HAProxy).

## Mesh-only exposure (WireGuard)
- Use `docker-compose.override.wg.yml` to bind Guardian to the WireGuard IP (example: `10.21.0.2:9120:9120`).
- Run with:  
  `docker-compose -f docker-compose.yml -f docker-compose.override.wg.yml up -d --build`
- Host firewall (ufw/iptables) should allow 9120 only on `wg0`, deny elsewhere.

## Readiness
- Health endpoints: `/healthz` (liveness), `/healthz/ready` (readiness: data dir writable + detector heartbeat).
- For CI:  
  `docker exec $(docker-compose ps -q guardian) curl -sf http://127.0.0.1:9120/healthz/ready`

## Watchdog / alerts
- `scripts/guard-ready-watchdog.sh` posts to `OFFSEC_READY_WEBHOOK` when readiness fails repeatedly.  
- Systemd unit: `infra/systemd/offsec-guard-watchdog.service`.

## Safety tips
- Keep Guardian internal-only for prod; if you must bind, use loopback or WireGuard IP, never 0.0.0.0.
- Avoid exposing port 9120 publicly. Use pfSense/HAProxy/WireGuard to control ingress.

