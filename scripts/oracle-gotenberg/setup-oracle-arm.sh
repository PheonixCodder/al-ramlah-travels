#!/usr/bin/env bash
# ==============================================================================
# Oracle Cloud Always Free (Ampere A1 ARM64) Hardened Gotenberg Bootstrap Script
# Target OS: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS (aarch64 / arm64)
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ------------------------------------------------------------------------------
# 1. Root / Sudo Privilege Elevation
# ------------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    log_info "Elevating privileges to root via sudo..."
    exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

log_info "Deploying hardened Gotenberg 8.17 microservice from: ${SCRIPT_DIR}"

# ------------------------------------------------------------------------------
# 2. Architecture & OS Verification
# ------------------------------------------------------------------------------
ARCH="$(uname -m)"
log_info "Detected system architecture: ${ARCH}"
if [[ "${ARCH}" != "aarch64" && "${ARCH}" != "arm64" ]]; then
    log_warn "Current architecture is '${ARCH}'. Oracle Always Free Ampere A1 runs 'aarch64'."
fi

if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    log_info "Detected Operating System: ${NAME} ${VERSION_ID}"
fi

# ------------------------------------------------------------------------------
# 3. Prerequisites, Typography (Arabic/Urdu + Inter) & Firewall Packages
# ------------------------------------------------------------------------------
log_info "Updating apt packages and installing base utilities + Haramain typography..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    fontconfig \
    fonts-hosny-amiri \
    fonts-inter \
    fonts-noto-color-emoji \
    fonts-noto-core \
    fonts-noto-extra \
    gnupg \
    iptables-persistent \
    lsb-release \
    netfilter-persistent \
    openssl

fc-cache -f -v >/dev/null 2>&1 || true
log_success "Installed Noto Arabic/Urdu, Amiri, Inter, and Noto Color Emoji fonts."

# ------------------------------------------------------------------------------
# 4. Oracle Cloud Host Firewall (iptables / netfilter-persistent / ufw)
# ------------------------------------------------------------------------------
log_info "Configuring host firewall for HTTP (80) and HTTPS (443)..."

if iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
    log_info "iptables TCP 80 rule already present."
else
    iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
fi

if iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
    log_info "iptables TCP 443 rule already present."
else
    iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
fi

netfilter-persistent save || true

if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw reload || true
    fi
fi
log_success "Host network firewall configured."

# ------------------------------------------------------------------------------
# 5. Official Docker Engine & Compose Plugin Installation
# ------------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    log_info "Docker not found. Installing official Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
    fi

    UBUNTU_CODENAME="${UBUNTU_CODENAME:-$(lsb_release -cs 2>/dev/null || echo "noble")}"
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      ${UBUNTU_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    log_success "Docker Engine and Compose plugin installed."
else
    log_info "Docker is already installed ($(docker --version))."
fi

systemctl enable --now docker

if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    usermod -aG docker "${SUDO_USER}" || true
fi

# ------------------------------------------------------------------------------
# 6. Environment (.env) Setup & Non-Echoing Cryptographic Key Generation
# ------------------------------------------------------------------------------
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
    log_info "Creating new .env file (mode 0600)..."
    umask 077
    RANDOM_KEY="$(openssl rand -hex 32)"
    cat <<EOF > "${ENV_FILE}"
# Auto-generated by setup-oracle-arm.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
GOTENBERG_DOMAIN=pdf.alramlahtravels.com
GOTENBERG_API_KEY=${RANDOM_KEY}
EOF
    chmod 600 "${ENV_FILE}"
    unset RANDOM_KEY
    log_success "Generated new .env with 64-character hex cryptographic API key (redacted from stdout)."
else
    chmod 600 "${ENV_FILE}"
    CURRENT_KEY="$(grep -E '^GOTENBERG_API_KEY=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)"
    if [[ -z "${CURRENT_KEY}" || "${CURRENT_KEY}" == "replace-with-64-char-hex-secret" ]]; then
        RANDOM_KEY="$(openssl rand -hex 32)"
        sed -i.bak -E "s|^GOTENBERG_API_KEY=.*|GOTENBERG_API_KEY=${RANDOM_KEY}|" "${ENV_FILE}"
        rm -f "${ENV_FILE}.bak"
        chmod 600 "${ENV_FILE}"
        unset RANDOM_KEY
        log_warn "Replaced placeholder GOTENBERG_API_KEY in .env (redacted from stdout)."
    fi
    unset CURRENT_KEY
fi

CONFIGURED_DOMAIN="$(grep -E '^GOTENBERG_DOMAIN=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "pdf.alramlahtravels.com")"

# ------------------------------------------------------------------------------
# 7. Start Gotenberg & Caddy Containers
# ------------------------------------------------------------------------------
log_info "Starting Gotenberg 8.17 and Caddy containers with Docker Compose..."
docker compose pull
docker compose up -d --remove-orphans

log_info "Waiting for Gotenberg container healthcheck to pass..."
MAX_RETRIES=25
COUNT=0
HEALTH="starting"

while [[ "${COUNT}" -lt "${MAX_RETRIES}" ]]; do
    HEALTH="$(docker inspect --format='{{json .State.Health.Status}}' gotenberg 2>/dev/null || echo '"unknown"')"
    if [[ "${HEALTH}" == '"healthy"' ]]; then
        break
    fi
    sleep 2
    COUNT=$((COUNT + 1))
    echo -n "."
done
echo ""

if [[ "${HEALTH}" == '"healthy"' ]]; then
    log_success "Gotenberg service is healthy!"
else
    log_warn "Gotenberg service health status: ${HEALTH}. Inspect with: docker compose logs"
fi

# ------------------------------------------------------------------------------
# 8. Retrieve Public IP & Display Redacted Deployment Summary
# ------------------------------------------------------------------------------
PUBLIC_IP="$(curl -s -4 --max-time 3 https://ifconfig.me 2>/dev/null || curl -s -4 --max-time 3 https://icanhazip.com 2>/dev/null || echo "YOUR_VM_PUBLIC_IP")"

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}       Oracle Cloud Always Free Gotenberg Microservice Deployed!              ${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "  ${CYAN}Public VM IPv4:${NC}        ${PUBLIC_IP}"
echo -e "  ${CYAN}Configured Domain:${NC}     ${CONFIGURED_DOMAIN}"
echo -e "  ${CYAN}API Key File:${NC}          ${ENV_FILE} (chmod 0600 — never echoed to terminal logs)"
echo ""
echo -e "${YELLOW}[CRITICAL NEXT STEPS]:${NC}"
echo -e "  1. ${CYAN}Ensure OCI Tenancy is on Pay-As-You-Go (PAYG) Always Free:${NC}"
echo -e "     Keep total allocation <= 4 Ampere A1 OCPUs, <= 24 GB RAM, <= 200 GB boot storage"
echo -e "     with an OCI \$1 Budget Alert so monthly cost stays \$0.00 with zero idle VM reclamation."
echo ""
echo -e "  2. ${CYAN}Retrieve API Key Safely Over Interactive SSH:${NC}"
echo -e "     ${GREEN}sudo grep '^GOTENBERG_API_KEY=' ${ENV_FILE}${NC}"
echo ""
echo -e "  3. ${CYAN}Verify Public Healthcheck (after DNS A-record points to ${PUBLIC_IP}):${NC}"
echo -e "     ${GREEN}curl -i https://${CONFIGURED_DOMAIN}/health${NC}"
echo ""
echo -e "  4. ${CYAN}Set Environment Variables in Vercel & Trigger.dev Cloud:${NC}"
echo -e "     GOTENBERG_API_URL=\"https://${CONFIGURED_DOMAIN}\""
echo -e "     GOTENBERG_API_KEY=\"<copy value from ${ENV_FILE}>\""
echo -e "${GREEN}==============================================================================${NC}"
