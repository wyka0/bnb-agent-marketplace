# X.117 Testnet Seller Provisioning

**Mode:** Investigation only. No marketplace source, Vercel project, Git, activation, custody, transaction, or mainnet change was performed. No secrets printed or committed.

**Production:** `850454da8f49f48285c31b8322215e55d37967a0` (README docs), Vercel `apps/web`, `sourceFilesOutsideRootDirectory=true`, `buildCommand: cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web`.

## 1. Prerequisites — Determined From @bnbagent/sdk@0.5.1

### Wallet

- Type: `EVMWalletProvider({ password, privateKey?, walletAddress?, walletsDir? })` — Keystore V3 on disk (`~/.bnbagent/wallets/<address>.json`, scrypt + AES-128-CTR). `password` required, `privateKey` only on first import then cleared from memory and never survives as field.
- Format: Keystore V3, `WALLET_PASSWORD` env, optional `WALLET_ADDRESS` disambiguation, `WALLET_KIND=evm` default.
- Testnet disposable wallet: **sufficient and required**. No production wallet reuse.

### Funding

- tBNB: BSC Testnet faucet https://www.bnbchain.org/en/testnet-faucet or https://testnet.bnbchain.org/faucet-smart — 0.1 tBNB per request, covers `register_agent` (~0.002), `createJob` batch (~0.004), `submit` (~0.003).
- tU: via Altana $U faucet referenced in `erc8183.job515.faucet.check.x28b.ts` docs; or `client.tokenDecimals()` -> 1 $U = 1e18 raw.
- Minimum for seller: ~0.05 tBNB + 5 $U to allow multiple test jobs.

### Identity

- ERC-8004: `ERC8004Agent.generate_agent_uri({ name, description, endpoints: [AgentEndpoint.a2a(url), AgentEndpoint.mcp(url)] })` -> `register_agent(agentURI)` on `0x8004A818BFB912233c491871b3d84c89A494BD9e` chain 97. Returns `tokenId`, forms `agent_id = 97:0x8004...:<tokenId>`, `owner_address == provider EOA`.
- Metadata: `agentUrl` = public base URL, `servicePrice` string, capabilities list (informational).
- Endpoint URL: HTTPS, e.g., `https://<tunnel>.trycloudflare.com` or `https://vps.example.com`.

### Service

- HTTP routes (reference `typescript/examples/agent-server` and `a2a-agent`): `POST /negotiate` (NegotiationHandler), `GET /health`, `GET /a2a/card.json`, `GET /job/:id/response` (deliverable fallback).
- Negotiate: validate `taskDescription`, `terms.deliverables`, `terms.quality_standards`, return `NegotiationResult` dict with `providerSig`.
- Quote signing: `walletProvider.signMessage` (EIP-191) or `quoteSigner.signQuote` (session). `quoteTtlSeconds` <= 900.
- Watcher: `ERC8183JobOps.create({ walletProvider, network:"bsc-testnet", storageProvider, servicePrice, agentUrl })` + `fundedJobWatcher(jobOps, onFunded, {interval:30})`.
- Fulfillment: deterministic stub -> `jobOps.submitResult(jobId, "computed result", {model})` -> uploads to `LocalStorageProvider` or `IPFSStorageProvider`, on-chain `deliverable = manifestHash`.
- Settle: Permissionless after dispute window; `policy.disputeWindow()` currently ~900s-86400s per network; `allowUnsignedJobs:false` default (strict).

### Commerce

- Publish: No separate on-chain publish; seller is "published" when `NegotiationHandler` is configured with `servicePrice` + `agentUrl` and `ERC8183JobOps` is running. Optional `ERC8183_AGENT_URL` env overrides.
- Price: `ERC8183_SERVICE_PRICE="1000000000000000000"` (1 U) floor; `servicePrice: bigint` in `ERC8183JobOps.create`.
- Currency/payment token: Immutable `$U` `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` fetched via `client.paymentToken`.
- Evaluator/Policy: `EvaluatorRouter` + `OptimisticPolicy` from `getErc8183Config("bsc-testnet")` (`commerce 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`).
- Job expiry: `BigInt(Date.now()/1000) + disputeWindow + 600` (must exceed `disputeWindow`).
- Settlement: `client.settle(jobId)` after window, or `client.dispute` + `voteReject` -> `REJECTED`.

### Infrastructure

- Simplest: **Local Node + Cloudflare Tunnel** — `npm run example:agent-server` on localhost:3000 + `cloudflared tunnel --url http://localhost:3000` -> `https://<id>.trycloudflare.com` (168h, free, HTTPS). No VPS, no Docker, no domain.
- Alternative: VPS (1 vCPU/1GB) + Caddy + Let's Encrypt, or Vercel serverless for `/negotiate` (not recommended for watcher).
- **Prefer local + tunnel for X.117 verification** — no cloud provisioning unless explicitly authorized.

## 2. Wallet — Verdict

- Existing keystore: Checked `$HOME/.bnbagent/wallets`, `C:\Users\rashe\.bnbagent\wallets`, marketplace `.env*` — **none found**. `get-ChildItem` returned False, `.env.example` has empty `PRIVATE_KEY`/`WALLET_PASSWORD`.
- Encrypted keystore format: Verified Keystore V3 on disk is the official format (SDK `encryptKeystoreV3`/`decryptKeystoreV3`, `scrypt`).
- `WALLET_PASSWORD` requirement: Required for `EVMWalletProvider`; unused by `TWAKProvider`.
- Dedicated testnet wallet sufficient: **Yes** — `EVMWalletProvider` with `WALLET_PASSWORD` + `PRIVATE_KEY` (first run) is the documented quickstart and is sufficient for both buyer and seller on `bsc-testnet`. No Altana custody or AWS KMS required for testnet.
- **Status: WALLET BLOCKED — no disposable testnet wallet provisioned.** Creation requires explicit user authorization; no private key was generated or printed.

## 3. Testnet Funding — Verdict

- tBNB required: ~0.05 BNB for full seller lifecycle (register + multiple jobs + submit/settle).
- Source: BSC Testnet Faucet (official). $U via Altana faucet per bnbagent docs.
- Mainnet funds: Not used or requested.
- **Status: FUNDING BLOCKED — wallet does not exist to fund; faucet not invoked.** No mainnet spend.

## 4. Seller Implementation — Minimal Service

Isolated seller service (outside `apps/web`, e.g., `C:\bnb-agent-marketplace\services\v2-seller\`):

```ts
// seller.ts — TypeScript, @bnbagent/sdk@0.5.1
import {
  EVMWalletProvider,
  ERC8183JobOps,
  NegotiationHandler,
  fundedJobWatcher,
} from "@bnbagent/sdk";
import { LocalStorageProvider } from "@bnbagent/sdk/storage";
import { createServer } from "node:http";

const wallet = new EVMWalletProvider({ password: process.env.WALLET_PASSWORD! }); // keystore on disk
const jobOps = await ERC8183JobOps.create({
  walletProvider: wallet,
  network: "bsc-testnet",
  storageProvider: new LocalStorageProvider("./.agent-data"),
  servicePrice: BigInt(process.env.ERC8183_SERVICE_PRICE!), // "1000000000000000000"
  agentUrl: process.env.ERC8183_AGENT_URL!, // https://<tunnel>
  allowUnsignedJobs: false,
});
const handler = await NegotiationHandler.fromErc8183Client(jobOps.erc8183Client!, {
  servicePrice: process.env.ERC8183_SERVICE_PRICE!,
});

createServer(async (req, res) => {
  if (req.url === "/negotiate" && req.method === "POST") {
    const body = await readJson(req);
    const result = await handler.negotiate(body);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result.toDict()));
  }
}).listen(3000);

await fundedJobWatcher(
  jobOps,
  async (job) => {
    await jobOps.submitResult(job.jobId as number, `fulfilled ${job.jobId} @ ${Date.now()}`);
  },
  { interval: 30 }
);
```

- Exposes `POST /negotiate`, signs via provider wallet, returns `provider_sig`.
- No custom capability fields, no fake execution authority.

## 5. ERC-8004 — Registration

- Process: `ERC8004Agent` with `walletProvider` -> `generate_agent_uri` -> `register_agent` -> `tokenId`.
- Public evidence to record: chain 97, `agent_id = 97:0x8004...:<tokenId>`, provider `0x...`, tx hash `0x...`, `agentUrl`.
- Verification: `ownerOf(tokenId) == provider`, `tokenURI(tokenId)` resolves to registration JSON with endpoint.

**Status: BLOCKED — wallet missing, no registration tx sent.**

## 6. ERC-8183 — Publish

- Config: `ERC8183Config.fromEnv()` reads `ERC8183_SERVICE_PRICE`, `ERC8183_AGENT_URL`, `NETWORK=bsc-testnet`; `paymentToken` is immutable.
- Status: Code ready, but no seller to publish.

**Status: BLOCKED — seller not running.**

## 7. Seller Self-Test — Criteria

| Check                | Expected                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ERC-8004 identity    | `ownerOf == provider` PASS                                                                                                                            |
| Public endpoint      | `GET /health` 200 PASS                                                                                                                                |
| /negotiate           | `POST` -> `NegotiationResult.accepted==true` PASS                                                                                                     |
| providerSig          | 65-byte 0x, `negotiation_hash` present PASS                                                                                                           |
| verifyQuoteSignature | `verifyQuoteSignature({envelope, provider, publicClient, expectedVerifyingContract: commerce})` -> `valid:true, method:eip191, signer==provider` PASS |
| ERC-8183 publish     | `ERC8183Config.effectiveCommerceAddress == 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` PASS                                                           |
| Seller status        | `getPendingJobs()` -> `[]` without error, READY PASS                                                                                                  |

**Status: NOT EXECUTED — seller not provisioned, so no job funded in X.117 per boundary.**

## 8. Security

- No secrets committed: `.env` is gitignored, `.env.example` has placeholders only; `pnpm-lock.yaml` has no secrets.
- Private key never logged: SDK clears `privateKey`/`walletPassword` after construction (INVARIANT).
- `WALLET_PASSWORD` never logged.
- No production wallet used: disposable testnet wallet required; `WALLET_KIND=evm` default, not `twak` or `altana` mainnet.
- No mainnet RPC/contract targeted: `ALTANA_ERC8183_CHAIN_ID=97` gate, `assertErc8183TestnetChainOnly` enforces.

## 9. Evidence — To Be Captured After Provisioning

- SDK: `@bnbagent/sdk@0.5.1` (npm), `@altananetwork/sdk@0.8.0` optional
- Chain: 97 (`BNB_TESTNET`)
- Seller identity: `97:0x8004A818BFB912233c491871b3d84c89A494BD9e:<tokenId>` (public after register)
- ERC-8004 tx: `0x...` (BSC testnet explorer)
- Public endpoint: `https://<tunnel>.trycloudflare.com` (HTTPS)
- Negotiation: `curl -X POST https://<host>/negotiate -d '{"taskDescription":"grid_trading notional 100","terms":{"deliverables":"report","quality_standards":"deterministic"}}'` -> `{"accepted":true, "provider_sig":"0x..."}`
- Signature verification: `verifyQuoteSignature` -> `{"valid":true,"method":"eip191","signer":"0x<provider>"}`
- ERC-8183 publish: `getErc8183Config("bsc-testnet").commerce` + `jobOps.servicePrice=="1000000000000000000"`
- Seller status: `READY` (watcher idle)

## 10. Classification

- SELLER WALLET: **BLOCKED** — no keystore; creation requires `WALLET_PASSWORD` + `PRIVATE_KEY` first-run, explicit authorization needed.
- ERC-8004: **BLOCKED** — cannot register without wallet+funds.
- PUBLIC ENDPOINT: **BLOCKED** — no tunnel/VPS to expose `/negotiate`.
- NEGOTIATE: **BLOCKED** — no seller to test (protocol PASS).
- PROVIDER SIGNATURE: **BLOCKED** — no quote to verify (verifier PASS).
- QUOTE VERIFICATION: **BLOCKED** — no envelope (method PASS).
- ERC-8183 PUBLISH: **BLOCKED** — no seller config to publish.
- SELLER READY: **BLOCKED** — not provisioned.

**OVERALL X.117: B — USER PROVISIONING REQUIRED**

Protocol is fully supported but user provisioning/funding is required. No technical seller implementation blocker discovered. The existing marketplace production (850454d) was not modified.

## 11. Exact User Action Required (Dedicated Testnet)

1. **Create disposable wallet** (local, one command):

   ```bash
   pnpm add -D @bnbagent/sdk
   WALLET_PASSWORD="choose-12+chars" npx tsx -e "import {EVMWalletProvider} from '@bnbagent/sdk'; const w=new EVMWalletProvider({password:process.env.WALLET_PASSWORD!, privateKey: '0x...newly-generated...'}); console.log(w.address)"
   ```

   Or `pip install bnbagent && bag wallet new --network bsc-testnet` (Python). Store `WALLET_PASSWORD` in password manager/OS keychain; move `PRIVATE_KEY` only to local `.env.local` (0600) then let SDK encrypt and delete the plaintext.

2. **Fund**: send the new address `0x...` 0.1 tBNB from https://www.bnbchain.org/en/testnet-faucet and 10 $U via Altana faucet; verify via `cast balance --rpc-url https://bsc-testnet-dataseed.bnbchain.org <address>`.

3. **Public endpoint**: `cloudflared tunnel --url http://localhost:3000` -> `https://<id>.trycloudflare.com` (keep terminal open) OR provide VPS hostname.

4. **Authorize agent**: run the isolated seller service (`services/v2-seller/seller.ts` + `pnpm exec tsx services/v2-seller/seller.ts`) with env `WALLET_PASSWORD, ERC8183_SERVICE_PRICE=1000000000000000000, ERC8183_AGENT_URL=https://<host>, NETWORK=bsc-testnet`.

5. **Notify**: provide the seller `agent_id` + `provider` address (public) to proceed to X.118 funded-job E2E.

## 12. Agent Can Do Locally (No User Secret)

- Scaffold `services/v2-seller/` with `package.json`, `seller.ts`, `LocalStorageProvider` dir.
- Write `NegotiationHandler` + `ERC8183JobOps` + `fundedJobWatcher` code (no secrets).
- Prepare `cloudflared` install script and health-check `curl` commands.
- Draft `register_agent` transaction preview (unsigned, no broadcast) once wallet exists.

## 13. Next Step for X.118

After seller `READY`:

- X.118 will execute **real ERC-8183 testnet buy/fund/fulfill/settle** as buyer (separate disposable wallet or same seller wallet in buyer role) using `ERC8183Client.create` -> `createJob` -> `registerJob` -> `fund` -> `submitResult` -> `settle`, without modifying marketplace production until the raw commerce lifecycle is proven.
