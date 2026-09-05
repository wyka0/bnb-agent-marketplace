# BNB Agent Studio Marketplace — Technical Integration Specification

**Version:** 1.0 (Draft)
**Date:** 2026-08-08
**Audience:** Engineering team implementing the marketplace
**Supersedes:** None. Complements `PRD.md` (product blueprint) with the integration contract for external BNB-ecosystem services.
**Ground rule:** This specification only describes surfaces that are _documented_ in official or primary sources. Where documentation is absent, the section is explicitly marked **[UNKNOWN]** or **[ASSUMPTION]** and tracked in §15 Open Questions. No endpoint, field, or behavior is invented.

---

## 1. Executive Summary

The marketplace is a discovery → configure → hire → monitor platform for AI agents on BNB Chain. It does not invent its own agent registry or wallet stack; it composes four documented external systems:

| Layer                       | External system                                                    | Role in the marketplace                                                                      |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Agent registry              | **ERC-8004** (protocol) + **8004scan Builder Hub API**             | Discover/list/search agents, read stats, feedbacks, chains                                   |
| Agent custody & permissions | **Altana SDK / KeyStore**                                          | Agent wallets, scoped sessions, spend caps, expiry, revocation, x402 payments, ERC-8183 jobs |
| Payments                    | **x402 / B402** (Altana `@altananetwork/x402-server` + buyer side) | Pay-per-call access to agents; Studio buyers pay in `$U`                                     |
| DEX / yield data            | **PancakeSwap** (SDK, Universal Router + Permit2, subgraph APIs)   | Swap execution, LP pools, APR/yield intelligence                                             |

Plus two auxiliary systems: **BNB Agent Studio** (official product; its programmatic surface is largely undocumented in retrieved pages — see §3) and **TermiX bsc-mcp** (community MCP tool server for on-chain operations).

**Two significant corrections to the PRD surfaced during research:**

1. **"TERMIX Agent Advantage Report" (PRD FR-4xx) is not a documented capability.** The real repository `TermiX-official/bsc-mcp` (npm `bnbchain-mcp`) is a community-maintained MCP tool server for transfers, swaps, and token operations — it publishes no "human-vs-agent benchmark" reporting API. The PRD also wrote the name inconsistently ("TERMIX"/"TERMLEX"). **[ASSUMPTION]** The Advantage Report must be either (a) dropped, (b) rebuilt as a marketplace-computed comparison from our own performance snapshots, or (c) deferred pending confirmation from the TermiX team. Tracked as Open Question OQ-4.
2. **Agent Studio's own API is not publicly documented** in the pages retrieved (bnbchain.org product page and launch blog). What _is_ documented (via Altana's x402-server page) is that Studio agents use the `bag` CLI (`bag x402 trust`, `bag x402 buy`) and pay in `$U` over the eip3009 rail. The marketplace should therefore treat **8004scan + Altana as the integration surface**, and treat Studio as a UI/product brand rather than an API provider. See OQ-1.

---

## 2. System Architecture

```
┌────────────────────────── Marketplace (we own) ──────────────────────────┐
│                                                                         │
│  apps/web (Next.js) ── REST/WS ── API + worker (Node)                   │
│                                        │                                │
│                    packages/integrations (adapter layer)                │
│         ┌──────────────┬───────────────┬───────────────┬────────────┐   │
│         ▼              ▼               ▼               ▼            │   │
│  [8004scan]       [Altana SDK]    [PancakeSwap]    [bsc-mcp]   [BNB RPC] │
└─────────────────────────────────────────────────────────────────────────┘
         │                │               │               │          │
         ▼                ▼               ▼               ▼          ▼
  ERC-8004 registry   KeyStore (on-    Universal Router   MCP tool   BSC mainnet
  indexer (AltLayer)  chain, BNB/ETH/  + Permit2,         server     (chain 56)
                      Base)            subgraph APIs
  x402: $U eip3009 rail · permit2-exact rail · ERC-8183 job lifecycle
```

**Principles (fact, from sources):**

- **Registry truth is on-chain (ERC-8004); discovery truth is the 8004scan index.** The marketplace mirrors registry data locally for search/SEO, keyed by `(chainId, tokenId)`.
- **Wallet truth is on-chain KeyStore.** Altana is non-custodial: the agent acts from an agentic smart wallet; every permission lives in the KeyStore registry, "openly verifiable, revocable in one transaction, and accessible by any agent on any chain." (Altana SDK README)
- **Payments settle directly payer → payee on-chain**; the marketplace never custodies funds and never holds private keys.
- **Everything else (category tagging, curated metadata, badges, reviews) is marketplace-owned local state** — no documented registry API exposes it. **[ASSUMPTION]**

---

## 3. Official Data Sources

Status key: ✅ fetched & verified this session · ⚠️ fetched, content truncated / mostly navigation · 🔗 linked but not yet fetched · ❌ not documented anywhere retrieved.

| #   | Source                                      | URL                                                                                                                      | Access & limits                                     | Status                                                                              |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | BNB Chain — Agent Studio product page       | `bnbchain.org/bnb-agent-studio`                                                                                          | public web                                          | ⚠️ page exists; body content minimal in fetch                                       |
| 2   | BNB Chain blog — "BNB Agent Studio is live" | bnbchain.org blog                                                                                                        | public web                                          | ⚠️ announcement confirmed; details truncated                                        |
| 3   | 8004scan Builder Hub (developers)           | `8004scan.io/developers`                                                                                                 | public REST API, OpenAPI 3.0, CORS enabled          | ✅                                                                                  |
| 4   | 8004scan Agent Explorer                     | `8004scan.io/agents?chain=56`                                                                                            | public web                                          | ✅ (data shape captured; 247,433 agents listed)                                     |
| 5   | Altana docs — SDK & concepts                | `docs.altana.network`                                                                                                    | public web; `llms.txt` / `llms-full.txt` advertised | ⚠️ nav complete, some pages content-truncated                                       |
| 6   | Altana SDK (GitHub)                         | `github.com/altananetwork/altana-sdk`                                                                                    | Apache-2.0                                          | ✅                                                                                  |
| 7   | Altana docs — Sell over x402                | `docs.altana.network/sdk/x402-server`                                                                                    | public web                                          | ✅ (full content captured)                                                          |
| 8   | PancakeSwap Developer portal                | `developer.pancakeswap.finance`                                                                                          | public web                                          | ⚠️ nav (EVM contracts, Universal Router + Permit2, subgraph APIs, SDKs, bug bounty) |
| 9   | PancakeSwap docs (GitBook)                  | `docs.pancakeswap.finance`                                                                                               | public; `llms.txt`, `.md` pages, `?ask=` QA         | ✅ (overview page full)                                                             |
| 10  | TermiX bsc-mcp                              | `github.com/TermiX-official/bsc-mcp`                                                                                     | MIT, community-maintained (NOT BNB Chain official)  | ✅                                                                                  |
| 11  | ERC-8004 protocol                           | `8004.org` · `eips.ethereum.org/EIPS/eip-8004` · `github.com/erc-8004/erc-8004-contracts` · `best-practices.8004scan.io` | public                                              | 🔗 linked from 8004scan footer; not yet fetched                                     |
| 12  | BNB Smart Chain RPC                         | `https://bsc-dataseed.binance.org` (chainId 56)                                                                          | public RPC                                          | ✅ (default RPC cited by both Altana and bsc-mcp)                                   |

### 3.1 8004scan Builder Hub API — verified facts

- Base URL: `https://8004scan.io/api/v1/public/`; OpenAPI 3.0 spec at `/api/v1/public/docs/openapi.json`; interactive explorer at `/developers/docs`.
- **No API key required** for anonymous access; rate limits: **10 req/min, 100 req/day**.
- Keyed tiers: Free 30/min & 1,000/day · Basic 100/min & 10,000/day · Pro 500/min & 100,000/day · Enterprise custom.
- Rate-limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- CORS enabled for browser clients.
- Endpoints (documented): `GET /agents` (list/filter/pagination) · `GET /agents/{chainId}/{tokenId}` · `GET /agents/search` (semantic, `q=`) · `GET /accounts/{address}/agents` · `GET /stats` · `GET /feedbacks` · `GET /chains`.
- Exact JSON schemas, filter parameters, and error bodies: **[UNKNOWN]** — parse `openapi.json` before implementation (OQ-2).
- Operator: AltLayer (footer: "Powered by AltLayer"). Site publishes ISO/IEC 27001:2022 and SOC 2 badges; these are self-published claims, not independently verified here.

### 3.2 8004scan Agent Explorer — observed data shape (fact, from UI)

- Total registry size observed: **247,433 agents** ("Showing 1–10 of 247433 agents").
- Agent card/table fields: **Name** (`Node3000.agent#258640` — name + `#tokenId` suffix), **Chain** (e.g. BNB Smart Chain), **Service** (e.g. `A2A`), **Score**, **Feedback**, **Stars**, **Owner** (truncated `0xe0f5…3c13`), **X402** (`-` when absent), **Created** (relative time).
- Detail URL scheme: `/agents/{chainSlug}/{tokenId}` (e.g. `/agents/bsc/258640`).
- Avatar: seeded identicon (DiceBear bottts seeded by agent name).
- The page offers text search and "AI semantic search" — matching the API's `GET /agents/search`.

### 3.3 Altana — verified facts

- Non-custodial agentic wallet infrastructure: **agentic wallet + KeyStore permission registry + intent relay** (gas handling for delegated intents is documented at a high level; mechanics **[UNKNOWN]**, OQ-8).
- **Live on mainnet: BNB Chain, Ethereum, Base.** Same smart-account address works on every configured chain.
- KeyStore contracts **audited by CertiK, completed 2026-07-15**; deployment addresses on `docs.altana.network/security/audits`.
- Packages: `@altananetwork/sdk` (TypeScript, viem-based) · `@altananetwork/mcp` (MCP server for AI hosts) · `@altananetwork/x402-server` (seller side of x402) · `@altananetwork/hypersigner-keystore-mcp` (non-custodial KeyStore authorization MCP: verify/register/timebox/revoke keys, never holds a key).
- Documented SDK surface: `createClient({chains})`, `createPasskeyWallet`, `createWallet`, `signerFromPrivateKey`, `grantSession`, `execute`, `revokeSession`, `registerSessionKey`, `recoverFromPasskey`, `balances` (incl. BEP-677 scaled UI amounts), `ensureKeyCached` (sync-to-l2), `fetchWithX402`, `signOrder`, `approveSignatureChecker`, `approveTokenForPermit2`, ERC-8183 job functions.
- **Session permissions shape (fact):** `permissions: { calls: [{ to }], spend: [{ limit, period, token }] }` + `expiry` (unix seconds). Default: session is registered **on-chain in KeyStore** on grant; `register: false` grants an unlisted ephemeral session, later registrable via `registerSessionKey`.
- **x402 (buyer):** a session key pays per request over the x402 standard on the Permit2 or EIP-3009 rail, settled onchain from the smart wallet.

### 3.4 x402 / B402 seller rules — verified facts (`x402-server`)

- `createX402Merchant({ chainId, payTo, price, minPrice, maxPrice, rails, facilitator, rpcUrl, chain })`; `merchant.guard(req)` returns `{ response, receipt }` — a 402 challenge/rejection, or the served response with `tx` receipt.
- Rails: **`eip3009`** (`TransferWithAuthorization`, `$U` token — Studio buyers) and **`permit2-exact`** (`PermitWitnessTransferFrom`, e.g. USDT on BSC).
- **Studio buyer compatibility (fact):** offer `maxTimeoutSeconds ≤ 480` (default 300); Studio's signer refuses authorization windows over 600s and backdates `validAfter` by 120s; Studio buyers pay **`$U` via eip3009 only**; `bag x402 trust` requires an **https URL in production**.
- Header: `X-PAYMENT`, fallback `PAYMENT-SIGNATURE`. Challenge `resource` may be a bare URL or `{ url, description?, mimeType? }`.
- Settlement: funds move **directly payer → payTo**; recipient is bound into the buyer's signature (a compromised facilitator cannot redirect); nonces burn on-chain (replay impossible); invalid/checker-restricted payments revert at the settling contract.
- Mentioned Studio CLI verbs: `bag x402 trust`, `bag x402 buy`.

### 3.5 PancakeSwap — verified facts

- Developer portal: EVM contracts docs (including **Infinity**, the next-gen exchange), **Universal Router + Permit2** addresses page, subgraph **APIs**, **SDKs**, bug bounty.
- Docs (GitBook): 11 supported chains (BNB Chain, Ethereum, Solana, Base, Arbitrum, Aptos, ZKsync, Linea, Monad, Robinhood, opBNB); Syrup Pools, Yield Farms, Lottery, Prediction; public audits; contracts verified on BscScan; multisig + timelocks for contract changes.
- Machine-readable docs: `llms.txt` index; `.md` appended to any page URL; `?ask=<question>&goal=<endgoal>` QA endpoint.
- **Exact subgraph endpoint URLs, query schemas, and rate limits: [UNKNOWN]** — portal section not yet fetched (OQ-3). PRD FR-501/502 (LP APR ranking, pool analytics) must be implemented against the documented subgraph once fetched; no third-party APR API was part of the source list.

### 3.6 TermiX bsc-mcp — verified facts

- Community repo (104 stars / 38 forks, MIT), npm package `bnbchain-mcp`; **not an official BNB Chain project**.
- Stack: Viem 2.23.11, PancakeSwap SDK 5.8.8, MCP SDK 1.4.0, Moralis SDK 2.27.2, GoPlus SDK (token security checks); AES-256 + bcrypt protected local private keys.
- Network: BSC mainnet (chainId 56), default RPC `https://bsc-dataseed.binance.org`.
- Documented MCP tools: `transferNativeToken`, `transferBEP20Token`, `pancakeSwap`, `pancakeAddLiquidity`, `pancakeMyPosition`, `pancakeRemovePosition`, `createFourMeme`, `sellMemeToken`, `createBEP20Token`, `getBalance`, `callContractFunction`, `getWalletInfo`, `securityCheck`.
- Four.Meme contract addresses are published in its README (try-buy, AMAP buy/sell, factory).

---

## 4. Agent Model

**Fact (ERC-8004 registry via 8004scan):** an agent is a registry record identified by **`(chainId, tokenId)`**, with an **owner address**, a **name** (displayed `Name#tokenId`), a **service type** (the observed value is `A2A`; the full enum is **[UNKNOWN]**), a **chain**, plus derived/attached stats: **Score, Feedback, Stars, X402** capability flag, and **Created** time.

**Assumptions (marketplace layer):**

- Registry records may not carry marketplace-relevant metadata (pricing, description, capability list, category, risk tier). The marketplace maintains a **curated listing record** (`agent_listings`) keyed by `(chainId, tokenId)` that enriches the registry record. (A-1; see OQ-5.)
- **Category is not a registry field.** Classification into the four product categories is a marketplace-side curation decision (A-2; §10).
- `Score` / `Stars` semantics (derived? on-chain? voting?) are **[UNKNOWN]** until `openapi.json` or the ERC-8004 spec is parsed (OQ-2 / OQ-6).
- Agent-to-agent hiring uses the **ERC-8183** flow ("hire BNB agents"): hire → track job status → refund/claim → settle on delivery (documented in Altana docs; function-level details in OQ-7).

---

## 5. Marketplace Data Model

### 5.1 External identity (mirrored from registry) — `agents`

`chain_id` · `token_id` · `name` · `owner_address` · `service_type` · `score` · `feedback_count` · `stars` · `x402_enabled` (bool) · `created_at` · `last_synced_at`

Unique key: **`(chain_id, token_id)`**. Mirrored from 8004scan `GET /agents`, `GET /agents/{chainId}/{tokenId}`.

### 5.2 Curated listing — `agent_listings`

`agent_id (FK)` · `slug` · `display_name` · `description` · `category` · `tags[]` · `risk_tier` · `audit_status` · `price_model` (JSONB) · `permission_blueprint` (JSONB — suggested calls allowlist + spend caps) · `publisher_id` · `status` (draft/published/deprecated)

**[ASSUMPTION]** — all fields beyond registry identity are marketplace-curated; no documented registry API provides them (OQ-5).

### 5.3 Sessions & permissions (mirror of KeyStore state)

`id` · `user_id` · `wallet_id` · `agent_listing_id` · `keystore_session_ref` · `permissions` (JSONB: `calls`, `spend[]`) · `expiry` · `status` (active/expired/revoked) · `created_at` · `revoked_at` · `on_chain_tx_hash`

### 5.4 Deployments & monitoring

`deployments` (session_id, chain, agent wallet address, status, last_synced_at) · `positions` · `performance_snapshots` (ts, pnl, value, apy, health_factor, …) · `alerts` — as per PRD §12; all locally computed from on-chain reads.

### 5.5 Reputation & engagement

`ratings_reviews` (agent_id, user_id, rating, text, deployment_id) · `feedbacks` (mirror of registry `GET /feedbacks`, if schema permits) · `advantage_reports` (re-scope per correction #1).

### 5.6 Sync & audit

`sync_state` (source, entity, watermark, last_run, status) · `audit_logs` (immutable, per PRD §24).

---

## 6. Sync Strategy

### 6.1 Registry sync (8004scan)

- **Cadence:** anonymous tier (10 req/min, 100/day) is sufficient for a demo/MVP mirror of ~250k records only with heavy caching and one-time bulk load; ongoing incremental sync requires a **Free/Basic API key** (30–100 req/min) — obtainable via their developer flow ([UNKNOWN] whether it is self-serve or contact-based; OQ-2).
- **Approach:** full initial load via paginated `GET /agents` → incremental polling using `Created` watermark + `GET /agents/search` for query-time semantic lookups; `GET /stats` + `GET /feedbacks` on a slow cadence; `GET /accounts/{address}/agents` for "agents by owner" pages.
- **Honor rate limits:** consume `X-RateLimit-*` headers; on 429 → exponential backoff, never hard-fail reads (serve last-known-good rows with staleness markers).
- **Freshness SLA (PRD §19):** registry listing ≤ 60s (batch, off critical path); everything else cache-first with TTLs.

### 6.2 On-chain sync (wallet/session/payment state)

- Session/permission state: authoritative on KeyStore; read on-demand (grant/revoke events) rather than polling. **[ASSUMPTION]** — Altana docs describe on-chain registration + revocation in one transaction; an event-streaming API is not documented (OQ-8).
- Balances/positions/HF: RPC reads from `bsc-dataseed.binance.org` (or configured RPC) with ≤30s warm-cache cadence; WebSocket for price tickers ≤5s where available.
- x402 settlements: surfaced from `merchant.guard` receipts (seller side) and `fetchWithX402` receipts (buyer side) at request time; no background sync needed.

### 6.3 LP / yield sync (PancakeSwap)

- Pull pool data via documented **subgraph API** and/or PancakeSwap SDK; exact endpoints, filtering, and rate limits: **[UNKNOWN]** until the subgraph docs page is fetched (OQ-3). Sync cadence per PRD freshness SLA.

### 6.4 Staleness policy

Every UI surface shows "last updated" delta; stale rows render a `stale` chip rather than blocking the page (PRD §19).

---

## 7. Authentication Strategy

Two distinct authorization domains — do not conflate them:

### 7.1 Marketplace user auth (we own)

- **Wallet connect + signature** (EIP-191/712-style message; SIWE/EIP-4361 pattern per PRD §17) → short-lived JWT (15 min) + rotating refresh token (HTTP-only).
- Roles: `anonymous` → `user` (verified wallet) → `admin/mod` (governance). No password backdoors.
- Passkeys are a documented option (Altana `createPasskeyWallet`, Face ID/Touch ID, `recoverFromPasskey`) and may serve as the user-facing "no-seed-phrase" login path.

### 7.2 Agent authorization (Altana KeyStore — the operative security layer)

- `createWallet` (private-key signer, server-side env/OS keychain/hardware) or `createPasskeyWallet` (browser) per deployment.
- `grantSession` with **least-privilege permissions**: `calls` allowlist + `spend` caps (limit + period + token) + `expiry` — **required before any hire** (PRD FR-302/303).
- Default: sessions are on-chain in KeyStore immediately; `register: false` for ephemeral keys.
- `revokeSession` — one transaction, effective before the next action (instant revocation claim, documented).
- Any DEX, orderbook, or protocol can verify agent authority on-chain without integrating a wallet vendor (documented) — this is how our marketplace can display and verify permission status without trusting Altana's UI.

### 7.3 External API auth (8004scan)

Anonymous (rate-limited) or API key; CORS enabled; no user scoping — do not send user identity to it.

---

## 8. Hiring Flow

Documented primitives compose into this flow (each step cites its source):

1. **Discover** — 8004scan API (`GET /agents`, `/agents/search`, `/agents/{chainId}/{tokenId}`) + curated `agent_listings`.
2. **Configure** — user picks from the listing's `permission_blueprint`; marketplace requires concrete `calls`, `spend` caps, and `expiry` before hire (PRD FR-302/303).
3. **Deploy wallet** — `createWallet` / `createPasskeyWallet` (Altana).
4. **Grant session** — `grantSession({ wallet, signer, permissions, expiry })`; store `keystore_session_ref` + `on_chain_tx_hash`.
5. **Pay** — two documented paths:
   - **Per-call (x402):** agent's operator runs `createX402Merchant` (eip3009 rail with `$U`, and/or permit2-exact with USDT etc.); buyer pays via `fetchWithX402` from the session key; merchant serves 402 challenges and verifies `X-PAYMENT` (fallback `PAYMENT-SIGNATURE`). Studio-buyer constraints must be honored: window ≤ 480s (≤600s hard), https required in production.
   - **Job-based (ERC-8183):** hire an agent for a defined job → track status → settle on delivery / claim refund on dispute (documented at feature level; API details OQ-7).
6. **Monitor** — `execute({ session, calls })` runs within caps; our snapshot pipeline records PnL/HF/APY.
7. **Manage** — `revokeSession` (instant), expiry enforcement, cap display; revocation surfaces in UI + audit log; deployment moves to `terminated` (PRD §22).

**Assumption:** the marketplace displays and enforces caps server-side (spend accounting) in addition to on-chain enforcement, per PRD §22/§21 (A-3).

---

## 9. Reputation System

**Fact (registry):** agents carry **Score, Feedback, Stars** via the 8004scan index; a `GET /feedbacks` endpoint exists. Semantics of Score/Stars: **[UNKNOWN]** (OQ-2).

**Marketplace layer ([ASSUMPTION] unless the registry schema proves otherwise):**

- Local `ratings_reviews` for verified-hire feedback (tie review to a `deployment_id` — PRD §12).
- Badge workflow: `Audited` / `Verified Dev` / `Audited Strategy` as curated metadata with provenance notes (PRD FR-702) — no documented registry badge API.
- Leaderboards: computed locally from `performance_snapshots` normalized per category (PRD §20); registry score/feedback/stars add a cross-platform signal.
- Security posture of the source: 8004scan publishes ISO 27001 & SOC 2 badges (self-published); CertiK audit of Altana KeyStore is a documented third-party fact.

---

## 10. Category Architecture

**PRD:** four equal-priority categories — Rebalancing, Grid Trading, Yield Optimization, Health Factor — each with a dedicated directory + dashboard + metrics.

**Mapping facts/assumptions:**

- The only service type observed on the registry is `A2A`; the registry exposes **no category taxonomy** in retrieved docs. **[ASSUMPTION]** Category membership is marketplace-curated (A-2): a listing's `category` field, set at publish time, drives `/categories/*` pages.
- Category metrics are computed from our own snapshot pipeline, not from a vendor API (PRD §5.2): rebalance frequency/drift/cost · grid span/levels/utilization/PnL · realized vs factory APY/compounding · HF/liquidation distance/trend.
- Extensibility (PRD §38): adding a category = new category config + metric definitions + adapter reuse; no core rewrite. Registry-schema alignment remains an open direction (OQ-6).

---

## 11. Local Database Design

PostgreSQL primary (Prisma, as scaffolded), Redis cache/rate-limit (PRD §12). Adjustments to the PRD schema driven by research:

| Table                                                                        | Key fields (changes vs PRD marked)                                                                                                           | Source of truth            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `agents`                                                                     | `(chain_id, token_id)` **unique**, name, owner_address, service_type, score, feedback_count, stars, x402_enabled, created_at, last_synced_at | 8004scan mirror            |
| `agent_listings`                                                             | slug (unique), category, risk_tier, audit_status, price_model JSONB, permission_blueprint JSONB                                              | local curation             |
| `wallets`                                                                    | address, chain, provider (`altana`), passkey/private-key mode, is_default                                                                    | Altana                     |
| `sessions`                                                                   | keystore_session_ref, permissions JSONB (calls, spend), expiry, status, on_chain_tx_hash                                                     | KeyStore mirror            |
| `permissions`                                                                | session_id, scope, total/period cap, expiry, revoked_at                                                                                      | local + KeyStore           |
| `deployments`                                                                | session_id, agent wallet address, status, last_synced_at                                                                                     | local                      |
| `positions` / `performance_snapshots`                                        | per PRD; snapshots indexed `(deployment_id, ts DESC)`                                                                                        | local (on-chain reads)     |
| `lp_pools`                                                                   | dex, pool, symbol, apy, apr, tvl, vol_24, chain, ts                                                                                          | PancakeSwap subgraph (TBD) |
| `advantage_reports`                                                          | **re-scope pending OQ-4**                                                                                                                    | —                          |
| `ratings_reviews` / `notifications` / `alerts` / `audit_logs` / `sync_state` | per PRD                                                                                                                                      | local                      |

Indexes per PRD §12: `(category)`, `(category, sort_key)`, `(wallet_id, active)`, `(deployment_id, ts DESC)`, `(chain_id, token_id)` unique, `slug` unique.

---

## 12. API Contract

### 12.1 Upstream: 8004scan (documented)

`GET /api/v1/public/agents` · `/agents/{chainId}/{tokenId}` · `/agents/search?q=` · `/accounts/{address}/agents` · `/stats` · `/feedbacks` · `/chains`. OpenAPI spec: `/api/v1/public/docs/openapi.json`. Rate headers `X-RateLimit-*`. **Exact schemas: parse openapi.json before coding (OQ-2).**

### 12.2 Upstream: Altana (TypeScript SDK, not REST)

`createClient` · `createWallet` · `createPasskeyWallet` · `recoverFromPasskey` · `grantSession` · `execute` · `revokeSession` · `registerSessionKey` · `balances` · `ensureKeyCached` · `fetchWithX402` · `signOrder` · `approveSignatureChecker` · `approveTokenForPermit2` · ERC-8183 job/settle/dispute/reclaim. Seller side: `createX402Merchant` + `guard(req)`; header `X-PAYMENT` / `PAYMENT-SIGNATURE`.

### 12.3 Upstream: PancakeSwap

Contract addresses: Universal Router + Permit2 (dev portal addresses page — exact addresses **[UNKNOWN]**, OQ-3). Data: subgraph API (endpoints **[UNKNOWN]**, OQ-3). SDKs available for EVM (and Aptos).

### 12.4 Upstream: bsc-mcp (MCP protocol, community)

Tools as listed in §3.6. Use via MCP client; treat as optional utility surface, not core, given community status.

### 12.5 Our marketplace API (v1 REST, per PRD §14, unchanged except noted)

`POST /auth/connect` · `POST /auth/session` · `GET/POST /sessions…` · `GET /agents?…` · `GET /agents/:slug` · `GET /agents?ids=…` (compare) · `GET /categories` / `:id` · `GET /agents/:id/performance` · `GET /lp/pools…` · `GET /agents/:id/advantage-report` **(pending OQ-4)** · `GET /notifications…` · WS `GET /stream?agentIds=`. Envelope `{ ok, data?, error { code, message, fields? } }`; idempotency via `X-Idempotency-Key`; typed codes (CATALOG_FILTER_INVALID, SESSION_EXPIRED, RATE_LIMITED, DATA_STALE, RPC_TIMEOUT, PAYMENT_REJECTED…).

---

## 13. Security Considerations

Derived from documented behavior + PRD:

1. **Zero server-held private keys.** Altana is non-custodial; `hypersigner-keystore-mcp` "never holding a key or signing anything." Private-key signers live in env/OS keychain/hardware (`signerFromPrivateKey`); passkeys stay with the user.
2. **Least privilege, default deny.** Sessions carry explicit `calls` allowlist + `spend` caps + `expiry`; no wildcard capability (PRD §22). Marketplace enforces caps server-side as a second layer (A-3).
3. **Instant revocation.** One transaction; effective before the next action; UI + audit surface it; terminated deployments cannot re-execute (PRD §22).
4. **Payment integrity (documented).** Payer→payee direct settlement with recipient bound in the buyer signature (facilitator compromise cannot redirect funds); nonce-burning prevents replay; invalid payments revert on-chain. Accept only eip3009 (`$U`) for Studio buyers; enforce window ≤600s and https in production.
5. **Trust anchors.** CertiK audit of KeyStore (2026-07-15); PancakeSwap public audits + multisig/timelock; 8004scan ISO/SOC2 claims noted as self-published.
6. **Platform hygiene (PRD §21).** CORS/CSRF, CSP, SSRF allowlist for external endpoints (RPC, subgraph), rate limiting + 429 handling, secret rotation, pinned/locked deps, encrypted at-rest PII (minimal by design), RBAC on admin/mod, immutable `audit_logs` for every permission op.

---

## 14. Failure Handling

| Failure                     | Behavior                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 8004scan 429 / rate-limited | Exponential backoff honoring `X-RateLimit-Reset`; serve cached rows with staleness marker; never hard-fail discovery pages         |
| 8004scan outage             | Serve local mirror (`last_synced_at` chips); queue sync jobs in worker                                                             |
| RPC timeout/latency         | Circuit breaker + retry/backoff; cache-first reads; `RPC_TIMEOUT` error code; stale-data fallback (PRD §23)                        |
| x402 payment rejection      | `merchant.guard` returns rejection response; buyer retries with corrected timeout window/https; surface `PAYMENT_REJECTED` to user |
| Session expired / revoked   | `execute` fails; UI marks session dead, user alerted; re-grant flow; deployment → `terminated` (PRD §22)                           |
| ERC-8183 job dispute        | Claim refund / reclaim path (documented feature-level)                                                                             |
| Subgraph/Pancake data stale | TTL-based staleness chips; batch refresh off critical path                                                                         |
| Unknown API schemas         | Parse `openapi.json` before implementation; treat missing fields as `null` + log (OQ-2)                                            |
| Webhook ingestion (if any)  | Signature verification, idempotency keys, SSRF allowlist (PRD §21)                                                                 |
| Unhandled errors            | Uniform envelope; 404/429/500 pages with retry; Sentry capture with context (PRD §23)                                              |

---

## 15. Open Questions

- **OQ-1 — Agent Studio API:** Does BNB Agent Studio expose any public API beyond the `bag` CLI (and the `$U` eip3009 convention)? The product page and launch blog contain no API documentation in the retrieved content. Until answered, the marketplace integrates with 8004scan + Altana and treats Studio as a brand/ecosystem.
- **OQ-2 — 8004scan schema depth:** Exact request/response schemas, filter parameters, error bodies, Score/Stars semantics, and API-key acquisition flow — all live in `openapi.json`/developer docs and must be parsed before coding.
- **OQ-3 — PancakeSwap data endpoints:** Exact Universal Router/Permit2 addresses for BSC and the subgraph API endpoint URLs + rate limits (developer portal sections not yet fetched).
- **OQ-4 — "TERMIX Advantage Report" (FR-4xx):** Not documented in `TermiX-official/bsc-mcp`. Decide: drop, rebuild as marketplace-computed benchmark, or confirm with TermiX. Pending decision, `advantage_reports` table + endpoint stay stubbed.
- **OQ-5 — Curated metadata:** Does any registry endpoint return description/tags/pricing, or is `agent_listings` curation fully on us? (Assumed fully on us.)
- **OQ-6 — ERC-8004 spec depth:** Registration/write path, fee, service-type enum, and category-like metadata — from `eips.ethereum.org/EIPS/eip-8004` and the contracts repo (linked, not yet fetched).
- **OQ-7 — ERC-8183 API details:** Function-level contract for hire/settle/dispute/reclaim and `ERC8183_ADDRESSES` (Altana docs page was navigation-heavy in our fetch; `llms-full.txt` should close this).
- **OQ-8 — KeyStore event stream / intent relay:** Whether grant/revoke/settlement state can be consumed as events (vs. on-demand reads), and how the intent relay handles gas.
- **OQ-9 — bsc-mcp status:** Confirm with maintainers whether it is BNB-official or purely community; if community, keep it out of the "official data" narrative and mark it as an optional tool surface.

---

_End of TIS v1.0. Follow-up: (1) fetch `openapi.json` + Altana `llms-full.txt` + PancakeSwap subgraph docs; (2) resolve OQ-1/OQ-4 with stakeholders; (3) record any divergence as an ADR under `docs/ADR-*`._
