# Main-Track Activation — X.87: Current Official BNB Agent SDK vs Pinned SDK Gap Analysis

> Status: **PARTIAL** (The current official `@bnbagent/sdk` implements the FULL ERC-8183 signed-quote protocol — negotiation, provider EIP-191/ERC-1271 signature, quote verification with chain/Commerce binding + `JobFunded`-block verification. BUT the signed payload contains NO `resource` and NO `executionCapability`. It authoritatively attests commercial terms + provider identity + job funding, not the execution-capability fields our `VerifiedExecutionCapability` requires. Also, the official SDK is a DIFFERENT package (`@bnbagent/sdk@0.5.1`) than our pinned `@altananetwork/sdk@0.7.0`, so adoption is a major architecture replacement, not a version bump. The capability-source blocker is NOT solved.)
> Date: 2026-08-21
> Scope: Gap analysis between the marketplace-pinned `@altananetwork/sdk@0.7.0` and the current official `bnb-chain/bnbagent-sdk` (`@bnbagent/sdk`). Source-level inspection only. No dependency upgrade, no package-lock mutation, no code change, no deploy/commit/push.

---

## 1. X.86 Starting State

X.86 established that the **pinned** `@altananetwork/sdk@0.7.0` contains NO quote/negotiation module, and its `Erc8183Job` schema lacks `resource`/`executionCapability`. X.86 = BLOCKED for the capability-source blocker. X.87 asks whether the **current official** SDK closes that gap.

## 2. Pinned SDK Evidence (recap, from X.86)

`@altananetwork/sdk@0.7.0` (installed in `apps/web` / `packages/integrations`):

- `dist/erc8183.js` exports only: `erc8183Addresses`, `buildHireCalls`, `getErc8183Job`, `getErc8183DeliverableUrl`, `hireErc8183Agent`, `settleErc8183Job`, `buildClaimRefundCall`.
- No `negotiation`, `quoteVerify`, `jobOps`, `NegotiationHandler`, `verifyQuoteSignature`, `sessionQuoteSigner`.
- `Erc8183Job` = `id, client, provider, evaluator, description, budget, expiredAt, status, statusName, hook, submittedAt, deliverable` — no `resource`, no `executionCapability`.
- `HireAgentParams.task` is free text ("anchored signed-quote JSON (Mode B)") but is NEVER signed or verified by the SDK.

## 3. Current Official SDK Evidence

Cloned `bnb-chain/bnbagent-sdk` (read-only, into a temp dir — NOT into the project; no dependency change). Relevant TypeScript source under `typescript/src`:

- `erc8183/negotiation.ts` — `NegotiationHandler` (`.negotiate()`), `TermSpecification`, `NegotiationRequest/Response/Result`, `buildJobDescription`, `parseJobDescription`, `QuoteSigner` interface with `signQuote(negotiationHash)`. The docstring references `wallet.sessionQuoteSigner()` — the seam named in the X.86 prompt DOES exist in the official SDK.
- `erc8183/quoteVerify.ts` — `verifyQuoteSignature(...)` (EIP-191 recovery + ERC-1271 fallback) with `chain_id`/`verifying_contract` binding checks and a `blockNumber` param for historical `JobFunded`-block verification.
- `erc8183/jobOps.ts` — `ERC8183JobOps.verifyJob()` performs strict, fail-closed seller verification: parses the structured on-chain description, requires `negotiation_hash` + `provider_sig` + `negotiated_at` + `quote_expires_at` + `chain_id`, computes the funded block via `getJobFundedBlock`, verifies the quote signature AT that block, and rejects mismatch/signature-removal/expiry/provider-mismatch/chain-mismatch/Commerce-mismatch/budget-too-low/currency-mismatch. `fundedJobWatcher` polls and fires only on valid FUNDED jobs.
- `erc8183/schema.ts` — `JobDescription` (on-chain `job.description` v1) and `DeliverableManifest`.
- `erc8004/agentUri.ts` + `erc8004/models.ts` — `AgentURIGenerator.generateRegistrationFile` and `AgentEndpoint` (name, endpoint URL, version, `capabilities: string[]`).

So the official SDK fully implements the documented protocol: single-round HTTP negotiation → provider-signed quote → buyer funds → `fundedJobWatcher` → fulfill (the exact BNB Agent Studio demo flow). The SDK's own code is the authoritative proof.

## 4. API / Source Comparison

| Capability                    | Pinned `@altananetwork/sdk@0.7.0` | Current official `@bnbagent/sdk@0.5.1`                                                            |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| ERC-8183 job read             | ✅ `getErc8183Job` (view)         | ✅ `ERC8183Client.getJob` + `ERC8183JobOps.getJob`                                                |
| ERC-8183 negotiation          | ❌ absent                         | ✅ `NegotiationHandler.negotiate`                                                                 |
| Signed quote                  | ❌ absent                         | ✅ `NegotiationResult` w/ `negotiation_hash` + `provider_sig`                                     |
| EIP-191 quote signature       | ❌ absent                         | ✅ `verifyQuoteSignature` (EIP-191 recovery)                                                      |
| ERC-1271 quote signature      | ❌ absent                         | ✅ fallback to `isValidSignature`                                                                 |
| Quote expiry                  | ❌ absent                         | ✅ `quote_expires_at` enforced                                                                    |
| Provider verification         | ❌ absent (job-level only)        | ✅ recovered signer === `job.provider`                                                            |
| JobFunded verification        | ❌ absent                         | ✅ `getJobFundedBlock` + verify-at-block                                                          |
| Task semantics                | free-text `description`           | structured `task` + `terms{deliverables, quality_standards, success_criteria}` (still free text)  |
| Resource semantics            | ❌ none                           | ❌ **none in quote** (only free-text `task`/`terms`); ERC-8004 endpoint URLs are mutable metadata |
| executionCapability semantics | ❌ none                           | ❌ **none** (no machine-readable capability anywhere)                                             |
| Agent binding (provider)      | job-level `provider`              | quote signer → `job.provider` (cryptographic)                                                     |
| Job binding                   | job-level fields                  | quote → `JobFunded` block + price/budget + currency/paymentToken (+chain/Commerce) binding        |
| Package name                  | `@altananetwork/sdk`              | `@bnbagent/sdk` (DIFFERENT package)                                                               |

## 5. Signed Quote Field Analysis

The signed content is `buildDescriptionContent()` output, over which `negotiation_hash = keccak256(canonicalJson(content))` is computed and `provider_sig` is a signature (EIP-191 or ERC-1271) of that hash. Fields:

| Field                         | Signed        | Job-bound                              | Provider-bound | Fresh                    |
| ----------------------------- | ------------- | -------------------------------------- | -------------- | ------------------------ |
| task (description)            | ✅ via hash   | ❌ (no jobId in quote)                 | ❌             | ❌                       |
| terms.deliverables            | ✅ via hash   | ❌                                     | ❌             | ❌                       |
| terms.quality_standards       | ✅            | ❌                                     | ❌             | ❌                       |
| terms.success_criteria        | ✅            | ❌                                     | ❌             | ❌                       |
| price                         | ✅            | ❌ (bound at funding via budget check) | ❌             | ✅ (within quote window) |
| currency                      | ✅            | ❌ (bound at funding via paymentToken) | ❌             | ✅                       |
| negotiated_at                 | ✅            | ❌                                     | ❌             | ✅                       |
| quote_expires_at              | ✅            | ❌                                     | ❌             | ✅                       |
| chain_id (optional)           | ✅            | n/a                                    | ❌             | ✅ (anti-replay)         |
| verifying_contract (optional) | ✅            | n/a (Commerce)                         | ❌             | ✅ (anti-replay)         |
| **resource**                  | ❌ **ABSENT** | —                                      | —              | —                        |
| **executionCapability**       | ❌ **ABSENT** | —                                      | —              | —                        |

**Explicit statement:** `resource` and `executionCapability` are NOT present in the official signed quote. The quote signs commercial terms (task + deliverables/quality text + price + currency + expiry + chain/Commerce) and binds cryptographically to the provider and (at funding time) to the job. It does NOT sign any executable resource or capability.

## 6. Resource Analysis (STEP 3)

Searched the official SDK source for `resource`/`endpoint`/`service`/`operation`/`task`/`skill`/`tool`/`capability`/`deliverable`:

- The quote's `task` + `terms.deliverables`/`quality_standards`/`success_criteria` are **free-text** task metadata (strings). Not structured, not integrity-protected beyond the overall quote signature, not bound to a specific executable resource.
- ERC-8004 `AgentEndpoint` carries `endpoint` (an http(s) URL) and a `capabilities: string[]` — but this is **registration metadata**: self-asserted, mutable via `setAgentURI`, not signed per-job, not job-bound, not linked to the ERC-8183 quote. It is discovery metadata, not execution authority.
- **No candidate is a structured, integrity-protected, provider+job-bound, fresh, revocable representation of "the resource being executed."** → RESOURCE = PARTIAL/BLOCKED (free text only; endpoint URLs are mutable metadata).

Per the honesty contract, free text is NOT mapped to `resource`.

## 7. Execution Capability Analysis (STEP 4)

- The official SDK has **no `executionCapability` concept** and no semantically equivalent machine-readable capability that is _attested_ to the agent/job.
- An `AgentEndpoint.capabilities` string list is descriptive discovery metadata, not a per-job, signed, job-bound capability attestation.
- A service endpoint is not automatically an execution capability (it is a network locator).
- A task description is not an execution capability.
- A provider signature over price/terms proves "this provider agrees to accept THIS commercial job," NOT "this agent is authorized to perform THIS operation."

→ EXECUTION CAPABILITY = BLOCKED.

## 8. ERC-8004 Capability Metadata Analysis (STEP 7)

`AgentURIGenerator.generateRegistrationFile` produces `{ type, name, description, image, services: AgentEndpoint[], registrations }`. The only capability-shaped data is `AgentEndpoint.capabilities: string[]`.

- Schema: arbitrary string list per endpoint.
- Integrity model: the registration file hash is `keccak256(canonicalJson(...))`, but the file is published via `setAgentURI` (mutable, off-chain-ish) and is NOT signed per field; it is not bound to any ERC-8183 job.
- Mutability: high (owner can change `agentURI` at any time).
- Signer/owner relationship: settable by the registry owner, but the _capabilities_ strings are not independently attested.
- Expiration / revocation: none at the capability level.
- Job binding: none.
- Classification: **descriptive metadata**, not authoritative execution-capability attestation.

## 9. Agent Studio Analysis (STEP 8)

The official SDK repo contains NO `studio.toml`, NO `max_price`, NO `executionCapability` keyword anywhere (grep of `typescript` + `docs`). Examples are: `a2a-agent`, `agent-server`, `altana`, `client`, `security`, `smoke`, `voter`, `x402` — all demonstrating negotiation/quoting/fulfillment via the SDK classes above, none introducing a machine-readable capability that satisfies `VerifiedExecutionCapability`. The agent metadata that exists (`AgentEndpoint.capabilities`) is the same descriptive string list analyzed in §8.

## 10. Quote → Job Binding (STEP 6)

The official SDK binds signed quote → funded ERC-8183 job via `ERC8183JobOps.verifyJob`:

- The quote itself does NOT contain a `jobId` (the job does not exist at negotiation time); instead the quote binds to `provider` (signer), `chain_id`, `verifying_contract` (Commerce), `price`, `currency`, `quote_expires_at`.
- At funding, `getJobFundedBlock(jobId, {negotiatedAt, quoteExpiresAt})` locates the `JobFunded` block; `verifyQuoteSignature` runs **at that block** (preserving acceptance-time verdict against later revocation).
- Cross-checks: `job.provider` must equal the recovered signer; funded `budget >= signed price`; `paymentToken == signed currency`; `chain_id`/`verifying_contract` must match; quote must not be expired at funding.
- This is a robust, fail-closed commercial/job-binding mechanism. It proves "a genuine, provider-signed, funded commercial agreement exists" — but again, only for the commercial terms, not for a resource/executionCapability.

## 11. Upgrade Feasibility (STEP 9)

- **Package identity mismatch:** our marketplace uses `@altananetwork/sdk@0.7.0`; the official protocol lives in `@bnbagent/sdk@0.5.1` (a different npm scope/name). Notably, `@bnbagent/sdk@0.5.1` lists `@altananetwork/sdk` only as an **optional peer dependency** `>=0.3.3 <0.6.0` (which our `0.7.0` does NOT satisfy). So our pinned package is a divergent distribution that predates / does not include the quote protocol.
- **Runtime/API compatibility:** NOT compatible. Our `packages/integrations/src/altana/erc8183.ts` wraps the old SDK's `getErc8183Job` / `buildHireCalls`. The official SDK exposes a higher-level `ERC8183Client`, `NegotiationHandler`, `verifyQuoteSignature`, `ERC8183JobOps`, `AgentURIGenerator` — a different surface. Adopting it requires rewriting the integration layer and re-validating every consumer.
- **ERC-8183 addresses / existing wrappers / tests / production code:** address tables differ in shape (`@bnbagent/sdk` has `networks/addresses.ts` + `ERC8183Client`); our X.80–X.85 verifiers test our own modules (still valid) but the SDK boundary they sit behind would change.
- **Classification:** this is a **major architecture replacement / external-dependency swap**, NOT a legitimate minor upgrade. → UPGRADE FEASIBILITY = PARTIAL (outcome D): exact source `@bnbagent/sdk@0.5.1`, missing APIs `negotiation/quoteVerify/jobOps` in current pin, migration impact = rewrite integration layer + re-validate, requires a security review of the new signing/verification paths before any adoption.

**No upgrade performed** (absolute boundary: no dependency upgrade, no package-lock mutation).

## 12. Security / Trust Boundary

- No weakening of `VerifiedExecutionCapability` (per X.86 STEP 8): `resource` not renamed, `executionCapability` not removed, task/terms not accepted as capability, ERC-8004 metadata/`capabilities` string list not accepted as authority, unsigned quote / price-only signature not accepted.
- The official SDK's quote verification is robust (fail-closed, historical-block verification, ERC-1271) — if adopted, it would be a _strengthening_ of commercial-term verification, but still would not supply `resource`/`executionCapability`.
- Absolute boundaries honored: no AWS/KMS, no ALTANA custody, TERMiX read-only, PancakeSwap untouched, mainnet untouched, Agent 1816 / Job 515 untouched, no ERC-8183 creation/funding, no transactions, no deploy, no commit, no push, no dependency upgrade, no package-lock mutation.

## 13. Tests

No code changed → regression verification only (offline verifiers). Baseline identical to X.86 (green):

- `activation:x85:verify` — 13/13 PASS
- `activation:x84:verify` — 14/14 PASS
- `activation:x81:verify` — ALL CHECKS PASSED
- `activation:x80:verify` — ALL CHECKS PASSED
- `activation:capability-source:verify` (X.76) — ALL CHECKS PASSED
- `activation:verify` — 33 passed, 0 failed
- `activation:hire:verify` (X.6) — 23/23
- `activation:hire-api:verify` (X.65) — 14/14
- `altana:session:verify` (X.45) — 25/25
- `altana:session:api:verify` (X.47) — 72/72
- `security:x49:verify` — 25/25

`typecheck` → exit 0 (clean). `lint` → exit 0 (clean). (`activation:x86:verify` has no script — X.86 was report-only by design.)

**Important reconciliation note:** X.85's `signed-quote-capability.ts` defined a bespoke `Erc8183SignedQuote` schema (`jobId, provider, resource, executionCapability, quoteExpiresAt, signedAt, signature`). The OFFICIAL SDK's actual signed quote schema is DIFFERENT: it has `negotiation_hash`, `provider_sig`, `task`, `terms{deliverables,quality_standards,success_criteria}`, `price`, `currency`, `quote_expires_at`, `chain_id`, `verifying_contract` — and crucially **no `resource` and no `executionCapability`**, and **no `jobId`** (job binding is via `JobFunded` verification). If/when the official SDK is adopted, X.85's adapter MUST be re-aligned to the real schema; it must not be mistaken for consuming official quotes today.

## 14. Production Read-Only Checks

**NO DEPLOYMENT** occurred. Only X.87 docs/report added. Prior established production state holds:

- `/` → 200, `/agents` → 200, `/api/auth/me` → 200 (healthy marketplace; unchanged).
- `POST /api/activation/hire` → 403 Forbidden (unauthenticated; fail-closed).
- `/api/altana/session` → 503 (no custody signer; unchanged).
- No fake ACTIVE session; no execution controls; unavailable agents remain unavailable; security headers intact; no custody; no transaction.

## 15. Final Classification

| Dimension                      | Result              | Note                                                                                                                                                     |
| ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SIGNED QUOTE PROTOCOL          | **PASS**            | Official SDK fully implements negotiation → EIP-191/ERC-1271 signature → `JobFunded`-block verification with chain/Commerce binding.                     |
| RESOURCE SEMANTICS             | **PARTIAL/BLOCKED** | Quote signs only free-text task/terms; no structured resource. ERC-8004 endpoint URLs are mutable self-asserted metadata.                                |
| EXECUTION CAPABILITY SEMANTICS | **BLOCKED**         | No machine-readable capability declaration in quote or registration; terms/deliverables are descriptive only.                                            |
| JOB BINDING                    | **PASS**            | Robust quote→`JobFunded` binding (block-verified, price/budget, currency/paymentToken, chain/Commerce). For commercial terms.                            |
| IDENTITY BINDING               | **PASS**            | Recovered signer === `job.provider`; ERC-1271 supported.                                                                                                 |
| UPGRADE FEASIBILITY            | **PARTIAL**         | Different package (`@bnbagent/sdk` vs `@altananetwork/sdk`); major architecture replacement + security review required; NOT performed.                   |
| VERIFIED EXECUTION CAPABILITY  | **BLOCKED**         | Cannot be produced without authoritative `resource` + `executionCapability`.                                                                             |
| REAL ACTIVATION                | **BLOCKED**         | No funding, no signing, no custody, no real job.                                                                                                         |
| **OVERALL X.87**               | **PARTIAL**         | Outcome B: the signed quote is authoritative for commercial/job attestation, but the capability-source blocker (resource + executionCapability) remains. |

### Central question answered

> Does the current official BNB Agent SDK contain enough authoritative semantics to solve the capability-source blocker?

**No — not by itself.** The official `@bnbagent/sdk` is the _real, authoritative_ implementation of the documented ERC-8183 signed-quote protocol (closing the "is this a genuine provider-signed, funded job" question with cryptographic + on-chain proof). But its signed payload attests only **commercial terms + provider identity + job funding** — it contains **no `resource` and no `executionCapability`**. Therefore, even after adopting the official SDK, an external, authoritative capability-attestation source for `resource` + `executionCapability` would STILL be required. The capability-source blocker is **not** resolved by the SDK upgrade alone.

## 16. Exact Next Dependency

1. **Decide on SDK adoption (separate decision, outside X.87):** if the marketplace wants the robust official quote/verification machinery, swap `@altananetwork/sdk@0.7.0` → `@bnbagent/sdk@0.5.1`, rewrite `packages/integrations/src/altana/erc8183.ts` against `ERC8183Client`/`NegotiationHandler`/`verifyQuoteSignature`/`ERC8183JobOps`, re-align X.85's `Erc8183SignedQuote` to the real schema, and run a security review of the new signing/verification paths. This is a major migration — NOT done here.
2. **Authoritative capability attestation (still required regardless of #1):** a trusted source that supplies job-bound `resource` + `executionCapability` — e.g. a capability registry the provider signs and the marketplace verifies, or an extension of the quote schema to include `resource`/`executionCapability` fields that are themselves signed. Without this, `VerifiedExecutionCapability` cannot be produced.
3. **Custody provisioning** (AWS KMS + ALTANA admin signer) so `custodyAvailable` can become `true` — independent of the capability-source blocker.

Until #2 exists, the capability-source blocker is **permanent**, and real activation remains BLOCKED.

---

### Absolute boundaries honored

NO dependency upgrade · NO package-lock mutation · NO code changes (read-only analysis only) · NO job creation · NO job funding · NO signatures · NO transactions · NO AWS/KMS · NO ALTANA custody · NO PancakeSwap · NO mainnet · NO Agent 1816 · NO Job 515 · NO deployment · NO commit · NO push.
