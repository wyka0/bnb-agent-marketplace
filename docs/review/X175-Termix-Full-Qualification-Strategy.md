# X.175 — TermiX Full-Qualification Strategy Audit

**Date:** 2026-08-30 · **Mode:** READ-ONLY AUDIT · **Transactions:** ZERO · **Wallet signatures:** ZERO · **New jobs:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Production:** UNCHANGED · **Source:** UNCHANGED

> No `eth_sendTransaction`, no `eth_sendRawTransaction`, no `createJob`/`registerJob`/`setBudget`/`approve`/`fund`/`submit`, no jobId reservation, no wallet popup. This is a strategy audit only.

---

## 1 · Official Requirement (re-read 2026-08-30)

**Authoritative source (re-fetched):** `https://www.bnbchain.org/en/hackathons/smart-money-era` → _Tracks → TermiX Challenge_ (same as X.173/X.174).

| Question                                                             | Answer supported by official source                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exactly 3 tasks required?**                                        | **At least 3** — verbatim: _“At least 3 real tasks run both ways: with an agent hired through your marketplace vs. without.”_ Exactly 3 is minimum; more is allowed.                                                                                                                                                                                                                                                                  |
| **Each of the 3 must involve a real marketplace hire?**              | **YES** — verbatim _“with an agent hired through your marketplace vs. without”_ applies to **each** of the at least-3 tasks. The phrase “hired through your marketplace” is not optional for a subset; it is the definition of the Arm B for every counted task. Evidence: _“Does hiring an agent on your marketplace beat doing the job yourself, and can you prove it?”_ and _“TermiX will hire from your marketplace themselves.”_ |
| **Each requires a separate paid hire?**                              | **YES, by implication** — each task is a _different_ real task (different input, different expected output, different actual outputs attached). A single hire’s single work product cannot be the output for three different tasks. The natural reading is **one hire per task**. No official text says one hire can satisfy multiple tasks.                                                                                          |
| **Can existing marketplace Hire evidence satisfy any of Tasks 1–3?** | **NO** — Tasks 1-3 as executed have **Arm B = discovery classifier** (`lib/eight004scan/discovery/`), not a **funded Job**. They are real marketplace _intelligence_ tasks, but not _hired-agent work-product_ tasks. They do not show a Job, a $U amount, or a deliverable.                                                                                                                                                          |
| **Can Job 787 legitimately satisfy one of the three?**               | **NO** — Job 787 is a **real funded hire** (chain 97, FUNDED, 0.001 U, provider 0x0eAc2F4d…), but its **deliverable is zero** (`deliverable = 0x00…`, `submittedAt = 0`, `status = FUNDED` not `SUBMITTED`/`COMPLETED`). A TermiX task requires **output quality + actual outputs attached** for _both_ arms. Job 787 has **no work product** to attach or score. It proves _Hire works_, not _hired work beats baseline_.            |
| **Can a single new Agent 2005 hire satisfy more than one task?**     | **NO** — each task’s inputs and success criteria differ (yield discovery vs cross-category triage vs security screening vs grid-strategy report). One JSON report cannot be the correct output for three tasks. Official source gives no support for reusing one output across tasks.                                                                                                                                                 |
| **Can the same agent perform multiple tasks?**                       | **YES** — official source does **not** require different agents per task; it requires different _tasks_. The same agent (e.g., Agent 2005) could be hired three times for three different prompts, but each hire is a **separate Job** (separate `jobId`, separate escrow).                                                                                                                                                           |
| **Does each task require an independent A/B baseline?**              | **YES** — “run both ways” means **each task** has its own baseline (same input, no agent, timed/costed/scored identically). Tasks 1-3 already do this correctly.                                                                                                                                                                                                                                                                      |
| **Must at least one be trading/stock/security?**                     | **YES** — verbatim: _“At least one task must come from trading, stock or security.”_ Trading agents need win rate/window/risk. Existing report satisfies this via **Task 3 = SECURITY** (mainnet 56 payment challenge refused). A new set of 3 hired tasks must also contain ≥1 security/trading/stock task.                                                                                                                          |

**Do not infer beyond the above.** No official text supports “one hired task covers three” or “discovery = hired”.

---

## 2 · Existing TermiX Tasks (re-inspected)

**Sources:** `docs/termix/Agent-Advantage-Report.md`, `EXPERIMENT-PROTOCOL.md`, `evidence/task-01..03/*.json`, `REPRODUCIBILITY.md`, `apps/web/lib/termix/advantage-harness.ts`.

| Task                                                                         |                                                                 Marketplace hire?                                                                 |                                     Actual agent work product?                                      |                                                 Baseline?                                                 |                       Time?                        |                        Cost?                        |                           Quality?                            |                                                       Output artifact?                                                       |
| ---------------------------------------------------------------------------- | :-----------------------------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------: | :------------------------------------------------: | :-------------------------------------------------: | :-----------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------: |
| **TASK 1 — Yield-agent discovery** (category `yield-optimisation`, chain 56) |   **NO** — Arm B = `discovery/` classifier (58 matched, each with slug/chain/evidence excerpt + `retrievedAt`). No Job, no $U, no deliverable.    |      **NO** — work product is a _list of registry excerpts_, not a hired agent’s deliverable.       |          **YES** — Arm A = direct 8004scan query + naive substring, `selected 62`, timed 5513 ms          | **YES** — 1426 vs 5513 ms (single run, unaveraged) | **YES** — 1 vs 1 req, `NOT MEASURABLE` USD (honest) | **YES** — rubric D1-D5, 22/25 vs 9/25, `QUALITY-SCORING.json` | **YES** — `arm-a-baseline.json` (62) + `arm-b-marketplace.json` (58) + `adjudication.json` (5 divergences, 3 missed genuine) |
| **TASK 2 — Cross-category triage** (all 4 Main Track categories)             |                                                     **NO** — same discovery agent, 4 queries.                                                     |                          **NO** — same as Task 1 (counts + justification).                          |                       **YES** — Arm A 4 direct queries, `30/6/62/10` vs `30/3/58/3`                       |          **YES** — 4159 vs 4214 ms (tie)           |                **YES** — 4 vs 4 req                 |                    **YES** — 23/25 vs 8/25                    |               **YES** — both JSONs + per-category adjudication (health-factor 7/7 false-positive suppression)                |
| **TASK 3 — Security screening (402)**                                        | **NO** — Arm B = `parsePaymentRequired` + `selectPaymentRequirement` (chain-pinned `ENFORCED`). Offline fixtures, `signed:false submitted:false`. | **NO** — decision is _refuse/accept_ with reason, not a hired agent’s work product for a paid task. | **YES** — Arm A = unaided field inspection, `NOT PERFORMED` chain enforcement, **ACCEPTED mainnet 56 ❌** |                **YES** — 2 vs 0 ms                 |                **YES** — 0 vs 0 req                 |                    **YES** — 24/25 vs 7/25                    |                            **YES** — `arm-a/baseline.json` + `arm-b/marketplace.json` (fixtures)                             |

**Summary for §2:** **0 of 3 tasks has a marketplace-hired Arm B.** All three have _real_ time/cost/quality/outputs and satisfy the _category_ (Task 3 = security), but **none** satisfies the _hired_ qualifier in the strict reading. X.169 correctly called this **PARTIAL**.

---

## 3 · Job 787 (read-only)

**Method:** `getJob(787n)` via `createMainTrackPublicClient()` / `ERC8183Client` (same as X.168/X.172 probes). No signing, no state change.

| Field         | Value                                                           |
| ------------- | --------------------------------------------------------------- |
| chain         | 97 (BSC Testnet)                                                |
| jobId         | 787                                                             |
| status        | **1 = FUNDED**                                                  |
| statusName    | FUNDED                                                          |
| budget        | `1000000000000000` = **0.001 U** (18 decimals)                  |
| client        | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` (hiring wallet)    |
| provider      | `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a` (Agent 2005 owner) |
| commerce      | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`                    |
| payment token | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` ($U)               |
| deliverable   | `0x000…00` (zero, **not SUBMITTED**)                            |
| submittedAt   | `0`                                                             |

**Classification: NOT QUALIFYING as a TermiX task.**

- **Why not QUALIFYING:** A TermiX task requires **output quality + actual outputs attached for both arms**. Job 787 has **no deliverable** (zero) and therefore **no work product to score**. It cannot be the “hired” arm of a task without an output.
- **Why not PARTIALLY QUALIFYING:** It _is_ a real funded hire through the marketplace (browser-wallet 5-TX flow, 0.001 U escrow, provider sig verified, dashboard FUNDED). It **proves Hire works**, but it does **not** prove _hired work beats baseline_ for a specific task. It is **evidence of Hire**, not **evidence of a Task**.
- **Use:** Job 787 is **supporting evidence** that the marketplace _can_ hire (TermiX “will hire themselves” — they can), but it **cannot be counted as one of the three required tasks** without a deliverable and baseline.

**Not altered, not claimed as ACTIVE, not submitted.**

---

## 4 · Task 4 (X.174)

**Task 4 as prepared in X.174:**

- **Task:** _Produce a deterministic BSC Testnet grid-strategy report; no trading or transaction execution_ ( `HIRE_TASK_DESCRIPTION` / `HIRE_TERMS` : `deliverables: "JSON analysis report"`, `success_criteria: ["valid JSON","chain 97 only"]` ).
- **Agent:** **Canned Range Keeper (Agent 2005, chain 97, token 2005, owner 0x0eAc2F4d…)** — live endpoint `https://range-keeper.103-195-188-198.sslip.io/erc8183` (registered via `tokenURI(2005)`), `POST /negotiate` returns fresh quote, `provider_sig` verified via `verifyQuoteSignature` against registered owner.
- **Observed quote at verification time:** **0.001 U** (`1000000000000000` wei), chain 97, commerce `0xa206…`, $U `0xc70B…`, expiry ~600s.
- **Predicted JobId if executed:** **808** (`jobCounter 807 + 1`, **PREDICTED ONLY**, re-read at execution, fails closed on `MAIN_TRACK_HISTORY_JOB_IDS`).
- **Transactions if executed:** **5 hire** (`createJob`→`registerJob`→`setBudget`→`approve`→`fund`) **+ 1 submit** (`submit` with JSON hash) = **6 total** `eth_sendTransaction` via user wallet, chain 97.

**Would Task 4 count as one of the required three hired-agent tasks?**

**YES** — _if executed and measured_ (time from Hire click → `fund` receipt → `submit` receipt, cost `0.001 U` + gas, quality via frozen rubric D1-D5, actual outputs `arm-b-paid-marketplace.json` + `deliverable.json` + `arm-a-baseline.json` attached). It is a **real task, both ways (hired vs naive baseline), with a hired agent’s actual work product**.

**BUT** — **one** hired task (Task 4) **does not make the existing three tasks hired**. After Task 4, the submission would have **3 discovery tasks (0 hired) + 1 hired task = 1 hired total**. Strict 3-hired-tasks reading still requires **2 more hired tasks**.

**UNKNOWN for “same agent multiple tasks” efficiency:** Official source does not forbid reusing Agent 2005 for multiple tasks, but each task needs its own Job/deliverable (separate escrow). No support for one Job counting for multiple tasks.

---

## 5 · Minimum Plan

**Existing tasks that count as hired:** **0 of 3** (Tasks 1-3 are discovery, not Hire).

**Job 787 counts:** **0 of 3** (no deliverable).

| Outcome | Calculation | New hires required | New tasks required | Strict QUALIFIED? |
|---|:---:|:---:|:---:|
| **A: Existing + Job 787 + one new task = 3** | 0 + 0 + 1 = **1 hired** | **1** (Job 808, Task 4) | **1** (Task 4) | **NO** — 1 ≠ 3. Would be **PARTIAL+ (1 hired demonstrated)**. |
| **B: Existing + two new tasks = 3** | 0 + 2 = **2 hired** | **2** | **2** | **NO** — 2 ≠ 3. Still PARTIAL. |
| **C: Three new marketplace hires required** | **3 hired tasks**, each: hired via marketplace (funded Job + submit + deliverable) vs baseline (same prompt, no hire), timed/costed/scored, outputs attached, ≥1 of the 3 is security/trading/stock (Task 4 is not security, so one of the three new hired tasks must be security/trading). | **3** (Jobs 808, 809, 810 — predicted, re-read at execution) | **3 new** (or re-run Tasks 1-3 as hired, but practically 3 new hired tasks is minimal) | **YES** — 3 hired tasks both ways = **QUALIFIED** (if quality shows advantage). |
| **D: Cannot be reached with current architecture** | — | — | — | **NO** — architecture **does** support it: Hire is live (Model B 5-TX), seller is live (endpoint 200, quote 0.001 U verified), `submit` path exists. No code change needed. |

**Answer (official requirement): C is the minimum for strict QUALIFIED.**

- **Existing + Job 787 + one new task = 1 hired ≠ 3** — not enough.
- **Three new marketplace hires** is the **minimum** that yields **3 hired tasks** as written.

**If the judges accept the broad reading** (discovery = hired, or 1 hired demonstrates capability and they will hire themselves), then **A (1 new task)** could be argued as **QUALIFIED (broad)** — but X.169/X.173 already adopted the **strict, honest** reading and must not be relabeled without a new 3-hired-task set.

---

## 6 · Cost / Risk (per NEW hired task, read-only estimates)

**Per new task (one hire + one submit, e.g., Task 4):**

| Item                                  | Value                                                                                                                                                                                                                                                                          | Source                             |
| ------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------- |
| **Hire TXs**                          | `createJob` → `registerJob` → `setBudget` → `approve` → `fund` = **5**                                                                                                                                                                                                         | `main-track-user-hire.ts` (pinned) |
| **Work TX**                           | `submit(jobId, deliverableHash)` = **1**                                                                                                                                                                                                                                       | `submit` separate                  |
| **Total TXs**                         | **6** `eth_sendTransaction` via user EIP-1193 wallet, chain 97                                                                                                                                                                                                                 | Same                               |
| **Quoted $U**                         | **0.001 U** (`1000000000000000` wei, 18 decimals) — observed, re-verified at execution via `verifyQuoteSignature`                                                                                                                                                              | Prior live quotes (X.155C, X.168)  |
| **Gas**                               | **TBD** — ~300k gas per TX at ~3 gwei → **~0.0009 BNB per TX** → **~0.0054 BNB for 6 TXs** (estimate from X.46 `approve(1)` session TX; actual varies with `gasPrice`). **Must be read at execution via `eth_estimateGas` + receipt `gasUsed`.**                               | X.46 receipts                      |
| **Existing allowance can be reused?** | **NO** — `approve` is for **exact `budget` (0.001 U) to router**; even if prior allowance exists, prepare step checks `allowance` and still requires `approve` for this Job’s `budget`. **Read-only `allowance(owner, router)` at execution will confirm, but do not assume.** | `prepareLiveAgentHire`             |
| **Approval can be avoided?**          | **NO** — `approve` is mandatory in the 5-TX sequence.                                                                                                                                                                                                                          | Same                               |
| **Seller endpoint live?**             | **YES as of last probe** — `range-keeper…/erc8183` health 200, `/negotiate` 200 with `provider_sig` verified (X.168, X.155C). **Must be re-probed at execution; if `null`/`not accepted`/bad sig, Hire fails closed and task cannot complete.**                                | `negotiateSeller`                  |
| **Task output retrievable?**          | **YES if seller delivers** — after `submit`, deliverable hash is on-chain (`getJob`), JSON report is returned by seller (off-chain) and saved as `deliverable.json`. **Depends on seller actually producing valid JSON** — external liveness dependency.                       | `submit` + seller                  |
| **Without trading/custody?**          | **YES** — grid-strategy report is research/analysis, no trading, no custody.                                                                                                                                                                                                   | `HIRE_TASK_DESCRIPTION`            |

**For 3 new hired tasks (minimum strict QUALIFIED):**

| Total               | Estimate                                                                            |
| ------------------- | :---------------------------------------------------------------------------------- |
| **Hire TXs**        | `3 × 5 = 15`                                                                        |
| **Submit TXs**      | `3 × 1 = 3`                                                                         |
| **Total TXs**       | **18**                                                                              |
| **Total $U**        | `3 × 0.001 = **0.003 U**`                                                           |
| **Total gas**       | **~0.016 BNB** (3 × ~0.0054, TBD)                                                   |
| **Seller liveness** | Must be live for **all 3** hires (if one fails, that task fails).                   |
| **Deliverables**    | **3 JSON reports** (one per Job) + 3 baselines = **6 artifacts** + 3 adjudications. |

**Read-only checks required immediately before each hire (not performed in this doc):** `jobCounter` (predict id), `balanceOf($U)` + `eth_getBalance` (0.001 U + gas), `allowance`, `endpoint health`, `POST /negotiate` + `verifyQuoteSignature`.

**No check was executed in this doc** (preparation only).

---

## 7 · Main Track Protection

| Check                                       | Result                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Job 787 remains untouched**               | **YES** — no `getJob` beyond prior read-only probes, no `submit`/`settle`, `deliverable` remains zero, `status` FUNDED. New Jobs are `808+`, history ids excluded.                                           |
| **Agent 2005 remains unchanged**            | **YES** — no `tokenURI` write, no endpoint change, no registration.                                                                                                                                          |
| **Main Track production remains unchanged** | **YES** — no app source change, no contract change, no new deployment required for _planning_. Execution would create **on-chain data change** (new Jobs in dashboard scan, +3 Jobs) but **no code change**. |
| **Model B remains unchanged**               | **YES** — uses existing 5-TX flow + `submit`, no architecture change.                                                                                                                                        |
| **No new deployment required for planning** | **YES** — this doc is the only new file, untracked.                                                                                                                                                          |

---

## 8 · Final Decision

```
CURRENT TERMIX:                PARTIAL
                               (3 real tasks both ways, time/cost/quality+outputs attached, security satisfied,
                                but 0 of 3 is a funded marketplace hire; report is discovery/intelligence, not paid hire)

REQUIRED FOR QUALIFIED:        At least 3 real tasks, EACH run both ways with an agent hired through the marketplace
                               (funded Job + deliverable) vs without, each with time/cost/quality + actual outputs,
                               ≥1 trading/stock/security, per official Tracks page.

EXISTING TASKS THAT COUNT:     0 of 3 (Tasks 1-3 are discovery, not Hire)
                               Task 1: NO (discovery list, no Job)
                               Task 2: NO (same)
                               Task 3: NO (offline fixtures, no Job, though security category satisfied)

JOB 787:                       NOT QUALIFYING as a TermiX task
                               (real funded hire, but deliverable zero → no work product to score;
                                proves Hire works, not that hired work beats baseline)

NEW HIRES REQUIRED:            3 (minimum strict) — Jobs 808, 809, 810 (predicted, re-read at execution)
                               1 new hire (Task 4) would make it PARTIAL+ (1 hired demonstrated), not QUALIFIED

NEW TASKS REQUIRED:            3 new hired tasks (each: hired via marketplace vs baseline, timed/costed/scored, outputs attached)
                               Smallest set: Task 4 (grid-strategy report, Agent 2005, research) + 2 more (one must be security/trading/stock if reusing Tasks 1-3 as hired; Task 4 itself is not security, so one of the three new must be security or Task 3 must be re-run as hired)

ESTIMATED TOTAL TX:            18 (3×(5 hire + 1 submit), eth_sendTransaction, chain 97)
ESTIMATED TOTAL U:             0.003 U (3 × 0.001 U)
ESTIMATED GAS:                 ~0.016 BNB (TBD, ~0.0054 per task, varies)
MAIN TRACK RISK:               LOW (new Jobs 808+ independent of 787; history excluded; no Model A/B change; but any broadcast failure (X.148-class RPC) could be misread if not scoped as “TermiX supplement”)

RECOMMENDATION:                DO NOT EXECUTE — pending explicit authorization

  Reason: Achieving strict QUALIFIED requires 3 new paid hires (18 TXs, 0.003 U + gas, 3 deliverables) with external seller liveness dependency.
  A single Task 4 (6 TXs) would not close the strict gap (would remain PARTIAL). Execution would create 3 new on-chain Jobs and change dashboard data (+3 funded Jobs) — a data change that should be explicitly authorized as a TermiX supplement, not as Main Track. The existing report is honestly PARTIAL and is still eligible (report required, present); TermiX will hire live themselves per official judging. If QUALIFIED is desired, authorize 3 hired tasks as described — do not execute automatically.

  If broad reading is accepted (1 hired demonstrates capability), Task 4 alone (X.174, 6 TXs, 0.001 U) could be argued as QUALIFIED (broad) — but do not relabel without judge confirmation.
```

---

## Report

**Created:** `docs/review/X175-Termix-Full-Qualification-Strategy.md` (this file, untracked, not committed, not pushed, not deployed).

Do not commit, push, or deploy without explicit authorization.

---

## Final Safety Attestation

```
Transactions: 0 — this doc performed zero eth_sendTransaction / eth_sendRawTransaction / createJob / fund / submit; jobCounter 807 was from prior X.173 probe, not re-read here
Signatures:   0 — no personal_sign, no EIP-712, no wallet popup
Job 787:      untouched — no getJob beyond prior read-only, no submit/settle, deliverable zero
Agent 2005:   untouched — no registration, no endpoint change
Agent 1906:   untouched
Production:   unchanged — no code, no deploy
Source:       unchanged — this doc is the only new file, untracked
Commit:       no
Push:         no
Deploy:       no
HARD STOP — no new hire was executed.
```
