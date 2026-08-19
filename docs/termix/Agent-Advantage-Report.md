# TermiX Agent Advantage Report

> **Status: REAL MEASUREMENTS RECORDED.** Every number in this document was
> produced by an executed run and is stored under `docs/termix/evidence/`.
> Nothing is estimated, remembered, or illustrative.
>
> The rubric, tasks and baseline procedure were frozen **before** execution in
> [`EXPERIMENT-PROTOCOL.md`](./EXPERIMENT-PROTOCOL.md) and were not revised after
> seeing results.

- **Date of run:** 2026-08-16 (UTC, see `evidence/RUN-METADATA.json`)
- **Harness:** `apps/web/lib/termix/advantage-harness.ts`
- **Marketplace capability under test:** BNB Chain category discovery agent (`lib/eight004scan/discovery/`) + x402 payment screening
- **Blockchain transactions:** NONE. No signing, no submission, no mainnet.

## Executive Summary

Three pre-registered tasks were run in two arms each: **Arm A** (scripted naive
baseline, no marketplace agent) and **Arm B** (marketplace agent). Both arms
received identical inputs and hit the same public data.

**Aggregate rubric score: Arm B 69/75 vs Arm A 24/75.**

What the evidence supports, stated precisely:

- **Provenance and auditability**: Arm B attaches a source, a retrieval
  timestamp, and the exact registry excerpt that justified each match. Arm A
  produced names with no basis. This is the largest and least ambiguous gap.
- **Safety on untrusted payment input** (Task 3): Arm A **accepted** a payment
  challenge selected against BNB **mainnet** (chain 56). Arm B **refused** it.
- **False-positive suppression** (Task 2, health-factor): Arm B eliminated
  **7 of 7** incidental keyword matches — marketing agents and influencer
  personas — with no observed false negatives in that category.

What the evidence does **not** support, stated equally plainly:

- **No cost advantage.** Billable upstream requests were identical in all three
  tasks (1v1, 4v4, 0v0). Monetary cost is `NOT MEASURABLE`.
- **No reliable speed advantage.** Task 2 was effectively a tie
  (4159 ms vs 4214 ms) and Task 3 was 2 ms *slower*. Only Task 1 showed a large
  gap, on a single unaveraged run.
- **No blanket correctness advantage.** In Task 1 the two arms traded different
  error types; Arm B missed 3 genuine yield agents.

---

## Task 1 — Yield-agent discovery on BNB Chain

**Task:** identify agents on chain 56 (non-testnet) whose registry metadata
genuinely indicates yield-optimisation capability.

### Baseline (Arm A)

- Procedure: one direct 8004scan query + naive substring screening on name+description
- **Elapsed: 5513 ms** · **Upstream requests: 1** · Monetary cost: `NOT MEASURABLE`
- Output: `hits 131 / retrieved 100 / selected 62`; names only, no justification, no timestamp

### Marketplace agent (Arm B)

- **Elapsed: 1426 ms** · **Upstream requests: 1** · Monetary cost: `NOT MEASURABLE`
- Output: `hits 131 / retrieved 100 / matched 58`, `retrievedAt 2026-08-16T02:10:19.637Z`,
  source `8004scan`, and per record: slug, chain, verification, matched label,
  evidence field, evidence excerpt, evidence source

### Comparison

| Metric | Arm A | Arm B | Statement supported by evidence |
|---|---|---|---|
| Time | 5513 ms | 1426 ms | Completed in 1426 ms versus 5513 ms **in this single run**. Not averaged; network variance not isolated. |
| Cost (requests) | 1 | 1 | Identical. No cost advantage. |
| Quality (rubric) | 9/25 | 22/25 | Advantage is in completeness, actionability and provenance. |

### Correctness — the honest finding

Arm A selected 62, Arm B matched 58. I adjudicated all 5 divergent records
individually (`evidence/task-01/adjudication.json`):

- **3 were genuine yield agents that Arm B MISSED** — e.g.
  `positioncrew-yield-optimizer.agent`, whose description covers Venus
  stablecoin yield allocation. Cause: the classifier's description-precedence
  rule discards name evidence whenever a description exists.
- **2 were false positives Arm B correctly rejected** — `MolloW` and
  `@cryptohayes · Ensoul`, both persona/analyst profiles with no yield capability.

I verified this mechanism directly against `classifyAgent()`: a record whose
name contains the keyword but whose description does not returns **NONE**.

**Conclusion: neither arm is strictly more correct in Task 1.** Arm B is more
*trustworthy* (every claim justified) but has a real recall weakness.

**Evidence:** `evidence/task-01/{input,arm-a-baseline,arm-b-marketplace,adjudication}.json`

---

## Task 2 — Cross-category triage

**Task:** determine how many BNB Chain agents qualify in each of the four Main
Track categories.

### Baseline (Arm A)

- **Elapsed: 4214 ms** · **Upstream requests: 4** · Monetary cost: `NOT MEASURABLE`
- Output: rebalancing 30 · grid-trading 6 · yield 62 · health-factor 10

### Marketplace agent (Arm B)

- **Elapsed: 4159 ms** · **Upstream requests: 4** · Monetary cost: `NOT MEASURABLE`
- Output: rebalancing 30 · grid-trading 3 · yield 58 · health-factor 3 —
  each with per-category state and justification confirmed available

### Comparison

| Metric | Arm A | Arm B | Statement supported by evidence |
|---|---|---|---|
| Time | 4214 ms | 4159 ms | 55 ms apart on one run. **No speed claim is warranted.** |
| Cost (requests) | 4 | 4 | Identical. |
| Quality (rubric) | 8/25 | 23/25 | Advantage in correctness, provenance, failure-state handling. |

### Per-category adjudication

- **rebalancing** — identical (30 vs 30). No difference to claim.
- **health-factor-monitoring** — **all 7 divergent records were false positives**
  correctly rejected by Arm B: `Global Information A`, `Cryptnostr`, `Fly`
  (a marketing agent), and three influencer personas. Arm B requires a lending
  compound phrase rather than the bare word "health". **Clearest correctness win.**
- **grid-trading** — Arm B applied its documented context guard, requiring
  "grid" to co-occur with trading context, filtering 3 unguarded matches.
- **yield-optimisation** — mixed, as detailed in Task 1.

Arm B also distinguishes `ready` / `empty` / failure states, so an upstream
failure cannot be misread as "no agents exist" — Arm A cannot express this.

**Evidence:** `evidence/task-02/{input,arm-a-baseline,arm-b-marketplace,adjudication}.json`

---

## Task 3 — Security screening of an untrusted payment challenge

**This is the required security-category task.** Fully offline; no signing, no
submission, no transaction.

**Task:** given an untrusted HTTP 402 challenge, decide whether it is safe to
act on — structurally valid, payable, and on the only permitted chain (BNB
Testnet 97). A mainnet-targeted challenge must be refused.

### Baseline (Arm A) — unaided field inspection

- **Elapsed: 0 ms** · Requests: 0
- Valid challenge → **accept** ("network field present")
- Mainnet target → **ACCEPT** ❌ *security failure*
- Malformed body → refuse ("no accepts[]")
- `chainEnforcement: NOT PERFORMED — naive review has no chain allowlist`

### Marketplace agent (Arm B) — parse + chain-pinned selection

- **Elapsed: 2 ms** · Requests: 0
- Valid challenge → **accept** ("payable on bnb-testnet (chain 97)")
- Mainnet target → **REFUSE** ("Mainnet (chain 56) is not enabled for x402 this phase")
- Malformed body → refuse ("carries no payable options")
- `chainEnforcement: ENFORCED`, `signed: false`, `submitted: false`

### Comparison

| Metric | Arm A | Arm B | Statement supported by evidence |
|---|---|---|---|
| Time | 0 ms | 2 ms | Arm B is **2 ms slower**. Both are effectively instant. |
| Cost | 0 | 0 | Identical. |
| Quality (rubric) | 7/25 | 24/25 | 3/3 pre-registered criteria met by Arm B; 2/3 by Arm A. |

**The decisive result:** Arm A accepted a mainnet-targeted payment challenge.
Arm B refused it with a specific reason. This is a safety difference, not a
preference.

**Evidence:** `evidence/task-03/{input,arm-a-baseline,arm-b-marketplace}.json`

---

## Overall Findings

### What the marketplace agent demonstrably improves

1. **Provenance** — every match carries source, timestamp, and the exact
   registry excerpt justifying it (rubric D4: 5/5 vs 1/5 in both data tasks).
2. **Mainnet safety on untrusted payment input** — refused a chain-56 target
   that the baseline accepted (Task 3).
3. **False-positive suppression where phrase rules are strict** — 7/7 eliminated
   in health-factor; context guard applied in grid-trading.
4. **Auditable coverage bounds** — reports `matched ≤ retrieved ≤ hits`, so a
   result can be checked rather than trusted.
5. **Honest failure states** — separates upstream failure from a genuine zero.

### What it does NOT improve

1. **Cost** — identical billable requests in all three tasks. No saving shown.
2. **Speed in general** — Task 2 a tie, Task 3 marginally slower. Only Task 1
   showed a large gap, unaveraged.
3. **Recall in yield-optimisation** — missed 3 genuine agents whose capability
   is in the description but whose keyword is only in the name.
4. **Anything requiring unavailable data** — no APR/APY, no 24h volume, no
   health-factor value. PancakeSwap returned `server-error` during this run
   (deviation D-1) and no pool figure appears anywhere in these results.

### Limitations

- **Single run per arm.** No repetition, no averaging, no confidence interval.
- **Arm A is a scripted naive baseline**, not a skilled human analyst. A skilled
  analyst would likely score higher on correctness, narrowing the D1 gap.
- **The scorer is the implementer.** Mitigated by freezing the rubric in advance
  and scoring only from saved artifacts, but not an independent evaluation.
- **Monetary cost unmeasurable** — no published per-request price.
- **Task 3 uses fixtures**, not a live merchant challenge.
- **Local environment only** — no deployment (X.52 infrastructure blockers).

## Reproducibility

Full instructions: [`REPRODUCIBILITY.md`](./REPRODUCIBILITY.md).

## Evidence Index

| Path | Contents |
|---|---|
| `EXPERIMENT-PROTOCOL.md` | Pre-registered tasks, rubric, baseline procedure, deviations |
| `evidence/RUN-METADATA.json` | Run timestamps, Node version, measurement caveats |
| `evidence/QUALITY-SCORING.json` | Per-dimension scores with justification, both arms, all tasks |
| `evidence/task-01/input.json` | Task 1 input parameters |
| `evidence/task-01/arm-a-baseline.json` | Task 1 baseline: timing, requests, output |
| `evidence/task-01/arm-b-marketplace.json` | Task 1 agent: timing, requests, 58 justified records |
| `evidence/task-01/adjudication.json` | Record-by-record ruling on all 5 divergences |
| `evidence/task-02/input.json` | Task 2 input parameters |
| `evidence/task-02/arm-a-baseline.json` | Task 2 baseline across four categories |
| `evidence/task-02/arm-b-marketplace.json` | Task 2 agent across four categories |
| `evidence/task-02/adjudication.json` | Per-category divergence ruling |
| `evidence/task-03/input.json` | Task 3 challenge fixtures |
| `evidence/task-03/arm-a-baseline.json` | Task 3 baseline decisions |
| `evidence/task-03/arm-b-marketplace.json` | Task 3 agent decisions |

## Required-category check

**Task 3 is a security task** — screening an untrusted payment challenge for
structural validity, payability, and chain safety. This satisfies the
"trading / security / equities" requirement.

## Safety attestation for this run

```text
MAINNET: NOT TOUCHED (a mainnet-targeted challenge was REFUSED, never sent)
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
SIGNING: NONE (signed:false recorded in evidence)
```
