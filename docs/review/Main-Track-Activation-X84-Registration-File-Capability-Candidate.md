# Main-Track Activation — X.84: Registration-File Capability Candidate

> Status: **PARTIAL** (Candidate resolver implemented & verified as a CANDIDATE only; NOT promoted to `VerifiedExecutionCapability`; gate stays fail-closed. Real activation still BLOCKED.)
> Date: 2026-08-21
> Scope: BNB Agent Studio Marketplace — a self-asserted registration-file resolver that surfaces off-chain ERC-8004 registration metadata as a `CandidateCapabilityBinding` (job-bound: false, integrity-verified: false) and is never accepted as execution authority.
> Explicitly out of scope: job creation/funding, signing, custody, real agent activation, on-chain writes. This module intentionally produces candidates, NOT verified capabilities.

---

## 1. X.83 Starting State

- X.83 established that ERC-8004 registration metadata (`agentURI` → off-chain JSON: `services[]`, `endpoint`, `mcpTools`, `a2aSkills`, `skills`, `capabilities`) is self-asserted, mutable via `setAgentURI`, and NOT job-bound. It is discovery metadata, never execution authority.
- The X.81 read-only ERC-8183 provider requires a trusted out-of-band `resource` + `executionCapability` binding because the job schema omits both fields (see X.81 §9/§18). X.84 explores whether registration-file metadata could supply those fields — and concludes NO (candidate only).

## 2. Design Decision: Candidate, Not Verified

The resolver returns `CandidateCapabilityBinding` — a deliberately weaker type that encodes:

- `authority: "self-asserted-registration-file"`
- `jobBound: false` — not tied to a funded ERC-8183 job
- `integrityVerified: false` — source is mutable off-chain JSON, not chain state
- `caveats: ["self-asserted", "not-job-bound", "not-integrity-verified", "candidate-only-never-activated"]`

It is structurally impossible for this object to become a `VerifiedExecutionCapability` (X.76): the X.76 validator requires `authority` to be an authoritative source and rejects `jobBound:false` promotion. The X.81 provider's `resolveCapabilityBinding` contract accepts only `Erc8183CapabilityBinding | null`, so a `CandidateCapabilityBinding` is never consumed by the provider — the resolver exists to document and prove the boundary, not to enable activation.

## 3. Default Registration File

- `DEFAULT_REGISTRATION_FILE_URL = "https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json"`.
- The resolver reads the file via an injected `fetchRegistrationFile` (default global `fetch`), parses `services[]`, and maps each entry's `endpoint` + declared `capabilities`/`mcpTools`/`a2aSkills` into a candidate `resource` + `executionCapability`.
- No trust is attached: the URL is self-hosted and mutable; the content is not signed and not job-bound.

## 4. Honesty Guardrails (proven by verifier)

- Rejects an empty/blank `resource` → returns `null` (never synthesizes a default endpoint).
- Rejects `"default"` / `"enabled"` placeholder capability strings → returns `null` (these are exactly the placeholders that would falsely imply activation).
- Rejects a 404 / malformed / non-array `services` → returns `null`.
- Never promotes to `VerifiedExecutionCapability`; the verifier asserts the candidate type and that it is NOT accepted by the X.81 binding contract.

## 5. Verification

`npm run activation:x84:verify` — **14/14 PASS** (offline, network-free; the verifier injects a fake `fetchRegistrationFile`).

- Positive (candidate shape): valid file → candidate with `jobBound:false`, `integrityVerified:false`, correct caveats, maps `endpoint`→`resource` and `mcpTools`/`a2aSkills`→`executionCapability`.
- Negative (all return `null`): 404, malformed JSON, `services` not array, empty `resource`, `"default"` resource, `"enabled"` capability, missing `capabilities` block, unsigned file, tampered endpoint.
- Boundary: candidate is NOT a `VerifiedExecutionCapability`; X.81 `resolveCapabilityBinding` rejects non-`Erc8183CapabilityBinding` input; gate stays fail-closed.

Existing suites remain green (see X.85 §7). `typecheck`/`lint`/`build` exit 0.

## 6. Implementation Changes

Added (working tree, untracked — NOT committed):

- `apps/web/lib/activation/registration-file-capability.ts` — `CandidateCapabilityBinding` type, `resolveRegistrationFileCandidate(url, fetchFn)`, default URL constant, guardrails.
- `apps/web/lib/activation/x84.verify.ts` — offline verifier (14 checks).
- `apps/web/package.json` — added script `activation:x84:verify`.

No existing file was modified. This candidate resolver is NOT wired into the X.81 provider or the activation route.

## 7. Limitations

1. Registration-file metadata is self-asserted and mutable — never execution authority.
2. Not job-bound: a candidate cannot be linked to a funded ERC-8183 job.
3. No integrity verification: off-chain JSON is unsigned and editable.
4. Custody not provisioned ⇒ even a (hypothetical) verified capability would still be blocked at the X.80 gate.

## 8. Final Classification

| Dimension              | Result      | Note                                                                |
| ---------------------- | ----------- | ------------------------------------------------------------------- |
| CANDIDATE RESOLVER     | **PASS**    | Reads + parses registration file; emits typed candidate.            |
| INTEGRITY VERIFICATION | **PARTIAL** | Source unsigned/mutable; `integrityVerified:false` by design.       |
| JOB BINDING            | **PARTIAL** | Not job-bound; `jobBound:false` by design.                          |
| PROMOTION TO VERIFIED  | **BLOCKED** | Structurally impossible; X.76 validator rejects.                    |
| REAL ACTIVATION        | **BLOCKED** | Never wired; gate stays fail-closed.                                |
| **OVERALL X.84**       | **PARTIAL** | Candidate surface only; proves the boundary, enables no activation. |

### Candidate vs. verified vs. real execution

- **CANDIDATE RESOLUTION:** ✅ implemented (X.84) — self-asserted metadata → typed candidate, never trusted.
- **VERIFIED CAPABILITY:** ❌ NOT produced (integrity/job-binding absent).
- **REAL EXECUTION:** ❌ NOT implemented (no custody, no session, no agent activation).
