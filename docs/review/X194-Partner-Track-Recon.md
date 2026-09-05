# X.194 — Partner Track Reconnaissance (TermiX + PancakeSwap)

**Date:** 2026-08-30 · **Mode:** READ-ONLY RECON · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs:** ZERO · **Job 787:** UNTOUCHED · **Source:** UNMODIFIED · **Commit/Push/Deploy:** NONE

> Reconnaissance only. No code changed. Main Track production is FROZEN. Existing artifacts re-located and gap-mapped against official requirements.

---

## 1 · TermiX Existing Artifacts

| Artifact | Path |
|---|---|
| Agent Advantage Report | `docs/termix/Agent-Advantage-Report.md` |
| Pre-registered protocol (frozen before run) | `docs/termix/EXPERIMENT-PROTOCOL.md` |
| Reproducibility | `docs/termix/REPRODUCIBILITY.md` |
| Evidence (per task: input + arm-a-baseline + arm-b-marketplace + adjudication) | `docs/termix/evidence/{RUN-METADATA,QUALITY-SCORING}.json`, `task-01/*.json`, `task-02/*.json`, `task-03/*.json` |
| Analysis reports | `docs/review/X173-Termix-Qualification-Gap.md`, `X174-Termix-Task4-Execution-Plan.md`, `X175-Termix-Full-Qualification-Strategy.md`, `Main-Track-Termix-X95/X96…`, `X57…`, `X74…`, `TermiX-AACP-*` |
| Reputation integration (read-only) | `packages/integrations/src/termix/*` + `apps/web/lib/termix/reputation.ts` |

**Report exists — summary of the 3 experiments (2026-08-16, harness `apps/web/lib/termix/advantage-harness.ts`):**

| Task | Arm B (marketplace) | Arm A (baseline) | Time | Cost | Quality | Outputs attached |
|---|---|---|---|---|---|---|
| 1 Yield-agent discovery (chain 56) | discovery classifier, 58 matched + provenance | naive substring, 62 selected | 1426 vs 5513 ms | 1 vs 1 req (monetary NOT MEASURABLE) | 22/25 vs 9/25 | YES `task-01/*.json` |
| 2 Cross-category triage (4 categories) | 30/3/58/3 + per-category justification | 30/6/62/10 | 4159 vs 4214 ms | 4 vs 4 req | 23/25 vs 8/25 | YES `task-02/*.json` |
| 3 Security (untrusted 402) | chain-pinned REFUSE mainnet | unaided ACCEPT mainnet (fail) | 2 vs 0 ms | 0 vs 0 req | 24/25 vs 7/25 | YES `task-03/*.json` |

**Required evidence present:** 3 real tasks both ways (yes) · time (yes) · cost (requests + honest `NOT MEASURABLE` USD) (yes) · output quality (rubric D1-D5) (yes) · actual outputs attached (yes) · **security task satisfies the trading/stock/security requirement** (yes).

**Missing (strict reading):** none of the 3 tasks' Arm B is a **funded ERC-8183 Job hired through the marketplace** — Arm B is the discovery classifier. `Job 787` is FUNDED but has **no deliverable** (zero, not SUBMITTED), so it cannot be a task output. **TermiX = PARTIAL** under the strict "hired through marketplace" reading (X.173 confirmed; a paid hire is required to reach QUALIFIED).

---

## 2 · PancakeSwap Existing Implementation

**Source files:** `apps/web/lib/pancakeswap/intelligence.ts` (keyless read-only Option B), `intelligence.verify.ts` (10), `PancakeSwapPoolSection.verify.ts` (17), `client.ts` (legacy keyed NodeReal, blocked - no `PANCAKESWAP_API_KEY` in prod), `live.verify.ts`/`server.verify.ts`.

**Components/routes:** `apps/web/app/(app)/agents/[slug]/page.tsx` (`resolvePancakeSwap()` in `Promise.all`) → `agent-detail-view.tsx` → `PancakeSwapPoolSection`; copy in `agent-detail-pancakeswap.copy.ts`.

**Data adapters:** public BNB RPC `eth_call` on V2 factory `0xcA143…` (`allPairsLength`, `allPairs(i)`, `token0/1`, `getReserves`, `symbol/decimals`) + official price API `explorer.pancakeswap.com/api/cached/tokens/price/list/56:0x…` → `TVL = reserve*price`, ranked, honest-null APR, bounded `W=8`, `PANCAKESWAP_READ_ONLY_BOUNDARY=true`.

**Tests:** `pancakeswap:intel:verify` 10/10, `pancakeswap:ui:verify` 17/17 (re-verified 2026-08-30, PASS).

**Production status:** **LIVE** (deployed, HTTP 200; verified via probe below).

**Live probes (2026-08-30):** `GET /agents/97:0x8004A818…:2005` → **200**; contains `PancakeSwap Market Intelligence` (true), `Read-only market intelligence` (true), `TVL (est.)` (true), `Fee tier` (true), `sample` scope (true), `chain 56` (true).

**What a judge currently sees on Agent Detail → PancakeSwap Market Intelligence:** a read-only panel with source chip `PancakeSwap · BSC mainnet · Chain ID 56`, banner *"Read-only market intelligence - no swaps or liquidity transactions are executed by this marketplace."*, pool cards (TVL est. from on-chain reserves x official prices, both token USD prices, reserves, fee tier 0.25%, honest `24h volume —`), sample-scope line. **Value it enables:** LP/trader can identify which sampled pools have real TVL + real prices (market/demand research); no automation, no APR, no swap.

---

## 3 · Current Judge-Visible Experience

| Surface | Visible now |
|---|---|
| Marketplace → Agent 2005 detail | **PancakeSwap Market Intelligence** (real TVL/prices, read-only, honest) + Hire CTA + registry/verification + TermiX reputation (read-only) |
| Dashboard | `Your hired agents` + `Funded hires` + `Job #787 FUNDED 0.001 U` + expired lifecycle notice + disabled `Claim refund` + `Net P&L Not available` |
| TermiX | Evidence lives in `docs/termix/` (not judge-visible in-app except read-only reputation) - the report is a submission artifact |
| Main Track | Fully live (frozen) |

---

## 4 · Requirement Gap Matrix

### TERMIX

| Requirement | Existing evidence | Missing | Severity | Recommended next implementation |
|---|---|---|---|---|
| ≥3 real tasks both ways | 3 tasks, both arms, real outputs attached | Arm B not a **funded marketplace hire** (discovery only) | **HIGH** (blocking strict QUALIFIED) | **Task 4 paid hire** (X.174/X.175): hire Agent 2005 via marketplace (0.001 U, 5-tx + submit), capture time/cost/quality + deliverable JSON vs baseline. Requires explicit authorization (on-chain). |
| time / cost / output quality per task | Quantified for all 3 | None (cost USD NOT MEASURABLE - honest) | LOW | None needed |
| Actual outputs attached | Attached for all 3 | None | LOW | None needed |
| ≥1 trading/stock/security | Task 3 = security | None | LOW | None needed (requirement satisfied) |
| Marketplace quality | Find/compare/hire live | None | LOW | None needed |

### PANCAKESWAP

| Requirement | Existing evidence | Missing | Severity | Recommended next implementation |
|---|---|---|---|---|
| Real trader/LP benefit | Read-only market/demand research (TVL + prices) live | No **automated** benefit; no APR; no measured user outcome | **MEDIUM** (bounty = PARTIAL) | Low-risk: strengthen research value (e.g., add a **yield/APR source** or **slippage/depth** metric) without TX; or P2: none required for PARTIAL |
| Smarter liquidity management | - | Requires on-chain LP ops + before/after | HIGH (funds at risk) | Do NOT pursue (mainnet funds risk, P1) |
| Better yield discovery | TVL/price only, `apr null` | Real APR source | MEDIUM | Add read-only APR/yield field if a reliable source exists |
| Market-demand research for pool creation | Sample TVL/prices (head/tail W=8) | **Census-scale demand signal** | MEDIUM | Expand bounded discovery window / add token-price-movement demand heuristic (read-only) |
| Safe automated swaps | Not claimed (read-only by design) | Automation + safety proof | HIGH (funds) | Do NOT pursue automatically |

---

## 5 · Highest-Impact Next Steps (smallest number)

1. **[TermiX] Execute Task 4 paid hire** (authorized, on-chain): hire Agent 2005 → funded Job → submit deliverable → full A/B evidence → TermiX PARTIAL → QUALIFIED-broad / strong PARTIAL. **This is the single highest-impact action** for partner qualification.
2. **[PancakeSwap] Read-only enhancement (no TX):** add a real APR/yield or demand/slippage signal to Option B and/or widen the discovery window, then re-verify + deploy - moves PancakeSwap from "research only" toward "better yield discovery" without funds at risk.
3. **[Both] Update submission docs** (README/SUBMISSION/termix report) to present the honest upgraded state after any of the above.

---

## 6 · Files That Would Need Modification (future, not now)

- **TermiX Task 4 (when authorized):** new evidence under `docs/termix/evidence/task-04/` + supplement in `docs/termix/Agent-Advantage-Report.md`; no app source change required (Hire is live). Possibly a small `submit`/deliverable helper.
- **PancakeSwap read-only enhancement:** `apps/web/lib/pancakeswap/intelligence.ts` (+`intelligence.verify.ts`, `agent-detail-pancakeswap.copy.ts`, `PancakeSwapPoolSection.verify.ts`) - additive read-only fields only.
- **Docs:** `README.md`, `docs/SUBMISSION.md`, `docs/termix/Agent-Advantage-Report.md`.

**NOT to be touched:** `lib/integrations` (unless required post-recon), `prisma`, ERC-8183 hire logic, ERC-8004 discovery, wallet/SIWE, Job 787, dashboard lifecycle logic, Main Track.

---

## 7 · Safety Boundary Confirmation

```
No source modified:      YES - recon only
No transactions:         0
No wallet signatures:    0
No jobs created:         0
Job 787:                 UNTOUCHED (FUNDED 0.001 U, expired, read-only)
Agent 2005/1906:         UNTOUCHED
No commit/push/deploy:   YES
No credentials/API keys: YES
No fake metrics / no autonomous-trading claim / no live-execution claim for read-only Option B / no P&L without real dataset: YES
```

**X.194 RECON: PASS**

**HARD STOP.**
