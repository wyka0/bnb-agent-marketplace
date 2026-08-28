# Main-Track Activation — X.90: External Capability Provider Readiness / Integration Specification

**Date:** 2026-08-21
**Author:** activation workstream (opencode agent)
**Status:** FREEZE + HANDOFF SPECIFICATION. **PARTIAL** (acceptance boundary fully specified and fail-closed; authoritative external provider does NOT exist). NO code changes. NO deploy/commit/push.

---

## 1. X.89 Starting State

- X.76 `capability-source.ts` contains the authoritative external provider contract: `VerifiedExecutionCapability`, `ExecutionCapabilityProvider`, fail-closed `resolveExecutionCapability`.
- No authoritative execution-capability provider exists in the repo or any available SDK (X.84–X.88).
- X.85 `SignedQuoteReader` is NOT a sufficient production capability source: @bnbagent/sdk@0.5.1 signed quote establishes a commercial agreement, not authoritative `resource` + `executionCapability` (X.87).
- Real activation BLOCKED; custody BLOCKED; production healthy; no deploy/commit/push.

X.90 freezes this boundary and converts it into an exact acceptance specification for any future external provider.

---

## 2. Existing Capability Contract (reconciled, not redesigned)

Source of truth: `apps/web/lib/activation/capability-source.ts` (X.76) plus the verified-evidence types it composes (`erc8183-job-evidence.ts` X.80).

### 2.1 `VerifiedExecutionCapability` — the trust-boundary contract

```ts
interface VerifiedExecutionCapability {
  agentId: string; // exact ERC-8004 agentId
  jobId: string; // job-bound (NOT "unknown"/"")
  resource: string; // canonical resource (NOT "default"/"")
  executionCapability: string; // machine-readable kind (NOT "enabled"/"")
  price: string; // positive numeric string
  expiresAt: string; // ISO-8601, future
  verification: {
    source: string; // authoritative origin (NOT "untrusted"/"")
    method: string; // explicit method
    verifiedAt: string; // ISO-8601
  };
}
```

### 2.2 `ExecutionCapabilityProvider` — what the external provider MUST return

```ts
interface ExecutionCapabilityProvider {
  resolveExecutionCapability(input: {
    agentId: string;
    hireId?: string;
    resource?: string;
  }): Promise<VerifiedExecutionCapability | null>;
}
```

The provider MUST return a non-null `VerifiedExecutionCapability` **only when** every field is genuine and passes `verifyExecutionCapability` (placeholder rejection of `"unknown"`/`"default"`/`"enabled"`, non-positive price, elapsed/empty expiry, `"untrusted"`/empty verification). Returning `null` is the safe/fail-closed answer for _any_ uncertainty.

### 2.3 Fail-closed resolver

```ts
async resolveExecutionCapability(_input, provider?) // null when provider absent
```

The module never constructs/imports a provider, never reads env, never reaches the network. A provider is accepted **only** as an explicit injection argument.

### 2.4 Supporting verified-evidence contract (`erc8183-job-evidence.ts`)

A job-bound provider will typically build evidence of type `VerifiedFundedErc8183JobEvidence`:

```
kind:"verified", chainId, jobId, client, provider, agentIdentity,
resource, executionCapability, budget, expiresAt, status, verification
```

`validateVerifiedJob(evidence, ctx)` enforces (this is the exact binding the external provider must satisfy for job-specific capabilities):

- `chainId === expectedChainId`
- `jobId` present, not placeholder
- `client` is an address AND equals `expectedClient` (marketplace identity)
- `provider` is an address AND equals `expectedAgentOwner` (registry owner)
- `agentIdentity` present
- `resource` present, not `"default"`
- `executionCapability` present, not `"enabled"`
- `budget` > 0
- `expiresAt` parseable and in the future
- `status ∈ {FUNDED, SUBMITTED}` (OPEN/EXPIRED/REJECTED/COMPLETED rejected)
- `verification.source`/`method` present, source not `"untrusted"`

`classifyCapability` maps evidence → `no-capability | unverified-job | verified-funded | expired | invalid | revoked-disputed`. Only `verified-funded` may satisfy the gate.

---

## 3. Provider Acceptance Checklist

A future provider MUST establish ALL of the following before `resolveExecutionCapability` may return non-null. Each item is independently verifiable; any missing item → return `null`.

### IDENTITY

- [ ] exact ERC-8004 `agentId` (`{chainId}:{contract}:{tokenId}`)
- [ ] trusted provider/owner identity (resolved from authoritative registry, never user-supplied)
- [ ] cryptographic or authoritative identity binding (signer == provider == registry owner)

### RESOURCE

- [ ] canonical structured resource (not free text)
- [ ] unambiguous meaning (protocol endpoint / service URL / actionable target)
- [ ] integrity protection (signed or registry-attested)
- [ ] binding to the exact agent/provider

### EXECUTION CAPABILITY

- [ ] canonical machine-readable execution capability (specific kind/action)
- [ ] exact operation/action being authorized
- [ ] must mean _executable authority_, not advertisement
- [ ] integrity protection
- [ ] binding to the exact agent/provider

### JOB BINDING (if capability is job-specific)

- [ ] exact `jobId`
- [ ] verified ERC-8183 job (status FUNDED/SUBMITTED)
- [ ] provider matches job.provider and registry owner
- [ ] client matches expected marketplace identity
- [ ] chain matches
- [ ] Commerce contract matches
- [ ] job funded where required
- [ ] job not disputed/revoked/refunded/settled in a way that invalidates capability

### AUTHENTICITY (one of)

- [ ] provider signature (EIP-191 / EIP-712 / ERC-1271)
- [ ] authoritative registry proof
- [ ] cryptographically verifiable attestation
- [ ] **unsigned JSON is NEVER accepted**

### FRESHNESS

- [ ] `issuedAt`
- [ ] `expiresAt`
- [ ] explicit expiration verification (future-dated)

### REVOCATION

- [ ] authoritative revocation mechanism
- [ ] status/revocation lookup where required
- [ ] fail closed when revocation cannot be established

### PROVENANCE

- [ ] `verification.source`
- [ ] `verification.method`
- [ ] `verification.proof`

---

## 4. Trust Levels

| Level       | Source                                                                                                    | Sufficiency                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **LEVEL 0** | Natural-language description / task / terms                                                               | **NEVER sufficient**                                                                                       |
| **LEVEL 1** | Self-declared metadata: ERC-8004 `capabilities[]`, endpoint metadata, static skills, service descriptions | **NEVER sufficient**                                                                                       |
| **LEVEL 2** | Provider-signed capability attestation                                                                    | **Potentially sufficient** if identity, freshness, revocation, resource & execution semantics are verified |
| **LEVEL 3** | Authoritative registry/platform attestation                                                               | **Potentially sufficient** if cryptographically/authoritatively bound                                      |
| **LEVEL 4** | Job-bound cryptographic capability attestation (ERC-8183 FUNDED/SUBMITTED)                                | **Strongest**                                                                                              |

The marketplace MUST NEVER silently promote LEVEL 0/1 evidence into LEVEL 2+.

---

## 5. Required Identity Evidence

- Exact `agentId` string matching the registry identity `{chainId}:{contract}:{tokenId}`.
- Provider/owner address resolved from the authoritative 8004scan registry (`owner_address`), never from request input.
- Cryptographic binding: the attestation signer MUST equal `job.provider` and the registry owner; on mismatch → reject.

## 6. Required Resource Evidence

- `resource` MUST be a canonical, structured, unambiguous, actionable target (e.g. a protocol endpoint or service URL).
- Free text, a registry `description`, tags, or an `x402_supported` boolean are NOT acceptable.
- MUST carry integrity protection (signature/attestation) and MUST be bound to the exact agent/provider.

## 7. Required Execution-Capability Evidence

- `executionCapability` MUST be a specific, machine-readable kind/action (e.g. `"invoke:<service>:<method>"`), never the placeholder `"enabled"`.
- MUST denote executable authority, not advertisement.
- MUST carry integrity protection and be bound to the exact agent/provider.

## 8. Required Job Binding (when job-specific)

- `jobId` present and verified against on-chain ERC-8183 state.
- `verification.method` naming the authoritative origin (e.g. `onchain:erc8183-job-state-read`).
- `client === expectedClient` (marketplace) and `provider === expectedAgentOwner` (registry owner).
- `chainId === 97` (supported phase) and Commerce contract matches.
- Status FUNDED/SUBMITTED; budget > 0; expiry future; not disputed/revoked/settled.

## 9. Required Authenticity Proof

One of: provider EIP-191/EIP-712/ERC-1271 signature, authoritative registry proof, or cryptographically verifiable attestation. **Unsigned JSON is rejected outright.** `verifyExecutionCapability` rejects `verification.source === "untrusted"` and empty `method`.

## 10. Freshness Requirements

- `expiresAt` MUST be present, ISO-8601 parseable, and strictly in the future at verification time.
- An `issuedAt` SHOULD be present for staleness checks.
- Elapsed expiry → `expired` state → gate denied.

## 11. Revocation Requirements

- The provider MUST expose an authoritative revocation/status mechanism (on-chain status, registry revocation, or attestation revocation list).
- If revocation state cannot be established, the capability MUST be treated as revoked → return `null`.
- ERC-8183 `REJECTED`/`COMPLETED` map to `revoked-disputed` and are rejected.

## 12. Rejection Matrix (mandatory — all MUST remain UNAVAILABLE)

| #   | Reject when…                     | Resulting state      |
| --- | -------------------------------- | -------------------- |
| 1   | `agentId` missing                | no-capability        |
| 2   | `agentId` mismatch               | no-capability        |
| 3   | provider missing                 | no-capability        |
| 4   | provider mismatch                | no-capability        |
| 5   | `resource` missing               | invalid              |
| 6   | `executionCapability` missing    | invalid              |
| 7   | resource is only free text       | invalid              |
| 8   | capability is only self-declared | unverified / invalid |
| 9   | proof missing                    | no-capability        |
| 10  | unsupported verification method  | invalid              |
| 11  | signature invalid                | invalid              |
| 12  | signer mismatch                  | invalid              |
| 13  | `jobId` mismatch                 | no-capability        |
| 14  | provider/job mismatch            | invalid              |
| 15  | client/job mismatch              | invalid              |
| 16  | chain mismatch                   | invalid              |
| 17  | Commerce mismatch                | invalid              |
| 18  | job not funded when required     | unverified-job       |
| 19  | capability expired               | expired              |
| 20  | capability revoked               | revoked-disputed     |
| 21  | freshness cannot be verified     | invalid              |
| 22  | provenance cannot be established | no-capability        |
| 23  | provider response malformed      | no-capability        |
| 24  | verification fails               | invalid              |
| 25  | external provider unavailable    | no-capability        |

All 25 cases MUST resolve to **unavailable** (no session, no ACTIVE state).

---

## 13. Security Boundary (FROZEN)

```
Discovery                          ≠  Capability
ERC-8004 identity                  ≠  Execution authority
8004scan metadata                  ≠  Execution authority
ERC-8183 commercial quote          ≠  Execution capability
TERMiX evidence                    ≠  Execution authority
ALTANA skill metadata              ≠  Execution authority
User consent                       ≠  Execution authority
Custody                            ≠  Execution capability
```

A capability source MUST independently pass the verification contract. No other signal may substitute for it.

---

## 14. Future Activation State Machine (FROZEN)

```
DISCOVERED
   ↓
IDENTITY VERIFIED
   ↓
CAPABILITY VERIFIED          (VerifiedExecutionCapability; fail-closed)
   ↓
JOB VERIFIED / FUNDED        (where required; VerifiedFundedErc8183JobEvidence)
   ↓
USER CONSENT                 (ConsentCommitment, constant-time digest verify)
   ↓
CUSTODY AVAILABLE            (AWS KMS session-secret + remote signer/HSM)
   ↓
SESSION CREATION ALLOWED     (evaluateSessionGate 12-check)
   ↓
ACTIVE
```

No state may be skipped. `CAPABILITY VERIFIED` CANNOT be inferred from discovery, registry metadata, user consent, signed commercial quote, or custody availability. `evaluateSessionGate` (X.80) encodes the 12 checks: authenticated identity, wallet ownership, exact agent-identity binding, valid consent digest, `verified-funded` capability, and custody availability.

---

## 15. Signed-Quote Boundary (FROZEN)

The official `@bnbagent/sdk@0.5.1` signed quote MAY authoritatively provide:

- provider identity
- commercial terms
- price
- expiry
- chain
- Commerce binding
- funded-job verification

It MUST NOT automatically populate `resource` or `executionCapability` unless a future authoritative protocol explicitly adds those semantics.

Therefore:

```
SignedQuoteReader  ≠  VerifiedExecutionCapabilityProvider
```

UNLESS the reader is independently proven against the X.90 acceptance checklist (identity, resource, execution semantics, freshness, revocation, provenance all satisfied). In production today `signedQuoteReader` is `null` → the provider returns `null` → gate closed.

---

## 16. Custody Boundary (FROZEN)

- Capability verification does NOT provide custody.
- Custody does NOT provide capability.
- Future activation requires BOTH, as independent gates.

```
Capability:  External authoritative provider → VerifiedExecutionCapability
Custody:     AWS KMS session-secret protection + remote signer/HSM management custody
```

Do NOT provision custody in X.90.

---

## 17. Exact External Dependency

> An authoritative external capability source capable of proving job/agent-bound `resource` + `executionCapability` with integrity, identity binding, freshness, provenance and revocation is required before real activation can proceed.

Acceptable categories (none yet verified/available):

1. Provider-signed capability attestation (LEVEL 2)
2. Authoritative capability registry (LEVEL 3)
3. Job-bound capability attestation (LEVEL 4)
4. Official protocol upgrade that introduces equivalent semantics (e.g. @bnbagent/sdk quote gaining `resource`/`executionCapability`)

No provider that has not been verified may be named or wired.

---

## 18. Test Results (STEP 11 — regression only, NO code changed)

Run from `apps/web`:

| Suite                                                               | Result             |
| ------------------------------------------------------------------- | ------------------ |
| `activation:capability-source:verify` (X.76)                        | 31/31 PASS         |
| `activation:x89` implied via capability-source (contract unchanged) | PASS               |
| `activation:x88`/X.87/X.86 research (no code)                       | N/A (reports only) |
| `activation:x85:verify`                                             | 13/13 PASS         |
| `activation:x84:verify`                                             | 14/14 PASS         |
| `activation:x81:verify`                                             | 45/45 PASS         |
| `activation:x80:verify`                                             | ALL PASS           |
| `test activation` (activation.test.ts)                              | 33 PASS            |
| `test hire`                                                         | 23 PASS            |
| `test hire-api`                                                     | 14 PASS            |
| `test session`                                                      | 25 PASS            |
| `test session-api`                                                  | 72 PASS            |
| `test security` (security.test.ts / x49)                            | 25 PASS            |
| `npx tsc --noEmit` (apps/web)                                       | clean              |
| `npm run lint`                                                      | clean              |
| `npm run build`                                                     | clean              |

X.50 stale `check-24` assertion: pre-existing failure, **preserved/unmodified** (not changed to obtain green). No implementation was modified.

---

## 19. Production Read-Only Results (STEP 12 — NO DEPLOYMENT)

Read-only probes against the existing Vercel project (`bnb-agent-marketplace-web`):

- Marketplace homepage: healthy (200).
- `/api/auth/me`: 200 `{"ok":true,"data":null}` (no ambient session).
- Hire activation POST (unauthenticated): 403 `request-rejected` / `authentication-required` — Hire remains unavailable without capability + auth.
- `/api/altana/session`: 503 (session creation safely blocked; no custody).
- Security headers (`Cache-Control: no-store`, CSRF/Origin guards in `hire.api.ts`) intact.
- No fake ACTIVE session; no execution controls reachable.

Confirmed: production healthy, activation fail-closed, no regressions introduced.

---

## 20. Final Classification

| Axis                        | Classification | Reason                                                                                                             |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| CAPABILITY CONTRACT         | **PASS**       | `VerifiedExecutionCapability` + `ExecutionCapabilityProvider` + fail-closed resolver fully specified and enforced. |
| EXTERNAL PROVIDER READINESS | **BLOCKED**    | No authoritative provider exists in repo or any available SDK.                                                     |
| TRUST BOUNDARY              | **PASS**       | LEVEL 0/1 never sufficient; promotion forbidden; security boundary frozen.                                         |
| FAIL-CLOSED BEHAVIOR        | **PASS**       | `resolveExecutionCapability` returns null without provider; 25-case rejection matrix enforced; gate denies.        |
| REAL CAPABILITY SOURCE      | **BLOCKED**    | None available (X.84–X.88).                                                                                        |
| CUSTODY                     | **BLOCKED**    | AWS KMS / ALTANA custody not provisioned (X.75).                                                                   |
| REAL ACTIVATION             | **BLOCKED**    | Requires both capability source and custody; neither exists.                                                       |
| **OVERALL X.90**            | **PARTIAL**    | Acceptance boundary fully specified and fail-closed, but the authoritative external provider does not yet exist.   |

**X.90 is NOT called PASS** merely because the contract/documentation exists. The blocker (missing external provider) remains.

---

## Absolute Stop Boundary (reaffirmed for X.90)

AWS/KMS: NOT TOUCHED · ALTANA CUSTODY: NOT TOUCHED · TERMiX: READ-ONLY · PancakeSwap: NOT TOUCHED · MAINNET: NOT TOUCHED · AGENT 1816: NOT TOUCHED · JOB 515: NOT TOUCHED · ERC-8183 JOB CREATION: NOT TOUCHED · ERC-8183 FUNDING: NOT TOUCHED · TRANSACTIONS: NONE · NEW INTEGRATION: NONE · DEPENDENCY UPGRADE: NONE · CREDENTIALS: NONE · VERCEL: NO DEPLOYMENT · COMMIT: NO · PUSH: NO

**STOP AFTER X.90.**
