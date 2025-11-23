#!/usr/bin/env bash
# Orchestrated tmux demo of OffSec Shield:
# - portal-ext logs
# - guardian logs
# - UI logs
# - receipts watch
# - control pane for manual events

set -euo pipefail

SESSION_NAME="${SESSION_NAME:-offsec_demo}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OFFSEC_DATA_DIR="${OFFSEC_DATA_DIR:-$ROOT_DIR/data}"
OFFSEC_API_PORT="${OFFSEC_API_PORT:-9115}"
OFFSEC_UI_PORT="${OFFSEC_UI_PORT:-3001}"
OFFSEC_JWT_HS256_SECRET="${OFFSEC_JWT_HS256_SECRET:-dev-secret}"

if ! command -v tmux >/dev/null 2>&1; then
  echo "[tmux-demo] tmux is not installed. Please install tmux first."
  exit 1
fi

mkdir -p "$OFFSEC_DATA_DIR"

tmux new-session -d -s "$SESSION_NAME" -c "$ROOT_DIR"
tmux rename-window -t "$SESSION_NAME:0" 'offsec-shield'

# Pane 1: portal-ext
tmux send-keys -t "$SESSION_NAME:0.0" "cd apps/portal-ext && OFFSEC_DATA_DIR='$OFFSEC_DATA_DIR' OFFSEC_JWT_HS256_SECRET='$OFFSEC_JWT_HS256_SECRET' cargo run" C-m

# Pane 2: guardian
tmux split-window -h -t "$SESSION_NAME:0"
tmux send-keys -t "$SESSION_NAME:0.1" "cd apps/guardian && OFFSEC_JWT_HS256_SECRET='$OFFSEC_JWT_HS256_SECRET' OFFSEC_GUARDIAN_ID='guardian-demo' GUARDIAN_CAP_AUD='offsec-portal' poetry run guardian run" C-m

# Pane 3: UI (below pane 1)
tmux split-window -v -t "$SESSION_NAME:0.0"
tmux send-keys -t "$SESSION_NAME:0.2" "cd apps/ui && NEXT_PUBLIC_OFFSEC_API_URL='http://localhost:${OFFSEC_API_PORT}' NEXT_PUBLIC_OFFSEC_WS='ws://localhost:${OFFSEC_API_PORT}/offsec/ws' npm run dev" C-m

# Pane 4: receipts watch (below pane 2)
tmux select-pane -t "$SESSION_NAME:0.1"
tmux split-window -v -t "$SESSION_NAME:0.1"
tmux send-keys -t "$SESSION_NAME:0.3" "cd '$OFFSEC_DATA_DIR' && watch -n 2 \"ls -1 receipts/offsec 2>/dev/null | tail -n 5\"" C-m

# Control window
tmux new-window -t "$SESSION_NAME" -n 'control' -c "$ROOT_DIR"
tmux send-keys -t "$SESSION_NAME:1" "echo '# Control pane for OffSec Shield demo'; echo './demo/run_demo.sh or custom curl to send events';" C-m

echo "[tmux-demo] Session '$SESSION_NAME' started."
echo "[tmux-demo] Attach with: tmux attach -t $SESSION_NAME"
echo "[tmux-demo] UI: http://localhost:${OFFSEC_UI_PORT}"

tmux attach -t "$SESSION_NAME"
