# X.57 TermiX Agent Advantage

- **Date:** 2026-08-16
- **Baseline:** X.55 (TermiX PARTIAL — template only, no measurements; 320 offline checks PASS)
- **Scope:** Complete the TermiX track evidence using real marketplace-agent measurements. No infrastructure provisioning, no blockchain transaction, no mainnet, no Agent 1816 / Job 515 change, no commit/push.
- **Result:** All three pre-registered tasks were **executed with real measurements**. Evidence is stored and the report's claims are bound to it. TermiX moves from *template-only* to *evidence-backed*.

## Why real execution was possible

X.55 recorded TermiX as blocked on "human operator time". On inspection that was
only partly true: the root `.env.local` holds a working `8004SCAN_API_KEY`, and
`8004scan.io:443` is reachable. I verified the marketplace agent returns live
data before defining any task:

```text
getBscCategoryPage('yield-optimisation')
  → state=ready  hits=131  retrieved=100  matched=58  elapsed=3263ms
```

That made a genuine two-arm experiment feasible without credentials I don't have.

## Method integrity

The rubric and tasks were **frozen before execution** in
`docs/termix/EXPERIMENT-PROTOCOL.md` and were not revised afterwards. Both arms
received identical inputs. Timings come from `performance.now()` around the real
call; upstream request counts were observed by wrapping `globalThis.fetch`.
Monetary cost is recorded as `NOT MEASURABLE` because no per-request price is
published — it was not estimated.

One deviation was logged rather than hidden: **D-1**, PancakeSwap returned
`server-error` during environment probing, so no pool figure appears anywhere in
the results.

## Results

| Task | Type | Arm A time | Arm B time | Requests | Rubric A | Rubric B |
|---|---|---:|---:|:--:|---:|---:|
| 1 — Yield-agent discovery | marketplace domain | 5513 ms | 1426 ms | 1 v 1 | 9/25 | 22/25 |
| 2 — Cross-category triage | breadth | 4214 ms | 4159 ms | 4 v 4 | 8/25 | 23/25 |
| 3 — 402 challenge screening | **security** | 0 ms | 2 ms | 0 v 0 | 7/25 | 24/25 |

**Aggregate: Arm B 69/75 vs Arm A 24/75.**

### What the evidence supports

1. **Provenance** — Arm B attaches source, retrieval timestamp, and the exact
   registry excerpt justifying every match (D4: 5/5 vs 1/5). Arm A produced bare names.
2. **Mainnet safety** — In Task 3 Arm A **accepted** a challenge selected against
   BNB mainnet (chain 56); Arm B **refused** it with a specific reason. This is
   the single least ambiguous result.
3. **False-positive suppression** — Health-factor category: **7 of 7** divergent
   records were false positives (a marketing agent, three influencer personas, two
   general analysts) correctly rejected by Arm B.

### What the evidence does NOT support

1. **No cost advantage** — billable requests identical in all three tasks.
2. **No reliable speed advantage** — Task 2 was a 55 ms tie; Task 3 Arm B was
   2 ms *slower*. Only Task 1 showed a large gap, on a single unaveraged run.
3. **No blanket correctness advantage** — see below.

### The correctness finding I did not smooth over

Task 1: Arm A selected 62, Arm B matched 58. I adjudicated all five divergent
records individually instead of assuming the agent was right:

- **3 were genuine yield agents Arm B MISSED** (e.g. `positioncrew-yield-optimizer.agent`,
  which describes Venus stablecoin yield allocation). Cause: the classifier's
  description-precedence rule discards name evidence whenever a description exists.
- **2 were false positives Arm B correctly rejected** (persona/analyst profiles).

I verified the mechanism directly against `classifyAgent()`: a record with the
keyword in its name but not its description returns **NONE**. So Arm B is more
*trustworthy* but has a real recall weakness, and the report says exactly that.

## Claim audit (Step 7)

Every comparative statement in the report was checked against evidence:

- No bare "faster" / "cheaper" / "better" claims remain.
- Timings are stated as e.g. "Completed in 1426 ms versus 5513 ms **in this single
  run**", with the non-averaged caveat attached.
- The Task 2 timing is explicitly described as **not** warranting a speed claim.
- Cost is stated as identical, not improved.
- Quality claims cite the pre-registered rubric and per-dimension justifications.

## Limitations recorded in the report

- Single run per arm; no averaging or confidence intervals.
- Arm A is a **scripted naive baseline**, not a skilled human analyst — a skilled
  analyst would likely narrow the correctness gap.
- The scorer is the implementer; mitigated by pre-registration and scoring only
  from saved artifacts, but not independent.
- Monetary cost unmeasurable; Task 3 uses fixtures, not a live merchant.
- Local environment only (X.52 infrastructure blockers stand).

## Evidence

16 files under `docs/termix/`, including 58 justified agent records:

```text
EXPERIMENT-PROTOCOL.md          pre-registered tasks, rubric, deviations
Agent-Advantage-Report.md       final report
REPRODUCIBILITY.md              full re-run instructions
evidence/RUN-METADATA.json      run timestamps + caveats
evidence/QUALITY-SCORING.json   per-dimension scores, both arms, justified
evidence/task-01/               input, both arms, adjudication of 5 divergences
evidence/task-02/               input, both arms, per-category adjudication
evidence/task-03/               input, both arms (security task)
```

**Credential leak scan:** no credential value appears in any evidence file (verified).

## Code changes

| File | Change |
|---|---|
| `apps/web/lib/termix/advantage-harness.ts` | **New** — two-arm measurement harness (measures only; never scores or invents) |
| `docs/termix/EXPERIMENT-PROTOCOL.md` | **New** — pre-registered protocol |
| `docs/termix/REPRODUCIBILITY.md` | **New** — re-run instructions |
| `docs/termix/Agent-Advantage-Report.md` | Rewritten with real results |
| `docs/termix/evidence/**` | **New** — 13 real artifacts |
| `apps/web/lib/eight004scan/discovery/x53.category.verify.ts` | Assertion updated: template **or** evidence-backed |
| `apps/web/lib/security/x55.gap.verify.ts` | Same invariant update |

Both verifier updates were required because the old assertions demanded the
literal "NO RESULTS RECORDED YET" banner, which is legitimately gone now that
real results exist. The replacement invariant is stricter in spirit: the report
must be either an unfilled template **or** backed by real evidence files — never
a report claiming results without an evidence trail.

## Verification

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | **PASS (exit 0) — 320 checks** |
| `pnpm audit` | PASS — no known vulnerabilities |

```text
X.42 PASS · X.43 PASS · X.44 PASS · X.45 25/25 · X.47 63/63
X.49 25/25 · X.50 34/34 · X.53 21/21 · X.54 23/23 · X.55 22/22
```

No existing test was weakened.

## Status

TermiX is **PARTIAL, not PASS** — deliberately. The measurements are real and the
required security task is satisfied, but three things stop me marking it PASS:

1. **Single-run data** — no repetition or averaging, so the timing figures are
   indicative rather than statistically sound.
2. **Non-independent scoring** — I both implemented the agent and scored the rubric.
3. **Baseline is scripted, not human** — the official framing is human-vs-agent,
   and a skilled human analyst was not measured.

Closing those requires an independent evaluator running `REPRODUCIBILITY.md`,
which is now fully prepared. The honest position is that TermiX has real evidence
where it previously had none.

```text
TERMiX: PARTIAL

TASK 1: REAL EVIDENCE
TASK 2: REAL EVIDENCE
TASK 3: REAL EVIDENCE

BUILD: PASS
TESTS: PASS (320 checks)
AUDIT: PASS

MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT: NO
PUSH: NO
```
