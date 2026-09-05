# X.153 Vercel Production Deployment + Seller Hosting Recheck

**Mode:** Authorized deployment of the CURRENT marketplace to the existing Vercel project + seller hosting recheck. **ZERO blockchain transactions, zero new jobs/wallets, zero Agent 1906 update transaction, zero Hire transaction, zero AWS/KMS, zero private keys migrated, no seller private key in Vercel, no keystore in the repo.** No commit, no push (deployment was performed via the Vercel CLI, not git).

---

## VERCEL

- **Authentication status:** authenticated (`npx vercel whoami` → `wyka0`).
- **Project:** existing `bnb-agent-marketplace-web` (`prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE` / `team_87sELDtq8WMlh52qkmDNmEAV`) — reused, no second project created. Root/`apps/web` `.vercel/project.json` both point to it; project uses app-root monorepo settings (`rootDirectory = apps/web`, framework `nextjs`, build command in the repo `vercel.json`).
- **Deployment:** READY — `dpl_7HuNz3zn3EbDksAJzEjLBWjYhZCE`, URL `https://bnb-agent-marketplace-llwynp1gx-solo-25cb.vercel.app`, `target: production`; production alias `https://bnb-agent-marketplace-web.vercel.app`.
- **Deployed commit:** current working tree at `HEAD = 850454da…` including the uncommitted X.131–X.152 changes (deployed from the live tree, not an older commit; the live bundle demonstrably contains the new Hire route + headers).
- **Build status:** web typecheck PASS · lint PASS · `next build` Compiled successfully; integrations typecheck/lint/build PASS.
- **Production routes (all live, 200):** `/`, `/marketplace`, `/agents`, `/compare`, `/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor`.
- **Hire route:** `/api/activation/main-track-hire` is **no longer 404** (GET → 405 = route exists); POST is fail-closed (`request-rejected` without a safe request/CSRF).
- **Note (honest):** `/agents` currently renders the honest empty state ("No agents") because the 8004scan registry feed returns no rows right now; the chain-97 Agent 1906 detail page 404s because that record is not surfaced by the list lookup. The marketplace is deployed and honest but the live registry feed currently surfaces no agent cards.

## SELLER

- **Vercel suitability: NOT SUITABLE FOR VERCEL.** The seller (`services/v2-seller/seller.ts`) is an isolated `node:http` service (fixed port 3000) that requires a mounted encrypted Keystore V3, local `.agent-data` storage, and a long-lived funded-job watcher — none of which fit Vercel's serverless, ephemeral-filesystem, per-request function model. Hosting it on Vercel would force the keystore/private key into the deployment, which is forbidden. **SELLER HOST = OPERATOR ACTION REQUIRED** (durable VM/VPS via the X.152 Docker package; the keystore stays local to the seller; `WALLET_PASSWORD` is a runtime secret, never in source/Vercel).
- **Endpoint status:** not deployed anywhere durable (no host yet).
- **Keystore architecture:** encrypted Keystore V3 local to the seller service; never in Git, never in Vercel, never in a public artifact; no raw key ever exposed.
- **Security status:** no filesystem/env/signing/private-key endpoints; routes `/health` (now includes safe public `seller` address), `/.well-known/agent-card.json` (env-configured URL, no hardcoded tunnel), `POST /negotiate`; all else 404.

## AGENT 1906

- **Current endpoint:** `https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json` (expired ephemeral tunnel).
- **Required endpoint update:** one `ERC8004Agent.registerAgent(agentUri)` on chain 97, seller-signed, with `AgentEndpoint.a2a("<durable-url>", { capabilities: ["erc8183-negotiate"] })`. Estimated gas ~621,926 (historical X.124). **NEW ENDPOINT = NOT AVAILABLE** until the seller is hosted durably. **NOT broadcast.**

## HIRE

- **Production route:** LIVE (`/api/activation/main-track-hire`, actions `prepare`/`receipt`/`verify`; POST fail-closed; no server custody for these actions).
- **UI:** `MainTrackHireView` present in source and wired into `agent-detail-view.tsx` (chain-97 agents with an owner); the live chain-97 Hire CTA renders only when a chain-97 agent is surfaced by the registry feed (currently none surfaced).
- **Browser wallet:** `eth_requestAccounts` / `eth_chainId` / `eth_sendTransaction`; does **not** use `eth_sendRawTransaction`; the server never receives/handles the browser user's private key.
- **Model B:** `model-b-v2-commercial-agreement`; no `resource`/`executionCapability` gate; `funded-commercial-hire` is never shown as ACTIVE.
- **No server-held user key; no AWS; no KMS.**

## JUDGE

- Four categories live (200) and equal-depth in source (category landing, agent cards, detail, metadata, comparison, Hire CTA, honest availability).
- Discover → Understand → Compare → Hire → Confirm → user wallet: implemented in source; the live judge path currently shows the honest registry empty state for discovery, and the chain-97 Hire CTA is reachable only once the chain-97 agent is surfaced.
- No fake ACTIVE; `funded-commercial-hire` is clearly distinguished from ACTIVE.

## SECURITY

- Headers verified live on the new deployment: CSP (nonce + `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy.
- Source scan: no committed secret VALUES (only key-name env reads in the legacy Model-A altana-session path and negative test assertions); no `ALTANA_TESTNET_PRIVATE_KEY` in the production env; no AWS/KMS; no server-held user key; seller wallet isolated.

## TESTS

Web: typecheck/lint/`next build` PASS. Integrations: typecheck/lint/build PASS. Suites (green): activation (33) · hire (23/23) · hire-api (14) · capability-source · main-track-v2 (X.131) · main-track-user-hire (X.149) · main-track-user-wallet (X.139/X.134/X.137/X.142/X.144/X.146) · main-track-hire (X.130) · hire-adapter (X.127) · ERC-8183.

## GIT

`HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0`. Deployment performed via Vercel CLI from the working tree; **no commit, no push**. No `.env`/keystore/wallet/password/credential staged.

## Classification

**B — MARKETPLACE DEPLOYED + SELLER HOST REQUIRED.**

The marketplace is now **deployed to production** (all page routes live, security headers live, the `/api/activation/main-track-hire` route is no longer 404 and fail-closes correctly, Hire UI + Model B architecture are in the deployed source). The remaining gate for a live funded Hire is the **durable seller host** (Vercel is not suitable for the isolated keystore-backed seller service — a VM/VPS with the X.152 Docker package is required), followed by re-pointing Agent 1906 and the X.148-class broadcast-infrastructure behavior. The live registry feed currently surfaces no agent cards (honest empty state). Nothing was broadcast, committed, or pushed. **STOP.**
