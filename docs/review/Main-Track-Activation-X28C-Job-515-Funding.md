# Main Track Activation — X.28C ERC-8183 Job 515 Funding Execution (BNB Testnet)

**Status:** **PASS** — Job 515 funded with exactly 1 U
**Date:** 2026-08-14
**Scope:** Operator-authorized execution of the two funding calls for ERC-8183 job **515** on BNB Smart Chain Testnet (chain 97): `approve(AgenticCommerce, 1 U)` and `fund(515, 1 U, "0x")`. **No settlement, no service execution, no mainnet contact.**

---

## 1. Summary

X.28B confirmed the wallet was ready ($U 10 ≥ 1, tBNB gas, job 515 OPEN, budget 1 U, allowance 0). This milestone executed the two remaining funding calls:

- **A.** `approve(spender = AgenticCommerce, amount = 1 U)` → $U token — CONFIRMED
- **B.** `fund(jobId = 515, expectedBudget = 1 U, optParams = "0x")` → AgenticCommerce — CONFIRMED

Job 515 is now **FUNDED** with exactly **1 U** escrowed. Settlement was NOT performed; service execution was NOT started.

---

## 2. Pre-sign safety checks (all PASS, 16/16)

Script: `packages/integrations/src/altana/erc8183.job515.funding.execute.x28c.ts` (wired as `altana:x28c:fund`).

```
PASS runtime ERC-8183 config == verified chain-97 implementation
PASS public RPC URL resolved
PASS 1. live eth_chainId == 97
PASS 2. job 515 exists and is OPEN
PASS 3. job 515 client/provider == verified payer EOA
PASS 4. job 515 budget == exactly 1 U (raw 1000000000000000000)
PASS 5. payer $U balance >= 1 U (live: 10000000000000000000 raw)
PASS 6. approval spender == verified AgenticCommerce 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE
PASS 7. $U token address == runtime config 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565
PASS 8. current allowance readable (live: 0 raw)
PASS 9. approval amount == exactly 1 U (raw 1e18)
PASS 10. funding call == fund(515, 1e18, "0x") -> commerce (SDK-identical)
PASS 11. tx set == approve($U) + fund(commerce) only; value 0; no settle/service/unrelated transfer
PASS 11b. no settlement call constructed (tx set has exactly 2 entries)
PASS 11c. any payable-value transfer is excluded (both txs value 0)
PASS signer derived from env matches verified payer EOA
X.28C pre-sign checks: 16/16 passed
```

- Calldata for both calls is **byte-identical to the SDK 0.7.0 canonical batch** (`buildHireCalls` steps 3–4): `approve` selector `0x095ea7b3`, `fund` selector `0xd2e13f50`.
- The signer private key was read ONLY from `.env.local` (`ALTANA_TESTNET_PRIVATE_KEY`); the derived address had to equal the verified payer EOA or the script would have stopped. Never printed.
- Final re-read immediately before signing: chain 97, allowance unchanged (0) — then broadcast.

---

## 3. Execution — transactions

| Step | Call | To | Tx hash | Block |
|---|---|---|---|---|
| A | `approve(AgenticCommerce, 1 U)` | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` ($U) | `0xa8a9c2d8d2f51466fcf77479e66962ea6958aaf815369fdc316ad17f10b4d8c5` | 125048204 |
| B | `fund(515, 1e18, "0x")` | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (AgenticCommerce) | `0xec161bb194e96e098a3263d3ecd870b22e797553c89ae5976d25f93ebf7fa8be` | 125048208 |

Block hashes:
- Approve block `0x7e527f8c54829086541ff80702213a334a15d1f8474ea0a181b082d29ccb3162`
- Fund block `0xc3c5c7beb58060049c9131a93787101ec5bc98d3214f4bb04b9bfa205e03d442`

Post-broadcast verification:
- Allowance after approve: exactly `1000000000000000000` (≥ 1 U) → fund proceeded.
- Job 515 re-read: **FUNDED (1)**, budget still exactly `1000000000000000000`, `submittedAt` 0, `deliverable` empty.
- Fund receipt: status `success`, block matches, `from` = payer EOA, `to` = AgenticCommerce, decoded args `fund(515, 1e18, "0x")`, and a commerce-emitted jobId-indexed log (`topics[1] == 515`) confirms the on-chain funding event.

---

## 4. X.28C final report (mandated)

```
APPROVAL TX: 0xa8a9c2d8d2f51466fcf77479e66962ea6958aaf815369fdc316ad17f10b4d8c5 (block 125048204)
FUNDING TX:  0xec161bb194e96e098a3263d3ecd870b22e797553c89ae5976d25f93ebf7fa8be (block 125048208)
CHAIN: 97 (bnb-testnet)
JOB ID: 515
FINAL $U BALANCE: 9000000000000000000 raw (9 U — 1 U escrowed into job 515)
FINAL ALLOWANCE: 0 raw (exact 1 U allowance consumed by fund)
FINAL tBNB BALANCE: 38373454456838739 raw (~0.0384 tBNB)
JOB 515 STATUS: FUNDED (1)
FUNDED AMOUNT: 1000000000000000000 raw (exactly 1 U)
TOKEN: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 ($U, 18 decimals)
SPENDER/FUNDING CONTRACT: 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE (AgenticCommerce)
SETTLEMENT: NOT PERFORMED
SERVICE EXECUTION: NOT PERFORMED
MAINNET: NOT TOUCHED
STOPPED AFTER FUNDING VERIFICATION
```

**No settlement** (`settle`/`complete`/`dispute`/`claimRefund` not constructed — tx set had exactly 2 entries: approve + fund). **No service execution** (job description is read-only balance snapshot; no deliverable was submitted — `submittedAt` 0). **Mainnet untouched** — every read/broadcast pinned to chain 97.

---

## 5. Artifacts

- Script: `packages/integrations/src/altana/erc8183.job515.funding.execute.x28c.ts`
- Package script: `altana:x28c:fund` → `node dist/altana/erc8183.job515.funding.execute.x28c.js`
- Run: `pnpm --filter @bnb-marketplace/integrations altana:x28c:fund`
- Next gated step (not started): X.28D job execution/service delivery against the funded escrow.