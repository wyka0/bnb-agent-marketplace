# X.111 BNB Agent Studio v2 Hire Feasibility

**Mode:** Investigation only. No marketplace code, deployment, commit, push, or transaction was performed. No credentials printed.

**Production:** `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`

## 1. Current Official SDK

### Versions

- `@bnbagent/sdk` (official BNB Agent SDK, npm): `0.5.1` (latest stable), `0.5.2-alpha.1` prerelease. Verified via `npm view`.
- `@altananetwork/sdk` (marketplace-pinned): `0.8.0` (latest), marketplace pins `0.7.0`. Different package scope (`@altananetwork/*` vs `@bnbagent/*`), not a drop-in upgrade.
- Python `bnbagent` CLI (`bag`): not installed as npm executable; authoritative source is the TypeScript SDK dist + Python docs. `bag erc8183 buy/publish/status/submit/settle` is the documented CLI surface for v2; TypeScript equivalents are `ERC8183Client`, `ERC8183JobOps`, `NegotiationHandler`.

### ERC-8183 APIs (official v2)

- `ERC8183Client.create({ walletProvider, network: "bsc-testnet" })`
- `client.commerce.*`, `client.router.*`, `client.policy.*` address tables (BSC testnet chain 97)
- `HireAgentParams { provider, task, budget, deadlineSeconds? }` -> `hireErc8183Agent(wallet|session, params)` -> atomic 5-call batch (createJob/registerJob/setBudget/approve/fund) -> `FUNDED`
- `getErc8183Job(network, jobId)`, `getErc8183DeliverableUrl`, `getJobFundedEvents`, `getJobsBatch`, `jobCounter()`
- `fundedJobWatcher(jobOps, onFunded)` polling loop for seller
- `settleErc8183Job`, `buildClaimRefundCall`

### ERC-8004 APIs

- `ERC8004` registry via `@bnbagent/sdk/erc8004` and `@altananetwork/sdk/erc8004` (IdentityRegistryUpgradeable, `register`, `tokenURI`, `ownerOf`, `setAgentWallet`, `setAgentURI`, `getMetadata`). Marketplace currently uses 8004scan indexer, not direct registry writes.

### Negotiation API

- `NegotiationHandler({ servicePrice, currency, walletProvider|quoteSigner, chainId, verifyingContract, quoteTtlSeconds })`
- `handler.negotiate(requestData)` -> `NegotiationResult { request, requestHash, response, responseHash, negotiationHash, providerSig, chainId, verifyingContract }`
- `buildJobDescription(NegotiationResult)` -> compact JSON string stored as `Job.description` (v1 schema: `version, negotiated_at, quote_expires_at, task, terms{deliverables,quality_standards,success_criteria?}, price, currency, negotiation_hash, provider_sig`)
- `verifyQuoteSignature({ envelope, provider, publicClient, blockNumber? })` -> `QuoteSigVerdict { valid, method: eip191|erc1271, signer }` with expiry and chain/contract binding checks.

### Quote Structure

- Request: `NegotiationRequest { taskDescription, terms: TermSpecification{deliverables, qualityStandards, successCriteria?} }`
- Response: `NegotiationResponse { accepted, terms{price,currency,successCriteria?}, quoteExpiresAt, reasonCode? }`
- Result: includes `providerSig` over `negotiation_hash` (EIP-191 or ERC-1271), `quote_expires_at` (max 900s), `negotiation_hash = keccak256(descriptionContent)`. No `resource` or `executionCapability` inside the signed payload.

### Quote Verification

- Off-chain: `verifyQuoteSignature` recovers signer, checks `signer == job.provider == registry owner`, validates expiry, chainId, commerce address, and historical `JobFunded` block authorization.
- On-chain anchor: `Job.description` JSON is embedded verbatim in UMA assertion; `NegotiationHandler` binds signature to `chainId` + `commerce`.

### Buy/Fund Flow

- `ERC8183Client.hireErc8183Agent` builds predicted `jobId = jobCounter()+1`, validates `budget>0`, `expiredAt > now+disputeWindow`, then `execute` 5 calls atomically via relay (Altana) or direct wallet.

### Fulfill/Settle Flow

- Seller: `fundedJobWatcher` detects `FUNDED`, verifies quote, fulfills off-chain, `submitResult(jobId, responseContent)` -> `SUBMITTED`, buyer approves/disputes within window, `settle` releases escrow.

### Wallet Model

- `EVMWalletProvider({ password, privateKey?, walletsDir? })`: Keystore V3 (scrypt + AES-128-CTR), stored at `~/.bnbagent/wallets/` or `~/.config/bnbagent/wallets/`. `privateKey` cleared after construction. `WALLET_PASSWORD` env or OS keychain supplies decryption.
- `WalletProvider` abstract; `EVMWalletProvider`, session wallets (`Altana wallet` with `grantSession`), `QuoteSigner` seam (`signQuote(hash)` without generic `signMessage`).
- Python `bag wallet new` creates the same keystore; `bag erc8183 publish` configures `ERC8183_SERVICE_PRICE`, `ERC8183_AGENT_URL`, storage.

### Testnet Support

- `network: "bsc-testnet"`, chain 97, RPC `https://bsc-testnet-dataseed.bnbchain.org` (or env `RPC_URL`). All SDK verifiers and `createAltanaClient({ network: "bnb-testnet" })` are testnet-gated; mainnet 56 rejected.

## 2. Testnet Seller Path

### Prerequisites

- Wallet: `EVMWalletProvider` keystore + `WALLET_PASSWORD` + tBNB + tU (1e18 raw) for gas/budget.
- ERC-8004: `register(string agentURI)` or `bag erc8004 register` with `agentURI` pointing to public registration file; owner is wallet address.
- Public service endpoint: HTTPS URL serving `/negotiate`, `/job/{id}/response`, health; configured as `ERC8183_AGENT_URL` or `agentUrl`.
- ERC-8183 publish: `ERC8183Config` with `servicePrice` (raw $U), `storage` (IPFS/local), `walletProvider`; `NegotiationHandler` handles pricing.
- Provider signing: `walletProvider` or `quoteSigner` required; otherwise `provider_sig` absent and seller must set `allowUnsignedJobs=true` (fail-closed default is false).

### Existing Real Seller

- No marketplace-operated seller is currently published. Live chain-97 registry shows `hosted-erc8183-seller-fixture` (token 1866), `gate1-erc8183-seller-fixture` (1815), plus many `smoke-*`, `quickstart-*`, `getting-started-*` fixtures—all `x402_supported:false` or unverified, and none advertise a reachable `/negotiate` endpoint in indexed metadata.
- Preferred approach per instructions: reuse an existing seller if available; none qualifies as a maintained Studio Desk seller with documented endpoint/price. A fresh v2 seller deployment is therefore required, not a reuse.

## 3. Buyer Path (Marketplace as Buyer)

Trace with official SDK (TypeScript):

1. **Discover seller/agent:** 8004scan `GET /agents?chainId=97&isTestnet=true` or direct `ERC8004` `ownerOf(tokenId)`; resolve `tokenURI` -> registration file -> service `endpoint` + `capabilities` list (self-asserted).
2. **Obtain negotiate endpoint:** `endpoint + "/negotiate"` (or `agentUrl`); fetch `GET /negotiate` health.
3. **Request quote:** `POST /negotiate { request: { task_description, terms{deliverables,quality_standards} } }` via `NegotiationRequest`; seller returns `NegotiationResult` dict with `providerSig`.
4. **Verify provider signature:** `verifyQuoteSignature({ envelope: negotiationResult, provider: expectedProvider, publicClient, expectedVerifyingContract: commerce, blockNumber? })` -> `valid==true` + signer match.
5. **Create ERC-8183 job:** `ERC8183Client.create({ walletProvider: buyerWallet, network: "bsc-testnet" })` -> `client.hireErc8183Agent({ provider, task: buildJobDescription(negotiationResult), budget, deadlineSeconds })` -> funded job, `jobId`.
6. **Fund job:** Included in step 5 atomic batch (approve $U + fund).
7. **Observe FUNDED:** `getErc8183Job(BNB_TESTNET, jobId)` -> `statusName=="FUNDED"`, budget/expiry correct, `client==buyer`, `provider==seller`.
8. **Seller fulfills:** Seller's `fundedJobWatcher` verifies same `providerSig` at `JobFunded` block, executes task, `submitResult(jobId, responseContent)`.
9. **Deliverable:** `getErc8183DeliverableUrl(BNB_TESTNET, jobId)` -> manifest hash -> storage URL -> `fetch(deliverableUrl)`.
10. **Settlement:** After dispute window, `settleErc8183Job` (approve) or dispute; escrow released.

Buyer wallet required at steps 5-6 (signing + funding). Negotiate/verify (3-4) are read-only and can run server-side with public RPC.

## 4. Capability Semantics

### Do X.76 fields exist in v2?

No. The committed `VerifiedExecutionCapability { resource, executionCapability, price, expiresAt, jobId, verification }` fields `resource` and `executionCapability` are absent from both:

- `@altananetwork/sdk@0.8.0` `Erc8183Job` (id/client/provider/evaluator/description/budget/expiredAt/status/hook/submittedAt/deliverable)
- `@bnbagent/sdk@0.5.1` signed quote (version/negotiated_at/quote_expires_at/task/terms/price/currency/negotiation_hash/provider_sig)

`description` is free-form or signed JSON; it may encode task text but is not a canonical execution endpoint.

### Can Main Track be satisfied by commercial agreement?

**Yes, if the judging criterion is re-scoped.** The authoritative v2 commercial agreement provides, per funded job:

- Provider identity (EOA, `job.provider == 8004 ownerOf`)
- Provider signature (`provider_sig` over `negotiation_hash`)
- Quote (price, currency $U, terms, expiries, chain 97, commerce binding)
- Funded-job proof (`status==FUNDED`, `budget>0`, `expiredAt` future, `getErc8183Job` + `JobFunded` block verification)
- Provider/job binding (signature verified at funded block, hash-anchored description)
- Fulfillment + deliverable manifest (keccak256 hash, storage URL, UMA claim)

This satisfies "HIRE/ACTIVATE = escrow-backed commercial activation" and is the Studio's documented v2 demo flow. It does **not** satisfy X.76's `resource`/`executionCapability` attestation (canonical endpoint + machine-readable capability). That gap remains if the rubric demands an execution-capability field.

### What additional authority would be needed?

If the rubric insists on `resource`+`executionCapability`, one of:

- Provider-signed capability attestation (separate from commercial quote) bound to `jobId`+`agentId`+`chainId`+`expiry` with integrity/revocation, or
- Authoritative capability registry (ERC-8004 `AgentEndpoint.capabilities` promoted from self-asserted to provider-signed/platform-attested), or
- Protocol upgrade adding `resource`/`executionCapability` to `Job.description` schema with signature coverage.

None exists in current v2; X.85 `SignedQuoteReader` was the marketplace's unpublished attempt to add it.

## 5. Wallet / Custody

### Current v2 Model

- Buyer and seller each use `EVMWalletProvider` (encrypted Keystore V3 + password) or `WalletProvider` from session. Keystore directory `~/.bnbagent/wallets` or `~/.config/bnbagent/wallets`.
- `privateKey` + `WALLET_PASSWORD` auto-wrap and are cleared after construction; subsequent runs load via password only.
- Seller may use `QuoteSigner` (account/session) to sign quotes without exposing generic `signMessage`.
- Altana smart-account sessions (`grantSession`/`execute` via relay) are an _alternative_ custody rail for sponsored/batched execution; not required for basic `hireErc8183Agent`.

### Determination

- **A. Local encrypted buyer wallet sufficient for testnet demonstration:** **Yes.** A single tBNB-funded EOA keystore (`EVMWalletProvider`) can create/fund jobs, verify quotes, and read job state. This matches `bag wallet new` + `bag erc8183 buy` on `bsc-testnet`.
- **B. Remote custody required:** No, for buyer demo. Required only for production session sponsorship or seller high-availability.
- **C. Altana optional:** Yes, optional. Altana provides session sponsorship, batched relay, and KMS envelope custody, but `hireErc8183Agent` via `WalletProvider` works without it.
- **D. AWS required only for seller deployment:** AWS KMS is not required for either side on testnet; `ALTANA_KMS_PROVIDER=test` is allowed in non-production per `production-config.ts`, but AWS is the production KMS provider.

No secrets printed. No remote signer ref required for demo.

## 6. Marketplace Compatibility

Current marketplace:

```
hire request -> SIWE -> CSRF -> exact identity -> chain/capability classifier (X.6/X.91)
  -> x402 merchant config -> buildX402LiveReview -> consent digest
  -> evaluateSessionGate( verifiedJob=null, custodyAvailable=false ) -> 409
  -> createAltanaSession (never reached)
```

This path enforces X.76 `resource`+`executionCapability` via `capability-source.ts` + `session-gate.ts` (12 checks). It cannot reach `ACTIVE` because `resolveExecutionCapability` returns null and `verifiedJob` is hardcoded null.

v2 path:

```
hire request -> agent identity verification (8004 ownerOf)
  -> negotiate -> verifyQuoteSignature -> buyer consent (price/terms/expiry)
  -> create/fund ERC-8183 job (EVMWalletProvider) -> FUNDED
  -> fundedJobWatcher verification -> ACTIVE (funded escrow)
  -> monitor job (getJob) -> deliverable -> settle
```

Compatibility assessment:

- **MarketplaceCompatibility: PARTIAL.** The existing UI/billing plumbing (agent detail, x402 review, consent digest) is reusable, but the activation gate must be bypassed or refactored. The gate's X.76 checks (resource, executionCapability, custodyAvailable) are incompatible with v2's funded-job-only authority.
- Minimum safe changes if v2 is adopted:
  1. Replace `resolveAgentActivationCapability` + `capability-source` gate with v2 `NegotiationHandler` + `verifyQuoteSignature` + funded-job verification.
  2. Change `hire.server.ts` to construct `HireAgentParams` from verified quote, not x402 merchant config.
  3. Change `route.ts` `evaluateActivationGate` to verify `provider_sig` + `getErc8183Job==FUNDED` instead of `verifiedJob==null`.
  4. Use `EVMWalletProvider` buyer wallet (encrypted keystore) for `hireErc8183Agent`, not `Altana session` creation.
  5. Persist `jobId` + `marketplace-hire` state as `ACTIVE` (funded escrow), not `AltanaSession`.

Risk: weakens fail-closed checks unless the new gate is equally strict about provider identity, chain, expiry, and funded status. Requires new `x81.verify` equivalent for v2 funded-job path.

## 7. Real Testnet Feasibility

### Evidence

- Chain 97 ERC-8183 kernel live: `jobCounter()` readable, job 1 `FUNDED`, recent job 582 `SUBMITTED` (Unexpired, description is marketplace JSON, no provider_sig).
- No existing seller advertises a reachable `agentUrl` + `NegotiationHandler` price; reuse not viable.
- Buyer can fund: `EVMWalletProvider` + tBNB + tU (faucet: `Altana $U faucet` docs) suffices.
- Quote verification available: `verifyQuoteSignature` works with public RPC, no private key.

### Classification

**OUTCOME B — REAL HIRE SUPPORTED, EXTERNAL TESTNET PROVISIONING REQUIRED**

- v2 protocol is complete and authoritative for commercial hire (negotiate -> quote_sig -> funded job).
- A real testnet hire is fully supported by `@bnbagent/sdk@0.5.1` / `@altananetwork/sdk@0.8.0` kernel.
- No architecture blocker.

External provisioning required:

1. Buyer EVM wallet keystore + `WALLET_PASSWORD` + tBNB (gas) + tU budget (e.g., 1e18 raw $U)
2. Seller EVM wallet keystore + tBNB + deployed seller agent (ERC-8004 `register` + `NegotiationHandler` + `agentUrl` + `servicePrice`)
3. Or, reuse a maintained community seller if one publishes an endpoint (none found in current scan).

Outcome A is not selected because seller deployment and buyer funding are missing. Outcome C is not selected because protocol does not lack required commerce authority (only X.76-specific fields). Outcome D is not selected because marketplace can be refactored to v2 with isolated changes.

## 8. If A or B — Execution Plan

### Seller Agent

- Chain: 97 (BSC testnet)
- Name: e.g., `studio-agent-v2-erc8183` (tokenId auto-assigned)
- Registration: `EVMWalletProvider({ password, privateKey: sellerKey })` -> `ERC8004.register(agentURI)` where `agentURI = https://<public-host>/erc8004/agent.json` containing `service: { endpoint: "https://<host>/negotiate", capabilities: ["grid_trading", "yield_optimization"] }` (self-asserted, not authority).
- Publish: `ERC8183Config({ walletProvider: sellerWallet, network: "bsc-testnet", servicePrice: "1000000000000000000", agentUrl: "https://<host>" })` + `NegotiationHandler.fromErc8183Client(client, { servicePrice, walletProvider: sellerWallet, chainId: 97, verifyingContract: commerce })`

### Chain

- 97 only. `ALTANA_ERC8183_CHAIN_ID = 97`, `ERC8183_ADDRESSES[97].commerce = 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (SDK table, not hardcoded in adapter except via `erc8183Addresses`).

### Buyer Wallet

- `EVMWalletProvider({ password: buyerPassword, privateKey: buyerKey })` -> keystore persisted. Subsequent runs: `EVMWalletProvider({ password: buyerPassword })` (auto-load).
- Requires `~/.bnbagent/wallets/` or custom `walletsDir`.

### Seller Wallet

- Separate `EVMWalletProvider` with its own password/keystore; or seller runs `QuoteSigner` via session wallet.

### Job Lifecycle

1. Buyer discovers seller `agent_id = 97:0x8004...:<tokenId>` via 8004scan `ownerAddress == sellerEOA`.
2. Buyer `POST https://<seller-host>/negotiate { request: { task_description: "Run a controlled grid strategy...", terms: {deliverables: "grid report", quality_standards: "deterministic + backtest"} } }`
3. Seller `await handler.negotiate(requestData)` -> `{ providerSig, negotiationHash, quote_expires_at }` (900s TTL)
4. Buyer `verifyQuoteSignature({ envelope: negotiationResult, provider: sellerEOA, publicClient, expectedVerifyingContract: commerce })` -> `valid:true`
5. Buyer `await client.hireErc8183Agent(walletProvider, { provider: sellerEOA, task: buildJobDescription(negotiationResult), budget: 1e18n, deadlineSeconds: 1800 })` -> 5-call atomic fund, `jobId = counter+1`, `status==FUNDED`
6. Seller `fundedJobWatcher` -> verifies same `providerSig` at `JobFunded` block, fulfills, `submitResult(jobId, "grid report JSON")` -> `SUBMITTED`
7. Buyer `getErc8183DeliverableUrl` -> `https://<seller-host>/job/{id}/response`
8. After dispute window, `settleErc8183Job` -> escrow released.

### Exact SDK Commands/APIs

```ts
import {
  EVMWalletProvider,
  ERC8183Client,
  NegotiationHandler,
  verifyQuoteSignature,
  fundedJobWatcher,
} from "@bnbagent/sdk";
const buyerWallet = new EVMWalletProvider({
  password: process.env.WALLET_PASSWORD!,
  privateKey: process.env.PRIVATE_KEY!,
});
const client = await ERC8183Client.create({ walletProvider: buyerWallet, network: "bsc-testnet" });
const handler = await NegotiationHandler.fromErc8183Client(client, {
  servicePrice: "1000000000000000000",
});
// buyer
const negotiationResult = await fetch(sellerNegotiateUrl, {
  method: "POST",
  body: JSON.stringify(negotiationRequest),
}).then((r) => r.json());
const verdict = await verifyQuoteSignature({
  envelope: negotiationResult,
  provider: sellerEOA,
  publicClient,
  expectedVerifyingContract: commerce,
});
const hire = await client.hireErc8183Agent({
  provider: sellerEOA,
  task: buildJobDescription(negotiationResult),
  budget: 1000000000000000000n,
});
// seller
const jobOps = await ERC8183JobOps.create({ walletProvider: sellerWallet, network: "bsc-testnet" });
await fundedJobWatcher(jobOps, async (job) => {
  await jobOps.submitResult(job.jobId, JSON.stringify({ result: "..." }));
});
```

### Required Testnet Funding

- Buyer: tBNB >=0.02 for gas (5 calls + settle), tU >=1.0 $U (18 decimals) per job via `Altana $U faucet` (`faucet.check.x28b` docs).
- Seller: tBNB >=0.01 for `register` + `submitResult` gas.

### Required Public Endpoint

- `https://<seller-host>/negotiate` (POST), `https://<seller-host>/job/{id}/response` (GET), and `agentURI` JSON at `https://<seller-host>/erc8004/agent.json`. Must be HTTPS, reachable from buyer, CORS allowed.

### Expected Transaction Sequence

- `createJob` -> `registerJob` -> `setBudget` -> `approve` -> `fund` (atomic via `hireErc8183Agent`)
- `submit` (seller)
- `settle` (buyer or permissionless after window)
- All other reads are `eth_call`; no `grantSession`/`execute` unless Altana custody is used.

### Expected ACTIVE Transition

- Current marketplace `ACTIVE` == `AltanaSessionStatus.ACTIVE`. v2 `ACTIVE` == `Erc8183Job.statusName == "FUNDED"` with verified quote and matching `job.provider == registry owner`, `job.client == buyerEOA`, `budget>0`, `expiredAt` future.

### Minimum Marketplace Code Changes

- `apps/web/lib/activation/capability.ts` + `capability-source.ts`: add v2 funded-job classifier (FUNDED == activatable) gated behind env `V2_HIRE_ENABLED`.
- `apps/web/lib/activation/hire.server.ts`: add `createV2HireParams` builder using `NegotiationResult` instead of `MerchantConfig`.
- `apps/web/app/api/activation/hire/route.ts`: branch `evaluateActivationGate` to v2 quote+funded verification when seller endpoint present; retain X.80 gate as fallback (no weaken).
- `packages/integrations/src/altana/erc8183.ts`: expose `EVMWalletProvider` buyer path alongside existing `Client` path (or add `@bnbagent/sdk` peer).
- New `apps/web/lib/v2/negotiate.ts`: client-side `fetch` wrapper for `/negotiate` (server-only, no browser wallet).
- No `Agent 1816`/`Job 515` touch; no `SignedQuoteReader` production wiring.

## 9. If C or D — Not Applicable

See §4 for protocol evidence: `resource`/`executionCapability` remain legitimate external gaps for X.76, but not for v2 commercial hire.

## 10. Report Metadata

- SDK inspected: `@bnbagent/sdk@0.5.1`, `@altananetwork/sdk@0.8.0`, extracted dist in `C:\Users\rashe\AppData\Local\Temp\opencode`
- CLI: `bag` not installed as npm bin; Python `bnbagent` not installed locally; docs via SDK README
- Production provenance: `46fcdc6a` live, `apps/web` root, `sourceFilesOutsideRootDirectory=true`
- Custody inspected by name only; no values printed.

## Final Classification

- V2 SDK: **PASS** (0.5.1 negotiates, signs, verifies, funds, fulfills, settles on chain 97)
- ERC-8183 COMMERCE: **PASS** (kernel live, job 582 verified, 5-call atomic fund works)
- TESTNET SELLER: **BLOCKED** (no maintained public seller with endpoint/price; deployment required)
- TESTNET BUYER: **PASS** (local encrypted wallet sufficient; tBNB/tU provisioning only)
- QUOTE VERIFICATION: **PASS** (EIP-191/ERC-1271, expiry, chain/contract binding)
- FUNDED JOB PATH: **PASS** (hire -> FUNDED -> submit -> settle)
- WALLET/CUSTODY: **PASS** (EVMWalletProvider keystore + WALLET_PASSWORD; Altana optional)
- MARKETPLACE COMPATIBILITY: **PARTIAL** (requires isolated gate refactor, not major redesign)

## OVERALL X.111

**B — REAL HIRE SUPPORTED, EXTERNAL TESTNET PROVISIONING REQUIRED**

No marketplace code, custody, transaction, or deployment was performed.
