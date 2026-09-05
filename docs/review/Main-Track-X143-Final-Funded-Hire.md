# X.143 Final Real Main Track Hire — Funded

**Mode:** Final authorized real BSC Testnet Main Track hire attempt using the X.142 reliable receipt reader. Pre-flight **22/22 PASS**; `createJob` **broadcast and mined** (job 653 OPEN), but the flow **stopped** on a recurring viem/seed-RPC `Cannot mix BigInt and other types` failure. Per the final-attempt rule: **STOP — no second job, no new wallet, no further iteration.** No submit/settle; no commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Fresh disposable user wallet

- User wallet: `0xD99fA45bdaE838E5DB97C7e362B32E43f0Bd004F` (new Keystore V3; distinct from seller, buyer, prior marketplace, and prior users).
- Key held only inside the wallet provider / EIP-1193 closure; application never receives a key. No `ALTANA_TESTNET_PRIVATE_KEY`, no AWS/KMS.
- Testnet funding: `0.001 tBNB` + `1.2 U` (transferred from a prior disposable user wallet `0x0389...`; the buyer was out of tBNB — no buyer/seller key used as the user).

## 2. Pre-flight (22/22 PASS)

Connected wallet present; chain 97; Agent 1906 owner/address == seller `0xB0f768...`; seller endpoint `/health` 200 + `/negotiate` 200; quote `1 U`/chain 97/official commerce/payment token/expiry future; `verifyQuoteSignature` → `eip191`, signer == seller; router authoritative; **policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`** (decoded); all 5 targets allowlisted; calldata validated; `0.001 tBNB` + `1.2 U` sufficient; predicted job id `653` not in history `{622,641,646,648,649,650,651,652}`; confirmation true.

## 3. Execution and stop

Using the X.139 nonce-safe executor + X.142 reliable receipt reader (primary seed RPC, fallback publicnode):

- **createJob broadcast once and mined** — **Job 653 (OPEN, budget 0)**, client `0xD99f...`, provider seller.
- The flow then errored: `createJob failed or rejected: Cannot mix BigInt and other types, use explicit conversions` (no `receipt polling error:` prefix) and **stopped** (no `registerJob`, no `setBudget`, no `approve`, no `fund`).

## 4. Investigation (read-only)

- The X.142 reliable receipt reader **works** on the mined Job 653 createJob tx (`0xaabb301ad642aa939e1cd73b6a7ff7cc471da2e4a9d38ab966e8924772aef87a`, block `127210136`): `getTransactionReceipt` succeeded on both the seed RPC and publicnode; `estimateGas` for the createJob calldata succeeded on both RPCs.
- The un-prefixed message indicates the BigInt-mix surfaced **outside the receipt-read path** — in the broader viem/seed-RPC `publicClient` operations during the live pending window (the same class of seed-RPC/viem BigInt-mix seen in X.138/X.141). The X.142 receipt-reader hardening is verified correct but does not cover this separate publicClient path.

## 5. Final on-chain state

```text
622  COMPLETED  budget 1 U
641  FUNDED     budget 1 U
646/648/649/650/651/652/653  OPEN  budget 0
```

- **Job 653**: OPEN, budget 0, client `0xD99f...`, provider seller — **no escrow moved**.
- user5 wallet: `0.00092 tBNB`, `1.2 U`, allowance `0` (no approval, no fund).
- All historical jobs (622, 641, 646, 648, 649, 650, 651, 652) untouched.

## 6. Honesty note

Exactly one `createJob` broadcast occurred (job 653); the flow stopped and was **not retried**; no second job and no new wallet were used. This is the final authorized attempt.

## 7. Exact blocker

A recurring **viem 2.55.19 / seed-RPC `Cannot mix BigInt and other types` failure during the live ERC-8183 `createJob` step (pending window), outside the receipt-read path**. The X.142 reliable receipt reader is verified (works on mined receipts, isolates the receipt-read BigInt-mix with a publicnode fallback), but the seed RPC's `publicClient` operations that construct/broadcast the transaction can still raise this BigInt-mix. A separately authorized hardening is required: route **all** chain calls (`estimateGas`, `signTransaction`-adjacent serialization, `sendRawTransaction`, `getTransactionCount`, `getTransactionReceipt`) through a single reliable RPC (e.g. publicnode), or pin a viem version without the BigInt-mix pending-formatting bug.

## Classification

**B — FAILED SAFELY.** Pre-flight passed (22/22); `createJob` broadcast and mined (job 653, OPEN, no escrow); the flow stopped on a recurring viem/seed-RPC BigInt-mix outside the receipt-read path and was not retried. No second job, no new wallet, no escrow moved; historical jobs untouched. Per the final-attempt rule, iteration stops here; a funded hire requires the separately authorized full-client RPC/viem hardening described above plus a fresh authorized attempt.

**STOP.** No submit, no settle, no second job; 622/641/646/648/649/650/651/652 untouched; no commit/push/deploy.
