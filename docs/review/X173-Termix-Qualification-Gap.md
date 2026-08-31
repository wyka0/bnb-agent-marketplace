# X.173 — TermiX Qualification Gap Analysis

**Date:** 2026-08-30 · **Mode:** READ-ONLY AUDIT · **Transactions:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED

> No blockchain transaction, no Hire execution, no wallet signing, no contract modification, no new job. This is a gap analysis only. If a new real task is required, it is REPORTED, not executed.

---

## 1 · Official TermiX Requirements (retrieved 2026-08-30)

**Source (authoritative):** `https://www.bnbchain.org/en/hackathons/smart-money-era` → _Tracks → TermiX Challenge_ (WebFetch 2026-08-30, also `https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace`).

| Requirement (verbatim)                                  | Detail                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Track question**                                      | _Does hiring an agent on your marketplace beat doing the job yourself, and can you prove it?_                                        |
| **Judging — Value of services 30%**                     | Real working agents at a price and speed that beat the alternative. TermiX will **hire from your marketplace** and evaluate results. |
| **Judging — Proven agent advantage 30%**                | Measured, not asserted, backed by the **Agent Advantage Report**.                                                                    |
| **Judging — High-stakes categories & track record 20%** | Trading, stock/equities and security weighted highest. Trading agents need win rate/window/risk.                                     |
| **Judging — Marketplace quality 20%**                   | Find, compare, hire without instructions.                                                                                            |
| **Required report — 3 real tasks both ways**            | **At least 3 real tasks run both ways: with an agent hired through your marketplace vs. without.**                                   |
| **Required report — time/cost/quality + outputs**       | **For each task, report time, cost and output quality, with the actual outputs attached.**                                           |
| **Required report — category**                          | **At least one task must come from trading, stock or security.**                                                                     |
| **Integration**                                         | _You are not asked to integrate anything with TermiX. The submission is the marketplace itself._                                     |

**Eligibility:** A submission is **NOT eligible** without the Agent Advantage Report.

---

## 2 · Existing Evidence Inspected

| Artifact                                      | Path                                                                                            | Status                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Agent Advantage Report                        | `docs/termix/Agent-Advantage-Report.md`                                                         | **EXISTS** — 3 tasks, 2026-08-16 run, honest limitations, 69/75 vs 24/75                                     |
| Experiment Protocol (frozen before execution) | `docs/termix/EXPERIMENT-PROTOCOL.md`                                                            | **EXISTS** — tasks, rubric, baseline, deviation D-1                                                          |
| Reproducibility                               | `docs/termix/REPRODUCIBILITY.md`                                                                | **EXISTS**                                                                                                   |
| Evidence — Task 1                             | `docs/termix/evidence/task-01/{input,arm-a-baseline,arm-b-marketplace,adjudication}.json`       | **EXISTS** — 58 justified records vs 62 baseline, 1426 vs 5513 ms, 1 vs 1 req, `NOT MEASURABLE` cost         |
| Evidence — Task 2                             | `docs/termix/evidence/task-02/{input,arm-a-baseline,arm-b-marketplace,adjudication}.json`       | **EXISTS** — 4 categories, 4159 vs 4214 ms, 4 vs 4 req, health-factor 7/7 false-positive suppression         |
| Evidence — Task 3                             | `docs/termix/evidence/task-03/{input,arm-a-baseline,arm-b-marketplace}.json`                    | **EXISTS** — security, 2 vs 0 ms, 0 vs 0 req, mainnet challenge **REFUSED** vs baseline **ACCEPTED**         |
| Run metadata                                  | `docs/termix/evidence/RUN-METADATA.json`                                                        | **EXISTS** — Node v24.14.1, timestamps, single-run caveat                                                    |
| Quality scoring                               | `docs/termix/evidence/QUALITY-SCORING.json`                                                     | **EXISTS** — per-dimension 0-5, 9/25 vs 22-24/25                                                             |
| Harness code                                  | `apps/web/lib/termix/advantage-harness.ts`                                                      | **EXISTS** — discovery agent `lib/eight004scan/discovery/` + x402 screening, **no Hire, no Job, no signing** |
| Integration — reputation                      | `packages/integrations/src/termix/*` + `apps/web/lib/termix/reputation.ts`                      | **EXISTS** — read-only reputation, not a hire                                                                |
| Marketplace-hire evidence                     | `docs/review/Main-Track-X157…`, `X166…`, `X167…`, `X168…` + Job 787 `FUNDED 0.001 U` (chain 97) | **EXISTS** — but **not used as a Task 1-3 arm**                                                              |

All evidence is **real, measured, and reconstructible**. No numbers are estimated.

---

## 3 · Why X.169 Classified TermiX as PARTIAL

X.169 §4 (TermiX Audit) found the report **complete as a discovery/intelligence experiment** but **PARTIAL as a paid-hire experiment**:

> The report measures the marketplace's **discovery + x402 screening adapters** (`lib/eight004scan/discovery/`), **not** a **paid activation that ran through a funded Job 787 hire**. README §TermiX and SUBMISSION.md already state this limitation.

**Strict reading of “with an agent hired through your marketplace vs. without”** — a judge expecting Arm B to be a **funded ERC-8183 Job** (client → provider → `fund` → deliverable) that did the work would mark the current report **PARTIAL**, because:

- Arm B in all three tasks is the **discovery classifier**, not a hired agent's **work product**.
- Task 3 is offline fixtures, no signing, no submission.
- Job 787 (the only funded hire) is **not** one of the three tasks and its deliverable is **zero** (FUNDED, not SUBMITTED/COMPLETED), so it cannot serve as a task output.

**Broad reading** — “hired” = “discovered and invoked via marketplace intelligence” — the current report **would be PASS** (3 tasks, both ways, time/cost/quality + outputs attached, security satisfied, marketplace quality demonstrated).

X.169 chose the **honest, stricter** reading to avoid overclaiming.

---

## 4 · Required Matrix

| Requirement                                                                              | Existing Evidence                                                                                                                                                                                                                                                                    | Missing                                                                                                                                                                                                              | Can Prove Without New TX?                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3 real tasks both ways (agent hired via marketplace vs without)**                      | 3 tasks (yield discovery, cross-category triage, security screening) run both ways: **Arm B = marketplace discovery agent** (`discovery/` + x402), **Arm A = naive baseline** (direct 8004scan query + substring / unaided field inspection). Evidence JSONs for both arms per task. | **Strict “hired via marketplace Hire flow”** — Arm B is _not_ a funded Job (no `createJob`/`fund`/`deliverable`). No task shows an agent **hired through the marketplace’s Hire UI** doing the work.                 | **NO** — proving “hired via marketplace” in the strict sense requires a **funded Job** (e.g., Job 788) and its deliverable. That requires `fund` (and later `submit`) — a blockchain TX. Cannot be proven read-only from existing artifacts. |
| **Time per task**                                                                        | **YES** — `elapsed` ms in every `arm-*.json` (Task1 5513 vs 1426, Task2 4214 vs 4159, Task3 0 vs 2). Single run, unaveraged, honestly reported.                                                                                                                                      | Nothing — but **no reliable speed advantage** (T2 tie, T3 +2 ms slower). Not a gap, an honest finding.                                                                                                               | **YES** — already proven, no new TX needed.                                                                                                                                                                                                  |
| **Cost per task**                                                                        | **YES** — `upstream requests` (1 vs 1, 4 vs 4, 0 vs 0) in every JSON; monetary `NOT MEASURABLE` (no published 8004scan price) — explicitly recorded, not estimated.                                                                                                                  | Monetary USD cost — **not measurable by design** (protocol §Cost measurability). Not a fabricable gap.                                                                                                               | **YES** (as `NOT MEASURABLE`) — already proven. New TX would not change it (same 8004scan tier).                                                                                                                                             |
| **Output quality per task**                                                              | **YES** — rubric 0-5 ×5 dims, scored from saved artifacts, `QUALITY-SCORING.json` (B 22-24/25 vs A 7-9/25) + per-task adjudication of every divergence.                                                                                                                              | Nothing — quality is measured.                                                                                                                                                                                       | **YES** — already proven.                                                                                                                                                                                                                    |
| **Actual outputs attached**                                                              | **YES** — `arm-a-baseline.json` (62 names / 4-category counts / 402 decisions) + `arm-b-marketplace.json` (58 justified records with slug/chain/verification/evidence excerpt + per-category states + 402 refuse) + `adjudication.json` per divergence.                              | Nothing — outputs are attached.                                                                                                                                                                                      | **YES** — already proven.                                                                                                                                                                                                                    |
| **At least one trading/stock/security**                                                  | **YES** — **Task 3 = SECURITY** (untrusted HTTP 402 chain safety; mainnet 56 **REFUSED** by Arm B, **ACCEPTED** by Arm A — safety failure). Explicitly flagged in Report §Required-category check.                                                                                   | Nothing.                                                                                                                                                                                                             | **YES** — already proven.                                                                                                                                                                                                                    |
| **Proven agent advantage (30% criterion)**                                               | **YES** — provenance (source+timestamp+excerpt), 7/7 health-factor false-positive suppression, mainnet safety — all artifact-backed.                                                                                                                                                 | **Paid-hire advantage** — report does not show a hired agent's **work product** beating baseline; it shows **discovery intelligence** beating naive screening.                                                       | **NO for paid-hire sense** — would need a hired agent’s deliverable vs baseline deliverable. Requires new funded Job.                                                                                                                        |
| **Real working agents at a price/speed that beat alternative (30% “Value of services”)** | **PARTIAL** — discovery agent is real and working, but **price is not demonstrated as a marketplace Hire price** (no Job, no $U amount, no on-chain escrow for these tasks). Speed is tied (T2/T3) or single-run (T1).                                                               | **Hired-agent price/speed** — no Job, no $U, no escrow for Tasks 1-3. TermiX “will hire from your marketplace themselves” — they can, but we have not demonstrated a _completed_ hire’s price/speed for these tasks. | **NO** — demonstrating a marketplace Hire price/speed requires a funded Job.                                                                                                                                                                 |

---

## 5 · Can the Gap Be Closed Without a New Blockchain Transaction?

**Short answer: NO — not for the strict “paid hire” reading. YES — for a documentation-only honesty upgrade that keeps PARTIAL but makes it unambiguously judgeable.**

| Option                                                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Requires payment?              | Requires TX?                                                                                                     | Read-only?                                              | Risks Main Track?                                                                                                                                                           | Effect on qualification                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Documentation-only clarification (minimum safe change)** | Add a one-paragraph disclosure to `Agent-Advantage-Report.md` (or an addendum `X173-Termix-Supplement.md`) stating: _“This report measures marketplace discovery/intelligence (lib/eight004scan/discovery/ + x402). It does not claim a paid marketplace hire via funded Job; Job 787 is FUNDED but not SUBMITTED (deliverable zero) and is not one of the three tasks. TermiX can hire live from the marketplace (Hire is live, Agent 2005 endpoint reachable, quote 0.001 U verified) and evaluate the work product.”_ + reference `X168` Job 787 evidence. | **No**                         | **No**                                                                                                           | **YES**                                                 | **NO**                                                                                                                                                                      | Keeps **PARTIAL** but makes it **honestly PARTIAL** — a judge will not misread it as QUALIFIED, but will not penalize for overclaiming. Preserves Main Track READY.                                |
| **B. Supplementary “Paid Hire” task (new real task)**         | Run **one new task** (e.g., “Produce a yield-agent shortlist with risk notes” or “Rebalancing range recommendation”) **both ways**: **Arm B = agent hired through marketplace** (funded Job 788, e.g., Canned Range Keeper, 0.001 U, deliverable = JSON report) vs **Arm A = baseline** (human/naive). Measure **time** (wall-clock from Hire click to deliverable), **cost** ($U escrow + gas vs $0), **quality** (same rubric + actual outputs attached).                                                                                                   | **YES** — 0.001 U escrow + gas | **YES** — `createJob`→`registerJob`→`setBudget`→`approve`→`fund` (5 TXs) + later `submit` (1 TX) for deliverable | **NO** — requires `eth_sendTransaction` via user wallet | **LOW but non-zero** — new Job is independent of 787; but any broadcast failure (X.148-class RPC) could be misread as product failure if not scoped as a TermiX supplement. | Would upgrade to **QUALIFIED** (if deliverable is real and better than baseline) — satisfies strict “hired through marketplace” + time/cost/quality + outputs.                                     |
| **C. Repurpose existing Job 787 as a task**                   | Claim Job 787’s hire as the “hired” arm for a new adjudication without a new TX (just document its context as a task).                                                                                                                                                                                                                                                                                                                                                                                                                                        | **No (already funded)**        | **No**                                                                                                           | **YES**                                                 | **NO**                                                                                                                                                                      | **Insufficient** — Job 787 deliverable is **zero** (FUNDED, not SUBMITTED), so there is no agent work product to compare. Cannot satisfy “output quality + actual outputs” for a hired-agent task. |
| **D. Do nothing**                                             | Keep report as-is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | No                             | No                                                                                                               | Yes                                                     | No                                                                                                                                                                          | Remains **PARTIAL** — still eligible for TermiX (report required, present) but not QUALIFIED under strict paid-hire reading.                                                                       |

**Existing completed work / logs / Job 787 that could be used without new TX:**

- `discovery/` classifier + x402 screening — already used.
- Job 787 `FUNDED` state — proves Hire works, but **not** a task output.
- No existing funded Job has a non-zero deliverable that could be attached as a task output.

**Therefore the _only_ missing requirement that cannot be satisfied read-only is the strict “agent hired through your marketplace did the work” work-product comparison.** Everything else (3 tasks, both ways, time, cost as `NOT MEASURABLE`, quality, outputs, security, reproducibility) **is already proven read-only**.

---

## 6 · Exact Task to Reach QUALIFIED (if authorized)

If the project authorizes a new real task, the **minimum** task that would close the gap is:

**Task 4 — “Hired-agent deliverable vs baseline” (single task, reusing frozen rubric):**

- **Task:** A concrete, judge-verifiable deliverable that a marketplace agent can produce (e.g., “Given chain 97, produce a 1-page rebalancing-range report for Agent 2005’s strategy” or “Yield shortlist with provenance” — choose one that is _not_ already in Tasks 1-3).
- **Arm B (hired):** Hire **Canned Range Keeper (Agent 2005)** through the production marketplace Hire UI (live endpoint, 0.001 U quote, 5 TXs), wait for `FUNDED`, then `submit` a deliverable (off-chain JSON, on-chain hash), record **wall-clock time** (Hire click → `fund` receipt → `submit` receipt), **cost** (`0.001 U` + gas from receipts), **output** (the JSON), and score quality with the frozen rubric.
- **Arm A (baseline):** Same prompt, naive baseline (direct 8004scan + manual reasoning, no marketplace hire), timed and costed (0), output saved.
- **Evidence required:** `input.json` (prompt), `arm-a-baseline.json` + `arm-b-paid-marketplace.json` (time, cost, output), `adjudication.json` (quality scoring), and the **on-chain Job 788** (`FUNDED` + `SUBMITTED` + deliverable hash) with BscScan links.
- **Payment:** **YES** — 0.001 U escrow.
- **Blockchain TX:** **YES** — 5-TX Hire + 1-TX submit = **6 TXs** (all via user wallet, `eth_sendTransaction`, chain 97).
- **Read-only?** **NO.**
- **Risk to Main Track:** **LOW** — new Job 788 is independent of Job 787; failure would be scoped to the TermiX supplement, but a broadcast failure could be misread if not labeled as such. Mitigate by documenting as “TermiX supplement, not Main Track.”

**Do NOT execute this automatically.** Await explicit authorization.

---

## 7 · Recommendation

**Keep TERMIX = PARTIAL — do not relabel as QUALIFIED.**

- The existing report **already satisfies the 3-task / time / cost (as NOT MEASURABLE) / quality / outputs / security** requirements and is honestly PARTIAL for the strict paid-hire reading.
- The **minimum documentation-only change** (Option A) is safe, improves judgeability, and does not risk Main Track. It does **not** make TermiX QUALIFIED, but it prevents a downgrade for overclaiming.
- The **only path to QUALIFIED** (Option B) requires a **new paid hire (Job 788 + submit)** — a **blockchain transaction** — which the X.173 brief explicitly says to **STOP before performing** and report.

**If the team wants QUALIFIED, authorize Task 4 as described above.** Otherwise, submit as **PARTIAL** with the honest disclosure — the marketplace remains **READY** for TermiX to hire live and evaluate themselves (which is the track’s stated judging method).

---

## 8 · Safety Attestation

```
Transactions during X.173: ZERO
Wallet signatures:         ZERO
Hire clicks:               ZERO
Job 787:                   UNTOUCHED (read-only getJob only, prior probes)
Job 788/789:               NOT CREATED
Agent 2005/1906:           UNTOUCHED
Contracts modified:        NO
Source modified:           NO (this doc is the only new file, untracked until committed)
HARD STOP — no new task was executed.
```

---

_References: `docs/termix/Agent-Advantage-Report.md`, `EXPERIMENT-PROTOCOL.md`, `evidence/*`, `apps/web/lib/termix/advantage-harness.ts`, `packages/integrations/src/termix/*`, `docs/review/X169…md §4`, `X168` Job 787 probe (`chain 97 FUNDED 0.001 U`), official BNB Chain Tracks page (`https://www.bnbchain.org/en/hackathons/smart-money-era`)._
