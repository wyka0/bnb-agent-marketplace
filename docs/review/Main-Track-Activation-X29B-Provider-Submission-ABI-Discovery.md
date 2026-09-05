# Main Track Activation — X.29B ERC-8183 Job 515 Provider Submission ABI Discovery (BNB Testnet)

**Status:** **READY** — exact provider submission mechanism + calldata established; **submission gate OPEN** (job 515 submittable, time-boxed).
**Date:** 2026-08-14
**Mode:** STRICT READ-ONLY (no sign, no broadcast, no payment, no settlement, no new job, no mainnet).
**Scope:** The provider-side deliverable submission that moves ERC-8183 job **515** FUNDED (1) → SUBMITTED (2). X.29A was BLOCKED on "submission ABI unknown". X.29B closes that gap from the authoritative `bnb-chain/apex-contracts` source + deployed bytecode, and additionally **resolves a `disputeWindow` 900s vs 86400s contradiction** that initially produced a false `SubmissionTooLate` verdict.

---

## 1. Repro of the X.29A blocker and what changed

X.29A could not generate the submission calldata because SDK 0.7.0/0.7.1 exposes **no** provider submission builder and the repo added none. X.29B sourced the ABI from the official **minimum-abstraction-of-solidity under the real gating label**: the deployed ERC-8183 kernel implements the exact same lifecycle as `bnb-chain/apex-contracts`, whose `AgenticCommerceUpgradeable.sol` defines:

```solidity
function submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams)
    external nonReentrant whenNotPaused
```

Signature/selector cross-verified in **deployed bytecode** (commerce impl + router impl constant) and against the EIP-8183 provider-only semantic.

---

## 2. Final verify run (31/31 PASS, current block height)

| Check | Result | Evidence |
|---|---|---|
| 0. Live chainId == 97 | PASS | `eth_chainId` = 97 |
| 1a–1d. Commerce/router proxies + impls + policy + token == official `apex addresses.ts` | PASS | commerce impl `0x153783…`, router impl `0x40c025…`, token `0xc70B…` |
| 2a. `submit(uint256,bytes32,bytes)` `0x9e63798d` in commerce impl | PASS | deployed bytecode contains selector |
| 2b. same selector `0x9e63798d` in router impl (`SUBMIT_SELECTOR`) | PASS | |
| 2c–2g. `onSubmitted`/`check`/`dispute`/`disputeWindow`/`voteReject`/`fund`/`claimRefund`/`beforeAction`/`afterAction`/`registerJob`/`settle` selectors | PASS | all present in the correct deployed bytecode |
| 3a. Job 515 provider == provider EOA | PASS | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` |
| 3b–3e. Job 515 FUNDED, 1 U, router evaluator+hook, expiredAt 1786730495 | PASS | unchanged from X.26 |
| 4a. expiredAt in future | PASS | |
| 4b0. `router.jobPolicy(515)` == WL policy `0xd6a421…` | PASS | authoritative binding |
| 4b1. **BOUND** policy `disputeWindow` == **900s** | PASS | reproduces X.26-cont / X.29A live |
| 4b2. **STALE SDK** policy `disputeWindow` == **86400s** | PASS | exactly the X.25/X.26 creation figure |
| 4b3. Submission gate open with bound window (now + 900 ≤ expiredAt) | PASS | |
| 4c. commerce not paused | PASS | |
| 4d. BOUND policy `submittedAt(515)` == 0 (not yet initialised) | PASS | |
| 5a–5c. Calldata selector + round-trip decode + deliverable hash | PASS | `submit(515, keccak(manifest), manifest)` exact |
| 6a. Bound-policy gate verdict | PASS | **OPEN — job 515 submittable** |

---

## 3. The `disputeWindow` contradiction — RESOLVED (answer = A)

The X.26 report recorded **both** figures. They come from **two different policy contracts**:

| Figure | Contract | Read by | Used for |
|---|---|---|---|
| **86400 s** | STALE SDK policy `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6` | X.25 preview + X.26 creation (`erc8183.job.creation.x26.ts:242`, read `config.policy`; `erc8183.job.preview.x25.ts:168`) | `expiredAt` derivation (now + 86400 + 1800) |
| **900 s** | **BOUND** WL policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` | X.26 continuation (`erc8183.job.completion.cont.ts:257`) + X.29A (`:312`) | the submission window that actually gates the job |

Root cause (documented divergence): the SDK `@altananetwork/sdk` `erc8183Addresses(97).policy` points at the **stale** `0x4F4678…`, which is **not** whitelisted and is **not** what job 515 is bound to. The authoritative policy is `router.jobPolicy(515)` = `0xd6a421…` (registered in `apex addresses.ts`, confirmed on-chain).

**The initial X.29B "SubmissionTooLate" verdict was an artifact of my script reading `config.policy` (the stale SDK policy, 86400s).** Once the gate is evaluated against the exact **bound** policy (900s), the gate is **OPEN**.

Verified live at this block:
- `router.jobPolicy(515)` = `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`
- BOUND policy: `disputeWindow` = **900s**, `voteQuorum` = **1**
- STALE SDK policy: `disputeWindow` = **86400s**
- now = 1786721262, expiredAt = 1786730495, **remaining = 9233s**
- 9233s > 900s → policy `onSubmitted` (L223: `block.timestamp + disputeWindow > job.expiredAt → SubmissionTooLate`) is **not** triggered.

Immutability note: `OptimisticPolicy` is **immutable** (not upgradeable), so each contract's window cannot drift; the live reads are authoritative.

---

## 4. Submission mechanism (authoritative)

```
commerce.submit(jobId, deliverable, optParams)          // kernel proxy 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE
  requires: job.provider == msg.sender; status == Funded;
            block.timestamp < expiredAt; not paused; nonReentrant
  -> _beforeHook(router, submit.selector, abi.encode(deliverable, optParams))   // router.beforeAction
  => status = Submitted(2); submittedAt = ts; deliverable persisted
  -> _afterHook(router, submit.selector, hookData)                                // router.afterAction
       -> policy.onSubmitted(jobId, deliverable, optParams)  // 0xd6a421… onlyRouter
            -> gate: block.timestamp + disputeWindow(900) <= expiredAt   // else SubmissionTooLate
               <=> block.timestamp <= expiredAt - 900 = 1786729595
            => submittedAt[515] = ts; emit JobInitialised(jobId, deliverable, ts, optParams)
  emit JobSubmitted(jobId, provider, deliverable)
```

- **Function:** `submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams)`
- **Selector:** `0x9e63798d`
- **Caller (signer):** provider EOA `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- **Target:** commerce proxy (contract call routed to commerce impl)
- **Deliverable manifest (optParams):** `{"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}`
- **deliverable bytes32:** `keccak256(manifest)` = `0xb4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea`
- **Pre-signable round-trip calldata:**
  `0x9e63798d…` (verified to decode back to `submit(515, keccak(manifest), manifest)` exactly).
- **State transition:** FUNDED → SUBMITTED; COMPLETED only later via `router.settle` after the 900s window (verdict APPROVE); refund on expiry.

---

## 5. FINAL VERDICT

> **SUBMISSION READY.** Job 515 IS submittable by the provider EOA at this block height.
> The only SD-dogma-worthy boundary is **time**: the submit transaction must be **mined before unix 1786729595** (`expiredAt − disputeWindow = 2026-08-14T17:46:35Z`); past that, `policy.onSubmitted` reverts `SubmissionTooLate`. Around now, that leaves roughly **2.3 h**.
>
> **No submission was attempted** — READ-ONLY only. Signing/broadcast remain operator-gated and out of scope.

### 5a. Existing verification suite re-runs

| Suite | Result | Note |
|---|---|---|
| X.29B (this review) | **31/31** | previously misreported 27/29 due to stale-policy read; corrected → all PASS, gate OPEN |
| X.29A execution review | 26/27 | sole FAIL = prior missing-submit-ABI blocker (now closed by X.29B); its check 9c "WL policy disputeWindow == 900s" PASS — consistent with the bound policy |
| X.27 verify | 22/25 | FAILs only on job-status checks that assumed pre-funding OPEN — correct now (FUNDED) |
| X.28B verify | 7/8 | sole FAIL = status OPEN→FUNDED, expected after X.28C |
| monorepo `pnpm typecheck` | PASS | |
| monorepo `pnpm lint` | PASS | |
| monorepo `pnpm build` | PASS | |
| monorepo `pnpm test` | PASS | |

---

## 6. Files

- Script: `packages/integrations/src/altana/erc8183.job515.submission.abi.x29b.ts`
- Package script: `altana:x29b:abi-review` → `node dist/altana/erc8183.job515.submission.abi.x29b.js`
- Run: `pnpm --filter @bnb-marketplace/integrations altana:x29b:abi-review`

---

## 7. Final report

```text
X.29B STATUS: READY — exact provider submission mechanism + calldata established (READ-ONLY)
  CHAIN: 97 (bnb-testnet)
  JOB: 515
  JOB STATUS: FUNDED (1)
  ESCROW: 1000000000000000000 raw (exactly 1 U)
  AGENT ID: 1816
  PROVIDER (signer): 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
  EVALUATOR/HOOK: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (router)
  BOUND POLICY: 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA (OptimisticPolicy; disputeWindow 900s, voteQuorum 1)
  STALE SDK POLICY (findings): 0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6 (disputeWindow 86400s; NOT bound to 515)
  EXPIRED_AT: 1786730495 (now 1786721262; remaining 9233s)
  SUBMIT FUNCTION: submit(uint256,bytes32,bytes)  /  selector 0x9e63798d
  SUBMIT TARGET: commerce proxy 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE
  CALLER: provider EOA (EIP-8183 provider-only)
  DELIVERABLE: {"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}
  DELIVERABLE HASH: 0xb4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea
  CALLDATA: GENERATED FOR REVIEW ONLY -> NOT BROADCAST (round-trip exact)
  SUBMISSION GATE: OPEN  (now + 900 <= expiredAt)   => SUBMISSION READY
  TIME-BOX: must mine before unix 1786729595 (2026-08-14T17:46:35Z)
  SETTLEMENT: NOT PERFORMED
  SIGNING: NOT PERFORMED
  BROADCAST: NOT PERFORMED
  MAINNET: NOT TOUCHED
```

**STOP** — X.29B resolution complete. The `disputeWindow` contradiction is resolved (answer A): 86400s belongs to the stale SDK policy `0x4F4678…`; the bound policy `0xd6a421…` is 900s, and the submission gate is evaluated against that bound 900s. **Submission is READY but time-boxed to ~2.3 h from this block.** No signing, broadcast, job modification, new job, or policy change was performed.

---

## 8. Related finding (carry-over)

1. **SDK policy-address drift** — `@altananetwork/sdk` `erc8183Addresses(97).policy` = `0x4F4678…` (stale) ≠ bound `0xd6a421…`. This is the same root cause as the X.26 divergence and drove the 900/86400 contradiction. Post-submission deliverable reads via repo `getErc8183Deliverable` must override the reader policy to the bound `0xd6a421…` (or `JobInitialised` will be scanned on the wrong contract).