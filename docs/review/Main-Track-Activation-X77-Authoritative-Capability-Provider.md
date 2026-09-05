# Main-Track Activation — X.77: Authoritative Execution-Capability Provider Investigation

**Date:** 2026-08-21
**Milestone:** X.77 (Main-Track Activation, step 77)
**Status:** COMPLETE — classification **BLOCKED / NOT FOUND**
**Scope:** Documentation + read-only investigation only. No code changes, no deploy, no commit, no push. No blockchain transactions, no AWS/KMS/ALTANA provisioning, no agent activation.
**Prerequisite context:** X.73 (prod restore), X.74 (TERMiX closure), X.75 (ALTANA/AWS-KMS readiness audit), X.76 (execution-capability source boundary).

---

## 1. Objective

Determine, with evidence, whether an **authoritative execution-capability provider** already exists in this repository or its configured ecosystem such that an agent could be marked `executionCapability: "enabled"`, `price > "0"`, a real `jobId` assigned, a real `resource` referenced, and a trusted `verification` issued — i.e. a provider that X.76's `resolveExecutionCapability(input, provider?)` could delegate to instead of returning `null`.

If none exists, document the **exact missing authority** and the concrete external dependency required before real activation can proceed.

---

## 2. Method

1. Read the existing execution-capability boundary (`apps/web/lib/activation/capability-source.ts`) and its 31-check verifier.
2. Grepped the entire repo for `jobId`, `executionCapability`, `price`, `resource`, `capability provider` to locate any real source.
3. Grepped for `attest`/`attestation`/`jobRegistry`/`registry` to locate any on-chain job/attestation registry.
4. Read integration architecture (`packages/integrations/src/altana/index.ts`) and the certified-skills adapter (`skills.ts`).
5. Read the full Prisma schema (`prisma/schema.prisma`) to enumerate persistent data models.
6. Read the env contract (`packages/config/src/env.ts`) to enumerate configured authorities.
7. Read the activation capability resolver (`apps/web/lib/activation/capability.ts`) and hire pipeline (`hire.api.ts`, `hire.server.ts`).
8. Reviewed 8004scan client contract (`apps/web/lib/eight004scan/types.ts`) for capability fields.
9. Performed a read-only production check (no mutation).
10. Wrote this report.
11. Emitted final classification.

---

## 3. Findings — Execution-Capability Source Search

- `jobId` and `executionCapability` appear **only** in:
  - X.76's boundary module `apps/web/lib/activation/capability-source.ts` (the placeholder/verifier fixture), and
  - the hire pipeline (`hire.api.ts`, `hire.server.ts`) which consumes the resolver output.
  - **No module constructs a real `jobId`, real `price`, real `resource`, or trusted `verification`.**
- There is **no** `attest`, `attestation`, `jobRegistry`, `JobRegistry`, `capabilityRegistry`, or `registry` of execution capability anywhere in source — only doc-comment references to where such an authority _would_ live.

**Conclusion:** No in-repo authoritative execution-capability provider exists. X.76's resolver must continue to return `null`.

---

## 4. Findings — Existing Integration `packages/integrations` (ALTANA)

`packages/integrations/src/altana/index.ts` states explicitly:

> "skills.ts — Capability metadata ONLY — no execution, no sessions, no signers"

and

> "erc8183.ts — Phase-5 escrow only (read-only verification of Job 515). DO NOT MODIFY."

`skills.ts` is a **certified-skills capability adapter** with the following hard invariants (lines 1–29, 44–60):

- Lists 7 hackathon-certified skills as marketplace capabilities.
- `executable: false` **always** — "Phase 4 CANNOT execute skills; every attempt funnels through `assertAltanaSkillsNonExecutable` and always stops."
- "INTENTIONALLY ABSENT: sessions, signers, transactions, x402, `get_skill` / `search_skills` MCP consumers, ENV reads, and any live data."
- It is **capability metadata + validation only**. It never issues `jobId`, `price`, `resource`, or `verification`.

`erc8183.ts` Job-515 logic is restricted to **read-only verification** of the historical Agent 1816 / Job 515 escrow (explicitly out of scope per repository standing instruction — not to be touched, not a general capability source).

**Conclusion:** The existing ALTANA integration is **NOT** an authoritative execution-capability provider. It is metadata-only and read-only.

---

## 5. Findings — Prisma Persistent Models

`prisma/schema.prisma` defines exactly:
`User`, `Wallet`, `SiweChallenge`, `AuthSession`, `AltanaSession`, `SessionPermission`, `EncryptedSecret`, `AuditEvent`, `RateLimitBucket`.

**No** `Agent`, `Job`, `Capability`, `Attestation`, `Registry`, or `ExecutionCapability` model exists. There is no database table that could serve as an authoritative capability store. `AltanaSession` / `SessionPermission` describe management-session lifecycle only — not agent execution capability.

---

## 6. Findings — Environment Contract

`packages/config/src/env.ts` (lines 60–99) defines only:

- `ALTANA_NETWORK` (default `bnb-testnet`)
- `ALTANA_RPC_URL` (optional RPC override)
- `AWS_REGION` (optional)
- `ALTANA_KMS_KEY_ID` (optional)
- `ALTANA_KMS_PROVIDER` (`aws` | `test`)

There is **no** `ALTANA_CAPABILITY_PROVIDER`, `JOB_REGISTRY_URL`, `ATTESTATION_ORACLE`, or any variable pointing to an authoritative execution-capability authority. The comment at lines 63–66 confirms: "A private-key signer variable (for sessions/execution) is NOT added yet."

---

## 7. Findings — 8004scan Contract

`apps/web/lib/eight004scan/types.ts` `Scan8004Agent` carries **identity/metadata only**:
`agent_id`, `chain_id`, `owner_address`, `name`, `description`, `supported_protocols[]`, `x402_supported`, `metrics`.

It has **no** `price`, `expiry`, `jobId`, `resource`, or `executionCapability`. The X.76 verifier already proves 8004scan cannot satisfy the execution-capability schema (field-absence checks pass).

---

## 8. Findings — TERMiX / PancakeSwap (Option B)

- TERMiX (X.74): closed — not an execution-capability authority; it was a strategy-surface prototype.
- PancakeSwap (Option B, preserved): a _swap execution_ path, not a per-agent capability registrar. It does not issue `jobId`/`executionCapability`/`verification` for arbitrary agents.

Neither is an authoritative execution-capability provider for the registry.

---

## 9. Production Read-Only Check (no mutation)

| Path                        | Result                        | Interpretation                 |
| --------------------------- | ----------------------------- | ------------------------------ |
| `/`                         | 200                           | Static app served              |
| `/api/auth/me`              | 200 `{"ok":true,"data":null}` | No active session              |
| `/api/auth/nonce`           | 405 (GET not allowed)         | CSRF-protected; safe           |
| `/api/activation/hire` POST | 403 Forbidden (unauth)        | Hire gated, no activation      |
| `/api/altana/session`       | 503 Unavailable               | No live Altana session backend |

Unchanged from X.76. No regression. No capability authority became available in production.

---

## 10. Exact Missing Authority (Required Before Real Activation)

To make `resolveExecutionCapability` return a real (non-null) `VerifiedExecutionCapability`, an authoritative **`ExecutionCapabilityProvider`** must be implemented and injected, backed by one of:

1. **On-chain ERC-8004 job registry / attestation oracle** that, given an `agentId`, returns:
   - a real `jobId` (registered job record),
   - `price` (non-zero, from the job record),
   - `resource` (the job's execution endpoint/resource),
   - `expiry` (from the job record),
   - `verification` (cryptographically signed/attested by a trusted authority).
2. **Altana job-attestation service** that issues per-agent execution attestations with the above fields, callable server-side.
3. A **persistent capability store** (new Prisma models `Agent`/`Job`/`Capability`/`Attestation`) populated by a trusted provisioning process — not present today.

Additionally (from X.75), AWS KMS custody (`ALTANA_KMS_KEY_ID`) is **not configured**, so even a capable agent could not be signed for execution.

**None of these exist in the repository or its current configuration.**

---

## 11. Final Classification

| Check                                                                    | Classification                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| AUTHORITATIVE CAPABILITY SOURCE in repo/ecosystem                        | **BLOCKED / NOT FOUND**                                |
| EXISTING INTEGRATION (`packages/integrations` ALTANA) usable as provider | **BLOCKED** (metadata-only, `executable:false`)        |
| CAPABILITY PROVIDER (X.76 `resolveExecutionCapability` real path)        | **BLOCKED** (returns `null`)                           |
| HIRE ELIGIBILITY (X.76 verifier)                                         | **PASS** (31/31 verifier still green; boundary intact) |
| REAL ACTIVATION (any agent `executionCapability:"enabled"`)              | **BLOCKED**                                            |
| PRODUCTION REGRESSION                                                    | **NONE** (healthy, read-only)                          |
| **OVERALL X.77**                                                         | **BLOCKED / NOT FOUND**                                |

---

## 12. Verification Performed

- Repo-wide grep: `jobId`/`executionCapability` → only X.76 boundary + hire consumer; no real source.
- Repo-wide grep: `attest`/`attestation`/`jobRegistry` → doc-comment references only.
- `skills.ts`, `index.ts` (integrations) read — confirmed metadata-only / read-only.
- `prisma/schema.prisma` read — no capability/agent/job/attest models.
- `packages/config/src/env.ts` read — no capability/registry provider vars.
- `eight004scan/types.ts` read — identity/metadata only.
- Production read-only GET/POST probes — no mutation, no regression.

---

## 13. State of the Tree

- Local HEAD unchanged: `b441c219abc7d48798bba1c2465a6404972ab733`.
- Working tree: untracked X.73/X.74/X.75/X.76 reports + X.76 new files (`capability-source.ts`, `capability-source.verify.ts`).
- **X.77 introduces no new files and no code changes** — investigation + this report only.

---

## 14. Next Steps (for a future milestone, not started)

1. Implement an authoritative `ExecutionCapabilityProvider` (on-chain ERC-8004 job registry/attestation oracle, or Altana job-attestation service, or new persistent capability store).
2. Provision AWS KMS custody (`ALTANA_KMS_KEY_ID`) and a management-custody provider (X.75 BLOCKED items).
3. Wire the provider into `resolveExecutionCapability` behind strict verification.
4. Only then can hire eligibility transit to real activation — and only for agents with a trusted, non-expired `VerifiedExecutionCapability`.

---

## 15. Guardrails Reaffirmed

- No commit, no push, no deploy performed.
- No blockchain transaction, no AWS/KMS/ALTANA provisioning, no mainnet/Agent 1816/Job 515 interaction.
- No agent marked `executionCapability:"enabled"`.
- X.50 stale check-24 assertion preserved unmodified.
- Stop after this milestone.
