# Main Track Activation X.74 - TERMiX Track Closure

- **Date:** 2026-08-19
- **Baseline:** X.57 TERMiX Agent Advantage
- **Scope:** Evidence review and closure classification for TERMiX only
- **Final experiment classification:** **TERMiX: PARTIAL**
- **Production integration classification:** **PASS (read-only reputation integration)**

## 1. X.57 baseline

X.57 moved TERMiX from an unfilled experiment template to real, saved evidence.
It recorded three pre-registered two-arm tasks and scored the scripted baseline
(Arm A) against the marketplace agent (Arm B):

| Task                    |     Arm A |     Arm B |  Requests | Timing finding                       |
| ----------------------- | --------: | --------: | --------: | ------------------------------------ |
| Yield-agent discovery   |      9/25 |     22/25 |    1 vs 1 | 5513 ms vs 1426 ms in one run only   |
| Cross-category triage   |      8/25 |     23/25 |    4 vs 4 | 4214 ms vs 4159 ms; effectively tied |
| 402 challenge screening |      7/25 |     24/25 |    0 vs 0 | 0 ms vs 2 ms; Arm B slower           |
| **Aggregate**           | **24/75** | **69/75** | identical | no general speed claim               |

X.57 classified TERMiX as PARTIAL because:

1. Each arm was run once, without repetition, averaging, or confidence bounds.
2. The implementer also scored and adjudicated the experiment.
3. Arm A was a scripted naive substring baseline, not a skilled human analyst.

Those findings have not been changed or reinterpreted in X.74.

## 2. Existing evidence

The repository contains the complete X.57 evidence directory described by the
report:

- `docs/termix/EXPERIMENT-PROTOCOL.md`
- `docs/termix/REPRODUCIBILITY.md`
- `docs/termix/Agent-Advantage-Report.md`
- `docs/termix/evidence/RUN-METADATA.json`
- `docs/termix/evidence/QUALITY-SCORING.json`
- task inputs, arm outputs, and adjudications under `evidence/task-01..03/`
- `apps/web/lib/termix/advantage-harness.ts`

The stored evidence supports the original bounded claims:

- **Mainnet safety advantage:** Arm B refused the chain-56 selection that the
  scripted baseline accepted. The fixture run records `signed:false` and
  `submitted:false`.
- **Provenance advantage:** Task 1 Arm B retained 58 records with slug, chain,
  verification, evidence field, excerpt, source, and retrieval timestamp.
- **False-positive suppression:** the health-factor phrase guard removed the
  incidental matches reported by X.57; grid matching also applied a context guard.
- **No cost advantage:** observed upstream requests were 1 vs 1, 4 vs 4, and
  0 vs 0. Monetary cost remains `NOT MEASURABLE`.
- **No reliable speed advantage:** the only large difference was one unaveraged
  network run. Task 2 tied and Task 3 was slower for Arm B.
- **No blanket correctness advantage:** Arm B missed three genuine yield agents.

No cost, speed, registry, or human-baseline result has been invented in X.74.

## 3. Reproducibility assessment

Reproducibility must be separated into procedure repeatability and independent
verification of the historical result.

### Procedure repeatability: PASS

An evaluator can run the same procedure prospectively because the repository has:

- task definitions and success criteria;
- a fixed five-dimension rubric;
- explicit Arm A and Arm B definitions;
- embedded Task 3 fixtures;
- category and chain inputs;
- a measurement harness;
- request-count and wall-clock procedures;
- environment prerequisites and a server-only loader shim;
- safety boundaries and rerun instructions.

### Historical X.57 result reproducibility: PARTIAL

The saved artifacts are not sufficient for a fully independent reconstruction of
all historical scores and adjudications:

1. Task 1 Arm A stores only five sample names, not all 62 selected records.
2. Task 2 stores counts for both arms rather than the complete record sets used
   for divergence adjudication.
3. The health-factor adjudication states 7/7 false positives but its
   `inspected_records` array lists six records.
4. The 8004scan registry is mutable; a current rerun cannot recreate the exact
   2026-08-16 corpus without a frozen raw-response fixture.
5. The harness writes directly to `docs/termix/evidence/` and overwrites the
   historical files. It has no run ID or append-only output directory.
6. The protocol says it was frozen before execution, and run metadata contains
   timestamps, but protocol, evidence, and scoring first entered Git together in
   commit `b441c21`. Git history therefore proves repository presence, not the
   claimed pre-run ordering independently.
7. Task 1 Arm B has a retrieval timestamp and source. Task 2's compact output
   omits per-category retrieval timestamps and full records.

Therefore an independent evaluator can repeat the method, but cannot reproduce
or audit every historical X.57 scoring input solely from immutable repository
artifacts.

## 4. Additional experiments

No new live comparison run was performed.

This was deliberate and justified:

- the current harness would overwrite the X.57 evidence, violating the instruction
  to preserve the original run;
- current registry contents are not the frozen X.57 corpus, so a rerun would be a
  different experiment population;
- additional self-run measurements would not fix non-independent scoring or the
  absence of a skilled human baseline;
- no minimum number of repeated runs or statistical acceptance criterion was
  pre-registered, so selecting a number now would be post-hoc;
- Task 3 is deterministic fixture validation and repetition would not add useful
  evidence.

The original X.57 results remain intact. No run was cherry-picked or replaced.

## 5. Results

X.74 confirms the following classifications of the X.57 claims:

| Claim                                    | Status                       | Reason                                                                                          |
| ---------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Mainnet safety advantage                 | Supported                    | deterministic fixture; Arm B refused chain 56                                                   |
| Provenance/auditability advantage        | Supported                    | saved Arm B records contain source and evidence                                                 |
| Health-factor false-positive suppression | Supported, with artifact gap | mechanism and result recorded; one of seven inspected records is absent from adjudication array |
| Cost advantage                           | Not established              | request counts identical; monetary cost unavailable                                             |
| Reliable speed advantage                 | Not established              | one run; tie/slower results in Tasks 2/3                                                        |
| Blanket correctness advantage            | Not established              | three genuine yield false negatives                                                             |
| Independent evaluation                   | Not established              | implementer performed scoring/adjudication                                                      |
| Skilled-human advantage                  | Not established              | Arm A is scripted and deliberately naive                                                        |

## 6. False-positive / false-negative analysis

The X.57 yield recall issue remains in the current implementation.

`classifyAgentText()` still follows description precedence: name evidence is
considered only when the description is empty. A direct X.74 mechanism check
returned zero categories for:

- name `positioncrew-yield-optimizer.agent` with a substantive Venus allocation
  description lacking the literal classifier phrase;
- name `DeFi-Yield-Optimizer.agent` with description text containing plural
  `yields`, which does not satisfy the singular `\byield\b` rule.

A control description containing `yield` matched `yield-optimisation`.

The original three misses therefore remain valid. More precisely, the saved
adjudication shows two related mechanisms under the broader X.57 classifier issue:

1. description precedence prevents name evidence from supplementing a non-empty
   description; and
2. the phrase table does not match plural `yields` in the third record.

No classifier change was made. Broadening name or phrase matching only to improve
the known score would be evaluation-driven optimization and could reintroduce the
false positives the classifier is designed to suppress. A correction would require
a separately specified rule and regression corpus, not an X.74 score adjustment.

## 7. Independence limitations

Scoring remains non-independent:

- the same implementation effort produced the agent, harness, rubric application,
  scoring file, and adjudications;
- no independent evaluator result, signature, review record, or separately
  generated scoring artifact exists;
- pre-registration and saved explanations reduce discretion but do not create
  evaluator independence;
- the scripted baseline is reproducible, but it is not evidence of performance
  against a skilled human analyst.

This limitation cannot be closed by another run performed by the same evaluator.

## 8. Production integration status

**TERMiX PRODUCTION INTEGRATION: PASS (read-only reputation integration).**

The existing production agent detail page renders a separate TERMiX reputation
section. A production read of the real encoded agent route confirmed:

- `TermiX Reputation` is present;
- `TermiX AACP - Read-only on-chain reputation` is present;
- unsupported identity is represented honestly as unavailable;
- no `Combined Reputation` appears;
- no `Hire via TermiX` control appears.

The integration is read-only, chain-97-only for deterministic identity mapping,
and independent of the X.57 comparative experiment. Production deployment is not
required to validate that experiment, and no sponsor requirement stating otherwise
exists in the available project evidence.

TERMiX execution, hiring, settlement, and real-agent activation remain intentionally
not implemented and are not required for this classification.

## 9. Build and verifier status

| Check                                | Result                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| Web TERMiX reputation verifier       | PASS - 11 offline fixture checks                         |
| Canonical TERMiX reputation verifier | PASS - 14 offline fixture checks                         |
| X.53 category/evidence verifier      | PASS - 21 checks                                         |
| X.55 gap/evidence verifier           | PASS - 22 checks                                         |
| `pnpm typecheck`                     | PASS - 14/14 tasks                                       |
| `pnpm lint`                          | PASS - 14/14 tasks                                       |
| `pnpm build`                         | PASS - 8/8 tasks                                         |
| Full `pnpm test`                     | Not run; unnecessary for this documentation-only closure |

The known X.50 stale check-24 assertion was not modified. Existing verifiers were
not weakened.

## 10. Final TERMiX classification

```text
TERMiX: PARTIAL

TERMiX EXPERIMENT: PARTIAL
TERMiX PRODUCTION INTEGRATION: PASS (read-only)
```

TERMiX cannot honestly move to PASS. Its strongest claims are real and
reproducible at the mechanism level, but the comparative experiment still lacks:

- independent scoring and adjudication;
- a skilled-human baseline matching the stated human-versus-agent framing;
- a frozen complete registry corpus and full outputs for historical audit;
- repeated timing runs with a pre-registered analysis rule;
- closure of the known three-agent yield recall issue.

Cost and speed advantages remain explicitly unclaimed.

## 11. Exact remaining gap

The minimum concrete evidence needed for PASS is one independently executed and
adjudicated evaluation package containing:

1. a content-addressed frozen registry response for every data task;
2. complete Arm A and Arm B outputs, not samples or counts only;
3. append-only, run-ID output so the X.57 evidence cannot be overwritten;
4. a pre-declared repetition count and timing analysis rule if speed is evaluated;
5. a skilled human analyst baseline, or an explicit project rule redefining the
   target as scripted-baseline comparison;
6. an evaluator who did not implement the agent, with dated scoring and all
   record-level adjudications (including all seven health-factor divergences);
7. a separately specified classifier correction and frozen regression set if the
   three yield false negatives are to be closed.

A cost advantage is not necessary unless TERMiX rules require one, but no cost
advantage may be claimed without published unit costs or measured billing data.

## 12. Recommended next roadmap step

Do not run another self-scored live experiment. Package the existing protocol for
one independent evaluator: first make evidence capture append-only and preserve
the complete raw corpus and both arms' full outputs; then have that evaluator run
the frozen procedure and skilled-human baseline without changing the rubric.

No new product deployment or blockchain milestone is needed for this evidence step.

## Boundaries

```text
PANCAKESWAP OPTION B: NO CHANGES
AWS/KMS: NOT TOUCHED
ALTANA CUSTODY: NOT TOUCHED
MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
REAL AGENT ACTIVATION: NONE
COMMIT: NO
PUSH: NO
```
