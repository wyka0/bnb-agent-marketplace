# Main-Track TermiX X.95 — Agent Advantage Readiness & Task Selection

**Date:** 2026-08-21
**Mode:** READ-ONLY assessment + documentation. **No code changes.** No deploy/commit/push.
**Conclusion:** `TERMIX EVIDENCE IS BLOCKED BY REAL MARKETPLACE HIRE AVAILABILITY.`
A genuine, honest, _partial_ capability-comparison report already exists on disk — but it
does **not** satisfy the strict TermiX requirement of "an agent **hired through our
marketplace**", because real marketplace hire is fail-closed (X.91 → X.94).

This report documents exactly what is real, what is missing, and the single unblock
path. It stops short of any fabrication (no mock hire, no simulated session, no invented
cost/metric).

---

## 1. The TermiX requirement (as stated for X.95)

1. At least **3 real tasks**.
2. Each performed **two ways**:
   - **A.** with an agent **hired through our marketplace**;
   - **B.** without the agent / baseline.
3. Measure per task: **time, cost, output quality, actual outputs**.
4. At least one task in **trading / stock / equities / security**.
5. Produce the required **Agent Advantage Report**.

## 2. What already exists (REAL, verified on disk this session)

| Artifact                                   | Path                                                                          | Status                              |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------- |
| Agent Advantage Report                     | `docs/termix/Agent-Advantage-Report.md`                                       | REAL measurements, dated 2026-08-16 |
| Experiment protocol (frozen pre-execution) | `docs/termix/EXPERIMENT-PROTOCOL.md`                                          | REAL, pre-registered rubric         |
| Two-arm harness                            | `apps/web/lib/termix/advantage-harness.ts`                                    | REAL code (X.57)                    |
| Evidence artifacts                         | `docs/termix/evidence/**` (3 tasks + QUALITY-SCORING.json, RUN-METADATA.json) | REAL                                |
| Reproducibility note                       | `docs/termix/REPRODUCIBILITY.md`                                              | REAL                                |

The harness (`advantage-harness.ts`) genuinely:

- Gives Arm A and Arm B **equivalent inputs** (`:88-104`, `:143-169`, `:200-233`).
- Times with `performance.now()` around the real call (`:44-58`, `:51`).
- Counts **upstream requests** as a billable-unit proxy (`:44-50`).
- Emits monetary cost as **`"NOT MEASURABLE"`** — never estimated (`:12`, `:107`, `:237`).
- Performs **no blockchain transaction, no signing, no mainnet** (`:13`, `:178`, `:229-231`).
- Uses an **honest fixed rubric** (0–5 × 5 dims) frozen before execution
  (`EXPERIMENT-PROTOCOL.md:46-60`), applied identically to both arms.

**3 tasks present (satisfies req. 1):**

- Task 1 — yield-agent discovery (trading/DeFi domain).
- Task 2 — cross-category triage.
- Task 3 — **security** screening of an untrusted 402 payment challenge
  (`EXPERIMENT-PROTOCOL.md:83-94`) → **satisfies req. 4 (security task).**

**A/B + measured dimensions (satisfies reqs. 2-3, partially):**

- Arm A = naive unaided baseline; Arm B = marketplace mechanism.
- Per task: `elapsedMs`, `upstreamRequests`, `monetaryCost`, and full output JSON.
- Quality scored via the frozen rubric → aggregate **Arm B 69/75 vs Arm A 24/75**
  (per `Agent-Advantage-Report.md`).

## 3. The hard gap: "**hired through our marketplace**" is NOT satisfied

The X.95 requirement's Arm A is explicitly _"with an agent **hired through our
marketplace**."_ The existing experiment's "Arm B (marketplace agent)" is, verbatim in
the harness, the **marketplace's read-only category discovery code**

```
// advantage-harness.ts:103-104
// ---- Arm B: the marketplace agent. ----
const armB = await measure(() => getBscCategoryPage(KEY));
```

plus an **offline** x402 parse/select (`advantage-harness.ts:219-233`). This is the
marketplace's **internal discovery classifier** surfaced by the category routes — it is
**not** an agent that was _hired_ via the marketplace Hire flow. There is:

- **no `/api/activation/hire` call**,
- **no ACTIVE session**,
- **no payment / x402 settlement**,
- **no autonomous execution** of the task by a hired agent.

`EXPERIMENT-PROTOCOL.md:21-24` is itself explicit: _"The measurable marketplace agent
is the **BNB Chain category discovery agent** (`lib/eight004scan/discovery/`)…"_ — i.e. a
built-in capability, **not a hired agent**. The existing report is therefore honest
about what it measured; it must **not** be relabeled as a "marketplace-hire" experiment.

### Why a real hire cannot happen (confirmed live this session)

- `POST /api/activation/hire` unauthenticated → **403** (fail-closed gate, X.80/X.81).
- `GET /api/altana/session` → **503** (custody/execution capability unavailable, X.91).
- `GET /marketplace` → **200** (surfaced agents are **read-only ERC-8004 registry
  listings**, not hireable — Hire is blocked).
- X.91 authoritative capability source: **NONE** (no ALTANA/AWS-KMS custody available).
- X.94 production-readiness: **OUTCOME A / READY** _only because_ the honest posture is
  fail-closed and discloses the BLOCKED activation.

Therefore **req. 2 (Arm A = agent hired through our marketplace) is unachievable** with
the current build. Per X.95 step 4/12 this forces the classification: **BLOCKED for real
marketplace-hired execution.**

## 4. X.95 classification

| Component                                       | State                          | Reason                                            |
| ----------------------------------------------- | ------------------------------ | ------------------------------------------------- |
| 3 real tasks                                    | ✅ Met                         | Tasks 1-3 present & real                          |
| ≥1 security task                                | ✅ Met                         | Task 3 (402 screening)                            |
| A/B measurement (time/cost/quality/outputs)     | ✅ Met (capability comparison) | honest harness, frozen rubric                     |
| Arm A = **agent hired through our marketplace** | ❌ Blocked                     | Hire fail-closed (403/503); no real hire possible |
| Overall TermiX requirement                      | **BLOCKED**                    | the "hired" arm is unavailable                    |

**Honest verdict:** `TERMIX EVIDENCE IS BLOCKED BY REAL MARKETPLACE HIRE AVAILABILITY.`

The existing `docs/termix/Agent-Advantage-Report.md` is **valid, reusable PARTIAL
evidence** (marketplace _capability_ advantage vs baseline) and can be submitted **as
such** — but it must not be presented as a marketplace-_hire_ experiment.

## 5. Candidate task matrix (for when hire is unblocked)

Prepared so re-running is mechanical once X.91 is resolved:

| #   | Task                                                       | Category (req.4) | Arm A (hired agent)                    | Arm B (baseline)  |
| --- | ---------------------------------------------------------- | ---------------- | -------------------------------------- | ----------------- |
| A   | Execute a grid/rebalancing order on a sandbox venue        | **trading**      | hired agent calls execution capability | manual API calls  |
| B   | Screen an untrusted 402 payment challenge for mainnet trap | **security**     | hired agent runs x402 screening        | manual inspection |
| C   | Pull live health-factor + yield for a portfolio            | DeFi             | hired agent aggregates registry data   | manual queries    |

All three are real, measurable, and ≥1 is trading/security. The harness pattern in
`advantage-harness.ts` can be extended to call a **real** hire (Arm A) once
`/api/activation/hire` returns ACTIVE.

## 6. Unblock path (single dependency)

1. **Complete X.91** — stand up an authoritative external capability provider with real
   custody/execution (ALTANA or AWS-KMS path) so `/api/altana/session` returns a usable
   session and `/api/activation/hire` can mint an ACTIVE session (currently 503/403).
2. Re-run an honest two-arm harness where **Arm A = real hired agent** (via the Hire
   flow) and **Arm B = baseline**.
3. Re-score with the existing frozen rubric; publish a _true_ Agent Advantage Report.

Until step 1 exists, **no honest marketplace-hire TermiX evidence can be produced.**

## 7. Anti-fabrication guardrails (observed, maintained)

- No mock hire, no "simulated session", no invented cost/quality numbers were added.
- Existing evidence uses `"NOT MEASURABLE"` for cost — preserved, not estimated.
- The fail-closed gates (X.80-X.85) were **not** modified; Hire remains honestly 403.
- No deployment performed; assessment is read-only.

## 8. Recommendation to user

- **If the organizer accepts "marketplace capability advantage"** (not strictly
  "hired-agent advantage"): the existing `docs/termix/Agent-Advantage-Report.md` plus
  this readiness note is a defensible, honest submission.
- **If "hired through our marketplace" is mandatory:** it is **BLOCKED**; do not submit a
  hire claim. Either (a) complete X.91 first, or (b) explicitly disclose the limitation
  in the submission (as `Main-Track-Final-Submission-Evidence.md` already does for
  activation).

**This assessment is complete. No X.96 was started.**
