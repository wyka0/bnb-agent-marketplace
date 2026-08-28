# Main-Track Activation — X.83: BNB Agent Capability Attestation Research

> Status: **BLOCKED — EXTERNAL AUTHORITATIVE CAPABILITY ATTESTATION STILL REQUIRED** (OUTCOME C)
> Date: 2026-08-21
> Scope: Investigate whether BNB Agent SDK's ERC-8004 registration metadata (Candidate A) and/or ERC-8183 negotiation + signed provider quote (Candidate B), or a strictly defined composition, can supply authoritative `resource` + `executionCapability` for the exact agent/job without adding a new integration. **No code was changed.**
> Per the absolute rule: do NOT add a new integration; do NOT weaken the trust model; do NOT convert natural-language/self-asserted metadata into execution authority.

---

## 1. X.82 Starting State

X.82 concluded BLOCKED: no existing repository source supplies authoritative, job-bound `resource` + `executionCapability`. X.83 was triggered by BNB Chain documentation indicating ERC-8004 registration files _can_ contain `capabilities`/`service endpoints`/`supported payment methods`, and ERC-8183 negotiation includes signed quotes with price/terms/expiry/chain id. This report tests whether those mechanisms satisfy the marketplace's trust boundary.

## 2. BNB Agent SDK Evidence

Authoritative sources reviewed: EIP-8004 spec + 8004scan best-practices (AgentURI/registration file), BNB Agent SDK docs (Quickstart, Architecture), BNB Agent Studio Architecture. Summary:

- ERC-8004 and ERC-8183 are explicitly **independent**; ERC-8004 is "recommended for discovery, not a prerequisite" for ERC-8183 jobs.
- ERC-8183 job state is on-chain (AgenticCommerce kernel): `provider`, `client`, `budget`, `expiredAt`, `status`, `description`. `description` = "the agreed description is anchored on-chain" after negotiation.
- The SDK `NegotiationHandler` produces **wallet-signed quotes, chain-bound anti-replay, with quote expiry** (structured `JobDescription` schema). The quote is an **off-chain** HTTP exchange before funding.

## 3. ERC-8004 Registration-File Analysis (Candidate A)

The registration file is the JSON at `agentURI` (an on-chain ERC-721 `tokenURI`/`setAgentURI` pointer). Structure (per EIP-8004 + 8004scan guidance):

- `services[]` — each `{ name, endpoint, version, mcpTools?, a2aSkills?, skills?, capabilities? }`. `endpoint` is a URL; `mcpTools`/`a2aSkills`/`skills` are structured capability lists.
- `x402Support` (boolean), `active`, `registrations[]` (back-link to on-chain identity), `supportedTrust` (optional).

Trust properties of the registration file:

| Property          | Finding                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location          | Off-chain JSON at `agentURI` (HTTPS / IPFS / `data:` URI). Only the URI is on-chain.                                                                    |
| Mutability        | **Mutable** — `setAgentURI()` updates it at any time; `data:` URI is the only on-chain variant.                                                         |
| Integrity         | Only the URI string is on-chain; content is NOT hashed on-chain unless optional `agentHash` metadata is set (8004scan may hash; repo does not read it). |
| Authority         | **Self-asserted** by the agent owner. `supportedTrust` is optional: "If absent or empty, this ERC is used only for discovery, not for trust."           |
| Job binding       | **None** — agent-wide discovery metadata, not tied to any ERC-8183 job.                                                                                 |
| Endpoint auth     | Optional `.well-known/agent-registration.json` proves only **domain control**, not that the endpoint executes a specific operation.                     |
| Expiry/revocation | Only via owner re-publishing; no capability-level expiry.                                                                                               |

**Conclusion:** `registrationFile.services[].endpoint` is a real machine-readable **resource** value, and `services[].skills`/`mcpTools` are real machine-readable **capability** values. But the file is self-asserted, mutable, off-chain, and not job-bound. It is **DISCOVERY/METADATA**, not execution authority. It MUST NOT be upgraded to `VerifiedExecutionCapability`.

## 4. ERC-8183 Negotiation Analysis (Candidate B)

The BNB Agent SDK negotiate flow: client → provider `POST /erc8183/negotiate` → structured quote. The quote commits to: task `description`, terms, `deliverables`, `price`, `currency`, `quote expiry`, `chain ID`. `NegotiationHandler` signs the quote with the **provider's wallet key** and is chain-bound (anti-replay).

Critical: negotiation happens **before** the job exists. The on-chain `description` stores "the agreed description" (anchored at `fund`). So quote and job share the same `description` text, but the quote itself does not contain the final `jobId`.

## 5. Signed-Quote Trust Model

| #   | Question                              | Finding                                                                                                                                       |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What key signs?                       | Provider's wallet key (EVMWalletProvider / Altana session key).                                                                               |
| 2   | Bound to ERC-8004 owner/provider?     | Yes — provider key should equal on-chain `job.provider` = registry owner (the X.81 identity check).                                           |
| 3   | Rotatable?                            | Yes — provider can rotate keys; old quotes become invalid only by expiry/revocation logic.                                                    |
| 4   | Revocable?                            | Only via `quoteExpiry`; no explicit revocation channel.                                                                                       |
| 5   | Expires?                              | Yes — `quoteExpiry` (signed). Strong freshness property.                                                                                      |
| 6   | Identifies exact task?                | Yes — commits to `description`/terms.                                                                                                         |
| 7   | Identifies exact resource?            | **No** — quote has no `resource` field; only task description (free/structured text).                                                         |
| 8   | Identifies execution operation?       | **No** — no explicit `executionCapability` field; only task/terms.                                                                            |
| 9   | On-chain funded job preserves terms?  | The on-chain `description` carries the agreed text, but the repo reads it as an opaque string and does **not** parse/verify the signed quote. |
| 10  | Marketplace independently verifiable? | **No** — the repo has NO quote retrieval or signature-verification code; `getErc8183Job` returns `description` only.                          |

**Conclusion:** a provider-signed quote is a genuine cryptographic commitment by the provider to price/terms, but it (a) lacks `resource`/`executionCapability` fields, (b) is not bound to `jobId`, and (c) cannot be verified by the marketplace today. It is **promising but insufficient** as standalone authority.

## 6. Quote → Job Binding Analysis

This is the decisive gap (STEP 4). The quote is produced pre-funding and typically omits `jobId`. After funding, the on-chain job exposes `description`, `budget`, `provider`, `client`, `expiredAt`. A buyer/provider could:

- sign a cheap quote, then fund a job with a **different budget** or **different description**;

the marketplace would need to re-verify the on-chain job's terms against the signed quote and the provider key. The repo does **not** do this: it reads the on-chain job (X.81) but has no quote to compare against, and no `jobId` inside the quote to bind them. There is **no cryptographic binding of quote → jobId**. → **BLOCKED.**

## 7. Resource Semantics

`resource` in the marketplace contract = the actual protected resource/operation being authorized (e.g., the x402-protected service URL). Candidate sources:

- ERC-8004 `services[].endpoint` — a real URL, but self-asserted/mutable/off-chain/not job-bound.
- ERC-8183 quote `description` — free/structured task text, **not** a resource identifier.
- On-chain job `description` — same, opaque in the repo.

No source provides an **integrity-protected, job-bound, machine-readable resource**. → **RESOURCE ATTESTATION: PARTIAL** (field exists in registration metadata; trust fails on authority/integrity/job-binding).

## 8. Execution Capability Semantics

`executionCapability` must be an explicit, machine-readable, job-bound operation. Candidate sources:

- ERC-8004 `services[].skills` / `mcpTools` / `a2aSkills` — structured skill lists, but self-asserted/mutable/discovery.
- ERC-8183 quote — commits to task/terms, **no explicit executionCapability field**.
- On-chain job — only `description` (text); SDK `JobDescription` schema covers task/price/terms/deliverables, not an explicit capability authorization.

No source provides an authoritative, job-bound `executionCapability`. → **EXECUTION CAPABILITY ATTESTATION: PARTIAL** (structured values exist in registration metadata; trust fails).

## 9. Cryptographic Trust Analysis

| Field               | Source                                  | Signed?                                      | On-chain bound? | Fresh?       | Revocable?      | Verdict                       |
| ------------------- | --------------------------------------- | -------------------------------------------- | --------------- | ------------ | --------------- | ----------------------------- |
| agentId             | ERC-8004 NFT (+ reg `registrations[]`)  | on-chain id yes; reg back-link self-asserted | yes (NFT)       | yes (id)     | transferable    | OK (id); reg metadata mutable |
| provider            | on-chain `job.provider` / owner         | on-chain                                     | yes             | yes          | n/a             | AUTHORITATIVE (X.81)          |
| client              | on-chain `job.client`                   | on-chain                                     | yes             | yes          | n/a             | AUTHORITATIVE (X.81)          |
| jobId               | on-chain job                            | on-chain                                     | yes             | yes          | n/a             | AUTHORITATIVE                 |
| resource            | reg `services[].endpoint`               | no (off-chain, owner)                        | no              | no (mutable) | via setAgentURI | NOT authoritative             |
| executionCapability | reg `skills`/`mcpTools`                 | no (off-chain, owner)                        | no              | no (mutable) | via setAgentURI | NOT authoritative             |
| price               | on-chain `job.budget` + signed quote    | on-chain + provider-signed quote             | yes             | yes          | n/a             | AUTHORITATIVE (on-chain)      |
| expiry              | on-chain `job.expiredAt` + quote expiry | on-chain + provider-signed                   | yes             | yes          | n/a             | AUTHORITATIVE (on-chain)      |

The two required fields (`resource`, `executionCapability`) are the **only** ones lacking on-chain/authoritative provenance. All other fields are already verified authoritatively by X.81.

## 10. Evidence Matrix

| Source                | Resource         | Exec Cap     | Agent Bind             | Job Bind       | Authority                                | Fresh            | Trust                       |
| --------------------- | ---------------- | ------------ | ---------------------- | -------------- | ---------------------------------------- | ---------------- | --------------------------- |
| ERC-8004 reg file     | endpoint (yes)   | skills (yes) | id yes / caps self     | none           | self-asserted                            | mutable          | DISCOVERY                   |
| ERC-8183 signed quote | none             | none         | provider key           | none (pre-job) | provider-signed (not verifiable in repo) | quoteExpiry      | PROMISING                   |
| On-chain ERC-8183 job | description only | none         | provider/client (auth) | jobId (auth)   | on-chain                                 | expiredAt/status | AUTHORITATIVE (except caps) |

## 11. Existing Repository Evidence

Searched `apps/web` + `packages/integrations` for registration-file/quote/capability code:

- **8004scan client/types** — returns `agent_id, owner_address, name, description, supported_protocols, x402_supported` only. It does **NOT** normalize the registration-file `services`/`skills`/`capabilities`. No `agentURI` resolution, no registration-file fetch.
- **ERC-8183 integration** — `HireCallsInput.description` comment mentions "Mode B: anchored signed quote (≤4096 bytes)", proving the repo is _aware_ quotes can be encoded in `description`, but `getErc8183Job` returns `description` as an **opaque string**; there is **no `negotiation`/`quote`/`provider-signature` parsing or verification code**.
- **ALTANA skills** — static 7-skill catalog, `executable:false`, not wired into `apps/web` (zero usages).
- **Prisma** — no capability/resource model (only session lifecycle + audit).

=> The marketplace today can read the **authoritative on-chain job** (X.81) but **cannot read or verify** the registration file or the signed quote. Both Candidate A's data and Candidate B's signature are **inaccessible/undeployed in this repo**.

## 12. TERMiX Relevance

TERMiX (`packages/integrations/src/termix/`) remains **read-only reputation** (`TermixReputation`: score, anomalies, `source: "termix-aacp"`). It is supporting trust/research evidence only — **not** execution authorization. X.74: production read-only integration = PASS; experiment = PARTIAL. No change to that assessment; TERMiX adds nothing to `resource`/`executionCapability` authority.

## 13. Implementation Changes

**NONE (OUTCOME C).** No new provider, no new integration, no quote-verification code, no registration-file fetch, no production behavior change. The X.80/X.81 fail-closed architecture is untouched. The promising candidates would require NEW verification machinery (quote signature check + jobId-binding proof + registration-file retrieval) — explicitly out of scope and not justified while activation remains blocked.

## 14. Tests

No code changed ⇒ no new tests. Ran regression verifiers (all green):

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

- `/` → **200**, `/agents` → **200**, `/api/auth/me` → **200** (healthy marketplace + agent detail).
- `POST /api/activation/hire` → **403 Forbidden** (fail-closed; unsupported agents unavailable; no fake `ACTIVE`).
- `/api/altana/session` → **503** (no custody; unchanged).
- No execution control appeared; security headers intact. No real job/funding/transaction.

## 16. Final Classification

| Dimension                        | Result      | Note                                                                                                                                                                                 |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ERC-8004 CAPABILITY METADATA     | **PARTIAL** | Structured `services[].skills`/`endpoint` exist, but self-asserted, mutable, off-chain, not job-bound → not execution authority.                                                     |
| ERC-8183 SIGNED QUOTE            | **PARTIAL** | Provider-signed, chain-bound, expiring; but no `resource`/`executionCapability` field, not `jobId`-bound, and unverifiable in-repo.                                                  |
| QUOTE → JOB BINDING              | **BLOCKED** | No cryptographic `jobId` binding; repo cannot retrieve/verify quote; only implicit term-match via on-chain `description`.                                                            |
| RESOURCE ATTESTATION             | **PARTIAL** | Registration `services[].endpoint` is a real resource value; fails authority/integrity/job-binding.                                                                                  |
| EXECUTION CAPABILITY ATTESTATION | **PARTIAL** | Registration `skills`/`mcpTools` are real structured values; fails authority/integrity/job-binding.                                                                                  |
| CRYPTOGRAPHIC AUTHORITY          | **PARTIAL** | Provider signature on quote is genuine; but repo can't verify it and it is not on-chain/job-bound. (On-chain provider/client/price/expiry ARE authoritative — already used by X.81.) |
| FRESHNESS/REVOCATION             | **PARTIAL** | Quote `quoteExpiry` + on-chain `expiredAt`/`status` provide freshness; registration metadata has no capability expiry/revocation.                                                    |
| VERIFIED CAPABILITY              | **BLOCKED** | Cannot be constructed authoritatively in-repo (no quote verification, no registration fetch, no job-bound resource/capability).                                                      |
| REAL ACTIVATION                  | **BLOCKED** | No funding, no custody, no capability evidence.                                                                                                                                      |
| **OVERALL X.83**                 | **BLOCKED** | Candidate mechanisms are PARTIAL/promising externally, but the marketplace cannot verify the full chain; no code added.                                                              |

## 17. Exact Next Dependency

To move from BLOCKED → a verifiable capability, the marketplace needs (in order, reusing existing data where possible):

1. **Registration-file resolution** — resolve the ERC-8004 `agentURI` and normalize `services[].endpoint` + `skills` as the _candidate_ `resource`/`executionCapability`. Must be treated as **self-asserted discovery**, not authority, unless the file is a `data:` (fully on-chain) URI or `agentHash` is verified on-chain. (This is a NEW read path — not added now.)
2. **Signed-quote verification** — retrieve and cryptographically verify the provider-signed quote (provider key == on-chain `job.provider` == registry owner), and prove **quote→job binding** (either the quote embeds the `jobId`, or the on-chain `description` is provably the quoted `description` and budget/expiry match). (NEW verification code — not added now.)
3. **Job-bound resource/capability** — the quote or on-chain job must carry an explicit, machine-readable `resource` + `executionCapability` bound to the `jobId`. The current ecosystem exposes these only as descriptive registration metadata; an authoritative, job-scoped attestation does not yet exist.

Until (1)+(2)+(3) are implemented and proven, the marketplace MUST remain fail-closed. The X.81 `resolveCapabilityBinding` extension point is the correct place to compose them once available.

### DISCOVERY DATA vs VERIFIED EXECUTION CAPABILITY

- **DISCOVERY (present, insufficient):** ERC-8004 registration `services`/`skills`/`x402Support`, ERC-8183 signed quote (unverified), 8004scan listing, TERMiX reputation, ALTANA skill catalog, on-chain job `description`/budget/expiry/provider/client.
- **VERIFIED EXECUTION CAPABILITY (absent):** an authoritative, integrity-protected, job-bound attestation of `resource` + `executionCapability` that the marketplace can independently verify. Does not exist in this repository today.

The missing fields remain exactly: **`resource`** and **`executionCapability`**.
