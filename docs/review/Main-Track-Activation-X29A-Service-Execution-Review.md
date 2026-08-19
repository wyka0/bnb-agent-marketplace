# Main Track Activation — X.29A ERC-8183 Job 515 Service Execution / Hire Review (BNB Testnet)

**Status:** **BLOCKED** — execution/hire calldata CANNOT be deterministically generated (exact blocker below).
**Date:** 2026-08-14
**Mode:** STRICT READ-ONLY review (no sign, no broadcast, no payment, no settlement, no mainnet).
**Scope:** The **next** step after X.28C funding: provider-side service execution / deliverable submission for ERC-8183 job **515**. This review verifies all 20 mandated checks against live chain state and the existing verified implementation (SDK 0.7.0 + repo adapter).

---

## 1. Live state verified

| Check | Result | Evidence |
|---|---|---|
| 1. Live chainId == 97 | PASS | `eth_chainId` = 97 |
| 2. Job 515 exists | PASS | `getErc8183Job` id 515 |
| 3. Job 515 client/provider == verified provider EOA | PASS | both roles = `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` |
| 4. Job 515 FUNDED | PASS | status 1 / FUNDED |
| 5. Escrow == exactly 1 U | PASS | budget 1e18 raw |
| 6. Registry ownerOf(1816) == provider EOA | PASS | `0x299Ce…` |
| 7. ERC-8004 owner/URI correct | PASS | `tokenURI(1816)` = canonical metadata URI (registry exposes ERC-721 `tokenURI`, not `agentURI` — read via the X.24 precedent/tokenURI-first pattern) |
| 7b. Canonical metadata hosted + service endpoint | PASS | HTTP 200; `services[web].endpoint` = canonical service |
| 8. Evaluator/facilitator == verified router | PASS | evaluator + hook = `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` |
| 9. Policy == verified whitelisted policy | PASS | `policyWhitelist(WL)=true`; stale `0x4F4678…` false; WL `disputeWindow=900`, `voteQuorum=1`; `registerJob` on-chain still binds 515 → `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` |
| 10. Service endpoint reachable over HTTPS | PASS | HTTPS POST → HTTP 200 |
| 11. Service structured ready response | PASS | `{state:"ready", chainId:97, wallet, nativeBalanceWei}` == live `eth_getBalance(provider EOA)` |
| 11b. Unsupported chain rejected | PASS | `chainId:56` → HTTP 400 (not 200) |
| 12. Execution function/target determinable | **FAIL — blocker** | SDK 0.7.0 exposes **no** provider-side submission builder; repo adds none (X.11 finding). WL policy bytecode contains **none** of the candidate `initialise/submit/start` selectors observed. |
| 13. Exact execution calldata | BLOCKED | NOT generated (no verified submit ABI). |
| 14. Required caller/signer | PASS | EIP-8183 `submit` is provider-only → signer = provider EOA; env-derived signer matches (key never read/printed in this script except a derived-address compare). |
| 15. No additional $U approval/payment | PASS | escrow pre-funded (check 5); submission is non-payable; no ERC-20 approve in any repo submission path. |
| 16. Execution does not include settlement | PASS | settlement (router.settle / policy.dispute) are separate post-submission evaluator actions; not part of a submission call. |
| 17. Expected state transition | PASS | FUNDED (1) → SUBMITTED (2) on submission (submittedAt>0, deliverable bytes32); COMPLETED (3) only via evaluator settle after WL dispute window (900s); refund on expiry (> now). |
| 18. Expected deliverable/result format | PASS | service result JSON `{state,chainId,wallet,nativeBalanceWei}`; on-chain manifest = optParams JSON `{"deliverable_url": https}` (SDK reader contract). |
| 19. All targets chain 97 | PASS | commerce/router/registry/$U resolved from chain-97 config; live chainId 97. |
| 20. Job request/input == registered service contract | PASS | POST `{wallet, chainId?: 97}`; job description matches the registered service contract text. |

**Script result:** `X.29A read-only execution/hire review: 26/27 passed` — the single FAIL is check 12, the exact blocker.

---

## 2. Execution-function determination (checks 12 + 13)

The buyer-side **hire** was already executed in X.26–X.28C (createJob → registerJob → setBudget → approve → fund via `buildHireCalls`/SDK paths). What remains is the **provider-side deliverable submission** that moves job 515 FUNDED → SUBMITTED and emits the policy's `JobInitialised` event.

Established facts from the existing verified implementation:
- SDK 0.7.0 (`dist/erc8183.js`) exports `buildHireCalls`, `hireErc8183Agent`, `settleErc8183Job` (router.settle / policy.dispute), `buildClaimRefundCall`, and the **read-only** `getErc8183DeliverableUrl` (scans `JobInitialised`). It exposes **no provider submission call**.
- The repository adds no submit ABI/builder (`initialise`/`JobInitialised`/`submit` absent from all `.ts/.js/.sol/.abi` sources; only the `POLICY_INITIALISED_EVENT` definition from the SDK is referenced).
- X.11 explicitly documented the deployed seller-side submission function and manifest upload procedure as **UNKNOWN**.
- Bytecode probe against the whitelisted policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`: selectors for `initialise(uint256,bytes32,bytes)`, `submit(uint256,bytes32,bytes)`, `submit(uint256)`, `start(uint256,bytes32,bytes)` are **absent** (non-authoritative evidence; presence would still not reconstruct the full ABI/parameter semantics).

**Consequence:** the exact execution/hire calldata cannot be deterministically generated from the existing verified implementation. Per the review rule ("if anything is missing or inconsistent, STOP and report the exact blocker"), execution calldata is **NOT GENERATED** and the milestone is **BLOCKED**. This is a forward-gating review only; nothing was signed, broadcast, or settled.

---

## 3. Related findings

1. **Registry URI accessor.** The deployed ERC-8004 registry (`0x8004A818BFB912233c491871b3d84c89A494BD9e`) implements ERC-721 `tokenURI`; a custom `agentURI` read **reverts**. Reading follows the X.24 precedent: `tokenURI` first, `agentURI` fallback. URI content is correct (canonical).
2. **Deliverable reader policy mismatch (future submit step).** Repo `getErc8183Deliverable` → SDK `getErc8183DeliverableUrl` scans `addresses.policy` = SDK **stale** policy `0x4F4678…`, but job 515 is bound to the **WL** policy `0xd6a421…`. A post-submission `JobInitialised` lookup would scan the wrong contract and report not-found unless the reader policy is overridden. This does not block the fund/hire already completed, but must be corrected before the future submit→read step.

---

## 4. Existing verification suite re-runs (state progression, not regressions)

| Suite | Result | Note |
|---|---|---|
| X.29A (new) | 26/27 | sole FAIL = intentional blocker (missing submit ABI). |
| X.27 verify | 22/25 | FAILs only on job-status checks that assumed pre-funding OPEN (`3`, `14`, `15`) — correct now that job 515 is FUNDED. All binding/policy/registry/calldata checks PASS. |
| X.28B verify | 7/8 | sole FAIL = check 6 expected OPEN; live status FUNDED — expected after X.28C funding. |
| X.28A review | BLOCKED (on-status) | its status gate expected OPEN; job is FUNDED — consistent progression. |
| monorepo `pnpm typecheck` | PASS | |
| monorepo `pnpm lint` | PASS | (fixed unused `COMMERCE_VIEW_ABI`) |
| monorepo `pnpm build` | PASS | integrations tsc clean |
| monorepo `pnpm test` | PASS | |

---

## 5. Files

- Script: `packages/integrations/src/altana/erc8183.job515.execution.review.x29a.ts`
- Package script: `altana:x29a:execution-review` → `node dist/altana/erc8183.job515.execution.review.x29a.js`
- Run: `pnpm --filter @bnb-marketplace/integrations altana:x29a:execution-review`

---

## 6. Final report

```text
X.29A STATUS: BLOCKED — exact execution calldata cannot be deterministically generated
  CHAIN: 97 (bnb-testnet)
  JOB: 515
  JOB STATUS: FUNDED (1)
  ESCROW: 1000000000000000000 raw (exactly 1 U)
  AGENT ID: 1816
  PROVIDER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
  EVALUATOR: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (evaluator + hook)
  POLICY: 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA (whitelisted OptimisticPolicy; disputeWindow 900s, voteQuorum 1)
  SERVICE ENDPOINT: https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service
  EXECUTION FUNCTION: VERIFIED-AS-MISSING — no provider-side submission builder in SDK 0.7.0 or repo
  EXECUTION TARGET: 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA (probable policy submission; UNVERIFIED — bytecode selector evidence absent)
  CALLER/SIGNER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C (provider-only per EIP-8183)
  CALLDATA: GENERATED FOR REVIEW ONLY -> NOT GENERATED (no verified submit ABI)
  EXPECTED STATE TRANSITION: FUNDED (1) -> SUBMITTED (2) on submission; COMPLETED (3) only via evaluator settle after dispute window; refund on expiry
  SETTLEMENT: NOT PERFORMED
  SIGNING: NOT PERFORMED
  BROADCAST: NOT PERFORMED
  MAINNET: NOT TOUCHED
```

**Exact blocker:** the deployed provider-side submission function/ABI is not present in the existing verified implementation (SDK 0.7.0 exposes no provider submit builder; the repository adds none; X.11 documented it as UNKNOWN; no candidate selector was observed in the WL policy bytecode). Execution/hire calldata therefore cannot be deterministically generated. All 20 read-only checks otherwise pass; the review **STOPPED** before any signing or broadcast.