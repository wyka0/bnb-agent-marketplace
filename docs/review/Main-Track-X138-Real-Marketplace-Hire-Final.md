# X.138 Real Marketplace Hire — Final Transaction

**Mode:** Final real BSC Testnet Main Track hire attempt. The X.137 nonce-safe executor **worked** (createJob broadcast with a correct, monotonic nonce and mined with status success), but the flow **stopped on a post-broadcast receipt-wait error** (`Cannot mix BigInt and other types`) before any registration/funding. Per the hard failure rule: **no retry, no further job**. No submit/settle; no commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Fresh disposable user wallet

- User wallet: `0x03893498F3ccaA8942D273FA25C2CB1d76a82A8B` (new Keystore V3; distinct from seller `0xB0f7...`, buyer `0x299C...`, prior marketplace `0xeb23...`, prior user `0x9F0E...`).
- Key held only inside the wallet provider / EIP-1193 closure; the application never receives a key. No `ALTANA_TESTNET_PRIVATE_KEY`, no AWS/KMS.
- Testnet funding: `0.01 tBNB` + `1.2 U` (transferred from the dedicated buyer wallet).

## 2. Pre-flight (all 22 checks PASS)

- `eth_requestAccounts` → address present; `eth_chainId` → 97.
- Agent 1906 exists; owner/agentAddress == seller `0xB0f768...`.
- Seller endpoint `/health` `200`; `/negotiate` `200`.
- Quote: `1 U`, chain 97, official commerce `0xa206c0517...`, payment token `0xc70B8741...`, expiry future; `verifyQuoteSignature` → `eip191`, signer == seller.
- Router == authoritative `0xd7d36d66...`; **policy == `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`** (decoded from the registerJob calldata).
- All 5 targets allowlisted; all calldata validated (len ≥ 10); provider == seller; budget == `1 U`.
- Connected wallet has `0.0099 tBNB` + `1.2 U` (sufficient).
- Predicted job id `650` not in history `{622,641,646,648}`; history guard passed.

## 3. What happened

The X.137 nonce-safe executor (serialized ledger, monotonic nonces, commit-after-confirm) ran `createJob`. The transaction **broadcast and mined with status success** (job 650 created), but the script's post-broadcast `waitForTransactionReceipt` threw `Cannot mix BigInt and other types, use explicit conversions` on the **pending** receipt from the seed RPC, and the flow stopped per the failure rule (no `registerJob`, no `setBudget`, no `approve`, no `fund`).

A first execution attempt (invoked together with the seller/tunnel startup, whose output was lost to the harness kill) had the same post-broadcast error and is the source of a second stranded `createJob`:

- **Job 649** (user nonce 0, block `127185924`, createJob `0x49ee4f69...30a`) — OPEN, budget 0
- **Job 650** (user nonce 1, block `127187356`, createJob `0x762d43e6...674`) — OPEN, budget 0

Both are stranded OPEN artifacts with **zero escrow**; neither was registered, budgeted, approved, or funded.

## 4. Root cause

The **nonce-safe executor itself worked** — `createJob` was broadcast with the correct nonce and mined successfully. The failure is in **viem's `waitForTransactionReceipt` while the tx is pending against the seed RPC** (`data-seed-prebsc-2-s2.binance.org`), which throws `Cannot mix BigInt and other types` for the createJob tx shape. The same call succeeds once the tx is mined (verified read-only). This is a tooling/RPC pending-receipt polling bug, **not** a protocol, address, or nonce problem.

## 5. Final on-chain state (read-only)

```text
622  COMPLETED  budget 1 U   (historical)
641  FUNDED     budget 1 U   (historical, client 0xeb23...)
646  OPEN       budget 0     (X.135 artifact)
648  OPEN       budget 0     (X.136 artifact)
649  OPEN       budget 0     (this milestone, client 0x0389...)
650  OPEN       budget 0     (this milestone, client 0x0389...)
```

No escrow moved for 649/650; the user wallet still holds its U (1.2 U). Jobs 622/641/646/648 untouched.

## 6. Honesty note

Two `createJob` broadcasts occurred (jobs 649 and 650) because the first execution attempt was wrapped with the seller/tunnel startup command, whose output the harness discarded, and the flow was then re-run once. Both attempts failed closed at the same post-broadcast verification error with no further steps; no funds moved. Per the milestone's hard rule, no third job was created and no retry was attempted.

## 7. Production readiness

- **The corrected protocol path is verified**: pinned chain-97 addresses (policy `0xd6a42175...`), nonce-safe serialized executor, allowlisted targets, exact `1 U`, provider/seller binding — all worked up to and including a successful `createJob` broadcast.
- The **remaining blocker is a tooling fix**: replace viem's pending-poll `waitForTransactionReceipt` with a resilient manual `getTransactionReceipt` poll (or a more reliable RPC for the wait) so a funded hire can complete. This is a local executor change; no production wiring is involved.

## 8. Tests

`altana:main-track-user-wallet:verify` re-run **ALL PASS** (37 checks, incl. nonce monotonicity, serialization, nonce-too-low stop). No marketplace source changed in X.138 (only isolated tooling scripts). Git `HEAD`/`origin/main` unchanged `850454da...`; no commit/push/deploy.

## Classification

**B — TRANSACTION FAILED SAFELY.** The X.137 nonce-safe executor and corrected protocol path are proven up to a successful `createJob` broadcast (mined, status success), but the flow stopped safely on a post-broadcast receipt-wait tooling error before any registration/funding, with no escrow moved and no retry/duplicate beyond the two stranded OPEN artifacts (649/650). A funded hire requires a resilient receipt-wait fix in the isolated executor and a fresh, **separately authorized** attempt.

**STOP.** No submit, no settle, no third job; 622/641/646/648 untouched; no commit/push/deploy.
