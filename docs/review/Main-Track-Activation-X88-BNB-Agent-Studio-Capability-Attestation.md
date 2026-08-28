# Main-Track Activation — X.88: BNB Agent Studio Authoritative Capability Attestation Investigation

> Status: **BLOCKED** (BNB Agent Studio / the official `@bnbagent/sdk` provides NO authoritative capability/service attestation mechanism. The only capability-shaped constructs are LEVEL 1 self-asserted metadata: ERC-8004 `AgentEndpoint.capabilities` (string list), ERC-8183 negotiation `terms` (free text), wallet "capability model" (signing permissions, a different concept), and the ALTANA skills catalog (`executable:false` metadata). No LEVEL 2/3/4 (provider-signed, platform-attested, or job-bound) capability source exists. `VerifiedExecutionCapability` remains BLOCKED. No speculative sources were invented.)
> Date: 2026-08-21
> Scope: Determine whether BNB Agent Studio itself offers an existing authoritative mechanism attesting `resource` + `executionCapability` bound to ERC-8004 agent + provider identity + specific service/operation with integrity and freshness. Source inspection only. No code added; no dependency upgrade; no deploy/commit/push.

---

## 1. X.87 Starting State

X.87 established:

- Official `@bnbagent/sdk@0.5.1` has an authoritative **signed ERC-8183 quote** (negotiation → EIP-191/ERC-1271 `provider_sig` → `JobFunded`-block verification).
- That quote attests **commercial terms + provider identity + job funding** — but contains **no `resource`** and **no `executionCapability`**.
- ERC-8004 `AgentEndpoint.capabilities` is mutable/self-asserted metadata.
- Upgrading `@altananetwork/sdk@0.7.0` → `@bnbagent/sdk` is a major architecture replacement (NOT performed).
- Blocker: `VERIFIED EXECUTION CAPABILITY = BLOCKED`.

X.88 asks: does **BNB Agent Studio** provide a _separate, authoritative_ capability/service attestation that would supply the missing `resource` + `executionCapability`?

## 2. Official Studio / SDK Sources Inspected

Cloned `bnb-chain/bnbagent-sdk` (read-only, temp dir — not in project). Inspected:

- `typescript/src/erc8183/{negotiation,quoteVerify,jobOps,schema,types,client,commerce,router,policy,config,constants}.ts`
- `typescript/src/erc8004/{agent,agentUri,models,contract,constants,index}.ts`
- `typescript/src/wallets/altana/*` and `wallets/twak/*` (capability references)
- `docs/{README,altana,twak}.md`
- `python/bnbagent/erc8004/{agent,agent_uri,models}.py`, `python/bnbagent/erc8183/{schema,client,job_ops}.py`, `python/bnbagent/wallets/*`
- `examples/*` (a2a-agent, agent-server, altana, client, security, smoke, voter, x402)

"Studio" appears in code only as the **agent-building framework/environment** (e.g. `direct_code_deploy` studio default, studio's `fetch_with_payment` buyer, studio-style seller). There is **no `studio.toml`, no Studio capability API, no Studio attestation service** in the repository. The SDK is the library Studio agents are built on; the capability question must therefore be answered from the SDK's data models.

## 3. Candidate Capability Schemas

| Source                                  | Shape                                                           | Authority                     | Signer                | Integrity                                      | Mutable?                 | Expiry?        | Revocation?           | Agent binding          | Provider binding       | Job binding                                                            |
| --------------------------------------- | --------------------------------------------------------------- | ----------------------------- | --------------------- | ---------------------------------------------- | ------------------------ | -------------- | --------------------- | ---------------------- | ---------------------- | ---------------------------------------------------------------------- |
| ERC-8004 `AgentEndpoint.capabilities`   | `string[]` per endpoint                                         | self-asserted                 | none                  | hash of registration file (not per-capability) | YES (via `setAgentURI`)  | NO             | NO (owner can change) | loose (endpoint→agent) | NO                     | NO                                                                     |
| ERC-8183 negotiation `terms`            | `{deliverables, quality_standards, success_criteria}` free text | provider-signed (whole quote) | provider              | quote signature                                | after funding            | quote window   | n/a                   | NO                     | YES (signer==provider) | NO (no jobId in quote)                                                 |
| Wallet "capability model" (Altana/TWAK) | `sign.message`, `sign.transaction`, `x402.pay`, `quote.sign`    | wallet/account                | account key           | session/checker                                | session-scoped           | session-scoped | revocable session     | account only           | account                | NO                                                                     |
| ALTANA skills catalog (`skills.ts`)     | skill entries w/ `executable:false`                             | self-asserted catalog         | none                  | off-chain JSON                                 | YES                      | NO             | NO                    | by agent id            | NO                     | NO                                                                     |
| ERC-8183 `DeliverableManifest`          | delivery `content` + hash                                       | provider (at submit)          | provider (submit sig) | keccak manifest hash                           | immutable once submitted | n/a (post-hoc) | n/a                   | NO                     | YES                    | YES (jobId in manifest) — but it is the **delivery**, not a capability |

**No candidate provides a structured, authenticated declaration of "this agent is authorized/capable of executing operation X" bound to agent + provider + operation + job.**

## 4. Authority Analysis (STEP 3 hierarchy)

- **LEVEL 0 (natural language):** negotiation `task` text, `deliverables`/`quality_standards`/`success_criteria` (free text), agent `description`. → NOT AUTHORITATIVE.
- **LEVEL 1 (self-declared metadata):** `AgentEndpoint.capabilities` string list, ALTANA skills catalog (`executable:false`), wallet capability model (signing permissions, a _different_ concept from execution capability). → DESCRIPTIVE ONLY.
- **LEVEL 2 (provider-signed capability):** The ERC-8183 quote is provider-signed, but it signs **commercial terms**, not a capability declaration. There is **no signed `executionCapability` field** to evaluate at this level.
- **LEVEL 3 (platform/registry-attested):** No such attestation exists. ERC-8004 registration (`setAgentURI`) stores the file verbatim; the registry does not verify or attest capabilities.
- **LEVEL 4 (cryptographically/job-bound):** `DeliverableManifest` is job-bound and hash-verified, but it attests the **delivery content**, not an execution capability. No job-bound capability attestation exists.

**No candidate reaches LEVEL 2+ for `executionCapability`.** (The quote's provider signature is LEVEL 2 for _commercial terms_ — already concluded in X.87 — but does not extend to capability.)

## 5. Resource Semantics

- A structured resource definition (service endpoint / operation / tool / API route / skill identifier) is **not** defined as an attested capability anywhere.
- `AgentEndpoint.endpoint` is a URL locator, but it is **advertised**, not signed per-resource, not bound to a specific operation, not expiry/revocation-managed, and mutable via `setAgentURI`. Per STEP 5, a generic endpoint URL is **not** mapped to `resource` unless the protocol defines that meaning — it does not.
- The ERC-8183 quote's `task`/`terms` are free text, not a resource identifier.
- → RESOURCE = BLOCKED (no authoritative structured resource).

## 6. Execution Capability Semantics

- There is **no machine-readable declaration** meaning "this agent is authorized/capable of executing operation X" that is attested by any authority.
- `AgentEndpoint.capabilities` is advertisement (`["A2A","MCP", ...]` protocol/feature tags), not execution authority.
- The wallet "capability model" grants the _wallet_ permission to sign certain message/transaction/x402/quote types — this is **signing authority**, orthogonal to "agent can perform operation X." It is not an execution-capability attestation for the marketplace's `VerifiedExecutionCapability`.
- → EXECUTION CAPABILITY = BLOCKED.

## 7. ERC-8004 Identity Binding

- `AgentEndpoint` entries live inside a registration file published at the agent's `agentURI`; the file is generated by `AgentURIGenerator` and stored via `setAgentURI`. The binding "this endpoint belongs to agent X" is established only because the owner _says so_ in the file. The registry performs **no verification** of endpoint ownership, capability truthfulness, or resource authority.
- The relationship is therefore "the endpoint says this is agent X" — explicitly insufficient per STEP 4.
- → ERC-8004 BINDING = PARTIAL (identity linkage is self-asserted, not cryptographically/registrar-verified for capabilities).

## 8. Freshness / Revocation

- `AgentEndpoint.capabilities` and the ALTANA skills catalog have **no expiry and no revocation** mechanism at the capability level (mutable only by re-`setAgentURI`).
- The ERC-8183 quote has freshness (`quote_expires_at`) but, again, covers commercial terms only.
- → FRESHNESS = BLOCKED (for capability); REVOCATION = BLOCKED (for capability).

## 9. Repository Reconciliation

Searched `packages/integrations/src` and `apps/web/lib` for any Studio capability consumer:

- `packages/integrations/src/altana/skills.ts` — ALTANA "certified-skills" adapter; per prior X.82/X.83 the catalog is `executable:false` **metadata**, never promoted to execution authority. No `VerifiedExecutionCapability` is produced.
- `packages/integrations/src/altana/marketplace.ts` — `resourceUrl` is a **marketplace-side configuration** (e.g. x402 testnet fixture URL), not an authoritative agent capability attestation.
- No code consumes a Studio capability source; X.80–X.85 remain the only capability path, all failing closed without an authoritative source.

## 10. Security Boundary

Feeding any LEVEL-0/1 Studio metadata into `VerifiedExecutionCapability` would **weaken** the contract (accept task text / self-asserted `capabilities` / catalog metadata as authority) — explicitly forbidden by STEP 8 and the X.76 security contract. Therefore:

- No modification to `VerifiedExecutionCapability`, `capability-source.ts`, `erc8183-capability-provider.*`, `session-gate.ts`, `hire.*` is justified.
- Fail-closed behavior, identity/owner/CSRF/SIWE/consent/custody/revoke semantics remain intact.
- Absolute boundaries honored: no AWS/KMS, no ALTANA custody, TERMiX read-only, PancakeSwap untouched, mainnet untouched, Agent 1816 / Job 515 untouched, no ERC-8183 creation/funding, no transactions, no dependency upgrade, no deploy, no commit, no push.

## 11. Implementation Changes

**NONE.** Per STEP 9, the gating condition (existing authoritative Studio source with structured, authenticated, identity-bound resource + execution-capability semantics) is **not met**. No adapter, no integration, no verifier was added. Only this report.

## 12. Tests

No code changed → regression verification only (offline verifiers; identical green baseline to X.87):

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

`typecheck` → exit 0 (clean). `lint` → exit 0 (clean).

## 13. Production Read-Only Results

**NO DEPLOYMENT.** Only X.88 docs/report added. Prior production state holds:

- `/` → 200, `/agents` → 200, `/api/auth/me` → 200.
- `POST /api/activation/hire` → 403 Forbidden (fail-closed).
- `/api/altana/session` → 503 (no custody).
- No fake ACTIVE; no execution controls; unavailable agents remain unavailable; security headers intact; no custody; no transaction.

## 14. Final Classification

| Dimension                     | Result      | Note                                                                                        |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| STUDIO CAPABILITY SOURCE      | **BLOCKED** | No authoritative capability/service attestation exists in Studio or the SDK.                |
| AUTHORITY                     | **BLOCKED** | Only LEVEL 0/1 (natural language, self-asserted metadata). No LEVEL 2/3/4.                  |
| RESOURCE                      | **BLOCKED** | No structured, attested resource definition; endpoint URLs are mutable advertisement.       |
| EXECUTION CAPABILITY          | **BLOCKED** | No machine-readable, attested "capable of operation X" declaration.                         |
| ERC-8004 BINDING              | **PARTIAL** | Identity linkage is self-asserted via `setAgentURI`; registry does not verify capabilities. |
| FRESHNESS                     | **BLOCKED** | No capability-level expiry for any candidate.                                               |
| REVOCATION                    | **BLOCKED** | No capability-level revocation (only `setAgentURI` mutation).                               |
| VERIFIED EXECUTION CAPABILITY | **BLOCKED** | Cannot be produced without an authoritative `resource` + `executionCapability` source.      |
| REAL ACTIVATION               | **BLOCKED** | No funding, no signing, no custody, no real job.                                            |
| **OVERALL X.88**              | **BLOCKED** | BNB Agent Studio does not provide authoritative capability attestation.                     |

### Conclusive statement

**BNB Agent Studio / the official BNB Agent SDK does NOT provide an authoritative capability/service attestation mechanism.** Its capability-shaped data is entirely LEVEL 0/1 (free-text task descriptions, self-asserted `AgentEndpoint.capabilities` string lists, an `executable:false` skills catalog, and wallet _signing_ permissions that are a different concept). None is cryptographically or registrar-attested, none is bound to a specific operation with integrity/freshness, and none yields `resource` or `executionCapability` for `VerifiedExecutionCapability`. Per the instruction to stop searching speculative sources once Studio is conclusively shown deficient, **the investigation terminates here.**

This does not contradict X.87: the authoritative **signed quote** remains a real LEVEL-2 mechanism for _commercial_ terms, but it is not a capability attestation. The capability-source blocker therefore remains **permanent** unless an external authoritative capability source is introduced (e.g. a capability registry the provider signs and the marketplace verifies, or an extension of the quote schema to include signed `resource`/`executionCapability`).

## 15. Exact Next Dependency

To unblock `VERIFIED EXECUTION CAPABILITY`, one of the following must be introduced (none exist in Studio today, all outside X.88's no-change boundaries):

1. **A provider-signed capability attestation** — an extension of the ERC-8183 quote (or a companion signed document) that includes `resource` + `executionCapability` fields signed by the provider and verified (with job/agent/provider binding + expiry/revocation), reaching at least LEVEL 2 and ideally LEVEL 4.
2. **A platform/registry-attested capability registry** (LEVEL 3) that binds verified capabilities to ERC-8004 agent identity.
3. **Custody provisioning** (AWS KMS + ALTANA admin signer) so `custodyAvailable` can become `true` — independent of, but required alongside, the capability source.

Until #1 or #2 exists, real activation remains BLOCKED.

---

### Absolute boundaries honored

AWS/KMS NOT touched · ALTANA custody NOT touched · TERMiX read-only · PancakeSwap NOT touched · mainnet NOT touched · Agent 1816 NOT touched · Job 515 NOT touched · ERC-8183 job creation NOT touched · ERC-8183 funding NOT touched · transactions NONE · dependency upgrades NONE · Vercel NO deployment · commit NO · push NO.
