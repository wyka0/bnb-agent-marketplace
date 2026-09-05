# X.127 Marketplace Real-Hire Integration (V2 Commercial Path)

**Mode:** Integration + feasibility only. No ERC-8183 job was created, no funds spent, no transaction broadcast, no deployment, no push, no commit, and no production activation behavior was changed. Job 622 is referenced only as historical proof.

**Git boundary (recorded before any change):**

- `git status --short`: no tracked modifications (only pre-existing untracked historical docs + isolated `services/`)
- `git rev-parse HEAD` / `origin/main`: `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`

**End state git status:**

- Modified (tracked, isolated): `packages/integrations/src/altana/index.ts` (adds the V2 adapter exports — nothing imports it in production)
- New (untracked): `packages/integrations/src/altana/v2/` (isolated adapter + pure verify), `services/v2-seller/x127.real-hire-proof.mjs` (isolated proof harness)
- No commit, no push, no deploy.

---

## 1. Current Hire Architecture

The production Hire pipeline (`apps/web`):

1. **UI entry** — `app/(app)/agents/[slug]/hire/hire-activation-view.tsx` (`HireActivationView`) POSTs `/api/activation/hire` with `{ action, agentId, consentDigest }` + CSRF.
2. **Route** — `app/api/activation/hire/route.ts` (POST): auth (`getAuthenticatedUser`), CSRF + origin, rate limit, then `hireActivationApi`.
3. **API layer** — `lib/activation/hire.api.ts`: safe-mutation/CSRF/identity checks; validates `action ∈ {review, activate}` and an exact `agent_id`; resolves the agent via `resolveAgent` → 8004scan `GET /agents`; runs `review(record)`; on `activate` verifies the consent digest, runs `evaluateActivationGate`, then `createSession`.
4. **Classifier** — `lib/activation/capability.ts`: `resolveAgentActivationCapability` returns `null` for every real record (8004scan exposes no pricing/action metadata). Real records classify `NOT_ACTIVATABLE` (non-97 chain) or `CAPABILITY_UNKNOWN` (chain 97, no capability). Nothing is fabricated.
5. **Review boundary** — `lib/activation/hire.server.ts` `runHireActivation`: only an `ACTIVATABLE` classifier proceeds to `buildHireReviewFromCapability` → `prepareErc8183Hire` (5-call batch) → `buildX402LiveReview` → `pinX402Consent`.
6. **Gate** — `lib/activation/session-gate.ts` `evaluateSessionGate`: requires authenticated wallet, exact agent binding, valid consent digest, `classifyCapability(...) === "verified-funded"` (a VERIFIED FUNDED/SUBMITTED job where `client === expectedClient`, `provider === expectedAgentOwner`, chain 97, budget > 0, expiry future, non-placeholder `resource` + `executionCapability`, verification provenance) AND `custodyAvailable`.
7. **Capability source** — `lib/activation/capability-source.ts`: `ExecutionCapabilityProvider` interface with NO production implementation; `resolveExecutionCapability` returns `null` by construction.
8. **Consent commitment** — `lib/activation/consent.commitment.ts`: canonical commitment binding agent identity, chain, provider, resource, executionCapability, budget, expiry, permissions, session/execution intent, funding responsibility (`marketplace`), jobId, verification.

### Where the existing Hire request stops

For the real testnet agent (1906): `resolveAgent` succeeds (8004scan resolves the exact identity, chain 97, testnet, owner `0xB0f7...`), then `runHireActivation` classifies `CAPABILITY_UNKNOWN` because no real capability resolves → returns `available:false` → HTTP `409 activation-unavailable`. The request never reaches review/consent/session/transaction.

For every other real record it stops even earlier (`NOT_ACTIVATABLE`, mainnet chain).

Production fail-closed re-confirmed live this milestone: `POST /api/activation/hire` → **403**; `GET /api/altana/session` → **503**.

## 2. V2 Commercial Path Mapping

Proven lifecycle (X.125/X.126A/B/C, Job 622, chain 97):

| V2 step           | Authoritative source                                         | Marketplace mapping                                                              |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Agent identity    | 8004scan `agent_id` + on-chain ERC-8004 `getAgentInfo(1906)` | exact `agentId` resolution (`hire.server.ts`) — **exists**                       |
| Provider identity | registry `owner_address` == `job.provider`                   | consent `provider` + `expectedAgentOwner` — **exists**                           |
| Seller endpoint   | registered `services[].endpoint` (A2A)                       | missing in marketplace record (8004scan index has no URI) — **adapter supplies** |
| Negotiation       | seller `POST /negotiate`                                     | **adapter supplies**                                                             |
| providerSig       | EIP-191 quote signature                                      | **adapter supplies** (official `verifyQuoteSignature`)                           |
| Commercial terms  | price / currency / chain / commerce binding in quote         | consent price + `buildHireMerchantConfig` — **exists for price**                 |
| ERC-8183 job      | `getJob` (kernel)                                            | `VerifiedFundedErc8183JobEvidence` — **exists (shape)**                          |
| Activation state  | (none)                                                       | `session-gate` verified-funded — **exists (never satisfied)**                    |

Every V2 field has an authoritative source. No field is invented by the adapter.

## 3. Activation Model Determination

**MODEL A — X.76 capability-authority model (current production rubric).** Requires authoritative `resource`, `executionCapability`, provider signature, provider identity, and exact job binding, plus marketplace-as-client (`expectedClient`), expiry, budget, verification provenance, and custody. Enforced by `capability-source.ts`, `erc8183-job-evidence.ts`, `capability-resolution.ts`, `session-gate.ts`, and `consent.commitment.ts`.

**MODEL B — V2 commercial agreement model.** Supplies provider identity, `providerSig` (EIP-191), a verified commercial quote (price/currency/chain/commerce binding), and a funded ERC-8183 job. The official V2 quote schema does **not** carry `resource` or `executionCapability`, and the proven jobs were funded with the buyer wallet as client (not the marketplace `expectedClient`).

**Determination:** The current Main Track production rubric is **MODEL A**. The V2 commercial path (Model B) is **insufficient** for that rubric: it cannot produce the two Model-A-only fields (`resource`, `executionCapability`) and it does not make the marketplace the job client. Per the requirement "do not silently weaken the existing security boundary", production stays fail-closed on the X.76 capability-authority model. The V2 path is a real, verified **commercial-agreement** boundary — not an activation authority.

## 4. Isolated Adapter

Created in `packages/integrations/src/altana/v2/` (PURE, injected I/O; no `@bnbagent/sdk` dependency added to the marketplace package):

- `commercial-agreement.ts` — typed `V2CommercialAgreement`; pure `validateV2Quote` (chain / commerce / token / price / expiry / hash / signature presence); `composeV2CommercialAgreement`; `v2AgreementActivationState` (always `commercial-agreement-only`). The agreement object carries `resource:null`, `executionCapability:null`, `jobId:null`, `sessionId:null`, `active:false` — nothing fabricated.
- `hire-adapter.ts` — `runV2HireNegotiation(ports, input)` with injected ports (`resolveAgentIdentity`, `resolveRegisteredEndpoint`, `negotiate`, `verifyQuote`). Fails closed at each stage. Returns `available:true` only for a fully-validated commercial agreement; `activationState.actionable === false` always; `nextRequiredAction` names the exact transaction and authorization required.
- `hire-adapter.verify.ts` — pure harness (injected fakes), 44 checks.

Exported from `packages/integrations/src/altana/index.ts`. Nothing in production imports or wires it.

## 5. Isolated Real-Hire Proof

Harness `services/v2-seller/x127.real-hire-proof.mjs` drives the adapter with the real official SDK + live seller.

- **Pass 1 — authoritative registered endpoint:** Agent 1906 metadata `services[].endpoint` resolves to the **expired** tunnel host `flux-management-helps-attended.trycloudflare.com` → negotiation unreachable → adapter blocks at `negotiation`. Honest finding: the on-chain registration is stale (quick-tunnel rotation without registration update; updating it would require an on-chain transaction, which is NOT authorized by X.127).
- **Pass 2 — live seller endpoint** (`menus-alternate-exploring-furnishings.trycloudflare.com`, the current quick tunnel serving the isolated seller): adapter reached the verified boundary:
  - `agentIdentity 97:0x8004...:1906`, `provider 0xB0f768...`, `chainId 97`, `commerce 0xa206...`, `paymentToken 0xc70B...`, `price 1 U`
  - `providerSignature { present:true, verified:true, method:eip191, signer:0xB0f768... }`
  - `resource:null`, `executionCapability:null`, `jobId:null`, `sessionId:null`, `active:false`
  - `validation.ok:true`; `activationState { actionable:false, state:"commercial-agreement-only" }`
  - Job 622 provided as `historicalEvidence` only (`jobId:null`, `active:false` preserved).
  - **No transaction was broadcast.**

**Exact next step (would be required to continue toward activation, NOT authorized):**

- Transaction: a **new** ERC-8183 hire batch on chain 97 — `createJob(provider, router, expiredAt, buildJobDescription(verifiedQuote)) → registerJob → setBudget(price) → approve(commerce, price) → fund(price)` with the marketplace as client — then later `submit` + `settle`.
- Signer: the marketplace ERC-8183 client wallet/session (NOT the seller, NOT the buyer wallet).
- Custody: marketplace escrow custody + chain-97 tBNB gas (or paymaster) + `$U` budget. ALTANA/KMS custody is not provisioned (X.75).
- Budget: `1 U` (1e18 raw) per job + gas.
- Production prerequisites: (a) marketplace client custody, (b) job-bound `resource`/`executionCapability` authority (Model A) or an explicit decision to adopt Model B as activation authority, (c) a reachable registered seller endpoint, (d) explicit transaction authorization.
- Current infrastructure can provide: the isolated negotiation/quote/verification path (proven here); **cannot** provide custody, Model-A job-bound authority, or an authorized transaction.

## 6. Production Safety

Verified this milestone:

- No fake ACTIVE, job, quote, capability, or execution resource — the adapter returns them as explicit `null`/`false`.
- No fabricated performance; no session; no transaction without explicit authorization.
- No seller private key, no buyer private key, no testnet credentials in marketplace production (`hire.api.ts` returns public views only; `createHirePaymentGuard` can only reject).
- Testnet-only gating intact: `ACTIVATION_CHAIN_ID === 97`, `ALTANA_ERC8183_CHAIN_ID === 97`, ERC-8183 adapter rejects chain 56.
- Job 622 is never represented as a new marketplace transaction — the adapter records it only as `historicalEvidence`.
- Production endpoints remain fail-closed live: Hire `403`, Altana `503`.

## 7. Tests

New (this milestone):

- `packages/integrations/src/altana/v2/hire-adapter.verify.ts` — **44 checks PASS** (success/boundary, wrong signer, wrong chain, wrong commerce, expired quote, price mismatch, provider mismatch, missing endpoint, missing identity, failed negotiation, fail-closed, Job-622-as-history-only, token/hash/sig/acceptance null-rejections, mainnet identity, activation-state-not-actionable).

Existing suites re-run (all PASS):

- `activation:verify` 33/33
- `activation:hire:verify` 23/23
- `activation:hire-api:verify` 14/14
- `activation:capability-source:verify` PASS
- `activation:x80:verify` PASS
- `activation:x81:verify` PASS
- `security:x49:verify` 25/25
- `security:x55:verify` 22/22
- X.84 registration-file candidate 14/14; X.85 signed-quote 13/13
- `packages/integrations altana:erc8183:verify` PASS (testnet kernel read included)

Build/typecheck/lint/format:

- `packages/integrations` build + `tsc --noEmit` PASS; lint PASS; prettier check PASS
- `apps/web` `tsc --noEmit` PASS; `eslint .` PASS
- Root `prettier --check` on new files PASS

## 8. Exact Remaining Blockers

1. **Model-A authority:** `resource` + `executionCapability` are not attested by the V2 commercial quote schema; no job-bound, provider-signed source exists. (Blocked for Model A.)
2. **Marketplace-as-client:** the proven jobs used the buyer wallet as `client`; production `validateVerifiedJob` requires `client === expectedClient` (marketplace). Only a marketplace-funded job can satisfy it. (Blocked — requires a transaction.)
3. **Custody:** marketplace ERC-8183 client custody is not provisioned (X.75). (Blocked.)
4. **Registered endpoint:** Agent 1906's on-chain registered endpoint points to the expired tunnel; updating requires an on-chain transaction. (Blocked without authorization.)
5. **Explicit authorization:** no transaction or production activation change is authorized by X.127.

## 9. Exact Next Action

1. Decide activation authority: adopt Model B (commercial agreement = activation evidence) or build a job-bound Model-A authority. Until then production stays fail-closed.
2. When separately authorized: provision marketplace client custody → fund a NEW marketplace-client job (createJob→registerJob→setBudget→approve→fund) using the adapter's verified quote → observe FUNDED → wire `VerifiedFundedErc8183JobEvidence` into `evaluateActivationGate` with `custodyAvailable` true.
3. Update the seller's registered endpoint (new tunnel) when authorized.

## Classifications

- **CURRENT HIRE AUDIT:** PASS — full end-to-end mapped; request stops at classifier (`CAPABILITY_UNKNOWN` for chain-97 records; `NOT_ACTIVATABLE` for mainnet).
- **V2 COMPATIBILITY:** PASS — every V2 field maps to an authoritative source; the commercial boundary is reachable.
- **PROVIDER AUTHORITY:** PASS — registry owner == quote signer == `job.provider` (0xB0f7...) verified via official SDK.
- **QUOTE AUTHORITY:** PASS — `verifyQuoteSignature` (eip191, signer = seller, chain 97, commerce binding, 1 U, future expiry).
- **CAPABILITY AUTHORITY:** BLOCKED — `resource`/`executionCapability` are not attested by the V2 quote; no job-bound Model-A source exists.
- **ISOLATED ADAPTER:** PASS — built, exported, 44 pure checks + real-hire proof to the negotiation/providerSig boundary (no tx).
- **PRODUCTION SAFETY:** PASS — fail-closed preserved (Hire 403, Altana 503 live; gate never satisfied; no fabrication; no credentials).
- **TESTS:** PASS — new adapter suite + all existing activation/security/ERC-8183 suites green; typecheck/lint/build/format green.
- **OVERALL:** **PASS (feasibility + isolated adapter; activation remains BLOCKED pending Model-A authority, marketplace client custody, a reachable registered endpoint, and explicit authorization).**

**Answer to the milestone question:** Yes — the actual Marketplace Hire pipeline CAN safely reach and consume the proven V2 commercial-agreement boundary through the isolated adapter (real negotiation + verified providerSig), and it stays fail-closed. It CANNOT yet produce a production activation: the current production rubric is the X.76 capability-authority model, and the V2 commercial path does not supply the Model-A `resource`/`executionCapability` authority, marketplace-as-client job binding, or custody that production requires.

No private key, password, mnemonic, seed phrase, or keystore contents are included in this report.
