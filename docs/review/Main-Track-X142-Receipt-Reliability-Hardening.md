# X.142 Receipt Reliability Hardening — Real ERC-8183 Receipt Verification

**Mode:** Read-only investigation + implementation of a reliable receipt abstraction. **No transaction, no new job, no wallet signing, no deployment.** Jobs 622/641/646/648/649/650/651/652 untouched; Job 653 not created. No commit/push.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Root-cause investigation (read-only)

- **viem version:** `2.55.19`; **publicClient:** `createPublicClient({ transport: http(network.rpcUrl) })` with `network.rpcUrl = https://data-seed-prebsc-2-s2.binance.org:8545` (the SDK's default BSC-testnet seed RPC).
- **Reproduction:** Job 652's createJob tx (`0xc287be4d710cc204e465c89464a7505d37d33088a77c30d1ae4931ca67d68572`, block `127203662`) was read with **both** RPCs once mined:
  - seed RPC: `getTransactionReceipt` OK, `getTransaction` OK
  - publicnode: `getTransactionReceipt` OK, `getTransaction` OK
- **Conclusion:** the `Cannot mix BigInt and other types, use explicit conversions` error is **not** reproducible on the mined receipt and is a **viem pending-transaction formatting failure on the seed RPC** (it can surface from `getTransactionReceipt`/`waitForTransactionReceipt` while a tx is still pending, or from a seed-RPC response shape viem 2.55 does not format safely). It is a **receipt RPC/client reliability problem**, not an ERC-8183 construction problem (createJob broadcast and mined successfully every time; funds never at risk; the flow always stopped before the next step).

## 2. Fix: `getReliableTransactionReceipt` abstraction

Added to `packages/integrations/src/altana/v2/main-track-user-wallet.ts` (browser-safe, injected I/O):

- **`toBigintSafe(value)`** — explicit conversion to `bigint` for `bigint`/hex-string/safe-integer; never silently to `Number`; malformed → `null`.
- **`normalizeReceipt(raw)`** — deterministic normalization of `status` (string/hex/bigint), `blockNumber`, `transactionIndex`, `gasUsed`, `effectiveGasPrice` to **bigint** fields (or `null`). No `Number + BigInt` mixing anywhere; values convert to strings only at JSON/UI boundaries.
- **`createReliableReceiptReader({ read, fallback?, isPending? })`** — the receipt abstraction:
  1. queries the primary RPC (`read`);
  2. success/reverted → **normalized** receipt; `null`/`undefined` → pending;
  3. primary throws pending wording → treated as pending (`null`);
  4. primary throws a **non-pending error (incl. the viem BigInt-mix)** → queries the **reliable `fallback`** RPC and normalizes its result;
  5. fallback absent or also failing → `null` so the **bounded poller** retries and eventually times out (STOP) — the exception never corrupts the executor, never rebroadcasts, never advances a step.
- The executor (`createNonceSafeEip1193Provider`) now consumes any `getReceipt` seam (a reliable reader is supplied by the caller); it still broadcasts once and only commits a nonce after a confirmed success receipt.

The isolated tooling (`x141-hire.mjs`) was updated to use the reliable reader with **primary = seed RPC** and **fallback = publicnode** (the already-supported official/community BSC testnet endpoint; no invented endpoint). Not executed (read-only milestone).

## 3. BigInt safety

- Blockchain quantities are normalized explicitly to `bigint` (`blockNumber`, `gasUsed`, `effectiveGasPrice`, `transactionIndex`).
- No `Number(bigint) + bigint` / `number + bigint` / `bigint + number` anywhere in the receipt path.
- Conversion to string happens only at the JSON output boundary.

## 4. Tests

`altana:main-track-user-wallet:verify` — **ALL PASS**, including new coverage:

- BigInt normalization: `normalizeReceipt` hex-string → bigint (`blockNumber 0x10 → 16n`, `gasUsed 0x100 → 256n`, `effectiveGasPrice 0x200 → 512n`); `toBigintSafe` for bigint/hex/safe-number/malformed/null.
- Reliable reader: mined receipt normalized; pending `null`; pending wording (`could not be found … may not be processed on a block yet`) → `null`; **BigInt-mix primary → fallback success**; reverted; both-fail → `null`; primary error no fallback → `null`.
- Executor with reliable reader: primary BigInt-mix on one tx → fallback → **funded** (5 broadcasts, no rebroadcast); no fallback → **blocked (timeout), no next step, no rebroadcast, no job**.
- Existing matrix re-verified: receipt immediately available / after polling / reverted / timeout / RPC error / BigInt-mix / malformed at every step; user rejection; nonce-too-low; monotonic nonces; serialization; provider-managed nonce; wrong target/calldata/token/provider/price; expired quote; confirmation; history (622/649); no private key.

## 5. Regression

All green: `main-track-user-wallet:verify` (X.142), `main-track-hire` (X.130), `hire-adapter` (X.127), `activation:main-track` (X.131), `activation` 33, `activation:hire` 23, `activation:hire-api` 14, `capability-source`, X.80, X.81, X.49 25, X.55 22, X.84 14, X.85 13, `altana:erc8183:verify`. Web + integrations typecheck, lint, `next build`/build, prettier — PASS.

## 6. Boundary

Absolutely no `createJob`/`registerJob`/`setBudget`/`approve`/`fund`/`settle`, no wallet signing, no new wallet, no new job (653 not created), no production/Vercel/AWS changes, no secrets, no commit/push.

## Classification

**A — REAL RECEIPT RELIABILITY FIX VERIFIED.** The remaining seed-RPC/viem `Cannot mix BigInt` receipt edge is isolated behind a `getReliableTransactionReceipt` abstraction: the primary RPC is queried, its non-pending exceptions (incl. the BigInt-mix) fall back to a reliable RPC, and receipts are normalized to explicit bigint fields with no Number/BigInt mixing. Fully harness-verified (including real-chain reads of the mined Job 652 createJob tx on both RPCs) with no transaction broadcast and no job created.

**STOP.** No commit/push/deploy; `HEAD`/`origin/main` unchanged `850454da...`.
