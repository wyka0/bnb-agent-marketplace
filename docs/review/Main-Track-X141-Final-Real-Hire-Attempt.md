# X.141 Final Authorized Real Main Track Hire Attempt

**Mode:** Final real BSC Testnet Main Track hire attempt with the X.140-corrected receipt classifier. Pre-flight **22/22 PASS**; `createJob` **broadcast and mined** (job 652 OPEN), but the flow **stopped** on a recurring viem/seed-RPC `Cannot mix BigInt and other types` receipt edge after broadcast. Per the hard failure rule: **no retry, no second job**. No submit/settle; no commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Fresh disposable user wallet

- User wallet: `0x2d08979475468c4042f5Ab10b69a8295F971b9CB` (new Keystore V3; distinct from seller, buyer, prior marketplace `0xeb23...`, and prior users `0x9F0E...` / `0x0389...` / `0xc134...`).
- Key held only inside the wallet provider / EIP-1193 closure; application never receives a key. No `ALTANA_TESTNET_PRIVATE_KEY`, no AWS/KMS.
- Testnet funding: `0.0004 tBNB` + `1.2 U` (transferred from the dedicated buyer wallet, which had `0.0005 tBNB` remaining).

## 2. Pre-flight (22/22 PASS)

Connected wallet present; chain 97; Agent 1906 owner/address == seller `0xB0f768...`; seller endpoint `/health` 200 + `/negotiate` 200; quote `1 U`/chain 97/official commerce/payment token/expiry future; `verifyQuoteSignature` → `eip191`, signer == seller; router authoritative; **policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`** (decoded); all 5 targets allowlisted; calldata validated; `0.0004 tBNB` + `1.2 U` sufficient; predicted job id `652` not in history `{622,641,646,648,649,650,651}`; confirmation true.

## 3. Execution and stop

Using the X.139/X.140 receipt-safe executor (serialized ledger, monotonic nonce, `broadcast → poll raw getTransactionReceipt → confirm`):

- **createJob broadcast once and mined** — **Job 652 (OPEN, budget 0)**, client `0x2d08...`, provider seller.
- The receipt poll then hit **`Cannot mix BigInt and other types, use explicit conversions`** (a viem/seed-RPC receipt-formatting edge) and the flow **stopped** (no `registerJob`, no `setBudget`, no `approve`, no `fund`).

## 4. Root cause (documented, NOT changed in this milestone)

The X.140 pending-wording fix worked (the `could not be found … may not be processed on a block yet` message is now correctly retried). However, a **separate viem/seed-RPC `Cannot mix BigInt and other types` error can still surface from `getTransactionReceipt` for the createJob tx**, which the executor correctly treats as a non-pending error and fails closed. This is a reliability edge in the RPC/receipt layer, **not a safety defect** (no funds at risk; the flow always stops before the next step). Per the milestone's "NO CODE CHANGES unless safety-critical", it is documented rather than patched here; a future authorized hardening step should treat viem `getTransactionReceipt` BigInt-mixing errors as a bounded pending-retry (or use a more reliable receipt RPC).

## 5. Final on-chain state

```text
622  COMPLETED  budget 1 U
641  FUNDED     budget 1 U
646/648/649/650/651/652  OPEN  budget 0
```

- **Job 652**: OPEN, budget 0, client `0x2d0897...`, provider seller — **no escrow moved**.
- user4 wallet: `0.00032 tBNB`, `1.2 U`, allowance `0` (no approval, no fund).
- All historical jobs (622, 641, 646, 648, 649, 650, 651) untouched.

## 6. Honesty note

Exactly one `createJob` broadcast occurred (job 652); the flow stopped on the post-broadcast receipt edge and was **not retried**; no second job was created. This is the same class of seed-RPC/viem receipt edge that also surfaced in X.138 (BigInt-mix) and X.140 (pending wording) — the X.140 wording fix held, but a distinct BigInt-mix path remains.

## 7. Regression

`altana:main-track-user-wallet:verify` re-run **ALL PASS**. No marketplace source changed in X.141. Git `HEAD`/`origin/main` unchanged `850454da...`; no commit/push/deploy.

## Classification

**B — FAILED SAFELY.** Pre-flight passed (22/22); `createJob` broadcast and mined (job 652, OPEN, no escrow), but the flow stopped on a recurring viem/seed-RPC `Cannot mix BigInt` receipt edge and was not retried. No second job, no escrow moved, historical jobs untouched. A funded hire now requires a separately authorized hardening of the receipt-read layer (treat viem BigInt-mix as bounded-pending or use a reliable receipt RPC) plus a fresh authorized attempt.

**STOP.** No submit, no settle, no second job; 622/641/646/648/649/650/651 untouched; no commit/push/deploy.
