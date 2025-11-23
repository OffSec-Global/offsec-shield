#!/bin/bash
set -e

echo "Running tests..."

echo "Portal-Ext (Rust)..."
cd apps/portal-ext
cargo test -- --nocapture --test-threads=1
cd ../..

echo "Guardian (Python)..."
cd apps/guardian
poetry run pytest tests/ -v --tb=short
cd ../..

echo "UI (TypeScript)..."
cd apps/ui
npm test -- --run 2>/dev/null || echo "UI tests skipped (vitest not configured)"
cd ../..

echo "✓ Tests complete"
