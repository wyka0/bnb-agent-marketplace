# Main Track Activation — X.27 ERC-8183 Job 515 Read-Only Verification (BNB Testnet)

**Status:** **PASS** (25/25 read-only checks)
**Date:** 2026-08-14
**Scope:** Strictly read-only verification of ERC-8183 job **515** on BNB Smart Chain Testnet (chain 97) from live chain state. **No transaction signed, constructed, or broadcast.**

---

## 1. Summary

Job 515 (created and budgeted in X.26, not funded) was verified against live chain 97 state:

- All 15 mandated verification items **PASS** (see §3).
- Transaction receipts for `createJob`, `registerJob`, and `setBudget` are **confirmed** on chain (status `success`, matching blocks) — see §4.
- Receipt logs cross-check the job/policy/budget bindings (see §4.2).
- **No duplicate job 515** exists (monotonic `jobCounter` + single `createJob` receipt; see §5).
- Job 515 is **NOT funded** and **NOT settled**.
- No mainnet (chain 56) touched; no signing/broadcast anywhere.

---

## 2. Verified input state (from X.25 / X.26)

| Item | Value |
|---|---|
| Chain | BNB Smart Chain Testnet, chainId **97** |
| ERC-8004 Agent ID | **1816** |
| Provider / owner / pay-to | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` |
| AgenticCommerce (commerce) | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| EvaluatorRouter (router; evaluator + hook) | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` |
| Bound policy (whitelisted) | `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` |
| SDK stale policy (NOT whitelisted) | `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6` (documented X.26 divergence) |
| ERC-8004 registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| $U payment token | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` (18 decimals) |
| Job id / budget | **515** / **1 U** = `1000000000000000000` raw $U |
| Service endpoint | `https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service` |
| Canonical metadata | `https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json` |

---

## 3. The 15 mandated checks — live on-chain results

Script: `packages/integrations/src/altana/erc8183.job515.verify.x27.ts` (wired as `altana:x27:verify`). All reads via `eth_call` / `eth_getTransaction` / `eth_getTransactionReceipt` against the chain-97 public RPC; no wallet client, no env secrets, no signing.

```
X.27 READ-ONLY ERC-8183 JOB 515 VERIFICATION (chain 97, no broadcast):
PASS ERC-8183 targets resolve to verified chain-97 implementation
PASS public RPC URL resolved
PASS 1. live eth_chainId == 97
PASS 2. job 515 exists on chain
PASS 3. job status == OPEN (0)
PASS 4. job client/provider == verified provider EOA
PASS 5. registry ownerOf(1816) == provider EOA
PASS 6. evaluator == verified router 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (evaluator + hook)
PASS 7. bound policy is verified whitelisted policy 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA (router whitelist == true)
PASS 7b. SDK stale policy NOT whitelisted (documented X.26 divergence)
PASS 8. AgenticCommerce paymentToken == $U contract
PASS 9. job budget == exactly 1 U (raw 1000000000000000000)
PASS 10. pay-to == provider EOA (ALTANA_PAYTO == provider address)
PASS 11. job parameters match X.25/X.26 (description, expiredAt 1786730495, budget 1 U, jobId 515, provider)
PASS 11b. canonical metadata reachable (HTTP 200)
PASS 12. registerJob tx confirmed (block 124884397, success, binds job 515 -> 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA)
PASS 13. setBudget tx confirmed (block 124884401, success, job 515, exactly 1 U)
PASS 12b. registerJob receipt log binds job 515 -> whitelisted policy
PASS 13b. setBudget receipt log references job 515
PASS 14. job NOT funded (status OPEN, submittedAt 0, no fund tx)
PASS 15. job NOT settled (OPEN, no deliverable, submittedAt 0)
PASS jobCounter readable (live value 520)
PASS jobCounter >= 515 (monotonic; job 515 assigned exactly once)
PASS createJob receipt confirms single creation of job 515 (log topic == 515)
PASS no other job (5 probed after 515) belongs to our provider EOA

X.27 read-only verification: 25/25 passed
```

### 3.1 Live job state (read from chain)

```
jobId: 515
status: OPEN (0)
client: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
provider: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
evaluator: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25
hook: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25
description: Read-only BNB Testnet wallet snapshot. Reports the requested wallet's
  native BNB balance from chain 97; it does not move funds or execute portfolio actions.
budget: 1000000000000000000 raw $U (= 1 U)
expiredAt: 1786730495 (unix)
submittedAt: 0
deliverable: 0x0000…0000 (none)
jobCounter: 520
```

---

## 4. Transaction receipts and logs

### 4.1 Receipts (all chain 97, value 0, `status: success`, sender = provider EOA)

| Step | Function | Target | Tx hash | Block | Receipt |
|---|---|---|---|---|---|
| 1 | `createJob` | commerce `0xa206c0…` | `0x255bf313ea1e0f3cb4164e3c7821703ac0a7429f9dcc1e20323c55e8d6cc7ac8` | 124879828 | success |
| 2 | `registerJob(515, policy)` | router `0xD7d36D…` | `0x7c78c9270c9ac0a044b7bb016e6ed535d74436512a3432ff333f9d2b9334a0e6` | 124884397 | success |
| 3 | `setBudget(515, 1 U, "0x")` | commerce `0xa206c0…` | `0x6153d53670bfef9777d40a8168f5a25da63bedf053fa8275e2c178ef68e8788f` | 124884401 | success |

Verified by decoding each tx's input calldata (`decodeFunctionData`):

- **registerJob** calldata decodes to `registerJob(515, 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA)` — binds the **whitelisted** policy.
- **setBudget** calldata decodes to `setBudget(515, 1000000000000000000, 0x)` — exactly **1 U**.
- **createJob** receipt confirms `from == provider EOA`, `to == commerce`, block 124879828.

### 4.2 Receipt logs (event cross-checks)

- **createJob log** (commerce): topic0 `0xb0f0239b…`, topic1 = `0x…203` = **515**, topic2/3 = provider EOA. Single creation record for job 515.
- **registerJob log** (router): topic0 `0xab6d9121…`, topic1 = **515**, topic2 = `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` (whitelisted policy), topic3 = provider EOA. Confirms the on-chain policy binding for job 515.
- **setBudget log** (commerce): topic0 `0x869e2577…`, topic1 = **515**.

All three receipts' logs carry exactly the expected job/policy/owner bindings; nothing unexpected appears in the receipt sets (each tx emitted exactly one relevant event, matching the X.26 broadcast set of three transactions).

---

## 5. Duplicate / unexpected-state scan

- `jobCounter()` on commerce now reads **520** (X.26 recorded 515). This is **expected live-market activity**: jobs 516–520 were created after our job by other actors (`0xD92f9F7b…` and `0x16ec3C81…` — FUNDED/OPEN/SUBMITTED external jobs, none ours). The rail is public and live; the increase is not related to our job.
- The kernel's `jobCounter` is monotonic (job ids are 1-indexed, assigned once each), so job id **515** can only exist once. Confirmed by:
  - the single `createJob` receipt whose event topic carries id 515;
  - `getJob(515)` returning the one storage slot (job 515, ours);
  - a bounded probe of jobs 516–520: **none** belongs to our provider EOA.
- No duplicate job 515, no unexpected state, no second `createJob` from our EOA.

> Note: the pruned-history duplicate scan via `eth_getLogs` over historical blocks is impossible on the public BSC testnet RPC ("History has been pruned for this block"). The verification therefore proves uniqueness through the monotonic counter + single creation receipt + post-515 ownership probe (strictly stronger and RPC-safe).

---

## 6. Honest statement of what was NOT done

- **NO** job created / registered / budgeted (no `createJob`/`registerJob`/`setBudget`).
- **NO** funding, payment, hire/execute, or settlement (`approve`/`fund`/`settle`/`claimRefund` all untouched).
- **NO** transaction signed or broadcast; no wallet client; no private key read or rendered (only the public `ALTANA_PAYTO` address is compared, never printed as a secret; the private key env is not read by this script).
- **NO** mainnet (chain 56) touched — every read is on chain 97.
- **NO** agent record, metadata, or service modified.
- No commit/push performed.

---

## 7. Verification suites run

All read-only (no broadcasting scripts executed):

- **X.27 job 515 read-only verification: 25/25** (this review)
- X.26 job creation broadcast script: **NOT run** (it signs/broadcasts — out of scope for this read-only review)
- X.23 registration execution: **NOT run** (signs/broadcasts)

---

## 8. Final status

```
X.27 STATUS: PASS (25/25 read-only checks)
JOB CREATED: YES (X.26, re-verified read-only here)
CHAIN: 97 (bnb-testnet)
AGENT ID: 1816
JOB ID: 515
PROVIDER/OWNER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
EVALUATOR/FACILITATOR: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (router; evaluator + hook)
PAY-TO: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C (ALTANA_PAYTO)
TOKEN: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 ($U)
POLICY (bound): 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA (whitelisted)
BUDGET: 1 U (raw 1000000000000000000)
EXPIRATION: 1786730495
JOB STATUS: OPEN (0) — created, registered, budgeted; NOT funded, NOT settled
CREATE JOB TX: 0x255bf313ea1e0f3cb4164e3c7821703ac0a7429f9dcc1e20323c55e8d6cc7ac8 (block 124879828)
REGISTER JOB TX: 0x7c78c9270c9ac0a044b7bb016e6ed535d74436512a3432ff333f9d2b9334a0e6 (block 124884397)
SET BUDGET TX: 0x6153d53670bfef9777d40a8168f5a25da63bedf053fa8275e2c178ef68e8788f (block 124884401)
FUNDING: NOT PERFORMED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
DUPLICATE JOB 515: NONE
BROADCAST: NONE (read-only verification only)
```

**STOP** — X.27 read-only verification complete. **PASS.** Job 515 remains OPEN, registered, and budgeted (1 U) on chain 97 — ready for an operator-gated funding decision; nothing further was started.
