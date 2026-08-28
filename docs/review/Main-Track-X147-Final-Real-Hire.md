# X.147 Final Real Main Track Hire — Executed Corrected Broadcast Path

**Mode:** FINAL authorized transactional attempt using the X.146 corrected broadcast path. Outcome: **`createJob` broadcast was REJECTED by the broadcast transport (the SDK seed node) before any job was created**; the executor stopped immediately per the hard rule. **No job created, no escrow moved, no side effects.**

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`. No commit/push/deploy. No submit/settle/ACTIVE.

---

## 1. Corrected broadcast path (X.146) executed

- **READ/VERIFY:** PublicNode Main Track client (chain, nonce, gas, estimateGas, receipts, job/allowance/agent reads, quote verification).
- **BROADCAST TRANSPORT:** the wallet's own transport — the SDK keystore wallet's network client (`data-seed-prebsc-2-s2.binance.org:8545`) for `eth_sendRawTransaction`. PublicNode was **never** called to broadcast. Browser path unchanged (wallet-managed `eth_sendTransaction`); app never receives a private key.
- Wallet: user6 `0xb0Dac7297eFD2fE9Ea6F35acc7F8eaE5032060C3` (fresh disposable, nonce 0, `0.002 tBNB`, `1.2 U`).

## 2. Pre-flight — 26/26 PASS

All X.145/X.146 checks passed: wallet connected; chain 97; sufficient tBNB/U; Agent 1906 exists, owner == agentAddress == seller; seller endpoint `/health` 200; `/negotiate` 200; providerSig present; `verifyQuoteSignature` valid, signer == seller; quote chain 97; price exactly `1 U`; official commerce; authoritative payment token; authoritative router; policy `0xd6a42175…`; targets allowlisted; calldata validated; expiry future; PublicNode nonce read OK; PublicNode estimateGas OK (798584); receipt-reader health OK (job 653 createJob receipt read success). Predicted job id: **711** (counter 710; not in history `{622,641,646,648,649,650,651,652,653}`).

## 3. Execution — createJob broadcast REJECTED (no tx mined)

The corrected transport broadcast createJob exactly once (legacy, nonce 0, gasPrice 1 gwei, gas 798584, 996-byte calldata). The **SDK seed node rejected it**:

```
URL: https://data-seed-prebsc-2-s2.binance.org:8545
Request body: {"method":"eth_sendRawTransaction","params":["0xf9044b…"]}
Details: unmarshal transaction failed
```

The executor surfaced `createJob failed or rejected: broadcast failed: …` and **STOPPED** (no retry, no rebroadcast, no second job, no wallet switch — per the hard rule).

## 4. Root cause — investigation (read-only, no broadcast)

- **The transaction is viem-canonical and RLP-valid:** the exact rejected raw was reproduced locally; viem's own `serializeTransaction` (privateKeyToAccount, same params) produces the **identical** bytes (`0xf9044b…`, 1102 bytes, legacy EIP-155); `parseTransaction` OK; ECDSA recovers to user6; strict byte-level RLP walk is internally consistent (payload 1099 = sum of 9 fields); all fields minimal-encoded; low-s signature; chainId 97 from `v`.
- **Both current broadcast candidates reject it:** PublicNode (`failed to decode signed transaction`, X.145) **and** the SDK seed node `-2-s2.binance.org` (`unmarshal transaction failed`, X.147).
- **Yet the SAME seed node mined a near-identical transaction:** X.143's Job 653 createJob (legacy, nonce 0, gasPrice 1 gwei, dataLen 996, gas **798572**, chainId 97) was mined via `data-seed-prebsc-2-s2.binance.org:8545` (confirmed by the X.142 report, which names exactly this seed RPC and reads the mined tx). Our rejected tx differs only in the description bytes and gas (**798584** vs 798572).
- **Conclusion:** the remaining blocker is a **node-side decode rejection of THIS exact transaction** that is **not** explained by the RLP structure, signature, chainId, or viem serialization (all canonical). Because the same node mined a near-identical tx days ago, the differing gas value (798584 vs 798572) and/or the differing description bytes are the only deltas; static analysis cannot reproduce the node's strict decoder behavior. No assumption that "the RPC is simply broken" — the evidence shows a specific-transaction rejection that a future milestone must isolate by byte-diffing against a freshly mined identical-shape tx (or testing an alternate broadcast transport such as `data-seed-prebsc-1-s1.bnbchain.org`, which is alive and chain-97). This supersedes X.146's "PublicNode-only" framing: the X.146 read/broadcast separation is correct, but the wallet's current SDK broadcast transport also rejects this tx.

## 5. Final on-chain state (zero side effects)

```text
jobCounter      = 710   (no 711 created)
user6 nonce     = 0     (nothing broadcast by us)
user6 tBNB      = 0.002 (unchanged)
user6 U         = 1.2   (unchanged)
```

Jobs 622–653 untouched (622 COMPLETED, 641 FUNDED, 646/648/649/650/651/652/653 OPEN budget 0). No new job, no escrow, no allowance.

## 6. Honesty note

Exactly one createJob broadcast was attempted and rejected by the RPC before mining; the executor stopped and was not retried. No second job, no wallet switch, no rebroadcast. The counter (710) and job 711 absence are verified (the SDK returns a zero-job for non-existent ids above the counter). External actors created jobs up to 710 during this milestone — none of our wallets.

## Classification

**B — FAILED SAFELY.**

Pre-flight 26/26 PASS; the corrected X.146 broadcast transport (SDK seed node `-2-s2.binance.org`) rejected the createJob transaction (`unmarshal transaction failed`) before any job was created; the executor stopped per the hard rule with zero side effects (user6 nonce 0, no job 711, no escrow, no allowance). The blocker is a node-side decode rejection of a viem-canonical legacy transaction that the same node previously mined in near-identical form (Job 653); a future authorized milestone must isolate the exact delta (gas 798584 vs 798572 / description bytes) or validate an alternate broadcast transport before any new broadcast.

**STOP.** No retry, no second job, no submit/settle; Jobs 622–653 untouched; no commit/push/deploy.
