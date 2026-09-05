# Main Track Activation — X.69: Main Track Depth Completion

**Session:** X.69 — final category depth: real reserves, per-category recommendations, explicit verification gaps.
**Status:** PASS (one infrastructure finding, see §8.3)
**Prior:** X.68 (PASS), X.67 (PASS), X.54 (depth baseline — all four categories PARTIAL with real market context).
**Repository:** `C:\bnb-agent-marketplace` (monorepo; `apps/web` Next.js 15.5.23 App Router).

---

## 1. Goal

Complete the depth of the four Main Track categories (Rebalancing, Grid Trading, Yield
Optimisation, Health Factor Monitoring) so every category page carries:

- **Analysis** — every displayed number is a real, attributed read (subgraph / registry) or an explicit unavailable state.
- **Recommendation** — one literate data-derived recommendation per category, built only from the real signals on the page, never a metric and never an execution promise.
- **Verification gaps** — each gap names the exact missing source; nothing is estimated around it.

Constraints honoured: no fabricated APR/APY, grid ranges, backtests, health factors or
execution; only existing real sources extended (PancakeSwap V2 read, 8004scan discovery);
TERMiX, AWS/KMS, Altana signing boundaries, mainnet, Agent 1816 and Job 515 untouched; no
commit/push; stop after X.69 (X.70 not started).

## 2. Starting State (audit)

- `lib/pancakeswap/client.ts` — server-only read-only BSC V2 subgraph loader (NodeReal
  MegaNode GraphQL, `PANCAKESWAP_API_KEY`, chain 56). Real fields: `tvlUsd` (reserveUSD),
  `volumeUsd` (cumulative lifetime), `token0Price`/`token1Price`, `totalTransactions`
  (cumulative). The raw subgraph payload already carried `reserve0`/`reserve1` (strings) but
  they were dropped by normalization.
- `lib/categories/market-context.ts` (X.54) — one shared builder for all four categories with
  explicit honesty rules (APR/APY null, volume labelled cumulative, ratios over real values,
  failures as states).
- `components/category-dashboard.tsx` — one shared config-driven dashboard
  (`executionMode: "analysis-only"`), four thin page configs in
  `app/(app)/categories/{rebalancing,grid-trading,yield,health-factor}/page.tsx`.
- 8004scan lib — registry discovery with deterministic classifier + evidence excerpts
  (production env `E8004SCAN_API_KEY` present). `health_score` parses but is null upstream.
- TERMiX — read-only reputation client (chain 97, MockAgentNFT). Not touched (task boundary).
- Aave MCP — only verified tool remains `getAaveV3SupportedChains`; no position/health-factor
  path exists. BNB-testnet-risk API — read-only wallet snapshot, no lending-health source.

## 3. Work Done

### 3.1 Real reserves — `apps/web/lib/pancakeswap/client.ts`

- `PancakeSwapPool` type gains `reserve0: number`, `reserve1: number` (real current token
  quantities from subgraph `reserve0`/`reserve1`).
- `isValidRawPair` now also validates both reserves via `parseDecimal`; `normalizePair` maps
  them to numbers. Nothing new is computed — only fields already present in the subgraph read.

### 3.2 Shared market-context depth — `apps/web/lib/categories/market-context.ts`

- `PoolContextRow` gains `reserve0`, `reserve1`, `token1Price`.
- New pure helpers: `formatUsd`, `formatAmount`, `poolSwapTotal` (sum of real cumulative swap
  counts), `depthLabel` (e.g. `12.35K WBNB + 8.10M USDT`).
- `CategoryMarketContext` (both `ready` and `unavailable` states) gains `recommendation: string`.
- Unavailable and empty-pool branches return honest fallback recommendations
  ("no data-derived recommendation… No substitute values are used").

### 3.3 Per-category recommendations (derived only from real signals)

- **Rebalancing** — recommendation names the deepest observed routing pair (real TVL,
  reserve depth, live reference price) and states the cost rule: rebalance only when measured
  drift exceeds expected gas + slippage; page shows market context, not the user's positions.
- **Grid trading** — recommendation names the most active pool (real cumulative swap count,
  TVL, depth, current price) and states a range cannot be derived from this source; never an estimate.
- **Yield optimisation** — recommendation ranks pools by real turnover (cumulative volume ÷ TVL),
  shows real liquidity depth, and flags APR/APY as unverifiable from this source.
- **Health factor** — recommendation invents nothing: no lending position is read, so no health
  factor exists on this page; the path is "activate a monitoring agent scoped to the lending
  market that holds your position". Its context branch keeps `pools: []` and all signals `null`.

### 3.4 Dashboard — `apps/web/components/category-dashboard.tsx` (shared)

- **Evidence strip** (when registry matches exist): matched records, verification status,
  x402 payment support, protocols claimed — all derived from the matched agent records.
- **Capability breakdown** card: Analysis (available now) / Recommendation (available now) /
  Execution (Not available — would require a scoped, revocable Altana session permission).
- **"What these agents recommend"** card — renders `market.recommendation`; explicitly labelled
  "Derived from the market context above. Never a metric and never an execution promise."
- **"What cannot be verified yet"** card — renders the per-category `verificationGap` list.
- Per-agent grid now also shows Registry health (`agent.healthScore ?? "Unavailable"`).

### 3.5 Category pages — `app/(app)/categories/{rebalancing,grid-trading,yield,health-factor}/page.tsx`

Each config gains a `verificationGap` array naming the exact missing source, e.g.:

- Rebalancing — execution cost, your holdings/targets, historical price series (not in the pairs query).
- Grid trading — grid range (no verified price history), performance (no backtest exists
  anywhere in this marketplace), order placement (no trading bridge wired).
- Yield — APR/APY (V2 subgraph publishes no fees/emissions), vault yields (no vault position
  read), impermanent loss (needs a price path).
- Health factor — lending position (no wallet read), lending market data (no lending
  subgraph/RPC/health-factor tool wired), liquidation-trigger execution (no transaction bridge).

### 3.6 Verifier extension — `apps/web/lib/categories/x54.depth.verify.ts`

Extended from 23 to **38 checks** without weakening any prior check: reserve validation and
normalization in the client; per-category recommendation derivations (named values, honest
fallbacks, `8.00x` turnover identity, `$2.00M` depth naming, "no health factor… none is
invented"); honest recommendations in unavailable/empty states; dashboard rendering of
recommendation / capability breakdown / verification gaps; `verificationGap` on all four
pages; negative-language assertions (grid page never claims backtest/win rate/placed orders,
yield page never presents a numeric APY, health page never displays an invented value).

## 4. Gates

- `pnpm typecheck` — PASS
- `pnpm lint` — PASS
- `pnpm build` — PASS (warning: ox `tempo/virtualMasterPool` dynamic dependency, pre-existing,
  non-blocking; all four category routes compile as dynamic routes, 149–150 B each)

## 5. Tests

| Verifier | Result |
|---|---|
| categories depth (x54, extended for X.69) | **38/38 PASS** |
| marketplace | 83/83 PASS |
| discovery | 59/59 PASS |
| compare | 10/10 PASS |
| activation:hire | 23/23 PASS |
| activation:hire-api | 14/14 PASS |
| altana:session | 25/25 PASS |
| altana:session:api | 72/72 PASS |
| security:x49 | 25/25 PASS |
| categories:x53 | 21/21 PASS |
| security:x55 | 22/22 PASS |
| security:x50 | 34 checks, 1 failure — the known pre-existing stale check-24 (standalone output / server-external assertion superseded in X.61), **not modified** |

No other verifier was touched. All are offline/pure.

## 6. Local State Verification (next start, port 3105)

- `/`, `/categories`, `/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`,
  `/categories/health-factor`, `/marketplace` → **200**; `/not-a-real-route` → **404**.
- All four category pages render: recommendation card, capability breakdown
  (Analysis/Recommendation/Execution), verification-gap card, evidence strip, "Registry
  health" per agent.
- Without `PANCAKESWAP_API_KEY`, the pool-derived block renders the honest unavailable state
  ("Live PancakeSwap pool data is unavailable… No substitute values are displayed") — verified.

## 7. Deployment

- `pnpm dlx vercel deploy --prod --yes` → deployment `bnb-agent-marketplace-j25bhenpt-solo-25cb`
  READY, aliased to `https://bnb-agent-marketplace-web.vercel.app`.
- Platform build: `prisma generate && rm -rf .next && pnpm build` — success (2m).
- No `.env.local` artifacts left behind.

## 8. Production Smoke Test

### 8.1 Routes

`/`, `/categories`, `/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`,
`/categories/health-factor`, `/marketplace`, `/agents`, `/login` → **200**;
`/not-a-real-route` → **404**.

### 8.2 Content & states

- All four category pages render the recommendation card, capability breakdown (Execution =
  "Not available"), verification-gap card, evidence strip ("Matched records"), and the
  per-agent "Registry health" cell.
- Pool-derived content: production genuinely honours the source boundary — `PANCAKESWAP_API_KEY`
  is **not** in the solo-25cb project env (see §8.3), so the market-context block renders the
  honest unavailable state with no substitute values. The ready-state path is proven by the
  extended 38-check fixture verifier and the X.54/X.61 production record.
- APIs (honest rejection): `/api/activation/aave-preview` POST → 200
  `{"state":"unsupported","reason":"wrong-agent"}`; GET → 405;
  `/api/agents/bnb-testnet-risk/service` GET → 405, malformed POST → 400.

### 8.3 Finding — live pool depth needs one env var on this account

The previous Vercel account's project carried `PANCAKESWAP_API_KEY`; the current
`solo-25cb` project (`vercel env ls`: PRISMA_QUERY_ENGINE_LIBRARY, DATABASE_URL,
E8004SCAN_API_KEY, AUTH_CANONICAL_ORIGIN, RATE_LIMIT_BACKEND) does not. Restoring live depth
on production is a one-command operation, no code change:
`vercel env add PANCAKESWAP_API_KEY production`, then redeploy. Until then the deployment
correctly shows the honest unavailable state.

### 8.4 Headers (regression)

CSP with per-request nonce, HSTS `max-age=63072000; includeSubDomains`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` — PASS.

## 9. Category detail (statuses after X.69)

Status legend: **PARTIAL** remains the honest per-category status wherever execution or
required data is unavailable; **Depth: PASS** means everything a real source supports is
implemented, honest and verified.

### Rebalancing — PARTIAL (Depth: PASS)

| Aspect | Detail |
|---|---|
| Real data | 8004scan discovery + evidence; live PancakeSwap TVL, reserve depth (`reserve0/reserve1`), reference price, cumulative swap totals |
| New in X.69 | `Liquidity depth (deepest pool)` (e.g. `12.35K WBNB + 8.10M USDT`), `Swap activity (sample)` sum, cost-context unavailable signal, data-derived recommendation naming the deepest routing pair |
| Intentionally unavailable | Rebalance cost, your positions/balances, historical price series (not in the pairs query), APR/APY, 24h volume |
| Execution | Analysis / recommendation only — no rebalance is performed |
| Verification gap (page) | Execution cost not read; holdings/targets not read; no history-based timing |
| Remaining gap | Execution requires Altana custody + a scoped permission design (not part of X.69) |

### Grid Trading — PARTIAL (Depth: PASS)

| Aspect | Detail |
|---|---|
| Real data | 8004scan discovery + evidence; live pool TVL, cumulative swap counts, reserve depth, current price |
| New in X.69 | `Liquidity depth (most active pool)`, `Current price (most active pool)`, recommendation naming the most active pool and refusing range inference |
| Intentionally unavailable | **Grid range / volatility window** (no verified price history — never inferred), backtests/win rate/P&L (none exist anywhere), positions, APR/APY, 24h volume |
| Execution | Analysis / recommendation only — this marketplace places no grid orders |
| Verification gap (page) | Range, performance, order placement — each with the exact missing source |
| Remaining gap | Verified price-history source for range guidance; execution deferred |

### Yield Optimisation — PARTIAL (Depth: PASS)

| Aspect | Detail |
|---|---|
| Real data | 8004scan discovery + evidence; live PancakeSwap TVL, cumulative volume, swap counts, computed turnover (identity over two real values) |
| New in X.69 | `Liquidity (highest turnover pool)` reserve depth, `Swaps (highest turnover pool)` count, recommendation ranking real pools and flagging APR/APY as unverifiable |
| Intentionally unavailable | **APR/APY** (V2 subgraph publishes no fee/emission data — never estimated), vault yields, impermanent loss, 24h volume |
| Execution | Analysis / recommendation only — no auto-compounding or reallocation here |
| Verification gap (page) | APR/APY, vault yields, impermanent loss — each with the exact missing source |
| Remaining gap | A fee/emission source (e.g. V3 subgraph or MasterChef read) to make APR real; execution deferred |

### Health Factor Monitoring — PARTIAL (Depth: PASS)

| Aspect | Detail |
|---|---|
| Real data | 8004scan discovery + evidence; no DEX context drawn (pools: none, all signals null) |
| New in X.69 | Explicit null signals (live lending position / position source / collateral-debt snapshot) each with reason + help; recommendation: no position is read, no health factor exists here, activate a monitoring agent scoped to the lending market that holds your position |
| Intentionally unavailable | Health factor, liquidation price/threshold distance (account-specific; no wallet read), APR/APY, 24h volume, positions |
| Execution | Analysis / recommendation only — nothing here can add collateral or repay |
| Verification gap (page) | Lending position, lending market data, liquidation-trigger execution — each with the exact missing source |
| Remaining gap | A configured monitoring agent with read access to a lending market (user action); a lending position data path for category pages |

## 10. Boundaries

- TERMiX: NOT TOUCHED (read-only reputation client preserved as-is).
- PancakeSwap: the only legitimate market/yield source, extended with fields already present
  in its V2 subgraph payload (reserves); loader stays server-only and read-only.
- Aave MCP / BNB-testnet-risk API: read-only, untouched; neither is a health-factor source.
- AWS / KMS / Altana signing: NOT TOUCHED.
- Mainnet: NOT TOUCHED.
- Agent 1816: NOT TOUCHED.
- Job 515: NOT TOUCHED.
- Blockchain transactions: NONE.
- Auth/session/revoke boundaries: unchanged and unweakened.
- Commit: NO. Push: NO.
- X.70: NOT STARTED (stopped after X.69 report).