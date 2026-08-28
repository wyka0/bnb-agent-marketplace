# X.146 Hire Broadcast Transport Fix

**Mode:** READ-ONLY investigation + transport fix, verified deterministically and read-only. **NO transaction was broadcast.** No job created (no Job 704), no wallet created, no fund/register/approve/setBudget/settle. No commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Exact root cause (proven)

X.145's createJob transaction was rejected by PublicNode `eth_sendRawTransaction` with `failed to decode signed transaction`. Read-only proof that the transaction itself is valid:

- **RLP is well-formed:** the reproduced createJob raw tx (nonce 0, gasPrice 1 gwei, gas 798584, chainId 97, 996-byte calldata) is 1102 bytes; the top-level length prefix claims a 1099-byte payload and the actual payload is exactly 1099 bytes (byte-by-byte field walk: `80 84 05f5e100 83 0c2f78 94<to> 00 b903e4<996> 81<v> a0<r> a0<s>` sums to 1099). No trailing bytes.
- **`parseTransaction` (viem) succeeds:** type=legacy, nonce=0, gas=798584, gasPrice=100000000, v=229/230 (valid EIP-155 for chain 97: `(v-35)/2 = 97`).
- **ECDSA recovery matches the user wallet** (`0xb0Dac7…`, user6).
- **The tx is the standard type on BSC testnet:** PublicNode's own `getBlock('latest')` shows gasLimit `100195405` (our 798k is trivially within limit) and all txs in the latest blocks are `legacy`; the largest data payload in the last 5 blocks is 2021 bytes (larger than our 996-byte createJob), and PublicNode **reads** those large legacy txs fine.
- **PublicNode accepts small legacy txs** from the same signer: the X.145 funding transfers (legacy, 1 gwei, gas 21000/70000) were broadcast through the same PublicNode endpoint and mined.
- **The identical createJob shape was mined via the seed RPC:** Job 653's createJob (legacy, nonce 0, gas 798572, dataLen 996, chainId 97) is confirmed on-chain via PublicNode `getTransaction`.

**Critical-question verdict: C/G — the transaction is VALID but unsupported by PublicNode's `eth_sendRawTransaction` transport for this large legacy ERC-8183 transaction.** Not A (malformed), not B (incorrectly serialized), not D (BSC is a legacy chain; PublicNode reads legacy and accepts small legacy), not E (envelope is `f9…` legacy — no EIP-7702/type-4 fields; fresh EOA), not F (the tx parses under viem; the defect is RPC-side). The seed RPC (the wallet's own SDK transport) mines this exact shape.

## 2. Exact RPC responsible

PublicNode (`https://bsc-testnet-rpc.publicnode.com`) `eth_sendRawTransaction` for the large legacy transaction. PublicNode remains reliable for all reads (chain, nonce, gas, estimateGas, receipts, jobs, allowances, agent, quote).

## 3. Exact fix

`packages/integrations/src/altana/v2/main-track-user-wallet.ts` — separate the **READ RPC** from the **WALLET BROADCAST TRANSPORT**:

- `MainTrackBroadcastTransport` + `createMainTrackBroadcastTransport(client)` — wraps any client purely as the `sendRawTransaction` transport.
- `createMainTrackBroadcast({ signer, publicClient, transport? })` — gas price + estimateGas are read from the reliable read client (PublicNode); the signed tx is then broadcast **through the wallet's own transport** (`transport`, e.g. the SDK keystore wallet's own network client). It is no longer forced through PublicNode's `eth_sendRawTransaction` (the X.145 blocker).
- `createMainTrackHeadlessProvider({ …, transport })` — the headless executor accepts the wallet broadcast transport; the read client still owns nonce/gas/estimate/receipts.
- Browser/production path is unchanged and already correct: `createMainTrackUserWallet` sends `{ from, to, data, value, chainId }` via `eth_sendTransaction`; the wallet owns nonce, gas, signing, signature, and broadcast. The app never receives a private key.
- `services/v2-seller/x146-hire.mjs` (next authorized attempt wiring; **NOT run**) — PublicNode for every read; the wallet's own SDK network client as the broadcast transport.

## 4. Read-only verification (before any transaction)

- Reproduced the exact createJob signing path locally (no broadcast): RLP length consistent, `parseTransaction` OK, `recoverTransactionAddress` == user6.
- Confirmed BSC-testnet norm: legacy txs, 100M gas limit, >2KB data txs mined and readable via PublicNode.
- Confirmed the seed RPC (wallet's own transport) mines the identical shape (Job 653).

## 5. Tests (added to `main-track-user-wallet.verify.ts`, all deterministic, no tx)

- `26a.` legacy EIP-155 serialization: `parseTransaction` OK; `(v-35)/2 === 97`; ECDSA recovery matches the signer; envelope is legacy (no EIP-7702/type-4 `authorizationList`); signer address is not a raw private key.
- `26b.` transport separation: gasPrice + estimateGas go to the read client; `sendRawTransaction` goes to the wallet transport; read client's `sendRawTransaction` throws (never used for broadcast).
- `26c.` headless provider funds all 5 calls via the wallet transport; receipts read via the read client.
- `26d.` wallet rejection (`user rejected transaction`) → blocked at the transaction stage, exactly one send, no retry/rebroadcast.
- `26e.` malformed raw from a transport → blocked, exactly one send, no rebroadcast.
- Existing checks (1–25) still pass: wallet-managed `eth_sendTransaction` omits nonce/gas (check 15); wrong chain/target/calldata/provider/price/expiry/confirmation/history all fail closed (check 16); no private key in any response (check 16); X.144 checks 22–25; no BigInt mixing; no rebroadcast.

## 6. Regression (all pass)

| Suite                                                                                                            | Result                     |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| main-track-user-wallet (X.137 nonce safety, X.139/X.142 receipts, X.143/144/145 regressions, + new X.146 checks) | **ALL CHECKS PASSED**      |
| main-track-hire (X.130)                                                                                          | **ALL CHECKS PASSED**      |
| hire-adapter (X.127)                                                                                             | **ALL CHECKS PASSED**      |
| activation:main-track (X.131)                                                                                    | **ALL CHECKS PASSED**      |
| activation                                                                                                       | 33 passed, 0 failed        |
| hire                                                                                                             | 23/23                      |
| hire-api                                                                                                         | 14 checks passed           |
| capability-source                                                                                                | ALL CHECKS PASSED          |
| X.80 / X.81                                                                                                      | ALL CHECKS PASSED          |
| X.84 / X.85                                                                                                      | 14 / 13 passed             |
| X.49 / X.55                                                                                                      | 25 / 22 checks, 0 failures |

Then: **typecheck PASS, lint PASS, build PASS, prettier formatted** (packages/integrations; web untouched).

## 7. No transaction occurred

X.146 was read-only. `x146-hire.mjs` was created but **not executed**. user6 nonce remains 0; no wallet of ours broadcast anything.

## 8. Jobs untouched

622 COMPLETED, 641 FUNDED, 646/648/649/650/651/652/653 OPEN budget 0 — unchanged. No Job 704 exists from us. No new wallet was created (user6 remains the fresh disposable signer).

## Classification

**A — BROADCAST PATH FIXED.**

Root cause proven (valid legacy EIP-155 transaction, RPC transport limitation on PublicNode's `eth_sendRawTransaction` for large legacy ERC-8183 txs); fix implemented (read RPC / wallet broadcast transport separation) and verified deterministically and read-only; the browser path already uses wallet-managed `eth_sendTransaction`; the headless wiring (`x146-hire.mjs`) now broadcasts through the wallet's own transport. No transaction was broadcast in X.146; jobs 622–653 untouched.

**STOP.** No broadcast in X.146; a funded hire is a separate authorized attempt using the corrected transport.
