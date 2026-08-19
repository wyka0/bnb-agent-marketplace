# Main Track Activation — X.28A ERC-8183 Job 515 Funding / Payment Review (BNB Testnet)

**Status:** **BLOCKED** (review complete: 20/21 checks pass; funding execution blocked by zero payer $U balance)
**Date:** 2026-08-14
**Scope:** Strictly read-only funding/payment transaction review for ERC-8183 job **515** on BNB Smart Chain Testnet (chain 97) from live chain state. **No transaction signed, constructed for broadcast, or executed. No approval, funding, payment, or settlement performed. Mainnet not touched.**

---

## 1. Summary

The deterministic funding transaction set that **would** fund job 515 was derived byte-for-byte from the canonical SDK v0.7.0 batch (`buildHireCalls` steps 4–5) and verified against live chain 97 state:

| # | Verification window | Result |
|---|---|---|
| 1–15 | Mandated review checks (chain, job, token, contracts, ABI, amounts, spender, no unrelated recipient, no settlement, chain-97 targets, address consistency) | **PASS (15/15)** |
| sim | `eth_call` simulations (discarded, state never mutated) | approve succeeds; fund reverts (as expected with 0 allowance/balance) |
| 16 | Payer funding feasibility (`balanceOf` ×2 independent RPCs) | **FAIL** — payer holds **0 U** |

The review's verdict is **BLOCKED**: everything about the funding path is correct and deterministic, but the payer EOA (`0x299Ce411…AC15C`, job client/provider) holds **0 $U** on chain 97, so `fund(515, 1 U, "0x")` would revert (simulated: `ERC20: insufficient allowance` at the transfer step; after an approval it would fail again on balance). **Funding must not be broadcast until the wallet holds at least 1 U.**

No blocker existed in contracts, addresses, or calldata: all 15 mandated checks pass.

---

## 2. Input state (from X.25 / X.26 / X.27)

| Item | Value |
|---|---|
| Chain | BNB Smart Chain Testnet, chainId **97** |
| ERC-8004 Agent ID | **1816** |
| Provider / payer / pay-to | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` |
| AgenticCommerce (commerce; escrow + job state machine) | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| EvaluatorRouter (router; evaluator + hook) | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` |
| Bound policy (whitelisted) | `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` |
| ERC-8004 registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| $U payment token (United Stables) | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`, 18 decimals |
| Job id / budget | **515** / **1 U** = `1000000000000000000` raw $U |
| Job status | **OPEN** (0) — created, registered, budgeted; **funded amount 0** |

X.26 tx records (funding steps deliberately excluded there): `createJob` `0x255bf313…7ac8` (block 124879828), `registerJob` `0x7c78c927…4a0e6` (block 124884397), `setBudget` `0x6153d536…8788f` (block 124884401). Post-X.26 there is **no** `approve`/`fund` transaction from the payer.

---

## 3. The mandated checks — live on-chain results

Script: `packages/integrations/src/altana/erc8183.job515.funding.review.x28a.ts` (wired as `altana:x28a:review`). All reads via `eth_call` / `eth_getStorageAt`-class contract reads and discarded `eth_call` simulations against the chain-97 public RPC; payer `balanceOf` cross-checked on a second independent public RPC; no wallet client, no env secrets, no signing.

```
X.28A READ-ONLY ERC-8183 JOB 515 FUNDING/PAYMENT REVIEW (chain 97, no broadcast):
PASS ERC-8183 targets resolve to verified chain-97 implementation
PASS public RPC URL resolved
PASS 1. live eth_chainId == 97
PASS 2. job 515 exists on chain
PASS 3. job status == OPEN (0)
PASS 4. job client/provider == verified provider EOA (payer)
PASS 5. current funded amount == 0 (OPEN, submittedAt 0, no fund tx)
PASS 6. AgenticCommerce paymentToken == $U contract
PASS 6b. token metadata live (United Stables / U / 18 decimals)
PASS 7. job evaluator + hook == verified router 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25
PASS 8. funding ABI matches fund(jobId, expectedBudget, optParams) -> commerce (SDK canonical step 5)
PASS 9. funding amount == exactly 1 U (raw 1000000000000000000)
PASS 10. live allowance(provider -> commerce) on $U readable
PASS 11. spender == AgenticCommerce escrow; no unrelated recipient (approve -> $U, fund -> commerce)
PASS 12. funding call == fund(515, 1 U, "0x") -> commerce (deterministic calldata, SDK-identical)
PASS 13. preview contains ONLY approve + fund (no settlement, no service execution)
PASS 14. preview targets are chain-97 contracts (never mainnet 56)
PASS 15. address consistency (live reads == SDK config == X.25/X.26 records)
PASS sim. approve(1 U) from payer simulated successfully (eth_call, discarded)
PASS sim. fund(515, 1 U) from payer reverts with current balance/allowance (expected)
FAIL 16. payer $U balance >= 1 U (live: 0; cross-RPC: 0)

X.28A read-only funding review: 20/21 checks passed
```

### 3.1 Cross-check details

- **Check 8 / 12 (ABI + calldata):** the funding call was built with `buildHireCalls` (SDK canonical 5-call batch: createJob → registerJob → setBudget → approve → fund) and independently re-encoded; both match byte-for-byte:
  - `fund(515, 1000000000000000000, "0x")` → commerce, selector `0xd2e13f50`
  - `approve(commerce, 1000000000000000000)` → $U, selector `0x095ea7b3` (ERC-20 allowance for the escrow kernel)
- **Check 11 (spender/no unrelated recipient):** the only recipient in the funding path is the AgenticCommerce escrow (approve spender = commerce; fund target = commerce; token = $U). No payee address appears in either call — the kernel escrows funds for job 515, and the verified provider pay-to is enforced by the job's `provider` field.
- **Check 13 (no settlement/service execution):** the review preview contains exactly two calls — no `settle`, `registerJob`, `createJob`, `setBudget`, deliverable submission, or service execution.
- **Check 16 (payer feasibility):** `balanceOf(payer)` = **0** on both `https://bsc-testnet-rpc.publicnode.com` and `https://data-seed-prebsc-1-s1.bnbchain.org:8545`. `allowance(payer → commerce)` = 0.

### 3.2 Read-only simulations (discarded; no state change)

- `eth_call approve(1 U)` from the payer: **succeeds** (well-formed; approval would not revert).
- `eth_call fund(515, 1 U, "0x")` from the payer against current state: **reverts** with `ERC20: insufficient allowance` — expected, since allowance is 0. Even with allowance granted, the transfer would then revert on the **0 U balance**.

---

## 4. Deterministic read-only funding preview (NOT broadcast)

```
X.28A JOB 515 FUNDING PREVIEW (read from chain 97, deterministic):
  jobId: 515
  status: OPEN (0)
  client: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
  provider: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
  budget: 1000000000000000000 raw $U (= 1 U)
  current funded amount: 0 (OPEN, submittedAt 0)

X.28A DETERMINISTIC FUNDING TX SET (review only — NOT broadcast):
  [A] to 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 ($U)
      approve(spender = 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE, amount = 1e18)
      calldata: 0x095ea7b3000000000000000000000000a206c0517b6371c6638cd9e4a42cc9f02a33b0de0000000000000000000000000000000000000000000000000de0b6b3a7640000
  [B] to 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE (AgenticCommerce)
      fund(jobId = 515, expectedBudget = 1e18, optParams = "0x")
      calldata: 0xd2e13f5000000000000000000000000000000000000000000000000000000000000002030000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000
```

---

## 5. X.28A STATUS (mandated block)

```
X.28A STATUS: BLOCKED
JOB: 515
CHAIN: 97 (bnb-testnet)
CURRENT JOB STATUS: OPEN (0)
CURRENT FUNDED AMOUNT: 0
TOKEN: United Stables ($U)
TOKEN DECIMALS: 18
FUNDING AMOUNT: 1 U (raw 1000000000000000000)
SPENDER: 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE (AgenticCommerce — escrow)
FUNDING CONTRACT: 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE (AgenticCommerce)
APPROVAL REQUIRED: YES (live allowance 0)
APPROVAL AMOUNT: 1000000000000000000 (1 U)
FUNDING CALL: fund(515, 1000000000000000000, "0x") -> AgenticCommerce
CALLDATA: GENERATED FOR REVIEW ONLY
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

**Blocker (single):** payer EOA `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` holds **0 $U** on chain 97 (confirmed on two independent RPCs). `fund` pulls `transferFrom(provider, commerce, 1 U)`, which must revert today. **Resolution path:** deposit ≥ 1 U to the payer EOA (e.g. testnet $U source), re-run `altana:x28a:review` (and X.27) to re-validate, then proceed to the broadcast milestone only when the review reports READY.

---

## 6. Artifacts

- Script: `packages/integrations/src/altana/erc8183.job515.funding.review.x28a.ts`
- Package script: `altana:x28a:review` → `node dist/altana/erc8183.job515.funding.review.x28a.js`
- Run: `pnpm --filter @bnb-marketplace/integrations build` then `pnpm --filter @bnb-marketplace/integrations altana:x28a:review`
- Output: 20/21 checks pass; X.28A STATUS: **BLOCKED** (as designed — read-only; no signing/broadcast/payment).