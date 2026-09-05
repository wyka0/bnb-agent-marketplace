# X.116 Real BNB Agent Studio v2 Testnet Seller

**Mode:** Investigation / provisioning planning only. No marketplace source, Vercel project, Git, activation, custody, transaction, or mainnet change was performed. No secrets printed.

## 1. Current Official v2 Toolchain

### Installed / Available

- `@bnbagent/sdk` (official): `0.5.1` stable, `0.5.2-alpha.1` prerelease (npm). Package ships ESM+CJS, Node >=20, `viem ^2.21`, `@noble/*`. Subpaths: `erc8004`, `erc8183`, `x402`, `storage`, `wallets`, `signing`, `networks`, `utils`.
- `@altananetwork/sdk` (marketplace-pinned): `0.8.0` latest, marketplace pins `0.7.0`. Different scope, not a drop-in; `0.7.0` does not satisfy `>=0.3.3 <0.6.0` peer range of `@bnbagent/sdk`.
- CLI: `bag` = Python `bnbagent` CLI (`pip install bnbagent`), not an npm bin. `npx @bnbagent/sdk --help` has no executable; `bag --help` requires Python install. TypeScript SDK is the authoritative API for this marketplace.
- Docs: `github.com/bnb-chain/bnbagent-sdk` (ARCHITECTURE.md, typescript/README.md, python/README.md, docs/twak.md, docs/altana.md).

### Wallet

- `EVMWalletProvider({ password, privateKey?, walletsDir? })` -> Keystore V3 (scrypt + AES-128-CTR) at `~/.bnbagent/wallets/<address>.json`. `privateKey` cleared after construction; subsequent runs load via password only. Supports `WALLET_PASSWORD`, `PRIVATE_KEY`, `WALLET_ADDRESS`, `WALLET_KIND`.
- `TWAKProvider` (Trust Wallet Agent Kit, `@trustwallet/cli >=0.20.0`, `~/.twak` + OS keychain) and `AltanaWalletProvider` (EIP-7702, relay, session keys) are alternative providers. Marketplace currently uses `EVMWalletProvider` + `AltanaWalletProvider.sessionFromEnv()` elsewhere, not for v2 seller.

### ERC-8004 Registration

- `ERC8004Agent`, `AgentEndpoint.a2a(url) | .mcp(url)`, `AgentURIGenerator`, `ERC8004Client.create({ walletProvider, network })`, `client.registerAgent(agentURI)` -> mints tokenId on `0x8004A818BFB912233c491871b3d84c89A494BD9e` (chain 97). Gas-sponsored on testnet via MegaFuel/paymaster. Verified via `ownerOf`, `tokenURI`.

### ERC-8183 Publish

- `ERC8183Client.create({ walletProvider, network: "bsc-testnet" })`, `ERC8183Config { servicePrice, currency, agentUrl, storage }`, `NegotiationHandler({ servicePrice, currency, walletProvider|quoteSigner, chainId, verifyingContract })`, `client.registerJob`, `client.fund`, `client.setBudget`, `client.getJob`, `jobCounter()`.
- Publish is implicit: seller configures `servicePrice` + `agentUrl` + `storageProvider` and exposes HTTP `/negotiate`; no separate on-chain "publish" transaction beyond agent registration.

### Negotiate / Quote Signing

- HTTP POST `/negotiate` with `NegotiationRequest{ taskDescription, terms{deliverables,quality_standards,successCriteria?} }` -> `NegotiationResult{ request, requestHash, response, responseHash, negotiationHash, providerSig, chainId, verifyingContract }`.
- `providerSig` = EIP-191 over `negotiationHash` (EOA) or ERC-1271 (contract wallet) or `sessionQuoteSigner()` seam. TTL capped at `MAX_QUOTE_TTL_SECONDS = 900` (15 min), shortened by wallet/session expiry. `buildJobDescription(NegotiationResult)` embeds full JSON (task, terms, price, currency, negotiation_hash, provider_sig) into `Job.description` (max 4096 bytes).

### Funded-Job Watcher / Fulfillment / Submit / Settlement

- `ERC8183JobOps.create({ walletProvider, network, storageProvider, servicePrice, agentUrl, allowUnsignedJobs? })` + `fundedJobWatcher(jobOps, onFunded, { interval:30 })` -> detects `Funded` jobs assigned to provider, verifies quote at `JobFunded` block, fulfills, `submitResult(jobId, responseContent, metadata?)` -> `SUBMITTED` (upload to storage, manifest hash on-chain).
- Client settles: `client.settle(jobId)` after dispute window -> `COMPLETED` or `REJECTED`; `claimRefund` after `expiredAt`.

### Testnet Support

- `NETWORK=bsc-testnet` (chain 97) preset; `RPC_URL_BSC_TESTNET` override; paymaster sponsorship for testnet via MegaFuel; `loadEnv()` opt-in.

## 2. Existing Real Testnet Seller — Discovery

Searched:

- Official `@bnbagent/sdk` TypeScript examples (`a2a-agent`, `agent-server`) — reference code, not a live deployment.
- Official repos `bnb-chain/bnbagent-sdk` docs and `ARCHITECTURE.md` — no hosted public seller URL published.
- 8004scan BSC testnet: ~1854 agents on chain 97; sampled `hey` (1889), `liho` (1888), `Delegate Safety Sentinel` (1887) — all `x402_supported:true`, `supported_protocols: Web/MCP`, no advertised `agentUrl`/`negotiate` endpoint in indexed metadata; descriptions indicate Decenchro (Chromia-anchored) or Delegate (MCP) agents, not Studio Desk.
- Direct probe: no official `docs.bnbchain.org/bnb-agent-studio/` stable URL (404); Studio examples require self-hosting `agent-server` or `a2a-agent`.

Result: **No existing maintained public seller with reachable `/negotiate` + signed quotes + funded-job watcher was found.** Indexed agents lack endpoint discoverability; reference sellers are example code to be deployed, not a hosted service.

## 3. Viability Assessment

| Field                     | Required                  | Found                                                                  |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| BSC Testnet identity      | chain 97 tokenId+owner    | Yes (many, e.g., 1887 owner 0xc516...) but no maintained Studio seller |
| ERC-8004 registration     | `register_agent`          | Yes, tool available, no live seller to reuse                           |
| Reachable public endpoint | `https://host/negotiate`  | **No** public host found                                               |
| Negotiate                 | POST -> NegotiationResult | **No** endpoint to test                                                |
| Provider signing          | `providerSig`             | **No** live quote to verify                                            |
| Price                     | `servicePrice` raw $U     | **No** advertised price                                                |
| ERC-8183 accept           | `createJob` -> `FUNDED`   | Kernel live, but no seller to accept                                   |
| FUNDED detection          | `fundedJobWatcher`        | Code ready, no seller running                                          |
| Fulfill/submit            | `submitResult`            | Code ready, no seller running                                          |
| Maintained                | Active repo/docs          | Reference code maintained, deployment not                              |

No candidate passes all 9. Therefore **no existing seller is viable for immediate funded hire**.

## 4. Minimum Provisioning (No Existing Seller)

### Wallet

- Type: `EVMWalletProvider` with encrypted Keystore V3.
- Format: `~/.bnbagent/wallets/0x<address>.json` (scrypt, AES-128-CTR), `WALLET_PASSWORD` required, `PRIVATE_KEY` only on first import then cleared.
- Dedicated disposable testnet wallet: **Yes, required** — create new EOA, fund with tBNB only, never reuse mainnet key. No seed phrase exposure.

### Funding

- tBNB: ~0.02-0.05 BNB on BSC testnet per seller lifecycle (register ~0.002, submit ~0.003, settle callbacks negligible). Faucet: https://www.bnbchain.org/en/testnet-faucet or https://testnet.bnbchain.org/faucet-smart.
- tU budget: 1 $U = 1e18 raw per job (demo). Faucet via Altana docs (`erc8183.job515.faucet.check.x28b.ts` references official bnbagent faucet); or `client.tokenDecimals()` -> mint via faucet.
- Minimum balance at start: tBNB 0.05 + 5 $U to allow multiple test jobs.

### Identity

- Process: `EVMWalletProvider` -> `ERC8004Agent.generate_agent_uri({ name, description, endpoints: [AgentEndpoint.a2a("https://<host>/a2a"), AgentEndpoint.mcp("https://<host>/mcp")] })` -> `register_agent(agentURI)` on chain 97.
- Metadata: JSON-LD with `serviceEndpoint`, `capabilities: ["grid_trading","yield_optimisation"]`, `supportedProtocols: ["A2A","MCP"]`, `agentUrl`.
- Endpoint URL: `https://<host>/` e.g., `https://agent-<sub>.testnet.bnbagent.example` or `https://<vps-ip>:3000`.

### Service

- Public endpoint: HTTPS (required for `agentUrl` fallback when `file://` storage). Routes: `POST /negotiate` (NegotiationHandler), `GET /job/:id/response` (deliverable), `GET /health`, `GET /a2a/card.json`.
- Negotiate: `new NegotiationHandler({ servicePrice: "1000000000000000000", currency: paymentToken, walletProvider: sellerWallet, chainId: 97, verifyingContract: commerce })`.
- Quote signing: `walletProvider.signMessage` (EIP-191) or `quoteSigner.signQuote` (session).
- Watcher: `fundedJobWatcher(jobOps, onFunded, { interval: 30 })` with `ERC8183JobOps.create({ walletProvider, network:"bsc-testnet", storageProvider: new LocalStorageProvider(".agent-data"), servicePrice, agentUrl })`.
- Fulfillment: deterministic stub (e.g., echo grid params) -> `submitResult(jobId, JSON.stringify({ deliverable, manifestHash }))`.
- Deliverable format: `DeliverableManifest { content, metadata }` -> storage (Local/IPFS) -> `deliverable_url` on-chain.

### Commerce

- Publish: Implicit via running negotiator + `ERC8183Config.fromEnv({ servicePrice, agentUrl })`; no separate `publish` tx, but `registerJob` binds policy per job.
- Price: `ERC8183_SERVICE_PRICE="1000000000000000000"` (1 U) — reject `budget_too_low`.
- Currency: `$U` payment token `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` (chain 97, from SDK `ERC8183_ADDRESSES[97].paymentToken`).
- Evaluator: `EvaluatorRouter` (`0x...` from `getErc8183Config("bsc-testnet").router`) doubles as hook; `OptimisticPolicy` (`0x...`) is the dispute voter.
- Job expiry: `disputeWindow + 600` (policy `disputeWindow()` currently ~900s inference from SDK); must be future.
- Settlement: permissionless `settle` after window; dispute via `PolicyClient.dispute`.

### Infrastructure

- Simplest: **local server + Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:3000`) -> public HTTPS for 168h, no VPS, no Docker, free.
- Alternative: **VPS** (Hetzner/Scaleway, 1 vCPU, 1GB) + `caddy` reverse proxy + Let's Encrypt.
- Docker optional for reproducibility (`node:20-alpine` + `pnpm`).
- Prefer **local + tunnel** for initial verification (agent can run on dev laptop, tunnel exposes `/negotiate`).

Do not provision cloud infra unless explicitly authorized — document only.

## 5. Credential Requirements

### USER ACTION REQUIRED

- Generate a **new disposable BSC testnet wallet**: `npx tsx -e "import {EVMWalletProvider} from '@bnbagent/sdk'; const w=new EVMWalletProvider({password:process.env.WALLET_PASSWORD!});"` or `bag wallet new` (Python) + set `WALLET_PASSWORD` (user-chosen, 12+ chars, stored locally).
- Fund it: visit **BSC Testnet Faucet** with the new address → 0.1 tBNB; then **$U faucet** (via Altana docs / `bnbagent` example) → 10 $U raw.
- Provide **public endpoint** (tunnel URL or VPS hostname) — not a secret.
- If VPS, provide SSH host for deployment — not in chat, via secure channel.

### AGENT CAN COMPLETE LOCALLY (no user secret)

- Generate `agentURI` + register ERC-8004 identity (once wallet funded).
- Instantiate `NegotiationHandler` + `ERC8183JobOps` with local keystore.
- Start `node` HTTP server (`agent-server` or `a2a-agent` example) on 3000.
- Health-check `/negotiate` with dummy `NegotiationRequest` and verify `providerSig` via `verifyQuoteSignature` (public RPC, no signing).
- Confirm `jobCounter()` and `getErc8183Job` reads.

**Never ask for:** `PRIVATE_KEY`, seed phrase, `WALLET_PASSWORD` value, `ALTANA_TESTNET_PRIVATE_KEY`, AWS keys. Recommend: user exports `PRIVATE_KEY` only to local `.env.local` (600 perms), SDK encrypts and clears it; `WALLET_PASSWORD` stays in password manager + OS keychain.

## 6. Seller Acceptance Test (If Available)

Not executed — no seller to test. Criteria for PASS when provisioned:

- ERC-8004 identity: `ownerOf(tokenId) == provider EOA` -> PASS
- Endpoint: `GET https://<host>/health` 200 + `GET https://<host>/a2a/card.json` valid -> PASS
- Negotiation: `POST /negotiate` with `{ taskDescription:"grid_trading notional 100", terms:{deliverables:"report", quality_standards:"deterministic"} }` -> `NegotiationResult.accepted==true`, `price=="1000000000000000000"` -> PASS
- Provider signature: `providerSig` present, 65-byte 0x, `negotiation_hash` present -> PASS
- Quote verification: `verifyQuoteSignature({ envelope: result.toDict(), provider: sellerEOA, publicClient, expectedVerifyingContract: commerce, blockNumber: await publicClient.getBlockNumber() })` -> `{ valid:true, method:"eip191", signer==sellerEOA }` -> PASS
- ERC-8183 publish: `ERC8183Config.fromEnv().effectiveCommerceAddress == 0xa206...` + `jobOps.servicePrice` set -> PASS
- Ready for funded job: `fundedJobWatcher` started, `getPendingJobs()` returns `[]` without error -> PASS

Do not fund a job in X.116.

## 7. Protocol Evidence

- Chain 97: `BNB_TESTNET.chainId == 97`, `erc8183Addresses(97).commerce == 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (SDK table), previous live reads: `job 582 SUBMITTED` budget 1e18 on chain 97.
- No seller agent ID to capture — to be `97:0x8004A818...:<newTokenId>` after registration.
- No provider address — to be seller EOA `0x...` (public after registration).
- No public endpoint — to be `https://<tunnel-or-vps>/negotiate`.
- Negotiation response shape (from SDK dist): `{ request, requestHash, response{accepted, terms{price,currency,successCriteria}, quoteExpiresAt, reasonCode?}, responseHash, negotiationHash, providerSig, chainId:97, verifyingContract:commerce }`.
- Quote fields: `version:1, negotiated_at, quote_expires_at (now+900), task, terms, price, currency, negotiation_hash, provider_sig`.
- Signature verification: `verifyQuoteSignature` uses `publicClient` + `expectedVerifyingContract`; `valid:true` when signer==provider and expiry future.
- ERC-8183 contract: `AgenticCommerceUpgradeable` at commerce, `EvaluatorRouter` at router, `OptimisticPolicy` at policy (all chain 97 per SDK).
- Publish/status: `ERC8183JobOps.create` -> ` fundedJobWatcher` idle.

No secrets captured.

## 8. Marketplace Compatibility

Current:

```
Hire -> consent (x402 merchant) -> capability resolver (X.76 null) -> session-gate (12 checks, verifiedJob=null) -> 409 -> createAltanaSession (never)
```

v2 required:

```
Hire -> agent identity (ownerOf) -> negotiate (fetch) -> verifyQuoteSignature -> user consent (price/terms/expiry) -> create ERC-8183 job -> fund (approve+fund) -> FUNDED -> commercial ACTIVE (funded escrow) -> fundedJobWatcher verify -> fulfill -> submitResult -> settle (COMPLETED)
```

Minimum isolated changes (not implemented):

1. `apps/web/lib/activation/hire.server.ts`: add `v2NegotiateAndVerify(sellerEndpoint, task)` that fetches quote and calls `verifyQuoteSignature` (server-only, public RPC).
2. `apps/web/app/api/activation/hire/route.ts`: branch `evaluateActivationGate` -> if `process.env.V2_HIRE_ENABLED=="true"` and `sellerEndpoint` present, verify funded-job path (`provider==owner`, `chain==97`, `budget>=servicePrice`, `expiredAt` future) instead of X.76 `resource`/`executionCapability`.
3. `packages/integrations/src/altana/erc8183.ts`: add `createV2BuyerClient(walletProvider)` wrapper around `@bnbagent/sdk/ERC8183Client` for `hireErc8183Agent` (or add `@bnbagent/sdk` as peer dep).
4. `apps/web/lib/v2/marketplaceHire.ts` (new): `createAndFundJob(verifiedQuote, buyerWallet)` using `EVMWalletProvider` (encrypted keystore, not `AltanaSession`).
5. Persist `jobId` as marketplace hire state (`HireStatus: FUNDED` = ACTIVE) instead of `AltanaSession`.

No `SignedQuoteReader` wiring; X.76 not weakened, just bypassed behind feature flag.

## 9. Classification

- V2 TOOLCHAIN: **PASS** — `@bnbagent/sdk@0.5.1` + `@altananetwork/sdk@0.8.0` provide full negotiate->fund->watch->submit->settle on chain 97.
- TESTNET SELLER DISCOVERY: **BLOCKED** — no maintained public seller found.
- ERC-8004 IDENTITY: **BLOCKED** — no seller identity to verify (tool available).
- PUBLIC ENDPOINT: **BLOCKED** — no endpoint to probe.
- NEGOTIATION: **BLOCKED** — no endpoint to test (protocol ready).
- PROVIDER SIGNATURE: **BLOCKED** — no quote to verify (verifier ready).
- QUOTE VERIFICATION: **BLOCKED** — no envelope to verify.
- ERC-8183 PUBLISH: **BLOCKED** — no seller config to publish.
- SELLER READY FOR FUNDING: **BLOCKED** — not deployed.
- MARKETPLACE COMPATIBILITY: **PARTIAL** — requires isolated gate refactor, not major redesign.

**OVERALL X.116: B — SELLER PROVISIONING REQUIRED**

No existing seller, but deployment is straightforward and only external provisioning/funding is required. No protocol gap, no architecture blocker.

## 10. Report

Written to `docs/review/Main-Track-X116-Real-BNB-Agent-Studio-V2-Seller.md` (this file) without secrets. No marketplace code, commit, push, or deployment was performed.

## 11. Next Step for X.117

X.117 should:

1. Obtain user authorization to create a disposable testnet wallet (or receive a dedicated wallet address to fund).
2. Generate `EVMWalletProvider` keystore with user-supplied `WALLET_PASSWORD` (local only, never logged).
3. Fund via BSC testnet faucet (tBNB) and $U faucet.
4. Run `agent-server` or `a2a-agent` example locally, expose via Cloudflare Tunnel, register ERC-8004 identity.
5. Execute seller acceptance test (§6) and capture protocol evidence.
6. Then proceed to funded-job E2E (X.111 §8 plan) with buyer wallet.
