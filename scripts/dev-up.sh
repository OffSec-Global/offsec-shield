#!/bin/bash
set -e

echo "Starting OffSec Shield dev stack..."

# Start portal-ext
echo "Starting portal-ext on :9115..."
cd apps/portal-ext
cargo run &
PORTAL_PID=$!

# Start guardian
echo "Starting guardian..."
cd ../guardian
poetry run guardian run &
GUARDIAN_PID=$!

# Start UI
echo "Starting UI on :3001..."
cd ../ui
npm run dev &
UI_PID=$!

echo ""
echo "✓ Dev stack running!"
echo "  - UI: http://localhost:3001"
echo "  - Portal-Ext: http://localhost:9115"
echo "  - Guardian: logging to console"
echo ""
echo "PIDs: UI=$UI_PID, Guardian=$GUARDIAN_PID, Portal=$PORTAL_PID"
echo "Use 'make dev-down' or 'kill $UI_PID $GUARDIAN_PID $PORTAL_PID' to stop"
echo ""

wait
