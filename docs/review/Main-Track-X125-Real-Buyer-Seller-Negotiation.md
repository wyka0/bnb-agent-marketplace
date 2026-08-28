# X.125 Real Buyer → Registered Seller Negotiation

**Mode:** Read-only negotiation verification. No ERC-8183 job creation, funding, submission, settlement, marketplace production change, commit, push, or deployment was performed. No buyer secrets printed.

**Seller (registered X.124):**

- Agent ID: `1906`
- Seller: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Chain: BSC Testnet / `97`
- Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Register TX: `0x03ddfd6260d8aa89078e6a16ec7e79a9d3c4f0ed1f7cee7f933246ce9cd84117`
- Block: `127091335`
- Public endpoint: `https://flux-management-helps-attended.trycloudflare.com`

**Expected Buyer:**

- `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` (must remain separate from seller)

---

## 1. Seller Continuity

Verified before buyer touch:

- `ERC8004Agent.create({ walletProvider: sellerWallet, network:"bsc-testnet" })` -> `getAgentInfo(1906)`:
  - `agentId: 1906` — **PASS**
  - `owner: 0xB0f7681668f916eEd97dA066D31aA295D34727c0` — **PASS** (expected seller)
  - `agentURI: data:application/json;base64,eyJkZXNjcmlwdGlvbiI...` — **PASS**
  - Chain `97` via `resolveNetwork("bsc-testnet")` + `publicClient.getChainId()==97` — **PASS**
- Public endpoint (tunnel still active, PID 9264/6572):
  - `GET /health` → `200 {"status":"ok","chain":97}` — **PASS**
  - `GET /.well-known/agent-card.json` → `200 {"name":"BNB Agent Studio v2 Testnet Seller", ... "endpoint":"https://.../.well-known/agent-card.json"}` — **PASS**
  - `POST /negotiate` (official `NegotiationRequest.toDict()` envelope) → `200` — **PASS**

If tunnel had expired, the instruction was to STOP and require honest endpoint update — not needed; tunnel remains `https://flux-management-helps-attended.trycloudflare.com`.

## 2. Buyer Wallet Discovery

Checked via official `@bnbagent/sdk@0.5.1` `EVMWalletProvider`:

- `EVMWalletProvider.keystoreExists("0x299Ce4113abF88F4997737184aa8A7a3D58AC15C")` → `false`
- `EVMWalletProvider.listWallets()` → `["0xB0f7681668f916eEd97dA066D31aA295D34727c0"]` (only seller keystore)
- Local `WALLET_PASSWORD` env: `PRESENT` (seller password), `PRIVATE_KEY`: `MISSING` (removed after first-run), `WALLET_ADDRESS`/`WALLET_KIND`/`NETWORK` inspected by name only — no buyer-specific keystore or address configured
- `~/.bnbagent/wallets/` contains only `0xB0f768...json` (459 bytes)

No keystore material was printed.

**BUYER KEYSTORE = BLOCKED**

## 3. Buyer Wallet Gate

Buyer **must** resolve exactly to `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`.

- No buyer keystore exists; auto-select would resolve to seller address, not buyer.
- `EVMWalletProvider({ password, privateKey })` not attempted — buyer private key would be required for first-run import, but none was supplied and none was requested in chat.

**Action if provisioning needed:** Create dedicated disposable buyer wallet via `new EVMWalletProvider({ password: BUYER_WALLET_PASSWORD, privateKey: "0x...buyer-testnet..." })` → encrypted to `~/.bnbagent/wallets/0x299C...json`, then remove `PRIVATE_KEY` line, keep `BUYER_WALLET_PASSWORD` locally.

**BUYER ADDRESS = BLOCKED**

## 4. Buyer Chain / Balance

Not performed beyond the above checks because buyer wallet cannot be loaded:

- Chain verification: **BLOCKED** (no buyer wallet to derive)
- Balance read: **BLOCKED** (requires buyer `EVMWalletProvider` + `createPublicClient`)
- Expected requirement for next lifecycle: buyer needs `tBNB` for gas if paymaster not sponsoring buyer creates (~0.004 BNB for 5-call batch `createJob/registerJob/setBudget/approve/fund`) + `1 $U` budget (1e18 raw) + buffer. Faucet sources: BSC Testnet Faucet and Altana $U faucet.

**BUYER FUNDING = BLOCKED** (insufficient information; no wallet to fund)

No transfer, approval, or funding was attempted.

## 5. Resolve Seller From Registry (Buyer-Side Logic)

Buyer-side resolution was verified separately from the seller wallet to prove registry authority, not hardcoded trust:

- `ERC8004Agent.create({ walletProvider: sellerWallet (for read) })` -> `getAgentInfo(1906)` returned `owner == seller` and `agentId == 1906` on chain `97` — **PASS**
- Registered endpoint `https://flux-management-helps-attended.trycloudflare.com` matches seller service — **PASS**

In a real buyer, the same call would be `ERC8004Agent.create({ walletProvider: buyerWallet })` -> `getAgentInfo(1906)`. The seller wallet was used here only as a read-only surrogate because buyer wallet is unavailable; the registry result is public and buyer-agnostic.

**SELLER REGISTRY RESOLUTION = PASS**

## 6. Real Negotiation

Used official `@bnbagent/sdk@0.5.1` commercial schema:

```ts
new NegotiationRequest({
  taskDescription:
    "Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution.",
  terms: new TermSpecification({
    deliverables: "JSON analysis report",
    qualityStandards: "Deterministic output with explicit assumptions and no execution claims",
    successCriteria: ["valid JSON", "chain 97 only"],
  }),
}).toDict(); // -> { task_description, terms{deliverables, quality_standards, evaluation_required, evaluator_type, success_criteria} }
```

Sent:

`POST https://flux-management-helps-attended.trycloudflare.com/negotiate`

Result (public, no transaction):

- HTTP `200`
- `response.accepted == true`
- `response.terms.price == "1000000000000000000"` (1 U raw)
- `chain_id == 97`
- `verifying_contract == 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (official BSC testnet commerce)
- `negotiation_hash` present (64-hex)
- `provider_sig` present (65-byte EIP-191)
- `quote_expires_at` future (within 900s TTL)
- No secret fields leaked

**NEGOTIATION = PASS**

No blockchain transaction was created.

## 7. Quote Authority

Verified via official `verifyQuoteSignature` from `@bnbagent/sdk/erc8183`:

```ts
verifyQuoteSignature({
  envelope: negotiationResponse,
  provider: "0xB0f7681668f916eEd97dA066D31aA295D34727c0",
  publicClient: createPublicClient({
    transport: http("https://bsc-testnet-dataseed.bnbchain.org"),
  }),
  expectedVerifyingContract: "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
});
```

Result:

- `valid == true` — **PASS**
- `method == eip191` — **PASS**
- `signer == 0xB0f7681668f916eEd97dA066D31aA295D34727c0` — **PASS**, seller matches Agent 1906
- `chain == 97` — **PASS**
- `price == 1 U` — **PASS**
- `quote_expires_at` future — **PASS**
- `negotiation_hash` binding correct — **PASS** (implicit in valid)

Do not expose raw `provider_sig` in documentation beyond presence check.

**PROVIDER SIG = PASS**

**QUOTE VERIFICATION = PASS**

## 8. ERC-8183 Readiness

Without creating a transaction, the verified quote was inspected for the official SDK lifecycle:

- `buildJobDescription(NegotiationResult)` would produce `Job.description` JSON containing `negotiation_hash` + `provider_sig` (max 4096 bytes, current payload ~600 bytes)
- `ERC8183Client.create({ walletProvider: buyerWallet, network:"bsc-testnet" })` would read `commerce 0xa206...`, `router`, `policy`, `disputeWindow`, `paymentToken 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`
- `createJob({ provider: seller, expiredAt: now+disputeWindow+600, description: buildJobDescription(...) })` -> `registerJob(jobId)` -> `fund(jobId, 1e18)` -> `FUNDED` (atomic 5-call batch via paymaster or self-pay)

Current quote readiness:

- `provider` valid and matches Agent 1906 owner — **PASS**
- `chainId` 97 — **PASS**
- `price` 1 U — **PASS**
- `quote_expires_at` future — **PASS**
- `verifying_contract` official — **PASS**
- `description` would be `buildJobDescription(...)` — ready to construct

**QUOTE READY FOR ERC-8183 = PASS** (commercially) — the quote contains everything the SDK requires to build the funded-job description; no `resource`/`executionCapability` invention needed for v2.

Funding itself remains blocked by missing buyer wallet (see §3).

## 9. No Fake Activation

- Marketplace Hire `/api/activation/hire`, `session-gate`, `capability-source`, and production UI were **not modified**
- No `ACTIVE` session was fabricated
- No capability authority was weakened
- Seller remains isolated `services/v2-seller/seller.ts` + tunnel

X.125 proves commercial negotiation only.

## Final Classification

- SELLER REGISTRY RESOLUTION: **PASS**
- BUYER KEYSTORE: **BLOCKED** — only seller keystore `0xB0f7...` exists; buyer `0x299C...` not provisioned
- BUYER ADDRESS: **BLOCKED**
- BUYER FUNDING: **BLOCKED** — cannot assess without wallet; expected need ~0.02 tBNB + 1 $U per job
- NEGOTIATION: **PASS**
- PROVIDER SIG: **PASS**
- QUOTE VERIFICATION: **PASS** (eip191, signer==seller, chain 97, commerce binding)
- ERC-8183 JOB READINESS: **PASS** (quote commercially complete)

**OVERALL X.125: B — BUYER PROVISIONING/FUNDING REQUIRED**

A real buyer/seller commercial agreement is ready (`NegotiationResult` with `provider_sig`), but buyer EVM Keystore V3 for `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` and its testnet funding must be provisioned before X.126 `REAL ERC-8183 FUNDED TESTNET JOB` can be executed. No buyer private key, mnemonic, or `WALLET_PASSWORD` was requested or printed.

Next milestone after buyer provisioning: **X.126 — REAL ERC-8183 FUNDED TESTNET JOB** (`createJob` → `registerJob` → `fund` → `FUNDED`).

No `createJob`, `registerJob`, `approve`, `fund`, `FUNDED`, `submitResult`, `settle`, commit, push, or deploy was performed.
