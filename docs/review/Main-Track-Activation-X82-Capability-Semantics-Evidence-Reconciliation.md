# Main-Track Activation — X.82: Capability Semantics / Existing Evidence Reconciliation

> Status: **BLOCKED — EXTERNAL AUTHORITATIVE CAPABILITY ATTESTATION REQUIRED** (OUTCOME B)
> Date: 2026-08-21
> Scope: Determine whether the existing repository/ecosystem already supplies `resource` and `executionCapability` for a specific ERC-8183 job/agent relationship. This is a reconciliation/research milestone. **No code was changed, no new provider added.**
> Per the most important rule: the correct result when no authoritative source exists is BLOCKED. That is a successful finding.

---

## 1. X.81 Starting State

X.81 implemented a read-only `ExecutionCapabilityProvider` that verifies an existing ERC-8183 job (identity, status, funding, expiry) on-chain. It classified:

- `CAPABILITY VERIFICATION = PARTIAL`
- `resource = missing`
- `executionCapability = missing`

because the authoritative `Erc8183Job` SDK type exposes only:
`id, client, provider, evaluator, description, budget, expiredAt, status, statusName, hook, submittedAt, deliverable` — **no `resource`, no `executionCapability`**.

The provider therefore requires a trusted out-of-band binding (`resolveCapabilityBinding`) for those two fields; the production wiring defaults it to `null`, so the provider returns `null`. X.82 asks: does the repository ALREADY contain an authoritative source for those two fields? If not, document the dependency and STOP.

## 2. Required `resource` Semantics

Per the X.76 `VerifiedExecutionCapability` / X.80 `VerifiedFundedErc8183JobEvidence` contracts, `resource` is the **protected, machine-readable resource/endpoint the agent is authorized to act upon** (e.g., the x402-protected service URL), bound to the exact agent AND the exact job, with integrity protection and freshness/revocation. A field must mean "this exact operation target," not a description, tag, or free-text task.

## 3. Required `executionCapability` Semantics

`executionCapability` is the **explicit, authorized operation** the agent may perform (the contract accepts e.g. `"erc8183-hire"` and rejects the placeholder `"enabled"`). It must be bound to the exact agent AND the exact job, authoritative, integrity-protected, and fresh/revocable. A boolean flag, protocol name, or natural-language description is NOT execution authorization.

## 4. Repository Evidence Search

Searched the entire repository (code, integrations, Prisma, docs) for `resource`, `executionCapability`, `capability`, `executable`, `skill`, `endpoint`, `serviceUrl`, `deliverable`, `operation`, `action`, `constraints`, `metadata`. Candidate sources examined: 8004scan, ERC-8004, ERC-8183, Agent Studio metadata, TERMiX, ALTANA skills, existing adapters, Prisma.

## 5. 8004scan Evidence

`Scan8004Agent` (`apps/web/lib/eight004scan/types.ts`) carries identity + descriptive metadata only: `agent_id, owner_address, name, description, supported_protocols[], x402_supported, reputation`. It exposes **no `resource`, no `executionCapability`**. This is exactly the X.76 finding. `x402_supported` is a payment-rail boolean, not execution authorization. `supported_protocols` (MCP/A2A/OASF/Web/Email) describe reachability, not capability. **INSUFFICIENT.**

## 6. ERC-8004 Evidence

ERC-8004 is the identity registry: `owner_address`, `contract_address`, `token_id`, `chain_id`. It establishes WHO an agent is, not WHAT it may execute. No `resource`/`executionCapability`. Identity is provable; capability is not. **INSUFFICIENT for capability.**

## 7. ERC-8183 Evidence

The `Erc8183Job` schema (confirmed in `node_modules/.../@altananetwork/sdk/dist/erc8183.d.ts`) has no `resource`/`executionCapability`:

- `description` — free task text (natural language; not machine-readable execution semantics).
- `deliverable` — a 32-byte zero hash until submission; the post-submission `deliverable_url` is **untrusted output data** (the integration re-validates it as an http(s) URL and never executes it). It is a result, not an authorized resource/operation, and only exists after submission.
- `evaluator`/`hook` — kernel contract addresses, not capability declarations.

Protocol capability (ERC-8183 _can_ carry a description) is distinct from **currently available project evidence** (the project does not populate/verify any machine-readable capability field). **INSUFFICIENT.**

## 8. Agent Studio Evidence

The only "Agent Studio" metadata surfaced in-repo is the canonical metadata-URI / service-endpoint constants used by the out-of-scope `erc8183.job515.*` verify scripts for **Agent 1816 (mainnet) / Job 515** — explicitly outside this task's boundaries ("do not touch Agent 1816 / Job 515"). Even there, the metadata URI declares a descriptive service endpoint, not an execution-authority attestation bound to a general job. No generalizable, authoritative Agent Studio capability declaration exists. **INSUFFICIENT / OUT OF SCOPE.**

## 9. TERMiX Evidence

`packages/integrations/src/termix/` provides `TermixReputation` (score, anomalies, `source: "termix-aacp"`), read-only, with `mapErc8004ToTermixAgentId` for identity mapping. It is **reputation/trust research data** — no `resource`, no `executionCapability`. Per X.74, TERMiX production read-only integration = PASS, experiment = PARTIAL; neither constitutes executable capability. **INSUFFICIENT.**

## 10. Existing Integration Evidence

- **ALTANA skills (`packages/integrations/src/altana/skills.ts`)** — the closest candidate. It is a _static catalog_ of 7 certified skills with `executable: false` (always; `assertAltanaSkillsNonExecutable` always throws), `source: "Altana certified skill"`, no `resource` field, no `executionCapability` field, and **no job binding**. `AgentCapabilitySet` (agent→skill) is caller-supplied and validated; `map8004scanAgentCapabilities` maps only via exact `supported_protocols` equality (which never matches a skill id), so agents map to `skills: []`. It is **not wired into `apps/web` at all** (grep: zero usages in `apps/web`). It is capability _metadata_, not execution authority, and fails the trust boundary (no job binding, not integrity-protected against the agent, not fresh/revocable per agent/job).
- **x402** — `resourceUrl` appears only inside a hypothetical `AgentActivationCapability` that `resolveAgentActivationCapability` returns `null` for every real record (`capability.ts`). Not an existing authoritative source.
- **PancakeSwap / other adapters** — read-only data; no per-agent execution-capability attestation.
- **Prisma** — no capability/resource model; only `AltanaSession`/`SessionPermission` (session lifecycle) and `AuditEvent` (`resourceType`/`resourceId` = audit routing, not capability declaration).

## 11. Evidence Matrix

| Source        | Resource                              | Execution Capability      | Agent Binding       | Job Binding | Authority              | Freshness                | Trust Level                        |
| ------------- | ------------------------------------- | ------------------------- | ------------------- | ----------- | ---------------------- | ------------------------ | ---------------------------------- |
| 8004scan      | none                                  | none                      | identity only       | none        | registry (identity)    | n/a                      | discovery metadata                 |
| ERC-8004      | none                                  | none                      | identity only       | none        | registry (identity)    | n/a                      | identity                           |
| ERC-8183 job  | none (desc = text)                    | none (status≠capability)  | provider=owner (id) | job id (id) | on-chain (job)         | on-chain (expiry/status) | job state, NOT capability          |
| Agent Studio  | descriptive endpoint (1816 only, OOS) | none                      | identity only       | none (OOS)  | registry (descriptive) | static                   | descriptive metadata               |
| TERMiX        | none                                  | none                      | rep. only           | none        | termix-aacp (rep)      | API                      | research/reputation                |
| ALTANA skills | none                                  | none (`executable:false`) | caller-supplied set | none        | catalog (static)       | static                   | capability metadata, NOT execution |
| Existing x402 | in null-capability only               | none                      | n/a                 | n/a         | none (resolver null)   | n/a                      | absent                             |

No cell provides authoritative, job-bound `resource` + `executionCapability`.

## 12. Trust-Boundary Analysis

For each candidate evidence source, applied to the X.82 §9 questions:

- **Identity** — provable for an agent via 8004scan `owner_address` ↔ ERC-8004. ✓ achievable, but identity ≠ capability.
- **Job binding** — only ERC-8183 provides a real job id; but it binds no capability to that job. ✗
- **Authority** — no source attests `resource`/`executionCapability` for an agent/job. ✗
- **Integrity** — 8004scan desc/protocols and ALTANA skills are mutable/static catalog; an agent or operator can change registry metadata without detection. ✗
- **Freshness/revocation** — no per-agent/per-job revocation of any supposed capability exists. ✗
- **Semantics** — description/protocol/flag/reputation mean "descriptive," not "executable." ✗
- **Scope** — nothing authorizes the exact operation/resource requested. ✗

Every required property for activation capability is absent. Existing evidence is **DISCOVERY DATA**, not **VERIFIED EXECUTION CAPABILITY**.

## 13. Implementation Changes

**NONE.** This is OUTCOME B. No new provider, no new integration, no contract weakening, no production behavior change. The X.80/X.81 code and the fail-closed route are untouched. The X.81 `resolveCapabilityBinding` correctly remains the (null) extension point for a future trusted source.

## 14. Test Results

No code changed ⇒ no new tests. Ran the existing suite to prove no regression (all green):

- `activation:x81:verify` — ALL CHECKS PASSED (45/45)
- `activation:x80:verify` — ALL CHECKS PASSED
- `activation:capability-source:verify` (X.76) — ALL CHECKS PASSED
- `activation:hire:verify` — 23/23
- `activation:hire-api:verify` — 14/14
- `altana:session:verify` — 25/25
- `altana:session:api:verify` — 72/72
- `security:x49:verify` — 25/25
- `activation:verify` — 33/33
- `typecheck` / `lint` / `build` — exit 0

X.50 `check-24` untouched.

## 15. Production Read-Only Results (no deploy/commit/push)

- `/` → **200**, `/agents` → **200** (healthy marketplace + agent details).
- `/api/auth/me` → **200** (honest auth state).
- `POST /api/activation/hire` → **403 Forbidden** (fail-closed; unsupported agents remain unavailable; no fake `ACTIVE`).
- `/api/altana/session` → **503** (no custody; unchanged).
- No execution control appeared; security headers intact. No production job manufactured.

## 16. Final Classification

| Dimension                   | Result      | Note                                                                                                                         |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| RESOURCE SOURCE             | **BLOCKED** | No existing source carries an authoritative, job-bound resource.                                                             |
| EXECUTION CAPABILITY SOURCE | **BLOCKED** | No existing source carries an authoritative, job-bound execution capability (ALTANA skills are `executable:false` metadata). |
| AGENT BINDING               | **BLOCKED** | Agent identity is provable (8004scan/ERC-8004) but NO capability is authoritatively bound to the agent.                      |
| JOB BINDING                 | **BLOCKED** | No source binds capability to an exact ERC-8183 job.                                                                         |
| AUTHORITY                   | **BLOCKED** | No attester of `resource`/`executionCapability` for agent/job exists in-repo.                                                |
| FRESHNESS/REVOCATION        | **BLOCKED** | No per-agent/per-job revocation of capability evidence exists.                                                               |
| CAPABILITY RESOLUTION       | **BLOCKED** | X.80/81 gate stays `no-capability`/`unverified`; the two required fields are absent.                                         |
| REAL ACTIVATION             | **BLOCKED** | No funding, no custody, no capability evidence.                                                                              |
| **OVERALL X.82**            | **BLOCKED** | External authoritative capability attestation required.                                                                      |

## 17. Exact Next Dependency

To move from BLOCKED → a verifiable capability, an **external authoritative source** must be supplied that attests, for the exact ERC-8004 agent AND the exact ERC-8183 job:

- `resource` — the protected resource/endpoint the agent may act upon; and
- `executionCapability` — the explicit authorized operation;

with ALL of:

1. **Agent binding** — cryptographically/authoritatively tied to the exact `{chainId}:{contract}:{tokenId}` identity (e.g., via the job's `provider` = registry owner, already verified by X.81).
2. **Job binding** — tied to the exact ERC-8183 `jobId` (the job is the authorization instrument).
3. **Authority** — attested by a source the marketplace trusts (not the agent/operator/user), e.g. a signed job manifest, an on-chain job `resource`/`capability` field, or a verified marketplace catalog mapping.
4. **Integrity** — tamper-evident (signature or on-chain), so the agent/operator cannot alter it undetected.
5. **Freshness/revocation** — expires or is revocable with the job (job `expiredAt`/status already provides this for a job-bound field).
6. **Semantics** — explicitly "executable capability," not descriptive metadata.

This source must be plugged into the existing X.81 `resolveCapabilityBinding` extension point (no new provider needed if it composes with the read-only reader). Until it exists, the marketplace MUST remain fail-closed: no `resource`/`executionCapability` ⇒ no `VerifiedExecutionCapability` ⇒ no activation.

### DISCOVERY DATA vs VERIFIED EXECUTION CAPABILITY

- **DISCOVERY DATA (present, NOT sufficient):** 8004scan listing, ERC-8004 identity, ERC-8183 job existence/budget/expiry/description, TERMiX reputation, ALTANA skill catalog (`executable:false`), x402 flag, Agent Studio descriptive metadata.
- **VERIFIED EXECUTION CAPABILITY (absent):** an authoritative, job-bound, integrity-protected, fresh attestation of `resource` + `executionCapability`. Does not exist in this repository.

The missing fields remain exactly: **`resource`** and **`executionCapability`**.
