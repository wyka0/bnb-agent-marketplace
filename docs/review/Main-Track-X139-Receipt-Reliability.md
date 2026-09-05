# X.139 Receipt Reliability — Isolated Executor Fix

**Mode:** Implementation + harness verification only. **No real transaction, no new job, no wallet funding, no deployment.** Jobs 622/641/646/648/649/650 are history-only; no executor code path may reuse them. No commit/push.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Root cause (X.138)

`createJob` broadcast and mined successfully, but `waitForTransactionReceipt()` threw `Cannot mix BigInt and other types` while polling the **pending** transaction against the seed RPC — a viem pending-tx formatting/polling failure. The flow stopped safely (no escrow moved; jobs 649/650 stranded OPEN budget 0). A direct `getTransactionReceipt()` on the mined tx succeeds.

## 2. Fix

In `packages/integrations/src/altana/v2/main-track-user-wallet.ts`, replaced the fragile receipt-wait with a deterministic strategy:

- **`pollForReceipt(hash, opts)`** — polls raw `getTransactionReceipt(hash)` (returns `null`/`undefined` while pending, so no pending-tx arithmetic ever runs):
  - broadcast is done ONCE by the caller; this function **never rebroadcasts**;
  - `null`/`undefined`/`not found`/`pending` → retry up to a bound;
  - `status == success` → success; `status == reverted` → reverted;
  - **any non-pending RPC error (incl. the X.138 BigInt-mixing viem failure), a malformed receipt status, or a timeout → typed failure** (`{status:"error"}` / `{status:"timeout"}`) — the caller must not proceed and must not rebroadcast.
- **`normalizeReceiptStatus(receipt)`** — deterministic success/revert parsing across string (`"success"`/`"reverted"`), hex (`0x1`/`0x0`), and bigint (`1n`/`0n`) statuses; unknown → `"unknown"` (treated as malformed → error).
- **`createNonceSafeEip1193Provider`** — interface changed from `signAndBroadcast` to **`broadcast(tx, nonce)` + `getReceipt(hash)`**; the provider now:
  1. allocates a ledger nonce,
  2. broadcasts ONCE,
  3. confirms via `pollForReceipt`,
  4. commits the nonce **only after a confirmed success**;
  - a reverted / timeout / polling-error receipt throws before the nonce commits and before any next ERC-8183 step;
  - no sleep-based retry hiding; no automatic transaction retry.

The isolated tooling (`x138-hire.mjs`) was updated to the same `broadcast + getReceipt` interface (ready for a future authorized attempt; not executed).

## 3. Receipt invariants (enforced + tested)

- broadcast → tx hash → bounded receipt polling → confirmed success/revert → only then the next step.
- A missing receipt (timeout) does NOT permit the next ERC-8183 call and does NOT create a job.
- A reverted receipt does NOT continue.
- A polling error (incl. BigInt-mix) does NOT rebroadcast and does NOT continue.
- Historical/stranded jobs (622, 641, 646, 648, 649, 650) are protected by the history guard; no code path reuses them.

## 4. Tests

`altana:main-track-user-wallet:verify` — **80+ checks PASS**:

- receipt immediately available → success, nonces `0..4` monotonic, one receipt per tx, serialized (max in-flight 1), no rebroadcast;
- receipt appears after polling (null xN then success) → confirmed, nonce committed once, bounded polls;
- receipt **reverted / timeout / RPC error / BigInt-mixing / malformed status at every step** (createJob/registerJob/setBudget/approve/fund) → blocked, **no next step, broadcast count == that step (no rebroadcast)**;
- broadcast user rejection and nonce-too-low at every step → fail closed;
- cascade invariant: createJob failure → no registerJob; registerJob failure → no setBudget; setBudget failure → no approve; approve failure → no fund; fund failure → no success state;
- `pollForReceipt`/`normalizeReceiptStatus` pure behavior (string/hex/bigint statuses, pending retry, timeout, BigInt error stop);
- provider-managed nonce (eth_sendTransaction omits `nonce`/`gas`), wrong target/calldata/token/provider/price, expired quote, missing confirmation, Job 622/649 history-only, no private key, typed nonce error.

## 5. Regression

All green: `main-track-user-wallet:verify` (X.139), `main-track-hire` (X.130), `hire-adapter` (X.127), `activation:main-track` (X.131), `activation` 33, `activation:hire` 23, `activation:hire-api` 14, `capability-source`, X.80, X.81, X.49 25, X.55 22, X.84 14, X.85 13, `altana:erc8183:verify`. Web + integrations typecheck, lint, `next build`/build, prettier — PASS.

## 6. Job safety

Read-only on-chain confirmation (unchanged): `622 COMPLETED`, `641 FUNDED`, `646/648/649/650 OPEN budget 0`. No escrow moved anywhere new; no executor path can reuse any of them.

## Classification

**A — RECEIPT EXECUTOR READY.** The isolated Main Track user-wallet executor now confirms each ERC-8183 transaction deterministically via bounded raw-receipt polling, stops typed and safely on reverted/timeout/RPC/BigInt errors without rebroadcasting or advancing a step, and cannot reuse any historical job. Fully harness-verified; **no real transaction broadcast in X.139**.

**STOP.** No commit/push/deploy; `HEAD`/`origin/main` unchanged `850454da...`.
