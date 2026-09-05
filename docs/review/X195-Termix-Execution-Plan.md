# X.195 — TermiX Qualification Execution Plan

**Date:** 2026-08-30 · **Mode:** READ-ONLY / NO EXECUTION · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Source:** UNMODIFIED · **Commit/Push/Deploy:** NONE

> Execution plan only. No transaction, no wallet signature, no job created. Previous Job-ID predictions (808/809/810) are **NOT reserved** — read-only probe shows `jobCounter = 835` (next would be `836`). Future job IDs must be read from actual receipts/contract state at execution time.

---

## 1 · Official TermiX Requirement

**Source (authoritative, X.194):** `https://www.bnbchain.org/en/hackathons/smart-money-era` → Tracks → TermiX Challenge.

| Requirement (verbatim) | Implication |
|---|---|
| At least **3 real tasks run both ways**: with an agent **hired through your marketplace** vs without | Each counted task's Arm B is a **funded ERC-8183 marketplace Hire** |
| For each: report **time, cost, output quality**, with **actual outputs attached** | Per-task metrics + saved artifacts |
| At least one task from **trading, stock or security** | Security satisfied by a hired task's category |
| Marketplace quality: find, compare, hire without instructions | Existing live product satisfies |
| **TermiX will hire from your marketplace themselves** | Live Hire path must work |

**Determined from the official text (no invention):**
- **Number of required hired tasks:** **at least 3** (all three counted tasks must have a hired Arm B). Existing Tasks 1-3 have **0 hired** Arm B → they do not satisfy the strict reading by themselves.
- **Each task must be separately hired:** yes — each is a different real task with its own input/output; one Job cannot be the deliverable for three tasks.
- **One hired agent may perform multiple tasks:** allowed (official text does not require different agents), but each is a **separate Hire / separate Job**.
- **Each hired task needs a separate marketplace Hire:** yes — separate `createJob…fund` sequence per task.
- **Completed/submitted ERC-8183 job required:** **yes for the work product** — the deliverable must be `submit`ted (on-chain `deliverable` hash) so output quality can be scored and outputs attached.
- **FUNDED alone sufficient?** **NO** — FUNDED with zero deliverable (like Job 787) provides no work product to score.
- **Actual deliverable/work product required:** **yes** — this is the core of "proven agent advantage".
- **Trading/stock/security:** at least one of the three hired tasks must be **security** (or trading/stock).
- **Time / cost / quality / outputs:** all required per task.

---

## 2 · Existing Tasks 1-3 (inventory)

| Item | Task 1 — Yield-agent discovery | Task 2 — Cross-category triage | Task 3 — Security (402 screening) |
|---|---|---|---|
| Objective | Identify chain-56 yield-optimisation agents | Count agents per Main Track category | Decide if an untrusted 402 is safe (chain 97 only; refuse mainnet) |
| Arm A (baseline) | Direct 8004scan query + naive substring | 4 direct queries + naive screening | Unaided field inspection (ACCEPTED mainnet — fail) |
| Arm B | `lib/eight004scan/discovery/` classifier + provenance | Same classifier across 4 categories | `parsePaymentRequired` + chain-pinned `selectPaymentRequirement` |
| Input | category `yield-optimisation`, 8004scan corpus | 4 category keys | 3 fixture 402 bodies |
| Output | 58 matched + evidence excerpt | rebal 30/grid 3/yield 58/health 3 + justification | accept/refuse + reason |
| Time | 1426 vs 5513 ms | 4159 vs 4214 ms | 2 vs 0 ms |
| Cost | 1 vs 1 req (USD NOT MEASURABLE) | 4 vs 4 req | 0 vs 0 |
| Quality | 22/25 vs 9/25 | 23/25 vs 8/25 | 24/25 vs 7/25 |
| Evidence | `task-01/{input,arm-a,arm-b,adjudication}.json` | `task-02/*.json` | `task-03/*.json` |
| Category | yield | all 4 | **security** |
| Hired through marketplace? | **NO** | **NO** | **NO** |

**Existing Tasks 1-3 do NOT satisfy "hired through marketplace".** Their quality/time/cost/outputs evidence is real and reusable as the *baseline/method* precedent, but the qualification gap is Arm B = **not a funded Hire**.

---

## 3 · Exact Qualification Gap

- **Gap:** all 3 existing tasks use the **discovery classifier** as Arm B, not a **funded ERC-8183 Job**.
- **Job 787 does NOT qualify:** FUNDED (`status 1`), budget `1000000000000000` (0.001 U), **deliverable = zero**, `submittedAt = 0` → **no work product**. It proves Hire works but cannot be scored as a task output.
- **To reach STRICT QUALIFIED:** perform **3 real tasks, each hired through the marketplace** (funded Job → `submit` deliverable), with time/cost/quality + outputs, at least one being security (or trading/stock).
- **Broad-reading fallback:** if a judge accepts 1 hired task as sufficient demonstration (or hires themselves), 1 new hired task upgrades to **PARTIAL+ / QUALIFIED-broad**; X.195 keeps the strict, honest 3-task standard as the target.

---

## 4 · Agent 2005 Suitability (read-only verified)

| Item | Value (read-only) |
|---|---|
| Identity | `97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005` — Canned Range Keeper |
| On-chain card | `tokenURI(2005)` resolves (len 833, `data:`) → registered endpoint |
| Endpoint | `https://range-keeper.103-195-188-198.sslip.io/erc8183` (resolved read-only) |
| /negotiate | returns fresh quote; `provider_sig` verified vs registered owner (X.155C/X.168) |
| Owner/provider | `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a` |
| Chain / commerce / token | 97 · `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` · `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` ($U) |
| Observed price | 0.001 U (`1000000000000000` wei) at verification time |
| `HIRE_TASK_DESCRIPTION` | `"Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution."` |
| `HIRE_TERMS` | `{deliverables:"JSON analysis report", quality_standards:"Deterministic output with explicit assumptions and no execution claims", success_criteria:["valid JSON","chain 97 only"]}` |

**Can Agent 2005 produce a legitimate analytical deliverable?** **Yes, by design** — its own negotiation terms promise a **JSON analysis report** (deterministic, chain-97 only). A grid-strategy / range-strategy report is a research/analysis deliverable (not trading execution, no custody). **But the seller must actually return quality JSON after `submit`** — an external liveness/quality dependency (the plan fails closed if the seller returns null / bad sig / empty).

---

## 5 · Minimum Required Hired-Task Set

Design rule: smallest defensible set that reaches strict QUALIFIED = **3 hired tasks**, each via the existing production Hire flow. Reuse the frozen rubric. One task must be security.

| # | TASK NAME | Agent | Hire | Deliverable | Category | Why it qualifies |
|---|---|---|---|---|---|---|
| 4 | Grid-strategy range report | Agent 2005 | Yes | JSON grid/range-strategy analysis (deterministic, chain 97 only) | yield/trading-adjacent (research) | Real hired analytical work product |
| 5 | Marketplace discovery vs baseline (hired agent screens registry) | Agent 2005 (hired) — agent returns a justified discovery shortlist | Yes | JSON shortlist with evidence excerpts | market research | Hired agent produces a scorable research deliverable |
| 6 | Security: hired agent screens an untrusted 402/chain policy | Agent 2005 (hired) — returns a JSON security verdict | Yes | JSON accept/refuse verdict + reason | **security** | Satisfies trading/stock/security requirement |

**Baseline/manual method (per task):** same prompt, naive/unaided procedure (direct 8004scan query or manual reasoning), timed identically, costed (0 / requests), saved artifacts — mirrors Tasks 1-3.
**Agent method:** fund Job → `submit` deliverable → independent `getJob` verification (`FUNDED→SUBMITTED`, deliverable hash set).
**Metrics:** elapsed ms (Hire click → fund receipt → submit receipt) vs baseline; cost ($U + gas vs 0); quality via frozen D1-D5 rubric, adjudication of divergences.
**Estimated payment:** 0.001 U per task (observed quote; actual = verified quote at execution, dynamic).
**Estimated gas:** ~0.0009–0.0015 BNB per tx × 6 tx ≈ **0.005–0.009 BNB per task** (estimate only — read at execution).
**Blockchain transactions:** 6 per task (5 hire + 1 submit) × 3 = **18 total**.
**Risk:** seller liveness/quality (external); broadcast reliability (X.148-class RPC); all new Jobs independent of 787.
**Failure modes:** quote rejected/expired, bad provider_sig, seller never submits quality JSON, RPC broadcast failure.

**All future Job IDs: NOT YET CREATED** (read-only `jobCounter = 835` today; ids will be read from actual receipts/state at execution).

---

## 6 · Transaction Plan (per hired task; verify against deployed impl at execution)

| # | Tx | Signer | Contract | Purpose | Asset/value | State transition | Failure condition |
|---|---|---|---|---|---|---|---|
| 1 | `createJob` | User EIP-1193 wallet | Commerce `0xa206…` | Create job (Open) | 0 | OPEN | revert |
| 2 | `registerJob` | User wallet | Router `0xD7d3…` | Bind policy | 0 | Open+policy | revert / policy not whitelisted |
| 3 | `setBudget` | User wallet | Commerce | Set 0.001 U budget | 0 | OPEN+budget | revert |
| 4 | `approve` | User wallet | $U `0xc70B…` | Approve Router to spend budget | 0.001 U allowance | allowance set | revert / insufficient $U |
| 5 | `fund` | User wallet | Router | Deposit escrow | 0.001 U | FUNDED | revert / not approved |
| 6 | `submit` | **Provider** (seller) wallet | Commerce | Commit deliverable hash | 0 | SUBMITTED (deliverable set) | revert / never called |

- **Total per task:** 6 tx. **Total for 3 tasks:** 18 tx (15 wallet-signed hire + 3 provider-signed submit).
- **Total $U exposure:** 3 × 0.001 = **0.003 U** (escrow, refundable only if claimable; realistically spent for the deliverables).
- **Gas:** estimate only — **~0.016–0.027 BNB total** (18 × ~0.0009–0.0015). Not exact.
- **Failure:** any revert/rejection stops; no rebroadcast (X.165 idempotency guard applies).

---

## 7 · Evidence Capture Plan

Propose directories only (do NOT create):
- `docs/termix/evidence/task-04/`
- `docs/termix/evidence/task-05/`
- `docs/termix/evidence/task-06/`

Each future task package (mirrors Tasks 1-3 + hire specifics):
- `input.json` (task prompt + terms)
- `quote.json` (negotiate envelope) + `quote-verification.json` (provider_sig vs owner)
- `job.json` (jobId read from receipt/state, chain, client, provider, budget)
- `tx-hashes.json` (createJob/registerJob/setBudget/approve/fund/submit + timestamps + gasUsed)
- `arm-b-paid-marketplace.json` (hired agent: elapsed, requests, costWei+gas, deliverable hash, output)
- `deliverable.json` (the actual agent output)
- `arm-a-baseline.json` (manual: elapsed, requests, cost 0, output)
- `baseline-output.json`
- `adjudication.json` (divergence rulings)
- `quality-scoring.json` (D1-D5 per arm)
- `run-metadata.json` (timestamps, node version, caveats)

All values from executed runs; no fabrication.

---

## 8 · Quality Methodology

**Existing methodology (EXPERIMENT-PROTOCOL.md):** frozen rubric D1-D5 (0-5 each, max 25), scored by same scorer from saved artifacts only, `NOT ASSESSABLE` for unscorable dims, deviation log. Applied identically to both arms.

**Can it apply to future hired tasks?** **Yes** — the rubric is task-agnostic (Correctness/Completeness/Actionability/Data-source/Risk-awareness). No change needed. **Do not alter the rubric to improve scores**; reproducibility and artifact-only scoring preserved. One addition: hired-task quality also includes **deliverable validity** (valid JSON, chain-97 only) — objective, pre-registered in HIRE_TERMS.

---

## 9 · Main Track Safety

| Check | Result |
|---|---|
| Change Main Track marketplace behavior | **NO** — uses existing production Hire flow |
| Change ERC-8004 discovery | **NO** |
| Change ERC-8183 implementation | **NO** |
| Change Dashboard lifecycle logic | **NO** (new funded Jobs appear via existing X.168 scan — expected) |
| Change Job 787 | **NO** |
| Change wallet architecture | **NO** (user EIP-1193, browser-wallet, Model B) |
| Change Model A / Model B | **NO** |
| Add server custody / AWS/KMS / private keys | **NO** |

---

## 10 · GO / NO-GO Matrix

| Item | Ready | Missing | Risk |
|---|---|---|---|
| Live marketplace Hire (Model B) | YES | — | LOW (broadcast RPC X.148-class) |
| Agent 2005 live seller + endpoint | YES (read-only verified) | — | MEDIUM (seller liveness/quality) |
| Quote + provider signature verification | YES | — | LOW |
| Submit path + deliverable capture | YES (SDK supports) | none at app layer | MEDIUM (seller must actually submit) |
| 3 existing A/B tasks (time/cost/quality/outputs) | YES | hired-Arm-B | — |
| 3 hired tasks + deliverables | NO | **needs 3 funded Hires + 3 submits (on-chain)** | HIGH (funds + external seller) |
| Security-category hired task | NO | needs a hired security task (task-06) | LOW |
| Job IDs | NOT YET CREATED | read at execution | LOW |
| Gas / $U funds | Need funded testnet wallet | confirm balance/allowance at execution | LOW |

**TERMIX STRICT QUALIFICATION: NOT READY** — blocker: **0 of 3 required tasks currently have a hired Arm B**; strict QUALIFIED needs **3 funded marketplace Hires + 3 submits** (18 tx, ~0.003 U + gas, real deliverables), which is an **on-chain execution** that X.195 does not perform.

---

## 11 · User Authorization Checkpoint

**NO TRANSACTION SHOULD BE EXECUTED FROM X.195.**

**OPTION A — Do nothing:** remain **PARTIAL** (report is honest, eligible, strong on quality/time/cost/outputs/security; strict hired-task gap remains).

**OPTION B — Authorize exactly 3 marketplace hires for TermiX qualification** (Task 4 grid-strategy, Task 5 hired discovery, Task 6 hired security; 6 tx each = 18 total, ~0.003 U + gas, each with full evidence capture in `docs/termix/evidence/task-04/05/06/`).

If Option B is selected, execution must happen in a **NEW, explicitly authorized step**. Never infer authorization from "go ahead" for X.195.

---

## 12 · Final Output

```
X.195 TERMIX EXECUTION PLAN

1. Official requirement     — ≥3 real tasks each hired through the marketplace vs without;
                             time/cost/output-quality + actual outputs; ≥1 trading/stock/security.
2. Existing Tasks 1-3       — yield 22/25 vs 9/25 · triage 23/25 vs 8/25 · security 24/25 vs 7/25;
                             all real, artifact-backed, 0 hired.
3. Exact gap                — Arm B is the discovery classifier, not a funded Hire;
                             Job 787 (FUNDED, zero deliverable) cannot be a task.
4. Agent 2005 suitability   — YES for analytical JSON deliverables (HIRE_TERMS promise a
                             deterministic chain-97 report); live endpoint + quote verified read-only;
                             external seller-quality dependency.
5. Minimum hired-task set   — 3 hired tasks (grid-strategy, hired discovery, hired security).
6. Future tx sequence       — createJob → registerJob → setBudget → approve → fund → submit (6/task).
7. Estimated U exposure     — 3 × 0.001 = 0.003 U escrow.
8. Estimated gas            — ~0.016–0.027 BNB total (estimate, read at execution).
9. Evidence capture         — docs/termix/evidence/task-04|05|06/ (proposed dirs, not created).
10. Quality methodology     — frozen D1-D5 rubric reused unchanged; artifact-only scoring.
11. Main Track impact       — none (existing Hire flow; no Job 787 / discovery / wallet / Model A/B change).
12. Risk matrix             — seller liveness/quality (MEDIUM), RPC broadcast (LOW/MEDIUM), 18-tx scope (HIGH as on-chain).
13. GO / NO-GO              — NOT READY for strict qualification; blocker = 0 hired tasks.
14. Explicit authorization  — REQUIRED (Option B = exactly 3 hires) in a NEW step.

SAFETY:
Transactions: 0
Signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
Deploy: NO
Commit: NO
Push: NO
Credentials: NONE

HARD STOP.
```
