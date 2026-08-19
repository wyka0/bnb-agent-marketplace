# Main Track Activation — X.26 ERC-8183 Job Creation (BNB Testnet)

**Status:** COMPLETE (job **515** created, registered, and budgeted — **NOT funded**, **NOT settled**)
**Date:** 2026-08-13
**Scope:** Create the ERC-8183 job for the registered provider (ERC-8004 Agent ID 1816) on chain 97. Broadcasting of **`registerJob` + `setBudget` only**; **NO** `approve`/`fund` (funding), **NO** payment, **NO** settlement.

---

## 1. On-chain transactions

| Step | Function | Target | Tx hash | Block | Status |
|---|---|---|---|---|---|
| 1 | `createJob` | commerce `0xa206c0…` | `0x255bf313ea1e0f3cb4164e3c7821703ac0a7429f9dcc1e20323c55e8d6cc7ac8` | 124879828 | confirmed |
| 2 | `registerJob(515, policy)` | router `0xD7d36D…` | `0x7c78c9270c9ac0a044b7bb016e6ed535d74436512a3432ff333f9d2b9334a0e6` | 124884397 | success |
| 3 | `setBudget(515, 1 U, "0x")` | commerce `0xa206c0…` | `0x6153d53670bfef9777d40a8168f5a25da63bedf053fa8275e2c178ef68e8788f` | 124884401 | success |

All transactions chain 97, value 0 (ERC-20 flow; no native BNB transfer). Tx hashes are public on-chain data.

---

## 2. Final job state (read from chain after step 3)

```
jobId: 515
status: OPEN (0)
client: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
provider: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
evaluator: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (router)
hook: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (router)
budget: 1000000000000000000 raw $U (= 1 U)
expiredAt: 1786730495 (unix)
submittedAt: 0
deliverable: none (0x0…0)
```

Post-broadcast verification (4/4 PASS): job OPEN, budget == 1 U recorded, submittedAt == 0, NOT funded.

---

## 3. Corrected policy address (root cause + resolution)

The initial X.26 run reverted at `registerJob(515, policy)` with `Execution reverted for an unknown reason`. Diagnosis (`erc8183.job.register.revert.diagnose.ts`, read-only) established:

- The deployed router's `registerJob` first gate is `require(policyWhitelist[policy])` (`PolicyNotWhitelisted`).
- The SDK 0.7.0 / X.25 config `policy` (`0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6`) is **NOT** whitelisted on the chain-97 router → revert for every sender and every policy argument.
- The deployed whitelisted OptimisticPolicy is `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`, sourced from `bnb-chain/apex-contracts` `scripts/addresses.ts` (testnet policy; documented as authoritative on conflicts).
- Live on-chain reads confirm: `router.policyWhitelist(0xd6a421…) == true`, `disputeWindow() == 900 s`, `voteQuorum() == 1`.
- `eth_call` of `registerJob(515, 0xd6a421…)` from the provider EOA **succeeds**.

Continuation (`erc8183.job.completion.cont.ts`) therefore rebuilds the `registerJob` calldata to bind the **whitelisted** policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`. This is a documented divergence from the X.25 config table policy address, driven by the authoritative deployment source and verified on-chain.

> Note: `disputeWindow` reported by the bound policy is **900 s**, not the 86400 s figure used for X.25 `expiredAt` derivation. `expiredAt` (1786730495) was already fixed on-chain by `createJob` and is unchanged; it remains a client-side deadline and is valid (now + ~24 h at creation).

---

## 4. Continuation safety gates (16/16 PASS)

- configured price exactly 1 U (raw 1e18)
- provider private key present (presence only)
- ERC-8183 targets resolve to verified chain-97 implementation (commerce/router/registry/$U)
- SDK config.policy is the known-stale un-whitelisted address (documented divergence)
- live `eth_chainId` == 97
- live `jobCounter` == 515 (job 515 created, nothing else ran)
- job 515 is ours (client/provider == provider EOA)
- job 515 OPEN, budget 0, never submitted (continuation precondition)
- `router.policyWhitelist(WL_POLICY)` == true
- WL_POLICY `disputeWindow` == 900 s and `voteQuorum` == 1
- draft rebuilt from verified X.25 params (5 calls)
- createJob NOT rebroadcast (call 0 skipped, already confirmed)
- registerJob calldata rebuilt to bind the whitelisted policy (jobId 515, `0xd6a421…`)
- setBudget targets verified commerce with budget 1 U
- funding calls (approve/fund) present but NOT broadcast
- derived signer == provider EOA == pay-to

Final live re-read before signing: chain 97, jobCounter 515, job 515 OPEN/budget 0 → broadcast only `registerJob` + `setBudget`.

---

## 5. Honest statement of what was NOT done

- **NO** `approve` / `fund` broadcast — job 515 is created, registered, and budgeted but **NOT funded**.
- **NO** payment, settlement, or claim.
- **NO** second job created; **NO** `createJob` rebroadcast.
- **NO** mainnet (chain 56) touched — all on chain 97.
- **NO** agent record modified; `assertErc8183SigningBoundary` untouched.
- No private key / API key rendered; errors redact 64-hex hashes.
- No commit/push performed.

---

## 6. Final status

```
X.26 STATUS:
JOB CREATED: YES
CHAIN: 97 (bnb-testnet)
AGENT ID: 1816
JOB ID: 515
PROVIDER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
EVALUATOR/FACILITATOR: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (router; evaluator + hook)
PAY-TO: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C (ALTANA_PAYTO)
TOKEN: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 ($U, 18 decimals)
POLICY (bound): 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA (whitelisted; disputeWindow 900 s)
BUDGET: 1 U (raw 1000000000000000000)
EXPIRATION: 1786730495
JOB STATUS: OPEN (0) — created, registered, budgeted; NOT funded
CREATE JOB TX: 0x255bf313ea1e0f3cb4164e3c7821703ac0a7429f9dcc1e20323c55e8d6cc7ac8 (block 124879828)
REGISTER JOB TX: 0x7c78c9270c9ac0a044b7bb016e6ed535d74436512a3432ff333f9d2b9334a0e6 (block 124884397)
SET BUDGET TX: 0x6153d53670bfef9777d40a8168f5a25da63bedf053fa8275e2c178ef68e8788f (block 124884401)
FUNDING: NOT PERFORMED (approve/fund calls excluded)
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

**STOP** — X.26 job creation complete and verified. Job 515 is ready for an operator-gated decision on funding; no further step was started.
