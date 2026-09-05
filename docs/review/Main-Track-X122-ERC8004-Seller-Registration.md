# X.122 ERC-8004 Seller Registration

**Mode:** Testnet registration pre-flight only. No blockchain transaction, signature, registration, ERC-8183 job, endpoint exposure, marketplace change, commit, push, or deployment was performed.

## Pre-Flight Results

- SDK: `@bnbagent/sdk@0.5.1`
- Network: BSC Testnet
- Chain ID: `97` — **PASS**
- Seller address: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Expected seller address match: **PASS**
- Buyer separation: **PASS** — buyer is `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- Wallet source: encrypted Keystore V3, password-only reload — **PASS**
- Private key environment variable: absent — **PASS**
- Seller balance: `0.03 tBNB`
- Official registry: resolved through SDK testnet configuration; no registry address was invented

## Metadata Attempt

Honest metadata was prepared for:

- Name: `BNB Agent Studio v2 Testnet Seller`
- Description: dedicated BSC Testnet ERC-8183 seller identity; endpoint and fulfillment verification would be performed separately; no mainnet, production execution, performance, or completed-transaction claim
- Supported trust: ERC-8183
- Endpoints: none, because no public seller endpoint exists yet

The official SDK refused generation before any transaction construction:

```text
endpoints is required and must contain at least one endpoint
```

`ERC8004Agent.generateAgentUri()` therefore requires at least one valid HTTP/HTTPS endpoint. Registration cannot honestly proceed until the seller service has a real public URL. An endpoint was not invented.

## Transaction

- Transaction hash: **NONE**
- Block number: **NONE**
- Agent ID: **BLOCKED**
- Registration confirmation: **NOT SUBMITTED**
- Balance after transaction: unchanged at approximately `0.03 tBNB`

No signing or broadcast occurred. The buyer wallet was not used.

## Identity Verification

- ERC-8004 registration: **BLOCKED**
- Identity verification: **BLOCKED**
- Seller identity: **BLOCKED**
- Owner verification: not applicable because no identity was minted

## Seller Service Readiness

The isolated scaffold at `services/v2-seller/seller.ts` contains:

- `loadEnv()` before environment access
- `EVMWalletProvider`
- `NETWORK=bsc-testnet` enforcement
- `ERC8183_SERVICE_PRICE`
- `NegotiationHandler`
- provider signing path
- funded-job watcher

The service is not currently running and `ERC8183_AGENT_URL` is not configured. It is not yet registrable under the official SDK because the required public endpoint is absent.

## Final Classification

- ERC-8004 REGISTRATION: **BLOCKED**
- IDENTITY VERIFICATION: **BLOCKED**
- SELLER IDENTITY: **BLOCKED**
- TRANSACTION: **NONE**

## Exact Missing Requirement

Expose the isolated seller service at a real public HTTP/HTTPS endpoint and verify it before registration. Then use that actual URL with an official `AgentEndpoint` (`AgentEndpoint.a2a(baseUrl)` or `AgentEndpoint.mcp(url)`) when generating the ERC-8004 agent URI.

No ERC-8183 job, buyer action, production change, capability-source change, custody change, commit, push, deployment, or mainnet interaction occurred.
