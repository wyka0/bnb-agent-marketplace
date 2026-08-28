# X.155 Durable Seller Hosting Without AWS

**Mode:** Seller hosting only. **STOPPED at the hosting gate** because no durable host/credentials exist in this environment (exactly as the mandate anticipates: "If no durable host exists, STOP and report exactly what operator credential/access is required"). **ZERO blockchain transactions, zero registerAgent/updateAgent, zero ERC-8183 jobs, zero new wallets, zero AWS/KMS, zero seller-key migration into Vercel.**

**Git boundary:** `HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` (unchanged; no commit/push).

---

## 1. Hosting provider

**NONE available.** Inspected and found no existing durable hosting mechanism:

- No VPS credentials / SSH access (`~/.ssh` contains only `known_hosts`; no private key, no SSH config).
- No Fly.io / Render / Railway / DigitalOcean / Hetzner CLI or authentication (no CLIs, no repo configs `fly.toml`/`render.yaml`/`railway.json`, no host tokens in env).
- No Docker host/CLI (`docker` not installed; the repo `docker-compose.yml` is **local dev infrastructure** — postgres/redis for the marketplace — not a seller host).
- No persistent Cloudflare tunnel (`~/.cloudflared` absent; only the ephemeral `trycloudflare` binary/URL used during development).
- No other hosting credentials.

Per the mandate, this portion **STOPS**. **Hosting credential/access required from the operator:** a durable HTTPS host — a VM/VPS with Docker (Node 20 + pnpm) **or** a PaaS account (Fly.io / Render / Railway) with CLI auth — capable of mounting the seller Keystore V3 securely (volume/secret) and holding `WALLET_PASSWORD` as a runtime secret.

## 2. Vercel must remain marketplace-only — confirmed

Verified via `vercel env ls production` (names only): production env contains only `DATABASE_URL`, `E8004SCAN_API_KEY`, `AUTH_CANONICAL_ORIGIN`, `RATE_LIMIT_BACKEND`, `PRISMA_QUERY_ENGINE_LIBRARY`. **No `WALLET_PASSWORD`, no seller private key, no Keystore, no seed/mnemonic** in Vercel. The seller is not deployed to Vercel and must not be. Unchanged.

## 3. Seller container

Validated `services/v2-seller/Dockerfile` + `.dockerignore`:

- The image COPYs only `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `seller.ts`. It does **not** contain a private key, Keystore, `WALLET_PASSWORD`, `.env`, `.env.local`, or `.agent-data`.
- `.dockerignore` excludes `node_modules`, `.agent-data`, `.env`, `.env.*` (except `.env.example`), `*.log`, the milestone tooling scripts (`x1*.mjs`, `x13*.mjs`, `x14*.mjs`, `x15*.mjs`), `.git`.
- The Keystore V3 is **mounted at runtime** (volume `/root/.bnbagent`); `WALLET_PASSWORD` is a runtime secret. `PRIVATE_KEY` is only for first-run Keystore creation and must be absent afterwards.

## 4. Durable host

Not deployable — no authorized durable host exists (see §1). The seller service is deployment-ready (Docker package) but there is nothing to deploy to.

## 5–9. Health / Agent Card / Negotiation / providerSig / persistence

**Not verifiable externally** — no durable host is online. The seller service's code path is unchanged and was proven live historically (X.125/X.130: `/health`, `/negotiate`, and `verifyQuoteSignature` → `valid:true`, `method:eip191`, signer == seller `0xB0f768…`, chain 97, price 1 U, expiry enforced). The current tunnel is expired, so no external endpoint responds today. Persistence/restart verification requires the host.

## 10. Security exposure audit

- Seller service routes are minimal and fail closed (only `GET /health`, `GET /.well-known/agent-card.json`, `POST /negotiate`, `GET /job/:id/response`; everything else → 404). No filesystem/env/signing/debug/proxy/private-key endpoints; no arbitrary proxying or generic RPC forwarding; no directory traversal.
- The container excludes all secrets (validated in §3), so the image cannot expose `.env`, keystore, or `WALLET_PASSWORD`.
- No host exists to probe common routes (`/.env`, `/wallet`, `/keystore`, `/debug`, `/admin`, `/proxy`) against; the code-level denial is confirmed.

## 11. HTTPS

No durable HTTPS URL exists. Only the ephemeral `*.trycloudflare.com` URL (expired) has ever been used; no `localhost`/LAN endpoint is claimed. **SELLER_URL = NOT AVAILABLE** until a durable host is provisioned.

## 12. Agent 1906 update

- **Agent ID:** 1906; owner == seller `0xB0f7681668f916eEd97dA066D31aA295D34727c0`; chain 97.
- **OLD endpoint:** `https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json` (expired).
- **NEW endpoint:** **NOT AVAILABLE** (no durable host yet).
- **registerAgent transaction still required:** YES — one `ERC8004Agent.registerAgent(agentUri)` on chain 97, seller-signed, with `AgentEndpoint.a2a("<durable-url>", { capabilities: ["erc8183-negotiate"] })`. Estimated gas ~621,926 (historical X.124). **NOT broadcast.**

## 13. Marketplace production

Unchanged and live (from X.153/X.154): `/marketplace`, four categories, Agent 1906 detail, Main Track Hire UI, `/api/activation/main-track-hire` (prepare/receipt/verify, fail-closed, no server custody). Model A / Model B / session-gate / capability-source / consent / custody / ERC-8183 logic untouched. The marketplace continues to **fail closed** for Hire until Agent 1906 points at a verified durable endpoint.

## 14. Production discovery

Agent 1906 remains discoverable in production with identity VERIFIED / chain 97 / owner VERIFIED / endpoint STALE. No "live" status is fabricated; it will only become healthy after the durable host + on-chain endpoint update.

## 15. Tests (all green)

Seller `tsc` PASS · integrations `tsc` + `build` PASS · web `tsc` PASS. Suites: main-track-user-hire (X.149) · main-track-v2 (X.131) · security x49 (25) · hire (23/23) · activation (33) · marketplace (84) · discovery (60) · main-track-user-wallet (X.139) · main-track-hire (X.130) · hire-adapter (X.127) · ERC-8183.

## 16. Git status

`HEAD`/`origin/main` = `850454da…` (unchanged). No new code changed in X.155 (the seller Docker package from X.152 stands). No `.env`/keystore/wallet/password/credential staged; no commit, no push.

## 17. Remaining blockers

1. **Durable seller host (operator action) — the X.155 blocker:** a durable HTTPS host with Docker/PaaS auth and a secure Keystore mount is required; then `SELLER_URL` becomes available, Agent 1906 can be re-pointed (one `registerAgent`, ~622k gas), and the marketplace can negotiate live.
2. **X.148-class broadcast infrastructure behavior (E)** — gating a live funded Hire, outside this milestone.

## Classification

**B — HOSTING CREDENTIAL REQUIRED.**

No durable hosting mechanism exists in this environment (no VPS/SSH, no Fly/Render/Railway/Docker/Cloudflare-persistent, no host tokens) — exactly the operator-credential case the mandate calls out, so this portion stops and reports precisely what is required. The seller container is validated secure (no secrets in image, Keystore mounted at runtime), Vercel remains marketplace-only with no seller secrets, the marketplace is live and fail-closed, and all tests pass. Nothing was deployed, broadcast, committed, or pushed. **STOP.**
