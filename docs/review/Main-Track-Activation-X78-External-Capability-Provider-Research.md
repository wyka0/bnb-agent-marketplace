# Main-Track Activation — X.78: External Verified Execution-Capability Provider Research

**Date:** 2026-08-21
**Milestone:** X.78 (Main-Track Activation, step 78)
**Status:** COMPLETE — classification **PARTIAL** (legitimate conditional source identified; no passive registry; implementation out of scope)
**Scope:** Research + architecture only. No implementation, no infrastructure, no credentials, no production modification, no AWS/KMS, no ALTANA custody, no blockchain transactions, no deploy/commit/push.
**Prerequisite context:** X.75 (READINESS PASS / ACTIVATION BLOCKED), X.76 (PROVIDER BOUNDARY IDENTIFIED), X.77 (BLOCKED / NOT FOUND — no in-repo provider).

---

## 1. X.77 Starting State

- No authoritative execution-capability provider exists **in the repository**.
- 8004scan = identity/metadata only; no job registry; no capability registry; no attestation; no Agent/Job/Capability/Attestation Prisma models; ALTANA integration metadata-only; ERC-8183/Job-515 read-only.
- `resolveExecutionCapability()` correctly returns `null`. Production healthy.
- `apps/web/lib/activation/capability-source.ts` defines the `ExecutionCapabilityProvider` interface and `VerifiedExecutionCapability` contract; resolver returns `null` without a provider.

---

## 2. Existing Capability Contract (starting point)

`VerifiedExecutionCapability` requires, with no placeholders (enforced by `verifyExecutionCapability`):

- `agentId` — exact ERC-8004 agent identity
- `jobId` — real, immutable execution identifier
- `resource` — protocol/endpoint/environment involved
- `executionCapability` — explicit attested operation kind (not `"enabled"`)
- `price` — authoritative, positive numeric
- `expiresAt` — authoritative expiry timestamp
- `verification.source` / `verification.method` / `verification.verifiedAt` — authoritative origin + explicit method

Plus non-functional requirements: identity binding, freshness, expiry validation, authenticity, tamper resistance, authoritative provenance. These were **not** weakened to fit any candidate.

---

## 3. Candidate External Sources Investigated

| #   | Candidate                                          | Type                                   | Official owner                                                  |
| --- | -------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| A   | ERC-8004 Identity/Reputation/Validation Registries | On-chain registry standard             | BNB Chain / Ethereum (EIP-8004, `bnb-chain/erc-8004-contracts`) |
| B   | ERC-8183 Agentic Commerce (APEX)                   | On-chain job/escrow protocol           | BNB Chain (`bnb-chain/bnbagent-sdk`)                            |
| C   | BNBAgent SDK / BNB Agent Studio                    | Dev toolkit / scaffolding              | BNB Chain                                                       |
| D   | Altana Keystore + Sessions                         | Non-custodial authorization infra      | Altana Network                                                  |
| E   | Altana Skills Registry                             | Certified protocol know-how (metadata) | Altana Network                                                  |
| F   | 8004scan / Agent0 SDK                              | Explorer / subgraph indexer            | BNB Chain ecosystem                                             |

---

## 4. Source-by-Source Evaluation

### A. ERC-8004 (Identity / Reputation / Validation)

- **Official ownership:** BNB Chain + Ethereum EIP-8004; reference impl `bnb-chain/erc-8004-contracts`.
- **Exact interface:** Identity Registry (ERC-721, `register`/`setAgentURI`/`agentURI`), Reputation Registry (`giveFeedback`/`getSummary`), Validation Registry (`validationRequest`/`validationResponse`).
- **Identifies exact agent?** YES (on-chain `agentId` NFT + `agentURI` registration file).
- **Identifies exact executable job?** NO. Registration file lists `services`/endpoints and a natural-language `description`; it does **not** define an executable job with price/resource/expiry.
- **Proves what the job can execute?** NO. Spec explicitly: _"this ERC cryptographically ensures the registration file corresponds to the on-chain agent, but cannot cryptographically guarantee that advertised capabilities are functional and non-malicious."_
- **Supplies resource?** NO (only service endpoints).
- **Supplies price?** NO.
- **Supplies expiry?** NO.
- **Authenticity / integrity:** on-chain registry (tamper-resistant), but only attests _identity + trust signals_, not execution capability.
- **Freshness / revocation:** Reputation has `isRevoked`; Validation responses are point-in-time.
- **Production-ready?** YES (live on BSC 56 + testnet 97).
- **Credentials / new integration?** Read-only reads need only RPC.
- **Conclusion:** **INSUFFICIENT** for the X.76 contract. Discovery/trust only.

### B. ERC-8183 (Agentic Commerce / APEX) — STRONGEST CANDIDATE

- **Official ownership:** BNB Chain; reference impl `bnb-chain/bnbagent-sdk` (`erc8183` module: `AgenticCommerce` kernel + `EvaluatorRouter` + `OptimisticPolicy`).
- **Exact interface:** `createJob(provider, router, expiredAt, description)`, `registerJob`, `setBudget`, `fund`, `submit`, `settle`, `dispute`, `voteReject`, `claimRefund`. Job object: `jobId`, `description`, `budget`, `client`, `provider`, `evaluator`, `status`, `expiredAt`, `hook`.
- **Identifies exact agent?** YES — `job.provider` is the agent address/identity (bindable to ERC-8004 `agentId`).
- **Identifies exact executable job?** YES — a funded job is a concrete, immutable unit of work with an on-chain `jobId`.
- **Proves what the job can execute?** PARTIAL — the `description` + the provider's ERC-8183 service endpoint (from ERC-8004 registration) define the operation; `executionCapability` is _derived_ from these, not a native enum. Acceptable to derive from the funded job + service manifest.
- **Supplies resource?** PARTIAL — the resource (protocol/environment) is the provider's ERC-8183 service endpoint + `description`; discoverable via ERC-8004 registration file `services`.
- **Supplies price?** YES — `budget` is authoritative, on-chain, escrowed.
- **Supplies expiry?** YES — `expiredAt` is authoritative, on-chain.
- **Authenticity:** on-chain contract state; verifiable via `contract_call_view` / Multicall3. Tamper-resistant.
- **Integrity:** escrow + optimistic settlement (dispute window, voter quorum).
- **Freshness:** `expiredAt` + `status` (FUNDED/SUBMITTED/COMPLETED/REJECTED/EXPIRED). Stale capability detectable (expiry elapsed or settled).
- **Revocation:** `dispute` → `voteReject` → REJECTED; `claimRefund` after `expiredAt`; settlement is permissionless. A job's capability is inherently consumed/revocable.
- **Production-ready?** YES — live on BSC mainnet + testnet 97; BNBAgent SDK client exists.
- **Credentials / new integration?** **Reads need only RPC.** However, to _produce_ a capability for a marketplace hire, the marketplace must **create + fund** a job (a write) — which is exactly the Hire step. Thus ERC-8183 is not a passive registry; it is the mechanism the marketplace itself drives during hire.
- **Conclusion:** **PASS (conditional)** — the only legitimate authoritative source of `jobId` + price + expiry + identity binding + verifiability + revocation. Requires the marketplace to fund the job as part of hire (write path), so it is not a pre-existing passive registry.

### C. BNBAgent SDK / BNB Agent Studio

- Toolkit that _bundles_ ERC-8004 + ERC-8183 + x402 + Greenfield. The Studio seller architecture runs a keyless `8183-service` with fixed action envelopes (`quote`/`fulfill`/`settle`); the Agent is the sole signer.
- It is **tooling**, not an authoritative registry. The authoritative evidence it produces is the on-chain ERC-8183 job state (covered in B) plus ERC-8004 identity (covered in A).
- **Conclusion:** INSUFFICIENT as a standalone source; it _operationalizes_ B+A.

### D. Altana Keystore + Sessions

- Non-custodial **authorization** infrastructure: on-chain Keystore records who may act on a wallet, scoped by allowed contracts (`calls`), spend caps (`spend`), and `expiry`; session keys; instant revocation (`isValidKey` = exists AND not revoked AND not expired).
- It answers _"is this agent authorized to spend from this wallet within these limits?"_ — **not** _"is this agent executable / what job can it do?"_
- No `jobId`, no per-job `price`/`resource` in the marketplace sense; it is a complementary custody/authorization layer (X.75 already marks ALTANA custody BLOCKED — KMS not provisioned).
- **Conclusion:** INSUFFICIENT as the capability source (complementary authorization only).

### E. Altana Skills Registry (`skills.altana.network`, `altananetwork/skills`)

- Certified **protocol know-how** (fork-tested SKILL.md plays). Capability **metadata**, not execution attestation. `index.json` lists id/description/scope/version/hash.
- **Conclusion:** INSUFFICIENT (metadata only) — same class as the marketplace's own `skills.ts`.

### F. 8004scan / Agent0 SDK

- 8004scan = ERC-8004 explorer (identity, reputation, validation metadata). Agent0 = multi-chain subgraph indexer (discovery/reputation/validation GraphQL).
- Both expose **no** price/resource/jobId/expiry/executionCapability.
- **Conclusion:** INSUFFICIENT (discovery/metadata only) — confirmed by X.77.

---

## 5. ERC-8004 / ERC-8183 Findings

- ERC-8004 = **who the agent is** (identity + trust signals). Not execution authorization.
- ERC-8183 = **how agents hire and pay** (job lifecycle + escrow + evaluator). Produces the real execution artifact (a funded job).
- The BNB Chain AI-agent stack explicitly splits these: _"ERC-8004 establishes who the agent is; ERC-8183 governs how agents hire and pay each other."_
- **Decision:** The execution-capability evidence must be rooted in **ERC-8183 job state**, with **ERC-8004 identity** providing the agent binding. ERC-8004 alone cannot satisfy the contract.

---

## 6. BNB Agent Studio Findings

- Studio is scaffolding over BNBAgent SDK; it does not introduce a capability registry. Its seller flow _creates_ ERC-8183 jobs — reinforcing that the funded job is the capability artifact.
- Not an authoritative external registry to read from; its value is operationalizing B+A.

---

## 7. Altana Findings

- Authorization/custody layer (Keystore sessions), not an execution-capability provider.
- Complementary: once a real capability exists (from ERC-8183), Altana can scope _how_ the agent may act on a wallet — but it does not attest _that_ the agent is executable.
- ALTANA custody remains BLOCKED (X.75): `ALTANA_KMS_KEY_ID` unconfigured.

---

## 8. Job / Attestation Findings

- **On-chain job (ERC-8183)** is the only artifact that satisfies jobId + price + expiry + identity + verifiability + revocation.
- ERC-8004 **Validation Registry** can record post-hoc validation of completed work (stake re-execution / zkML / TEE oracle, response 0–100) but: (a) it is _under active update/discussion with the TEE community_; (b) it validates completed work, not pre-authorizes execution; (c) it carries no price/resource/expiry. Not a substitute for the job-derived capability.
- No standalone "execution capability attestation registry" exists in the ecosystem.

---

## 9. Cryptographic Trust Analysis

| Requirement          | ERC-8183 job state        | ERC-8004 identity     | Altana session        |
| -------------------- | ------------------------- | --------------------- | --------------------- |
| Identity binding     | job.provider == agent     | agentId NFT           | wallet authorization  |
| Capability attested  | job.description + service | no                    | scope only            |
| Resource identified  | service endpoint + desc   | service endpoint      | calls whitelist       |
| Job (jobId)          | YES (on-chain)            | NO                    | NO                    |
| Price authoritative  | YES (budget, escrowed)    | NO                    | spend cap (different) |
| Expiry authoritative | YES (expiredAt)           | NO                    | YES (session expiry)  |
| Authenticity         | on-chain, verifiable      | on-chain              | on-chain Keystore     |
| Integrity            | escrow + dispute          | registry immutability | Keystore              |
| Freshness            | expiredAt + status        | n/a                   | isValidKey            |
| Revocation           | dispute/settle/refund     | isRevoked             | revokeKey             |

Only **ERC-8183 job state** covers all ten rows with authoritative, on-chain, verifiable values.

---

## 10. Identity-Binding Analysis

- ERC-8183 `job.provider` binds the job to the agent's on-chain address.
- ERC-8004 `agentId`/`owner_address` (and `agentWallet`) binds the agent identity to that address.
- Composition: `resolveExecutionCapability(agentId)` → look up ERC-8004 agent → resolve provider address → read ERC-8183 jobs where `provider == address`, `status ∈ {FUNDED, SUBMITTED}`, `expiredAt > now`. This yields a cryptographically bound, fresh capability.

---

## 11. Freshness / Revocation Analysis

- Freshness: enforced by `expiredAt > now` AND `status` not in terminal (`COMPLETED`/`REJECTED`/`EXPIRED`).
- Revocation: a job can be disputed → rejected, or refunded after expiry; settlement is permissionless. Once settled/rejected/expired, the capability is gone — naturally revocable and tamper-evident.
- This satisfies the X.76 `verifyExecutionCapability` expiry + freshness checks.

---

## 12. Security Boundary

- The standard applied: _"Would accepting this evidence allow the marketplace to safely create a session capable of performing the explicitly attested operation?"_
- An on-chain **funded** ERC-8183 job — where the marketplace is the client, the agent is the provider, budget/description/expiry are fixed on-chain — is strong evidence the agent can perform that exact operation. It is escrow-backed and dispute-gated.
- It does **not** by itself prove the agent is _benign_; that requires the ERC-8004 trust signals + (future) validation. But it satisfies the minimum authoritative evidence for `Hire → Consent → Session`.
- Therefore ERC-8183 job-derived capability is **acceptable** as the authoritative source, provided the marketplace funds the job itself (so `client` = marketplace, preventing forged third-party jobs).

---

## 13. Recommended Authoritative Dependency

**ERC-8183 (Agentic Commerce / APEX) on-chain job state, composed with ERC-8004 identity for agent binding**, where the marketplace is the job client.

Concretely, the future `ExecutionCapabilityProvider` should:

1. Resolve `agentId` → ERC-8004 provider address.
2. Read ERC-8183 `AgenticCommerce` for jobs where `provider == address` and `client == marketplace` (or a marketplace-created hire reference).
3. Select an active (`FUNDED`/`SUBMITTED`), non-expired job.
4. Construct `VerifiedExecutionCapability`:
   - `jobId` = on-chain jobId
   - `price` = `budget`
   - `expiresAt` = `expiredAt`
   - `resource` = provider's ERC-8183 service endpoint (ERC-8004 registration `services`)
   - `executionCapability` = derived from `description`/service manifest (never placeholder `"enabled"`)
   - `verification = { source: "AgenticCommerce:<address>", method: "onchain:erc8183-job", verifiedAt: <now> }`
5. Pass `verifyExecutionCapability` (X.76 validator).

---

## 14. Why Alternatives Were Rejected

- **ERC-8004 alone:** identity/trust only; no price/resource/jobId/expiry; spec disclaims capability guarantees.
- **8004scan / Agent0 / Altana Skills:** discovery/metadata only.
- **Altana Keystore:** authorization/custody, not execution-capability attestation; also BLOCKED (KMS).
- **ERC-8004 Validation Registry:** post-hoc work validation, not pre-authorization; no price/resource/expiry; still evolving.
- **BNB Agent Studio:** tooling, not a registry.
- **Speculative custom registry / marketplace-owned attestation:** explicitly forbidden by X.78 rules.

---

## 15. Implementation Prerequisites (future milestone, NOT performed here)

1. Wire current ERC-8183 contract addresses (`AgenticCommerce`, `EvaluatorRouter`, `OptimisticPolicy`) for chain 97 (and 56) into the integration config — the repo's `erc8183.ts` already integrates ERC-8183 for historical Job 515 and can be extended.
2. Add a read-only ERC-8183 job reader (RPC/Multicall3) — no credentials required for reads.
3. Compose with the existing ERC-8004 reader (`eight004scan` / `get_erc8004_agent`) for identity binding.
4. Implement `ExecutionCapabilityProvider` satisfying `capability-source.ts`, injected into `resolveExecutionCapability`.
5. For the marketplace to _create_ capabilities (Hire → fund job), provision signing: **AWS KMS custody** (X.75 BLOCKED) + an ERC-8183 client signer. This is the write path and is out of scope for X.78.

---

## 16. AWS/KMS Implications (future dependency only, NOT touched)

- AWS/KMS remains **NOT TOUCHED** in X.78.
- A read-only capability provider (step 2–4 above) needs **no** AWS/KMS — only RPC.
- The **write path** (marketplace funds a job to mint a capability) requires a signer. Per X.75, that signer is the customer-managed AWS KMS key (`ALTANA_KMS_KEY_ID`), currently unconfigured. Provisioning is a separate future milestone.

---

## 17. Exact Next Dependency

To make activation possible, the next required external dependency is:
**A funded, on-chain ERC-8183 job for the target agent, where the marketplace is the client** — readable via the `AgenticCommerce` contract on BNB Chain (chain 97 testnet / 56 mainnet), with ERC-8004 identity for agent binding.

No passive "execution capability registry" exists; the capability is _produced_ by the marketplace's own hire/fund action on ERC-8183.

---

## 18. Final Classification

| Dimension                  | Status                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| EXTERNAL CAPABILITY SOURCE | **PARTIAL** (ERC-8183 identified as legitimate conditional source; no passive pre-existing registry) |
| AUTHORITY                  | **PASS** (on-chain ERC-8183 + ERC-8004, BNB Chain official standard)                                 |
| CRYPTOGRAPHIC VERIFICATION | **PASS** (on-chain contract reads, Multicall3)                                                       |
| IDENTITY BINDING           | **PASS** (job.provider ↔ ERC-8004 agentId)                                                           |
| FRESHNESS / REVOCATION     | **PASS** (expiredAt + status + dispute/settle/refund)                                                |
| ACTIVATION READINESS       | **BLOCKED** (no provider implemented; AWS/KMS write path unprovisioned; implementation out of scope) |
| **OVERALL X.78**           | **PARTIAL**                                                                                          |

### Explicit statement

**NO AUTHORITATIVE EXTERNAL EXECUTION-CAPABILITY REGISTRY (passive, pre-existing) WAS IDENTIFIED.** The ecosystem provides no standalone source that lists agents as executable with authoritative `jobId`/`price`/`resource`/`expiry` without a job being created.

**The exact external dependency required is ERC-8183 (Agentic Commerce / APEX) on-chain job state, composed with ERC-8004 identity** — generated when the marketplace funds a job for the agent as part of its own Hire step. This is the only legitimate, cryptographically verifiable, identity-bound, fresh, and revocable source satisfying the X.76 `VerifiedExecutionCapability` contract.

No implementation was performed. X.76 boundary verifier: **31/31 PASS**. Hire verifier: **23/23 PASS**. No code changes, no deploy/commit/push, no blockchain transactions, AWS/KMS and ALTANA custody NOT touched.

---

## Absolute Boundaries (reaffirmed, all honored)

AWS/KMS: NOT TOUCHED · ALTANA CUSTODY: NOT TOUCHED · TERMiX: READ-ONLY · PancakeSwap: NOT TOUCHED · MAINNET: NOT TOUCHED · AGENT 1816: NOT TOUCHED · JOB 515: NOT TOUCHED · BLOCKCHAIN TRANSACTIONS: NONE · VERCEL: NO DEPLOYMENT · GIT COMMIT: NO · GIT PUSH: NO · NO NEW PROVIDER IMPLEMENTATION · NO NEW REGISTRY · NO FABRICATED ATTESTATIONS · NO FAKE EXECUTION CAPABILITY.
