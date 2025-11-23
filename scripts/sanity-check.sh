#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo
echo "---- OffSec Shield: SANITY CHECK ----"
echo "Repo root: $ROOT"
echo

# Quick args
FAST_BUILD=0
if [ "${1:-}" = "--fast-build" ]; then
  FAST_BUILD=1
  echo "[INFO] Fast build checks ENABLED (cargo/npm/pytest)."
fi

# 1) Git state
echo
echo "1) Git status"
git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(no-git)")
echo "Branch: $git_branch"
echo "Uncommitted changes:"
git status --porcelain || true

# 2) Docker-compose quick inspection
echo
echo "2) Docker Compose check"
if [ -f docker-compose.yml ]; then
  echo "docker-compose.yml present."
  echo "Looking for private/replaceable images..."
  grep -nH "vaultmesh/portal" docker-compose.yml || true
  grep -nH "http-echo" docker-compose.yml || true
  echo
  echo "docker-compose config (validates interpolation):"
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose config 2>/dev/null | sed -n '1,120p'
  else
    echo "docker-compose not found on PATH; skipping 'docker-compose config'."
  fi
else
  echo "No docker-compose.yml found at repo root."
fi

# 3) Dockerfiles: base images
echo
echo "3) Dockerfiles: base FROM lines"
find apps -maxdepth 3 -name Dockerfile -print0 | xargs -0 -n1 -I{} bash -c \
  'printf "\n-- %s --\n" "{}"; sed -n "1,120p" "{}" | sed -n "1,20p" | awk "/^FROM/ {print}" || true'

# 4) Repo scan for specific tokens
echo
echo "4) Repo scan for tokens (vaultmesh/portal, http-echo, rust:nightly, VAULTMESH_CODEX_ACTIVE)"
grep -RIn --no-messages -e "vaultmesh/portal" -e "http-echo" -e "rust:nightly" -e "VAULTMESH_CODEX_ACTIVE" || true
echo
echo "Finding mesh & API endpoints in code (offsec/mesh, /offsec/proof, /offsec/mesh)..."
grep -RIn --no-messages -e "/offsec/mesh" -e "\"/offsec/proof" -e "mesh.proof_received" apps || true

# 5) Docker stack status
echo
echo "5) Docker containers (docker-compose ps / docker ps)"
if command -v docker-compose >/dev/null 2>&1; then
  docker-compose ps || true
else
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | sed -n '1,80p'
fi

echo
echo "Listening ports for portal/ui/guardian (9115, 3001/3000, 9120):"
sudo ss -ltnp 2>/dev/null | egrep '9115|9110|3000|3001|9120' || true

# 6) HTTP health checks
echo
echo "6) HTTP health endpoints"
PORTAL_URL="${PORTAL_URL:-http://localhost:9115}"
UI_URL="${UI_URL:-http://localhost:3001}"
GUARDIAN_URL="${GUARDIAN_URL:-http://localhost:9120}"

echo -n "portal-ext /healthz -> "
curl -sS --max-time 5 "${PORTAL_URL}/healthz" && echo || echo "FAILED"

echo -n "portal-ext /offsec/root -> "
curl -sS --max-time 5 "${PORTAL_URL}/offsec/root" | sed -n '1,2p' || echo "FAILED"

echo -n "portal-ext /offsec/receipts?limit=1 -> "
curl -sS --max-time 5 "${PORTAL_URL}/offsec/receipts?limit=1" | sed -n '1,2p' || echo "FAILED"

echo -n "UI root -> "
curl -sS --max-time 5 "${UI_URL}/" -I | sed -n '1p' || echo "FAILED"

echo -n "guardian /health (if present) -> "
curl -sS --max-time 5 "${GUARDIAN_URL}/health" -I | sed -n '1p' || echo "no-guardian"

# 7) Data dir checks
echo
echo "7) Data dir quick checks"
DATA_DIR="${OFFSEC_DATA_DIR:-$ROOT/data}"
echo "OFFSEC_DATA_DIR = $DATA_DIR"
if [ -d "$DATA_DIR" ]; then
  echo "ROOT.txt:"
  if [ -f "$DATA_DIR/ROOT.txt" ]; then
    echo "  exists - preview:"
    head -n 5 "$DATA_DIR/ROOT.txt"
  else
    echo "  ROOT.txt missing"
  fi
  echo "Receipts dir preview:"
  ls -1 "$DATA_DIR/receipts/offsec" 2>/dev/null | tail -n 5 || echo "  no receipts or path missing"
  echo "Data dir perms:"
  ls -ld "$DATA_DIR"
else
  echo "Data dir not found: $DATA_DIR"
fi

# 8) Optional fast builds / tests
echo
if [ "$FAST_BUILD" -eq 1 ]; then
  echo "8) Fast builds & lint (this may be slow)."
  echo "-> cargo check (apps/portal-ext) ..."
  if [ -d apps/portal-ext ]; then
    (cd apps/portal-ext && cargo check --color=always) || echo "[WARN] cargo check failed"
  fi

  echo "-> npm lint (apps/ui) ..."
  if [ -d apps/ui ]; then
    (cd apps/ui && npm install --no-audit --no-fund >/dev/null 2>&1 || true; npm run -s lint) || echo "[WARN] npm lint failed"
  fi

  echo "-> pytest (apps/guardian) ..."
  if [ -d apps/guardian ]; then
    (cd apps/guardian && poetry run pytest -q) || echo "[WARN] guardian tests failed"
  fi
else
  echo "8) Fast build/test skipped (run with --fast-build to enable)."
fi

# 9) Summarize
echo
echo "---- Summary / quick remediation guide ----"
echo "- If you saw 'vaultmesh/portal' in docker-compose and you do not have that image,"
echo "  either replace it with a dev stub (http-echo) or docker login/pull the private image."
echo "- If Dockerfile uses 'rust:1.73', and your deps require edition2024, consider using"
echo "  a pinned nightly or a new stable toolchain image; document and revert for prod later."
echo "- Ensure OFFSEC_DATA_DIR exists and is writable by portal-ext (or container user)."
echo "- If health endpoints failed, check container logs: 'docker logs offsec-portal-ext --tail 200'"
echo "- To enable stronger checks, re-run with: scripts/sanity-check.sh --fast-build"
echo
echo "Done."
