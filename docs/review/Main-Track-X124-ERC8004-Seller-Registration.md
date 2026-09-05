# X.124 ERC-8004 Seller Registration

**Mode:** Single BSC Testnet ERC-8004 registration transaction via official `@bnbagent/sdk@0.5.1`. No ERC-8183 job, funding, submit, settle, marketplace production, commit, push, or deployment change beyond the single registration.

**Production:** `850454da8f49f48285c31b8322215e55d37967a0` (README docs), Vercel `apps/web`, `46fcdc6` fix live. Production Hire remains fail-closed.

## Pre-Flight

- `loadEnv("C:/bnb-agent-marketplace")` with `WALLET_PASSWORD` present, `PRIVATE_KEY` absent — **PASS**
- `EVMWalletProvider` password-only reload → seller `0xB0f7681668f916eEd97dA066D31aA295D34727c0` — **PASS**, expected address match
- Buyer separation: seller `0xB0f768...` ≠ buyer `0x299C...` — **PASS**
- Chain 97 via `resolveNetwork("bsc-testnet")` + `publicClient.getChainId()==97` — **PASS**
- Balance before: `0.03 tBNB` (`30000000000000000` wei) — sufficient for registration (sponsored)
- Public endpoint reachable: `https://flux-management-helps-attended.trycloudflare.com` — **PASS**
- Local `GET /health` → `200 {"status":"ok","chain":97}` — **PASS**
- Local `GET /.well-known/agent-card.json` → `200` — **PASS**
- Public `GET /health` → `200` — **PASS**
- Public `GET /.well-known/agent-card.json` → `200` — **PASS**
- Public `POST /negotiate` → `200`, accepted, `providerSig` present, `verifyQuoteSignature` → `valid:true, method:eip191, signer==seller, chain 97, price 1 U` — **PASS**

## Official Registry

- SDK: `@bnbagent/sdk@0.5.1` `ERC8004Agent.create({ walletProvider, network:"bsc-testnet" })`
- Registry address (resolved, not invented): `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Chain ID: `97`
- Seller address: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`

## Agent Endpoint

- Official `AgentEndpoint.a2a("https://flux-management-helps-attended.trycloudflare.com", { capabilities: ["erc8183-negotiate"] })`
- SDK accepted endpoint before submission — **PASS**
- Endpoint: `https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json`
- Endpoints array length: 1

## Registration Payload

- Name: `BNB Agent Studio v2 Testnet Seller`
- Description: `BSC Testnet ERC-8183 service seller — real negotiated quote service, testnet-only`
- Endpoints: `[A2A @ https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json]`
- SupportedTrust: `["erc8183"]`
- AgentUri scheme: `data:application/json;base64,eyJkZXNjcmlwdGlvbiI...` (base64 data URI, 30-byte prefix captured)
- No mainnet, production, performance, or completed-job claims.

## Transaction Safety

- From: seller `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- To: official testnet registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Chain: `97` (verified via RPC before submission)
- No buyer wallet used
- No mainnet target

## Transaction

- Hash: `0x03ddfd6260d8aa89078e6a16ec7e79a9d3c4f0ed1f7cee7f933246ce9cd84117`
- Block: `127091335`
- Gas used: `621926`
- Status: `success`
- Agent ID: `1906`

Broadcast via MegaFuel paymaster sponsorship (bsc-testnet sponsored chain); `balanceTBNBBefore == balanceTBNBAfter == 0.03 tBNB` confirms sponsorship, not self-pay.

## Post-Registration Verification

- `agent.getAgentInfo(1906)`:
  - `agentId: 1906`
  - `owner: 0xB0f7681668f916eEd97dA066D31aA295D34727c0` — **PASS**
  - `agentAddress: 0xB0f7681668f916eEd97dA066D31aA295D34727c0` — **PASS**
  - `agentURI: data:application/json;base64,eyJkZXNjcmlwdGlvbiI...` — prefix verified
- Chain: `97` — **PASS**
- Endpoint: actual `https://flux-management-helps-attended.trycloudflare.com` — **PASS**
- Identity publicly resolvable via SDK registry read — **PASS**

## Endpoint Continuity

After registration:

- `GET /health` (local + public) → `200` — **PASS**
- `GET /.well-known/agent-card.json` (local + public) → `200` — **PASS**
- `POST /negotiate` (public) → `200`, accepted `true`, `providerSig` present — **PASS**
- `verifyQuoteSignature` → `valid:true, method:eip191, signer==seller, chain 97, price 1 U, expiry future` — **PASS**

## Balance After Transaction

- `balanceTBNBAfter: 0.03 tBNB` — unchanged due to sponsorship.

## Final Classification

- ERC-8004 REGISTRATION: **PASS**
- AGENT IDENTITY: **PASS** (1906 owned by seller)
- ENDPOINT: **PASS** (public, reachable, accepted by SDK)
- PROVIDER SIGNATURE: **PASS** (post-registration verification)

**OVERALL X.124: PASS**

Next milestone: **X.125 — REAL BUYER → SELLER NEGOTIATION**

Boundary: No ERC-8183 job, funding, submit, settle, buyer wallet use, capability-source change, production modification, commit, push, or deployment was performed.

Never included: `PRIVATE_KEY`, `WALLET_PASSWORD`, mnemonic, seed phrase, keystore contents.
