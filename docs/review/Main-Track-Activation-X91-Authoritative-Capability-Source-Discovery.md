# Main-Track Activation — X.91: Authoritative Capability Source Discovery

**Date:** 2026-08-21
**Author:** activation workstream (opencode agent)
**Status:** READ-ONLY INVESTIGATION. **OUTCOME C — NO authoritative existing source.** No code changes. No deploy/commit/push.

---

## 1. X.90 Starting State

X.90 froze the acceptance boundary in `capability-source.ts` (X.76) and specified exactly what an external provider must supply: exact agent/provider identity, canonical resource, canonical executionCapability, authoritative binding, authenticity proof, verification method, provenance, freshness (issuedAt/expiresAt), revocation/status, and job binding. The frozen contract is unchanged by this milestone; X.91 only asks whether a REAL source satisfying it now exists.

---

## 2. Search Scope (frozen boundaries honored)

Investigated WITHOUT introducing any new integration, dependency change, credential, AWS resource, ERC-8183 job creation/funding, transaction, or use of Agent 1816 / Job 515:

1. Repository code & dependency tree (`apps/web`, `packages/integrations`).
2. Installed SDKs: `@altananetwork/sdk@0.7.0` (the one actually used), and the previously-cloned official `@bnbagent/sdk@0.5.1` (temp copy, not a project dependency).
3. 8004scan, ERC-8183, ALTANA, TERMiX, x402, PancakeSwap, BNB Agent SDK functionality — existing only.
4. ERC-8004 / ERC-8183 infrastructure as currently installed.
5. Official upstream schema notes embedded in the installed SDK `.d.ts`.

---

## 3. Repository Findings

Source-of-truth code inspected (unchanged since X.89/X.90):

- `capability-source.ts` — `VerifiedExecutionCapability` requires `agentId, jobId, resource, executionCapability, price, expiresAt, verification{source,verifiedAt,method}`.
- `erc8183-job-evidence.ts` — `VerifiedFundedErc8183JobEvidence` requires `resource` + `executionCapability`; `validateVerifiedJob` rejects placeholder `"default"`/`"enabled"`.
- `erc8183-capability-provider.ts` — explicitly documents the ERC-8183 `Erc8183Job` schema exposes ONLY `id, client, provider, evaluator, description, budget, expiredAt, status, statusName, hook, submittedAt, deliverable` — **no `resource`, no `executionCapability`** — and resolves those two from an out-of-band `resolveCapabilityBinding` that defaults to `null`.
- `erc8183-capability-provider.server.ts` — production wiring exists but `signedQuoteReader` defaults to `null`; provider returns `null`; gate closed.

No new `ExecutionCapabilityProvider` implementation, adapter, or network client exists in the repo.

---

## 4. Existing Integration Findings

| Integration                           | Can it supply X.90 evidence?                          |
| ------------------------------------- | ----------------------------------------------------- |
| 8004scan (ERC-8004)                   | Identity/metadata only.                               |
| ERC-8183 (`@altananetwork/sdk@0.7.0`) | Commercial job state only; no capability fields.      |
| ALTANA skills (`skills.ts`)           | Self-declared skill catalog (`executable:false`).     |
| TERMiX                                | Read-only reputation; no capability.                  |
| x402                                  | Payment resource descriptor; not execution authority. |
| PancakeSwap                           | Read-only, unrelated to activation capability.        |
| BNB Agent SDK (`@bnbagent/sdk@0.5.1`) | Signed commercial quote; no resource/execCap.         |

---

## 5. 8004scan Finding

`Scan8004Agent` carries `agent_id, chain_id, owner_address, name, description, supported_protocols[], x402_supported, metrics`. `AgentEndpoint.capabilities[]` is a **self-declared, mutable, off-chain** string array (ERC-8004 `setAgentURI`). It is machine-readable but **not an authoritative execution-capability attestation**. Per the ERC-8004 rule, `capabilities[]` is treated as identity/trust metadata (LEVEL 1) only — never as execution authority.

---

## 6. ERC-8183 Finding (re-verified against installed version)

The installed `@altananetwork/sdk@0.7.0` `Erc8183Job` type (dist/erc8183.d.ts L41-55) is unchanged in capability semantics:

```
id, client, provider, evaluator, description, budget, expiredAt,
status, statusName, hook, submittedAt, deliverable
```

**No `resource`, no `executionCapability`.** The only new text vs X.86 is the `description`/`task` field comment noting _"the task text (Mode A) or an anchored signed-quote JSON (Mode B)"_. This is a **free-text convention**: the SDK exports **no `Quote` type, no negotiation module, and no signature-verification function** for Mode B. The signed quote would live inside an opaque `string` with no documented schema and no SDK-supported verification. Therefore ERC-8183 **still provides only commercial job semantics**, exactly as X.87/X.88 concluded. `description`/`task`/`deliverable_url` are explicitly NOT execution capability.

---

## 7. BNB Agent SDK Finding

The official `@bnbagent/sdk@0.5.1` (temp clone, not a project dependency) exposes a full signed-quote protocol (`NegotiationHandler`, `provider_sig` EIP-191/ERC-1271, `verifyQuoteSignature`). Its quote schema is `{version, negotiated_at, quote_expires_at, task, terms{deliverables,quality_standards,success_criteria?}, price, currency, negotiation_hash, provider_sig}`. Per the Signed-Quote rule: it establishes **provider identity, commercial terms, price, expiry, chain, Commerce binding, and funded-job verification** — but contains **no `resource`, no `executionCapability`, no `jobId`**. It therefore remains **insufficient** as a `VerifiedExecutionCapabilityProvider`.

---

## 8. TERMiX Finding

TERMiX integration is read-only reputation scoring. No resource, no execution capability, no attestation. NOT a capability source.

---

## 9. ALTANA Finding

`packages/integrations/src/altana/skills.ts` maps 8004scan agents to an `Altana8004scanAgentCapabilities` structure derived from the **Altana-certified skill catalog**. The catalog metadata is `executable:false` (verified in X.88) and self-declared; it is LEVEL 1 and not cryptographically bound to a funded job. NOT a capability source. ALTANA session/custody requires a signer and is not provisioned (X.75 BLOCKED).

---

## 10. x402 Finding

x402 (`@altananetwork/x402-server`) defines `X402Resource` = _"what the payment buys"_ — a transport-level payment descriptor (url/headers). It is the commercial payment surface, not an authoritative execution-capability attestation, and is not provider-attested execution authority. NOT a capability source.

---

## 11. Candidate Comparison Matrix

Classification legend: PASS / PARTIAL / BLOCKED / NOT PRESENT

| Source                 | Authority            | Identity Binding  | Resource                       | ExecCap                        | Authenticity      | Freshness         | Revocation              | Job Binding               | Provenance | X.90 Compat |
| ---------------------- | -------------------- | ----------------- | ------------------------------ | ------------------------------ | ----------------- | ----------------- | ----------------------- | ------------------------- | ---------- | ----------- |
| 8004scan               | SELF                 | agentId+owner     | NOT PRESENT                    | NOT PRESENT                    | none              | none              | none                    | none                      | none       | BLOCKED     |
| ERC-8183 job           | ONCHAIN (commercial) | client+provider   | NOT PRESENT (free-text only)   | NOT PRESENT                    | contract state    | expiredAt         | status (dispute/settle) | jobId present, but no cap | onchain    | BLOCKED     |
| BNB Agent SDK quote    | PROVIDER-signed      | provider sig      | NOT PRESENT                    | NOT PRESENT                    | EIP-191/1271      | quote_expires_at  | none                    | no jobId                  | signed     | BLOCKED     |
| X.85 SignedQuoteReader | —                    | would need source | schema yes, **NO DATA SOURCE** | schema yes, **NO DATA SOURCE** | would need source | would need source | none                    | would need source         | none       | BLOCKED     |
| TERMiX                 | NONE                 | none              | NOT PRESENT                    | NOT PRESENT                    | none              | none              | none                    | none                      | none       | BLOCKED     |
| ALTANA skills          | SELF                 | none              | NOT PRESENT                    | `executable:false`             | none              | none              | none                    | none                      | none       | BLOCKED     |
| x402                   | MERCHANT             | none              | payment URL only               | NOT PRESENT                    | payment sig       | payment TTL       | none                    | none                      | none       | BLOCKED     |
| PancakeSwap            | N/A                  | N/A               | N/A                            | N/A                            | N/A               | N/A               | N/A                     | N/A                       | N/A        | NOT PRESENT |

No candidate reaches X.90 compatibility. The closest (ERC-8183 job, BNB Agent SDK quote) are commercial/on-chain authorities but **lack resource + executionCapability entirely**.

---

## 12. X.90 Contract Mapping

Required field → available from existing source?

- exact agent identity → 8004scan/ERC-8004 ✅ (identity only)
- exact provider identity → ERC-8183 `provider` / SDK quote `provider_sig` ✅ (commercial)
- canonical resource → ❌ NONE
- canonical executionCapability → ❌ NONE
- authoritative capability↔agent/provider binding → ❌ NONE
- authenticity proof → ✅ (SDK quote sig) but over commercial terms only
- verification method → ❌ no capability verification method
- provenance → ❌ NONE for capability
- issuedAt/freshness → ⚠️ quote/job expiry exists, not capability-scoped
- expiresAt/freshness boundary → ⚠️ partial (job/quote), not capability
- revocation/status → ❌ no capability revocation
- job binding (if job-specific) → ⚠️ ERC-8183 job exists but lacks capability fields
- cryptographic/authoritative verification → ❌ no capability verification

**Two required fields (resource, executionCapability) are absent from EVERY existing source.** The contract cannot be satisfied.

---

## 13. Missing Evidence

- Canonical, integrity-protected `resource` bound to agent/provider.
- Canonical, machine-readable `executionCapability` (executable authority, not advertisement) bound to agent/provider.
- A verification method + provenance attesting specifically to capability (not commerce).
- A revocation/status mechanism for capability.
- (When job-specific) a job that actually carries `resource`+`executionCapability` — no such job exists (Agent 1816 / Job 515 not used; no jobs created).

---

## 14. Security / Trust Conclusion

Every existing source is LEVEL 0 (natural-language description/task/terms, deliverable info) or LEVEL 1 (self-declared `capabilities[]`, `x402_supported`, skill catalog, supported protocols, reputation, wallet signing permissions) or a commercial/on-chain job without capability fields. **None** reaches LEVEL 2+ for _execution capability_. The frozen boundary (Discovery ≠ Capability; ERC-8004 identity ≠ execution authority; ERC-8183 commercial quote ≠ execution capability; TERMiX/ALTANA-skill/x402 metadata ≠ execution authority) holds. Promotion of any LEVEL 0/1 signal into capability is forbidden.

---

## 15. Implementation Decision

**OUTCOME C — NO authoritative existing source.**

- No source satisfies the full X.90 contract.
- Do NOT create an adapter to fill the gap (explicitly forbidden by X.91).
- Do NOT modify the frozen boundary to accommodate a candidate.
- Activation remains BLOCKED.
- The exact external dependency (from X.90 §17) stands unchanged.

No implementation performed.

---

## 16. Test Results (STEP 5 — read-only, no code changed)

| Suite                                 | Result                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `activation:capability-source:verify` | 31/31 PASS                                                              |
| `activation:verify`                   | 33 passed, 0 failed                                                     |
| `activation:hire:verify`              | 23/23 PASS                                                              |
| `activation:hire-api:verify`          | 14 checks, 0 failed                                                     |
| `altana:session:verify`               | 25/25 PASS                                                              |
| `altana:session:api:verify`           | 72 checks, 0 failures                                                   |
| `security:x49:verify`                 | 25 checks, 0 failures                                                   |
| `security:x50:verify`                 | 34 checks, **1 failure (check-24, pre-existing, preserved/unmodified)** |

tsc: clean · lint: clean (no code changed). X.50 check-24 intentionally left failing per freeze rules.

---

## 17. Production Read-Only Results (STEP 6 — NO DEPLOYMENT)

- Marketplace homepage: **200** (healthy).
- `/api/auth/me`: **200** `{"ok":true,"data":null}` (no ambient session).
- Hire activation POST (unauthenticated): **403 Forbidden** — Hire remains unavailable without verified capability + auth.
- `/api/altana/session`: **405 Method Not Allowed** — session creation safely blocked; no ACTIVE session, no execution controls reachable.
- Security headers (`Cache-Control: no-store`, CSRF/Origin guards) intact.
- No fake ACTIVE session; production fail-closed confirmed.

---

## 18. Exact Next Dependency

> An authoritative external capability source capable of proving job/agent-bound `resource` + `executionCapability` with integrity, identity binding, freshness, provenance and revocation is required before real activation can proceed. (Unchanged from X.90 §17.)

Acceptable categories (still none verified/available):

1. Provider-signed capability attestation (LEVEL 2).
2. Authoritative capability registry (LEVEL 3).
3. Job-bound capability attestation (LEVEL 4).
4. Official protocol upgrade that introduces `resource`/`executionCapability` semantics into ERC-8183 or the BNB Agent SDK quote.

---

## 19. Final Classification

| Axis                 | Classification | Note                                                             |
| -------------------- | -------------- | ---------------------------------------------------------------- |
| CAPABILITY SOURCE    | **BLOCKED**    | No existing source satisfies the full X.90 contract.             |
| RESOURCE             | **BLOCKED**    | No existing source provides canonical resource.                  |
| EXECUTION CAPABILITY | **BLOCKED**    | No existing source provides canonical execCap.                   |
| AUTHENTICITY         | **PARTIAL**    | SDK quote signature exists but covers commercial terms only.     |
| IDENTITY BINDING     | **PARTIAL**    | ERC-8004/ERC-8183 identity binding exists, not capability-bound. |
| FRESHNESS            | **PARTIAL**    | Job/quote expiry exists, not capability-scoped.                  |
| REVOCATION           | **BLOCKED**    | No capability revocation mechanism.                              |
| JOB BINDING          | **PARTIAL**    | ERC-8183 job binding exists but lacks capability fields.         |
| X.90 COMPATIBILITY   | **BLOCKED**    | Two required fields (resource, execCap) absent everywhere.       |
| REAL ACTIVATION      | **BLOCKED**    | Requires capability source + custody; neither exists.            |
| **OVERALL X.91**     | **BLOCKED**    | No complete authoritative source proven.                         |

**X.91 is NOT PASS** — an interface exists (X.76) and signatures exist (SDK quote), but the _evidence itself_ does not satisfy X.90. OUTCOME C.

---

## Absolute Stop Boundary (reaffirmed for X.91)

AWS/KMS: NOT TOUCHED · ALTANA CUSTODY: NOT TOUCHED · TERMiX: READ-ONLY · PancakeSwap: NOT TOUCHED · MAINNET: NOT TOUCHED · AGENT 1816: NOT TOUCHED · JOB 515: NOT TOUCHED · ERC-8183 CREATION: NOT TOUCHED · ERC-8183 FUNDING: NOT TOUCHED · TRANSACTIONS: NONE · NEW INTEGRATION: NONE · DEPENDENCY CHANGE: NONE · CREDENTIALS: NONE · VERCEL: NO DEPLOYMENT · COMMIT: NO · PUSH: NO

**STOP AFTER X.91.**
