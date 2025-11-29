#!/bin/bash
# OffSec Shield Security Patch Application Script
# Applies security patches identified in the vulnerability audit
#
# Usage:
#   ./apply-security-patches.sh              # Apply all patches
#   ./apply-security-patches.sh --dry-run    # Show what would be changed
#   ./apply-security-patches.sh --component guardian  # Patch specific component

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
DRY_RUN=false
COMPONENT=""
SKIP_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --component|-c)
            COMPONENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run, -n           Show what would be done without making changes"
            echo "  --component, -c NAME    Only patch specific component (guardian|ui|rust)"
            echo "  --skip-tests            Skip running tests after patching"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Components:"
            echo "  guardian    Python Guardian service (cryptography vulnerability)"
            echo "  ui          JavaScript UI (glob/eslint-config-next vulnerability)"
            echo "  rust        Rust projects (portal-ext, proof-verify)"
            echo ""
            echo "Examples:"
            echo "  $0 --dry-run                    # Preview all patches"
            echo "  $0 --component guardian         # Patch only Guardian"
            echo "  $0 --dry-run --component ui     # Preview UI patches"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BOLD}=== $1 ===${NC}"
    echo ""
}

print_dry_run() {
    echo -e "${CYAN}[DRY-RUN]${NC} $1"
}

print_action() {
    echo -e "${GREEN}[ACTION]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_diff() {
    echo -e "${YELLOW}--- Before${NC}"
    echo -e "${GREEN}+++ After${NC}"
    echo "$1"
}

# Track results
PATCHES_APPLIED=0
PATCHES_FAILED=0

echo "========================================"
echo "  OffSec Shield Security Patch Tool"
echo "  $(date)"
if [ "$DRY_RUN" = true ]; then
    echo -e "  ${CYAN}DRY RUN MODE - No changes will be made${NC}"
fi
if [ -n "$COMPONENT" ]; then
    echo -e "  ${BLUE}Component: $COMPONENT${NC}"
fi
echo "========================================"

# ============================================
# Guardian (Python) Patches
# ============================================
patch_guardian() {
    print_header "Guardian (Python) - cryptography vulnerability"
    
    local PYPROJECT="$PROJECT_ROOT/apps/guardian/pyproject.toml"
    
    print_info "Vulnerability: CVE-2024-0057 (Memory corruption in cryptography < 42.0.0)"
    print_info "Fix: Upgrade cryptography to ^42.0.0"
    echo ""
    
    # Check current version
    if grep -q 'cryptography = "\^41' "$PYPROJECT" 2>/dev/null; then
        print_warning "Current: cryptography = \"^41.0.0\" (VULNERABLE)"
        print_info "Target:  cryptography = \"^42.0.0\" (PATCHED)"
        echo ""
        
        if [ "$DRY_RUN" = true ]; then
            print_dry_run "Would update $PYPROJECT:"
            print_diff "  - cryptography = \"^41.0.0\"
  + cryptography = \"^42.0.0\""
            echo ""
            print_dry_run "Would run: cd apps/guardian && poetry update cryptography"
            if [ "$SKIP_TESTS" = false ]; then
                print_dry_run "Would run: cd apps/guardian && poetry run pytest"
            fi
        else
            print_action "Updating pyproject.toml..."
            sed -i 's/cryptography = "\^41/cryptography = "^42/' "$PYPROJECT"
            
            print_action "Running poetry update..."
            cd "$PROJECT_ROOT/apps/guardian"
            poetry update cryptography
            
            if [ "$SKIP_TESTS" = false ]; then
                print_action "Running tests..."
                if poetry run pytest; then
                    print_info "Tests passed"
                else
                    print_warning "Some tests failed - review before deploying"
                fi
            fi
            
            PATCHES_APPLIED=$((PATCHES_APPLIED + 1))
        fi
    elif grep -q 'cryptography = "\^42' "$PYPROJECT" 2>/dev/null; then
        print_info "Already patched: cryptography = \"^42.0.0\""
    else
        print_warning "Could not determine cryptography version in pyproject.toml"
    fi
}

# ============================================
# UI (JavaScript) Patches
# ============================================
patch_ui() {
    print_header "UI (JavaScript) - glob/eslint-config-next vulnerability"
    
    local PACKAGE_JSON="$PROJECT_ROOT/apps/ui/package.json"
    
    print_info "Vulnerability: CVE-2025-64756 / GHSA-5j98-mcp5-4vw2 (Command injection in glob)"
    print_info "Fix: Upgrade eslint-config-next to ^15.1.0"
    echo ""
    
    # Check eslint-config-next version
    if grep -q '"eslint-config-next": "\^14' "$PACKAGE_JSON" 2>/dev/null; then
        print_warning "Current: eslint-config-next ^14.x (VULNERABLE)"
        print_info "Target:  eslint-config-next ^15.1.0 (PATCHED)"
        echo ""
        
        if [ "$DRY_RUN" = true ]; then
            print_dry_run "Would update $PACKAGE_JSON:"
            print_diff "  - \"eslint-config-next\": \"^14.0.0\"
  + \"eslint-config-next\": \"^15.1.0\""
            echo ""
            print_dry_run "Would run: cd apps/ui && npm install"
            if [ "$SKIP_TESTS" = false ]; then
                print_dry_run "Would run: cd apps/ui && npm test"
            fi
        else
            print_action "Updating package.json..."
            sed -i 's/"eslint-config-next": "\^14[^"]*"/"eslint-config-next": "^15.1.0"/' "$PACKAGE_JSON"
            
            print_action "Running npm install..."
            cd "$PROJECT_ROOT/apps/ui"
            npm install
            
            if [ "$SKIP_TESTS" = false ]; then
                print_action "Running tests..."
                if npm test 2>/dev/null; then
                    print_info "Tests passed"
                else
                    print_warning "Tests failed or not configured - review before deploying"
                fi
            fi
            
            PATCHES_APPLIED=$((PATCHES_APPLIED + 1))
        fi
    elif grep -q '"eslint-config-next": "\^15' "$PACKAGE_JSON" 2>/dev/null; then
        print_info "Already patched: eslint-config-next ^15.x"
    else
        print_warning "Could not determine eslint-config-next version"
    fi
    
    echo ""
    print_info "Vulnerability: GHSA-67mh-4wv8-2f99 (esbuild dev server bypass)"
    print_info "Fix: Upgrade vitest to ^3.0.0"
    echo ""
    
    # Check vitest version
    if grep -q '"vitest": "\^1' "$PACKAGE_JSON" 2>/dev/null; then
        print_warning "Current: vitest ^1.x (VULNERABLE)"
        print_info "Target:  vitest ^3.0.0 (PATCHED)"
        echo ""
        
        if [ "$DRY_RUN" = true ]; then
            print_dry_run "Would update $PACKAGE_JSON:"
            print_diff "  - \"vitest\": \"^1.0.0\"
  + \"vitest\": \"^3.0.0\""
            echo ""
            print_dry_run "Would run: cd apps/ui && npm install"
        else
            print_action "Updating package.json..."
            sed -i 's/"vitest": "\^1[^"]*"/"vitest": "^3.0.0"/' "$PACKAGE_JSON"
            
            print_action "Running npm install..."
            cd "$PROJECT_ROOT/apps/ui"
            npm install
            
            PATCHES_APPLIED=$((PATCHES_APPLIED + 1))
        fi
    elif grep -q '"vitest": "\^[23]' "$PACKAGE_JSON" 2>/dev/null; then
        print_info "Already patched: vitest ^2.x or ^3.x"
    else
        print_warning "Could not determine vitest version"
    fi
}

# ============================================
# Rust Projects Patches
# ============================================
patch_rust() {
    print_header "Rust Projects - Dependency Updates"
    
    print_info "Running cargo update to get latest compatible versions"
    echo ""
    
    for project in "portal-ext" "proof-verify"; do
        local PROJECT_DIR="$PROJECT_ROOT/apps/$project"
        
        if [ -d "$PROJECT_DIR" ]; then
            print_info "Project: $project"
            
            if [ "$DRY_RUN" = true ]; then
                print_dry_run "Would run: cd apps/$project && cargo update"
                if command -v cargo-audit &> /dev/null; then
                    print_dry_run "Would run: cd apps/$project && cargo audit"
                fi
            else
                print_action "Updating dependencies..."
                cd "$PROJECT_DIR"
                cargo update
                
                if command -v cargo-audit &> /dev/null; then
                    print_action "Running security audit..."
                    if cargo audit; then
                        print_info "No vulnerabilities found"
                    else
                        print_warning "Vulnerabilities detected - review cargo audit output"
                    fi
                else
                    print_warning "cargo-audit not installed - skipping audit"
                fi
                
                PATCHES_APPLIED=$((PATCHES_APPLIED + 1))
            fi
            echo ""
        fi
    done
}

# ============================================
# Execute Patches
# ============================================

if [ -z "$COMPONENT" ] || [ "$COMPONENT" = "guardian" ]; then
    patch_guardian
fi

if [ -z "$COMPONENT" ] || [ "$COMPONENT" = "ui" ]; then
    patch_ui
fi

if [ -z "$COMPONENT" ] || [ "$COMPONENT" = "rust" ]; then
    patch_rust
fi

# ============================================
# Summary
# ============================================
print_header "Summary"

if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}This was a dry run. No changes were made.${NC}"
    echo ""
    echo "To apply these patches, run:"
    echo "  $0"
    echo ""
    echo "To apply patches for a specific component:"
    echo "  $0 --component guardian"
    echo "  $0 --component ui"
    echo "  $0 --component rust"
else
    echo "Patches applied: $PATCHES_APPLIED"
    
    if [ $PATCHES_APPLIED -gt 0 ]; then
        echo ""
        echo -e "${GREEN}Security patches have been applied.${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Review the changes: git diff"
        echo "  2. Run the security audit: ./scripts/security-audit.sh"
        echo "  3. Run full test suite"
        echo "  4. Commit the changes"
    else
        echo ""
        echo -e "${BLUE}No patches were needed - dependencies are up to date.${NC}"
    fi
fi

echo ""
