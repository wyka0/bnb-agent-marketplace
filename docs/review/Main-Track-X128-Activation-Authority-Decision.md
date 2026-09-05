# X.128 Final Activation Authority Decision

**Mode:** Decision milestone. No transaction, no new job, no funds spent, no production change, no deploy/commit/push. Job 622 is referenced only as historical proof.

**Git boundary:**

- `git rev-parse HEAD` / `origin/main`: `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0` (unchanged)

---

## 1. Rubric Interpretation

**PRD (`PRD.md`):** The product defines hire as creating a **permissioned ALTANA Agent Wallet Session Key** — mandatory spend caps, expiry, revocation (FR-302/FR-303), least-privilege sessions, signed/verified wallet signatures, and **zero server-held private keys** (NFR Security). It does **not** define ERC-8183 commercial escrow or `resource`/`executionCapability` as the activation authority.

**Repository acceptance boundary (internal, frozen X.76/X.90/X.91):** `VerifiedExecutionCapability` requires `agentId, jobId, resource, executionCapability, price, expiresAt, verification{source,verifiedAt,method}` plus marketplace-as-client binding and custody. This is **MODEL A**.

**Judge criteria (X.93 / UX Blueprint):** honest, real, source-attributed functionality; no fabricated activation; disabled/fail-closed Hire is the correct judge-facing state when activation is unavailable.

The Main Track rubric therefore requires: a real, honest activation where hiring is impossible without a valid, verified configuration — and the repository has deliberately enforced MODEL A as its acceptance boundary.

## 2. Model A — X.76 Capability Authority (field-by-field for Agent 1906)

| Field                      | Source                                                                                                                                                                                                                           | Format             | Authority         | Job binding                                    | Verifiability                 | Status                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------- | ---------------------------------------------- | ----------------------------- | -------------------------------- |
| resource                   | None. 8004scan: none; ERC-8183 job schema: none; BNB Agent SDK quote: none; Job 622 deliverable URL is a job-scoped response endpoint on a buyer-client COMPLETED job, not an execution-resource attestation                     | URL (canonical)    | none              | none                                           | none                          | **BLOCKED**                      |
| executionCapability        | None. Not in ERC-8183 schema, not in SDK quote, not in 8004scan (X.91 §7/§11)                                                                                                                                                    | token              | none              | none                                           | none                          | **BLOCKED**                      |
| provider signature         | BNB Agent SDK EIP-191 quote signature                                                                                                                                                                                            | `provider_sig` hex | provider (seller) | commercial quote → funded job (X.126 verified) | `verifyQuoteSignature` eip191 | **PASS** (commercial terms only) |
| provider identity          | 8004scan owner + ERC-8004 owner + `job.provider` + quote signer                                                                                                                                                                  | address            | registry + chain  | all equal `0xB0f768...`                        | on-chain                      | **PASS**                         |
| job binding                | ERC-8183 job (client/provider/budget/expiry/status)                                                                                                                                                                              | `Erc8183Job`       | kernel            | present, but **no capability fields**          | `getJob`                      | **PARTIAL**                      |
| marketplace client binding | `expectedClient = ALTANA_ERC8183_CLIENT`; no marketplace-funded job exists; Job 622's client is the buyer wallet                                                                                                                 | address            | none              | none                                           | none                          | **BLOCKED**                      |
| custody                    | KMS envelope code exists; **unprovisioned** (no `AWS_REGION`, `ALTANA_KMS_KEY_ID`, `ALTANA_KMS_PROVIDER`); admin signing = dev-only `ALTANA_TESTNET_PRIVATE_KEY` residual (rejected by `production-config.ts`); no remote signer | —                  | none              | —                                              | —                             | **BLOCKED**                      |

**Agent 1906 cannot satisfy Model A without inventing `resource` and `executionCapability`.** X.91 (OUTCOME C) stands: no authoritative existing source provides those two fields. **Model A = BLOCKED.**

## 3. Model B — V2 Commercial Authority

The V2 commercial agreement (X.127 adapter) supplies, all **PASS** as commercial evidence:

- provider identity (`0xB0f768...` == registry owner == quote signer)
- `providerSig` (verified `eip191`)
- verified quote (price `1 U`, chain `97`, official commerce `0xa206...`, payment token `0xc70B...`, future expiry)
- ERC-8183 job lifecycle (622: FUNDED → SUBMITTED → COMPLETED)
- funded + completed state, real escrow, dispute-gated settlement

It does **not** supply:

- `resource` / `executionCapability` (explicitly `null` on the typed agreement)
- marketplace-as-client (Job 622's client is the buyer wallet; the marketplace client is absent)

**Can the marketplace be the actual client?** Technically yes — by creating **and funding a NEW ERC-8183 job with the marketplace client wallet** (`expectedClient`). This requires marketplace client custody and a new chain-97 transaction (not authorized; custody BLOCKED). Job 622 cannot be reused: its client is the buyer and it is COMPLETED (non-actionable per `validateVerifiedJob`).

**Is Model B sufficient alone?** No. Even with marketplace-as-client, the X.76 gate requires `resource` + `executionCapability`, which a funded escrow does not attest. Adopting Model B as the _sole_ activation authority would redefine "activation" as "funded commercial escrow" and drop the execution-capability guarantee — a semantic change the frozen boundary does not endorse and which the honesty rubric would reject as an unproven execution claim.

## 4. Job 622 Evidence

Job 622 proves the commercial protocol (negotiate → fund → submit → settle) on testnet. It is **not** evidence of "the marketplace hired Agent 1906": the marketplace is not a party to it, and its `COMPLETED` state is explicitly non-actionable for activation.

## 5. Critical Test — New Evidence Required for Marketplace → Hire → Activation

To prove `Marketplace → Hire → Agent 1906 → commercial agreement → marketplace client → ERC-8183 job → funding → activation`, the following new evidence is required:

- A **new marketplace-client ERC-8183 job** (marketplace is `client`), provider = Agent 1906 owner, `description = buildJobDescription(verified quote)`, `budget = 1 U`, status `FUNDED`/`SUBMITTED`.

**Transaction required (STOP before broadcast — none authorized):**

- Type: ERC-8183 hire batch `createJob → registerJob → setBudget → approve → fund` on **BSC Testnet (97)**.
- Signer: the **marketplace ERC-8183 client wallet/session** — NOT the seller (`0xB0f7...`), NOT the buyer (`0x299C...`).
- Custody requirement: marketplace client custody (KMS envelope + management/admin signer) — **BLOCKED** (X.75, unchanged).
- Expected cost: `1 U` (1e18 raw) budget + tBNB gas (or paymaster).
- Testnet/mainnet: testnet only (chain 97; mainnet never).
- Exact authorization required: explicit milestone authorization, provisioned marketplace client custody, a marketplace client wallet, and (for Model A) an execution-capability attestation.

Additionally, to satisfy the X.76 gate, the job must carry or be supplemented by an authoritative, job-bound `resource` + `executionCapability` attestation (Model A), or the activation semantics must be explicitly re-decided (Model B).

## 6. Capability Attestation Option

A legitimate attestation must identify: exact resource, exact execution capability, provider identity, chain, expiry, signer, and job/commerce binding. Candidates:

- Registration file (`X.84`): self-asserted, mutable, not job-bound — **discovery, not authority**.
- Signed quote (`X.85` / official SDK): cryptographically valid but **contains no `resource`/`executionCapability`** — commercial only.
- 8004scan: identity/metadata only.
- ALTANA skills: `executable:false` self-declared catalog.

**No authoritative publisher exists for a job-bound `resource` + `executionCapability` attestation. CAPABILITY AUTHORITY = BLOCKED.** No execution resource is invented to satisfy X.76.

## 7. Marketplace Custody Audit

| Mechanism                                | Status                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Remote signer                            | **None implemented** (no `RemoteSigner` in codebase)                                                                            |
| AWS KMS                                  | Code exists (`AwsKmsProvider`), **resources not provisioned** (no region/key/provider env)                                      |
| Wallet abstraction / session-key custody | Altana session custody code exists, **unprovisioned**                                                                           |
| Server-side signing                      | `ALTANA_TESTNET_PRIVATE_KEY` residual in `altana-session/index.server.ts:53` — **dev-only**, rejected by `production-config.ts` |
| Environment credentials                  | None of the KMS/admin/client variables present in local or production config                                                    |
| Browser wallet                           | SIWE auth only; not a marketplace transaction custodian                                                                         |

No credentials added, no production keys generated, and seller/buyer keys are never used as marketplace custody.

## 8. Final Decision

**D — PRODUCTION HIRE MUST REMAIN FAIL-CLOSED.**

- **Model A** cannot be satisfied: `resource` and `executionCapability` have no authoritative source, and the marketplace-client job + custody do not exist.
- **Model B** cannot be adopted without weakening/altering the security model: it lacks an execution-capability authority, the marketplace is not the ERC-8183 client, and no custody exists.
- **Both require additional external authority**, so **C also applies** — the exact external prerequisites are:

1. An authoritative, job-bound, provider-signed `resource` + `executionCapability` attestation publisher (LEVEL 2–4 per X.91) — **does not exist** (required for Model A; also required to preserve the execution-capability guarantee if Model B is adopted).
2. Explicit activation-semantics decision (Model A capability authority vs Model B commercial-escrow authority) by the project owner.
3. Marketplace ERC-8183 client custody: provision AWS KMS (region/key/provider + runtime identity), a compliant management/admin signer, and a marketplace client wallet.
4. A NEW marketplace-client ERC-8183 job (transaction) — requires the above custody + explicit authorization.
5. A reachable, registered seller endpoint (Agent 1906 metadata currently references the expired tunnel).

## 9. Recommended Path (future, NOT automatic)

1. Keep production fail-closed (Hire `403`/`409`, Altana `503`) — no change now.
2. When authorized: obtain/adopt an authoritative capability source (Model A) or formally adopt Model B semantics.
3. Provision marketplace client custody (KMS + admin signer) and a marketplace client wallet.
4. Create and fund a marketplace-client ERC-8183 job using the X.127 adapter's verified quote.
5. Wire `VerifiedFundedErc8183JobEvidence` (with `resource`/`executionCapability` satisfied or Model B semantics adopted) into `evaluateActivationGate` with `custodyAvailable: true`.
6. Update Agent 1906's registered endpoint.

## 10. Tests / Checks

X.128 changed no production code. The relevant suites were re-run green in X.127 and re-confirmed this milestone: `activation:hire:verify`, `activation:hire-api:verify`, `activation:capability-source:verify`, `activation:x80:verify`, `activation:x81:verify`, `security:x49:verify`, `security:x55:verify`, X.84/X.85, `altana:erc8183:verify`, and the X.127 adapter verify (44 checks). `apps/web` + `packages/integrations` typecheck/lint/build/format PASS.

## Classification

- RUBRIC INTERPRETATION: PASS — the repository enforces Model A as its frozen acceptance boundary; PRD requires honest, permissioned hire.
- MODEL A (X.76): BLOCKED — `resource`/`executionCapability` have no authoritative source; Agent 1906 cannot satisfy without invention; marketplace-client binding and custody absent.
- MODEL B (V2 commercial): BLOCKED as sole activation authority — lacks execution-capability authority, marketplace is not the client, custody absent; adoption would alter activation semantics.
- PROVIDER AUTHORITY: PASS — provider identity verified (registry owner == signer == `job.provider`).
- QUOTE AUTHORITY: PASS — `providerSig` verified (eip191, chain 97, commerce binding, 1 U).
- CAPABILITY AUTHORITY: **BLOCKED** — no authoritative publisher for job-bound `resource`/`executionCapability`.
- MARKETPLACE CUSTODY: BLOCKED — KMS/admin custody unprovisioned; no remote signer; no marketplace client wallet.
- MARKETPLACE-AS-CLIENT: BLOCKED — requires a new funded job (custody + transaction + authorization).
- PRODUCTION SAFETY: PASS — fail-closed preserved (Hire `403`, Altana `503`).
- FINAL DECISION: **D — PRODUCTION HIRE MUST REMAIN FAIL-CLOSED** (with C: both models require additional external authority).

No private key, password, mnemonic, seed phrase, or keystore contents are included in this report.
