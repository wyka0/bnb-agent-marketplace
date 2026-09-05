# Main-Track Activation — X.81: Read-Only ERC-8183 Capability Provider

> Status: **PARTIAL** (Read-only verifier fully implemented & tested; real activation still BLOCKED — ERC-8183 job schema omits `resource`/`executionCapability`, and custody is not provisioned)
> Date: 2026-08-21
> Scope: BNB Agent Studio Marketplace — read-only execution-capability provider implementing the X.76 `ExecutionCapabilityProvider` interface.
> Explicitly out of scope (per X.76–X.80 and this task): job creation/funding, signing, transaction submission, custody provisioning (AWS KMS / ALTANA keys), real agent activation, on-chain writes.

---

## 1. X.80 Starting State

- Consent commitment boundary, ERC-8183 job-evidence representation, 6-state capability resolution, fail-closed session gate, custody gate — all implemented and verified (X.80 PASS on the application boundary).
- Production wiring was fail-closed: `verifiedJob = null`, `custodyAvailable = false` ⇒ real activation unavailable.
- The X.76 `ExecutionCapabilityProvider` interface was confirmed sufficient; no field change required. X.80 established that a future read-only provider must read an actual funded ERC-8183 job and bind it to the exact ERC-8004 agent.

## 2. Existing ERC-8183 Integration

`packages/integrations/src/altana/erc8183.ts` (re-exported via `@bnb-marketplace/integrations/altana`) already provides:

- `getErc8183Job(network, jobId)` — a **pure read** of the AgenticCommerce kernel job state. It asserts the testnet chain (97), normalizes RPC/revert errors, and never signs or submits.
- `getErc8183Addresses(chainId)` — returns the authoritative contract address table (no hardcoded addresses).
- `ALTANA_ERC8183_CHAIN_ID = 97` and `BNB_TESTNET` (`NetworkConfig` from `@altananetwork/sdk`).

This integration is the ONLY on-chain ERC-8183 surface and is reused verbatim — no new chain code was written.

## 3. Contract / Read Interface

The authoritative `Erc8183Job` type (from `@altananetwork/sdk`, `erc8183.d.ts`) exposes exactly:

```
id, client, provider, evaluator, description, budget, expiredAt,
status, statusName, hook, submittedAt, deliverable
```

**Authoritative, on-chain state available for verification:** `id`, `client`, `provider`, `budget`, `expiredAt`, `statusName`/`status`. These are read via `getErc8183Job` (`eth_call`/view only).

**Critical gap (see STEP 7 / §9 / §18):** the schema carries **NO `resource` and NO `executionCapability`** field. Only `description` (free task text) is present. Those two required capability fields therefore cannot originate from the job itself.

## 4. Chain Configuration

- Only **chain 97 (BNB testnet)** is supported. The provider hard-fails (`return null`) when `expectedChainId !== 97`.
- Mainnet (56) is NOT wired: `getErc8183Job` itself rejects non-testnet, and the provider refuses any other chain id. No silent fallback between chains.
- The requested job chain is explicit: the job id is supplied via `ExecutionCapabilityInput.hireId` and the reader is bound to testnet.
- The ERC-8183 contract address used for provenance comes from `getErc8183Addresses(97).commerce` (authoritative, never hardcoded).

## 5. RPC Strategy

- Read-only only: `eth_call` / view reads through the injected `Erc8183JobReader`. Production reader = `getErc8183Job(BNB_TESTNET, jobId)`.
- Forbidden operations (signing, submission, funding, private keys, wallet ops) are NOT reachable from this module; the integration's `assertErc8183SigningBoundary` remains the global guard.
- **All RPC/contract errors fail closed** — any thrown error from the reader is caught and yields `null`. No RPC error is ever converted into a capability.

## 6. Job Discovery Strategy

- **No job discovery is performed.** The provider accepts an explicit, trusted job id via `ExecutionCapabilityInput.hireId` (the existing `hireId` field; semantically the hire/job id). This is exactly the "explicit trusted job ID" permitted by STEP 11.
- It does NOT scan events, does NOT pick the newest/first job, does NOT select by name, and does NOT trust user input to locate a job. When `hireId` is absent ⇒ `null`.
- ERC-8183 exposes no reliable agent→job index in the repository, so discovering "the job for an agent" is intentionally left to the caller; fabricating discovery would violate the honesty contract.

## 7. Identity Binding

- `job.provider` is verified (case-insensitive) to equal the **trusted** ERC-8004 registry `owner_address` for the exact `agentId`, obtained from `resolveAgentOwner(agentId)` — which in production reads 8004scan (trusted application data).
- `job.client` is verified to equal the configured marketplace client `expectedClient` (`process.env.ALTANA_ERC8183_CLIENT`).
- URL parameters, user-supplied provider/owner, display name, and description are **never** trusted for identity. Any mismatch ⇒ `null`.

## 8. Job-State Validation

Rejected: nonexistent job, zero/uninitialized, unfunded (`OPEN`), invalid status, expired (`expiredAt <= now`), disputed (`REJECTED`), settled (`COMPLETED`), cancelled/non-actionable (`EXPIRED` status), malformed/null reader result, RPC/contract failure, id mismatch, stale provider. Only `FUNDED` / `SUBMITTED` are actionable.

## 9. Capability / Resource

- `resource` and `executionCapability` are **NOT present in the ERC-8183 job schema** (confirmed against the SDK type). They MUST come from an explicitly trusted out-of-band binding supplied via `resolveCapabilityBinding(agentId, job)`.
- The binding is the ONLY permitted source. It is **never** fabricated from registry description, tags, `x402_supported`, reputation, or history.
- When the binding returns `null` (the production default, since no trusted catalog is configured yet), the provider returns `null` and documents the missing field. This is the CAPABILITY VERIFICATION partial-blocker.
- The verifier proves the binding path both ways: a trusted binding yields capability; absent/malformed binding yields `null`.

## 10. Price / Expiry

- `budget` and `expiredAt` are read from authoritative job state (bigint → string / ISO). Reject missing/zero budget and expired/missing expiry (`expiredAt <= 0` or past ⇒ `null`).
- No UI price, registry price, market price, or estimate is substituted.

## 11. Verification Provenance

Every successful capability carries explicit provenance:

```
verification.source  = <authoritative ERC-8183 commerce contract address>
verification.method  = "onchain:erc8183-job-state-read"
verification.verifiedAt = <ISO-8601 read timestamp>
```

The method string honestly states the verification is a **read-only on-chain job-state read** — it does NOT claim cryptographic attestation. The X.76 validator rejects `source === "untrusted"`.

## 12. Freshness Strategy

- The provider re-reads the job on **every** `resolveExecutionCapability` call (no caching). Job state (status, expiry, provider, client, funding) is therefore re-evaluated immediately before capability acceptance.
- No long-lived capability cache is introduced, so stale data cannot authorize activation (the verifier includes a "stale data (provider changed)" negative case).

## 13. Security Boundary

- All existing layers preserved: SIWE/auth (`evaluateActivationGate` still requires an authenticated identity), exact ownership, CSRF (`hire.api` enforces it), consent (`evaluateSessionGate` requires a matching digest), rate limiting, session rotation, revocation, safe errors, CSP/HSTS/security headers, secret protection.
- The provider is an **additional evidence layer**, not a replacement for authorization. It cannot create a session, cannot bypass consent, cannot bypass custody, cannot bypass ownership, and cannot bypass CSRF. Proven by the security checks in §16 and the X.80 gate integration test (capability verified + custody false ⇒ still blocked).

## 14. Custody Boundary

- Custody (`AWS KMS`, `ALTANA_TESTNET_PRIVATE_KEY`, remote signer, HSM) is **NOT configured or touched**.
- The provider works independently of custody. Even when it returns a verified capability, the X.80 session gate remains `custodyAvailable = false` in production ⇒ **Session Creation Blocked**. Demonstrated by the verifier's security check.

## 15. Implementation Changes

Added (working tree, untracked — NOT committed):

- `apps/web/lib/activation/erc8183-capability-provider.ts` — **PURE** read-only provider. Defines `Erc8183JobReader`, `Erc8183CapabilityBinding`, `Erc8183CapabilityProviderConfig`, `resolveErc8183VerifiedJob(input, config)`, and `createErc8183CapabilityProvider(config)` implementing `ExecutionCapabilityProvider`. Only `import type` from `@altananetwork/sdk` (no runtime SDK dep in the pure module, so the offline verifier stays network-free). Reuses `validateVerifiedJob` (X.80) as a defense-in-depth final check.
- `apps/web/lib/activation/erc8183-capability-provider.server.ts` — **SERVER-ONLY** production wiring. `createProductionErc8183CapabilityProvider()` reuses `getErc8183Job(BNB_TESTNET, jobId)` (read-only), `getErc8183Addresses(97).commerce` (provenance), and the trusted 8004scan `owner_address` resolver. `resolveCapabilityBinding` defaults to `null` (the ERC-8183-missing-field case). This module is intentionally **NOT yet wired into the activation route** so production stays fail-closed.
- `apps/web/lib/activation/x81.verify.ts` — offline verifier (45 checks).
- `apps/web/package.json` — added script `activation:x81:verify`.

No existing file was modified except adding the npm script. The X.80 route wiring remains fail-closed.

## 16. Tests

`npm run activation:x81:verify` — **45/45 PASS** (offline, no RPC). Covers:

- **Positive (12 + X.76 mapping + X.80 validation + SUBMITTED):** valid funded job; correct chain/job/client/provider/agent; valid resource/capability/price/expiry/status; provenance source + method + timestamp; X.76 capability passes `verifyExecutionCapability`; produced evidence passes X.80 `validateVerifiedJob`.
- **Negative (23):** nonexistent job, wrong chain, wrong client, wrong provider, wrong agent, wrong job id, untrusted job id (no `hireId`), unfunded OPEN, expired, disputed REJECTED, settled COMPLETED, cancelled EXPIRED, missing resource, missing capability, **no trusted binding (ERC-8183 missing field)**, missing price, missing expiry, malformed RPC result, RPC failure, stale provider, forged client. All return `null`.
- **Security (3):** provider exposes only `resolveExecutionCapability`; capability result has no session/ACTIVE shape; verified capability + `custodyAvailable=false` still blocked at the X.80 gate (reason `"custody unavailable"`, state `"verified-funded"`).

Existing suites remain green: `activation:x80:verify` (ALL PASS), `activation:capability-source:verify` (X.76 ALL PASS), `activation:hire:verify` (23/23), `activation:hire-api:verify` (14/14), `altana:session:verify` (25/25), `altana:session:api:verify` (72/72), `security:x49:verify` (25/25), `activation:verify` (33/33). `typecheck`/`lint`/`build` exit 0. X.50 `check-24` untouched.

## 17. Production Read-Only Checks (no deploy/commit/push)

- `/` → **200**, `/agents` → **200**, `/api/auth/me` → **200** (healthy marketplace + agent details).
- `POST /api/activation/hire` → **403 Forbidden** (unauthenticated; fail-closed). Unsupported agents remain unavailable; no fake `ACTIVE` session; no execution controls without a verified job.
- `/api/altana/session` → **503** (no custody signer; unchanged). Security headers intact.
- No production job was manufactured for testing (none exists).

## 18. Limitations

1. **ERC-8183 schema gap:** jobs expose no `resource` or `executionCapability`. These must come from a trusted out-of-band binding. Until that binding source is configured, the production provider returns `null`. **The missing fields are `resource` and `executionCapability`.**
2. **Job discovery:** no reliable agent→job index exists in-repo; only an explicit trusted `hireId` is accepted.
3. **Mainnet (56):** not wired (integration + provider both refuse non-testnet).
4. **Custody:** not provisioned ⇒ session creation stays blocked even with a verified capability.

## 19. Exact Next Dependency

To move from PARTIAL → real verification, the following must be supplied (none are part of X.81):

- A **trusted capability-binding source** mapping a verified agent to its `resource` (service endpoint) and `executionCapability` — the only permitted origin for the two ERC-8183-absent fields. Supplied to `createProductionErc8183CapabilityProvider({ resolveCapabilityBinding })`.
- Custody provisioning (AWS KMS + ALTANA admin signer) so `custodyAvailable` can become `true`.
- Wiring `createProductionErc8183CapabilityProvider()` into `route.ts`'s `evaluateActivationGate` (replacing the inline fail-closed `verifiedJob: null`) — at which point the gate can return `allowed: true` for a genuinely verified-funded job **with** available custody.

## 20. Final Classification

| Dimension               | Result      | Note                                                                                                                                                                                                                       |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ERC-8183 READ PROVIDER  | **PASS**    | Real, testnet-gated, read-only job reader reused from existing integration; verifies identity/status/funding/expiry.                                                                                                       |
| JOB DISCOVERY           | **PARTIAL** | Explicit trusted `hireId` accepted; no fabricated/event-based discovery (none reliable in-repo).                                                                                                                           |
| IDENTITY VERIFICATION   | **PASS**    | `job.provider === trusted 8004scan owner` and `job.client === marketplace client`; user input never trusted.                                                                                                               |
| CAPABILITY VERIFICATION | **PARTIAL** | On-chain job fully verified, but `resource`/`executionCapability` are NOT in the ERC-8183 schema; require a trusted out-of-band binding that is not yet configured. **Missing fields: `resource`, `executionCapability`.** |
| FRESHNESS               | **PASS**    | Re-reads on every call; no caching; stale state cannot authorize.                                                                                                                                                          |
| SESSION INTEGRATION     | **PASS**    | Provider output feeds the X.80 `VerifiedFundedErc8183JobEvidence` + gate; verified capability + no custody ⇒ blocked.                                                                                                      |
| CUSTODY                 | **BLOCKED** | Not provisioned; provider independent of custody; gate still denies.                                                                                                                                                       |
| REAL ACTIVATION         | **BLOCKED** | No funding, no signing, no custody, no actual job in repo.                                                                                                                                                                 |
| **OVERALL X.81**        | **PARTIAL** | Read-only verifier implemented & tested; blocked only by the ERC-8183 schema gap (resource/capability) and absent custody.                                                                                                 |

### Read-only verification vs. job creation/funding vs. real execution

- **READ-ONLY CAPABILITY VERIFICATION:** ✅ implemented (X.81) — reads + verifies an existing funded ERC-8183 job; never writes.
- **JOB CREATION / FUNDING:** ❌ NOT implemented (out of scope; `assertErc8183SigningBoundary` still forbids it).
- **REAL EXECUTION:** ❌ NOT implemented (no custody, no session, no agent activation).

The provider encodes the boundary honestly: it can PROVE a job authorizes activation, but it cannot — and does not — create the job, fund it, or execute anything.
