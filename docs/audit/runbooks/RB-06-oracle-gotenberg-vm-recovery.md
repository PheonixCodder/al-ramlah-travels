# RB-06 — Oracle Cloud ARM64 Gotenberg v8 + Caddy Microservice Recovery

**Owner**: Infrastructure Operations (`super_admin`)  
**Target Host (`OD-07`)**: Oracle Cloud Infrastructure (OCI) **Pay-As-You-Go (PAYG) Always Free** `VM.Standard.A1.Flex` (`aarch64` Ubuntu 24.04 LTS, `3–4 OCPU` / `12–16 GB RAM`, `$0.00/mo` with `$1.00` OCI Budget Alert — immune to 7-day Free-Tier idle reclamation)  
**Deployment Bundle**: `../scripts/oracle-gotenberg/` (`docker-compose.yml`, `Caddyfile`, `setup-oracle-arm.sh`)  
**Client Adapter**: `lib/posters/gotenberg.ts` (`GOTENBERG_API_URL=https://pdf.alramlahtravels.com`, `GOTENBERG_API_KEY`)

> [!IMPORTANT]
> Local headless Chrome (`lib/posters/chromium-cdp.ts` with `--no-sandbox`) is **permanently blocked** when `NODE_ENV=production` (`T-015`). All production 3-Page Quotation PDFs (`/forms/chromium/convert/html`) and 4K Studio Package Posters (`/forms/chromium/screenshot/html`) render exclusively on this hardened Gotenberg `8.17.0` microservice.

---

## 1. Health, TLS & Authentication Diagnostics

Run all three external probes from any workstation before SSHing into the VM:

```bash
# 1. Public Caddy -> Gotenberg shallow health check (Expected: HTTP 200 {"status":"up",...})
curl -i -sS --max-time 5 https://pdf.alramlahtravels.com/health

# 2. Fail-closed auth gate verification (Expected: HTTP 401 Unauthorized)
curl -i -sS -X POST https://pdf.alramlahtravels.com/forms/chromium/convert/html

# 3. Authenticated X-Gotenberg-Api-Key + Bearer PDF smoke render (Expected: HTTP 200 + %PDF-1. header)
printf '<!doctype html><html><body><h1>Al Ramlah Health Probe</h1></body></html>' > /tmp/probe.html
curl -fsS -X POST "https://pdf.alramlahtravels.com/forms/chromium/convert/html" \
  -H "X-Gotenberg-Api-Key: ${GOTENBERG_API_KEY}" \
  -H "Authorization: Bearer ${GOTENBERG_API_KEY}" \
  -H "Gotenberg-Trace: ops-smoke-probe" \
  -F "files=@/tmp/probe.html;filename=index.html" \
  -o /tmp/probe.pdf && head -c 8 /tmp/probe.pdf && echo ""
rm -f /tmp/probe.html /tmp/probe.pdf
```

### Interpreting Probe Results
- **Connection timeout on Probe 1**: OCI VM stopped, VCN Security List / `iptables` blocking TCP `443`, or Docker daemon down -> go to **Section 2**.
- **TLS / ACME error on Probe 1**: Ensure Cloudflare DNS record for `pdf.alramlahtravels.com` is set to **DNS Only (Gray Cloud)** or Cloudflare Full (Strict) TLS so Caddy (`caddy:2.9-alpine`) can renew Let's Encrypt certificates on TCP `80`/`443`.
- **Probe 1 = `200`, Probe 3 = `401`**: `GOTENBERG_API_KEY` mismatch between Vercel/Trigger.dev and `~/gotenberg/.env` -> rotate/sync per **RB-03 §4.1**.
- **Probe 3 = `503` / `504`**: Chromium queue saturation or hung render -> restart containers in **Section 2** and inspect concurrency in **Section 4**.

---

## 2. Systemd, Docker Compose & Full VM Bootstrap Recovery

### 2.1 Fast Container Restart (`< 20 seconds`)
```bash
ssh ubuntu@<ORACLE_VM_IP>
cd ~/gotenberg
sudo docker compose ps
sudo docker compose logs --tail=80 gotenberg caddy
sudo systemctl restart docker
sudo docker compose up -d --force-recreate --remove-orphans
sudo docker inspect --format='{{json .State.Health}}' gotenberg
```

### 2.2 Full Idempotent Host Re-Bootstrap (`setup-oracle-arm.sh`)
If the OCI VM was recreated from a fresh Ubuntu 24.04 ARM64 image:
```bash
# From repo root on workstation:
scp -r ./scripts/oracle-gotenberg ubuntu@<NEW_ORACLE_VM_IP>:~/gotenberg

# On the Oracle VM:
ssh ubuntu@<NEW_ORACLE_VM_IP>
cd ~/gotenberg
chmod +x setup-oracle-arm.sh
sudo ./setup-oracle-arm.sh
sudo grep '^GOTENBERG_API_KEY=' ~/gotenberg/.env
```
Update the DNS `A` record for `pdf.alramlahtravels.com` if the public IP changed, and sync `GOTENBERG_API_KEY` to Vercel Pro and Trigger.dev Cloud if a new `.env` was generated.

---

## 3. Arabic, Nastaliq Urdu & Brand Font Verification (`OD-08`, `T-051`)

Quotation PDFs (`lib/posters/render-quotation-pdf.ts`) and Studio Posters require Arabic (`Noto Naskh Arabic` / `Amiri`), Urdu (`Noto Nastaliq Urdu`), and `Inter` fonts mounted from `/usr/share/fonts:/usr/local/share/fonts/host-fonts:ro`. If sacred Arabic headings or Urdu pilgrim notes render as tofu boxes (`□□□`):

```bash
ssh ubuntu@<ORACLE_VM_IP>
# 1. Verify host font packages are installed and cached
sudo apt-get update && sudo apt-get install -y \
  fontconfig fonts-noto-core fonts-noto-extra fonts-hosny-amiri fonts-noto-color-emoji fonts-inter
sudo fc-cache -f -v

# 2. Restart Gotenberg and verify fonts are visible inside the container
cd ~/gotenberg && sudo docker compose restart gotenberg
sudo docker exec gotenberg fc-list :lang=ar | head -n 10
sudo docker exec gotenberg fc-list :lang=ur | head -n 10
```

---

## 4. Memory Caps, Queue Alignment & SSRF Lockdown Reference

Never weaken the security or memory flags in `scripts/oracle-gotenberg/docker-compose.yml` (`T-051`):

| Guardrail | Configured Value | Operational Purpose |
| :--- | :--- | :--- |
| **Container Memory & SHM** | `mem_limit: 6g`, `memswap_limit: 6g`, `shm_size: 512m`, `cpus: 3.0` | Prevents 4K Chromium canvas renders from OOM-killing the host kernel or overflowing `/dev/shm`. |
| **Chromium Concurrency & Recycling** | `--chromium-max-concurrency=2`, `--chromium-restart-after=25`, `--api-timeout=35s` | Matches `gotenbergQueue` (`concurrencyLimit: 2` in `trigger/queues.ts`) and `renderBatchViaGotenberg` (`concurrency: 2`), recycling Chromium every 25 renders to eliminate memory leaks. |
| **Compressed Brand Logos (`T-013`)** | `public/logo-icon.png` (`<40 KB`), `public/logo.jpg` (`<80 KB`), Caddy `max_size 20MB` | Keeps HTML data-URI payloads `<200 KB` (down from `42.5 MB`). |
| **Script & SSRF Lockdown** | `--chromium-disable-javascript=true`, `--chromium-allow-list=^data:\|^https://`, `--chromium-deny-list` (`169.254.169.254`, `localhost`, `127/8`, RFC1918, IPv6 loopback/ULA) + `gotenberg_internal` (`internal: true`) | Physically blocks Gotenberg from executing `<script>` tags, reading `file://`, or reaching OCI Instance Metadata Service (`169.254.169.254`) and internal networks. |
