# TermiX Agent Advantage — Pre-Registered Experiment Protocol

> **FROZEN BEFORE EXECUTION.** This file defines the three tasks, their inputs,
> success criteria, quality rubric, and data sources. It was written and saved
> **before** any measurement was taken, so the rubric cannot be retrofitted to
> flatter the results.
>
> Committed order of operations: (1) this protocol → (2) execution →
> (3) results. Any deviation discovered during execution is recorded as a
> deviation, not silently corrected.

## Environment (recorded before execution)

- Repo: `bnb-agent-marketplace`, X.55 state (320 offline checks passing)
- Node v24.14.1, pnpm 9.15.9
- `8004SCAN_API_KEY`: present (server-side, local `.env.local`)
- `PANCAKESWAP_API_KEY`: present (server-side, local `.env.local`)
- Upstream reachability confirmed: `8004scan.io:443`, `open-platform.nodereal.io:443`, `api.binance.com:443`
- No database, no KMS, no deployment (X.52 blockers stand)

## Marketplace capability under test

The measurable marketplace agent is the **BNB Chain category discovery agent**
(`lib/eight004scan/discovery/`), surfaced by the four Main Track category routes.

- **Input:** a category key (`rebalancing` | `grid-trading` | `yield-optimisation` | `health-factor-monitoring`)
- **Output:** classified agents, each with the registry metadata excerpt that
  justified classification, plus auditable counts (`hits` / `retrieved` / `matched`)
  and a retrieval timestamp
- **Timing method:** `Date.now()` around the loader call, single process, warm network
- **Cost:** see "Cost measurability" below

Not under test (verified unavailable, so excluded rather than faked): APR/APY,
24h volume, lending/health-factor values, execution/settlement.

## Cost measurability — decided in advance

This marketplace path uses **no LLM tokens**. Cost is therefore counted in
**billable upstream API requests**, which is directly observable.

- Marketplace arm: instrumented count of outbound HTTP requests
- Baseline arm: count of upstream requests a human evaluator must issue
- Monetary cost: **NOT MEASURABLE** — the 8004scan public tier publishes no
  per-request price in this repo. Recorded as `NOT MEASURABLE`, never estimated.

## Quality rubric (fixed, 0–5 per dimension, max 25)

Applied identically to both arms, by the same scorer, using only the artifacts
saved under `docs/termix/evidence/`.

| Dim | 0 | 3 | 5 |
|---|---|---|---|
| **D1 Correctness** | Wrong/unusable | Mostly right, minor gaps | Every returned record verifiably satisfies the stated criterion |
| **D2 Completeness** | Misses the core ask | Covers the core ask | Covers ask + reports coverage bounds (how much of the corpus was screened) |
| **D3 Actionability** | Cannot act | Needs rework | Directly actionable (identifier present, next step obvious) |
| **D4 Data/source quality** | No sources | Some sourcing | Every record attributed with source + timestamp + the evidence that justified it |
| **D5 Risk awareness** | Risks unstated | Risks mentioned | Limits/unavailable metrics stated explicitly so absence cannot be mistaken for zero |

`NOT ASSESSABLE` is used for any dimension that cannot be scored objectively
from saved evidence.

## Task 1 — Yield-agent discovery on BNB Chain *(marketplace-domain task)*

- **TASK:** Identify agents on BNB Chain (chain 56, non-testnet) whose registry
  metadata genuinely indicates yield-optimisation capability.
- **INPUT:** category `yield-optimisation`; registry corpus = 8004scan `GET /agents`
- **EXPECTED OUTPUT:** a list of matching agents, each with a justification excerpt,
  plus counts describing how much of the corpus was screened.
- **SUCCESS CRITERIA:** (a) every listed agent's own metadata supports the category;
  (b) counts satisfy `matched ≤ retrieved ≤ hits`; (c) a retrieval timestamp exists.
- **DATA SOURCES:** 8004scan public API (`chainId=56`, `isTestnet=false`, `search=yield`)

## Task 2 — Cross-category triage *(breadth under a fixed corpus bound)*

- **TASK:** Determine, for all four Main Track categories, how many BNB Chain
  agents qualify — enough to decide which category has real supply.
- **INPUT:** all four category keys
- **EXPECTED OUTPUT:** per-category matched counts with justification available per record.
- **SUCCESS CRITERIA:** all four categories reported; per-category counts auditable;
  a failure in one category must not blank the others.
- **DATA SOURCES:** same as Task 1, one bounded query per category.

## Task 3 — Security screening of a payment challenge *(SECURITY task — satisfies the required category)*

- **TASK:** Given an untrusted HTTP 402 payment challenge, decide whether it is
  safe to act on: is it structurally valid, is it payable, and is it on the only
  permitted chain (BNB Testnet 97)? A challenge targeting mainnet must be refused.
- **INPUT:** three fixture challenges — (i) valid chain-97 permit2, (ii) same
  challenge selected against mainnet chain 56, (iii) malformed body
- **EXPECTED OUTPUT:** for each, an accept/refuse decision with a reason.
- **SUCCESS CRITERIA:** (i) accepted; (ii) refused as mainnet; (iii) refused as
  malformed. No signing, no submission, no transaction.
- **DATA SOURCES:** none external — pure offline validation
  (`parsePaymentRequired` + `selectPaymentRequirement`)

## Baseline (Arm A) procedure — defined in advance

Arm A is the *unaided* procedure a competent evaluator would follow **without**
the marketplace agent, using the same underlying public data:

- **Task 1/2:** query the 8004scan API directly and screen records by reading
  each `name`/`description`, deciding category membership manually.
- **Task 3:** read the 402 body and reason about scheme/rail/chain by hand
  against the x402 specification.

Arm A is scripted so it is reproducible and timed identically. Its screening
logic is deliberately the *naive* approach (plain substring match), because that
is what an evaluator does before discovering the precedence rules — this
difference is exactly what the experiment measures.

## Deviations log

Recorded during execution, appended here rather than edited into the protocol:

- **D-1:** PancakeSwap upstream returned `server-error` during environment
  probing, so pool data is excluded from all three tasks. Recorded as an
  environmental fact; no pool figure appears in any result.
