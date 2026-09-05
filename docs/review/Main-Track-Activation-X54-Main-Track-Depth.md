# X.54 Main Track Depth

- **Date:** 2026-08-15
- **Baseline:** X.53 (all four categories PARTIAL; 275 offline checks PASS)
- **Scope:** Main Track category depth and comparability. No infrastructure work, no blockchain transaction, no mainnet, no Agent 1816 / Job 515 change, no commit/push.
- **Result:** All four categories now carry equivalent depth with real market context, explicit ANALYSIS-vs-EXECUTION labelling, stated risks, and declared unavailable metrics. Verified by rendering each route in a running production server.

## What changed at the core

X.53 made the four categories real but thin: agent discovery plus capability text. X.54 adds the decision layer, built once and shared so all four stay comparable:

**New `lib/categories/market-context.ts`** derives category-appropriate signals from the live PancakeSwap V2 read:

- Only two kinds of number exist: values read directly from the subgraph, and ratios of two real subgraph values (`turnoverRatio = cumulativeVolume / TVL`).
- APR/APY is **never** estimated — it stays `unavailable` with a stated reason, because the V2 subgraph publishes no fee or emission data.
- `volumeUsd` is labelled **cumulative lifetime**, not 24h, everywhere it appears.
- Degenerate input is handled: zero/negative TVL yields `null`, never `Infinity` or `NaN`.
- Upstream failure and empty results propagate as honest states, never as zeros.

**Rewritten `components/category-dashboard.tsx`** renders, identically for every category: capability (monitors / what it does / why useful), risks and limitations, live market context or an honest unavailable state, an explicit "Intentionally not shown" list with reasons, decision signals, full provenance, and the activation path.

Two independent bounded reads run in parallel, so a registry failure cannot blank market context and vice versa.

## Category detail

### Rebalancing — PARTIAL

| Aspect | Detail |
|---|---|
| Files | `app/(app)/categories/rebalancing/page.tsx`, shared dashboard + market context |
| Real data | 8004scan BNB-Chain discovery + evidence; live PancakeSwap TVL, reference price (`token0Price`), swap counts |
| Capability | Detect drift beyond a target band, quantify it, explain why a rebalance is warranted |
| Metrics available | Matched agents, registry hits, records screened, combined TVL, deepest pool, live reference price |
| Intentionally unavailable | Rebalance cost (depends on executing account/route), your positions/balances, realised performance, APR/APY, 24h volume |
| Execution | **Analysis / recommendation only** — no rebalance is performed |
| Limitations stated | Rebalancing realises losses and costs gas; thin liquidity increases slippage; recommendations are not orders; listing is not a performance promise |
| Tests | X.54 checks 1–6, 11, 15, 17–18 |
| Remaining gap | Execution requires Altana custody + a scoped permission design |

### Grid Trading — PARTIAL

| Aspect | Detail |
|---|---|
| Files | `app/(app)/categories/grid-trading/page.tsx`, shared dashboard + market context |
| Real data | 8004scan discovery + evidence; live pool liquidity and **cumulative swap counts** (grid fills depend on two-way activity) |
| Capability | Laddered buy/sell levels across a range, capturing volatility while range-bound |
| Metrics available | Matched agents, registry counts, combined TVL, deepest pool, most active pool by real swap count |
| Intentionally unavailable | **Grid range / volatility window** — no price history in the pairs query, so a range is never inferred; plus positions, performance, APR/APY, 24h volume |
| Execution | **Analysis / recommendation only** — this marketplace places no grid orders |
| Limitations stated | Grids lose when price trends out of range; range must come from a verified history source; per-level gas erodes thin margins; no automated execution exists |
| Tests | X.54 checks 1–6, 12, 17–18 |
| Remaining gap | Verified price-history source for range guidance; execution deferred |

### Yield Optimisation — PARTIAL

| Aspect | Detail |
|---|---|
| Files | `app/(app)/categories/yield/page.tsx`, shared dashboard + market context |
| Real data | 8004scan discovery + evidence; live PancakeSwap TVL, cumulative volume, swap counts, computed turnover |
| Capability | Compare pools on verifiable liquidity and activity; surface where capital actually works |
| Metrics available | Combined TVL, deepest pool, highest-turnover pool, per-pool TVL/volume/swaps/turnover table |
| Intentionally unavailable | **APR/APY** (subgraph publishes no fee/emission data — reason shown in UI), 24h volume, positions, realised performance |
| Execution | **Analysis / recommendation only** |
| Limitations stated | Turnover indicates fee activity, not profit; impermanent loss can exceed fees; TVL/volume are snapshots, not forward returns; LP exposes you to both assets |
| Tests | X.54 checks 7–10, 19–21 |
| Remaining gap | A source that genuinely publishes APR/APY (deliberately not estimated) |

### Health Factor Monitoring — PARTIAL

| Aspect | Detail |
|---|---|
| Files | `app/(app)/categories/health-factor/page.tsx`, shared dashboard + market context |
| Real data | 8004scan discovery + evidence (agent discovery is fully functional) |
| Capability | Track collateral and debt for your account, compute health factor, alert before liquidation |
| Metrics available | Matched agents, registry hits, records screened, chain |
| Intentionally unavailable | **Health factor** and **liquidation price/threshold distance** — both account- and market-specific; no wallet is read, so no value is shown and none is invented. Verified in rendered HTML. |
| Execution | **Analysis / recommendation only** |
| Limitations stated | No live position available here; a health factor does not transfer between markets; stale feeds under-report risk; monitoring alone does not prevent liquidation |
| Tests | X.54 check 13 (asserts zero DEX pools, all signals null, health factor declared unavailable) |
| Remaining gap | Lending-market reader scoped to a connected account |

## Comparability

All four now render the same nine blocks: header, explanation, agent discovery, capability, decision signals, provenance, risk/limitations, activation, and empty/error states. Verifier check 1 fails if any category omits a depth field; checks 2–3 enforce multiple risks (5 each) and decision signals (6/6/6/5).

The asymmetry X.54 explicitly forbade — one category detailed, another a placeholder — cannot silently return: the shared dashboard means a missing field is a type error, and the verifier asserts parity.

## PancakeSwap — PARTIAL

Integrated into **Rebalancing** (reference price, liquidity depth), **Grid Trading** (swap activity), and **Yield Optimisation** (TVL, turnover) rather than as a disconnected panel.

Safety unchanged and verified: read-only subgraph access, `server-only` barrier intact (check 22), no signer or swap construction, no approval of any kind, zero `MAX_UINT` occurrences, no unbounded spend, no hidden transactions. Execution remains absent and is labelled as absent.

## Data freshness

Every dynamic value carries source, chain, and retrieval timestamp. Category pages are `force-dynamic`, so no stale cached snapshot is served. When either source fails, the page states it plainly instead of substituting values that look real.

## Security

No control was weakened. Server-only boundaries, auth, CSRF, ownership checks, rate limiting, chain-97 safety, production gates, secret protection, and 8004scan per-record validation all remain green (275 prior checks unchanged, now 298 total).

## UX review (rendered, not assumed)

Started the production server and fetched every route:

```text
/categories/rebalancing    => 200
/categories/grid-trading   => 200
/categories/yield          => 200
/categories/health-factor  => 200
/api/auth/me               => 200
```

Rendered HTML assertions:

- "Analysis / recommendation only" present on every category
- "Risks and limitations" and "Intentionally not shown" present
- honest "Registry credential not configured" state shown (no 8004scan key in this environment) — proving graceful degradation rather than a crash
- **no** "coming soon" anywhere
- **no** numeric APY rendered; **no** numeric health factor rendered

`/api/altana/session` returned 500 rather than 401 in this local run. Cause is the pre-existing Windows Prisma query-engine packaging issue (X.49 LOW finding, `PrismaClientInitializationError`), not an X.54 regression; the safe-error mapping still leaked no internals. Unauthenticated 401 behaviour remains proven by the X.47 suite (63 checks).

## Test results

| Gate | Result |
|---|---|
| `pnpm prisma validate` | PASS |
| `pnpm prisma generate` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (exit 0; all four categories `ƒ` dynamic) |
| `pnpm test` | **PASS (exit 0) — 298 checks** |
| `pnpm audit` | PASS — no known vulnerabilities |

```text
X.42 PASS · X.43 PASS · X.44 PASS · X.45 25/25 · X.47 63/63
X.49 25/25 · X.50 34/34 · X.53 21/21 · X.54 23/23
```

The X.53 verifier caught my own wording change during this milestone (source-label rename) and I corrected the assertion rather than loosening it.

## Files changed

| File | Change |
|---|---|
| `apps/web/lib/categories/market-context.ts` | **New** — real market context per category; APR/APY never estimated; safe ratios |
| `apps/web/components/category-dashboard.tsx` | Market context, risks, execution-mode badge, unavailable-metrics block, pool table |
| `apps/web/app/(app)/categories/rebalancing/page.tsx` | Depth fields: monitors/whyUseful/risks/executionMode |
| `apps/web/app/(app)/categories/grid-trading/page.tsx` | Depth fields; execution explicitly not claimed |
| `apps/web/app/(app)/categories/yield/page.tsx` | Depth fields; APR/APY limitation stated |
| `apps/web/app/(app)/categories/health-factor/page.tsx` | Depth fields; no synthetic position |
| `apps/web/lib/categories/x54.depth.verify.ts` | **New** 23-check depth/honesty verifier |
| `apps/web/lib/eight004scan/discovery/x53.category.verify.ts` | Assertion updated for renamed source label |
| `apps/web/package.json` | Registered X.54 verifier in `test` + `categories:x54:verify` |
| `docs/review/Main-Track-Activation-X54-Main-Track-Depth.md` | This report |

## Track status

| Track | Status | Basis |
|---|---|---|
| Rebalancing | PARTIAL | Real discovery + live price/liquidity context; execution absent by design |
| Grid Trading | PARTIAL | Real discovery + real swap activity; range never inferred; execution absent |
| Yield Optimisation | PARTIAL | Real discovery + TVL/turnover; APR/APY honestly unavailable |
| Health Factor Monitoring | PARTIAL | Real discovery; no position source, no synthetic value |
| PancakeSwap | PARTIAL | Read-only intelligence now integrated into three categories; no execution, no approvals |
| Altana | PASS | X.46 evidence preserved; no new transaction |
| ERC-8004 / 8004scan | PASS | Live registry reads, validation, bounded queries, honest states |
| ERC-8183 | PASS | Job 515 evidence preserved and untouched |
| TermiX | PARTIAL | Template unchanged; no measurements fabricated |
| x402 / B402 | PARTIAL | Boundaries unchanged |

## Remaining gaps

1. **Execution** for rebalancing/grid requires Altana custody plus a scoped permission design (blocked on X.52 infrastructure).
2. **APR/APY** needs a source that publishes it; estimation remains refused.
3. **Health factor values** need a lending-market reader for a connected account.
4. **Grid range guidance** needs a verified price-history source.
5. **Agent supply** depends on live registry contents; low match counts are real results.
6. **TermiX** measurements still to be run by a human operator.
7. **Prisma Windows engine packaging** (pre-existing) surfaces on local API routes.

## Final status

```text
X.54 STATUS: PASS WITH FINDINGS

MAIN TRACK:
  REBALANCING:              PARTIAL
  GRID TRADING:             PARTIAL
  YIELD OPTIMISATION:       PARTIAL
  HEALTH FACTOR MONITORING: PARTIAL

PANCAKESWAP:        PARTIAL
TERMiX:             PARTIAL
ALTANA:             PASS
ERC-8004/8004SCAN:  PASS
ERC-8183:           PASS
x402/B402:          PARTIAL

BUILD:  PASS
TESTS:  PASS (298 checks)
AUDIT:  PASS

MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT: NO
PUSH: NO
```
