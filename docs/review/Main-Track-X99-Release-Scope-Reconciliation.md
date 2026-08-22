# X.99 Release Scope Reconciliation

**Audit mode:** Read-only. No files were deleted, staged, committed, pushed, deployed, or behaviorally modified.

**Audit date:** 2026-08-22

## 1. X.98 Blocker

X.98 found the tree and build were healthy, but release scope was blocked because the working tree included experimental X.84/X.85 activation artifacts, especially `SignedQuoteReader`, while the X.98 boundary explicitly prohibited adding `SignedQuoteReader`.

The X.85 artifacts have no authoritative publisher or production data source. They are not wired into Hire or production activation. This reconciliation classifies them as experimental and excluded rather than treating them as production capability infrastructure.

## 2. Complete Activation Artifact Inventory

### A. Required production fail-closed code

- `apps/web/lib/activation/capability.ts`
  - Existing activation classification used by agent detail and Hire UI.
  - Returns `NOT_ACTIVATABLE` or `CAPABILITY_UNKNOWN` for current records.
- `apps/web/lib/activation/contract.ts`
  - Existing activation constants and contract data used by the existing activation preview path.
- `apps/web/lib/activation/hire.server.ts`
  - Existing server-side exact identity resolution and Hire pipeline.
- `apps/web/lib/activation/hire.api.ts`
  - Production API boundary. X.80 gate hook is fail-closed when supplied by the route.
- `apps/web/lib/activation/consent.commitment.ts`
  - Required by the production Hire route and session gate for canonical consent binding.
- `apps/web/lib/activation/session-gate.ts`
  - Required by the production Hire route. Rejects missing capability and unavailable custody.
- `apps/web/lib/activation/capability-resolution.ts`
  - Required by `session-gate.ts`; classifies missing, invalid, expired, disputed, and verified-funded evidence.
- `apps/web/lib/activation/erc8183-job-evidence.ts`
  - Required by `capability-resolution.ts` and the read-only provider boundary; validates job evidence without creating jobs.
- `apps/web/app/api/activation/hire/route.ts`
  - Production route wiring `consent.commitment` and `session-gate`; currently passes `verifiedJob: null` and `custodyAvailable: false`, so activation remains denied.

### B. Documentation / historical evidence

- `docs/review/Main-Track-Activation-X73-Production-Restore-Reconciliation.md`
- `docs/review/Main-Track-Activation-X74-Termix-Closure.md`
- `docs/review/Main-Track-Activation-X75-ALTANA-AWS-KMS-Readiness.md`
- `docs/review/Main-Track-Activation-X76-Execution-Capability-Source.md`
- `docs/review/Main-Track-Activation-X77-Authoritative-Capability-Provider.md`
- `docs/review/Main-Track-Activation-X78-External-Capability-Provider-Research.md`
- `docs/review/Main-Track-Activation-X79-ERC8183-Job-to-Activation-Architecture.md`
- `docs/review/Main-Track-Activation-X80-Consent-ERC8183-Session-Gate.md`
- `docs/review/Main-Track-Activation-X81-Read-Only-ERC8183-Capability-Provider.md`
- `docs/review/Main-Track-Activation-X82-Capability-Semantics-Evidence-Reconciliation.md`
- `docs/review/Main-Track-Activation-X83-BNB-Agent-Capability-Attestation.md`
- `docs/review/Main-Track-Activation-X84-Registration-File-Capability-Candidate.md`
- `docs/review/Main-Track-Activation-X85-Signed-Quote-Capability-Verification.md`
- `docs/review/Main-Track-Activation-X86-Authoritative-ERC8183-Signed-Quote-Evidence.md`
- `docs/review/Main-Track-Activation-X87-Official-SDK-Gap-Analysis.md`
- `docs/review/Main-Track-Activation-X88-BNB-Agent-Studio-Capability-Attestation.md`
- `docs/review/Main-Track-Activation-X89-External-Capability-Provider-Contract.md`
- `docs/review/Main-Track-Activation-X90-External-Capability-Provider-Readiness.md`
- `docs/review/Main-Track-Activation-X91-Authoritative-Capability-Source-Discovery.md`
- `docs/review/Main-Track-Activation-X92-Product-Fallback-and-Activation-Blocker.md`
- `docs/review/Main-Track-X93-Judge-Experience-Audit.md`
- `docs/review/Main-Track-X94-Production-Submission-Readiness.md`
- `docs/review/Main-Track-Termix-X95-Agent-Advantage-Readiness.md`
- `docs/review/Main-Track-Termix-X96-Submission-Eligibility-Audit.md`
- `docs/review/Main-Track-PancakeSwap-X97-Eligibility-Evidence-Audit.md`
- `docs/review/Main-Track-Submission-Judge-Optimization.md`
- `docs/review/Main-Track-Final-Release-Audit.md`
- `docs/review/Main-Track-Final-Submission-Evidence.md`
- `docs/review/Main-Track-X98-Release-Manifest.md`
- `docs/review/Main-Track-X99-Release-Scope-Reconciliation.md`

These documents remain useful historical/submission evidence. X.85 historical documentation is retained and is not being deleted.

### C. Experimental candidate artifacts

- `apps/web/lib/activation/registration-file-capability.ts`
  - Self-asserted off-chain registration-file candidate.
  - Never returns `VerifiedExecutionCapability`; not job-bound and not integrity-verified.
  - Used by X.84 verifier and reports, not production routes.
- `apps/web/lib/activation/erc8183-capability-provider.ts`
  - Read-only ERC-8183 provider skeleton.
  - Requires injected job reader, trusted owner resolver, and trusted resource/capability binding.
  - Not imported by the production Hire route.
- `apps/web/lib/activation/erc8183-capability-provider.server.ts`
  - Server-only production-wiring candidate for the read-only provider.
  - Not imported by the production Hire route.
- `apps/web/lib/activation/x80.verify.ts`
  - Test-only verifier for consent and session-gate behavior.
- `apps/web/lib/activation/x81.verify.ts`
  - Test-only verifier for the read-only ERC-8183 provider.
- `apps/web/lib/activation/x84.verify.ts`
  - Test-only verifier for the self-asserted registration-file candidate.

### D. Unsourced provider artifacts

No authoritative provider is present. The read-only ERC-8183 provider is only a conditional candidate requiring externally supplied trusted job and binding data. The registration-file candidate is explicitly self-asserted. No provider is wired into production activation.

### E. Unused / safe to exclude

- `apps/web/lib/activation/signed-quote-capability.ts`
- `apps/web/lib/activation/x85.verify.ts`

These contain the X.85 `SignedQuoteReader` interface, signed-quote verifier, and test harness. They have no authoritative quote publisher/source feeding production and are not imported by any production route.

## 3. Import Graph Findings

Actual production imports:

```text
app/api/activation/hire/route.ts
  -> consent.commitment.ts
  -> session-gate.ts
      -> capability-resolution.ts
          -> erc8183-job-evidence.ts
      -> consent.commitment.ts
```

The production route does not import:

- `erc8183-capability-provider.ts`
- `erc8183-capability-provider.server.ts`
- `registration-file-capability.ts`
- `signed-quote-capability.ts`
- `SignedQuoteReader`

Reference classes:

- `capability-source.ts`: provider contract and fail-closed resolver; verifier/report reference only, not imported by the production route.
- `erc8183-capability-provider.ts`: X.81 candidate provider; imported by X.81/X.85 verifiers and server candidate, not production route.
- `erc8183-capability-provider.server.ts`: candidate server composition; not production route.
- `registration-file-capability.ts`: X.84 verifier/report-only candidate.
- `signed-quote-capability.ts`: X.85 verifier and unused server-candidate dependency only.
- `SignedQuoteReader`: test/candidate-only; zero production-route reachability.

No excluded artifact is imported by the production Hire route. No production import-graph blocker was found.

## 4. Production-Required Files

The minimal production activation set is:

- Existing `capability.ts`, `contract.ts`, `hire.server.ts`, `hire.api.ts`, `activation.verify` integration path, and related existing runtime modules.
- `consent.commitment.ts`
- `session-gate.ts`
- `capability-resolution.ts`
- `erc8183-job-evidence.ts`
- The route wiring in `app/api/activation/hire/route.ts`

This set preserves the fail-closed security boundary and does not provide an execution-capability source.

## 5. Experimental Files

The following are useful audit candidates but are not required to make current production behavior safe:

- `capability-source.ts` and its verifier: external provider contract and rejection matrix.
- `erc8183-capability-provider.ts` and `.server.ts`: read-only provider skeleton, not wired.
- `registration-file-capability.ts` and `x84.verify.ts`: self-asserted candidate, never authoritative.
- `x80.verify.ts` and `x81.verify.ts`: test-only gate/provider verifiers.
- `signed-quote-capability.ts` and `x85.verify.ts`: X.85 signed-quote candidate, no source.

They may remain in the working tree for historical review, but their release inclusion requires an explicit scope decision.

## 6. X.85 Disposition

**X.85 DISPOSITION: EXCLUDE**

`SignedQuoteReader` is not a production capability source. No authoritative publisher is configured, no quote reader is wired into the production route, and no verified funded ERC-8183 quote exists. X.85 verifier results prove only that the isolated cryptographic candidate logic rejects invalid fixtures and can process a supplied test fixture; they do not establish production authority.

Historical X.85 documentation remains retained.

## 7. Package-Script Disposition

Production does not depend on activation verifier scripts. They are test-only or historical verification infrastructure.

Required/currently useful verification scripts:

- `activation:verify`
- `activation:hire:verify`
- `activation:hire-api:verify`
- `activation:capability-source:verify`
- `activation:x80:verify`
- `activation:x81:verify`
- `activation:x84:verify`
- `activation:x85:verify`

The X.85 script is test-only and must be excluded from the final release scope under the X.99 boundary if the related X.85 implementation is excluded. No package script was removed during this audit.

## 8. Exact Release Allowlist

The conceptual release allowlist is:

- Existing tracked marketplace application and security tree from the previous checkpoint.
- X.93 `Risk pending` correction.
- X.94 judge-experience copy corrections.
- Production-required X.80 gate wiring and its directly required pure modules.
- Required non-X.85 verification scripts, if the release owner intends to ship verification infrastructure.
- Final submission documentation and review reports selected intentionally.

The allowlist is conceptual only. No staging was performed.

## 9. Exact Excluded Set

At minimum, exclude:

- `apps/web/lib/activation/signed-quote-capability.ts`
- `apps/web/lib/activation/x85.verify.ts`
- `activation:x85:verify` package script

Also classify as non-runtime/documentation or experimental rather than production application code:

- `registration-file-capability.ts`
- `erc8183-capability-provider.ts`
- `erc8183-capability-provider.server.ts`
- `x80.verify.ts`
- `x81.verify.ts`
- `x84.verify.ts`
- all X.73–X.99 review reports

No file was removed to achieve this classification.

## 10. Tests

Passed:

- Capability-source verifier: all checks passed
- Activation verifier: `33/33`
- Hire verifier: `23/23`
- Hire API verifier: `14/14`
- X.80 verifier: all checks passed
- X.81 verifier: all checks passed
- X.84 verifier: `14/14`
- X.85 verifier: `13/13` in isolation; disposition remains EXCLUDE
- Session verifier: `25/25`
- Session API verifier: `72/72`
- Security X.49: `25/25`
- Security X.55: `22/22`
- Compare verifier: `10/10`
- Category X.53: `21/21`
- Category X.54: `38/38`
- PancakeSwap UI verifier: all checks passed
- TermiX web verifier: all checks passed

X.50 check-24 remains untouched as the pre-existing stale assertion.

## 11. Build

The exact current working tree passed:

- Typecheck
- Lint
- `next build`

The build generated all expected routes. Existing non-blocking warnings remain in the dependency graph and Next.js ESLint-plugin detection. No second or partial candidate tree was created.

## 12. Production Behavior

Current production behavior remains safe:

- `/api/auth/me` → `200`
- unauthenticated `POST /api/activation/hire` → `403`
- `/api/altana/session` → `503`
- No ACTIVE session is created.
- No transaction or execution control is exposed by the unavailable path.
- No custody is available.
- No fake signed quote is produced.
- No fake capability, job, price, expiry, resource, or execution capability is produced.

No production deployment or mutation was performed.

## 13. Remaining Blockers

- X.85 `SignedQuoteReader` artifacts remain physically present in the working tree but are prohibited from final release scope until explicitly reconciled.
- The release tree has not been staged or committed, so no final release SHA exists.
- Real authoritative execution capability and custody remain unavailable by design.
- TermiX strict marketplace-hire eligibility remains blocked.
- PancakeSwap remains read-only and partially qualifying.
- X.50 check-24 remains a known stale assertion and is preserved.

## Final Classification

- RELEASE SCOPE: **BLOCKED**
- PRODUCTION IMPORT GRAPH: **PASS**
- X.85 DISPOSITION: **EXCLUDE**
- ACTIVATION SAFETY: **PASS**
- BUILD: **PASS**
- TESTS: **PASS**

## OVERALL X.99

**NOT READY FOR RELEASE COMMIT**

The production import graph and safety behavior are acceptable, and all required tests/builds pass. The overall result remains blocked because the working tree still contains X.85 `SignedQuoteReader` artifacts and a related package script that conflict with the explicit X.99 release boundary. No staging, commit, push, deployment, deletion, or source modification was performed.
