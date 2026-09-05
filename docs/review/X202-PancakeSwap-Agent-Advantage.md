# X.202 PancakeSwap Agent Advantage

**Date:** 2026-08-30 · **Mode:** READ-ONLY INTELLIGENCE ENHANCEMENT · **Transactions:** ZERO · **Signatures:** ZERO · **Swaps/Approvals/Liquidity:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Main Track logic:** UNCHANGED · **Credentials:** NONE · **Commit/Push/Deploy:** NONE

---

## Objective

Turn the existing read-only PancakeSwap market intelligence (Option B: keyless `eth_call` + official price API, X.177/X.202-era) into a judge-visible **"Agent Advantage"** experience — truthful takeaways for traders and LPs derived purely from measured data, with no fabricated metrics and no execution. Read-only intelligence, NOT automated trading.

---

## Existing Data (availability matrix)

| Metric | Status |
|---|---|
| Token pair (symbols/addresses) | AVAILABLE |
| Token prices (USD, official PancakeSwap price API) | AVAILABLE |
| Reserves (on-chain, `getReserves`) | AVAILABLE |
| TVL (computed = reserve × price) | AVAILABLE (DERIVABLE) |
| Fee tier (official V2 constant 0.25%) | AVAILABLE |
| Pool ranking (by computed TVL, within sample) | AVAILABLE |
| Pool sample scope (bounded W=8 head/tail) | AVAILABLE |
| Volume 24h | **NOT AVAILABLE** (`null`, honest) |
| APR/APY | **NOT AVAILABLE** (`null`, honest) |
| Price change (historical) | **NOT AVAILABLE** |
| Liquidity depth classification | **DERIVABLE SAFELY** (from sampled TVL) |
| Demand signal (Rising/Stable/Falling) | **NOT DERIVABLE** (no volume/price-change data) |

---

## New Derived Signals

Pure model `deriveAgentAdvantage(intelligence)` — `apps/web/lib/pancakeswap/advantage.ts` (framework-free, no network, no wallet, no writes, deterministic, fail-closed):

- **Liquidity signal:** `Strong` (≥ $10M TVL) / `Moderate` (≥ $1M) / `Thin` (< $1M) / `Insufficient data` — bands on computed TVL of the **sampled, priced pools only**, evidenced "Derived from observed pool reserves × official USD prices".
- **Demand signal:** always **`Insufficient data`** — deliberately not derivable (no volume or price-change history); limitation stated verbatim. Never fabricated.
- **Fee tier label:** `0.25%` from the official V2 constant ("Official PancakeSwap V2 fee-tier constant"); `—` when absent.
- **Ranking explanation:** deepest-sampled pool (symbol + TVL) is identified; sample-scoped ("Across the N sampled priced pools…").
- **Trader takeaway:** factual — which sampled pool holds the deepest computed liquidity, what deeper liquidity means for order size, and that volume is unavailable.
- **LP takeaway:** factual — deepest pool + fee tier accruing to LPs; explicitly states APR/APY cannot be derived and is not estimated.
- **Evidence labels:** "Derived from observed pool reserves × official USD prices", "Based on sampled PancakeSwap pools", "Official PancakeSwap V2 fee-tier constant".
- **Limitations:** 24h volume not available · APR/APY not derivable and never estimated · demand trend not derivable · signals describe the bounded registry sample, not the full ecosystem.

No "AI predicts / Guaranteed / Best investment / Profitable / High APY" language anywhere.

---

## Trader Benefit

A trader can see, from real on-chain reserves and official USD prices, **where the deepest liquidity sits among the sampled pools** — the deepest-sampled pool (symbol + computed TVL) is identified, so a trader knows which sampled pair has the most real depth before sizing an order. Honest boundaries: 24h volume is unavailable, and the view is a bounded sample (head/tail window), never an ecosystem-wide ranking.

---

## LP Benefit

An LP can see which sampled pool concentrates the deepest real liquidity (reserve-backed TVL), plus the official 0.25% swap-fee constant that accrues to LPs — factual inputs for judging where liquidity already sits. Honest boundary: **APR/APY cannot be derived from on-chain reserves alone and is never estimated**; no return is claimed.

---

## Data Limitations

- 24h volume: not available on-chain → `null` (never 0).
- APR/APY: not available → `null`; never inferred from TVL.
- Demand trend: not derivable (needs volume or price-change history) → "Insufficient data".
- Sample scope: bounded registry window (W=8 head/tail), stated verbatim — "Based on sampled PancakeSwap pools"; never a full-ecosystem claim.
- Read-only: no swaps, approvals, or liquidity transactions exist anywhere in the path.

---

## UI Changes

`apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` — added `AgentAdvantageBlock` inside the existing `PancakeSwapPoolSection` (below the pool cards, above the read-only disclaimer), rendered only when the data is `ready`:

```
Agent Advantage                                   [↑ Read-only intelligence]
┌ For Traders ────────────────┐  ┌ For LPs ─────────────────┐
| Across the N sampled priced |  | <symbol> is the deepest-  |
| pools, <symbol> holds the    |  | sampled pool ($TVL, 0.25% |
| deepest computed liquidity… |  | swap fee accruing to LPs).|
| Volume is not available.     |  | APR/APY cannot be derived…|
└──────────────────────────────┘  └───────────────────────────┘
Liquidity Strong · Demand Insufficient data · Fee tier 0.25%
Why this matters: … (one concise factual line)
Evidence: [Based on sampled pools] [Derived from observed reserves…] [fee-tier constant]
Limitations: volume · APR · demand · sample — stated verbatim
```

Design: token-driven warm-white theme, existing Marketplace card system (`rounded-xl border bg-card/40`, `rounded-lg border-border/60`), compact spacing (`p-4/p-3`), semantic emphasis (muted for Insufficient data, foreground for real values), no gradients/glows, mobile-responsive (`grid-cols-1 sm:grid-cols-2/3`), no horizontal overflow. No dashboard overdesign.

Existing intelligence pipeline (`intelligence.ts`) **unchanged** — no rewrite, no second data source.

---

## Tests

New pure-model harness `apps/web/lib/pancakeswap/advantage.verify.ts` (`pnpm --dir apps/web run pancakeswap:advantage:verify`): **29 checks PASS** — sufficient data, missing data (undefined/null/non-ready), zero-TVL exclusion, null APR never claimed, one pool, multiple pools → deepest selected, bounded sample respected, malformed values (NaN/negative) → no signal, no fabricated demand, trader takeaway (sample-scoped + volume honesty + no profitability language), LP takeaway (fee tier + deepest pool + refuses APR estimation + no profitability language), evidence labels, limitations verbatim, fee-tier label + NaN guard, depth bands (thin/moderate/strong edges), purity (no network/wallet/tx tokens, no second data source).

Full suite (X.202 run):
- `marketplace:verify`: **104 PASS**
- `discovery:verify`: **60 PASS**
- `compare:verify`: **10 PASS**
- `dashboard:hires:verify`: **PASS (24 checks)**
- `pancakeswap:intel:verify`: **10/10 PASS**
- `pancakeswap:ui:verify`: **17/17 PASS**
- `pancakeswap:advantage:verify`: **29/29 PASS (new)**
- `web typecheck`: **PASS**
- `web lint`: **PASS**
- `web build`: **PASS (12/12)**
- `prettier`: **PASS** (advantage.ts + advantage.verify.ts + agent-detail-view.tsx via write)
- `git diff --check`: **PASS** (no whitespace errors)

---

## Safety

```
Transactions: 0
Signatures: 0
Swaps: 0
Approvals: 0
Liquidity transactions: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
Main Track logic: UNCHANGED
Credentials: NONE
```

## Git

```
Commit: NONE
Push: NONE
Deploy: NONE
(Files: apps/web/lib/pancakeswap/advantage.ts + advantage.verify.ts [new],
 agent-detail-view.tsx + package.json [advantage block + script] — unstaged.
 Prior X.186 permissions/page.tsx remains uncommitted, unrelated.)
```

> Not deployed — no production claim made. README/SUBMISSION untouched.

**FINAL HARD STOP.**
