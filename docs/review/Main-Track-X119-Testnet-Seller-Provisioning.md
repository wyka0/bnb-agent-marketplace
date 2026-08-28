# X.119 Testnet Seller Provisioning

**Mode:** Provisioning/readiness gate only. No marketplace source, Vercel project, Git, activation, custody, mainnet, transaction, or fake ACTIVE change was performed. No secrets printed or committed.

**Production:** `850454da8f49f48285c31b8322215e55d37967a0` (README docs), Vercel `apps/web`, `46fcdc6` fix live.

## 1. Check For New Keystore

Checked:

- `~/.bnbagent/wallets` via `Test-Path $HOME\.bnbagent\wallets` -> **False** (directory does not exist)
- `Get-ChildItem $HOME\.bnbagent` -> no entries
- `cmd /c dir /a "%USERPROFILE%\.bnbagent"` -> no `*.json` keystore found
- Process/User env `WALLET_PASSWORD`, `PRIVATE_KEY`, `WALLET_ADDRESS`, `WALLET_KIND`, `NETWORK`, `ERC8183_SERVICE_PRICE`, `ERC8183_AGENT_URL` -> **all MISSING** (checked via `[Environment]::GetEnvironmentVariable` without value)
- `.env` / `.env.local` in `C:\bnb-agent-marketplace` -> only `.env.example` (1390 bytes) exists; no local env file
- Seller scaffold `services/v2-seller/seller.ts` -> exists (1736 bytes, 2026-08-22), not modified

**SELLER KEYSTORE = BLOCKED**

**ACTION REQUIRED = create/provision dedicated disposable BSC testnet EVM Keystore V3 and local `WALLET_PASSWORD`**

Do not convert or extract the onchainos wallet `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c` found in `~/.onchainos/wallets.json`. Its private key is not available to `EVMWalletProvider` and must not be exposed.

## 2. Verify Keystore

Not executed — keystore does not exist.

Expected verification when provisioned (via `@bnbagent/sdk@0.5.1` `EVMWalletProvider`):

- `new EVMWalletProvider({ password: WALLET_PASSWORD })` loads keystore, derives public address `0x...`
- `chain 97` via `BNB_TESTNET` preset / `createPublicClient` -> `getChainId() == 97`
- `signMessage` / `signQuote` capability available (not `UnsupportedWalletOperation`)

Private key never printed; `WALLET_PASSWORD` never logged.

## 3. Funding

Not checked beyond X.118 balance probe (0 tBNB for `0xa636...`):

- Required: **~0.05 tBNB** (register + submit + settle gas) and **~5 $U** (1 U per job, 18 decimals) via BSC Testnet Faucet and Altana $U faucet.
- Current: **INSUFFICIENT** — no funded EVM keystore to fund.
- No mainnet funds requested or used.
- No buyer funding performed in X.119.

## 4. Once Funded — Seller Scaffold

On `services/v2-seller/seller.ts` (exists):

- Will run `node --loader tsx seller.ts` with env `WALLET_PASSWORD`, `ERC8183_SERVICE_PRICE=1000000000000000000` (1 U), `ERC8183_AGENT_URL=https://<tunnel>`, `NETWORK=bsc-testnet`
- Starts HTTP `POST /negotiate` via `NegotiationHandler.fromErc8183Client`, signs with `walletProvider`, returns `NegotiationResult.toDict()` with `providerSig`
- `fundedJobWatcher` with `ERC8183JobOps.create` will detect `FUNDED` jobs and `submitResult`

None of the following will be modified: `apps/web/**`, marketplace Hire, `session-gate`, `capability-source`.

## 5. ERC-8004

Not attempted — requires funded wallet. When funded, will record only public evidence: chain 97, seller address `0x...`, `agent_id = 97:0x8004A818BFB912233c491871b3d84c89A494BD9e:<tokenId>`, tx `0x...`.

## 6. Public Endpoint

Not exposed — requires seller running. When running, will use `cloudflared tunnel --url http://localhost:3000` -> `https://<id>.trycloudflare.com`, then external `POST https://<host>/negotiate` + `verifyQuoteSignature` must pass.

Marketplace itself will not be exposed.

## 7. ERC-8183 Seller

Not published — requires seller config with `servicePrice`, `agentUrl`, `network:"bsc-testnet"`, `walletProvider`. Verification will check `getErc8183Config("bsc-testnet").commerce == 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` and `servicePrice` floor.

## 8. Security

- No secrets committed: `.env` gitignored, `.env.example` placeholders only
- Private key never logged, `WALLET_PASSWORD` never logged
- No credentials in reports
- No production wallet used (disposable testnet only)
- No mainnet RPC/contract targeted (chain 97 gate enforced)

## 9. Seller Ready Gate

- [ ] EVM Keystore V3 — **BLOCKED** (directory missing, no `*.json`)
- [ ] `WALLET_PASSWORD` — **BLOCKED** (env MISSING)
- [ ] wallet loads — **BLOCKED**
- [ ] chain 97 — **BLOCKED** (no wallet to test; RPC present via preset but not exercised)
- [ ] sufficient tBNB — **BLOCKED** (0, need ~0.05)
- [ ] required $U — **BLOCKED** (0, need ~5)
- [ ] ERC-8004 identity — **BLOCKED**
- [ ] public endpoint — **BLOCKED**
- [ ] /negotiate — **BLOCKED**
- [ ] providerSig — **BLOCKED**
- [ ] verifyQuoteSignature — **BLOCKED**
- [ ] ERC-8183 seller — **BLOCKED**
- [ ] funded-job watcher — **BLOCKED**

**SELLER READY = BLOCKED**

## 10. Exact Missing Prerequisite

1. **Create disposable BSC testnet EVM Keystore V3:**

   ```bash
   # One-time, local only, never paste the private key into chat
   pnpm add -D @bnbagent/sdk
   WALLET_PASSWORD="<choose-12+chars>" npx tsx -e "import {EVMWalletProvider} from '@bnbagent/sdk'; const w=new EVMWalletProvider({password:process.env.WALLET_PASSWORD!, privateKey:'0x...newly-generated...'}); console.log('address', w.address)"
   ```

   This encrypts to `~/.bnbagent/wallets/<address>.json`; `WALLET_PASSWORD` stays in password manager/OS keychain, `PRIVATE_KEY` is cleared after construction. Alternative: `pip install bnbagent && bag wallet new --network bsc-testnet` (Python side, same keystore).

2. **Fund**: Send the derived address `0x...` 0.1 tBNB from https://www.bnbchain.org/en/testnet-faucet and 10 $U via Altana faucet; verify with `cast balance --rpc-url https://bsc-testnet-dataseed.bnbchain.org <address>` and `npx tsx -e "import {ERC8183Client} from '@bnbagent/sdk'; ... client.getJob(...)"`.

3. After funding, re-run X.119 verification, then proceed to `services/v2-seller/seller.ts` start, `cloudflared` expose, `/negotiate` + `verifyQuoteSignature` test, ERC-8004 registration, and funded-job watcher idle check before X.120.

No conversion of the existing onchainos wallet was attempted, and no private material was exposed.

## 11. Next Step

Re-provision the dedicated keystore and `WALLET_PASSWORD` locally, fund as above, then re-enter X.119. Only after `SELLER READY = PASS` may X.120 `REAL ERC-8183 BUY → FUND → FUNDED → FULFILL → SUBMIT → SETTLE` be attempted. No marketplace production commit/push/deploy will occur until the raw commerce lifecycle is proven.
