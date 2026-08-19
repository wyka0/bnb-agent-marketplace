# Main Track Activation — X.31 Evaluator / Settlement Review

- Milestone: X.31 (strict read-only ERC-8183 Job 515 settlement review)
- Chain: BNB Testnet (chain 97)
- Date: 2026-08-14
- Status: **READY** (review only — no settlement executed)

## 1. Scope

Strictly read-only verification of the settlement path for ERC-8183 Job 515
after the X.30 provider submission. No signing, no broadcast, no funding, no
modification of Job 515 / Agent 1816, no policy change, mainnet refused.
Settlement calldata was produced as an **unsigned deterministic preview**
(dry-run through `eth_call` only) and was NOT broadcast.

## 2. Verified state (fresh live reads, chain 97)

| # | Item | Result |
|---|------|--------|
| 1 | `eth_chainId == 97` | PASS |
| 2 | Job 515 exists (`getJob(515).id == 515`) | PASS |
| 3 | Job state == SUBMITTED (2) | PASS |
| 4 | Provider and client == verified EOA `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` | PASS (self-hire; recorded at X.26) |
| 5 | ERC-8004 agent id == 1816 (`ownerOf(1816)` == provider EOA) | PASS |
| 6 | Escrow == exactly 1 U (raw 1e18) | PASS |
| 7 | X.30 submission tx confirmed + bound to Job 515 | PASS |
| 8 | `submittedAt` populated (kernel == policy == 1786723316) | PASS |
| 9 | Deliverable matches X.30 (kernel `0xb4e61292…`) | PASS |
| 10 | Evaluator & hook == router proxy; commerce/router impls unchanged (ERC-1967) | PASS |
| 11 | Bound policy unchanged (`jobPolicy(515)` == WL `0xd6a421…`, has code, quorum 1) | PASS |
| 12 | `disputeWindow` read from the actual Job 515 policy == 900s (immutable) | PASS |
| 13 | Dispute window elapsed: now 1786725035 ≥ submittedAt + 900 = 1786724216 | PASS (elapsed 819s) |
| 14 | Deliverable verified (manifest ↔ keccak ↔ kernel ↔ policy `JobInitialised` arg) | PASS |
| 15 | Service endpoint HTTPS + reachable (POST wallet → HTTP 200) | PASS |
| 16 | Service response consistent with manifest (`chainId 97`, wallet == provider, state "ready") | PASS |
| 17 | Deployed evaluator/commerce ABI verified from bytecode | PASS |
| 18 | Exact settlement function/target determined from verified evidence | PASS |
| 19 | Caller/permissions determined | PASS |
| 20 | Settlement currently legally + technically allowed | PASS |
| 21 | Unsigned deterministic settlement calldata preview | GENERATED (review only) |
| 22 | Preview round-trips against verified ABI | PASS |
| 23 | Settlement alters only Job 515 state/funds | PASS |
| 24 | No payment/funding transaction needed | PASS |
| 25 | Mainnet untouched | PASS |

Suite: **25/25 PASS** (`altana:x31:settle-review`).

## 3. Settlement mechanism (verified evidence only)

Source of truth: `bnb-chain/apex-contracts` (deployed bytecode selectors
cross-checked on-chain) + live reads.

- **Function** (`EvaluatorRouterUpgradeable.sol:299`): `settle(uint256 jobId, bytes calldata evidence)` — selector `0x39c2ebb9`, present in deployed router impl `0x40c025…`.
- **Target**: router proxy `0xd7d36d66d2f1b608a0f943f722d27e3744f66f25` (== job 515 evaluator/hook).
- **Flow**:
  1. `router.settle(515, 0x)` — permissionless (no access control), `nonReentrant` + `whenNotPaused`; reads `jobPolicy[515]` = `0xd6a421…`.
  2. `policy.check(515, 0x)` (`OptimisticPolicy.sol:243`) — view; evidence ignored; verdict `1` (APPROVE) once `block.timestamp >= submittedAt + disputeWindow`, reason `keccak256("OPTIMISTIC_APPROVED")` unless disputed-with-quorum (`disputed[515]=false`, `rejectVotes=0`, snapshot 0 → APPROVE).
  3. `commerce.complete(515, wrappedReason, "")` — kernel `AgenticCommerceUpgradeable.sol:440`: evaluator-only (`msg.sender == job.evaluator` = router); status → Completed (3); split `budget` into platform fee (`platformFeeBP` → `platformTreasury`) + net → `job.provider`; emits `JobCompleted` + `PaymentReleased`.
  4. `router.afterAction(COMPLETE)` deletes `jobPolicy[515]`, decrements `jobInflightCount`, emits `JobFinalised`.
- **Caller**: any EOA may call `settle` (permissionless); verdict decides the outcome. No special role.
- **Funds split (live)**: `platformFeeBP = 0` → fee 0, net = full **1 U** to provider `0x299Ce…`; treasury `0x1001b2C0…` unchanged.
- **Dry-run**: `eth_call` of the preview succeeded (no revert `NotDecided`/`Paused`) — technically allowed at block 125063693.

## 4. Dispute window math

- `submittedAt(515)` = 1786723316 (kernel + bound policy, consistent).
- `disputeWindow` = 900s (read live from bound policy `0xd6a421…`).
- `eligibleAt` = 1786724216 — now 1786725035 ⇒ **elapsed**, verdict APPROVE.

## 5. Deliverable + service endpoint

- Manifest (X.30 `optParams`): `{"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}`.
- `keccak256(manifest)` = `0xb4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea` == kernel deliverable == policy `JobInitialised` arg.
- Endpoint: HTTPS, POST `{"wallet": "<provider EOA>"}` → **HTTP 200** `{"state":"ready","chainId":97,"wallet":"0x299Ce…","nativeBalanceWei":"…"}` — method-gated (GET → 405).
- Note: repo adapter `getErc8183Deliverable` (SDK log-scan) returns *not-found* — the documented stale SDK policy drift (`config.policy` = `0x4F4678…` ≠ bound `0xd6a421…`); verified path above is authoritative.

## 6. Scope / side-effect confirmation (check 23-24)

The single `settle(515, 0x)` transaction would touch ONLY:

1. Job 515: status SUBMITTED → COMPLETED (3); escrow 1 U released (net → provider, fee 0 → treasury).
2. Router: `jobPolicy[515]` deleted, `jobInflightCount` −1, `JobFinalised(515)` event.
3. Events `JobCompleted(515, router, reason)` + `PaymentReleased(515, provider, 1 U)`.

No other job, policy, or fund is touched. Escrow is already held by the kernel
(balance ≫ 1 U) → **no funding/approval transaction needed**. ClaimRefund/
expiry paths untouched (expiredAt 1786730495 in future). Mainnet: no chain-56
RPC used; script hard-gated to chain 97.

## 7. Unsigned settlement calldata preview (review only, NOT broadcast)

```
0x39c2ebb9
0000000000000000000000000000000000000000000000000000000000000203   jobId=515
0000000000000000000000000000000000000000000000000000000000000040   evidence offset=64
0000000000000000000000000000000000000000000000000000000000000000   evidence length=0 (empty)
```

Round-trip decode verified against the deployed ABI (`settle(515, 0x)`).

## 8. Verification suite

- `altana:x31:settle-review` = 25/25 PASS.
- Monorepo typecheck / lint / build: PASS.

## 9. Final report

```text
X.31 STATUS: READY
JOB: 515
STATE: SUBMITTED (2)
ESCROW: 1 U
DISPUTE WINDOW: 900s (submittedAt 1786723316 -> eligibleAt 1786724216)
CURRENT TIME: 1786725035 (block 125063693)
SETTLEMENT ELIGIBLE: YES
EVALUATOR: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (EvaluatorRouterUpgradeable)
SETTLEMENT FUNCTION: settle(uint256 jobId, bytes calldata evidence)
SETTLEMENT TARGET: 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (router proxy, 0x39c2ebb9)
CALLDATA: GENERATED FOR REVIEW ONLY
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

STOP — X.31 is a read-only review; settlement was NOT executed.