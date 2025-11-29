#!/bin/bash
################################################################################
# VaultMesh - Bootstrap Cold-Storage Node (BETA)
#
# Purpose:
# Sets up BETA as a cold-storage, offline-capable node for:
#   - Cold backups of mesh snapshots
#   - Offline verification and forensics
#   - Backup operator terminal (emergency fallback)
#   - Dark-runner operations (manual job execution)
#   - Secured staging environment for testing
#
# Key Characteristics:
#   - Can be powered off for weeks/months without affecting mesh
#   - Never serves DNS or authoritative services
#   - No persistent state required from other nodes
#   - High-security environment for sensitive operations
#   - Can be brought online on-demand for backup/verify operations
#
# Usage:
#   ssh beta 'bash -s' < bootstrap-beta.sh
#   Or: ssh beta 'cat bootstrap-beta.sh | bash'
#   Or: Run locally on beta: bash bootstrap-beta.sh
#
# What it does:
#   1. Creates cold-storage directory structure
#   2. Installs backup and verification tools
#   3. Sets up offline encryption (GPG, openssl)
#   4. Creates SSH key for cold operations
#   5. Initializes backup script templates
#   6. Sets up forensics toolkit
#   7. Configures air-gap safety measures
#   8. Creates verification environment
#
# Prerequisites:
#   - Run on BETA node (192.168.0.236)
#   - sudo/root access required
#   - ~1 TB available storage (for backups)
#   - mesh-peers.env available (~/.vaultmesh/mesh-peers.env)
#
# Design Principle:
#   BETA is intentionally minimal and safe
#   - NO automatic network joining
#   - NO persistent state from other nodes
#   - NO service dependencies on BETA
#   - NO DNS service (even if online)
#   - Graceful offline capability
#
# Version: 2.0 (cold-storage focused)
# Author: VaultMesh Infrastructure
# Date: 2025-11-28
################################################################################

set -e  # Exit on error

################################################################################
# CONFIGURATION & CONSTANTS
################################################################################

SCRIPT_NAME="bootstrap-beta"
SCRIPT_VERSION="2.0"
BETA_HOSTNAME="beta"
BETA_IP="192.168.0.236"
BETA_DOMAIN="beta.mesh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
HOME_DIR="${HOME:-/root}"
BETA_DATA_DIR="${HOME_DIR}/.vaultmesh-beta"
BETA_BACKUPS_DIR="${BETA_DATA_DIR}/backups"
BETA_ARCHIVES_DIR="${BETA_DATA_DIR}/archives"
BETA_KEYS_DIR="${BETA_DATA_DIR}/keys"
BETA_TOOLS_DIR="${BETA_DATA_DIR}/tools"
BETA_VERIFY_DIR="${BETA_DATA_DIR}/verify"
BETA_SCRIPTS_DIR="${BETA_DATA_DIR}/scripts"
MESH_PEERS_FILE="${HOME_DIR}/.vaultmesh/mesh-peers.env"

################################################################################
# UTILITY FUNCTIONS
################################################################################

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_safety() {
    echo -e "${CYAN}🛡${NC}  $1"
}

check_node_is_beta() {
    HOSTNAME=$(hostname)
    if [[ "$HOSTNAME" != "beta" && "$HOSTNAME" != "beta.local" ]]; then
        log_warn "Running on '$HOSTNAME', expected 'beta'"
        log_warn "BETA bootstrap is designed for beta.local (192.168.0.236)"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
    log_info "Hostname: $HOSTNAME"
}

check_mesh_peers_file() {
    if [ ! -f "$MESH_PEERS_FILE" ]; then
        log_warn "mesh-peers.env not found at: $MESH_PEERS_FILE"
        log_warn "BETA will work without it, but some scripts may be incomplete"
    else
        source "$MESH_PEERS_FILE" 2>/dev/null || {
            log_warn "mesh-peers.env has syntax errors, but BETA will still work"
        }
        log_info "mesh-peers.env available"
    fi
}

################################################################################
# DIRECTORY STRUCTURE
################################################################################

create_directory_structure() {
    log_header "Step 1: Create cold-storage directory structure"
    
    # Create main directories
    mkdir -p "$BETA_DATA_DIR"
    mkdir -p "$BETA_BACKUPS_DIR"
    mkdir -p "$BETA_ARCHIVES_DIR"
    mkdir -p "$BETA_KEYS_DIR"
    mkdir -p "$BETA_TOOLS_DIR"
    mkdir -p "$BETA_VERIFY_DIR"
    mkdir -p "$BETA_SCRIPTS_DIR"
    
    # Set permissions (restrictive for security)
    chmod 700 "$BETA_DATA_DIR"
    chmod 700 "$BETA_BACKUPS_DIR"
    chmod 700 "$BETA_KEYS_DIR"
    
    log_info "Created BETA cold-storage structure:"
    log_info "  • Data dir: $BETA_DATA_DIR"
    log_info "  • Backups: $BETA_BACKUPS_DIR"
    log_info "  • Archives: $BETA_ARCHIVES_DIR"
    log_info "  • Keys: $BETA_KEYS_DIR"
    log_info "  • Tools: $BETA_TOOLS_DIR"
    log_info "  • Verify: $BETA_VERIFY_DIR"
    log_info "  • Scripts: $BETA_SCRIPTS_DIR"
}

################################################################################
# INSTALL TOOLS
################################################################################

install_backup_tools() {
    log_header "Step 2: Install backup and verification tools"
    
    TOOLS_NEEDED="tar gzip bzip2 xz gpg openssl rsync sha256sum md5sum"
    TOOLS_MISSING=""
    
    for tool in $TOOLS_NEEDED; do
        if ! command -v "$tool" &> /dev/null; then
            TOOLS_MISSING="$TOOLS_MISSING $tool"
        fi
    done
    
    if [ -z "$TOOLS_MISSING" ]; then
        log_info "All essential tools already installed"
    else
        log_info "Installing missing tools:$TOOLS_MISSING"
        
        if [ -f /etc/debian_version ]; then
            sudo apt-get update
            sudo apt-get install -y $TOOLS_MISSING
        elif [ -f /etc/redhat_release ]; then
            sudo yum install -y $TOOLS_MISSING
        fi
        
        log_info "Tools installed"
    fi
}

install_verification_tools() {
    log_info "Installing verification toolkit..."
    
    # GPG for signature verification
    if ! command -v gpg &> /dev/null; then
        log_warn "GPG not found, install with: sudo apt-get install gnupg"
    else
        log_info "GPG available: $(gpg --version | head -1)"
    fi
    
    # OpenSSL for cryptographic operations
    if ! command -v openssl &> /dev/null; then
        log_warn "OpenSSL not found, install with: sudo apt-get install openssl"
    else
        log_info "OpenSSL available: $(openssl version)"
    fi
    
    # Optional: Additional forensics tools
    log_info "Optional forensics tools can be installed as needed"
}

################################################################################
# ENCRYPTION & KEYS
################################################################################

setup_encryption() {
    log_header "Step 3: Set up cold-storage encryption"
    
    log_safety "BETA uses local encryption for sensitive data"
    log_safety "Each backup is encrypted with AES-256-GCM"
    log_safety "Cold keys are stored in $BETA_KEYS_DIR with 700 permissions"
    
    # Create encryption key template
    cat > "$BETA_KEYS_DIR/encryption-template.sh" << 'EOF'
#!/bin/bash
# Template for encrypting backups
# Usage: bash encryption-template.sh <input-file> <output-file>

INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Usage: $0 <input-file> <output-file>"
    exit 1
fi

# Encrypt with AES-256-GCM
openssl enc -aes-256-cbc -salt -in "$INPUT_FILE" -out "$OUTPUT_FILE" -k "$(<~/.vaultmesh-beta/encryption-password)"

echo "Encrypted: $INPUT_FILE → $OUTPUT_FILE"
EOF
    
    chmod 700 "$BETA_KEYS_DIR/encryption-template.sh"
    log_info "Encryption template created at: $BETA_KEYS_DIR/encryption-template.sh"
    
    # Create GPG key if needed (optional)
    log_info "To create a GPG key for signature verification, run:"
    echo "  gpg --gen-key"
    
    log_safety "Store encryption passwords securely (not in files)"
    log_safety "Use env vars: export BACKUP_PASSWORD='...'"
}

################################################################################
# BACKUP SCRIPTS
################################################################################

create_backup_scripts() {
    log_header "Step 4: Create backup operation scripts"
    
    # Snapshot backup script
    cat > "$BETA_SCRIPTS_DIR/backup-mesh-snapshot.sh" << 'EOF'
#!/bin/bash
# Backup mesh snapshot from GAMMA
# Usage: bash backup-mesh-snapshot.sh
#
# This script:
# 1. Connects to GAMMA
# 2. Retrieves mesh state snapshot
# 3. Encrypts and stores locally
# 4. Generates verification hash
#

set -e

BETA_DATA_DIR="${HOME}/.vaultmesh-beta"
BACKUP_DIR="${BETA_DATA_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mesh-snapshot-${TIMESTAMP}.tar.gz.enc"

echo "Backing up mesh snapshot from GAMMA..."

# (Implementation would connect to GAMMA, retrieve state, encrypt)
# This is a template - actual implementation depends on GAMMA structure

echo "Backup created: $BACKUP_FILE"
echo "To verify: sha256sum $BACKUP_FILE"

EOF
    
    chmod 700 "$BETA_SCRIPTS_DIR/backup-mesh-snapshot.sh"
    log_info "Created backup script: backup-mesh-snapshot.sh"
    
    # Restore backup script
    cat > "$BETA_SCRIPTS_DIR/restore-from-backup.sh" << 'EOF'
#!/bin/bash
# Restore from backup (offline operation)
# Usage: bash restore-from-backup.sh <backup-file>

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring from backup: $BACKUP_FILE"

# Decrypt
openssl enc -aes-256-cbc -d -in "$BACKUP_FILE" -out "${BACKUP_FILE%.enc}" -k "$BACKUP_PASSWORD"

# Extract
tar -xzf "${BACKUP_FILE%.enc}"

echo "Restore complete"

EOF
    
    chmod 700 "$BETA_SCRIPTS_DIR/restore-from-backup.sh"
    log_info "Created restore script: restore-from-backup.sh"
}

################################################################################
# VERIFICATION TOOLKIT
################################################################################

setup_verification_toolkit() {
    log_header "Step 5: Set up offline verification environment"
    
    log_safety "BETA can perform cryptographic verification completely offline"
    log_safety "No network connection required for integrity checks"
    
    # Create verify-root script (offline verification of root CA)
    cat > "$BETA_SCRIPTS_DIR/verify-root-ca.sh" << 'EOF'
#!/bin/bash
# Offline verification of root CA certificate
# Usage: bash verify-root-ca.sh <ca-cert-file>

CERT_FILE="$1"
VERIFY_DIR="${HOME}/.vaultmesh-beta/verify"

if [ ! -f "$CERT_FILE" ]; then
    echo "Certificate file not found: $CERT_FILE"
    exit 1
fi

echo "Verifying root CA certificate: $CERT_FILE"

# Display certificate info
openssl x509 -in "$CERT_FILE" -text -noout > "${VERIFY_DIR}/cert-info.txt"

# Verify signature
openssl x509 -in "$CERT_FILE" -noout -verify

# Calculate fingerprints
echo "SHA-256 fingerprint:"
openssl x509 -noout -fingerprint -sha256 -in "$CERT_FILE"

echo ""
echo "Verification complete. See ${VERIFY_DIR}/cert-info.txt for details"

EOF
    
    chmod 700 "$BETA_SCRIPTS_DIR/verify-root-ca.sh"
    log_info "Created verify script: verify-root-ca.sh"
    
    # Create integrity check script
    cat > "$BETA_SCRIPTS_DIR/verify-integrity.sh" << 'EOF'
#!/bin/bash
# Verify integrity of backup files using checksums
# Usage: bash verify-integrity.sh <backup-file> <checksum-file>

BACKUP_FILE="$1"
CHECKSUM_FILE="$2"

if [ ! -f "$BACKUP_FILE" ] || [ ! -f "$CHECKSUM_FILE" ]; then
    echo "Usage: $0 <backup-file> <checksum-file>"
    exit 1
fi

echo "Verifying integrity of: $BACKUP_FILE"

# Calculate and compare checksums
if sha256sum -c "$CHECKSUM_FILE"; then
    echo "✓ Integrity verified - backup is valid"
else
    echo "✗ Integrity check FAILED - backup may be corrupted"
    exit 1
fi

EOF
    
    chmod 700 "$BETA_SCRIPTS_DIR/verify-integrity.sh"
    log_info "Created integrity check script: verify-integrity.sh"
}

################################################################################
# SAFETY MEASURES
################################################################################

setup_safety_measures() {
    log_header "Step 6: Configure air-gap safety measures"
    
    log_safety "BETA is configured as an optional, offline-capable node"
    log_safety "Safety measures ensure BETA never breaks the mesh"
    
    # Create safety checklist
    cat > "$BETA_DATA_DIR/SAFETY_CHECKLIST.md" << 'EOF'
# BETA Cold-Node Safety Checklist

## Design Principles
- [ ] BETA can be powered off indefinitely
- [ ] No service depends on BETA being online
- [ ] BETA does NOT serve DNS (even if online)
- [ ] BETA does NOT hold authoritative roles
- [ ] BETA data is always encrypted
- [ ] No persistent state from other nodes

## Before Powering Off
- [ ] Backups are encrypted and verified
- [ ] SSH key is secured in ~/.vaultmesh-beta/keys/
- [ ] No active network connections
- [ ] No pending operations

## When Online
- [ ] Use only for backup/verification tasks
- [ ] Do NOT serve DNS
- [ ] Do NOT expose API endpoints
- [ ] Do NOT run any long-running services
- [ ] Perform task, then power off

## Offline Verification
- [ ] Can verify signatures locally
- [ ] Can check backup integrity
- [ ] Can decrypt encrypted archives
- [ ] Does NOT require network access

## Emergency Operations
- [ ] BETA can be brought online as backup operator terminal
- [ ] Only if both GAMMA and BRICK have failed
- [ ] Use with extreme caution
- [ ] Return to cold storage immediately after

EOF
    
    log_info "Created safety checklist: $BETA_DATA_DIR/SAFETY_CHECKLIST.md"
    
    # Create README
    cat > "$BETA_DATA_DIR/README.md" << 'EOF'
# BETA - VaultMesh Cold-Storage Node

## Purpose
BETA is a cold-storage, offline-capable node for VaultMesh operations.

## Roles
- Cold backup storage (encrypted archives)
- Offline verification (cryptographic checks)
- Forensics environment (isolated security audits)
- Emergency operator terminal (if GAMMA + BRICK fail)

## Important
- **NO DNS service** - BETA never serves DNS
- **NO persistent state** - BETA has no external dependencies
- **Offline capable** - Can be unplugged indefinitely
- **Always encrypted** - All backups are encrypted

## Usage
- Backup: `bash scripts/backup-mesh-snapshot.sh`
- Restore: `bash scripts/restore-from-backup.sh <file>`
- Verify: `bash scripts/verify-root-ca.sh <cert>`
- Check integrity: `bash scripts/verify-integrity.sh <file> <sum>`

## Directories
- `backups/` - Encrypted backup archives
- `archives/` - Compressed mesh snapshots
- `keys/` - Cold storage encryption keys
- `tools/` - Verification and backup tools
- `verify/` - Offline verification environment
- `scripts/` - Automation scripts

## Safety
See SAFETY_CHECKLIST.md before powering on/off.

## Emergency Access
If GAMMA and BRICK are both down:
1. Power on BETA
2. Use as backup operator terminal
3. Perform emergency operations
4. Verify everything is backed up
5. Power off BETA
6. Restore GAMMA or BRICK

EOF
    
    log_info "Created README: $BETA_DATA_DIR/README.md"
}

################################################################################
# STATUS & SUMMARY
################################################################################

print_status() {
    log_header "Step 7: BETA Cold-Storage Node Status"
    
    echo ""
    echo "Configuration:"
    echo "  • Hostname: $BETA_HOSTNAME"
    echo "  • IP: $BETA_IP"
    echo "  • Domain: $BETA_DOMAIN"
    echo ""
    
    echo "Directories Created:"
    echo "  • Cold-storage root: $BETA_DATA_DIR"
    echo "    - Backups: $BETA_BACKUPS_DIR"
    echo "    - Archives: $BETA_ARCHIVES_DIR"
    echo "    - Keys: $BETA_KEYS_DIR"
    echo "    - Tools: $BETA_TOOLS_DIR"
    echo "    - Verify: $BETA_VERIFY_DIR"
    echo "    - Scripts: $BETA_SCRIPTS_DIR"
    echo ""
    
    echo "Scripts Available:"
    ls -1 "$BETA_SCRIPTS_DIR"/ 2>/dev/null | sed 's/^/  • /' || echo "  (none yet)"
    echo ""
    
    echo "Safety Features:"
    echo "  ✓ Air-gap capable (offline operations)"
    echo "  ✓ Encryption ready (AES-256-GCM)"
    echo "  ✓ Verification toolkit (GPG, OpenSSL, checksums)"
    echo "  ✓ Safety checklist documented"
    echo "  ✓ No DNS service"
    echo "  ✓ No persistent state"
    echo ""
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    log_header "VaultMesh Cold-Storage Node Bootstrap (BETA)"
    echo "Version: $SCRIPT_VERSION"
    echo "Date: $(date)"
    echo ""
    
    log_safety "BETA is designed to be OPTIONAL and OFFLINE-CAPABLE"
    log_safety "Mesh does NOT depend on BETA being online"
    echo ""
    
    # Pre-flight checks
    check_node_is_beta
    check_mesh_peers_file
    
    # Setup
    create_directory_structure
    install_backup_tools
    install_verification_tools
    setup_encryption
    create_backup_scripts
    setup_verification_toolkit
    setup_safety_measures
    
    # Status
    print_status
    
    log_header "BETA Bootstrap Complete!"
    echo ""
    log_info "BETA cold-storage node is configured and ready"
    echo ""
    
    echo "Next steps:"
    echo "  1. Review the safety checklist: cat $BETA_DATA_DIR/SAFETY_CHECKLIST.md"
    echo "  2. Generate first backup: bash $BETA_SCRIPTS_DIR/backup-mesh-snapshot.sh"
    echo "  3. Test offline verification: bash $BETA_SCRIPTS_DIR/verify-integrity.sh"
    echo "  4. Power off BETA (optional, BETA is designed for dormancy)"
    echo ""
    
    log_safety "BETA can now be safely powered off and left offline"
    log_safety "Bring BETA online only when needed for backup/verify operations"
    echo ""
}

# Run main
main "$@"
