# Main Track — PancakeSwap X.97 Eligibility & Evidence Audit

**Date:** 2026-08-21
**Track:** Main Track (Monique/Devika general agent — `kbd=general`)
**Objective:** Read-only audit of existing PancakeSwap work to determine whether it can
honestly satisfy the 1,000 CAKE PancakeSwap Challenge requirement ("Your agent must
deliver a real benefit to PancakeSwap traders or liquidity providers") and to identify
the exact proven benefit — without fabrication, without new execution, without deploy/commit/push.

---

## 0. Hard boundaries (X.97)

- NO AWS KMS / ALTANA keys / ERC-8183 activation / capability-source architecture.
- NO Hire modification, Hire bypass, Agent 1816 / Job 515 artifacts, mainnet interaction.
- NO fabricated PancakeSwap execution, swaps, LP transactions, yields, APR/TVL, trading
  results, user savings, or performance metrics.
- NO new PancakeSwap integration added merely to fill a missing field.
- NO reopening X.91. Default **NO CODE CHANGE** (Step 10).
- NO X.98. NO deploy / commit / push.
- Within read-only first: distinguish **DATA → ANALYSIS → RECOMMENDATION → MEASURABLE BENEFIT**.

---

## 1. Official challenge requirement (verbatim intent)

> "Your agent must deliver a real benefit to PancakeSwap traders or liquidity providers."

Stated example benefits:

1. Smarter liquidity management.
2. Finding better yields.
3. Researching market movements to find demand where creating PancakeSwap pools could
   improve liquidity efficiency.
4. Executing safe automated swaps using PancakeSwap products without putting user funds at risk.

---

## 2. Inventory of existing PancakeSwap work

| File                                                                | Role                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web/lib/pancakeswap/intelligence.ts`                          | **Option B** — keyless read-only market-intelligence adapter             |
| `apps/web/lib/pancakeswap/intelligence.verify.ts`                   | Offline verify harness — **10/10 PASS** (this audit)                     |
| `apps/web/lib/pancakeswap/client.ts`                                | Legacy NodeReal keyed loader (server-only, not used by Agent Details UI) |
| `apps/web/lib/pancakeswap/server.verify.ts`                         | Verifies client.ts server-only + no execution export                     |
| `apps/web/lib/pancakeswap/live.verify.ts`                           | Optional live probe (not run this audit)                                 |
| `apps/web/app/(app)/agents/[slug]/agent-detail-pancakeswap.copy.ts` | Framework-free display copy / formatters                                 |
| `apps/web/app/(app)/agents/[slug]/PancakeSwapPoolSection.verify.ts` | UI verify harness — **17/17 PASS** (this audit)                          |
| `apps/web/app/(app)/agents/[slug]/page.tsx:113-114`                 | `resolvePancakeSwap()` → `getPancakeSwapPoolIntelligence({ limit: 5 })`  |

---

## 3. What the Option B adapter actually does (verified)

**Data sources (both real, both keyless):**

- PancakeSwap **V2 pair registry on BSC mainnet (chain ID 56)** via public BNB Chain
  JSON-RPC `eth_call` — reads on-chain `getReserves()`. No wallet, no signing, no key.
- Official PancakeSwap price API (`explorer.pancakeswap.com`) for real USD prices — the
  same public API used by `pancakeswap-ai`.

**Computation:**

- `TVL = on-chain reserves × official USD price` (real, current).
- Bounded **head + tail sample** of the V2 registry, ranked by computed TVL.
- Fee tier shown as the V2 constant (0.25%).
- Reserves shown in human units; token prices shown in USD.

**Explicitly NOT available / NOT fabricated:**

- 24h volume = `null` (not on-chain) → rendered as honest "—".
- APR / APY = **never computed or shown** (not on-chain for V2) → never fabricated.
- No route comparison, no slippage/price-impact estimate, no execution-risk warning.
- No LP range / out-of-range / fee-opportunity analysis (V2 is full-range; concentrated
  liquidity management is a V3 concept and is not implemented).

**Read-only boundary (verified by `intelligence.verify.ts` test 8 + `intelligence.ts`
own constants):**

- No `eth_sendRawTransaction`, no `approve`, no `permit2`, no `addLiquidity`,
  no `removeLiquidity`, no swap functions, no credential surface.
- Mandatory read-only disclaimer in UI copy.
- `PANCAKESWAP_SOURCE = "pancakeswap"` (real source, not a simulation).

---

## 4. Capability classification (per X.97 levels)

| Level                                   | Definition                     | Status                                  |
| --------------------------------------- | ------------------------------ | --------------------------------------- |
| LEVEL 1 — read-only intelligence        | Real current data, no analysis | ✅ Present                              |
| LEVEL 2 — recommendation from real data | Rank/compare real data         | ◑ Partial (ranks pools by computed TVL) |
| LEVEL 3 — simulation                    | What-if on real data           | ❌ Absent                               |
| LEVEL 4 — execution                     | On-chain swap/LP action        | ❌ Absent (blocked by construction)     |

---

## 5. Benefit analysis (the heart of the audit)

### 5.1 Trader benefit

- **Real, current:** A trader sees which V2 pools have the deepest real liquidity
  (TVL from on-chain reserves) and current USD prices. This is genuine information.
- **Missing:** No best-execution route, no slippage/price-impact warning, no
  execution. The challenge's trader examples ("better yields", "safe automated swaps",
  "smarter execution") are **not met**.
- **Verdict:** PARTIAL — honest informational benefit, not a measurable trading improvement.

### 5.2 LP benefit

- **Real, current:** An LP sees real TVL, reserves composition, and fee tier for V2 pools.
- **Missing:** PancakeSwap V2 is full-range, so "smarter liquidity management" (a V3
  range/out-of-range concept) does not apply. No range analysis, no out-of-range
  detection, no fee-opportunity comparison, no yield comparison (APR = null).
- **Verdict:** PARTIAL — real data visibility, no management / yield optimization.

### 5.3 Market-demand / pool-creation research

- The output is a bounded head+tail sample of **existing** V2 pools ranked by TVL.
- It does **not** analyze market movements, identify demand gaps, or recommend where
  new pools improve efficiency.
- **Verdict:** PARTIAL input only — real liquidity data exists, but no demand analysis is performed.

### 5.4 Execution / safe automated swaps

- **BLOCKED.** The adapter is read-only by construction (verified). No swap/LP/tx path.
- The challenge's "executing safe automated swaps" example is **not supported**.

### 5.5 Measurable evidence

- Real TVL figures are computed from real reserves × real prices — honest and current,
  not fabricated.
- **No quantified user-benefit metric** exists (no "saved $X", "avoided Y slippage",
  "earned Z yield"). So measurable _outcome_ evidence is PARTIAL.

---

## 6. No-fabrication confirmation (Step 7)

- `intelligence.verify.ts` test 2: missing fields → `null`, never fabricated.
- `intelligence.verify.ts` test 8: read-only boundary (no wallet/signing/approve/swap/tx).
- UI verify test 9: APR/APY not fabricated (null + honest note).
- UI verify test 14: title + network-explicit description + read-only disclaimer.
- UI verify test 15: no direct browser fetch (prop-driven only) — all data server-side.
- Both harnesses: "no credential exposure (presence-only env check)".
- **Conclusion:** The existing feature fabricates nothing. It honestly presents its
  read-only scope. This is the opposite of the TermiX X.96 situation (which BLOCKED on
  a fabricated hire).

---

## 7. Evidence matrix (Step 8)

| Capability                          | Status     | Evidence                                                                            |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| PANCAKESWAP SOURCE (real, chain 56) | ✅ PASS    | `intelligence.ts` eth_call + official price API; `PANCAKESWAP_SOURCE="pancakeswap"` |
| TRADER BENEFIT                      | ◑ PARTIAL  | Real TVL/prices shown; no route/slippage/execution                                  |
| LP BENEFIT                          | ◑ PARTIAL  | Real TVL/reserves/fee tier; no range/yield analysis (V2 full-range)                 |
| MARKET/DEMAND RESEARCH              | ◑ PARTIAL  | Real data input only; no demand-gap analysis                                        |
| EXECUTION                           | ❌ BLOCKED | Read-only by construction; verify test 8                                            |
| MEASURABLE EVIDENCE                 | ◑ PARTIAL  | Real data shown; no quantified user outcome                                         |
| NO FABRICATION                      | ✅ PASS    | verify tests 2/8/9/14/15 + credential check                                         |
| MAIN TRACK UNAFFECTED               | ✅ PASS    | Isolated to agent-detail PancakeSwap block; no registry/job/tx change               |

---

## 8. Best qualifying path (Step 9)

- **A — Trader intelligence:** PARTIAL, genuine, the strongest honest position.
- **B — LP intelligence:** PARTIAL, limited by V2 full-range (no range management).
- **C — Market-demand research:** NOT supported by current code.
- **D — Execution / safe swaps:** BLOCKED.

**Recommendation:** The only honest qualifying posture is **A/B read-only intelligence**.
To move from "informational" toward the challenge's "real benefit" bar _honestly_, the
single defensible enhancement would be a **real price-impact computation** for a given
trade size — because PancakeSwap V2 `x*y=k` reserves make exact slippage computable from
the same on-chain data already read. That would convert "see liquidity" into "measure
your slippage risk" — a measurable trader benefit with zero fabrication. This is a future
feature, out of X.97 scope, and would require its own audit. It is **not** performed here.

---

## 9. Code changes (Step 10)

**NONE.** Default no-code-change honored. The existing work already honestly reflects its
read-only scope; there is no fabrication to correct and no missing field to fill with a
new integration. No files modified, no deploy/commit/push.

---

## 10. Verification (Step 11)

- `node --conditions=react-server --experimental-strip-types lib/pancakeswap/intelligence.verify.ts`
  → **10/10 PASS** + no credential exposure. Offline fixtures, no live data.
- `node --conditions=react-server --experimental-strip-types "app/(app)/agents/[slug]/PancakeSwapPoolSection.verify.ts"`
  → **17/17 PASS** + no credential exposure.
- Grep for execution surface (`swap`/`addLiquidity`/`removeLiquidity`/`router`/`permit2`/
  `sendRawTransaction`/`approve`/`executeSwap`) across `apps/web/lib/pancakeswap/*` and
  `apps/web/app/(app)/agents/[slug]/*` returned **only** the absence-assertions inside
  the verify harnesses and explanatory comments — no real execution code.
- Main Track unaffected: Option B is scoped to the agent-detail PancakeSwap block behind
  `kbd=general`; no other surface, agent registry entry, or job/tx path was touched.

---

## 11. Final classification (Step 13)

| Dimension              | Verdict                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| PANCAKESWAP SOURCE     | **PASS** (real on-chain reserves + official price API, chain 56, no fabrication)      |
| TRADER BENEFIT         | **PARTIAL** (real liquidity/price data; no execution/route/slippage analysis)         |
| LP BENEFIT             | **PARTIAL** (real TVL/reserves/fee tier; no range/yield optimization — V2 full-range) |
| MARKET/DEMAND RESEARCH | **PARTIAL** (real data input; no demand-gap analysis performed)                       |
| EXECUTION              | **BLOCKED** (read-only by construction; no swap/LP/tx path)                           |
| MEASURABLE EVIDENCE    | **PARTIAL** (real data shown; no quantified user-outcome metric)                      |
| NO FABRICATION         | **PASS**                                                                              |
| MAIN TRACK UNAFFECTED  | **PASS**                                                                              |
| CHALLENGE ELIGIBILITY  | **PARTIAL**                                                                           |
| OVERALL X.97           | **PARTIAL**                                                                           |

---

## 12. Honest bottom line

The existing PancakeSwap work is a **real, keyless, read-only market-intelligence panel**
that surfaces **genuine current** PancakeSwap V2 pool liquidity (TVL from on-chain
reserves × official USD price), reserves, and fee tier to traders and LPs — with a
mandatory read-only disclaimer and explicit "—" where data is unavailable (24h volume,
APR/APY). It fabricates nothing and executes nothing.

It delivers a **real but modest informational benefit**. It does **not** satisfy the
stronger challenge examples (better yields, smarter LP management, demand-gap research,
safe automated execution). Therefore:

- It is **submission-safe as an honest read-only feature** (unlike the TermiX X.96 case,
  which fabricated a hire and was BLOCKED).
- Whether read-only liquidity intelligence alone qualifies as "deliver a real benefit"
  is a **judge's call**; we must not overstate it as execution, yield, or management.
- The only honest way to strengthen it toward the challenge bar is a **real
  reserve-based price-impact (slippage) computation** — a future, separately-audited
  feature, **not** done in X.97.

**No code changed. No deploy. No commit. No push. STOP after X.97.**
