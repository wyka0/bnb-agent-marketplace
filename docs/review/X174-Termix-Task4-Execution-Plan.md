# X.174 — TermiX Task 4 Execution Plan / Safety Gate

**Date:** 2026-08-30 · **Mode:** READ-ONLY PREPARATION · **Transactions:** ZERO · **Wallet signatures:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Production:** UNCHANGED · **Source:** UNCHANGED · **Commit:** NONE · **Push:** NONE · **Deploy:** NONE

> This document PREPARES but DOES NOT EXECUTE the minimum real marketplace-hired task needed to close the TermiX gap identified in X.173. No `eth_sendTransaction`, no `eth_sendRawTransaction`, no `createJob`/`registerJob`/`setBudget`/`approve`/`fund`/`submit` was broadcast, no jobId was reserved on-chain, no wallet popup occurred. All fields that can only be known after execution are marked **TBD — execution required**.

---

## 1 · Official TermiX Requirement (re-confirmed 2026-08-30)

**Authoritative source (re-fetched for X.174):** `https://www.bnbchain.org/en/hackathons/smart-money-era` → _Tracks → TermiX Challenge_.

| Requirement                           | Exact evidence required                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **3 real tasks both ways**            | At least **3 real tasks run both ways: with an agent hired through your marketplace vs. without** (verbatim).              |
| **Time / cost / quality + outputs**   | For each task, **report time, cost and output quality, with the actual outputs attached.**                                 |
| **Category**                          | **At least one task must come from trading, stock or security.** Trading agents need real record (win rate/window/risk).   |
| **Judging — Value 30%**               | Real working agents at a price and speed that beat the alternative. **TermiX will hire from your marketplace themselves.** |
| **Judging — Proven advantage 30%**    | Measured, not asserted, backed by Agent Advantage Report.                                                                  |
| **Judging — High-stakes 20%**         | Trading/stock/security weighted highest.                                                                                   |
| **Judging — Marketplace quality 20%** | Find, compare, hire without instructions.                                                                                  |

**Eligibility:** No Agent Advantage Report → not eligible.

**Interpretation for Task 4:**

- **“Hired through the marketplace”** — strict reading: Arm B is a **funded ERC-8183 Job** created via the marketplace’s Hire UI (`createJob`→`registerJob`→`setBudget`→`approve`→`fund` via user EIP-1193 wallet), not merely the discovery classifier (`lib/eight004scan/discovery/`). Broad reading (discovery = hired) would already qualify the existing report, but X.173 correctly adopted the strict reading to avoid overclaiming.
- **Work product** — the hired agent must produce a **concrete, judge-verifiable artifact** (JSON/text report) that can be scored for correctness/completeness/actionability.
- **One paid hire sufficient?** **NO** — the requirement is **3 tasks both ways hired vs without**. Adding **one** hired task (Task 4) would make the submission **3 discovery tasks + 1 hired task = 4 tasks, only 1 hired**. A strict judge would still mark as PARTIAL (2 of 3 original tasks remain non-hired). To be strictly QUALIFIED, **all 3 (or 3 new) tasks would need a hired arm**.
- **Task 3 already satisfies high-stakes:** **YES** — Task 3 is **SECURITY** (mainnet payment challenge refused). A new Task 4 does **not** need to be trading/stock/security.
- **Time/cost/quality + outputs:** Must be **measured wall-clock, counted requests + $U/gas, rubric-scored from saved artifacts** — same method as existing Tasks 1-3.

---

## 2 · Chosen Task 4 (smallest, safest)

**Task 4 — Deterministic BSC Testnet Grid-Strategy Report (research/analysis, no trading, no custody, no new agent, no Job 787 modification)**

| Criterion                              | Satisfied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Genuinely performable by Agent 2005 | **YES** — Agent 2005 “Canned Range Keeper” is a **Rebalancing** range-keeper; its live seller at `https://range-keeper.103-195-188-198.sslip.io/erc8183` negotiates for exactly `HIRE_TASK_DESCRIPTION = "Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution."` with `HIRE_TERMS = {deliverables: "JSON analysis report", quality_standards: "Deterministic output…", success_criteria: ["valid JSON","chain 97 only"]}` (see `main-track-negotiation.server.ts:32-38`). |
| 2. Concrete work product               | **YES** — JSON analysis report (deliverable).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3. Comparable baseline                 | **YES** — same prompt, naive baseline (direct 8004scan read + manual reasoning, no marketplace, no Hire).                                                                                                                                                                                                                                                                                                                                                                                                           |
| 4. Measurable time                     | **YES** — wall-clock Hire click → `fund` receipt → `submit` receipt vs baseline start→output.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5. Measurable cost                     | **YES** — `0.001 U` escrow + gas vs `0` + 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6. Measurable quality                  | **YES** — frozen rubric D1-D5 (0-5, max 25) + adjudication.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7. No trading                          | **YES** — analysis only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 8. No custody                          | **YES** — read-only report.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 9. No new agent                        | **YES** — reuses Agent 2005.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 10. No Job 787 modification            | **YES** — new Job (predicted 808, see §3) is independent.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Task payload (exact, sent to seller via `POST /negotiate`):**

```json
{
  "task_description": "Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution.",
  "terms": {
    "deliverables": "JSON analysis report",
    "quality_standards": "Deterministic output with explicit assumptions and no execution claims",
    "success_criteria": ["valid JSON", "chain 97 only"]
  }
}
```

**Why not a trading task?** A trading execution would require custody, price feeds, and risk — larger scope and higher Main Track risk. A research report is **within the seller’s demonstrated capability** (it already negotiates for this task) and is **safest**.

**What Agent 2005 cannot do (not invented):** No claim that it will manage LP positions, execute swaps, or provide APR/APY — those are unavailable and are not part of this task.

---

## 3 · Quote Preparation (read-only, PREDICTED ONLY)

**Agent identity (on-chain, read-only):**

| Field            | Value                                                   | Source                                                            |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `agentId`        | `97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005`    | 8004scan `CANNED_RANGE_KEEPER` fixture + live `getAgent`          |
| `tokenId`        | `2005`                                                  | same                                                              |
| `chainId`        | `97` (BSC Testnet)                                      | same                                                              |
| `owner/provider` | `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a`            | 8004scan `owner_address`, matches `provider_sig` signer           |
| `registry`       | `0x8004A818BFB912233c491871b3d84c89A494BD9e`            | `MAIN_TRACK_REGISTRY`                                             |
| `endpoint`       | `https://range-keeper.103-195-188-198.sslip.io/erc8183` | `tokenURI(2005)` → `data:` URI → `services[]` (HTTPS + `erc-?8183 | a2a`) |

**Live negotiation (read-only, no broadcast):**

- Resolved via `resolveRegisteredEndpoint("97:0x8004A818…:2005")` → `endpoint` above (X.162, X.155C health 200).
- `POST {endpoint}/negotiate` with `task_description` + `terms` above → **live quote** (structure `MainTrackLiveQuote`: `chain_id`, `verifying_contract`, `negotiation_hash`, `provider_sig`, `response.terms.price`, `response.quote_expires_at`).

> **No `POST /negotiate` was executed in this preparation.** The expected quote shape is documented from prior live probes (X.155C, X.168): `price = 0.001 U` (`1000000000000000` wei, 18 decimals), `currency = 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` ($U), `chain_id = 97`, `verifying_contract = 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (commerce), expiry ~600s from `negotiated_at`. **Actual price/expiry will be read at execution time and verified via `verifyQuoteSignature` against the registered owner; never hardcoded.**

**Chain / commerce / payment token (pinned, official):**

| Field               | Value                                        |
| ------------------- | -------------------------------------------- |
| `chain`             | BSC Testnet **97**                           |
| `commerce`          | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| `router`            | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` |
| `policy`            | `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` |
| `paymentToken ($U)` | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` |
| `registry`          | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

**JobId that WOULD be allocated (PREDICTED ONLY):**

- **Current `jobCounter` (read-only, as of X.173 probe):** `807` (public RPC `jobCounter()`).
- **Predicted next `jobId`:** `808` = `807 + 1` via `readNextJobId()` (`jobCounter()+1`).
- **Label:** **PREDICTED ONLY — not reserved on-chain, not broadcast, will be re-read at execution time.** If others create jobs before execution, the actual id will be `>808`. The prepare step will re-read and will **fail closed** if it collides with `MAIN_TRACK_HISTORY_JOB_IDS` (`622,641,646,648,649,650,651,652,653`) or if the counter cannot be read.

**Expected budget:**

- **From live quote:** `price` field (wei, 18 decimals). **Observed 0.001 U** in prior probes; **actual value is the verified quote at execution time**, used as `expectedBudget` for `verifyMainTrackUserHireFunded` (dynamic, not hardcoded 1 U — X.167).

**Allowed calls (pinned, 5-TX Model-B Hire):**

1. `createJob(provider, description, budget, expiredAt, jobId)` → commerce
2. `registerJob(jobId, policy)` → router
3. `setBudget(jobId, budget)` → commerce
4. `approve(paymentToken, router, budget)` → $U
5. `fund(jobId)` → router

All `to` addresses checked against pinned allowlist; `registerJob` carries authoritative policy `0xd6a421…`.

**Submit (separate, after FUNDED):**

- `submit(jobId, deliverableHash)` → commerce — **1 additional TX** to place the JSON report on-chain (deliverable = `0x` + hash of JSON). This is **not part of the 5-TX Hire**; it is the work-product step for TermiX.

**Expected task payload (canonical description):**

- Built via `buildJobDescription(quote)` from the verified quote (server-side, read-only). Never hardcoded. Example shape: `{"version":1,"chain_id":97,"currency":"0xc70B…","price":"1000000000000000","task":"Produce a deterministic…","terms":{…}}` (actual JSON will be the live quote’s terms).

---

## 4 · TermiX Evidence Plan (proposed record — every TBD marked)

**Task 4: Agent:**

- **Agent:** **Canned Range Keeper (Agent 2005, chain 97, token 2005, owner 0x0eAc2F4d…)** — live seller, endpoint verified, quote 0.001 U observed.

**Task:**

- **Task:** _Produce a deterministic BSC Testnet grid-strategy report (JSON) for a bounded prompt; no trading, no custody._

**Marketplace:**

- **Marketplace:** BNB Agent Studio Marketplace (`https://bnb-agent-marketplace-web.vercel.app`), **Hire is live (Model B)** via `app/api/activation/main-track-hire` `prepare`/`receipt`/`verify`, user EIP-1193 wallet.

**Quote:**

- **Quote:** **TBD — execution required.** Will be the live `POST /negotiate` response at execution time, with `provider_sig` verified via `verifyQuoteSignature` against `0x0eAc2F4d…`, `chain_id 97`, `verifying_contract` commerce, future `quote_expires_at`.
- _Predicted shape (from prior probes, not a commitment):_ `price 0.001 U`, `expiry ~600s`.*

**Expected cost:**

- **Expected cost:** **TBD — execution required.** Predicted `0.001 U` escrow + gas (5 hire TXs + 1 submit TX). Baseline cost `0` (no Hire, no gas, 0-1 8004scan requests if baseline does manual research).

**Baseline:**

- **Baseline:** **TBD — execution required.** Scripted naive baseline (no marketplace, no Hire): direct 8004scan query + manual reasoning on `name`/`description`, same prompt, timed identically, no signing.

**Agent execution:**

- **Agent execution:** **TBD — execution required.** Wall-clock: **Hire click → `createJob` receipt → `registerJob` → `setBudget` → `approve` → `fund` receipt (FUNDED) → `submit` receipt (deliverable hash) → independent `getJob` verification (`status FUNDED→SUBMITTED`, `budget == quoted`, `deliverable != 0x00…`). Record `elapsedMs` (Date.now() around Hire flow), `txHashes` (5+1), `receipts` (BscScan 97).

**Baseline execution:**

- **Baseline execution:** **TBD — execution required.** Same prompt, baseline script, `elapsedMs`, `requests` count, no TX, no cost.

**Time measurement:**

- **Time measurement:** **TBD — execution required.** Both arms: `Date.now()` single-process, warm network, single run (same method as Tasks 1-3). Report `elapsedMs` per arm.

**Cost measurement:**

- **Cost measurement:** **TBD — execution required.** Marketplace arm: `0.001 U` (wei) + gas (from receipts, sum `gasUsed * gasPrice`); Baseline arm: `0` + `requests` count. Monetary USD: `NOT MEASURABLE` (no 8004scan price, same as Tasks 1-3) — recorded honestly.

**Quality measurement:**

- **Quality measurement:** **TBD — execution required.** Frozen rubric D1-D5 (0-5, max 25) applied identically to both artifacts from saved evidence only, same scorer, same as Tasks 1-3. `NOT ASSESSABLE` if not scorable.

**Agent output artifact:**

- **Agent output artifact:** **TBD — execution required.** `docs/termix/evidence/task-04/arm-b-paid-marketplace.json` containing: `elapsedMs`, `requests`, `costWei`, `gasUsed`, `txHashes`, `jobId` (actual, not predicted), `provider`, `price`, `expiry`, `deliverable` (JSON report), `deliverableHash`, `retrievedAt`, plus `evidence/task-04/deliverable.json` (the JSON report itself) and receipt JSONs.

**Baseline output artifact:**

- **Baseline output artifact:** **TBD — execution required.** `docs/termix/evidence/task-04/arm-a-baseline.json` + `evidence/task-04/baseline-output.json` (naive report), same timing/cost fields.

**No value above is fabricated.** Every **TBD** will be filled only by a measured run with saved artifacts.

---

## 5 · Risk Check (read-only)

| Question                                           | Answer                                                                                                                                                                                                                                                                                                                      | Evidence                                                |
| -------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| **Number of blockchain TXs required**              | **5 for Hire** (`createJob`, `registerJob`, `setBudget`, `approve`, `fund`) **+ 1 for submit** = **6 total** (all `eth_sendTransaction` via user wallet, chain 97). `settle`/`claim` not needed for TermiX.                                                                                                                 | `main-track-user-hire.ts` (5 calls) + `submit` separate |
| **Estimated total payment**                        | **0.001 U escrow** + gas (~0.000x BNB per TX, 6 TXs). Prior `approve(1)` session TX gas was `~0.0003 BNB` per TX (X.46). Total < `0.002 BNB` + `0.001 U`. **TBD at execution (gas price varies).**                                                                                                                          | Prior receipts (X.46)                                   |
| **Does agent require submit?**                     | **YES** — to produce a judge-verifiable work product, the JSON must be `submit`ted (on-chain deliverable hash). Otherwise deliverable is zero and there is nothing to score.                                                                                                                                                | `submit` is separate from `fund`                        |
| **Is submit an additional TX?**                    | **YES** — 1 TX beyond the 5-TX Hire.                                                                                                                                                                                                                                                                                        | Same                                                    |
| **Is any approval needed?**                        | **YES** — `approve` of `$U` to router for `budget`.                                                                                                                                                                                                                                                                         | 5-TX list                                               |
| **Is existing allowance sufficient?**              | **UNKNOWN — read-only check at execution time** — `allowance(owner, router)` via `eth_call`. If sufficient, `approve` still required for exact `budget` (prepare step checks).                                                                                                                                              | `readHiredJobs` / `allowance` read                      |
| **Does user6 have sufficient testnet funds?**      | **UNKNOWN — read-only check at execution time** — `balanceOf($U)` + `native BNB` for gas via `eth_call`. Prior user6 wallet `0x...` (from X.168 buyer wallet `0x299Ce…` or dedicated `user6` from `services/v2-buyer/user6…`) must have `≥0.001 U` + gas. **Must be checked via `eth_call` before execution; not assumed.** | `balanceOf` / `eth_getBalance` reads                    |
| **Does this risk Job 787?**                        | **NO** — Job 787 is `787`, new Job is predicted `808` (or current counter+1 at execution). History ids (`622…653`) are excluded; prepare step fails closed on collision. No `modify`/`submit`/`settle` on 787.                                                                                                              | `MAIN_TRACK_HISTORY_JOB_IDS` + `readNextJobId`          |
| **Does this create a new funded job?**             | **YES** — that is the point: **Job 808 (or current next id) will be FUNDED** (`0.001 U`). This is **intentional and desired** for TermiX, but it **is a new on-chain state** (1 new Job, `jobCounter` increments).                                                                                                          | 5-TX Hire                                               |
| **Does this change marketplace production state?** | **NO for app code** — marketplace code is unchanged. **YES for on-chain state** — 1 new Job appears in the dashboard’s `hired-agents` scan (bounded window includes it) and in BscScan. This is **not a code change**, but a **data change** visible to judges.                                                             | `hired-agents.server.ts` scan                           |
| **Does this change Model A/B architecture?**       | **NO** — uses existing Model B 5-TX flow + `submit`, no contract/code change.                                                                                                                                                                                                                                               | Same                                                    |
| **External dependency**                            | **YES** — live seller endpoint must be reachable, quote must be `accepted` and `provider_sig` must verify, and seller must actually produce a quality JSON after `submit`. If seller returns `null` / `not accepted` / bad sig, Hire **fails closed** and Task 4 cannot be completed.                                       | `negotiateSeller`                                       |

**Read-only checks performed for this plan:** None that hit the chain beyond the **existing** `jobCounter` probe (807) from X.173/X.168. No new `eth_call` for allowance/balance was performed in this preparation (to keep this doc strictly preparatory). Those checks are **required immediately before execution** and are listed as **TBD** above.

---

## 6 · Do Not Execute

**STOP before:**

```
eth_sendTransaction
eth_sendRawTransaction
createJob
registerJob
setBudget
approve
fund
submit
settle
```

No wallet popup, no signature, no transaction was triggered by this document. This file is the **only** new artifact, untracked until committed.

---

## 7 · Report — Classification

### Classification

**B — Task 4 is technically possible but has an external dependency, and one hired task alone does not make the existing 3-task report fully QUALIFIED under the strictest reading.**

| Option                                                          | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Task 4 can safely close the gap and exact plan is ready** | **NO** — plan is ready, but **one** hired task does not retroactively make **all three** original tasks “hired through marketplace” in the strict sense. A strict judge requiring **3 hired tasks** would still mark as PARTIAL (now 1/4 hired). Task 4 alone upgrades the submission from **“0 hired tasks demonstrated”** to **“1 hired task demonstrated”** — a material improvement, but not strictly “3 hired tasks”. |
| **B — Technically possible but has external dependency**        | **YES — THIS IS THE CORRECT CLASSIFICATION.** Task 4 as specified is the **smallest, safest** hired task that can produce a real work product. It is ready to execute (agent, endpoint, quote shape, jobId prediction, 5+1 TXs, 0.001 U, read-only checks defined). Its success depends on the **live seller being reachable and delivering a quality JSON** — an external liveness dependency outside our control.        |
| **C — Task 4 cannot satisfy the TermiX requirement**            | **NO** — it **can** satisfy the _work-product_ part (hired agent’s deliverable vs baseline) for **one** task, but not the _3-task hired_ strict requirement alone.                                                                                                                                                                                                                                                         |
| **D — Another existing artifact already closes the gap**        | **NO** — no existing funded Job has a non-zero deliverable that could be repurposed (Job 787 deliverable is zero, not SUBMITTED).                                                                                                                                                                                                                                                                                          |

### Required Report Sections (for the eventual Task 4 supplement)

If Task 4 is later authorized and executed, the supplement must contain:

1. **Official requirement** — §1 above (verbatim).
2. **Exact gap** — X.173 §4: 0 hired tasks in original report.
3. **Proposed Task 4** — §2 above (grid-strategy report, no trading).
4. **Exact task payload** — `task_description` + `terms` JSON (see §2).
5. **Expected agent output** — TBD JSON report (deterministic, valid JSON, chain 97 only).
6. **Baseline methodology** — naive direct 8004scan screening, same prompt, timed identically.
7. **Required measurements** — time (ms), cost (requests + $U wei + gas), quality (D1-D5), actual outputs attached.
8. **Required blockchain transactions** — 5 hire + 1 submit = 6 TXs, `eth_sendTransaction`, chain 97, official commerce/$U.
9. **Estimated cost** — 0.001 U + gas (~<0.002 BNB total, TBD).
10. **Risks** — §5 above (seller liveness, allowance/balance, new funded Job, dashboard data change).
11. **What remains after execution** — With Task 4, the submission would have **3 discovery tasks (honestly PARTIAL) + 1 hired task (proven)**. Strict **QUALIFIED** (3 hired tasks) would still require **2 more hired tasks** (or re-running Tasks 1-2 as hired). The honest post-execution claim would be **“TermiX PARTIAL → PARTIAL+ (1 hired task proven)”**, not **“QUALIFIED”** unless TermiX judges accept the _broad_ reading (1 hired task demonstrates capability) or we execute **3 hired tasks**.

### What remains after execution (honest)

- **If Task 4 succeeds:** The submission can state: _“One real marketplace-hired task (Agent 2005, Job 808, 0.001 U, FUNDED→SUBMITTED, JSON deliverable) was measured against a baseline (time/cost/quality + outputs attached). The original 3-task discovery report remains as PARTIAL discovery evidence. TermiX can hire live from the marketplace (Hire is live, endpoint 200, quote verified).”_ This is **strong PARTIAL+** and may be judged **QUALIFIED** under the **broad** interpretation, but **strict 3-hired-tasks** would still be **PARTIAL**.
- **To reach strict QUALIFIED:** Execute **Tasks 1-3 (or 2 more new tasks) as hired tasks** (each a funded Job + submit), each with time/cost/quality + outputs. That would be **3× (5+1) = 18 TXs** total, 3× 0.001 U, and 3× seller deliverables — larger scope and higher Main Track visibility risk.

---

## Final Safety Attestation

```
Blockchain transactions: 0 — all fields in §3 are PREDICTED ONLY, no eth_call beyond the pre-existing jobCounter probe (807) was performed for this doc
Wallet signatures:       0 — no personal_sign, no eth_sign, no EIP-712
Job 787:                untouched — no getJob beyond the pre-existing read, no submit/settle
Agent 2005:             untouched — no registration, no endpoint change
Agent 1906:             untouched
Production:             unchanged — no code, no deploy
Source:                 unchanged — this doc is the only new file, untracked until committed
Commit:                 no — this file is UNTRACKED (per HARD STOP)
Push:                   no
Deploy:                 no

HARD STOP — Do not execute Task 4 until explicitly authorized.
```

---

_References: `docs/termix/Agent-Advantage-Report.md`, `EXPERIMENT-PROTOCOL.md`, `evidence/*`, `apps/web/lib/termix/advantage-harness.ts`, `apps/web/lib/activation/main-track-negotiation.server.ts:32-38` (`HIRE_TASK_DESCRIPTION`/`HIRE_TERMS`), `packages/integrations/src/altana/*`, `docs/review/X173…md`, X.168 Job 787 probe (`chain 97 FUNDED 0.001 U`), official BNB Chain Tracks page (`https://www.bnbchain.org/en/hackathons/smart-money-era`)._
