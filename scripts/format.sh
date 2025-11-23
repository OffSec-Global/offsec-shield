#!/bin/bash
set -e

echo "Formatting all code..."

echo "Rust (portal-ext)..."
cd apps/portal-ext
cargo fmt
cargo clippy --fix --allow-dirty || true
cd ../..

echo "Python (guardian)..."
cd apps/guardian
poetry run black guardian/ tests/ 2>/dev/null || true
poetry run isort guardian/ tests/ 2>/dev/null || true
cd ../..

echo "TypeScript (ui)..."
cd apps/ui
npm run lint -- --fix 2>/dev/null || true
cd ../..

echo "✓ Formatted"
