# X.118 Testnet Seller Ready

**Mode:** Investigation + isolated scaffold only. No marketplace source, Vercel project, Git, activation, custody, mainnet, transaction, or fake ACTIVE change was performed. No secrets printed or committed.

**Production:** `850454da8f49f48285c31b8322215e55d37967a0` (live, `apps/web`, `sourceFilesOutsideRootDirectory=true`, `buildCommand: cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web`).

## 1. Credential Availability

**WALLET CREDENTIALS: PRESENT (onchainos) / MISSING (EVM keystore)**

- Checked `$HOME/.bnbagent/wallets`, `C:\Users\rashe\.bnbagent\wallets`, `C:\bnb-agent-marketplace\.env*`, process/user/machine env `WALLET_PASSWORD`, `PRIVATE_KEY`, `WALLET_ADDRESS`, `WALLET_KIND`, `NETWORK`, `RPC_URL*`, `ERC8183_*`, `ALTANA_*` — all **MISSING** for `EVMWalletProvider` keystore.
- Found managed wallet store `C:\Users\rashe\.onchainos\wallets.json` containing `address: 0xa636f972efd44cc0221ff4d77c64ca204fa5e30c` (eoa, selected account). This is a custodial/managed wallet, not an `EVMWalletProvider` Keystore V3 on disk.
- Derived/displayed only public seller wallet address: `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c`.

**RPC: PRESENT**

- BSC Testnet chain 97 via `@altananetwork/sdk` `BNB_TESTNET.publicRpcUrl` and `@bnbagent/sdk` `resolveNetwork("bsc-testnet")` preset. Public RPC reachable; no env override needed.

**TESTNET FUNDING: INSUFFICIENT**

- Live `eth_getBalance` for `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c` on chain 97: `0` wei (0 tBNB).
- Required for seller: ERC-8004 `register_agent` ~0.002 BNB, `submitResult` ~0.003 BNB, plus buffer for multiple jobs and faucet claims — recommended **0.05 tBNB** + **5 $U** per X.117.

No private key, mnemonic, `WALLET_PASSWORD`, or API credential was printed or requested in chat.

## 2. Testnet Wallet

- **Load method:** `EVMWalletProvider({ password: WALLET_PASSWORD })` expects Keystore V3 at `~/.bnbagent/wallets/<address>.json`. No such file exists; `EVMWalletProvider.keystoreExists()` would return false.
- **Public address derived:** `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c` (from onchainos store, not EVM keystore). Used only for balance check.
- **Chain connectivity:** Verified chain 97 via `publicClient.getChainId() == 97` (previous X.110 verification also showed `jobCounter==595` and funded job detection).
- **Balance:** `0` tBNB — seller cannot pay gas for registration or submission.

## 3. Required Testnet Funds vs Actual

| Requirement                                 | Need                          | Actual | Verdict      |
| ------------------------------------------- | ----------------------------- | ------ | ------------ |
| ERC-8004 registration                       | ~0.002 tBNB                   | 0      | INSUFFICIENT |
| ERC-8183 publish (no extra tx, config only) | 0                             | 0      | N/A          |
| Seller operation (watcher polling)          | ~0.001 tBNB/day               | 0      | INSUFFICIENT |
| Fulfillment `submitResult`                  | ~0.003 tBNB per job           | 0      | INSUFFICIENT |
| Settlement `settle`                         | ~0.002 tBNB (buyer or seller) | 0      | INSUFFICIENT |
| $U budget per job                           | 1 $U (1e18 raw)               | 0      | INSUFFICIENT |

Official source: BSC Testnet Faucet https://www.bnbchain.org/en/testnet-faucet and Altana $U faucet (see `erc8183.job515.faucet.check.x28b.ts`). Mainnet funds never used.

## 4. Isolated Seller

Location: `services/v2-seller/seller.ts` (created, not committed as marketplace code, gitignored via `services/` untracked). Uses only official `@bnbagent/sdk@0.5.1`:

- `EVMWalletProvider` (password → Keystore V3)
- `ERC8183JobOps.create({ walletProvider, network:"bsc-testnet", storageProvider: LocalStorageProvider, servicePrice, agentUrl, allowUnsignedJobs:false })`
- `NegotiationHandler.fromErc8183Client` with `servicePrice="1000000000000000000"` (1 U), `chainId:97`, `verifyingContract: commerce`
- HTTP `POST /negotiate` -> `handler.negotiate(requestData)` -> `NegotiationResult.toDict()` with `providerSig`
- `fundedJobWatcher(jobOps, onFunded, {interval:30})` -> `submitResult(jobId, content)`
- `LocalStorageProvider("./.agent-data")` for deliverables

Did NOT modify `apps/web/**`, marketplace Hire, `session-gate`, `capability-source`, or use `SignedQuoteReader` / `resource` / `executionCapability` invention.

## 5. Local Negotiation Test

**Not executed** — requires `EVMWalletProvider` to load (needs `WALLET_PASSWORD` + keystore). With `balance 0`, no transaction would be sent even if negotiation succeeded in memory.

Expected verification when wallet funded:

- `POST /negotiate { taskDescription:"grid_trading notional 100", terms:{deliverables:"report", quality_standards:"deterministic"} }` -> `NegotiationResult.accepted==true`, `price=="1000000000000000000"`, `providerSig` 65-byte, `negotiation_hash` present, `quote_expires_at` future (now+900).

## 6. ERC-8004 Registration

**Not performed** — requires tBNB.

To be recorded when funded:

- Chain 97, seller `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c` (or new disposable `0x...`), `agent_id=97:0x8004A818BFB912233c491871b3d84c89A494BD9e:<tokenId>`, tx `0x...`, `tokenURI` resolves to `agent.json` with `endpoint: https://<host>/negotiate`.

## 7. Public Seller Endpoint

Preferred testnet approach per X.117: `cloudflared tunnel --url http://localhost:3000` -> `https://<id>.trycloudflare.com` (HTTPS, 168h, no VPS).

Verification required before funding:

- `curl https://<host>/health` -> `{"status":"ok","chain":97}`
- `curl -X POST https://<host>/negotiate -d '{"taskDescription":"test","terms":{"deliverables":"x","quality_standards":"y"}}'` -> `providerSig` present
- `verifyQuoteSignature({ envelope: negotiationResult, provider: sellerEOA, publicClient, expectedVerifyingContract: commerce })` -> `valid:true, method:eip191, signer==provider`

**Not executed** — seller not running.

## 8. ERC-8183 Publish

- Seller provider identity: EOA `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c` (pending dedicated wallet)
- Chain 97, endpoint `https://<host>`, price `1e18`, currency `$U 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`, evaluator `EvaluatorRouter` as hook, `OptimisticPolicy` as policy.

Configured via `ERC8183Config { walletProvider, network:"bsc-testnet", servicePrice, agentUrl }` / `ERC8183JobOps`. No on-chain publish tx beyond agent registration; seller is "published" when negotiator + watcher are running.

**Status: BLOCKED — seller not running.**

## 9. Seller Ready Gate

- [MISSING] credentials available — EVM keystore missing (onchainos address present but not EVM keystore)
- [MISSING] wallet loads — `EVMWalletProvider` cannot load without keystore+password
- [PASS] BSC testnet connectivity — public RPC reachable, chain 97 verified
- [FAIL] sufficient testnet funding — 0 tBNB, need ~0.05 + $U
- [FAIL] ERC-8004 identity — not registered
- [FAIL] public endpoint — not exposed
- [FAIL] /negotiate — not reachable
- [FAIL] providerSig — no quote
- [FAIL] verifyQuoteSignature — no envelope
- [FAIL] ERC-8183 publish — not running
- [FAIL] funded-job watcher — not running

**SELLER READY = BLOCKED**

## 10. Report

This file is the required `docs/review/Main-Track-X118-Testnet-Seller-Ready.md` evidence for X.118. No secrets included. Seller scaffold `services/v2-seller/seller.ts` is isolated and not part of marketplace production.

Remaining requirement for buyer-side test (X.119):

- Dedicated disposable testnet wallet keystore + `WALLET_PASSWORD` (user provisioned, local only)
- Funding: 0.05 tBNB + 5 $U to seller address `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c` (or new address) via testnet faucets
- Then: register ERC-8004, expose tunnel, verify `/negotiate` + `verifyQuoteSignature`, start watcher, and proceed to X.119 `ERC8183Client.create` -> `createJob` -> `fund` -> `FUNDED` -> `submitResult` -> `settle` (buyer wallet separate).

## Classification

- SELLER WALLET: **BLOCKED** (onchainos address present, EVM keystore missing)
- ERC-8004: **BLOCKED**
- PUBLIC ENDPOINT: **BLOCKED**
- NEGOTIATE: **BLOCKED**
- PROVIDER SIGNATURE: **BLOCKED**
- QUOTE VERIFICATION: **BLOCKED**
- ERC-8183 PUBLISH: **BLOCKED**
- SELLER READY: **BLOCKED**

**OVERALL X.118: SELLER NOT READY — TESTNET FUNDING/KEYSTORE REQUIRED**

No buyer job funded, no marketplace production modified, no commit/push/deploy, no mainnet, no fake transactions, no fake ACTIVE.
