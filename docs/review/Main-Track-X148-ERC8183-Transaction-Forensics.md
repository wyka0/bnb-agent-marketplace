# X.148 ERC-8183 Transaction Forensics

**Mode:** READ-ONLY forensics. **Zero transactions broadcast.** No `eth_sendTransaction`/`eth_sendRawTransaction`, no new job, no wallet, no approval/funding/register/setBudget, Jobs 622/641/646/648/649/650/651/652/653 untouched.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

Deliverable: `services/v2-seller/x148-transaction-forensics.mjs` (read-only, machine-readable JSON report; the `27e` harness check asserts it contains **no** broadcast invocations).

## Classification

**E — NO DETERMINISTIC DEFECT; RPC INFRASTRUCTURE BEHAVIOR.**

The X.147 `createJob` transaction is viem-canonical and fully valid on every observable dimension; its rejection by PublicNode (`failed to decode signed transaction`) and the SDK seed node `data-seed-prebsc-2-s2.binance.org:8545` (`unmarshal transaction failed`) has **no deterministic encoding/ABI/viem/signature/RPC-compat explanation** on any recorded evidence — and the **same seed node mined the near-identical Job 653 `createJob`** (legacy, 996-byte data, gas 798572 vs 798584, chainId 97) days earlier.

## 1. Historical on-chain reads (PublicNode + seed, read-only)

| Job | createJob tx       | block     | from               | type   | nonce | gas    | gasPrice  | dataLen | status  | gasUsed |
| --- | ------------------ | --------- | ------------------ | ------ | ----- | ------ | --------- | ------- | ------- | ------- |
| 622 | `0xf2cd51f3…10ae4` | 127101076 | buyer              | legacy | 11    | 958300 | 0         | 996     | success | 783807  |
| 641 | `0xeb185939…7f8`   | 127163380 | marketplace-client | legacy | 0     | 958300 | 0         | 996     | success | 783807  |
| 653 | `0xaabb301a…f87a`  | 127210136 | user5              | legacy | 0     | 798572 | 100000000 | 996     | success | 783795  |

Both RPCs return **identical** fields for all three mined legacy transactions (`seedRpcMatch: true`).

## 2–3. Calldata decoding + byte-level comparison

All four `createJob` calldatas are **996 bytes**, decoded with the official `createJob(address,address,uint256,string,address)` ABI: provider=SELLER, evaluator=router, hook=router; only `expiredAt` and the description string differ.

- X.147 vs Job 653 calldata: **first differing byte at offset 97** → field `expiredAt` (Job 653 = `1787778304`, X.147 = `1788008451`). Remaining differences are entirely within the **description bytes** (negotiation_hash / provider_sig / negotiated_at / quote_expires_at) — expected per-quote content. Dynamic offset (160, i.e. absolute 164) and length word (0x301 = 769) are valid; the description tail terminates correctly.
- ABI dynamic-offset validity is covered by harness checks `27a/27b` (offset 160 → absolute 164; length word matches; data decodes to the exact string).

## 4–5. Serialization + signature (local, no broadcast)

- X.147 raw (1102 bytes, head `0xf9044b`): RLP top-level declared payload **1099 = actual 1099** (`lengthConsistent: true`); 9 legacy fields walk cleanly; all fields minimal-encoded; `(v−35)/2 = 97`; `parseTransaction` round-trips.
- **viem's own `serializeTransaction` produces byte-identical output** for the same params (legacy EIP-155, 1102 bytes).
- **ECDSA recovery == the X.147 user wallet** (`0xb0Dac7297eFD2fE9Ea6F35acc7F8eaE5032060C3`), low-s signature.
- No leading-zero/malformed/empty fields; legacy envelope (no EIP-7702/type-4 elements).

## 6. Description forensics

|           | bytes   | price                     | ASCII | control/null | UTF-8 valid |
| --------- | ------- | ------------------------- | ----- | ------------ | ----------- |
| Job 622   | 769     | `1000000000000000000`     | yes   | none         | yes         |
| Job 641   | 769     | `1000000000000000000`     | yes   | none         | yes         |
| Job 653   | 769     | `1000000000000000000`     | yes   | none         | yes         |
| **X.147** | **769** | **`1000000000000000000`** | yes   | none         | yes         |

The X.147 description was reconstructed with the **same SDK `buildJobDescription`** used by the hire wiring; the method is validated **byte-for-byte** against the on-chain Job 653 description (`job653ReconstructionMatches: true`). The calldata length word (`0x301` = 769) is the authoritative broadcast description length. **No** control characters, null bytes, non-ASCII/Unicode, or JSON anomalies. (An earlier intermediate reading of `price` as 1e19 was traced to a transcription artifact in the forensic input and corrected; the broadcast description price is exactly `1e18` = 1 U, matching the preflight-validated quote.)

## 7. SDK comparison

`@bnbagent/sdk@0.5.1` `createJob` builds args `[getAddress(provider), getAddress(evaluator), expiredAt, description, getAddress(hook)]` — identical to the project's `buildMainTrackUserHireCalls`, using the same ABI/argument order/description construction. No SDK deviation from the transactions that successfully created Jobs 622/641/653.

## 8. viem version

Recorded: services use **viem 2.55.19**; packages/integrations **2.55.11**. Serialization path: transaction object → viem `serializeTransaction`/SDK signer → `parseTransaction` → recovered signer; deterministic round-trip verified (`27a/27d`, X.146 checks).

## 9. RPC read-only difference

Both PublicNode and the seed read all three historical legacy transactions **identically** (envelope support, legacy decoder, calldata size, ABI data all consistent). No deterministic RPC-compat difference is observable for MINED transactions. The broadcast-time rejection of the X.147 transaction (never sent to either RPC during forensics) is not reproducible from any recorded read path.

## 10. Machine-readable report

`x148-transaction-forensics.mjs` outputs the full JSON: `classification`, `historical.{job622,job641,job653}`, `failed.x147`, `calldata.{lengths,firstDifference,changedFields}`, `serialization`, `signature`, `description`, `rpc`, `validation`, `conclusion`. Contains no private key/mnemonic/password/keystore content; no full signed transaction is printed.

## 11. Tests (added to `main-track-user-wallet.verify.ts`, deterministic, no tx)

`27a` createJob calldata decode round-trip · `27a/27b` ABI dynamic-offset + length-word validation · `27c` description clean ASCII / price 1 U · `27d` RLP parse + EIP-155 chainId 97 · `27e` **no-broadcast invariant** (forensic script contains no `eth_sendTransaction(` / `eth_sendRawTransaction(` / `.sendRawTransaction(` / `waitForTransactionReceipt(`).

## Validation

typecheck PASS · lint PASS · build PASS · prettier formatted. Suites: main-track-user-wallet (X.134/137/139/142/144 + X.148), main-track-hire (X.130), hire-adapter (X.127), activation:main-track (X.131), activation, hire, hire-api, capability-source, ERC-8183 — **all pass**. No transaction during validation.

## Exact finding / root-cause confidence / recommended fix

- **Exact finding:** The rejected X.147 `createJob` is a viem-canonical, RLP-valid, low-s, chainId-97 legacy transaction with a clean 1 U description, byte-identical serialization to viem's own serializer, and signer recovery to the user wallet — identical in structure to the mined Jobs 622/641/653. No deterministic defect exists in the transaction/ABI/viem/signature/RPC-read path.
- **Root cause confidence:** High that the defect is NOT in the transaction construction (all local decodings consistent; the same node previously mined a near-identical tx). The node-side `eth_sendRawTransaction` rejection remains **unresolved RPC infrastructure behavior** (transient node state, decoder strictness delta, or an unobservable node policy). Confidence that it is infrastructure: high; confidence in the precise node mechanism: low (unobservable without a broadcast).
- **Recommended fix (future authorized milestone, not this one):** empirically re-broadcast the same canonical transaction via an alternate seed transport (`data-seed-prebsc-1-s1.bnbchain.org:8545`, alive, chain 97) or retry `-2-s2` after confirming node health; and/or byte-diff against a freshly mined identical-shape transaction to expose any currently-unobservable delta. No code change is indicated by the forensics.

## What must NOT be changed

Production `/api/activation/hire`, `/api/activation/main-track-hire`, session-gate, capability-source, consent commitment, production custody, production wallet configuration. No AWS, no KMS, no Vercel, no deployment. No new hire.

## Confirmation

**Zero transactions were broadcast** during X.148. Jobs 622–653 untouched; no job created; user6 nonce 0; funds/allowance unchanged. STOP.
