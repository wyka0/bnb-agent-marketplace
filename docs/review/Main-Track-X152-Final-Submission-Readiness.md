# X.152 Final Submission Readiness

**Mode:** Preparation/audit only. **ZERO blockchain transactions, zero new jobs/wallets, zero seller registration/endpoint-update transactions, zero Hire transactions, zero AWS/KMS, zero private keys, zero production secrets.** No deployment, no commit, no push.

**Git boundary:** `HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` (unchanged).

---

## EXECUTIVE STATUS

| Area            | Status                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Marketplace** | **READY** (source + all routes + tests green)                                                            |
| **Seller**      | **OPERATOR ACTION REQUIRED** (deployment package prepared; durable host needed)                          |
| **Production**  | **OPERATOR ACTION REQUIRED** (live deployment is stale; Vercel credentials needed)                       |
| **Hire**        | **IMPLEMENTED** (not LIVE — gated by seller host + deployment + X.148 broadcast-infrastructure behavior) |

## PART A — Final source audit

`git status` (93 paths), `git rev-parse HEAD` = `origin/main` = `850454da…`. X.149 source present and verified (paths confirmed via glob; the mandate's `packages/integrations/…/main-track-user-hire.ts` actually lives at `apps/web/lib/activation/main-track-user-hire.ts`):

- `apps/web/lib/activation/main-track-hire.api.ts` ✓
- `apps/web/app/api/activation/main-track-hire/route.ts` ✓
- `apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx` ✓
- `apps/web/lib/activation/main-track-user-hire.ts` ✓
- `packages/integrations/src/altana/v2/main-track-user-wallet.ts` ✓

Browser Hire uses `eth_requestAccounts` / `eth_chainId` / `eth_sendTransaction`; the browser path does **not** use `eth_sendRawTransaction`; the server never receives/handles the browser user's private key (verified by source scan and harness invariants).

## PART B — Seller deployment package

Created (deployment-related only, seller stays isolated in `services/v2-seller/`):

- `Dockerfile` — Node 20 + pnpm + tsx, ESM `seller.ts`, Keystore mounted (never baked in), no framework.
- `.dockerignore` — excludes node_modules, `.env*`, `.agent-data`, logs, tooling scripts.
- `.env.example` — KEY NAMES only (no secret values).
- `README.md` — routes, env, build/run, read-only post-deploy verification.
- `seller.ts` `/health` now also returns the safe public `seller` address (chain 97).

Runtime env: `WALLET_PASSWORD` (secret), `NETWORK=bsc-testnet`, `ERC8183_SERVICE_PRICE=1000000000000000000`, `ERC8183_AGENT_URL=<durable HTTPS URL>`. `PRIVATE_KEY` is only for first-run Keystore creation and must be absent afterwards; nothing prints `PRIVATE_KEY`/`WALLET_PASSWORD`/keystore/mnemonic/seed.

Public routes: `GET /health`, `GET /.well-known/agent-card.json`, `POST /negotiate`; all else 404. No filesystem exposure, traversal, arbitrary proxy, generic RPC forwarding, environment/signing/debug/private-key endpoints. The agent card endpoint is environment-configured (`ERC8183_AGENT_URL`), never hardcoded to `trycloudflare.com`. `POST /negotiate` returns the verified quote (`accepted`, `price=1 U`, `chain_id=97`, official commerce `verifying_contract`, `negotiation_hash`, `provider_sig`) and `verifyQuoteSignature` verifies signer == seller `0xB0f768…`, expiry > now (proven live in X.125/X.130).

## PART C — Deployment options audit

No existing deployment mechanism found: no Vercel CLI, no `VERCEL_TOKEN`, no deployment scripts, no Docker host tooling, no VPS, no domain, no persistent Cloudflare config, no CI/CD deploy step. **SELLER HOST = OPERATOR ACTION REQUIRED** (provision a durable HTTPS host using the prepared package; nothing was invented or pretended deployed).

## PART D — Vercel production

Live production (`https://bnb-agent-marketplace-web.vercel.app`) is **stale**: it does **not** contain `/api/activation/main-track-hire` (live 404), while the source contains it with `prepare`/`receipt`/`verify` actions. No authorized deployment credentials exist → **VERCEL DEPLOYMENT = OPERATOR ACTION REQUIRED** (deploy current repository HEAD via the existing authorized Vercel mechanism). No AWS involved.

## PART E — Agent 1906 update

- Agent ID 1906; owner == seller `0xB0f7681668f916eEd97dA066D31aA295D34727c0`; chain 97.
- **OLD ENDPOINT:** `https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json` (expired).
- **NEW ENDPOINT:** **NOT AVAILABLE** (requires the durable seller host from PART C; not fabricated).
- **TRANSACTION REQUIRED:** one `ERC8004Agent.registerAgent(agentUri)` on chain 97, seller-signed, with `AgentEndpoint.a2a("<durable-url>", { capabilities: ["erc8183-negotiate"] })`.
- **ESTIMATED GAS:** ~621,926 (historical X.124 registration) — safe estimate; **NOT broadcast**.

## PART F — Main Track Hire

Model B (`model-b-v2-commercial-agreement`) remains the commercial Hire architecture; `resource`/`executionCapability` is NOT restored as a mandatory gate (no authoritative rubric requirement is claimed). User flow (Agent Detail → Hire → confirmation → wallet connection → quote verification → transaction preview → `eth_sendTransaction` → receipt verification → on-chain verification → `funded-commercial-hire`) is implemented and fail-closed; never claims ACTIVE without an actual supported session; no server-held buyer key, no AWS/KMS.

## PART G — Four categories (equal treatment)

`/categories/{rebalancing,grid-trading,yield,health-factor}` — each with a category landing (equal-depth `CategoryDashboard`), registry agent cards, agent detail, real sourced metadata, freshness labels, comparison support, and the Hire CTA with an honest availability state. No category is an afterthought.

## PART H — Judge walkthrough (read-only)

Land → Marketplace → select category → discover agent → open Agent Detail → understand service → review data (registry + TermiX + PancakeSwap, all sourced) → compare → click Hire → review price (1 U) → review the confirmation (Agent/Seller/token/chain/what-will-happen/wallet/expiry/cancellation) → wallet connection boundary (`eth_sendTransaction`, wallet-owned) → transaction boundary (5-step ERC-8183 with per-step receipt verification) → fail-closed behavior (reject → cancelled; failure → stop; never ACTIVE). Nothing broadcast.

## PART I — Data quality

Every dynamic field is classified: registry fields **LIVE/VERIFIED** (ERC-8004); anything without an authoritative source renders **UNKNOWN/STALE/pending** (em-dash/Pending chip); TermiX and PancakeSwap are read-only with explicit source labels and honest unavailable states. No invented performance, APR, trading results, or successful-production-Hire claims (only independently verified evidence is claimed).

## PART J — Security

`git grep` found **no committed secret values** — only key-name references in `.env.example` and negative test assertions. `.gitignore` covers `.env`, `.env.*`, `!.env.example`, `.env*.local`, `*.log`, `.vercel`; added `services/v2-seller/.agent-data/` (seller local storage) to the ignore list. No keystores or cloudflared credentials are in the repo; the seller Keystore stays outside Git and outside Vercel.

## PART K — Build / tests (all green)

Web: typecheck PASS · lint PASS · `next build` **Compiled successfully** (34.8s). Integrations: typecheck PASS · lint PASS · build PASS. Seller: typecheck PASS. Prettier clean.
Suites: activation (33) · hire (23/23) · hire-api (14) · capability-source · main-track-hire (X.130) · main-track-user-wallet (X.139/X.134/X.137/X.142/X.144/X.146) · main-track-v2 (X.131) · main-track-user-hire (X.149) · hire-adapter (X.127) · ERC-8183 — all pass.

## Real on-chain evidence (documented, not overclaimed)

- **Job 622 — COMPLETED:** real full path (negotiate → createJob → registerJob → setBudget → approve → fund → submit → settle) by the buyer wallet. Evidence: X.126B/X.126C reports.
- **Job 641 — FUNDED:** marketplace-client funded job. Evidence: X.130 report.
- Neither is presented as a **fresh production marketplace transaction** — they are historical testnet evidence.
- **Jobs 646–653:** stranded `OPEN`/`budget 0` test artifacts from the user-wallet attempts — documented as failed/stranded, **not** successful hires.

## ERC-8004

Agent 1906: owner `0xB0f7681668f916eEd97dA066D31aA295D34727c0`, chain 97; endpoint currently expired tunnel (PART E); required update documented, not broadcast.

## Main Track rubric

- **Functionality:** discover → understand → activate (implemented; Model B commercial Hire).
- **Data Quality:** accurate, freshness-aware, honest (PART I).
- **Agent Diversity:** all four categories equally represented (PART G).
- `resource`/`executionCapability` is **not** claimed as an official Main Track requirement.

## Altana

ERC-8004 identity, ERC-8183 negotiation, provider signature, Job 622 completed, Job 641 funded, user-controlled wallet architecture, no server-held buyer key — all documented. **No session-key production deployment is claimed** (not present).

## TermiX

`docs/termix/Agent-Advantage-Report.md` **exists** with real measurements (dated 2026-08-16, evidence under `docs/termix/evidence/`; harness `apps/web/lib/termix/advantage-harness.ts`). **Not** a submission-documentation blocker.

## PancakeSwap

Read-only integration — **implemented, verified, production-live** (present in the deployed site), driven by on-chain reserves + official prices; not blocked by external API credentials. Read-only disclosure maintained; no swaps/LP transactions claimed.

## GIT

`HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0`; working tree 93 paths (reports + X.131/X.149 code + seller deployment package). No `.env`, keystore, wallet, password, cloudflare-credential, or log file staged; no commit, no push, no deploy.

## Final classification

**B — OPERATOR DEPLOYMENT REQUIRED.**

The marketplace is submission-ready in source (full functionality, honest data quality, four equal categories, Hire implemented + fail-closed, no fake ACTIVE, no secret leakage, builds/tests green). The only remaining steps are **operator provisioning**, not engineering: (1) durable seller host (deployment package provided in `services/v2-seller/`), (2) Agent 1906 endpoint re-point (prepared, ~622k gas, not broadcast), (3) deploy current HEAD via the authorized Vercel mechanism (credentials needed). Per the mandate, an operator-credential gap is **not** downgraded into an engineering failure. **STOP.**
