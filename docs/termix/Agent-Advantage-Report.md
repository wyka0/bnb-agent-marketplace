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
- **Follow-up hired run (2026-09-02):** Tasks 4–6 below add **real funded
  ERC-8183 marketplace hires** of Agent 1906 on BSC Testnet (chain 97) — three
  separately authorized hires, 0.001 U escrow each, with the seller operating
  from its durable public HTTPS endpoint. These hires are **additional
  evidence**, on a different axis (hired execution) from the original
  offline-comparison run, which is preserved unchanged below.

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
  (4159 ms vs 4214 ms) and Task 3 was 2 ms _slower_. Only Task 1 showed a large
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

| Metric           | Arm A   | Arm B   | Statement supported by evidence                                                                          |
| ---------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------- |
| Time             | 5513 ms | 1426 ms | Completed in 1426 ms versus 5513 ms **in this single run**. Not averaged; network variance not isolated. |
| Cost (requests)  | 1       | 1       | Identical. No cost advantage.                                                                            |
| Quality (rubric) | 9/25    | 22/25   | Advantage is in completeness, actionability and provenance.                                              |

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
_trustworthy_ (every claim justified) but has a real recall weakness.

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

| Metric           | Arm A   | Arm B   | Statement supported by evidence                               |
| ---------------- | ------- | ------- | ------------------------------------------------------------- |
| Time             | 4214 ms | 4159 ms | 55 ms apart on one run. **No speed claim is warranted.**      |
| Cost (requests)  | 4       | 4       | Identical.                                                    |
| Quality (rubric) | 8/25    | 23/25   | Advantage in correctness, provenance, failure-state handling. |

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
- Mainnet target → **ACCEPT** ❌ _security failure_
- Malformed body → refuse ("no accepts[]")
- `chainEnforcement: NOT PERFORMED — naive review has no chain allowlist`

### Marketplace agent (Arm B) — parse + chain-pinned selection

- **Elapsed: 2 ms** · Requests: 0
- Valid challenge → **accept** ("payable on bnb-testnet (chain 97)")
- Mainnet target → **REFUSE** ("Mainnet (chain 56) is not enabled for x402 this phase")
- Malformed body → refuse ("carries no payable options")
- `chainEnforcement: ENFORCED`, `signed: false`, `submitted: false`

### Comparison

| Metric           | Arm A | Arm B | Statement supported by evidence                         |
| ---------------- | ----- | ----- | ------------------------------------------------------- |
| Time             | 0 ms  | 2 ms  | Arm B is **2 ms slower**. Both are effectively instant. |
| Cost             | 0     | 0     | Identical.                                              |
| Quality (rubric) | 7/25  | 24/25 | 3/3 pre-registered criteria met by Arm B; 2/3 by Arm A. |

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

| Path                                      | Contents                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `EXPERIMENT-PROTOCOL.md`                  | Pre-registered tasks, rubric, baseline procedure, deviations                 |
| `evidence/RUN-METADATA.json`              | Run timestamps, Node version, measurement caveats                            |
| `evidence/QUALITY-SCORING.json`           | Per-dimension scores with justification, both arms, all tasks                |
| `evidence/task-01/input.json`             | Task 1 input parameters                                                      |
| `evidence/task-01/arm-a-baseline.json`    | Task 1 baseline: timing, requests, output                                    |
| `evidence/task-01/arm-b-marketplace.json` | Task 1 agent: timing, requests, 58 justified records                         |
| `evidence/task-01/adjudication.json`      | Record-by-record ruling on all 5 divergences                                 |
| `evidence/task-02/input.json`             | Task 2 input parameters                                                      |
| `evidence/task-02/arm-a-baseline.json`    | Task 2 baseline across four categories                                       |
| `evidence/task-02/arm-b-marketplace.json` | Task 2 agent across four categories                                          |
| `evidence/task-02/adjudication.json`      | Per-category divergence ruling                                               |
| `evidence/task-03/input.json`             | Task 3 challenge fixtures                                                    |
| `evidence/task-03/arm-a-baseline.json`    | Task 3 baseline decisions                                                    |
| `evidence/task-03/arm-b-marketplace.json` | Task 3 agent decisions                                                       |
| `evidence/task-04/input.json`             | Hired Task 4 input (grid-strategy report request)                            |
| `evidence/task-04/arm-b-marketplace.json` | Hired Task 4: job 920 full lifecycle, 6 tx hashes, deliverable, provenance   |
| `evidence/task-05/input.json`             | Hired Task 5 input (discovery shortlist request)                             |
| `evidence/task-05/arm-b-marketplace.json` | Hired Task 5: job 921 full lifecycle, shortlist, owner-verification evidence |
| `evidence/task-06/input.json`             | Hired Task 6 input (security-posture request)                                |
| `evidence/task-06/arm-b-marketplace.json` | Hired Task 6: job 922 full lifecycle, wiring/census/indicators report        |

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

---

# Part II — Hired-arm run (Tasks 4–6, 2026-09-02)

> **Scope note.** The original protocol (Part I) froze three offline-comparison
> tasks and their 0–5 rubric. Tasks 4–6 are a **follow-up measurement on a
> different axis**: real funded ERC-8183 commercial hires of the marketplace
> seller agent (Agent 1906) through the BNB Agent Marketplace hire path. They
> reuse the **same rubric dimensions** (D1–D5, 0–5 each) so the hired evidence
> can be scored with the same discipline, but they are **not** a re-run of the
> Part I comparison and produce **no new A-vs-B comparison claims**. Part I's
> aggregate (24 vs 69) is unchanged.

## Hired-arm setup (all facts recorded in the per-task evidence)

- **Agent:** `97:0x8004A818BFB912233c491871b3d84c89A494BD9e:1906`
  ("BNB Agent Studio v2 Testnet Seller"), owner/seller
  `0xB0f7681668f916eEd97dA066D31aA295D34727c0`, served from its durable public
  HTTPS endpoint `https://inbook-y1-plus.tail3e3640.ts.net` (Tailscale Funnel).
- **Hire path:** the production marketplace flow — registry endpoint
  resolution → live `POST /negotiate` → `provider_sig` verified against the
  on-chain agent owner with the official SDK verifier (signer == owner in all
  three hires) → the 5-call ERC-8183 browser-wallet plan
  (`createJob` → `registerJob` → `setBudget` → `approve` → `fund`) executed by
  the buyer wallet `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` → seller
  `fundedJobWatcher` delivery → on-chain `submitResult`.
- **Escrow:** 0.001 U ($U testnet token `0xc70B8741…E5565`) per job —
  **chain-verified** on every hire. Gas is testnet tBNB (no market value).
- **Every hire was separately user-authorized** before broadcast; each hire's
  tx hashes, blocks, and timestamps are in the evidence files.

## Task 4 — Grid-strategy report (hired)

**Objective:** a concrete grid-trading strategy report for a stablecoin pair on
BSC Testnet: spacing, capital split, range bounds, risk controls; analysis-only.

- **Job:** `920` · funded 2026-09-02T13:20:26Z → submitted 13:41:00Z
  (**20.6 min**; ~20 min of this was a diagnosed-and-fixed seller-side RPC
  rate-limit stall — the operational fix, `RPC_URL_BSC_TESTNET=…publicnode.com`,
  is recorded in the evidence, not an intrinsic latency)
- **Cost:** 0.001 U escrow + 1,534,330 gas (6 txs) —
  `0xf24a7c56…c834`, `0x2e04922c…18cb`, `0xc34be3ff…ff4d`, `0xfb3c508d…0944`,
  `0xccc300b0…6277`, seller submit `0xbbb75532…f398`
- **Actual output:** `{"model":"v2-seller-v1","content":"fulfilled 920"}` —
  a fulfillment acknowledgment. **The substantive output was limited**: the
  v2-seller's canned fulfillment does not produce a real strategy analysis.
  The hire lifecycle, escrow, and provenance are fully real (deliverable hash
  `0x2965fb04…294c6` → `GET /job/920/response`, submitted by the escrowed
  seller wallet); the _content_ is honest but thin. Final state: **COMPLETED**
  (escrow settled — the full commercial lifecycle executed).

## Task 5 — Discovery shortlist (hired)

**Objective:** a deterministic discovery shortlist of registered chain-97 agents
for grid-strategy opportunities: keyword "grid", top 5, verified-first
ordering, on-chain owner verification.

- **Job:** `921` · funded 14:18:07Z → submitted 14:18:51Z (**44 s**)
- **Cost:** 0.001 U escrow + 1,643,172 gas (6 txs) — `0x183af552…ac43`,
  `0x0befc541…9100`, `0x49fb21e2…ed46`, `0xf1ac80aa…bfda`, `0x101f5003…4b00`,
  seller submit `0xb47242d3…cea9`
- **Actual output:** a **real deterministic shortlist** of 5 registered
  agents (tokens 1960–1964), every field sourced from the 8004scan indexer,
  with **on-chain owner verification (`owner_match: true` for all five)** via
  `getAgentInfo`, plus explicit source, criteria, and limitations in the
  deliverable. Final state: **COMPLETED**.
- **Deviation (transparent):** the requested keyword filter did not apply —
  the seller's regex missed the JSON-escaped `\"grid\"` — so the delivered
  shortlist is the _unfiltered_ deterministic top-5. **The seller itself
  reported `criteria.keyword: null` in its output** rather than claiming the
  filter ran; no fabricated filtering is claimed. (A separate read-only probe
  confirmed the keyword filter works and finds 6 genuine grid agents.)
  Additionally, all five returned agents are unverified/score-0 — the registry
  data passed through as reported, not inflated.

## Task 6 — Security verdict (hired)

**Objective:** a BSC Testnet ERC-8183 security-posture report: contract wiring,
dispute-window configuration, job-status census (sample 50), refund-eligibility
exposure, buyer allowance hygiene, indicators, explicit limitations.
**Read-only analysis only** — no exploitation, no attacks, no state changes;
the fulfillment used only public view calls.

- **Job:** `922` · funded 14:45:54Z → submitted 14:46:50Z (**56 s**)
- **Cost:** 0.001 U escrow + 1,751,591 gas (6 txs) — `0x27f70cd2…ac23`,
  `0x5597c34f…040e`, `0x61437ef7…4028`, `0x364f7ecb…3ec6`, `0x0d0a1bd2…44ab`,
  seller submit `0xbc5d025f…9fe7`
- **Actual output:** a genuine on-chain security-posture report — all 5
  wiring checks PASS against the live deployment (router→Commerce, policy→
  Router, router not paused, disputeWindow 900 s sane, 0 bp fee); census of
  jobs 873–922 (34 OPEN / 6 FUNDED / 1 SUBMITTED / 8 COMPLETED / 1 REJECTED,
  0 missing expiry); **real finding E1 (info): 5 expired-FUNDED jobs
  refund-eligible via `claimRefund`**; buyer hygiene (allowance 0 — exact
  consumption, no over-approval); 4 explicit limitations. Final state:
  **COMPLETED**.

## Hired-arm quality scoring (same frozen rubric dimensions, D1–D5, max 25)

Scored by the same scorer from the saved artifacts only. The **comparison arm
of Part I is not re-scored here** — these scores stand alone as the hired arm.

### Task 4 (hired)

| Dim                    | Score     | Justification (from `evidence/task-04/arm-b-marketplace.json`)                                                                                        |
| ---------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Correctness         | 2         | The deliverable is truthful but does not satisfy the stated substantive ask (a strategy report); it is a fulfillment acknowledgment.                  |
| D2 Completeness        | 1         | Core ask (spacing/split/bounds/risk controls) not covered.                                                                                            |
| D3 Actionability       | 1         | `fulfilled 920` carries no usable content for a decision.                                                                                             |
| D4 Data/source quality | 4         | Provenance is fully verifiable on-chain (deliverable hash → seller route, submitted by the escrowed provider), with model metadata.                   |
| D5 Risk awareness      | 3         | The evidence files (not the deliverable content) state limitations; the deliverable itself carries none. Scored from artifacts as the rubric directs. |
| **Total**              | **11/25** | Real, honest lifecycle; limited substantive output — recorded as such.                                                                                |

### Task 5 (hired)

| Dim                    | Score     | Justification                                                                                                                                                                              |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 Correctness         | 3         | All 5 returned records are genuine registered agents with on-chain owner match; but the requested keyword filter did not apply (unfiltered top-5 returned) — mostly right with a real gap. |
| D2 Completeness        | 4         | Core ask covered (5 real agents, verified owners, ordering rule stated); coverage bounds partially stated (first-100 window noted in limitations).                                         |
| D3 Actionability       | 5         | Every record carries stable `agent_id`/`token_id`, owner, protocols — directly follow-up-able.                                                                                             |
| D4 Data/source quality | 5         | Source named, `generatedAt` timestamp, per-record fields from the indexer, owner verified on-chain, seller transparently reported its own filter miss.                                     |
| D5 Risk awareness      | 4         | Explicit limitations section; the filter deviation was self-reported in-output rather than hidden. Not 5 because no per-record exclusion rationale was required by the simple criteria.    |
| **Total**              | **21/25** | A genuinely useful, fully sourced discovery artifact with one transparent deviation.                                                                                                       |

### Task 6 (hired)

| Dim                    | Score     | Justification                                                                                                                                                               |
| ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Correctness         | 5         | Every wiring check verified against the live contracts; census numbers are direct on-chain batch reads.                                                                     |
| D2 Completeness        | 4         | All requested sections delivered (wiring, dispute window, census, refund exposure, buyer hygiene, indicators, limitations); census bounded to a 50-job sample as specified. |
| D3 Actionability       | 4         | Concrete indicator IDs with severity and observed values; findings are directly checkable (e.g. E1's expired-FUNDED jobs).                                                  |
| D4 Data/source quality | 5         | Every field attributed to a public view read via PublicNode; methodology, source, and timestamp explicit.                                                                   |
| D5 Risk awareness      | 5         | Four explicit limitations, including that refund eligibility ≠ reclaim guarantee and that no exploit testing was performed.                                                 |
| **Total**              | **23/25** | The strongest hired deliverable: a real, checkable, read-only security analysis.                                                                                            |

## Hired-arm summary — what the evidence supports

Stated precisely:

- **The full commercial hire lifecycle is real and proven, end-to-end, three
  times**: negotiated quote with a verified provider signature (signer ==
  on-chain agent owner), escrow funded on-chain (0.001 U each), seller delivery
  with on-chain deliverable hashes, and final **COMPLETED** settlement of all
  three escrows. Provenance is checkable by anyone from the recorded tx hashes
  and `GET /job/{920,921,922}/response`.
- **The hired deliverable quality improved as the fulfillment implementation
  was upgraded**: Task 4 (11/25, acknowledgment content) → Task 5 (21/25, real
  sourced shortlist) → Task 6 (23/25, real security analysis). Task 4's
  limited substantive output and Task 5's self-reported filter deviation are
  recorded as limitations, not smoothed over.
- **Elapsed funded→submitted**: 20.6 min (with a diagnosed/fixed RPC stall) →
  44 s → 56 s. Single runs; not averaged.
- **Cost**: 0.001 U per hire, chain-verified. No USD conversion is claimed —
  $U is a testnet token.

What the evidence does **not** support:

- **No speed/cost comparison claims vs the offline Part I arms** — different
  axis, different tasks, single runs.
- **No claim that the hired arm "wins" anything** — Part I's comparison verdict
  stands on its own; the hired run demonstrates a **working, payable,
  provenance-verifiable commercial hire path**, not superiority.
- **No statistical significance** — n=3 hires, single runs.

**Evidence:** `evidence/task-04/`, `evidence/task-05/`, `evidence/task-06/`
(each: `input.json` + `arm-b-marketplace.json` with full tx hashes, receipts,
timestamps, deliverable content, provenance, and honest deviations).
Transaction hashes above are abbreviated prefixes for readability; the
**canonical full hashes and per-tx receipts are in the per-task evidence
files**, which are the authoritative record for every number in Part II.

## Safety attestation for the hired run

```text
MAINNET: NOT TOUCHED (all hires on BSC Testnet, chain 97)
AGENT 1906: normal hire interactions only (per-job escrow; no config/endpoint changes)
AGENT 2005: NOT TOUCHED
JOB 787: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: 18 total — 3 separately authorized hires x (5 buyer calls + 1 seller submit); no retries, no other transactions
SIGNING: buyer wallet signed its own 15 hire transactions; seller keystore signed 3 submit transactions and quote signatures. No private keys exposed.
ESCROW: all three 0.001 U escrows COMPLETED (settled) — no refunds were claimed.
```
