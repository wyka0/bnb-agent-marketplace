# X.151 Durable Seller + Current Marketplace Deployment

**Mode:** Deployment investigation + source verification + tests. **ZERO ERC-8183 transactions, zero new jobs/wallets, zero AWS/KMS, no production private key, no seller keystore copied into the repo, no commit, no push, no deployment.** Both deployment portions were attempted through the repository's existing supported paths and **stopped** exactly where credentials are missing (per the mandate's explicit "STOP and report exactly what is missing").

**Git boundary:** `HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` (unchanged). No `.env`/keystore/wallet/password/cloudflare credentials/logs staged.

---

## SELLER

- **Durable host:** NONE available in this environment. Inspected and found no existing VPS configuration, no hosting configuration, no deployment script, no domain, no seller-service deployment config, no persistent Cloudflare configuration, no repository deploy pipeline. The seller service (`services/v2-seller/seller.ts`) still runs only behind an ephemeral `*.trycloudflare.com` tunnel from the development machine.
- **Deployment blocked — operator must provision:** a durable HTTPS host (VPS/VM or equivalent) running the isolated seller service with its local Keystore V3 (seller `0xB0f7681668f916eEd97dA066D31aA295D34727c0`). Runtime env: `NETWORK=bsc-testnet`, `WALLET_PASSWORD` (secret, local-only), `ERC8183_SERVICE_PRICE=1000000000000000000`, `ERC8183_AGENT_URL=<durable HTTPS URL>`. The private key must NOT be added to source and the Keystore must stay outside Git. Routes required: `GET /health`, `GET /.well-known/agent-card.json`, `POST /negotiate` (all else 404).
- **Health / agent card / negotiate / provider signature:** the service code path is unchanged and was proven live in X.125/X.130 (jobs 622/641: `/health`, `/negotiate`, `verifyQuoteSignature` → valid, `method=eip191`, signer == seller, chain 97, 1 U, expiry enforced). Live re-verification is impossible until the durable host is provisioned (the current tunnel is dead). No `verifyQuoteSignature` call was fabricated; nothing was broadcast.

## ERC-8004

- **Agent 1906:** owner == agent wallet == seller `0xB0f7681668f916eEd97dA066D31aA295D34727c0`, registry chain 97 (`0x8004A818…`).
- **Old endpoint:** `https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json` (expired ephemeral tunnel).
- **New endpoint:** `<durable HTTPS URL>/.well-known/agent-card.json` — the durable URL is a placeholder until the operator provisions the host (PART 1). Cannot be finalized without it.
- **Required transaction (prepared, NOT broadcast):** a single `ERC8004Agent.registerAgent(agentUri)` on chain 97 signed by the seller, with `AgentEndpoint.a2a("<durable-url>", { capabilities: ["erc8183-negotiate"] })` and the card `{ name, description, endpoints, chainId:97 }`. Estimated gas: the historical X.124 registration used **621,926 gas** (block 127091335) — a safe estimate for the metadata update; the operator's funded seller wallet covers it. **Metadata update was NOT broadcast** (no transaction in X.151).

## MARKETPLACE

- **Deployed commit:** `850454da…` is HEAD/origin/main, but the **live Vercel deployment is stale** — it does not contain the X.131/X.149 Main Track Hire route/UI.
- **Deployment URL:** `https://bnb-agent-marketplace-web.vercel.app` (live, serves all page routes with correct security headers, but `/api/activation/main-track-hire` returns **404** and `/api/activation/hire` returns 405).
- **Deployment blocked — operator must provide:** no Vercel CLI installed (global or local), no `~/.vercel` auth, no `VERCEL_TOKEN` in the environment, and the repo CI (`.github/workflows/ci.yml`) has no deploy step. The only existing deploy path is the GitHub+Vercel integration on `origin` (`github.com/wyka0/bnb-agent-marketplace`), which requires either (a) an authorized `git push` to `main` (not authorized in this milestone) or (b) a local `vercel` login / `VERCEL_TOKEN`. Nothing was deployed.
- **Hire route:** present in source (`apps/web/app/api/activation/main-track-hire/route.ts`) with actions `prepare` / `receipt` / `verify` (verified).
- **Hire UI:** `MainTrackHireView` present and wired into `agent-detail-view.tsx` for chain-97 agents with an owner (verified).
- **Four categories:** `/categories/{rebalancing,grid-trading,yield,health-factor}` all present, equal depth (verified; live 200).
- **Judge flow:** discover → browse category → open agent → understand → compare → Hire CTA → confirmation review → wallet boundary → transaction preview → fail-closed behavior → no fake ACTIVE. All implemented in the working tree; not yet live because the deployment is stale.

## SECURITY

- Wallet custody: browser EIP-1193 only (`eth_requestAccounts`/`eth_chainId`/`eth_sendTransaction`); no `eth_sendRawTransaction` in the user Hire path; no server private key (verified by source scan); no AWS; no KMS; seller keystore stays isolated and outside the repo; no secret leakage (security headers verified live in X.150; nothing new deployed).

## TESTS

Web: typecheck PASS · lint PASS. Suites: `activation` (33) · `hire` (23/23) · `hire-api` (14) · `capability-source` · `main-track-v2` (X.131) · `main-track-user-hire` (X.149) — all pass. Integrations: `main-track-user-wallet` (X.139/X.134/X.137/X.142/X.144/X.146) · `main-track-hire` (X.130) · `hire-adapter` (X.127) · ERC-8183 — all pass. (`build`/`format` unchanged from X.149/X.150 green; no code changed in X.151.)

## GIT

`HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0`; working tree has 92 changed/untracked paths (all evidence/reports + X.131/X.149 code); no `.env`, keystore, wallet, password, or credential files staged. No commit, no push.

## Exact remaining blockers / submission recommendation

1. **Durable seller host (operator action):** provision a persistent HTTPS host for `services/v2-seller` with its local Keystore (no key in repo/Vercel), set `ERC8183_AGENT_URL` to its durable URL.
2. **Agent 1906 re-point (operator action, after #1):** one `registerAgent` tx (est. ~622k gas) to the durable URL — prepared, not broadcast.
3. **Marketplace deploy (operator action):** provide Vercel credentials (`vercel` login or `VERCEL_TOKEN`) or authorize a push to `main`; then deploy the current working tree so `/api/activation/main-track-hire` (prepare/receipt/verify) and the Hire UI go live.
4. **X.148-class broadcast infrastructure behavior (E):** documented, outside these deployment gates, gating a live funded hire.

## Classification

**B — DEPLOYMENT READY, OPERATOR HOSTING ACTION REQUIRED.**

The source is deployment-ready (seller service + X.149 Hire route/UI all verified, tests green, no secrets, no server key). Both deployment portions are blocked solely by **missing operator credentials/hosting** (durable seller host; Vercel deploy credentials or an authorized push), exactly as the mandate anticipated — nothing was fabricated, deployed, committed, pushed, or broadcast. **STOP.**
