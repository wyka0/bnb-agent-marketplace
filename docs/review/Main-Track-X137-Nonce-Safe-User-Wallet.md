# X.137 Nonce-Safe User Wallet Executor

**Mode:** Implementation + harness verification only. **No real transaction, no new job.** Job 648 (and 622/641/646) untouched; no submit/settle; no Model A/X.76, capability-source, session-gate, custody, AWS, or private-key changes; no commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Root cause (from X.136)

The headless EIP-1193 executor raced `eth_getTransactionCount` across rapid sequential sends: `createJob`/`registerJob` succeeded but `setBudget` was rejected `nonce too low: next nonce 4, tx nonce 3`, and the flow stopped (no escrow moved; job 648 OPEN, budget 0).

## 2. Fix

Two distinct, correct behaviors:

**Production browser path (preferred).** `createMainTrackUserWallet.sendCall` now sends `eth_sendTransaction` params **without `nonce` and without `gas`** — only `{ from, to, data, value, chainId }`. The connected wallet owns nonce and gas determination (standard EIP-1193). The application does not calculate nonce manually when the wallet can do it.

**Headless harness/executor (deterministic).** Added in `packages/integrations/src/altana/v2/main-track-user-wallet.ts`:

- `MainTrackNonceLedger` — pure ledger: `allocate()` returns the current nonce or `null` after a failure; `commit(nonce)` advances only when the exact nonce is confirmed; `markFailed()` locks the ledger. A stale nonce can never be re-allocated.
- `MainTrackNonceTooLowError` + `isNonceTooLowError` — typed detection of `nonce too low` / `already known` RPC rejections.
- `createNonceSafeEip1193Provider` — serialized, deterministic provider for the headless path:
  - seeds the ledger once from the **pending** nonce (`getPendingNonce`),
  - serializes sends (one in flight at a time; no concurrent sends),
  - allocates the next nonce per send and commits only after a confirmed successful broadcast (never reuses, never `nonce++` blindly),
  - on `nonce too low` marks the ledger failed and throws a typed error — **no blind retry, no next-step advance, no auto job creation**.

The existing target/data/chain safety validation is preserved (allowlisted targets, pinned chain-97 commerce/router/policy/token, exact `1 U`, provider/seller binding).

## 3. Tests

`altana:main-track-user-wallet:verify` — **37 checks PASS** (rewritten harness):

- sequential sends allocate monotonic nonces `0,1,2,3,4`, never reused;
- concurrent send prevention: max in-flight == 1 (serialization);
- stale nonce never allocated (ledger unit behavior; stale commit does not advance; failed ledger stops allocation);
- `nonce-too-low` at every call (createJob/registerJob/setBudget/approve/fund): typed stop, **no further call is sent** (a failed transaction never advances to the next ERC-8183 step), no job created;
- user rejection at every call: fail closed, no further sends;
- provider-managed nonce: `eth_sendTransaction` params include `from/to/data/value/chainId` and omit `nonce`/`gas`;
- chain mismatch, wrong target, wrong calldata, wrong token, wrong provider, wrong price, expired quote, missing confirmation;
- Job 622 / 646 history-only cannot be reused;
- no private key in response; typed `MainTrackNonceTooLowError`.

## 4. Invariants (verified)

- A nonce failure **never** creates another job automatically.
- A failed transaction **never** advances to the next ERC-8183 step.
- No blind `setTimeout`/`sleep`/`retry` hiding the race — nonce management is provider/ledger-driven.

## 5. Regression

Re-run green: `altana:main-track-user-wallet:verify` (37), `main-track-hire` (X.130), `hire-adapter` (X.127), `altana:erc8183:verify`, `activation:main-track` (X.131, 30), `activation` 33, `activation:hire` 23, `activation:hire-api` 14, `capability-source`, X.80, X.81, X.49 25, X.55 22, X.84 14, X.85 13. Web + integrations typecheck, lint, `next build`/build, prettier — PASS.

## 6. No real transaction

This milestone is implementation + harness verification only. Nothing was broadcast; **Job 649 was not created**; Job 648 was not retried. A real testnet hire remains gated on separate explicit authorization.

## Classification

**A — NONCE-SAFE EXECUTOR READY.** The production browser path lets the wallet own the nonce (no manual nonce/gas), and the headless executor is deterministic and serialized, stopping typed and safely on `nonce too low` without ever advancing a step or creating a job. Fully harness-verified; no real transaction broadcast.

**STOP.** No commit/push/deploy; `HEAD`/`origin/main` unchanged `850454da...`.
