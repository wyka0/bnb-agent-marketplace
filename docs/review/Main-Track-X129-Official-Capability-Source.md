# X.129 Official BNB Agent Studio Capability-Source Investigation

**Mode:** Read-only investigation. No transaction, no new job, no custody provisioning, no production change, no deploy/commit/push. Job 622 referenced only as historical evidence.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Official BNB Agent Studio / BNB Agent SDK sources examined

1. **Official `@bnbagent/sdk@0.5.1` (installed in the isolated seller runtime)** — full `.d.ts` surface:
   - `erc8004`: `ERC8004Agent`, `AgentEndpoint.a2a()/.mcp()`, `generateAgentUri(name, description, endpoints, image?, agentId?, supportedTrust?)`.
   - `erc8183`: `NegotiationHandler`, `NegotiationRequest/TermSpecification`, `buildJobDescription`, `verifyQuoteSignature`, `ERC8183Client`, `DeliverableManifest`.
   - `wallets`: capability registry (`sign.*`, `intents.*`, `x402.pay`, vendor values).
2. **Official GitHub `bnb-chain/bnbagent-sdk` README.md + ARCHITECTURE.md** (fetched live).
3. **Official `@altananetwork/sdk@0.7.0` (installed)** — `Erc8183Job`, skills.
4. **ERC-8004 registration file for Agent 1906** (decoded from on-chain `getAgentInfo(1906).agentURI`).
5. **A2A Agent Card** — seller's served schema (from `services/v2-seller/seller.ts` source; endpoints currently down — ephemeral tunnels).

## 2. Agent 1906 registered metadata (decoded, public)

```json
{
  "name": "BNB Agent Studio v2 Testnet Seller",
  "description": "BSC Testnet ERC-8183 service seller — real negotiated quote service, testnet-only",
  "image": "",
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "registrations": [
    { "agentId": 1906, "agentRegistry": "eip155:97:0x8004A818BFB912233c491871b3d84c89A494BD9e" }
  ],
  "services": [
    {
      "endpoint": "https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json",
      "name": "A2A"
    }
  ]
}
```

**No `capabilities`, no `skills`, no `resource`, no `executionCapability`.** Only a natural-language description, an A2A endpoint, and the ERC-8004 registration.

## 3. Candidate capability sources (authority test)

| Source                                                         | Schema                                                                                                                                                                                                 | Signer                | Signature                                           | Resource                         | Exec Cap                                          | Job binding      | Provider binding         | Expiry             | Chain | Verification method               | AUTHORITATIVE                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------- | -------------------------------- | ------------------------------------------------- | ---------------- | ------------------------ | ------------------ | ----- | --------------------------------- | ----------------------------------------------------- |
| ERC-8004 registration file (Agent 1906)                        | EIP-8004 registration-v1                                                                                                                                                                               | seller (URI author)   | content **unsigned** (URI on-chain, JSON off-chain) | **NONE**                         | **NONE**                                          | NONE             | owner address (identity) | NONE               | 97    | registry `getAgentInfo`           | **BLOCKED** (identity/discovery only)                 |
| ERC-8004 `AgentEndpoint.capabilities[]`                        | `string[]`                                                                                                                                                                                             | self                  | none (mutable via `setAgentURI`)                    | **NONE** (endpoint is transport) | self-declared strings                             | NONE             | owner                    | NONE               | 97    | none                              | **BLOCKED** (self-declared discovery)                 |
| A2A Agent Card                                                 | A2A spec; `capabilities` = transport bits; `skills[]` = natural-language descriptions                                                                                                                  | none (off-chain JSON) | none                                                | **NONE**                         | natural-language skills                           | NONE             | none                     | NONE               | none  | none                              | **BLOCKED** (discovery)                               |
| MCP tool list                                                  | MCP tool descriptions                                                                                                                                                                                  | none                  | none                                                | **NONE**                         | tool descriptions                                 | NONE             | none                     | NONE               | none  | none                              | **BLOCKED** (discovery)                               |
| ERC-8183 job `description` (signed quote, Mode B)              | quote JSON: `task/terms{deliverables,quality_standards,success_criteria,evaluation_required,evaluator_type},price,currency,chain_id,verifying_contract,negotiation_hash,provider_sig,quote_expires_at` | provider              | `provider_sig` verified (eip191/1271)               | **NONE**                         | **NONE**                                          | `jobId` on-chain | `job.provider == owner`  | quote + job expiry | 97    | `verifyQuoteSignature` + `getJob` | **BLOCKED as capability** (commercial authority only) |
| `DeliverableManifest` (`job.submit`)                           | manifest JSON (version, job_id, chain_id, contracts, response, metadata)                                                                                                                               | provider              | on-chain `deliverable` hash                         | deliverable response URL only    | **NONE**                                          | `jobId`          | provider                 | job expiry         | 97    | `manifestHash() == deliverable`   | **BLOCKED as capability** (deliverable only)          |
| Wallet capability registry (`sign.*`, `intents.*`, `x402.pay`) | capability strings                                                                                                                                                                                     | n/a                   | n/a                                                 | **NONE**                         | wallet signing capabilities (not agent execution) | NONE             | wallet                   | NONE               | n/a   | `supports()`                      | **BLOCKED** (not an agent authority)                  |
| 8004scan index                                                 | `Scan8004Agent`                                                                                                                                                                                        | none                  | none                                                | **NONE**                         | **NONE**                                          | NONE             | owner                    | NONE               | 97/56 | none                              | **BLOCKED** (index)                                   |
| ALTANA skills catalog                                          | skill metadata                                                                                                                                                                                         | self                  | none                                                | **NONE**                         | `executable:false`                                | NONE             | none                     | NONE               | n/a   | none                              | **BLOCKED** (self-declared)                           |

Isolated read-only harness (run, no tx): `services/v2-seller/x129.capability-schema.verify.mjs` — **13/13 PASS** proving the official SDK exposes **no `resource` and no `executionCapability`** field in the negotiation request, negotiation terms, on-chain description (`buildJobDescription`), `AgentEndpoint`, or the on-chain ERC-8183 job.

## 4. Authority analysis — does the official stack bridge the concepts?

- **ERC-8004 identity ≠ execution capability authority.** ERC-8004 stores identity + a URI pointer; the referenced content is self-asserted, mutable metadata. The official SDK explicitly keeps serving surfaces (A2A/MCP/HTTP) **out of the SDK** ("an application choice") and never upgrades identity to execution authority.
- **ERC-8183 job description ≠ `VerifiedExecutionCapability`.** The on-chain `description` is a provider-signed commercial quote (task/terms/price/currency). It is job-bound and provider-signed, but carries **no `resource` and no `executionCapability`** (proven by the harness). It is commercial authority, not execution-capability authority.
- **`providerSig` ≠ capability attestation.** The EIP-191 signature binds the _commercial quote content_ (`negotiation_hash`). It cannot be re-purposed as a capability attestation; there is no signed capability payload in the official stack.
- **No official mapping exists** between agent capabilities and ERC-8183 jobs. The SDK's only "capabilities" are the wallet signing capability strings and the two protocol capabilities it implements (identity + commerce).

## 5. X.76 compatibility

**NONE** of the official sources satisfies `VerifiedExecutionCapability` (`resource` + `executionCapability` + explicit verification method). No official provider implements `ExecutionCapabilityProvider`.

## 6. Does `resource` exist authoritatively?

**NO.** Not in ERC-8004 metadata, A2A card, MCP, ERC-8183 description/deliverable (deliverable URL is job-response transport, not an execution resource), 8004scan, or ALTANA skills.

## 7. Does `executionCapability` exist authoritatively?

**NO.** Every candidate is either absent, self-declared, or natural-language (`deliverables`/skills/tool descriptions). No canonical, machine-readable, integrity-protected execution capability is published anywhere in the official stack.

## 8. Does job binding exist?

**PARTIAL (commercial only).** ERC-8183 binds `jobId`, `client`, `provider`, `budget`, `expiredAt`, `status`, and the signed description — but the bound description carries no capability fields. Job 622 is historical, `COMPLETED` (non-actionable per `validateVerifiedJob`), and its `client` is the buyer wallet.

## 9. Does marketplace-client binding exist?

**NO.** No marketplace-funded ERC-8183 job exists; the marketplace is not a party to any job.

## 10. Exact remaining blocker

The official BNB Agent Studio / BNB Agent SDK stack **does not define or publish** a job-bound `resource` + `executionCapability` attestation, and provides no API, schema, or signing mechanism that maps agent capabilities to ERC-8183 jobs. The X.90/X.91 dependency is unchanged: an **authoritative external capability source** (LEVEL 2–4 per X.91) is required — e.g. a provider-signed capability attestation, an authoritative capability registry, a job-bound capability attestation, or an **official protocol upgrade that introduces `resource`/`executionCapability` semantics into ERC-8183 or the SDK quote**.

**Smallest legitimate external dependency:** an official/protocol-level, provider-signed attestation that binds a canonical `resource` + `executionCapability` to (agent, provider, job) with integrity, identity binding, freshness, provenance, and revocation. It is **not legitimate** to mint a custom authority here to make X.76 pass — a self-asserted authority is exactly what X.82/X.83/X.91 forbid.

## 11. Recommended next step

1. Keep production fail-closed (no change).
2. Do NOT create a custom capability authority.
3. When the external authority exists (or an official SDK/protocol upgrade adds `resource`/`executionCapability`): re-run this authority test, then proceed per X.128 recommended path (provision marketplace custody → marketplace-client job → wire verified evidence into the gate).

## Final classification

- OFFICIAL SOURCES EXAMINED: `@bnbagent/sdk@0.5.1`, official GitHub README + ARCHITECTURE, `@altananetwork/sdk@0.7.0`, Agent 1906 ERC-8004 metadata, A2A Agent Card schema.
- OFFICIAL CAPABILITY SCHEMA: **BLOCKED** — none exists (isolated harness 13/13 confirms absence).
- RESOURCE (authoritative): **NO**.
- EXECUTION CAPABILITY (authoritative): **NO**.
- JOB BINDING: PARTIAL (commercial only; not capability).
- MARKETPLACE-CLIENT BINDING: **NO**.
- X.76 COMPATIBILITY: **BLOCKED**.
- **OVERALL X.129: C — NO OFFICIAL CAPABILITY SOURCE.**

**STOP.** No production modification, no transaction, no custody provisioning, no commit, no push, no deployment.
