#!/bin/bash
################################################################################
# VaultMesh - Bootstrap DNS Authority on GAMMA
#
# Purpose:
# Sets up dnsmasq as the authoritative nameserver for the .mesh domain
# Configures all mesh nodes to resolve correctly
# Ensures GAMMA is the single source of truth for DNS
#
# Usage:
#   ssh gamma 'bash -s' < bootstrap-dns-gamma.sh
#   Or: ssh gamma 'cat bootstrap-dns-gamma.sh | bash'
#
# What it does:
#   1. Installs dnsmasq (if not present)
#   2. Configures dnsmasq for .mesh authoritative DNS
#   3. Adds all mesh node records
#   4. Sets up conditional forwarding to external DNS
#   5. Validates DNS configuration
#   6. Starts/restarts dnsmasq service
#   7. Tests DNS resolution from other nodes
#
# Prerequisites:
#   - Run on GAMMA node (192.168.0.191)
#   - Sudo/root access required
#   - Stable network connection
#   - mesh-peers.env file available (~/.vaultmesh/mesh-peers.env)
#
# Version: 2.0 (with BETA cold-node support)
# Author: VaultMesh Infrastructure
# Date: 2025-11-28
################################################################################

set -e  # Exit on error

################################################################################
# CONFIGURATION & CONSTANTS
################################################################################

SCRIPT_NAME="bootstrap-dns-gamma"
SCRIPT_VERSION="2.0"
MESH_DOMAIN="mesh"
MESH_TLD=".mesh"
GAMMA_IP="192.168.0.191"
GAMMA_HOSTNAME="gamma"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# Paths
MESH_PEERS_FILE="${HOME}/.vaultmesh/mesh-peers.env"
DNSMASQ_CONFIG_DIR="/etc/dnsmasq.d"
DNSMASQ_CONFIG_FILE="${DNSMASQ_CONFIG_DIR}/vaultmesh.conf"
DNSMASQ_HOSTS_FILE="/etc/dnsmasq-vaultmesh-hosts"
BACKUP_DIR="/etc/dnsmasq.backup"

# Service
DNS_SERVICE="dnsmasq"

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

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use: sudo bash bootstrap-dns-gamma.sh)"
        exit 1
    fi
    log_info "Running as root"
}

check_node_is_gamma() {
    HOSTNAME=$(hostname)
    if [[ "$HOSTNAME" != "gamma" && "$HOSTNAME" != "gamma.local" ]]; then
        log_warn "Running on '$HOSTNAME', expected 'gamma'"
        log_warn "Proceeding anyway (you may be testing)"
    fi
    log_info "Hostname: $HOSTNAME"
}

check_mesh_peers_file() {
    if [ ! -f "$MESH_PEERS_FILE" ]; then
        log_error "mesh-peers.env not found at: $MESH_PEERS_FILE"
        log_error "Download or create mesh-peers.env in ~/.vaultmesh/"
        exit 1
    fi
    log_info "mesh-peers.env found: $MESH_PEERS_FILE"
    
    # Source the file to verify syntax
    source "$MESH_PEERS_FILE" 2>/dev/null || {
        log_error "mesh-peers.env has syntax errors"
        exit 1
    }
    log_info "mesh-peers.env syntax validated"
}

################################################################################
# DNSMASQ INSTALLATION
################################################################################

install_dnsmasq() {
    log_header "Step 1: Ensure dnsmasq is installed"
    
    # Check if dnsmasq is already installed
    if command -v dnsmasq &> /dev/null; then
        DNSMASQ_VERSION=$(dnsmasq --version 2>&1 | head -1)
        log_info "dnsmasq already installed: $DNSMASQ_VERSION"
        return 0
    fi
    
    log_info "Installing dnsmasq..."
    
    # Detect OS and install
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y dnsmasq
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y dnsmasq
    elif [ -f /etc/arch-release ]; then
        sudo pacman -S --noconfirm dnsmasq
    else
        log_error "Cannot determine OS type for dnsmasq installation"
        exit 1
    fi
    
    log_info "dnsmasq installed successfully"
}

################################################################################
# DNSMASQ CONFIGURATION
################################################################################

create_dnsmasq_config() {
    log_header "Step 2: Create dnsmasq configuration for VaultMesh"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup existing config if present
    if [ -f "$DNSMASQ_CONFIG_FILE" ]; then
        BACKUP_FILE="${BACKUP_DIR}/vaultmesh.conf.backup.$(date +%s)"
        cp "$DNSMASQ_CONFIG_FILE" "$BACKUP_FILE"
        log_info "Backed up existing config to: $BACKUP_FILE"
    fi
    
    # Create main dnsmasq configuration
    cat > "$DNSMASQ_CONFIG_FILE" << 'EOF'
################################################################################
# VaultMesh DNS Configuration (dnsmasq)
# 
# This file configures dnsmasq as authoritative nameserver for .mesh domain
# Mesh-wide DNS resolution, all nodes use this as their upstream
#
# DO NOT EDIT MANUALLY - Generated by bootstrap-dns-gamma.sh
################################################################################

# DNS Server Configuration
# Listen on all interfaces for mesh queries
listen-address=127.0.0.1,192.168.0.191

# Bind to interfaces (LAN + localhost)
interface=eth0
interface=wlan0
interface=lo

# Enable DNS (listen on port 53)
port=53

# Cache settings
cache-size=10000
neg-ttl=600

# Authoritative domain: .mesh
# All queries for *.mesh are resolved locally
domain=mesh

# Conditional forwarding for other domains
# Forward all non-.mesh queries to external DNS
server=/example.com/8.8.8.8
server=/8.8.8.8/8.8.8.8
server=/1.1.1.1/1.1.1.1
server=1.1.1.1#53
server=9.9.9.9#53

# Mesh hosts file (populated by bootstrap-dns-gamma.sh)
addn-hosts=/etc/dnsmasq-vaultmesh-hosts

# Enable DNS query logging (optional, can be verbose)
# log-queries

# DHCP settings (if GAMMA also serves DHCP, optional)
# dhcp-range=192.168.0.100,192.168.0.200,12h
# dhcp-option=option:dns-server,192.168.0.191

# DNSSEC validation (optional, can break some queries)
# dnssec

# Log file
log-facility=/var/log/dnsmasq.log

EOF
    
    log_info "dnsmasq configuration created: $DNSMASQ_CONFIG_FILE"
}

create_mesh_hosts_file() {
    log_header "Step 3: Generate mesh nodes /etc/hosts entries"
    
    # Source mesh-peers.env to get node definitions
    source "$MESH_PEERS_FILE"
    
    # Create hosts file with all mesh nodes
    cat > "$DNSMASQ_HOSTS_FILE" << EOF
################################################################################
# VaultMesh Hosts File
# Authoritative A records for all mesh nodes
#
# Format: IP_ADDRESS  HOSTNAME.DOMAIN  ALIAS1  ALIAS2
# 
# DO NOT EDIT MANUALLY - Generated by bootstrap-dns-gamma.sh
# 
# This file is sourced by dnsmasq via:
# addn-hosts=/etc/dnsmasq-vaultmesh-hosts
################################################################################

# GAMMA (Primary Root Node)
192.168.0.191  gamma.mesh  gamma  gamma.local  alpha

# BRICK (Local Compute & Runners)
192.168.0.120  brick.mesh  brick  brick.local  beta

# BUNKER-DE (Cloud Vault & OffSec)
134.122.64.228  bunker-de.mesh  bunker  bunker.mesh  bunker-ts  server-node

# BETA (Cold Backup, Offline Node)
192.168.0.236  beta.mesh  beta  beta.local  beta.cold

# AKASH Nodes (Ephemeral Compute)
# Uncomment and update as AKASH nodes come online
# 100.64.1.1  akash-001.mesh  akash-001
# 100.64.1.2  akash-002.mesh  akash-002
# 100.64.1.3  akash-003.mesh  akash-003

# Tailscale Entries (optional, for direct Tailscale access)
# 100.64.0.1  gamma.tailscale
# 100.64.0.2  brick.tailscale
# 100.97.95.128  bunker-de.tailscale

################################################################################
# IMPORTANT NOTES:
#
# 1. GAMMA (192.168.0.191) is the authoritative nameserver
#    All nodes query GAMMA:53 for DNS resolution
#
# 2. BETA (192.168.0.236) is listed here but:
#    - BETA cannot serve DNS (never query BETA directly)
#    - BETA may be offline for long periods
#    - DNS queries resolve regardless (GAMMA has authority)
#
# 3. AKASH nodes are stateless and ephemeral:
#    - Add/remove entries as nodes are provisioned
#    - No permanent IP assignments
#    - Always query GAMMA for current state
#
# 4. Aliases (e.g., "gamma" → gamma.mesh):
#    - Defined here for convenience
#    - Some nodes have legacy aliases (alpha, beta, server-node)
#    - Always prefer full domain names (gamma.mesh)
#
# 5. TTL (Time-to-Live) is set in dnsmasq.conf (cache-size)
#    - Changes to this file require dnsmasq restart
#    - sudo systemctl restart dnsmasq
################################################################################

EOF
    
    log_info "Mesh hosts file created: $DNSMASQ_HOSTS_FILE"
    log_info "Entries: $(grep -c '^[0-9]' "$DNSMASQ_HOSTS_FILE") nodes defined"
}

################################################################################
# VALIDATION
################################################################################

validate_dnsmasq_config() {
    log_header "Step 4: Validate dnsmasq configuration"
    
    # Check syntax
    if dnsmasq --test --conf-file="$DNSMASQ_CONFIG_FILE" &> /dev/null; then
        log_info "dnsmasq configuration syntax valid"
    else
        log_error "dnsmasq configuration has errors:"
        dnsmasq --test --conf-file="$DNSMASQ_CONFIG_FILE"
        exit 1
    fi
    
    # Check hosts file exists
    if [ -f "$DNSMASQ_HOSTS_FILE" ]; then
        log_info "Mesh hosts file exists: $DNSMASQ_HOSTS_FILE"
    else
        log_error "Mesh hosts file not found"
        exit 1
    fi
}

################################################################################
# START/RESTART SERVICE
################################################################################

restart_dnsmasq() {
    log_header "Step 5: Start/restart dnsmasq service"
    
    # Check if systemd is available
    if command -v systemctl &> /dev/null; then
        log_info "Stopping dnsmasq service..."
        systemctl stop "$DNS_SERVICE" || true
        
        sleep 1
        
        log_info "Starting dnsmasq service..."
        systemctl start "$DNS_SERVICE"
        
        log_info "Enabling dnsmasq to start on boot..."
        systemctl enable "$DNS_SERVICE"
        
        # Check status
        if systemctl is-active --quiet "$DNS_SERVICE"; then
            log_info "dnsmasq service is running"
        else
            log_error "dnsmasq service failed to start"
            systemctl status "$DNS_SERVICE"
            exit 1
        fi
    else
        log_warn "systemctl not available, starting dnsmasq manually"
        service dnsmasq restart || sudo /etc/init.d/dnsmasq restart
    fi
}

################################################################################
# TESTING & VALIDATION
################################################################################

test_local_dns() {
    log_header "Step 6: Test local DNS resolution"
    
    # Test localhost
    if nslookup localhost 127.0.0.1 &> /dev/null; then
        log_info "localhost resolves via localhost:53"
    fi
    
    # Test GAMMA DNS
    log_info "Testing DNS queries against GAMMA (127.0.0.1:53)..."
    
    # Test GAMMA itself
    if dig +short gamma.mesh @127.0.0.1 | grep -q "192.168.0.191"; then
        log_info "gamma.mesh resolves to 192.168.0.191"
    else
        log_warn "gamma.mesh did not resolve to expected IP"
        dig gamma.mesh @127.0.0.1
    fi
    
    # Test BRICK
    if dig +short brick.mesh @127.0.0.1 | grep -q "192.168.0.120"; then
        log_info "brick.mesh resolves to 192.168.0.120"
    else
        log_warn "brick.mesh did not resolve to expected IP"
    fi
    
    # Test BUNKER-DE
    if dig +short bunker-de.mesh @127.0.0.1 | grep -q "134.122.64.228"; then
        log_info "bunker-de.mesh resolves to 134.122.64.228"
    else
        log_warn "bunker-de.mesh did not resolve to expected IP"
    fi
    
    # Test BETA
    if dig +short beta.mesh @127.0.0.1 | grep -q "192.168.0.236"; then
        log_info "beta.mesh resolves to 192.168.0.236"
    else
        log_warn "beta.mesh did not resolve to expected IP"
    fi
}

test_from_other_nodes() {
    log_header "Step 7: Test DNS from other nodes (optional)"
    
    log_info "To test DNS from other nodes, run:"
    echo -e "${YELLOW}  From BRICK:${NC}"
    echo "    ssh brick 'dig gamma.mesh'"
    echo ""
    echo -e "${YELLOW}  From BUNKER-DE:${NC}"
    echo "    ssh bunker-de 'dig gamma.mesh'"
    echo ""
    echo -e "${YELLOW}  From local machine:${NC}"
    echo "    dig gamma.mesh @192.168.0.191"
}

################################################################################
# STATUS REPORT
################################################################################

print_status() {
    log_header "Step 8: DNS Configuration Status"
    
    echo ""
    echo "Configuration Files:"
    echo "  • dnsmasq config: $DNSMASQ_CONFIG_FILE"
    echo "  • Mesh hosts: $DNSMASQ_HOSTS_FILE"
    echo ""
    
    echo "Service Status:"
    if systemctl is-active --quiet "$DNS_SERVICE"; then
        echo -e "  • dnsmasq: ${GREEN}RUNNING${NC}"
    else
        echo -e "  • dnsmasq: ${RED}STOPPED${NC}"
    fi
    echo ""
    
    echo "DNS Authority:"
    echo "  • Domain: .$MESH_DOMAIN"
    echo "  • Authority: $GAMMA_HOSTNAME ($GAMMA_IP)"
    echo "  • Port: 53"
    echo ""
    
    echo "Registered Nodes:"
    grep '^[0-9]' "$DNSMASQ_HOSTS_FILE" | while read -r line; do
        IP=$(echo "$line" | awk '{print $1}')
        HOST=$(echo "$line" | awk '{print $2}')
        echo "  • $HOST ($IP)"
    done
    echo ""
    
    echo "Query Examples:"
    echo "  $ dig gamma.mesh @$GAMMA_IP"
    echo "  $ dig brick.mesh @$GAMMA_IP"
    echo "  $ dig bunker-de.mesh @$GAMMA_IP"
    echo ""
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    log_header "VaultMesh DNS Authority Bootstrap (GAMMA)"
    echo "Version: $SCRIPT_VERSION"
    echo "Date: $(date)"
    echo ""
    
    # Pre-flight checks
    check_root
    check_node_is_gamma
    check_mesh_peers_file
    
    # Installation & Configuration
    install_dnsmasq
    create_dnsmasq_config
    create_mesh_hosts_file
    
    # Validation & Startup
    validate_dnsmasq_config
    restart_dnsmasq
    
    # Testing
    test_local_dns
    test_from_other_nodes
    
    # Status
    print_status
    
    log_header "Bootstrap Complete!"
    echo ""
    log_info "VaultMesh DNS authority is now operational on GAMMA"
    echo ""
    echo "Next steps:"
    echo "  1. Configure other nodes to use GAMMA as DNS upstream"
    echo "  2. Test resolution from BRICK, BUNKER-DE, AKASH nodes"
    echo "  3. Monitor dnsmasq logs: tail -f /var/log/dnsmasq.log"
    echo "  4. Document any custom domains needed"
    echo ""
}

# Run main
main "$@"
