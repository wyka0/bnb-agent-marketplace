# X.140 Final Real Marketplace Hire — Funded Proof

**Mode:** Final real BSC Testnet Main Track hire attempt. Pre-flight **22/22 PASS**; `createJob` **broadcast and mined** (job 651 OPEN), but the flow **stopped** when viem's pending-receipt message (`could not be found … may not be processed on a block yet`) was misclassified as a polling error instead of pending. Per the hard failure rule: **no retry, no second job**. The pending-detection gap was fixed (read-only) so a future authorized attempt can complete. No submit/settle; no commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Fresh disposable user wallet

- User wallet: `0xc1342b5DdefFFdDc9878Fb3506fe489010638557` (new Keystore V3; distinct from seller, buyer, prior marketplace `0xeb23...`, and prior users `0x9F0E...` / `0x0389...`).
- Key held only inside the wallet provider / EIP-1193 closure; application never receives a key. No `ALTANA_TESTNET_PRIVATE_KEY`, no AWS/KMS.
- Testnet funding: `0.0008 tBNB` + `1.2 U` (transferred from the dedicated buyer wallet, which had `0.0013 tBNB` remaining).

## 2. Pre-flight (22/22 PASS)

Connected wallet present; `eth_chainId` 97; Agent 1906 owner/address == seller `0xB0f768...`; seller endpoint `/health` 200 + `/negotiate` 200; quote `1 U`/chain 97/official commerce/payment token/expiry future; `verifyQuoteSignature` → `eip191`, signer == seller; router authoritative; **policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`** (decoded from registerJob calldata); all 5 targets allowlisted; calldata validated; `0.0008 tBNB` + `1.2 U` sufficient; predicted job id `651` not in history `{622,641,646,648,649,650}`; confirmation true.

## 3. Execution and stop

Using the X.139 receipt-safe executor (serialized ledger, monotonic nonce, `broadcast → poll raw getTransactionReceipt → confirm`):

- **createJob broadcast once and mined** (tx `0xb98d96ae8eecfb2e09f7963561a3ba5aaa6f065c54ba4d37d51f62669d2dbdc5`), creating **Job 651 (OPEN, budget 0)**.
- The receipt poll then threw viem's pending message `Transaction receipt with hash "0xb98d96ae…" could not be found. The Transaction may not be processed on a block yet.` — my `isPendingReceiptError` regex (`/not found/`) does **not** match `could not be found`, so it was classified as a polling error and the flow **stopped** (no `registerJob`, no `setBudget`, no `approve`, no `fund`).

## 4. Root cause + fix (read-only, no new transaction)

Root cause: the pending-receipt detection string was too narrow for viem's exact wording. Fix applied in `main-track-user-wallet.ts`:

```ts
isPendingReceiptError now also matches:
  "could not be found", "not be processed on a block yet",
  "not yet mined", "transaction not found"
```

A harness test was added: `pollForReceipt` treats `…could not be found…may not be processed on a block yet` as **pending**, retries, and succeeds. Rebuilt + harness **ALL PASS**.

## 5. Final on-chain state

```text
622  COMPLETED  budget 1 U
641  FUNDED     budget 1 U
646  OPEN       budget 0
648  OPEN       budget 0
649  OPEN       budget 0
650  OPEN       budget 0
651  OPEN       budget 0   (this milestone; client 0xc1342b5D, provider seller)
```

**No escrow moved for 651** (budget 0, no register/setBudget/approve/fund). The user3 wallet still holds its U (1.2 U). Jobs 622/641/646/648/649/650 untouched.

## 6. Honesty note

Exactly one `createJob` broadcast occurred (job 651); the flow stopped on the pending-receipt misclassification and was **not retried** and no second job was created. This is the third tooling-only receipt-edge discovered and now fixed (BigInt-mix in X.138, `could not be found` wording now).

## 7. Production readiness

- The corrected protocol path is fully verified up to and including a mined `createJob` broadcast with the correct nonce and pinned policy.
- With the pending-detection fix, the X.139 receipt executor can now complete the remaining steps. A **fresh, separately authorized testnet attempt** is the final remaining action for a funded hire; no production wiring is involved.

## 8. Tests / regression

`altana:main-track-user-wallet:verify` re-run **ALL PASS** (incl. new pending-wording test). `main-track-hire` (X.130), `hire-adapter` (X.127), `activation:main-track` (X.131), web typecheck + lint, `altana:erc8183:verify` — PASS. Git `HEAD`/`origin/main` unchanged `850454da...`; no commit/push/deploy.

## Classification

**B — TRANSACTION FAILED SAFELY.** Pre-flight passed (22/22); `createJob` broadcast and mined (job 651, OPEN, no escrow), but the flow stopped on a pending-receipt wording gap and was not retried. The pending-detection fix is applied and harness-verified; a funded hire now requires only a fresh, **separately authorized** testnet attempt with the corrected executor.

**STOP.** No submit, no settle, no second job; 622/641/646/648/649/650 untouched; no commit/push/deploy.
