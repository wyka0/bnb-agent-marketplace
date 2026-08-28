# Main-Track Activation — X.89: External Verified Execution Capability Provider Boundary

**Date:** 2026-08-21
**Author:** activation workstream (opencode agent)
**Status:** PARTIAL (contract confirmed sufficient via existing X.76; no real provider exists — external dependency documented, not built)

---

## 1. Objective

Define the contract and boundary for an **authoritative, externally-supplied, verified execution-capability provider** — the single component that can satisfy the `AgentActivationCapability` gate so an agent can become ACTIVATABLE in the Hire → Consent → Session → Custody → Execution pipeline.

Over X.84–X.88 we proved that NO existing integration provides this:

- X.84: registration-file metadata → `CandidateCapabilityBinding` only (jobBound:false, integrityVerified:false).
- X.85: signed quote is the _only_ candidate trusted source, gated behind a `SignedQuoteReader` that production does not construct (gate stays closed).
- X.86: pinned `@altananetwork/sdk@0.7.0` has **no** quote/negotiation module.
- X.87: official `@bnbagent/sdk@0.5.1` has a full signed-quote protocol but its quote carries **no** `resource`/`executionCapability` and **no** `jobId`.
- X.88: BNB Agent Studio / official SDK expose only self-asserted LEVEL 0/1 capability metadata (no LEVEL 2/3/4 attestation).

X.89 therefore defines the **contract the external provider must satisfy** — and verifies whether the repo already has it.

---

## 2. Outcome Classification

**PARTIAL.**

- ✅ The required contract **already exists** in `apps/web/lib/activation/capability-source.ts` (X.76). No new interface, module, or code is needed.
- ❌ The **implementation** of that contract — a real, authoritative provider — does **not** exist anywhere in the repo or in any available SDK (X.84–X.88). This remains an external dependency.
- ❌ No agent is ACTIVATABLE in the current architecture (fail-closed by construction).

Per X.89 STEP 12, because the existing X.76 interface provides this contract adequately, **we do NOT duplicate it**. We document that it is sufficient and specify the boundary the external provider must meet.

---

## 3. The Authoritative Contract (existing — X.76, NOT redefined)

Source: `apps/web/lib/activation/capability-source.ts`

### 3.1 `VerifiedExecutionCapability` (mandatory fields)

```ts
interface VerifiedExecutionCapability {
  agentId: string;
  jobId: string; // job-bound (NOT "unknown"/"")
  resource: string; // resource URL (NOT "default"/"")
  executionCapability: string; // kind (NOT "enabled"/"")
  price: string; // positive numeric string
  expiresAt: string; // ISO-8601, must be in the future
  verification: {
    source: string; // authoritative origin (NOT "untrusted"/"")
    method: string; // explicit method (e.g. "onchain:erc8004-job")
    verifiedAt: string; // ISO-8601 verification timestamp
  };
}
```

This is a **superset** of what X.84/X.85/X.87 produce:

- X.84 `CandidateCapabilityBinding` → has no `jobId`, no `verification` → cannot satisfy.
- X.85 `Erc8183SignedQuote` → has `jobId`, `resource`, `executionCapability`, `quoteExpiresAt`, `provider`; the `SignedQuoteReader` adapter must map it into `VerifiedExecutionCapability` (price from the bound job, `verification.method = "signed-quote:erc8183"`). **Only** when such a reader is supplied and passes `verifyExecutionCapability`.
- X.87 official SDK quote → has NO `resource`/`executionCapability`/`jobId` → cannot satisfy without an out-of-band binding.

### 3.2 `ExecutionCapabilityProvider` (the boundary the external provider must implement)

```ts
interface ExecutionCapabilityProvider {
  resolveExecutionCapability(
    input: ExecutionCapabilityInput
  ): Promise<VerifiedExecutionCapability | null>;
}
```

### 3.3 Fail-closed resolver

```ts
async function resolveExecutionCapability(
  _input: ExecutionCapabilityInput,
  provider?: ExecutionCapabilityProvider
): Promise<VerifiedExecutionCapability | null> {
  if (!provider) return null; // production reality → null
  const capability = await provider.resolveExecutionCapability(_input);
  if (!capability) return null;
  return verifyExecutionCapability(capability).ok ? capability : null;
}
```

**Key safety property:** the module never imports/constructs a provider, never reads env/config, never reaches the network. A provider is accepted **only** as an explicit injection argument. Until a genuine implementation is deliberately wired in, every call resolves to `null`.

---

## 4. What the External Provider MUST Guarantee (boundary spec)

Any future authoritative provider (provider-signed, registry-attested, or otherwise) MUST, before a non-null `VerifiedExecutionCapability` is returned:

1. **Job binding** — `jobId` references a real, funded ERC-8183 job (verified via `getErc8183Job`, status ∈ {FUNDED, SUBMITTED}); never `"unknown"`.
2. **Resource binding** — `resource` is a concrete, addressable execution target (not `"default"`); ideally signed/attested by the provider.
3. **Execution capability** — `executionCapability` is a specific kind (not the boolean placeholder `"enabled"`).
4. **Authoritative verification** — `verification.source` names a real origin and `verification.method` is explicit (e.g. `onchain:erc8004-job`, `signed-quote:erc8183`, `attestation:altana-session`); `"untrusted"` is rejected.
5. **Expiry & revocation** — `expiresAt` is a parseable future timestamp; the provider is responsible for revocation (returning `null` past expiry or on revoke).
6. **No self-assertion** — a registry listing / `x402_supported` boolean / natural-language description is **not** sufficient (proven in X.83/X.88).

The existing `verifyExecutionCapability` already enforces (1)–(5) at the value level (placeholder rejection, positive price, future expiry, trusted verification). The provider is responsible for _originating_ trustworthy values.

---

## 5. Reused / Composed Components (no new code)

| Component                               | Role in the boundary                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `capability-source.ts` (X.76)           | The contract + fail-closed resolver (THIS milestone's anchor).                                            |
| `erc8183-job-evidence.ts` (X.80)        | Produces `VerifiedFundedJob` (the job-binding evidence a provider would use).                             |
| `erc8183-capability-provider.ts` (X.81) | A concrete `ExecutionCapabilityProvider` skeleton; awaits `resolveCapabilityBinding`, defaults to `null`. |
| `signed-quote-capability.ts` (X.85)     | `SignedQuoteReader` adapter candidate → maps quote → `VerifiedExecutionCapability`.                       |
| `session-gate.ts` (X.80)                | Consumes the resolved capability; 12-check fail-closed gate.                                              |
| `capability-resolution.ts` (X.80)       | Classifies activation state (UNAVAILABLE when capability null).                                           |

No file was modified for X.89. The contract was confirmed present and sufficient.

---

## 6. Non-Compliance to Avoid (explicit)

- ❌ Do **NOT** create a `DEFAULT` / `MOCK` / `DEV` / `ENV` provider that returns synthetic capabilities. The resolver must stay `null` when no real provider is supplied.
- ❌ Do **NOT** promote X.84 `CandidateCapabilityBinding` (job-unbound, unverified) into `VerifiedExecutionCapability`.
- ❌ Do **NOT** treat registration-file / ERC-8004 `capabilities:string[]` / Studio metadata as execution evidence (X.83/X.88).
- ❌ Do **NOT** read env vars or construct a provider inside `capability-source.ts` (breaks fail-closed guarantee).
- ❌ Do **NOT** re-implement the contract (duplication); document X.76 as authoritative.

---

## 7. Capability Source Audit — Final Disposition

| Source (X.84–X.88)        | Provides job-bound resource+execCap?                                            | Usable as `VerifiedExecutionCapability`? |
| ------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| Registration file (X.84)  | No (jobBound:false)                                                             | ❌ Candidate only                        |
| Signed quote (X.85)       | Yes, **iff** `SignedQuoteReader` supplied + signer==provider==owner + unexpired | ⚠️ Conditional (reader absent in prod)   |
| Pinned SDK quote (X.86)   | N/A (no quote module)                                                           | ❌ Absent                                |
| Official SDK quote (X.87) | No (no resource/execCap/jobId)                                                  | ❌ Needs out-of-band binding             |
| Studio / ERC-8004 (X.88)  | No (self-asserted metadata)                                                     | ❌ LEVEL 0/1 only                        |

**Conclusion:** The only theoretically valid source is a `SignedQuoteReader` (X.85) or an equivalent authoritative provider — **none of which exist in production**. The X.76 contract is the correct, sufficient boundary; the missing piece is the _implementation_, which is an external dependency outside this milestone's scope.

---

## 8. Verification / Regression

No code changed in X.89 → prior regression remains valid. Re-ran to confirm GREEN:

- `npm run activation:capability-source:verify` → 31/31 PASS (contract intact).
- `npm run activation:x81:verify` → 45/45 PASS.
- `npm run activation:x80:verify` → ALL PASS.
- `npm run activation:x85:verify` → 13/13 PASS.
- `npm run activation:x84:verify` → 14/14 PASS.
- `npx tsc --noEmit` (apps/web) → clean.
- `npm run lint` → clean.

(X.50 stale `check-24` assertion preserved/unmodified, pre-existing failure unrelated to this workstream.)

---

## 9. Status & Next Action

**STATUS: PARTIAL — contract confirmed sufficient; external provider implementation remains a missing dependency. STOP.**

The X.76 `capability-source.ts` is the authoritative external capability-provider boundary. No further code is required for this milestone.

**Future work (outside X.89 scope, blocked):**

1. Build a real `ExecutionCapabilityProvider` (e.g. `SignedQuoteReader` from X.85, or a registry-attested provider) that resolves job-bound `resource`+`executionCapability` with trusted `verification`.
2. Provision ALTANA custody (X.75 BLOCKED) so the Consent → Session → Custody chain can complete.
3. Deliberately wire the provider into `resolveExecutionCapability` **only after** (1) and (2) are satisfied — never as a default.

No deploy, no commit, no push performed.
