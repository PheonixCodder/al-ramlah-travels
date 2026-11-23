# Oracle Cloud Always Free Gotenberg PDF & 4K Poster Microservice

Production-hardened deployment bundle for [Gotenberg 8.17](https://gotenberg.dev/) on **Oracle Cloud Infrastructure (OCI) Pay-As-You-Go (PAYG) Always Free** (`VM.Standard.A1.Flex` ARM64 / Ampere A1, Ubuntu 24.04 LTS) behind **Caddy 2.9** with automated Let's Encrypt TLS, bearer token authentication, Chromium SSRF lockdown, and Arabic/Urdu + Latin typography.

## Why Oracle Cloud PAYG Always Free (`$0.00 / month` Without Idle Reclamation)

Oracle Cloud Free-Tier trial/unverified accounts reclaim ARM64 VMs if CPU/network utilization drops below 20% over a 7-day window. To prevent unscheduled quotation/poster outages while keeping monthly spend at **`$0.00 / month`**:

1. **Upgrade Tenancy to Pay-As-You-Go (PAYG)** in the OCI Console (`Billing & Cost Management` → `Upgrade and Manage Payment`).
2. **Stay Strictly Inside Always Free Thresholds**:
   - **Compute**: `<= 4` Ampere A1 OCPUs and `<= 24 GB` RAM total across the tenancy (recommended: `3–4 OCPU` / `12–16 GB RAM` for `gotenberg-arm-prod`).
   - **Storage**: `<= 200 GB` total Block/Boot Volume (`50–100 GB` boot volume).
   - **Bandwidth**: `< 10 TB / month` outbound data transfer.
3. **Configure a `$1.00` OCI Budget Alert** (`Billing & Cost Management` → `Budgets`) targeting `100%` of `$1.00` forecasted spend so any accidental resource outside Always Free triggers an immediate alert.

---

## Security & Hardening Architecture

- **Pinned Image (`gotenberg/gotenberg:8.17.0`)**: Eliminates surprise breaking changes from floating `:8` tags.
- **Zero Chromium JavaScript (`--chromium-disable-javascript=true`)**: Prevents arbitrary script execution inside server-rendered HTML templates.
- **Defense-in-Depth SSRF & IMDS Protection**:
  - `--chromium-allow-list=^data:|^https://` blocks `http://`, `file://`, `ftp://`, and `ws://` subrequests.
  - `--chromium-deny-list` blocks Oracle/AWS IMDS (`169.254.169.254`), `localhost`, `127.0.0.0/8`, RFC1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and IPv6 loopback/ULA/link-local addresses.
  - `gotenberg_internal` Docker bridge sets `internal: true`, physically isolating Gotenberg from internet egress while Caddy terminates public TLS on `caddy_public`.
- **Fail-Closed Bearer & Header Auth**:
  - `docker-compose.yml` requires `${GOTENBERG_API_KEY:?...}` so Caddy refuses to boot with an empty secret.
  - `Caddyfile` enforces `Authorization: Bearer <token>` (or `X-Gotenberg-Api-Key: <token>`), caps request bodies at `20MB`, and strips credentials from structured stdout access logs.
- **Non-Swarm Resource Caps**: Enforces `mem_limit: 6g`, `cpus: 3.0`, `shm_size: 512m`, `--chromium-max-concurrency=2`, and `--chromium-restart-after=25` to prevent 4K Chromium canvas OOM crashes.
- **Haramain Arabic/Urdu & Brand Fonts**: `setup-oracle-arm.sh` installs `fonts-noto-core`, `fonts-noto-extra`, `fonts-hosny-amiri`, `fonts-noto-color-emoji`, and `fonts-inter` and mounts `/usr/share/fonts` read-only into Gotenberg.

---

## Bundle Contents

| File | Purpose |
| :--- | :--- |
| `./docker-compose.yml` | Hardened Gotenberg `8.17.0` + Caddy `2.9-alpine` stack with `internal: true` network isolation and resource caps. |
| `./Caddyfile` | TLS reverse proxy enforcing `Authorization: Bearer` / `X-Gotenberg-Api-Key`, `max_size 20MB`, and log header redaction. |
| `./.env.example` | Environment template for `GOTENBERG_DOMAIN` and `GOTENBERG_API_KEY`. |
| `./setup-oracle-arm.sh` | Idempotent ARM64 Ubuntu bootstrap: installs fonts, Docker, `iptables` rules, mode `0600` `.env`, and starts Compose without echoing secrets. |
| `./README.md` | Operations and PAYG Always Free deployment guide. |

---

## Deployment Steps

### 1. Provision OCI Ampere A1 Instance (PAYG Always Free)
1. Create an Ubuntu `24.04 LTS` (`aarch64`) instance using shape `VM.Standard.A1.Flex` (`3–4 OCPU`, `12–16 GB RAM`, `50–100 GB` boot volume) in a Public Subnet.
2. In your VCN Security List, allow inbound TCP ports **`80`** and **`443`** from `0.0.0.0/0` (never open port `3000`).
3. Create a DNS `A` record pointing `pdf.alramlahtravels.com` to the VM's public IPv4 address (Cloudflare **DNS Only / Gray Cloud** during initial ACME certificate issuance).

### 2. Copy Bundle & Run Bootstrap
From the repository root on your workstation:

```bash
scp -r ./scripts/oracle-gotenberg ubuntu@<YOUR_ORACLE_VM_PUBLIC_IP>:~/gotenberg
```

Then SSH into the VM and run the bootstrap script:

```bash
ssh ubuntu@<YOUR_ORACLE_VM_PUBLIC_IP>
cd ~/gotenberg
chmod +x setup-oracle-arm.sh
sudo ./setup-oracle-arm.sh
```

Retrieve the generated API key over SSH (it is intentionally never printed to installation stdout logs):

```bash
sudo grep '^GOTENBERG_API_KEY=' ~/gotenberg/.env
```

### 3. Verify Health, Auth Rejection & Rendering

```bash
# 1. Public health probe (HTTP 200)
curl -i https://pdf.alramlahtravels.com/health

# 2. Unauthenticated conversion rejected (HTTP 401 Unauthorized)
curl -i -X POST https://pdf.alramlahtravels.com/forms/chromium/convert/html

# 3. Authenticated PDF conversion (HTTP 200)
echo '<!doctype html><html><body><h1>Al Ramlah Travels</h1></body></html>' > test.html
curl -fsS -X POST "https://pdf.alramlahtravels.com/forms/chromium/convert/html" \
  -H "Authorization: Bearer <YOUR_GOTENBERG_API_KEY>" \
  -F "files=@test.html;filename=index.html" \
  -o test.pdf
```

### 4. Configure Vercel & Trigger.dev Cloud
Set both environment variables in Vercel (`Production`, `Preview`) and Trigger.dev Cloud (`Production`, `Staging`):

- `GOTENBERG_API_URL=https://pdf.alramlahtravels.com`
- `GOTENBERG_API_KEY=<64-char-hex-secret>`
