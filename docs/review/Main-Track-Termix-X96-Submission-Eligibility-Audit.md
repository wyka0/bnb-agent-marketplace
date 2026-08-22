# Main-Track TermiX X.96 — Submission Evidence & Eligibility Audit

**Date:** 2026-08-21
**Mode:** Documentation / submission audit only. **No production code changed. No deploy/commit/push.**
**Conclusion:** `TERMIX EVIDENCE IS BLOCKED BY REAL MARKETPLACE HIRE AVAILABILITY.`
Existing evidence is genuine **capability-comparison** evidence (real, auditable, honestly
hedged), but it does **not** satisfy the strict requirement "an agent **hired through our
marketplace**". Therefore **SUBMISSION ELIGIBILITY = BLOCKED**; **EVIDENCE VALUE = PARTIAL**.

---

## 1. X.95 starting state

X.95 concluded: `TERMIX EVIDENCE IS BLOCKED BY REAL MARKETPLACE HIRE AVAILABILITY.`

- Real Hire is fail-closed: `POST /api/activation/hire` → **403**; `GET /api/altana/session` → **503** (verified live this session).
- Existing `docs/termix/*` contains a **real, measured** two-arm experiment (3 tasks, frozen rubric), but Arm B was the marketplace's **read-only discovery classifier + x402 screening**, not a hired agent.
- No code changed in X.95. The X.96 boundary reaffirms: no AWS/KMS, ALTANA, keys, sessions, ERC-8183 activation, capability providers, tx, Agent 1816, Job 515, PancakeSwap, mocks, deploys, commits, pushes.

## 2. Official TermiX requirements

The authoritative requirement text (from the X.95/X.96 task brief) mandates, per task:

- **A.** with an agent **hired through our marketplace**;
- **B.** without the agent / baseline.

It further requires: ≥3 real tasks; measure time/cost/output quality/actual outputs; and ≥1 task from trading/stock/equities/**security**.

No separate "official challenge brief" file exists in `docs/` beyond the repo's own
`EXPERIMENT-PROTOCOL.md` / `Agent-Advantage-Report.md`, which describe Arm B as the
"BNB Chain category discovery agent (`lib/eight004scan/discovery/`) + x402 payment
screening" — **not** a marketplace hire. The repo's own artifacts therefore never claim a hire.

**Eligibility-defining clause:** "agent **hired through our marketplace**" — this is the
single clause that, if unmet, blocks submission eligibility. (Per STEP 6 we separate
eligibility from evidence value.)

## 3. Existing Agent Advantage Report

`docs/termix/Agent-Advantage-Report.md` (dated 2026-08-16) — **REAL MEASUREMENTS RECORDED**:

- 3 pre-registered tasks, two arms, identical inputs, same public data.
- Aggregate rubric: **Arm B 69/75 vs Arm A 24/75**.
- Explicitly states: _"Blockchain transactions: NONE. No signing, no submission, no mainnet."_
- Explicit **"What the evidence does NOT support"** section (no cost advantage, no reliable speed advantage, no blanket correctness advantage).
- Safety attestation: `AGENT 1816: NOT TOUCHED`, `JOB 515: NOT TOUCHED`, `BLOCKCHAIN TRANSACTIONS: NONE`.

The report is already honest about what it measured. **No wording rename of Arm B and no
"hired" claim is present**, so **no documentation correction is required**.

## 4. Task-by-task evidence audit

| Task                    | Executed by                                                                                     | Marketplace agent hired? | Inputs                                               | Outputs                                      | Time                                          | Cost                        | Quality       | Repro                |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------- | -------------------------------------------- | --------------------------------------------- | --------------------------- | ------------- | -------------------- |
| 1 Yield discovery       | harness: `getBscCategoryPage(KEY)` (Arm B) vs naive baseline (Arm A)                            | **No**                   | category `yield-optimisation`, chain 56              | hits/retrieved/matched + per-record evidence | 1426 ms vs 5513 ms (Arm B faster, single run) | 1 v 1 req; $ NOT MEASURABLE | 22/25 vs 9/25 | `evidence/task-01/*` |
| 2 Cross-category triage | harness per-category `getBscCategoryPage` (Arm B) vs 4 naive queries (Arm A)                    | **No**                   | 4 category keys                                      | per-category matched counts + justification  | 4159 ms vs 4214 ms (tie)                      | 4 v 4 req; $ NOT MEASURABLE | 23/25 vs 8/25 | `evidence/task-02/*` |
| 3 Security screening    | harness: `parsePaymentRequired`+`selectPaymentRequirement` (Arm B) vs naive field check (Arm A) | **No**                   | 3 x402 fixtures (valid / mainnet-target / malformed) | accept/refuse + reason each                  | 2 ms vs 0 ms (Arm B 2 ms slower)              | 0 v 0 req; $ NOT MEASURABLE | 24/25 vs 7/25 | `evidence/task-03/*` |

Every task has `input.json`, `arm-a-baseline.json`, `arm-b-marketplace.json`, and (tasks 1–2) `adjudication.json`. Output evidence is real and complete. No task involved a hire, funded job, execution, or transaction.

## 5. Arm A / Arm B definition (honest)

- **Arm A (baseline):** the _unaided_ procedure (direct 8004scan query + naive substring screen, or manual x402 field inspection), scripted for parity. No marketplace agent.
- **Arm B (marketplace):** the marketplace's **built-in read-only capability** — `getBscCategoryPage` (registry classification/classifier) plus offline `parsePaymentRequired`/`selectPaymentRequirement` (x402 screening). Run via `apps/web/lib/termix/advantage-harness.ts`.

**This is MARKETPLACE DISCOVERY / CAPABILITY-COMPARISON EVIDENCE, NOT REAL MARKETPLACE-HIRE EVIDENCE.** No `hire` call, no ACTIVE session, no payment, no execution occurred. The Arm B label is accurate (it is the marketplace's agent/feature) but it is **not** an agent _hired through the marketplace Hire flow_.

## 6. Marketplace-hire verification

| Check                                                                  | Result                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `POST /api/activation/hire` (unauth, live)                             | **403** (fail-closed)                                                    |
| `GET /api/altana/session` (live)                                       | **503** (custody unavailable)                                            |
| Hire call inside `advantage-harness.ts`                                | **Absent** — harness only calls `getBscCategoryPage` + x402 parse/select |
| ACTIVE session / funded job / execution in any evidence artifact       | **None**                                                                 |
| Claim "agent hired through marketplace" in `Agent-Advantage-Report.md` | **Not present**                                                          |

**Verdict: REAL MARKETPLACE HIRE = BLOCKED.** A genuine hire cannot be demonstrated because the capability/custody gate is fail-closed (X.91 → X.94).

## 7. 69/75 vs 24/75 calculation audit

From `evidence/QUALITY-SCORING.json` (per-dimension rubric 0–5 × 5 dims = max 25 per task):

| Task      | Arm A         | Arm B          |
| --------- | ------------- | -------------- |
| 1         | 9 (3+3+2+1+0) | 22 (3+5+5+5+4) |
| 2         | 8 (2+3+2+1+0) | 23 (4+5+4+5+5) |
| 3         | 7 (1+2+2+2+0) | 24 (5+5+5+4+5) |
| **Total** | **24**        | **69**         |

Arithmetic verified: 9+8+7 = 24; 22+23+24 = 69; max = 3×25 = 75. **The scores are valid and preserved.**

**What the scores measure:** information quality — provenance (source + timestamp + evidence excerpt per record), completeness (auditable `matched ≤ retrieved ≤ hits`), actionability (stable slugs), data-source quality, and risk awareness; plus **x402/security screening** (Task 3: Arm B refused a mainnet-targeted challenge Arm A accepted). They do **not** measure paid execution, cost savings, or a hiring transaction. The report's own "What the evidence does NOT support" section correctly prevents any implication of "successful paid marketplace execution."

## 8. Trading/stock/security evidence audit

**Task 3 is the required security task** — screening an untrusted HTTP 402 payment challenge for structural validity, payability, and chain safety (mainnet refus
al). It is real (offline fixtures run through actual `parsePaymentRequired`/`selectPaymentRequirement`), and Arm B's correct refusal of a mainnet-targeted challenge is the decisive, unambiguous result. This satisfies the "trading/stock/equities/**security**" requirement. **PASS.**

## 9. Evidence strengths

- Real, executed measurement; nothing estimated or illustrative.
- Frozen pre-registration (protocol before execution) → no rubric retrofitting.
- Per-dimension scoring with written justification; fully reproducible artifacts.
- Honest limitations section (single run, naive baseline, no cost advantage, 3 known false negatives).
- Correct refusal of a mainnet-targeted payment challenge (genuine safety result).
- No fabricated transaction, session, cost, or metric.

## 10. Evidence limitations

- **No marketplace hire** — the disqualifying gap for strict eligibility.
- Single run per arm (no averaging; Task-1 time gap not isolated from network variance).
- Monetary cost `NOT MEASURABLE` (no published per-request price) — honestly stated.
- Arm A is a scripted naive baseline, not a skilled analyst.
- Task 3 uses fixtures, not a live merchant challenge.
- Local-only; no deployment (X.52 infra blockers).

## 11. Submission eligibility (separate from score)

Because the official requirement explicitly requires "an agent **hired through our
marketplace**" and the existing Arm B was not a real marketplace hire, **submission
eligibility for the strict TermiX requirement is BLOCKED.** This is independent of the
experiment's internal quality.

## 12. Potential judging / scoring value

The artifact is legitimate **supporting evidence of marketplace capability advantage**
(discovery provenance + x402 safety). If a judge accepts "capability comparison" rather
than "hired-agent execution", it has real scoring value (69/75 vs 24/75 on a frozen
rubric, with a clear security win). It must be **disclosed honestly** as capability
evidence, never as a hire claim.

## 13. Required dependency for full eligibility

```
REAL MARKETPLACE HIRE
  → REAL EXECUTION (ACTIVE session via /api/activation/hire)
  → REAL RESULT (funded job, actual task performance)
  → REPEAT FOR ≥3 TASKS
  → UPDATED AGENT ADVANTAGE REPORT (Arm A = real hired agent)
```

Blocked today by: no authoritative capability provider (X.91), no ALTANA/AWS-KMS custody, Hire fail-closed (403/503).

## 14. Documentation changes

**None required.** The existing `Agent-Advantage-Report.md` already labels Arm B as the
marketplace discovery agent (not a hire), states "Blockchain transactions: NONE", and
includes an explicit "does NOT support" limitations section. No wording was found that
improperly implies a paid marketplace hire. Per the X.96 boundary, Arm B was **not**
renamed and no "hired" claim was added. (This audit report is the only new artifact.)

## 15. Verification performed

- No production code touched (`apps/web/lib/activation/*`, hire/session routes, ERC-8183, ALTANA, PancakeSwap all unchanged).
- No deploy / commit / push.
- Re-verified live read-only: `/marketplace` 200; `POST /api/activation/hire` 403; `GET /api/altana/session` 503.
- Recomputed 69/75 vs 24/75 from `QUALITY-SCORING.json` — matches.
- X.50 `check-24` untouched (preserved stale assertion, per standing boundary).

## 16. Final classification

| Dimension                         | Result                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| TERMIX REQUIREMENTS               | **PARTIAL** (3 tasks, A/B, measured, ≥1 security satisfied; strict "hired" clause unmet) |
| THREE TASKS                       | **PASS**                                                                                 |
| REAL MARKETPLACE HIRE             | **BLOCKED**                                                                              |
| A/B EVIDENCE                      | **PASS**                                                                                 |
| TIME EVIDENCE                     | **PARTIAL** (single-run, honestly caveated)                                              |
| COST EVIDENCE                     | **PARTIAL** (request counts only; $ NOT MEASURABLE)                                      |
| OUTPUT EVIDENCE                   | **PASS**                                                                                 |
| QUALITY EVIDENCE                  | **PASS**                                                                                 |
| TRADING/STOCK/SECURITY TASK       | **PASS** (Task 3 security)                                                               |
| **TERMIX SUBMISSION ELIGIBILITY** | **BLOCKED**                                                                              |
| **TERMIX EVIDENCE VALUE**         | **PARTIAL**                                                                              |
| **OVERALL X.96**                  | **PARTIAL**                                                                              |

**Critical conclusion (per X.96 rule):** The official requirement explicitly requires "an
agent hired through our marketplace", and the existing Arm B was not a real marketplace
hire. TERMIX SUBMISSION ELIGIBILITY is therefore **NOT PASS** — it is **BLOCKED**. The
existing evidence is genuine capability-comparison evidence, but it does not satisfy the
strict marketplace-hire requirement.

Dependency to unblock: REAL MARKETPLACE HIRE → REAL EXECUTION → REAL RESULT → repeat for
≥3 tasks → updated Agent Advantage Report.

**This audit is complete. No X.97 was started. No code, deploy, commit, or push performed.**
