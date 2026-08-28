# Main-Track Activation — X.86: Authoritative ERC-8183 Signed-Quote Evidence Validation

> Status: **BLOCKED** (Source inspection of the installed BNB Agent SDK `@altananetwork/sdk@0.7.0` shows NO negotiation / provider-signed-quote / EIP-191 / `JobFunded` verification / `sessionQuoteSigner` implementation. The ERC-8183 job schema carries NO `resource` and NO `executionCapability`. The protocol described in the task prompt is documentation-only relative to this repo's pinned SDK. No authoritative evidence exists to consume.)
> Date: 2026-08-21
> Scope: Inspect the ACTUAL installed SDK + marketplace integration source to determine whether the existing BNB Agent SDK signed-quote protocol can supply authoritative `resource` + `executionCapability` for our `VerifiedExecutionCapability` contract.
> Out of scope (per checkpoint + absolute boundaries): job creation/funding, quote signing, custody, real activation, on-chain writes, deploy, commit, push.

---

## 1. X.85 Starting State

- X.85 implemented `verifySignedQuote` over a **self-defined** `Erc8183SignedQuote` payload (`jobId, provider, resource, executionCapability, quoteExpiresAt, signedAt, signature`) and composed `makeSignedQuoteBindingResolver` into the X.81 provider. It verified that _a correctly-shaped, provider-signed, job-bound, owner-matched, unexpired quote_ yields a `VerifiedExecutionCapability`.
- X.85 was explicitly a **candidate adapter** with no real producer: production has `signedQuoteReader: null`, so the resolver returns `null` and the X.80 gate stays fail-closed.
- The open question for X.86: does the **official SDK** actually produce such a quote, with authoritative `resource` + `executionCapability`? If yes → consume it. If no → the capability-source blocker stays permanent.

## 2. Official SDK Evidence (what is actually installed)

Inspected package: `@altananetwork/sdk` resolved at `node_modules/.pnpm/@altananetwork+sdk@0.7.0_…/node_modules/@altananetwork/sdk` (version **0.7.0**).

`dist/erc8183.d.ts` + `dist/erc8183.js` are the ONLY ERC-8183 surface. Exported functions:

- `erc8183Addresses(chainId)`
- `buildHireCalls(input)` — builds the 5-call atomic hire batch (createJob/registerJob/setBudget/approve/fund)
- `getErc8183Job(network, jobId)` — **view read** of job state
- `getErc8183DeliverableUrl(network, jobId)` — log-scan for `deliverable_url`
- `hireErc8183Agent(...)` — fund a job (requires a Signer/Session; NOT wired in our repo)
- `settleErc8183Job(...)` — settle/dispute (requires a Signer/Session; NOT wired)
- `buildClaimRefundCall(...)`

**There is NO quote/negotiation module.** Grep of the entire SDK `dist` for `Quote|quote|JobFunded|Erc8183JobOps|sessionQuoteSigner|verifyQuote|EIP-191|signMessage` returned **zero matches**. Grep of the SDK `README.md` for `quote|negotiat|JobFunded|sessionQuoteSigner` returned **zero matches**.

The task prompt's documented protocol — negotiation, provider-signed quote, EIP-191 provider signature, quote expiry, `JobFunded` verification by `Erc8183JobOps`, rejection for buyer edits / signature removal / late funding / provider mismatch / chain mismatch / Commerce mismatch, and a `sessionQuoteSigner()` seam — is **not present in SDK 0.7.0**. It is documentation of a protocol this pinned SDK does not implement.

Our own `packages/integrations/src/altana/erc8183.ts` only wraps `getErc8183Job`, `getErc8183DeliverableUrl`, `buildHireCalls` (build-only), `buildClaimRefundCall`, behind `assertErc8183SigningBoundary` (always throws). No quote logic in our source either (grep of `packages/integrations/src` for `quote|negotiat|sessionQuoteSigner|Erc8183JobOps|JobFunded` → zero matches).

## 3. Actual Signed Payload

There is **no provider-signed payload** in the installed SDK. The ONLY field that can carry quote-like content is `Erc8183Job.description`, documented in `HireAgentParams`:

> `task: string` — _"The task text (Mode A) or an anchored signed-quote JSON (Mode B), ≤4096 bytes."_

This text is passed verbatim into the `createJob`/`buildHireCalls` `description` argument and stored on-chain as free text. The SDK **never signs it, never parses it, never verifies it, and never binds it to a provider signature**. "Mode B anchored signed-quote JSON" is opaque task text as far as the SDK is concerned. There is no canonical schema, no `signature` field handling, no `jobId`/`provider`/expiry binding performed by SDK code.

Therefore the exact signed payload requested in STEP 2 does not exist in this SDK. The fields the task asks about resolve as follows against the SDK's actual data model:

| Field                   | Source                                                   | In SDK signed payload?   | Verified on-chain?       | Bound to job?   | Bound to provider? | Fresh/expiring? | Revocable?           |
| ----------------------- | -------------------------------------------------------- | ------------------------ | ------------------------ | --------------- | ------------------ | --------------- | -------------------- |
| agentId                 | ERC-8004 registry (off-chain scan)                       | n/a (not in job)         | registry only            | n/a             | via owner_address  | n/a             | registry-setAgentURI |
| provider                | `Erc8183Job.provider` (on-chain)                         | n/a (no quote)           | YES (job state)          | YES (job field) | YES (job field)    | n/a             | via job state        |
| client                  | `Erc8183Job.client` (on-chain)                           | n/a                      | YES                      | YES             | n/a                | n/a             | via job state        |
| jobId                   | `Erc8183Job.id` (on-chain)                               | **NO** (no quote schema) | YES                      | YES             | n/a                | n/a             | n/a                  |
| task description        | `Erc8183Job.description` (on-chain free text)            | n/a (not signed)         | YES (stored)             | YES (job field) | NO (free text)     | n/a             | n/a                  |
| terms                   | —                                                        | **does not exist**       | —                        | —               | —                  | —               | —                    |
| deliverables            | `Erc8183Job.deliverable` (32-byte hash, post-submission) | n/a                      | YES (post-submit)        | YES             | n/a                | n/a             | n/a                  |
| price                   | `Erc8183Job.budget` (on-chain)                           | n/a (no quote)           | YES                      | YES             | NO (client-funded) | n/a             | via job state        |
| currency                | `paymentToken` (contract const)                          | n/a                      | YES (address)            | n/a             | n/a                | n/a             | n/a                  |
| chainId                 | network config                                           | n/a                      | YES (deployed addresses) | n/a             | n/a                | n/a             | n/a                  |
| quote expiry            | —                                                        | **does not exist**       | —                        | —               | —                  | —               | —                    |
| Commerce contract       | `ERC8183_ADDRESSES[chain].commerce`                      | n/a                      | YES (address)            | n/a             | n/a                | n/a             | n/a                  |
| **resource**            | —                                                        | **does not exist**       | —                        | —               | —                  | —               | —                    |
| **executionCapability** | —                                                        | **does not exist**       | —                        | —               | —                  | —               | —                    |

Conclusion for STEP 2: **`jobId` is NOT signed** (there is no signed quote), **`resource` does not exist**, and **`executionCapability` does not exist** in the SDK's data model.

## 4. Signature Verification

There is no signature to verify. The SDK exposes no `recoverMessageAddress`/`verifyQuote`/EIP-191 path in `erc8183.js`. Any "signature" would have to live inside the opaque `description` free-text JSON, which the SDK neither produces nor validates. So a signature over a quote cannot be verified by any SDK/integration code in this repo.

## 5. Provider Identity Binding (quote → job → ERC-8004 owner)

Because no quote exists, there is no signer to bind. The closest identity binding the SDK DOES perform is at the job level: `Erc8183Job.provider` is an on-chain field, and our X.81 provider independently verifies `job.provider === registry owner_address` (via 8004scan). But that is **job-state** binding, not **quote-signature** binding. The quote→provider→ERC-8004-owner chain requested in STEP 5 is unimplementable because the first link (quote signer) does not exist in this SDK.

## 6. Quote → Job Binding

There is no SDK mechanism preventing quote-A→job-B, provider-A→job-B, chain-97→chain-56, or price-X→price-Y at the _quote_ level, because there is no quote. The task asserts the SDK "verifies the signed quote at the indexed JobFunded block" — **this code is absent from 0.7.0** (no `JobFunded` event handling, no `Erc8183JobOps`, no block-indexed quote verification exists in `erc8183.js`). Job-level integrity (client/provider/budget/expiry/status) is protected by the on-chain kernel + our `validateErc8183JobShape`, but that is not quote binding.

## 7. Resource Semantics

Candidates evaluated against the ACTUAL SDK/job schema:

- **task description** — unstructured free text (`description`, ≤4096 bytes). Not signed, not bound to provider, mutable until funding, not verified as a resource. → **task metadata, NOT resource.**
- **terms** — does not exist in the SDK.
- **service endpoint / agent URL** — not present in the job schema; only the ERC-8004 off-chain registration file (X.83/X.84) carries endpoints, and that is self-asserted, mutable, not job-bound.
- **deliverable** — a 32-byte post-submission hash; not a resource-to-execute.
- **tool / operation / skill / capability declaration** — not present anywhere in the ERC-8183 SDK surface.

The SDK has **no structured resource concept**. Per STEP 3, the task description must be classified as task metadata and must NOT be mapped to `resource`. No implementation change is made.

## 8. Execution Capability Semantics

The SDK distinguishes two questions:

- "this provider agrees to accept THIS commercial job" — partially encoded by the on-chain job (provider, budget, expiry) but **never signed by the provider in a quote** (funding is by the client; the provider's only on-chain action is `submit`/`deliverable`).
- "this agent agrees to perform THIS operation" — **not represented anywhere**. There is no machine-readable capability declaration in the ERC-8183 SDK, `studio.toml`, service/skill definitions, negotiation payload, quote payload, or fulfillment handler. The SDK has no `studio.toml` and no service/skill declaration surface.

So the signed quote (were it to exist) would at most prove a _commercial commitment_, not an _execution capability_. As implemented, even that commercial commitment is not cryptographically signed by the provider in this SDK.

## 9. Freshness / Expiry

- Job-level freshness exists: `Erc8183Job.expiredAt` (unix seconds) is on-chain and enforced by the kernel + X.81 (`expiredAt <= now` ⇒ rejected).
- **Quote-level expiry does not exist** (no quote, no `quoteExpiresAt` in the SDK). The X.85 `quoteExpiresAt` field is a self-defined contract with no SDK producer.

## 10. Revocation / State Handling

- **Job state machine exists**: `JOB_STATUS = ["OPEN","FUNDED","SUBMITTED","COMPLETED","REJECTED","EXPIRED"]`, read via `getErc8183Job`; our `validateErc8183JobShape` enforces id/status sanity, and X.80/X.81 gate on status (only FUNDED/SUBMITTED actionable) + `expiredAt`.
- **Quote-level revocation does not exist** (no quote). There is no `JobFunded` re-verification, no signature-removal rejection, no late-funding rejection at the quote layer in this SDK.

## 11. Repository Reconciliation

Compared the official SDK semantics with the existing marketplace capability code:

- `capability-source.ts` (X.76): `VerifiedExecutionCapability` contract unchanged; still requires authoritative `resource` + `executionCapability` + `authority`.
- `capability-resolution.ts` (X.80): 6-state classifier unchanged.
- `erc8183-job-evidence.ts` (X.80): `validateVerifiedJob` unchanged.
- `erc8183-capability-provider.ts` / `.server.ts` (X.81): `resolveCapabilityBinding` extension point unchanged; still returns `null` in production (no `SignedQuoteReader`).
- `consent.commitment.ts`, `session-gate.ts` (X.80): unchanged.
- `hire.server.ts`, `hire.api.ts` (X.6/X.65): unchanged; still fail-closed.
- **X.84** (`registration-file-capability.ts`): self-asserted candidate, never promoted — unchanged.
- **X.85** (`signed-quote-capability.ts`): its `Erc8183SignedQuote` is a **bespoke, self-defined** schema with no producer in the SDK. It is NOT aligned with any official SDK quote format (none exists). It must NOT be mistaken for "consuming official SDK quotes." If/when an official quote spec lands, this adapter must be re-aligned to the real schema before any consumption.

`resolveCapabilityBinding` **cannot** consume official quote evidence, because the official SDK provides none. No wiring change is justified.

## 12. Security / Trust Boundary

- No weakening of `VerifiedExecutionCapability` (STEP 8 fully honored): `resource` not renamed, `executionCapability` not removed, task description not accepted as capability, terms not accepted as capability, x402/`supported_protocols`/ERC-8004 metadata/TERMiX/unsigned quote all still rejected.
- The X.80 fail-closed gate, X.81 read-only provider, X.84 candidate-only resolver, and X.85 resolver (reader null) all remain in place and unmodified.
- Absolute boundaries respected: no AWS/KMS, no ALTANA custody, TERMiX read-only, PancakeSwap untouched, mainnet untouched, Agent 1816 / Job 515 untouched, no ERC-8183 creation/funding, no transactions, no deploy, no commit, no push.

## 13. Implementation Changes

**NONE.** Per STEP 7 outcome C ("If the quote is not sufficiently bound/authenticated: X.86 = BLOCKED. Do not implement."), and STEP 10 (no live job), no code was added or modified. The working tree is unchanged from X.85 (only this report is added).

## 14. Test Results

No implementation → regression verification only (offline verifiers; no code changed from the green X.85 baseline):

- `activation:x85:verify` — **13/13 PASS**
- `activation:x84:verify` — **14/14 PASS**
- `activation:x81:verify` — **ALL CHECKS PASSED**
- `activation:x80:verify` — **ALL CHECKS PASSED**
- `activation:capability-source:verify` (X.76) — **ALL CHECKS PASSED**
- `activation:verify` — **33 passed, 0 failed**
- `activation:hire:verify` (X.6) — **23/23**
- `activation:hire-api:verify` (X.65) — **14/14**
- `altana:session:verify` (X.45) — **25/25**
- `altana:session:api:verify` (X.47) — **72/72**
- `security:x49:verify` — **25/25**

`typecheck` → exit 0 (clean). `lint` → exit 0 (clean). X.50 `check-24` untouched (pre-existing, not introduced by X.86).

## 15. Production Read-Only Results

**NO DEPLOYMENT** occurred. The activation route wiring (`route.ts`) remains fail-closed (verified job `null`, custody `false`); only X.85 docs/report added. Prior established production state therefore holds:

- `/` → 200, `/agents` → 200, `/api/auth/me` → 200 (healthy marketplace; unchanged).
- `POST /api/activation/hire` → 403 Forbidden (unauthenticated; fail-closed).
- `/api/altana/session` → 503 (no custody signer; unchanged).
- No fake ACTIVE session; no execution controls; unavailable agents remain unavailable; security headers intact.

## 16. Final Classification

| Dimension                     | Result      | Note                                                                                                                                                         |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SIGNED QUOTE AUTHORITY        | **BLOCKED** | No quote/negotiation module in SDK 0.7.0; no signature produced/verified.                                                                                    |
| PROVIDER IDENTITY BINDING     | **BLOCKED** | No quote signer to bind to provider/ERC-8004 owner.                                                                                                          |
| QUOTE → JOB BINDING           | **BLOCKED** | No `JobFunded`/quote verification exists in the SDK.                                                                                                         |
| RESOURCE                      | **BLOCKED** | No structured resource in SDK/job schema; description is task metadata only.                                                                                 |
| EXECUTION CAPABILITY          | **BLOCKED** | No machine-readable capability declaration anywhere in the SDK.                                                                                              |
| FRESHNESS                     | **BLOCKED** | Quote-level expiry absent; only job-level `expiredAt` exists.                                                                                                |
| REVOCATION/STATE              | **PARTIAL** | Job state machine exists (OPEN/FUNDED/SUBMITTED/COMPLETED/REJECTED/EXPIRED); no quote-level revocation.                                                      |
| VERIFIED EXECUTION CAPABILITY | **BLOCKED** | Cannot be produced without authoritative `resource` + `executionCapability`.                                                                                 |
| REAL ACTIVATION               | **BLOCKED** | No funding, no signing, no custody, no real job.                                                                                                             |
| **OVERALL X.86**              | **BLOCKED** | The official SDK (pinned 0.7.0) does NOT implement the documented signed-quote protocol; it cannot supply authoritative `resource` or `executionCapability`. |

### Central question answered

> Does the existing BNB Agent SDK provide enough authoritative semantics to prove BOTH `resource` AND `executionCapability`?

**No.** The installed `@altananetwork/sdk@0.7.0` contains a buyer-side hire/fund/settle/read layer only. It has no negotiation, no provider-signed quote, no EIP-191 signature, no `JobFunded` verification, no `sessionQuoteSigner()` seam, and the `Erc8183Job` schema omits both `resource` and `executionCapability`. The protocol documented in the task prompt is not implemented in this repo's pinned SDK, so there is no authoritative quote evidence for `resolveCapabilityBinding` to consume. X.86 is therefore **BLOCKED**, not PARTIAL and certainly not PASS.

This does NOT invalidate X.85: `signed-quote-capability.ts` remains a valid _forward-looking_ verifier for a quote shape that an authoritative future publisher could emit — but it is a self-defined contract with no SDK producer today, and must not be mistaken for consuming official SDK quotes.

## 17. Exact Next Dependency

To move past BLOCKED, one of the following must occur (none are part of X.86, and all are outside the no-deploy/no-custody/no-job boundaries):

1. **An official SDK version that actually implements the documented quote protocol** — with a canonical signed-quote schema committing (at minimum) `jobId`, `provider`, `resource`, `executionCapability`, `quoteExpiresAt`, and a verifiable EIP-191 signature, plus `JobFunded`-block verification. X.85's `Erc8183SignedQuote` would then be re-aligned to that real schema and a `SignedQuoteReader` implemented.
2. **An authoritative out-of-band quote publisher** (the ERC-8183 provider/registry owner) issuing quotes over funded jobs, supplying a `SignedQuoteReader` to `createProductionErc8183CapabilityProvider({ signedQuoteReader })`.
3. **Custody provisioning** (AWS KMS + ALTANA admin signer) so `custodyAvailable` can become `true` — required independently of the capability-source blocker.

Until (1) or (2) exists with a real, verifiable, job-bound, provider-signed quote, the capability-source blocker is **permanent** for this repo's current SDK, and real activation remains BLOCKED.

---

### Absolute boundaries honored

AWS/KMS NOT touched · ALTANA custody NOT touched · TERMiX read-only · PancakeSwap NOT touched · mainnet NOT touched · Agent 1816 NOT touched · Job 515 NOT touched · ERC-8183 job creation NOT touched · ERC-8183 funding NOT touched · transactions NONE · Vercel NO deployment · git commit NO · git push NO.
