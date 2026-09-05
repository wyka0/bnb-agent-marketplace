# X.144 Full RPC/Viem Reliability Hardening

**Mode:** Implementation + read-only verification only. **NO transaction was broadcast.** No job created, no wallet created, no fund/register/approve/setBudget/settle. No commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Exact BigInt root cause

X.143's failure was an un-prefixed **`Cannot mix BigInt and other types, use explicit conversions`** (viem 2.55.19) raised during the live `createJob` step of the Main Track user-wallet hire. It occurred **outside** the X.142 reliable receipt reader (which X.142/X.144 prove works on the mined Job 653 createJob tx and with the publicnode fallback). The failure was un-prefixed because it surfaced in a chain-operation stage that the executor did not yet annotate.

The underlying class is the **unreliable seed RPC's response shape interacting with viem's BigInt formatting**: X.141/X.142 established that while a transaction is pending, `getTransactionReceipt` on the seed RPC (`@bnbagent/sdk` bsc-testnet preset `rpcUrl`) throws the BigInt-mix, while PublicNode reads the same receipts fine. X.144 removes that RPC from the entire Main Track path and makes every remaining failure stage-annotated so a future error is pinned to the exact operation.

**Exact RPC responsible:** the `@bnbagent/sdk` bsc-testnet preset seed RPC (the `data-seed-prebsc-1-s1.bnbchain.org:8545` endpoint) used by the previous hire wiring for `publicClient` (chainId / balance / gasPrice / estimateGas / sendRawTransaction / getTransactionCount), the `ERC8183Client` and `ERC8004Agent` reads, and `verifyQuoteSignature`. PublicNode (`https://bsc-testnet-rpc.publicnode.com`) — already the repo-supported reliable BSC-testnet endpoint — is now the single Main Track RPC.

## 2. Exact fix

`packages/integrations/src/altana/v2/main-track-user-wallet.ts`:

- `MAIN_TRACK_PUBLIC_RPC` = PublicNode; `createMainTrackNetworkConfig()` returns a concrete SDK `NetworkConfig` (PublicNode + pinned chain-97 registry/commerce/router/policy/payment-token addresses) so **all** SDK reads/writes (ERC-8183 job/allowance/balance, ERC-8004 agent) route through PublicNode.
- `createMainTrackPublicClient()` — ONE reliable PublicNode viem client.
- `createMainTrackReceiptReader()` — the X.142 reliable reader **retained**, now **PublicNode primary** (no seed-RPC fallback; optional injected fallback only).
- `createMainTrackBroadcast({ signer })` — gas price, estimateGas, and sendRawTransaction all on the reliable client; the injected signer owns custody (keystore wallet); the app never receives a key.
- `createMainTrackHeadlessProvider()` — wires nonce read, broadcast, and receipts through the single injected PublicNode client.
- **Stage-annotated errors** in `createNonceSafeEip1193Provider`: `nonce read failed: …`, `broadcast failed: …`, plus the existing `receipt polling error: …`. No raw RPC error is ambiguous; no retry; no rebroadcast.

`services/v2-seller/x144-hire.mjs` (next authorized attempt wiring; **NOT run**): every chain op routed through the hardened client/NetworkConfig; history guard now includes 653.

## 3. PublicNode verification

PublicNode is already the repo-supported BSC-testnet endpoint (`bsc-testnet-rpc.publicnode.com`; see `docs/review/Altana-Integration-Discovery.md`, X.14/X.28A/X.35 reports). No endpoint was invented. `createMainTrackNetworkConfig().rpcUrl === MAIN_TRACK_PUBLIC_RPC` and contains no seed endpoint.

## 4. Read-only real-chain verification (through the hardened PublicNode client)

`services/v2-seller/x144-verify.mjs` — **ALL CHECKS PASSED, no transaction broadcast**:

- Network config rpc == PublicNode, chain 97, no seed RPC.
- Chain id 97; block number bigint (`127705344`).
- User5 nonce via PublicNode (`1`; provider wraps to bigint).
- Balances: user5 `0.0009216205 tBNB`, `1.2 U` (bigint).
- Gas price + `estimateGas` for createJob calldata via PublicNode (bigint).
- Transaction preparation: 5 allowlisted calls.
- Contract identity via SDK-on-PublicNode: commerce/router/policy/payment-token match pinned addresses.
- Jobs readable: **622 COMPLETED 1 U**, **641 FUNDED 1 U**, **653 OPEN budget 0**.
- **Job 652 createJob receipt** (tx `0xc287be4d710cc204e465c89464a7505d37d33088a77c30d1ae4931ca67d68572`, block `127203662`, gasUsed `783807`) and **Job 653 createJob receipt** (tx `0xaabb301ad642aa939e1cd73b6a7ff7cc471da2e4a9d38ab966e8924772aef87a`, block `127210136`, gasUsed `783795`) both read **success** through the X.142 reader (PublicNode primary).
- Agent 1906 via the official registry read path (`getAgentWallet`/`ownerOf`/`tokenURI` on `0x8004A818…`) — owner == agentAddress == seller.
- Allowance user5→commerce = 0 (bigint).
- Seller endpoint `/health` + `/negotiate` 200; quote fields sane; **quote signature verified via the PublicNode client**.

## 5. Test results (regression)

| Suite                                                                             | Result                     |
| --------------------------------------------------------------------------------- | -------------------------- |
| altana:main-track-user-wallet:verify (X.137/139/140/142 + new X.144 checks 22–25) | **ALL CHECKS PASSED**      |
| main-track-hire (X.130)                                                           | **ALL CHECKS PASSED**      |
| hire-adapter (X.127)                                                              | **ALL CHECKS PASSED**      |
| activation:main-track (X.131)                                                     | **ALL CHECKS PASSED**      |
| activation                                                                        | 33 passed, 0 failed        |
| hire                                                                              | 23/23 checks passed        |
| hire-api                                                                          | 14 checks passed, 0 failed |
| capability-source                                                                 | ALL CHECKS PASSED          |
| X.80                                                                              | ALL CHECKS PASSED          |
| X.81                                                                              | ALL CHECKS PASSED          |
| X.84                                                                              | 14 passed, 0 failed        |
| X.85                                                                              | 13 passed, 0 failed        |
| X.49                                                                              | 25 checks, 0 failures      |
| X.55                                                                              | 22 checks, 0 failures      |
| X.143 regression (new checks 24a/24b/24c + read-only verify)                      | PASS                       |

New deterministic X.144 regression coverage (no BigInt mixing, no retry, no rebroadcast, no job creation, no private-key exposure):

- `24a.` nonce-read BigInt-mix → `nonce read failed`, **no broadcast**.
- `24b.` broadcast BigInt-mix → `broadcast failed`, **no retry/rebroadcast** (broadcast count 1, stopped).
- `24c.` Main Track receipt reader PublicNode-primary BigInt-mix → fallback success.
- `23.` headless provider chains **every** chain op (nonce / gas price / estimateGas / send / receipt) through the single injected client; signer receives bigint nonce/gas/gasPrice and **never a private key**.
- `25.` pure bigint-safe normalization.

Then: **typecheck PASS, lint PASS, build PASS, prettier formatted** (packages/integrations; web untouched).

## 6. No transaction occurred

User5 nonce = **1** (unchanged; the single prior createJob from X.143). No wallet of ours broadcast anything in X.144; the milestone was read-only. `x144-hire.mjs` was created but **not executed**.

## 7. Jobs 622–653 untouched

622 COMPLETED (1 U), 641 FUNDED (1 U), 646/648/649/650/651/652/653 OPEN budget 0 — verified unchanged. **Honesty note:** the shared public commerce contract's job counter advanced to **701** during X.144 because **external actors** created jobs 654–701 (client `0xd92f9f7b…`, not any of our wallets); checked 654–701 — **0 of our wallets**, no action by us. This does not affect the hardening or the no-tx guarantee. `x144-hire.mjs` computes the next jobId from the live counter, so it will use the correct value on the next authorized attempt.

## Classification

**A — FULL RPC PATH HARDENED.**

The complete Main Track user-wallet chain client now routes every operation (chain id, block number, nonce, balances, gas price, estimateGas, sendRawTransaction, receipts, ERC-8183 job/allowance reads, ERC-8004 agent reads, quote verification) through the single reliable **PublicNode** RPC; the unreliable seed RPC is eliminated from the entire path; the X.142 reliable reader is retained; every provider stage is annotated (`nonce read failed` / `broadcast failed` / `receipt polling error`); deterministic + read-only real-chain verification all pass; no transaction occurred; Jobs 622–653 untouched. Live in-flight confirmation of a funded hire still requires the next separately authorized transaction milestone (STOP — do not attempt another hire here).
