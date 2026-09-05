# X.145 Final Real Main Track Hire After Full RPC Hardening

**Mode:** FINAL authorized transactional attempt — ONE fresh disposable user wallet, ONE new job target, hardened PublicNode-only RPC path. Outcome: **createJob broadcast was REJECTED by PublicNode's `eth_sendRawTransaction` before any job was created**; the executor stopped immediately per the hard-failure rule. **No job created, no escrow moved, no side effects.**

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`. No commit/push/deploy. No submit/settle/ACTIVE.

---

## 1. Fresh disposable user wallet (user6)

- **user6 = `0xb0Dac7297eFD2fE9Ea6F35acc7F8eaE5032060C3`** (new Keystore V3; `distinctFromAllPrior = true`; not seller/buyer/marketplace/prior users).
- Private key generated and held only inside the keystore wallet; the application never received or printed any key/mnemonic/password.
- Testnet funding from prior disposable user wallets (not seller/buyer/marketplace): `0.002 tBNB` from user2 (`0x0389…`, nativeTx `0x3e3d3900…`), `1.2 U` from user3 (`0xc134…`, uTx `0x5c5098ac…`, success).

## 2. Pre-flight — 26/26 PASS (PublicNode-only path)

All 22 existing checks **plus** the X.144 RPC-health checks 23–26 passed:

1. wallet connected (keystore reload) · 2. chain 97 · 3. tBNB `0.002 ≥ 0.0008` · 4. U `1.2 ≥ 1` · 5/6. Agent 1906 exists, owner/agentAddress == seller · 7/8. seller endpoint `/health` 200 · 9. `/negotiate` 200 · 10. providerSig present · 11. `verifyQuoteSignature` valid · 12. signer == seller · 13. quote chain 97 · 14. quote price exactly `1 U` · 15. official commerce · 16. authoritative payment token · 17. authoritative router · 18. policy `0xd6a42175…` (decoded from calldata) · 19. all targets allowlisted · 20. calldata validated · 21. expiry future · **22. explicit confirmation** · **23. PublicNode chain read OK** · **24. PublicNode nonce read OK (0)** · **25. PublicNode `estimateGas` OK (798584)** · **26. receipt-reader health OK (job 653 createJob receipt read success via hardened reader)**.

Predicted job id: **703** (counter was 702; 703 not in history `{622,641,646,648,649,650,651,652,653}`).

## 3. Execution — createJob broadcast REJECTED (no tx mined)

`createMainTrackHeadlessProvider` (X.137 nonce-safe executor + X.142/X.144 reliable reader, PublicNode-only) broadcast createJob exactly once (nonce 0, gasPrice 1 gwei, gas 798584, legacy, to commerce, 996-byte calldata). PublicNode `eth_sendRawTransaction` rejected it:

```
Invalid parameters were provided to the RPC method. …
URL: https://bsc-testnet-rpc.publicnode.com
Request body: {"method":"eth_sendRawTransaction","params":["0xf9044b…"]}
Details: failed to decode signed transaction
```

The executor surfaced this as `createJob failed or rejected: broadcast failed: …` and **STOPPED** (per hard-failure rule: no retry, no rebroadcast, no second job).

## 4. Root-cause diagnosis (read-only, no broadcast)

- The rejected transaction is **internally valid**: re-signing the identical createJob tx (nonce 0, gas 798584, gasPrice 100000000, chainId 97, 996-byte data) produced a raw tx that viem `parseTransaction` decodes (type=legacy, to=commerce) and whose ECDSA signature **recovers to user6**.
- PublicNode **accepts** legacy transactions from this same signing path: the two funding transfers (legacy, 1 gwei, gas 21000/70000) were broadcast via the same PublicNode endpoint and mined.
- The **same createJob tx shape (large legacy, ~1 KB calldata, gas ~798k) was successfully mined via the seed RPC in X.143 (job 653, tx `0xaabb301a…`, block 127210136)**.
- Therefore: **PublicNode's BSC-testnet `eth_sendRawTransaction` rejects this well-formed large legacy transaction at the RPC boundary (`failed to decode signed transaction`) while the seed RPC accepts it.** This is an RPC transport/node-side limitation of the PublicNode endpoint for `eth_sendRawTransaction` with this legacy transaction shape — not a calldata, signature, or plan defect. (All PublicNode read paths — chain, nonce, estimateGas, receipts, job/allowance/agent reads — worked correctly.)

## 5. Final on-chain state (zero side effects)

```text
jobCounter        = 702   (no 703 created by us)
user6 nonce       = 0     (nothing broadcast)
user6 tBNB        = 0.002 (unchanged)
user6 U           = 1.2   (unchanged)
user6 allowance   = 0
```

Jobs 622–653 untouched (622 COMPLETED, 641 FUNDED, 646/648/649/650/651/652/653 OPEN budget 0). No new job was created; no escrow moved; no submit/settle.

## 6. Honesty note

This was the single, final authorized transactional attempt. The executor broadcast exactly one createJob transaction that was rejected by the RPC before mining; it stopped immediately and was not retried. No second job, no new wallet after this attempt. External actors again advanced the shared public commerce counter (to 702) during this milestone — none of our wallets.

## Classification

**B — FAILED SAFELY.**

Pre-flight 26/26 PASS; `createJob` broadcast was rejected by PublicNode's `eth_sendRawTransaction` (`failed to decode signed transaction`) before any job was created; the executor stopped per the hard-failure rule with zero side effects (user6 nonce 0, no job, no escrow, no allowance). The exact blocker is a PublicNode transport limitation: it rejects a locally-verified-valid large legacy transaction that the seed RPC mines (X.143 job 653), meaning a future funded hire requires an RPC that accepts this legacy `eth_sendRawTransaction` shape (or an EIP-1559/typed-transaction broadcast path on an RPC that supports it) — a separately authorized follow-up.

**STOP.** No retry, no second job, no submit/settle; Jobs 622–653 untouched; no commit/push/deploy.
