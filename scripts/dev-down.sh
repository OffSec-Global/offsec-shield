#!/bin/bash
echo "Stopping OffSec Shield dev stack..."
pkill -f "next.*dev" || true
pkill -f "cargo.*run" || true
pkill -f "guardian.*run" || true
sleep 1
echo "✓ Stopped"
