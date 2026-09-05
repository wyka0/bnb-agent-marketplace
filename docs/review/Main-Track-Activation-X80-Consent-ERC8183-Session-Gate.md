# Main-Track Activation — X.80: Consent (ERC-8183) + Verified-Funded-Job Session Gate

> Status: **PARTIAL** (Application boundary fully implemented & tested; Real activation still BLOCKED by external custody/provider dependency)
> Date: 2026-08-21
> Scope: BNB Agent Studio Marketplace — application-side execution-capability activation boundary only.
> Explicitly out of scope (per X.76–X.79): real ERC-8183 provider integration, custody provisioning (AWS KMS + ALTANA admin signer), job creation/funding, real agent activation, any on-chain transaction.

---

## 1. Objective (X.80)

Implement and verify the **application boundary** for the verified execution-capability activation path:

1. A deterministic, hashed **consent commitment** binding the engagement terms (the X.49 consent extended to ERC-8183 job-funded activation).
2. An **ERC-8183 evidence contract + validator** that distinguishes a _requested_ job from a _verified-funded_ job and rejects malformed/fabricated evidence.
3. A **capability-resolution classifier** (6 states) that maps capability source → activation state.
4. A **session gate** (pure, fails-closed) that emits `allowed=false` whenever any required condition (auth, ownership, consent match, verified-funded job, custody) is unmet — and **never creates a session or fabricates capability**.

The boundary is wired into the existing Hire flow **opt-in** (legacy behavior preserved) and into the production `POST /api/activation/hire` route **fail-closed** (`verifiedJob: null`, `custodyAvailable: false`).

---

## 2. IMPLEMENTED — Application Boundary

All new files are **pure TypeScript modules with zero side effects** (no network, no chain, no DB, no secrets):

| File                                               | Responsibility                                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/activation/consent.commitment.ts`    | Canonical deterministic consent serialization (`canonicalizeConsent`), sha256 digest (`digestConsentCommitment`), `verifyConsentCommitment`, `commitmentFromAgent`.  |
| `apps/web/lib/activation/erc8183-job-evidence.ts`  | `RequestedErc8183Job` vs `VerifiedFundedErc8183JobEvidence` types + `validateVerifiedJob` (provider/client identity rules, status/expiry/price/verification checks). |
| `apps/web/lib/activation/capability-resolution.ts` | `classifyCapability(input)` → 6 states: `no-capability`, `unverified-job`, `verified-funded`, `expired`, `invalid`, `revoked-disputed`.                              |
| `apps/web/lib/activation/session-gate.ts`          | `evaluateSessionGate(input)` — 12-check pure gate, fails closed.                                                                                                     |
| `apps/web/lib/activation/x80.verify.ts`            | Comprehensive verifier for all of the above.                                                                                                                         |
| `apps/web/package.json`                            | Added script `activation:x80:verify`.                                                                                                                                |

Wiring:

- `apps/web/lib/activation/hire.api.ts` — `evaluateActivationGate` is an **optional** dependency; when absent the legacy 201/409 hire path is unchanged (backward compatible).
- `apps/web/app/api/activation/hire/route.ts` — passes a concrete `evaluateActivationGate` that calls `evaluateSessionGate` with `verifiedJob: null` and `custodyAvailable: false`. **Fail-closed by construction.**

The X.76 `ExecutionCapabilityProvider` interface (`capability-source.ts`) was confirmed **sufficient** for ERC-8183 — no field change required; a future read-only provider returns a `VerifiedFundedErc8183JobEvidence` that flows straight into this gate.

---

## 3. Consent Commitment (extended X.49)

`canonicalizeConsent` binds **14 fields** in a fixed key order, with `strict-stringify` that **throws on `undefined`** (no silent omission):

```
provider, client, agentId, agentOwner, jobId, amountPerUnit,
currency, maxUnits, totalPrice, chainId, nonce, role,
expiresAt, consentScope
```

- `digestConsentCommitment` = `sha256(canonicalizeConsent(consent))`.
- `commitmentFromAgent(agent, job)` builds the commitment object from a `Scan8004Agent` (+ optional job terms); `consentDigest` passed by the client must equal `digestConsentCommitment(commitment)` or the gate denies.
- **Binding guaranteed**: changing any single field (amount, owner, expiry, scope…) yields a different digest → verifier rejects. Verified by X.80 tests (commitment changes on every perturbed field; digest mismatch denied).

---

## 4. ERC-8183 Evidence Contract + Validator

- `RequestedErc8183Job`: the job the client _intends_ to fund (pre-submission). Not sufficient for activation.
- `VerifiedFundedErc8183JobEvidence`: the job that has been **funded and verified** by an authoritative source, carrying `verification` metadata (how/where verified) and `fundedAt`.
- `validateVerifiedJob(ev, { expectedProvider, expectedClient, expectedChainId })` enforces:
  - provider/client non-empty and matching expected identities;
  - `status === "funded"`;
  - not expired (`expiresAt > now`);
  - `totalPrice > 0`;
  - `verification` present and `verified === true` (no self-attested evidence);
  - chain id matches activation chain (97).
- Returns a typed `VerifiedJobError` on any violation. Fabricated/self-signed evidence is **rejected**.

---

## 5. Capability Resolution (6 states)

`classifyCapability({ source, job, now })`:

- `no-capability` — no provider, no job.
- `unverified-job` — job present but `validateVerifiedJob` fails (requested-only or malformed).
- `verified-funded` — `validateVerifiedJob` passes.
- `expired` — job funded but past `expiresAt`.
- `invalid` — job structurally invalid.
- `revoked-disputed` — job marked revoked/disputed (reserved for future provider signals).

Only `verified-funded` satisfies the session gate. All other states → `allowed=false` with a descriptive `reason`.

---

## 6. Session Gate (12 checks, fails closed)

`evaluateSessionGate(input)` evaluates, in order, and **short-circuits to deny** on first failure:

1. identity authenticated (non-null, has address)
2. agent identity present
3. consent object present (commitment + digest)
4. consent digest matches recomputed commitment digest
5. agent owner address present
6. authenticated address === expected agent owner (wallet ownership)
7. agent identity matches expected (`agentIdentity`)
8. capability classified via `classifyCapability`
9. capability state === `verified-funded`
10. custody available (`custodyAvailable === true`)
11. (reserved) provider liveness / re-read not required to fail
12. final allow only when all prior pass

**Key property:** even with _valid_ verified-funded evidence, if `custodyAvailable === false` the gate returns `allowed: false` (state `unavailable`, reason custody). It **never** returns a fake `ACTIVE` or creates a session. This is the "job-funded but no custody → blocked" posture.

---

## 7. NOT IMPLEMENTED — External Dependency (intentional, per X.76–X.79)

| Component                                                                  | Status   | Reason                                                                                              |
| -------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| Real ERC-8183 job **reader/provider** (`getErc8183Job` RPC)                | NOT DONE | No provider available; must be read-only, returns `VerifiedFundedErc8183JobEvidence`.               |
| Custody provisioning (AWS KMS + `ALTANA_TESTNET_PRIVATE_KEY` admin signer) | BLOCKED  | No secrets; `createAltanaSessionManager` returns 503 without signer (unchanged).                    |
| Job **creation / funding** transactions                                    | NOT DONE | X.80 is non-transactional; `packages/integrations/.../erc8183.ts` still throws at signing boundary. |
| Real agent **activation** / session creation                               | BLOCKED  | Gate always denies (no verified job + no custody).                                                  |
| On-chain re-reads before session/execution                                 | NOT DONE | Future provider responsibility.                                                                     |

---

## 8. Wiring & Backward Compatibility

- `hire.api.ts`: `evaluateActivationGate` is **optional**. Harness/legacy callers that omit it keep the original 201/409 path. No existing hire test modified.
- `route.ts`: provides the gate with `verifiedJob: null` + `custodyAvailable: false` ⇒ production `POST /api/activation/hire` remains **403/Forbidden** (unauthenticated) / unavailable. No fabricated `ACTIVE`.
- `ExecutionCapabilityProvider` (X.76) unchanged and sufficient.

---

## 9. Verification Results

All suites green (run via `npm run <script>` in `apps/web`):

| Suite                                        | Result                           |
| -------------------------------------------- | -------------------------------- |
| `activation:x80:verify` (new)                | **ALL CHECKS PASSED**            |
| `activation:capability-source:verify` (X.76) | ALL CHECKS PASSED                |
| `activation:hire:verify` (X.49/X.65)         | 23/23 checks passed              |
| `activation:hire-api:verify` (X.65)          | 14 checks passed, 0 failed       |
| `altana:session:verify` (X.45)               | 25/25 PASS                       |
| `security:x49:verify`                        | 25 checks, 0 failures — ALL PASS |
| `activation:verify` (P12)                    | 33 passed, 0 failed              |
| `npm run typecheck`                          | exit 0                           |
| `npm run lint`                               | exit 0                           |
| `npm run build`                              | exit 0                           |

X.80 verifier specifically exercises:

- Consent determinism + binding (every field perturbation changes commitment; digest mismatch denied).
- `validateVerifiedJob` accept/reject cases (missing provider/client, bad status, expired, zero price, unverified evidence, wrong chain).
- `classifyCapability` all 6 states.
- `evaluateSessionGate` pass-only-when-all-true; valid evidence + `custodyAvailable:false` ⇒ blocked; `verifiedJob:null` ⇒ blocked.

---

## 10. Production Read-Only Check (no deploy)

Performed against `https://bnb-agent-marketplace-web.vercel.app` (read-only; no changes made):

- `GET /` → **200**
- `GET /api/auth/me` → **200** `{"ok":true,"data":null}`
- `GET /api/activation/hire` → 405 (method not allowed — expected for GET)
- `POST /api/activation/hire` → **403 Forbidden** (unauthenticated; fail-closed)
- `GET /api/altana/session` → **503** (no custody signer — unchanged)
- No fabricated `ACTIVE` capability observed.

Production behavior is **unchanged and healthy**; the new gate is wired fail-closed so it cannot alter production availability.

---

## 11. Constraints Honored

- ✅ No new Vercel project; no push/commit of partial state.
- ✅ X.49–X.71 and PancakeSwap Option B untouched.
- ✅ No AWS/KMS config, no ALTANA custody provisioning, no mainnet/Agent 1816/Job 515, no blockchain transactions, no real agents activated.
- ✅ No fabricated execution capability; gate never returns `ACTIVE` without verified job + custody.
- ✅ X.50 stale check-24 assertion preserved/unmodified.
- ✅ Stopped after milestone — **no deploy, no commit, no push**.

---

## 12. Residual Risks / Future Work (not in X.80)

1. Implement read-only `ExecutionCapabilityProvider.getErc8183Job` returning `VerifiedFundedErc8183JobEvidence`.
2. Provision ALTANA admin signer (AWS KMS) so `custodyAvailable` can become `true` under controlled testnet.
3. Extend consent digest into the production hire flow (client submits `consentScope` + terms; server recomputes and compares).
4. Add on-chain re-reads of job status/expiry immediately before session grant / execution.
5. Wire provider liveness into gate check #11 (reserved).

---

## 13. Files Changed / Added (working tree, untracked — NOT committed)

Added:

- `apps/web/lib/activation/consent.commitment.ts`
- `apps/web/lib/activation/erc8183-job-evidence.ts`
- `apps/web/lib/activation/capability-resolution.ts`
- `apps/web/lib/activation/session-gate.ts`
- `apps/web/lib/activation/x80.verify.ts`
- `apps/web/package.json` (script `activation:x80:verify`)

Modified (wiring only, behavior fail-closed):

- `apps/web/lib/activation/hire.api.ts` (optional `evaluateActivationGate` dep)
- `apps/web/app/api/activation/hire/route.ts` (concrete fail-closed gate)

Reports (X.73–X.79) remain as prior milestones.

---

## 14. Final Classification

| Dimension                                                   | Result                                               |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| Consent boundary (ERC-8183 extended, deterministic, hashed) | **PASS**                                             |
| ERC-8183 evidence contract + validator                      | **PASS**                                             |
| Capability resolution (6-state classifier)                  | **PASS**                                             |
| Session gate (12-check, fails closed, no fake ACTIVE)       | **PASS**                                             |
| Custody availability                                        | **BLOCKED** (not provisioned; boundary preserved)    |
| Real activation                                             | **BLOCKED** (no provider, no custody, no funded job) |
| **Overall X.80**                                            | **PARTIAL**                                          |

The application-side verification boundary for consent + ERC-8183 job-funded activation is **fully implemented, wired, and tested**. Real activation remains **blocked** by the external custody/provider dependency, exactly as the X.76–X.79 analysis concluded — and the implementation encodes that block (fail-closed, never fabricates capability).

---

## 15. Recommended Next Milestone (outside X.80)

A follow-up milestone should: (a) implement the read-only ERC-8183 provider, (b) provision testnet custody under KMS, and (c) promote `evaluateActivationGate` from opt-in to the default path — at which point the gate can return `allowed: true` for a genuinely verified-funded job with available custody. Until then, X.80 stands as the enforced, verified boundary.
