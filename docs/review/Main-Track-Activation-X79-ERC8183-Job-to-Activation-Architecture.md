# Main-Track Activation — X.79: ERC-8183 Job-to-Activation Architecture

**Date:** 2026-08-21
**Milestone:** X.79 (Main-Track Activation, step 79)
**Status:** COMPLETE — classification **PARTIAL** (architecture defined; real activation remains BLOCKED on custody/funding/consent-extension)
**Scope:** Architecture investigation only. No implementation, no ERC-8183 job created, no funding, no transaction, no signing, no AWS/KMS/ALTANA provisioning, no production change, no deploy/commit/push.
**Prerequisites:** X.75 (READINESS PASS / ACTIVATION BLOCKED), X.76 (PROVIDER BOUNDARY), X.77 (NO REPO PROVIDER), X.78 (ERC-8183 = conditional authoritative job-based source).

---

## 1. X.78 Starting State

- No passive execution-capability registry exists. ERC-8183 is the only legitimate authoritative source, but it is **job-based**: authoritative evidence appears only when a marketplace/client creates + funds a job.
- X.78 did NOT create/fund a job. `resolveExecutionCapability()` still returns `null`.
- Authoritative capability evidence = a funded on-chain ERC-8183 job where `provider == agent`, with `budget`, `expiredAt`, `status`, and dispute/settlement/refund state.

---

## 2. Current Activation Architecture (precise map)

**Identity source:** `GET /agents` (8004scan) → `Scan8004Agent` → `RegistryAgentIdentity` (`agent_id` = `{chainId}:{contract}:{tokenId}`, `owner_address`, `chain_id`, `name`, `description`, `x402_supported`, `supported_protocols`).

**Classifier (`capability.ts`):** `resolveAgentActivationCapability()` returns `null` for every real record (8004scan carries no price/jobId/expiry). `classifyAgentActivation()` → `CAPABILITY_UNKNOWN` for chain-97, `NOT_ACTIVATABLE` otherwise. **No fabrication.**

**Hire route (`app/api/activation/hire/route.ts`):** `POST` → CSRF check (`constantTimeEqual`) → `getAuthenticatedUser()` → `hireActivationApi()`.

**Hire API (`hire.api.ts`):** validates CSRF + auth + exact identity (`isValidAgentIdentity` + `findAgentByIdentity` exact match) → calls `review(record)`. If `outcome.available` is false → `409 activation-unavailable`. If `review` → returns `review` + `consent`. If `activate` → requires `consentDigest` exact match → `createSession()` → `201`.

**Hire server (`hire.server.ts`):** `runHireActivation()` → classify → (if ACTIVATABLE) `hireActivationConfigFromEnv()` (public `ALTANA_PAYTO`/`FACILITATOR`/`OPERATOR`, fixture-rejected, pairwise-distinct) → `buildHireReviewFromCapability()` → `prepareErc8183Hire()` (builds the 5-call batch **without** submitting — `assertErc8183SigningBoundary` always throws) → `buildX402LiveReview()` → `pinX402Consent()`.

**Session creation (`altana-session/index.server.ts` + `integrations/altana/session.ts`):** `createAltanaSession()` → `createAltanaSessionManager({ adminPrivateKey: ALTANA_TESTNET_PRIVATE_KEY, ... })` → `grant()` (on-chain session key, scoped `approve(address,uint256)` on $U, spend/native caps, expiry 1h) → `registerSessionKey()` (KeyStore). **Requires the `ALTANA_TESTNET_PRIVATE_KEY` env signer**, which is absent in production → `/api/altana/session` returns **503**.

**Critical observation:** The current flow builds ERC-8183 hire _calldata_ but **never creates or funds a job**, and never treats a funded job as the capability source. The existing `capability-source.ts` resolver returns `null`. Real activation is therefore correctly blocked at every path.

---

## 3. ERC-8183 Lifecycle (from `erc8183.ts` + SDK)

`prepareErc8183Hire` builds the atomic batch: `createJob(provider, router, expiredAt, description)` → `registerJob(jobId, policy)` → `setBudget(jobId, amount)` → `approve(commerce, amount)` → `fund(jobId, amount)`.

State machine (SDK `JOB_STATUS`): `OPEN` → `FUNDED` → `SUBMITTED` → (`settle`→ APPROVE → `COMPLETED`) / (`dispute` + voter quorum → `REJECTED`) / (`expiredAt` passed, no settle → `EXPIRED` via `claimRefund`).

| Field         | Mutability                             | Authoritative read |
| ------------- | -------------------------------------- | ------------------ |
| `jobId`       | immutable (predicted `jobCounter()+1`) | `getErc8183Job`    |
| `provider`    | immutable (set at `createJob`)         | `getErc8183Job`    |
| `client`      | immutable (set at `createJob`)         | `getErc8183Job`    |
| `budget`      | immutable after `fund`                 | `getErc8183Job`    |
| `expiredAt`   | immutable                              | `getErc8183Job`    |
| `status`      | mutable (lifecycle)                    | `getErc8183Job`    |
| `description` | immutable (anchored)                   | `getErc8183Job`    |

Authoritative transitions: only `settle`/`dispute`/`claimRefund` change state; settlement is permissionless. Dispute window + voter quorum gate approval. `getErc8183Job` validates `job.id === requestedId` and known status (throws on predicted-id collision → retry).

A **FUNDED** (or `SUBMITTED`, pre-settlement) job with `expiredAt > now` and `provider == agent` is the minimal authoritative executable artifact.

---

## 4. ERC-8004 Identity Binding (verification rule)

- Agent identity is an exact string `{chainId}:{contract}:{tokenId}`, matched by `findAgentByIdentity` against the fetched 8004scan rows (never from the request body beyond the lookup key).
- The **provider** of the ERC-8183 job MUST equal the registry record's `owner_address` (resolved server-side from 8004scan, not user-supplied).
- Binding rule (enforced before capability acceptance):
  1. `record.chain_id === ACTIVATION_CHAIN_ID` (97) — testnet only.
  2. `record.agent_id` exact-match via `AGENT_IDENTITY_RE` (`^\d+:0x[0-9a-fA-F]{40}:\d+$`).
  3. `job.provider === record.owner_address` (case-normalized).
  4. `job.client === MARKETPLACE_CLIENT_ADDRESS` (the marketplace's own ERC-8183 client) — prevents attaching a third-party/forged job.
- Because `provider` and `client` are immutable in the kernel and the owner comes from the registry fetch, **no user-controlled string can substitute the identity, and the job cannot be attached to a different agent.**

---

## 5. Exact Capability Verification Boundary

A `VerifiedExecutionCapability` is accepted **only** when ALL hold (read fresh on-chain, never cached):

- job exists (`getErc8183Job` succeeds, id matches),
- `status ∈ {FUNDED, SUBMITTED}`,
- `expiredAt > now`,
- `provider === registry.owner_address`,
- `client === marketplace client address`,
- `budget > 0` (→ `price`),
- `executionCapability` derived from `description`/service manifest, **never the placeholder `"enabled"`**,
- `resource` = provider's ERC-8003/8004 service endpoint or the x402 `requirement.resource` (not `"default"`),
- `verification = { source: AgenticCommerce address, method: "onchain:erc8183-job", verifiedAt: now }`.

This satisfies the X.76 `verifyExecutionCapability` validator exactly.

---

## 6. Actionability State Machine

```
Unavailable            — registry listing / no capability / chain != 97
  ↓ (exact identity + chain 97 + user auth)
Configurable           — marketplace config present (payTo/facilitator/operator)
  ↓ (user reviews + consents)
Consent Required       — pinned consent digest (extended, see §7)
  ↓ (marketplace funds ERC-8183 job)
Job Creation Required  — job submitted (OPEN)
Job Funded            — kernel status FUNDED, budget escrowed, expiredAt future
  ↓ (re-read on-chain, binding verified)
Capability Verified   — VerifiedExecutionCapability accepted by X.76 validator
  ↓ (custody available)
Session Creation Allowed — Altana session grant permitted
  ↓ (session active in KeyStore)
Active                — session + capability both live; execution permitted per scope
```

Hard guards (must remain):

- Registry listing alone → **Unavailable**.
- Unsigned job request → **insufficient**.
- Configured-but-unfunded job → **insufficient** (funding required for authoritative capability).
- Funded job for wrong agent (provider mismatch) → **insufficient**.
- Expired job → **insufficient**.
- Disputed / refunded / settled / `REJECTED` / `EXPIRED` job → **insufficient**.

---

## 7. Consent Boundary

Existing: `pinX402Consent(review)` + `constantTimeEqual(consentDigest, outcome.consent.consentDigest)` in `hire.api.ts`. The digest currently binds: `chainId`, `token`, `amount`, `payTo`, `destination`, `calldata`, `jobId`, `configuredPayTo`.

**Gap:** it does NOT explicitly capture:

- that the **marketplace funds** the ERC-8183 job (escrow),
- that a **session will be granted** on the user's wallet scope,
- **custody implications** (session key scoped to `approve` on $U),
- **later execution authorization** (the session may sign within its scope),
- the **expiry** of the resulting capability/session.

**Decision:** extend the consent digest to include `marketplaceFunded: true`, `sessionScope` (target/selector/spendCap/expiry), `executionAuthorized: true`, and `capabilityExpiresAt`. The existing pinning mechanism is sufficient structurally; only the bound fields must grow. **No code change in X.79** — documented as prerequisite.

---

## 8. Funding Model

1. **ERC-8183 client** = the marketplace (hiring party).
2. **Funder** = marketplace, from its own custody-controlled signer (NOT the end user's wallet).
3. **Funding wallet** = marketplace ERC-8183 client signer; user funds are **not** involved in escrow funding.
4. **Marketplace can safely fund** only if it controls a server-side signer (custody). Without it, funding is impossible → activation blocked.
5. **User funds** are not used to fund the job; the user only _consents_. (Per-call x402 payment, if used at execution, is a separate flow from the escrow.)
6. **User signing** is not required for funding (marketplace signs with its custody key); the user's only cryptographic act is the consent digest + SIWE session.
7. **Server-controlled signer required** → the long-lived ALTANA admin signer / remote custody (currently `ALTANA_TESTNET_PRIVATE_KEY`, unprovisioned).
8. **Funding is separate from execution**: funding creates the escrow; execution is the agent's `submit` (which the marketplace later `settle`s).
9. **Funding succeeds, session fails** → job is FUNDED but no session: marketplace must hold/refund (do not auto-create a fake ACTIVE session); surface as `Job Funded` pending and require explicit session creation retry.
10. **Job expires** → capability revoked; any session derived from it must be blocked/invalidated.
11. **Provider disputes/refunds** → job `REJECTED`/`EXPIRED`; session blocked.

---

## 9. Session Creation Boundary

`createSession()` permitted only when ALL true:

- authenticated user (SIWE `getAuthenticatedUser`),
- wallet ownership (`userId`/`walletId`/`walletAddress` match the identity),
- exact agent identity (registry exact match, chain 97),
- valid extended consent (digest match),
- **valid ERC-8183 job**: FUNDED/SUBMITTED, `expiredAt > now`, `provider === owner_address`, `client === marketplace`,
- job/provider ↔ ERC-8004 binding verified (§4),
- `price`/`budget`, `expiry`, `resource`, `executionCapability`, `verification.source/method` all present and non-placeholder,
- **custody available** (KMS secret + ALTANA admin signer).

If custody unavailable → **session creation safely blocked** (today: 503). **No fake ACTIVE session is ever created.**

---

## 10. Execution Boundary (do not collapse)

Five distinct authorizations:

1. **Capability evidence** — funded ERC-8183 job (§5).
2. **User authorization** — consent digest (§7).
3. **Custody authorization** — Altana session key grant, scoped (`approve` on $U, caps, expiry) + KMS-protected secret.
4. **Transaction signing** — the session key signs (or the marketplace signs settlement).
5. **Protocol execution** — agent `submit`s deliverable; marketplace `settle`s.

The existing `session.ts` already separates `grant()` (custody authorization) from `executeQualificationCall()` (actual signed execution with preflight). `Capability Verified` is **necessary but not sufficient** for execution; the session grant + execution scope are additional gates.

---

## 11. Failure / Race-Condition Analysis

| Risk                                   | Required check                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Job expires between verify and session | Re-read `expiredAt > now` immediately before session creation AND before each execution |
| Job status changes after verify        | Re-read `status ∈ {FUNDED,SUBMITTED}` before session + before execution                 |
| Provider changes                       | Impossible (immutable); verify once                                                     |
| Identity mismatch                      | `job.provider === owner_address` at every read                                          |
| Funding failure                        | No job → stays `Consent Required`/blocked; never proceeds                               |
| Duplicate job creation                 | Predicted `jobId`; `getErc8183Job` validates id, retries on collision                   |
| Duplicate hire request                 | Rate limit (`enforceRateLimit`) + live-session 409                                      |
| Concurrent session creation            | `createAltanaSession` 409 on existing live session                                      |
| Revoked session                        | `keyStoreActive()` false → blocked; `revoke()` path                                     |
| Custody unavailable                    | `createAltanaCustody`/signer missing → 503/blocked                                      |
| KMS unavailable                        | Secret decrypt fails → blocked                                                          |
| Signer unavailable                     | Grant throws → session `FAILED`, audited                                                |
| Provider dispute/refund                | Job `REJECTED`/`EXPIRED` → re-read blocks session/execution                             |
| Stale cached job data                  | **Never cache**; always `getErc8183Job` on-chain before session + execution             |

Re-read cadence: **before job funding** (identity+chain+consent), **after funding** (confirm FUNDED), **immediately before session** (FUNDED + not expired + provider match), **immediately before execution** (session active + KeyStore valid + job not settled).

---

## 12. ALTANA Boundary

The existing ALTANA layer (`integrations/altana/session.ts`, `altana-session/*`) would consume:

- **verified agent identity** → `record.owner_address` as `provider`,
- **verified ERC-8183 job** → `budget`/`expiredAt`/`status` gate,
- **resource** → `capability.resourceUrl` / x402 `requirement.resource`,
- **capability** → passed into session `publicMetadata`,
- **user consent** → extended digest (§7),
- **session authorization** → `grant()` scoped session key.

Job **funding** is a _separate_ signing action from the session `grant`, but both use the **same marketplace custody signer**. No execution is performed in X.79.

---

## 13. AWS/KMS Boundary

- **(1) AWS KMS session-secret protection** — existing `custody/` module (`createKmsProvider`, encrypt/decrypt/rotate `AltanaSecret`). Protects the generated session secret at rest. **Does NOT sign ERC-8183 jobs or act as the ALTANA transaction signer.**
- **(2) Long-lived ALTANA admin signer / remote custody** — currently `ALTANA_TESTNET_PRIVATE_KEY` (raw env key) used by `createAltanaSessionManager` for both session `grant` and (future) job funding. Per X.75 this is separate from KMS and is **unprovisioned** → production 503.
- Both **NOT TOUCHED** in X.79. Documented as required future dependency.

---

## 14. Provider Interface Assessment

`ExecutionCapabilityProvider.resolveExecutionCapability(input: {agentId, hireId?, resource?})` → `VerifiedExecutionCapability | null` (X.76) is **SUFFICIENT** for an ERC-8183-backed capability:

- Resolve `agentId` → 8004scan `owner_address`.
- Read `getErc8183Job` for jobs where `provider === owner_address` and `client === marketplace`, `status ∈ {FUNDED,SUBMITTED}`, `expiredAt > now`.
- Construct `VerifiedExecutionCapability` with `jobId`, `price=budget`, `expiresAt=expiredAt`, `resource` (service endpoint), `executionCapability` (derived, not `"enabled"`), `verification={source: AgenticCommerce, method:"onchain:erc8183-job"}`.
- `verifyExecutionCapability` accepts it unchanged.

**No field change required. Prefer no code changes — confirmed.** Only a future implementation of the provider (read-only RPC) is needed.

---

## 15. Security Assessment

Preserved from current architecture:

- **SIWE authentication** (`getAuthenticatedUser`).
- **Wallet ownership** (`userId`/`walletId`/`walletAddress` in session creation).
- **Exact identity matching** (`AGENT_IDENTITY_RE` + `findAgentByIdentity`).
- **CSRF protection** (`constantTimeEqual` x-csrf-token vs cookie).
- **Consent** (`pinX402Consent` + digest match; to be extended per §7).
- **Rate limiting** (`enforceRateLimit("activation.hire", userId)`).
- **Session rotation / revocation** (`loadActiveSession`, `revokeActiveSession`, `session.ts.revoke`).
- **Safe error mapping** (`altanaApiErrorMessage`, no secret leakage).
- **No fake ACTIVE state** (session only after all gates; 503 when custody missing).

**New trust boundary required:** the ERC-8183 job as capability authority. Must be verified **on-chain with fresh re-reads** (no cache) and bound to the exact registry identity + marketplace client. The marketplace-funded job introduces the assumption that `client === marketplace`; this MUST be verified (not attacker-supplied) to prevent forged/third-party job attachment.

---

## 16. Testing

No code changed. Verifiers re-run:

- `activation:capability-source:verify` → **31/31 PASS**
- `activation:hire:verify` → **23/23 PASS**
- `activation:hire-api:verify` → **14/14 PASS**
- `altana:session:verify` → PASS (incl. revoke-failure, registration-failure paths)
- `security:x49:verify` → **25/25 PASS**
- `activation:verify` → **33/33 PASS**
- `typecheck` → exit 0
- `lint` → exit 0
- `build` → exit 0

X.50 `check-24` untouched.

---

## 17. Production Read-Only Checks (no deploy)

- `/` → 200
- `/api/auth/me` → 200 `{"ok":true,"data":null}`
- `/api/activation/hire` POST → **403 Forbidden** (honest; no activation)
- `/api/altana/session` → **503** (no custody)
- No ACTIVE session fabricated; no execution controls exposed; security headers (CSP/HSTS/nosniff/frame-deny) unchanged.

---

## 18. Exact Implementation Prerequisites (future milestone)

1. Implement read-only `ExecutionCapabilityProvider` backed by `getErc8183Job` (RPC only, no credentials).
2. Wire marketplace-funded ERC-8183 job creation + funding into the hire flow, gated by the custody signer.
3. Extend the consent digest to bind funding/session-scope/execution-authorization/expiry (§7).
4. Insert the `Job Funded → Capability Verified → Session Creation Allowed` gate before `createSession`.
5. Provision the ALTANA admin signer / remote custody **and** AWS KMS session-secret protection.
6. Add on-chain re-reads before session creation and before execution (§11).

---

## 19. Exact Next Dependency

A **marketplace-controlled ERC-8183 client signer (custody)** to fund jobs and grant sessions, **plus** the implemented read-only ERC-8183 capability provider. Until both exist, real activation remains BLOCKED.

---

## 20. Final Classification

| Dimension          | Status      | Rationale                                                                                                              |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| ERC-8183 AUTHORITY | **PASS**    | On-chain job state is authoritative for jobId/price/expiry/status                                                      |
| IDENTITY BINDING   | **PASS**    | `job.provider === registry.owner_address`, exact match, immutable                                                      |
| JOB LIFECYCLE      | **PASS**    | OPEN→FUNDED→SUBMITTED→COMPLETED/REJECTED/EXPIRED; immutable core fields; authoritative reads                           |
| CONSENT BOUNDARY   | **PARTIAL** | Existing digest valid but must be extended to cover funding/session/execution                                          |
| SESSION BOUNDARY   | **PARTIAL** | `createSession` exists but lacks the ERC-8183 job-funded gate; custody absent → blocked                                |
| CUSTODY BOUNDARY   | **BLOCKED** | `ALTANA_TESTNET_PRIVATE_KEY`/KMS unprovisioned; no signing possible                                                    |
| REAL ACTIVATION    | **BLOCKED** | No provider implementation, no custody, no job funding                                                                 |
| **OVERALL X.79**   | **PARTIAL** | Architecture is sound and feasible; unresolved funding/identity/custody/consent-extension keep real activation BLOCKED |

**No code was changed in X.79.** The existing `ExecutionCapabilityProvider` interface is sufficient for an ERC-8183-backed capability; only a future read-only provider implementation + custody provisioning + consent extension are required. All verifiers, typecheck, lint, and build remain green; production is healthy and unchanged.

---

## Absolute Boundaries (reaffirmed, all honored)

AWS/KMS: NOT TOUCHED · ALTANA CUSTODY: NOT TOUCHED · TERMiX: READ-ONLY · PancakeSwap: NOT TOUCHED · MAINNET: NOT TOUCHED · AGENT 1816: NOT TOUCHED · JOB 515: NOT TOUCHED · ERC-8183 REAL JOB CREATION: NOT TOUCHED · ERC-8183 FUNDING: NOT TOUCHED · BLOCKCHAIN TRANSACTIONS: NONE · VERCEL: NO DEPLOYMENT · GIT COMMIT: NO · GIT PUSH: NO.
