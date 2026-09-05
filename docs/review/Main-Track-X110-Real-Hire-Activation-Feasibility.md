# X.110 Real Hire Activation Feasibility

**Audit mode:** Read-only investigation. No activation code, provider, custody, credential, job, transaction, deployment, commit, or push was created or changed.

**Production release:** `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`

## 1. Current Activation Graph

The committed production flow is:

```text
POST /api/activation/hire
  -> safe mutation / same-origin check
  -> CSRF check
  -> authenticated wallet identity
  -> exact 8004scan agent identity resolution
  -> chain/capability classification
  -> activation review + consent digest
  -> X.80 session gate
       -> exact identity binding
       -> consent commitment verification
       -> verified funded ERC-8183 job evidence
       -> provider/client/chain/status/expiry checks
       -> canonical resource
       -> machine-readable execution capability
       -> custody availability
  -> create Altana session
  -> persisted ACTIVE session
```

The current route does not resolve real job or capability evidence. It explicitly passes:

```text
verifiedJob: null
custodyAvailable: false
```

Therefore production cannot reach session creation, even after authentication and consent.

## 2. Current Gates

Every required gate is fail-closed:

1. Safe same-origin mutation request
2. Matching CSRF cookie/header
3. Authenticated user and verified wallet ownership
4. Exact `{chain}:{registry}:{tokenId}` identity match
5. BNB testnet chain 97
6. Real activation capability and positive price
7. Valid immutable review and consent digest
8. Verified funded ERC-8183 job
9. Exact job client and registry-owner/provider binding
10. Actionable status (`FUNDED` or `SUBMITTED`) and unexpired job
11. Canonical resource and specific execution capability
12. Trusted verification provenance
13. Available custody/session signer infrastructure
14. Persistent database/session creation

Production currently fails gates 6, 8–13 before an ACTIVE transition.

## 3. Production Capability Resolution

`resolveAgentActivationCapability()` returns `null` for every real registry record because 8004scan exposes no action, price, expiry, job ID, resource, or verified execution capability.

`resolveExecutionCapability()` is a typed provider boundary only. It returns `null` unless an explicit authoritative provider is supplied. No authoritative provider is committed or wired into the production route.

The production route consequently classifies chain-97 records as `CAPABILITY_UNKNOWN` and rejects chain-56 records as `NOT_ACTIVATABLE`.

## 4. ERC-8183 Findings

The official Altana integration supports real chain-97 read and construction paths:

- Resolves official commerce/router/policy/registry/payment-token addresses
- Reads on-chain jobs
- Validates provider, client, budget, expiry, and status
- Builds the atomic five-call hire batch
- Refuses mainnet
- Stops before signing/broadcast when no signer is supplied

The latest published `@altananetwork/sdk@0.8.0` was inspected. Its `Erc8183Job` schema is:

```text
id, client, provider, evaluator, description, budget, expiredAt,
status, statusName, hook, submittedAt, deliverable
```

It still has no canonical `resource` and no `executionCapability` field. Its `description`/`task` remains opaque task text or an anchored signed-quote JSON, not an SDK-defined execution-capability attestation.

## 5. Real Testnet Job Findings

The chain-97 ERC-8183 kernel is live. Safe reads found:

- Job counter: `595`
- Job `1`: real `FUNDED` job, but expired, pre-submission, and described only as “Latest BNB Chain ecosystem news”
- Recent bounded window `571..595`: one unexpired actionable job, job `582`

Job `582` is real and currently `SUBMITTED`, but it cannot satisfy marketplace activation authority:

- Client equals provider
- Provider has no matching chain-97 8004scan identity in the live owner lookup
- Description contains marketplace/mission/quote/price/goal/params fields
- No `provider_sig`
- No canonical `resource`
- No `executionCapability`
- No deliverable URL was resolved by the SDK read

This proves real ERC-8183 testnet activity exists. It does not prove a marketplace-hire capability for any marketplace agent.

## 6. BNB Agent SDK Findings

The latest published official `@bnbagent/sdk@0.5.1` was inspected.

It provides a real signed commercial negotiation protocol and `verifyQuoteSignature()` supporting EIP-191/ERC-1271 verification. Its signed negotiation content includes:

- task and terms
- price and currency
- quote expiry
- negotiation hash
- provider signature
- optional chain and verifying-contract binding

It does not provide canonical execution `resource`, machine-readable `executionCapability`, or an intrinsic marketplace agent/job identity binding sufficient for `VerifiedExecutionCapability`.

The quote can prove that a provider agreed to commercial terms. It cannot, by itself, prove which executable endpoint/method the provider authorizes for the funded job.

## 7. Capability Authority Findings

No actually available source satisfies all authority requirements:

- 8004scan: identity and descriptive metadata only
- ERC-8183 job state: authoritative commercial state, but no resource/execution capability
- BNB Agent SDK quote: provider-signed commercial terms, but no resource/execution capability
- Registration file: self-asserted, mutable, off-chain, and not job-bound
- X.85 SignedQuoteReader: excluded experimental adapter with no real publisher/source
- x402 flag: boolean advertisement, not execution authority
- MCP/A2A protocol tags: endpoint/protocol descriptions, not job-bound authority
- TermiX reputation: read-only reputation, not capability authority

No provider-signed capability document, authoritative capability registry, or protocol-level job-bound capability attestation was found.

## 8. Custody Findings

### Production project

Production variable names present:

- `RATE_LIMIT_BACKEND`
- `AUTH_CANONICAL_ORIGIN`
- `E8004SCAN_API_KEY`
- `DATABASE_URL`
- `PRISMA_QUERY_ENGINE_LIBRARY`

Required Altana/custody names are absent.

### Required status

- `ALTANA_TESTNET_PRIVATE_KEY` available: **NO**
- AWS KMS custody available: **NO**
- Required Altana session infrastructure available: **NO**

Missing configuration includes, at minimum:

- Altana testnet public activation addresses/client configuration
- AWS region and Altana KMS key ID
- Production remote-signer custody provider/reference
- A session signing implementation consistent with production policy

There is also an implementation mismatch: the current server session entry requires a raw `ALTANA_TESTNET_PRIVATE_KEY`, while production policy explicitly rejects raw admin keys and requires remote-signer references. The remote-signer references are not consumed by that session entry.

No credential value was inspected or printed.

## 9. Existing Agent Findings

### Chain-56 Aave agent

- Registry identity: real and live
- Safe MCP endpoint: reachable
- BSC support: confirmed read-only
- Activation status: not viable because marketplace activation is chain 97 only
- No job-bound capability authority

### Chain-97 registry agents

Live 8004scan contains numerous chain-97 identities, including A2A/Web/MCP labels. The bounded current query showed no verified records. These labels and descriptions do not establish execution authority.

### Agent 1816

- Real chain-97 registry identity
- Description: read-only wallet snapshot
- `x402_supported`: false
- No execution capability
- No funded activation job was created or used

### Providers of real observed jobs

- Job 1 provider maps to several unverified smoke/test ERC-8004 identities, but the job does not identify a specific registry identity or executable resource and is expired.
- Job 582 provider has no matching registry identity in the live owner lookup and carries no signed capability/resource fields.

No existing agent satisfies all identity, provider, testnet, funded-job, endpoint, execution-capability, and custody requirements.

## 10. Exact Blockers

The governing blocker is authority, not merely credentials:

1. No authoritative, job-bound canonical resource
2. No authoritative, job-bound machine-readable execution capability
3. No real provider-signed capability publisher/document supplying those fields
4. No viable job-to-exact-registry-agent binding for an actionable unexpired job
5. Production route does not resolve any real verified job and explicitly passes `null`
6. Production custody/session signer infrastructure is unprovisioned and not fully implemented for the required remote-signer policy

Provisioning custody alone would not unblock activation because capability authority remains absent.

## 11. Exact Minimum Real Path

Real activation requires all of the following before implementation:

1. An authoritative provider-controlled capability mechanism that signs or attests:
   - exact ERC-8004 agent/provider identity
   - exact ERC-8183 job ID
   - canonical HTTPS/A2A/MCP resource
   - specific executable method/capability
   - issued/verified timestamp and expiry
   - chain and commerce-contract binding
   - revocation/status semantics
2. A real chain-97 registry agent controlled by that provider
3. A real funded, unexpired ERC-8183 job whose client/provider match marketplace expectations
4. Verification of the attestation at or before job funding
5. Production remote-signer/KMS custody and a session adapter that uses it without raw environment keys
6. Public activation addresses and exact marketplace client configuration
7. Wiring from the authoritative resolver into `evaluateSessionGate`
8. Independent testnet verification before allowing ACTIVE

None of these missing authority fields may be inferred from description, protocol tags, x402 support, or unsigned JSON.

## 12. Classification

The outcome is:

**OUTCOME C — PROTOCOL/SCHEMA STILL LACKS REQUIRED AUTHORITY**

This is selected over Outcome B because external credentials alone are insufficient. Even with custody provisioned, no currently available authoritative source supplies the job-bound resource and execution-capability semantics required by the gate.

Outcome D is not selected because real chain-97 registry agents and real funded jobs do exist. They simply do not form a viable, authoritative marketplace activation chain.

## 13. Production Safety

Production remains unchanged and fail-closed:

- `POST /api/activation/hire` unauthenticated → `403`
- `GET /api/altana/session` → `503`
- No ACTIVE session
- No fabricated capability or job
- No transaction
- No provider or custody change

## Final Output

- REAL HIRE FEASIBILITY: **BLOCKED**
- CAPABILITY AUTHORITY: **BLOCKED**
- ERC-8183 TESTNET PATH: **BLOCKED** for marketplace activation; real read/job rail exists
- CUSTODY: **BLOCKED**
- TESTNET AGENT: **BLOCKED** for viable authoritative activation; identities exist
- FUNDED JOB: **PASS** for existence; **BLOCKED** for viable marketplace binding

## OVERALL X.110

**C — AUTHORITY STILL MISSING**

No code change, deployment, commit, push, credential request, job creation, signing, funding, broadcast, transaction, ACTIVE session, Agent 1816 change, or Job 515 change was performed.
