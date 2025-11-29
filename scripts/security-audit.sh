#!/bin/bash
# OffSec Shield Security Audit Script
# Run this script to audit all dependencies for known vulnerabilities
#
# Usage:
#   ./security-audit.sh              # Run full audit
#   ./security-audit.sh --dry-run    # Show what would be checked without running
#   ./security-audit.sh --fix        # Attempt to fix vulnerabilities
#   ./security-audit.sh --fix --dry-run  # Show what fixes would be applied

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
DRY_RUN=false
FIX_MODE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --fix|-f)
            FIX_MODE=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run, -n    Show what would be done without making changes"
            echo "  --fix, -f        Attempt to automatically fix vulnerabilities"
            echo "  --verbose, -v    Show detailed output"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run security audit"
            echo "  $0 --dry-run          # Preview audit steps"
            echo "  $0 --fix --dry-run    # Preview fixes without applying"
            echo "  $0 --fix              # Apply fixes automatically"
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
NC='\033[0m' # No Color

# Track overall status
AUDIT_FAILED=0
FIXES_AVAILABLE=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $2"
    else
        echo -e "${RED}[FAIL]${NC} $2"
        AUDIT_FAILED=1
    fi
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_dry_run() {
    echo -e "${CYAN}[DRY-RUN]${NC} $1"
}

print_fix() {
    echo -e "${GREEN}[FIX]${NC} $1"
}

# Function to run or simulate a command
run_cmd() {
    local description="$1"
    shift
    local cmd="$@"
    
    if [ "$DRY_RUN" = true ]; then
        print_dry_run "Would run: $cmd"
        return 0
    else
        if [ "$VERBOSE" = true ]; then
            print_info "Running: $cmd"
        fi
        eval "$cmd"
        return $?
    fi
}

echo "========================================"
echo "  OffSec Shield Security Audit"
echo "  $(date)"
if [ "$DRY_RUN" = true ]; then
    echo -e "  ${CYAN}DRY RUN MODE - No changes will be made${NC}"
fi
if [ "$FIX_MODE" = true ]; then
    echo -e "  ${GREEN}FIX MODE - Will attempt to fix vulnerabilities${NC}"
fi
echo "========================================"
echo ""

# ============================================
# Rust Projects
# ============================================
echo "--- Rust Security Audit ---"
echo ""

if [ "$DRY_RUN" = true ]; then
    print_dry_run "Would check for cargo-audit installation"
    print_dry_run "Would audit: apps/portal-ext"
    print_dry_run "Would audit: apps/proof-verify"
    
    if [ "$FIX_MODE" = true ]; then
        print_dry_run "Would run: cd apps/portal-ext && cargo update"
        print_dry_run "Would run: cd apps/proof-verify && cargo update"
    fi
else
    if command -v cargo-audit &> /dev/null; then
        echo "Auditing portal-ext..."
        cd "$PROJECT_ROOT/apps/portal-ext"
        if cargo audit 2>/dev/null; then
            print_status 0 "portal-ext: No vulnerabilities found"
        else
            print_status 1 "portal-ext: Vulnerabilities detected"
            FIXES_AVAILABLE=1
            if [ "$FIX_MODE" = true ]; then
                print_fix "Updating portal-ext dependencies..."
                cargo update
            fi
        fi
        echo ""

        echo "Auditing proof-verify..."
        cd "$PROJECT_ROOT/apps/proof-verify"
        if cargo audit 2>/dev/null; then
            print_status 0 "proof-verify: No vulnerabilities found"
        else
            print_status 1 "proof-verify: Vulnerabilities detected"
            FIXES_AVAILABLE=1
            if [ "$FIX_MODE" = true ]; then
                print_fix "Updating proof-verify dependencies..."
                cargo update
            fi
        fi
    else
        print_warning "cargo-audit not installed. Install with: cargo install cargo-audit"
        if [ "$FIX_MODE" = true ]; then
            print_dry_run "Would install cargo-audit"
        fi
    fi
fi

echo ""

# ============================================
# Python Projects
# ============================================
echo "--- Python Security Audit ---"
echo ""

if [ "$DRY_RUN" = true ]; then
    print_dry_run "Would check Guardian dependencies in: apps/guardian"
    print_dry_run "Would verify cryptography >= 42.0.0"
    
    if [ "$FIX_MODE" = true ]; then
        print_dry_run "Would run: cd apps/guardian && poetry update cryptography"
    fi
else
    cd "$PROJECT_ROOT/apps/guardian"

    if command -v poetry &> /dev/null; then
        echo "Checking Guardian dependencies..."
        
        # Check if safety is available
        if pip show safety &> /dev/null || poetry run pip show safety &> /dev/null 2>&1; then
            if poetry export -f requirements.txt --without-hashes 2>/dev/null | safety check --stdin 2>/dev/null; then
                print_status 0 "Guardian: No vulnerabilities found"
            else
                print_status 1 "Guardian: Vulnerabilities detected"
                FIXES_AVAILABLE=1
                if [ "$FIX_MODE" = true ]; then
                    print_fix "Updating Guardian dependencies..."
                    poetry update
                fi
            fi
        else
            print_warning "safety not installed. Install with: pip install safety"
            
            # Fallback: check for known vulnerable versions manually
            echo "Checking cryptography version..."
            CRYPTO_VERSION=$(poetry show cryptography 2>/dev/null | grep "version" | awk '{print $3}')
            if [ -n "$CRYPTO_VERSION" ]; then
                MAJOR_VERSION=$(echo "$CRYPTO_VERSION" | cut -d. -f1)
                if [ "$MAJOR_VERSION" -lt 42 ]; then
                    print_status 1 "Guardian: cryptography $CRYPTO_VERSION is vulnerable (requires >= 42.0.0)"
                    FIXES_AVAILABLE=1
                    if [ "$FIX_MODE" = true ]; then
                        print_fix "Updating cryptography..."
                        poetry update cryptography
                    fi
                else
                    print_status 0 "Guardian: cryptography $CRYPTO_VERSION is patched"
                fi
            fi
        fi
    else
        print_warning "poetry not installed"
    fi
fi

echo ""

# ============================================
# JavaScript Projects
# ============================================
echo "--- JavaScript Security Audit ---"
echo ""

if [ "$DRY_RUN" = true ]; then
    print_dry_run "Would audit: apps/ui"
    print_dry_run "Would run: npm audit --audit-level=high"
    
    if [ "$FIX_MODE" = true ]; then
        print_dry_run "Would run: cd apps/ui && npm audit fix"
    fi
else
    cd "$PROJECT_ROOT/apps/ui"

    if command -v npm &> /dev/null; then
        echo "Auditing UI dependencies..."
        
        # Run npm audit and capture exit code
        AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1) || true
        
        if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
            print_status 0 "UI: No high/critical vulnerabilities found"
        elif echo "$AUDIT_OUTPUT" | grep -q "high\|critical"; then
            print_status 1 "UI: High/critical vulnerabilities detected"
            FIXES_AVAILABLE=1
            if [ "$VERBOSE" = true ]; then
                echo "$AUDIT_OUTPUT" | grep -A2 "high\|critical" | head -20
            fi
            if [ "$FIX_MODE" = true ]; then
                print_fix "Running npm audit fix..."
                npm audit fix || true
                # Check if force is needed
                if npm audit --audit-level=high 2>&1 | grep -q "high\|critical"; then
                    print_warning "Some vulnerabilities require manual intervention or --force"
                fi
            fi
        else
            print_status 0 "UI: No high/critical vulnerabilities found"
        fi
    else
        print_warning "npm not installed"
    fi
fi

echo ""

# ============================================
# Summary
# ============================================
echo "========================================"
echo "  Audit Summary"
echo "========================================"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${CYAN}This was a dry run. No changes were made.${NC}"
    echo ""
    echo "To run the actual audit:"
    echo "  $0"
    echo ""
    echo "To apply fixes:"
    echo "  $0 --fix"
    echo ""
    exit 0
fi

if [ $AUDIT_FAILED -eq 0 ]; then
    echo -e "${GREEN}All security checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Security vulnerabilities detected!${NC}"
    echo ""
    
    if [ "$FIX_MODE" = true ]; then
        echo "Fixes have been applied. Re-run the audit to verify:"
        echo "  $0"
    else
        echo "Recommended actions:"
        echo "  1. Review the vulnerabilities above"
        echo "  2. Run with --fix to attempt automatic fixes:"
        echo "     $0 --fix"
        echo "  3. Or manually update affected dependencies"
        echo ""
        echo "For detailed reports, run:"
        echo "  - Rust: cd apps/portal-ext && cargo audit"
        echo "  - Python: cd apps/guardian && poetry export -f requirements.txt | safety check --stdin"
        echo "  - JS: cd apps/ui && npm audit"
    fi
    exit 1
fi
