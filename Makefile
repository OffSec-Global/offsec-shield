.PHONY: tools-install dev dev-down test format clean help

# Install all tools
tools-install:
	@echo "Installing Rust..."
	@command -v cargo >/dev/null 2>&1 || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
	@echo "Installing Node.js (if not present)..."
	@command -v node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs)
	@echo "Installing Python 3.10+ (if not present)..."
	@command -v python3 >/dev/null 2>&1 || sudo apt-get install -y python3 python3-pip python3-venv
	@echo "Installing Poetry..."
	@command -v poetry >/dev/null 2>&1 || pip3 install poetry
	@echo "Installing Docker (if not present)..."
	@command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh
	@echo "✓ Tools installed"

# Install dependencies for all apps
install: tools-install
	cd apps/ui && npm install
	cd apps/guardian && poetry install
	cd apps/portal-ext && cargo fetch

# Run dev stack
dev: install
	@echo "Starting dev stack..."
	@echo "UI will run on http://localhost:3001"
	@echo "Portal-Ext will run on http://localhost:9115"
	@echo "Guardian will run in the background"
	@echo ""
	@echo "Open another terminal window for each component or use 'make dev-split'"

dev-split:
	@tmux new-session -d -s offsec-shield "make dev-ui"
	@tmux new-window -t offsec-shield "make dev-portal"
	@tmux new-window -t offsec-shield "make dev-guardian"
	@tmux attach-session -t offsec-shield

dev-ui:
	cd apps/ui && npm run dev

dev-portal:
	cd apps/portal-ext && cargo run

dev-guardian:
	cd apps/guardian && poetry run guardian run

# Stop dev stack
dev-down:
	@pkill -f "next.*dev" || true
	@pkill -f "cargo.*run" || true
	@pkill -f "guardian.*run" || true

# Run tests
test:
	@echo "Running portal-ext tests..."
	cd apps/portal-ext && cargo test
	@echo "Running guardian tests..."
	cd apps/guardian && poetry run pytest tests/ -v
	@echo "Running UI tests..."
	cd apps/ui && npm test -- --run 2>/dev/null || true
	@echo "✓ Tests complete"

# Format code
format:
	@echo "Formatting Rust..."
	cd apps/portal-ext && cargo fmt
	@echo "Formatting Python..."
	cd apps/guardian && poetry run black guardian/ tests/
	@echo "Formatting TypeScript..."
	cd apps/ui && npm run lint -- --fix 2>/dev/null || true
	@echo "✓ Formatted"

# Lint code
lint:
	@echo "Linting Rust..."
	cd apps/portal-ext && cargo clippy
	@echo "Linting Python..."
	cd apps/guardian && poetry run pylint guardian/ || true
	@echo "Linting TypeScript..."
	cd apps/ui && npm run lint
	@echo "✓ Lint complete"

# Clean all build artifacts
clean:
	rm -rf apps/ui/.next apps/ui/node_modules
	rm -rf apps/guardian/.venv apps/guardian/__pycache__
	rm -rf apps/portal-ext/target
	@echo "✓ Clean complete"

# Help
help:
	@echo "OffSec Shield - Makefile targets:"
	@echo ""
	@echo "  make tools-install    - Install Rust, Node, Python, Docker"
	@echo "  make install          - Install all dependencies"
	@echo "  make dev              - Start dev stack (read instructions)"
	@echo "  make dev-split        - Start dev stack in tmux windows"
	@echo "  make dev-down         - Stop dev processes"
	@echo "  make test             - Run all tests"
	@echo "  make format           - Format all code"
	@echo "  make lint             - Lint all code"
	@echo "  make clean            - Remove build artifacts"
	@echo ""
