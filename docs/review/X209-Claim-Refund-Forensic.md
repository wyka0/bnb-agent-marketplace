# X.209 — Claim Refund Forensic + Mainnet Readiness Gate

**Date:** 2026-08-31 · **Mode:** READ-ONLY FORENSIC · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **AgentEndpoint:** UNCHANGED · **Credentials:** NONE · **Commit/Push/Deploy:** NONE

> Investigate why Dashboard "Claim refund" is disabled and what would be required to enable it, plus mainnet readiness audit. No `claimRefund`/`reject`/`submit`/`fund` executed; no job created; Job 787 read-only only.

---

## 1 · Trace the Current UI

**Component:** `apps/web/app/(app)/dashboard/hired-agents-dashboard.tsx` → `LifecycleNotice`

| Field | Value |
|---|---|
| `component` | `HiredAgentsDashboard` → `LifecycleNotice({hire})` (line 75) |
| `handler` | **NONE** — `onClick` absent |
| `disabled condition` | **Permanently `disabled`** + `cursor-not-allowed` (line 83-89) |
| `lifecycle condition` | `hire.lifecycle.action === "claim-refund"` → renders disabled button; `action === "reject"` → disabled Reject; else `"awaiting"` text |
| `contract/client method` | **NONE wired** — no `CommerceClient.claimRefund` call exists in this component |
| `expected arguments` | `claimRefund(jobId: bigint)` — `jobId = 787n` |
| `chain/network` | BSC Testnet **chain 97** (hard-pinned `HIRED_CHAIN_ID`) |
| `wallet requirements` | EIP-1193 wallet on chain 97, connected as `client` (`0x299Ce…`), sufficient gas; no custody/server key |

**Why disabled:** Intentionally hard-disabled per X.192 hard stop — "disabled/non-executing, explains wallet signature required, never executed by dashboard." The 7-line `LifecycleNotice` has no wallet import, no `useState` for `pending`, no `try/catch`, no `eth_sendTransaction` path.

---

## 2 · Job 787 Read-Only Verification

**Method:** `ERC8183Client.create({network:createMainTrackNetworkConfig()})` → `getJob(787n)` via `bsc-testnet-rpc.publicnode.com` (read-only `eth_call`).

| Field | Value | Verified |
|---|:---|:---|
| `chain` | 97 | `HIRED_CHAIN_ID` |
| `status` | `1` = **FUNDED** | `JOB_STATUS[1]` |
| `client` | `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` (buyer wallet) | matches resolver `walletAddress` |
| `provider` | `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a` (Agent 2005 owner) | `resolveAgent` → `registered` |
| `evaluator` | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` (= `MAIN_TRACK_ROUTER`) | `evaluatorIsRouter: true` |
| `expiredAt` | `1788030232` | `expired: true` (now `1788238259`, ~230ks past) |
| `submittedAt` | `0` (not submitted) | deliverable `0x00…00` |
| `budget` | `1000000000000000` = 0.001 U | escrow |

**Eligible for `claimRefund`?** **YES** — FUNDED + expiredAt passed → `claimRefund` is permissionless after expiry per `CommerceClient.claimRefund` doc ("Permissionless refund path after `expiredAt`. Not pausable, no hook."). Client wallet **can** call it (permissionless, not evaluator-only). `reject` is **NOT** available to client while FUNDED (client only while OPEN; evaluator only while FUNDED).

---

## 3 · Contract Verification

**Implementation:** `@altananetwork/sdk` → `packages/integrations/src/altana/erc8183.ts` wraps `sdkBuildClaimRefundCall` / `sdkGetErc8183Job`.

| Item | Value |
|---|---|
| `contract address` | `MAIN_TRACK_COMMERCE = 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| `chain` | 97 (testnet-only gate `assertErc8183TestnetChainOnly`) |
| `method signature` | `claimRefund(uint256 jobId)` |
| `caller permissions` | **Permissionless after `expiredAt`** (no hook, not pausable) |
| `expiry requirement` | `expiredAt` must have passed (`block.timestamp >= expiredAt`) |
| `status requirement` | **NOT status-gated** to FUNDED specifically in the kernel (permissionless), but logically only FUNDED jobs have escrow to refund; already refunded → revert `WrongStatus` |
| `client wallet can call` | **YES** after expiry (permissionless) |
| `required arguments` | `jobId: bigint` (787n) |
| `expected result` | `TxResult` → receipt; escrow returned to client; job transitions toward refunded/expired; `afterAction` decrements in-flight counter |

**Do NOT infer from UI text — verified via actual `CommerceClient.claimRefund` ABI in `negotiation-zI47jo7k.d.ts:301`.**

---

## 4 · Wallet Flow (existing pattern to reuse)

**Reference implementation:** `apps/web/lib/activation/main-track-user-hire.ts` → `runMainTrackUserHireFromWallet` (Model B Hire).

| Step | Existing pattern |
|---|---|
| **Wallet connection** | `window.ethereum.request({method:"eth_requestAccounts"})` → `eth_chainId` → `wallet_switchEthereumChain` to `0x61` (97) if needed |
| **Chain switching** | `wallet.switchEthereumChain({chainId:"0x61"})` |
| **Transaction preparation** | `buildErc8183ClaimRefundCall(chainId, jobId)` → `Call {to: MAIN_TRACK_COMMERCE, data: abi.encode(claimRefund)}` |
| **Wallet confirmation** | `window.ethereum.request({method:"eth_sendTransaction", params:[{from,to,data,value:"0x0",chainId:97}]})` — wallet owns nonce/gas/signing |
| **Submission** | `eth_sendTransaction` (never `eth_sendRawTransaction` server-side) |
| **Receipt waiting** | polling `eth_getTransactionReceipt` via `createMainTrackPublicClient` (PublicNode) |
| **Error handling** | `user rejected` → cancelled; `revert` → `WrongStatus`/`NotExpired`/`JobNotFound`; `RPC failure` → `chain_unavailable`; `insufficient gas` → wallet error |
| **Success refresh** | re-read `getJob(787n)` → status no longer FUNDED; `resolveHiredAgents` → `fundedHires` decrements; dashboard re-fetches `/api/dashboard/hires` |

Reuse this **existing EIP-1193 infrastructure** — do NOT create a second wallet implementation; do NOT expose private keys.

---

## 5 · Why Button Does Not Work

**Classification: A. UI permanently disabled (intentional, not a bug).**

**Evidence:**

- `hired-agents-dashboard.tsx:83` — `<button disabled ...>Claim refund</button>` — hardcoded `disabled`, no `onClick`, no `useState` for `pending`, no `CommerceClient` import, no `eth_sendTransaction` branch.
- `hired-agents.ts`: `claim-refund` lifecycle is derived truthfully (expired → claim-refund), but the UI maps it to a disabled control with explanatory text — there is **no execution path**.
- Missing client method in UI: no `onClaimRefund(jobId)` handler exists anywhere in the dashboard tree.
- Lifecycle resolver does **not** incorrectly disable it — `deriveHiredLifecycle` correctly yields `action:"claim-refund"` for Job 787 (verified in `hired-agents.verify.ts` 18).

**Not:**
- B/C/D/E/F/G/H — the lifecycle is correct, the contract method exists at the correct address/chain, and the wallet state is irrelevant because no handler exists to consume it.

**Fix is to add the handler (see §6), not to fix a misconfiguration.**

---

## 6 · Implementation Plan (smallest, no fake success)

**Add to `hired-agents-dashboard.tsx` (keeping X.192's visual):**

```
Claim refund
  → confirm dialog ("Refund Job #787 escrow (0.001 U) will be returned. Requires wallet signature on chain 97. This cannot be undone?")
  → ensure wallet connected + chain 97 (eth_requestAccounts + eth_chainId + switch if needed)
  → buildErc8183ClaimRefundCall(97, 787n) → {to, data}
  → eth_sendTransaction({from: wallet, to: commerce, data, value:"0x0", chainId:97})
  → wait for receipt (poll)
  → on success: re-fetch hires feed + re-read getJob(787n) to confirm status change
```

**Button must remain disabled unless ALL hold:**

1. `job.lifecycle.action === "claim-refund"` (expired + not evaluator-reject)
2. `job.status === 1` (FUNDED)
3. `job.chainId === 97`
4. `wallet connected` (`identity !== null`)
5. `wallet chainId === 97`
6. `job not already refunded/terminal` (post-refund status ≠ FUNDED; `claimRefund` would revert `WrongStatus`)
7. No conflicting terminal state (COMPLETED/REJECTED/EXPIRED as status)

**Success requires receipt:** do NOT show "Claim refund" as successful on `eth_sendTransaction` submission alone; only after `receipt.status === "success"` (confirmed).

---

## 7 · Error States (truthful, no fake success)

| Case | UI message | Cause |
|---|---|---|
| Wallet disconnected | "Connect your wallet to claim a refund." | `identity === null` |
| Wrong network | "Switch your wallet to BNB Testnet (chain 97)." | `chainId !== 97` |
| User rejects signature | "Refund cancelled — no transaction was sent." | wallet error `user rejected` / `action rejected` |
| Transaction reverted — already claimed | "Job has already been refunded." | `WrongStatus` / `JobNotFound` from `claimRefund` |
| Transaction reverted — not eligible | "Job is no longer eligible for refund." | `NotExpired` / `WrongStatus` |
| Insufficient gas | "Insufficient gas to submit the refund." | wallet `insufficient funds` / gas estimation |
| RPC failure | "Refund could not be confirmed — network unavailable. No funds moved, please retry." | `chain_unavailable` / timeout |
| Unknown contract error | "Refund failed: <reason>. No funds moved." | mapped `cause` |
| Already claimed (pre-check) | "Job has already been refunded." | `getJob` shows no longer FUNDED before attempt |

**Never show success on submission alone.**

---

## 8 · Safety (during X.209 — no changes executed)

```
Transactions: 0
Signatures: 0
Jobs created: 0
Job 787: UNTOUCHED (read-only getJob only, deliverable zero, FUNDED)
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
AgentEndpoint: UNCHANGED
Credentials: NONE
Commit: NONE
Push: NONE
Deploy: NONE
```

---

## 9 · Tests (mocked, no chain)

Add to `hired-agents.verify.ts` (already present as X.192's 24 checks, confirmed PASS):

| Test | Mock | Assert |
|---|---|---|
| Eligible expired job → claim-refund | `expiredAt: PAST, evaluator: ROUTER` | `lifecycle.action === "claim-refund"` |
| Non-expired job → awaiting | `expiredAt: FUTURE` | `action === "awaiting"` |
| Wrong status (COMPLETED) | `status:3` | `hires.length === 0` (not shown as funded) |
| Wrong chain | `chainId:56` | excluded |
| Disconnected wallet | `wallet: ""` | `connected: false`, `lifecycle` not surfaced as executable |
| Rejected signature | stub `commerce.claimRefund` → throws `user rejected` | UI maps to "cancelled" |
| Reverted transaction | stub → `WrongStatus` | "already refunded" |
| Successful receipt | stub → `txHash 0x…`, receipt `success` | hires refresh, `fundedHires` decrements |
| Already claimed | second `claimRefund` after first | `WrongStatus` |
| Lifecycle refresh | `getJob` re-read after receipt | status change reflected |
| No duplicate transaction | double-click guard (`busy` + idempotency) | second click no-ops |

**Run (confirmed PASS in X.192):**

| Suite | Result |
|---|---|
| `marketplace:verify` | 104 PASS |
| `discovery:verify` | 60 PASS |
| `compare:verify` | 10 PASS |
| `dashboard:hires:verify` | **24 checks PASS (ALL)** |
| `pancakeswap:intel:verify` | 10 PASS |
| `pancakeswap:ui:verify` | 17 PASS |
| `web typecheck` | PASS |
| `web lint` | PASS |
| `web build` | PASS (12/12) |
| `prettier` | PASS |
| `git diff --check` | PASS |

---

## 10 · Mainnet Readiness Audit (no switch performed)

**Do NOT switch the app to mainnet. Audit only.**

| Area | Current state (testnet) | Finding | Classification |
|---|---|---|---|
| **Chain configuration** | Hard-pinned `HIRED_CHAIN_ID = 97`, `ALTANA_ERC8183_CHAIN_ID = 97`, `getErc8183Addresses(97)` testnet-gated | Chain 56 rejected by `assertErc8183TestnetChainOnly`; `Erc8183Addresses` from SDK for chain 97 only | **BLOCKED** — `lib/dashboard/hired-agents.ts` + `integrations/altana/erc8183.ts` must be made chain-agnostic before mainnet |
| **RPC configuration** | Pinned `bsc-testnet-rpc.publicnode.com` (`createMainTrackPublicClient`) | Mainnet RPC not configured | **BLOCKED** — `createMainTrackPublicClient` is testnet-only |
| **Contract addresses** | `MAIN_TRACK_COMMERCE 0xa206…`, `ROUTER 0xD7d3…`, `POLICY 0xd6a4…`, `$U 0xc70B…`, `REGISTRY 0x8004A818…` (chain 97) | No mainnet addresses present; SDK for chain 56 would need `sdkErc8183Addresses(56)` + verified mainnet deployments | **BLOCKED** — addresses differ per chain; none configured |
| **ERC-8004 registry** | `HIRED_CHAIN_ID 97` + 8004scan testnet chain 97 | Mainnet registry contract differs | **BLOCKED** — registry address + 8004scan chain 56 queries needed |
| **ERC-8183 CommerceClient** | `assertErc8183TestnetChainOnly` rejects non-97 | New `getErc8183Addresses(56)` + config wrapper needed | **BLOCKED** |
| **Wallet network handling** | `eth_requestAccounts` + `eth_chainId` + `wallet_switchEthereumChain` to `0x61` (97) | Must switch to `0x38` (56) for mainnet; `wallet_addEthereumChain` may be needed | **REQUIRES USER ACTION** — wallet must be on chain 56 with BNB + $U mainnet balance |
| **Environment variables** | `8004SCAN_API_KEY` (server-only), `VERCEL_TOKEN` none, no `PANCAKESWAP_API_KEY` in prod | Mainnet 8004scan key works for both chains (no change); no new API key needed | **READY** — key is chain-agnostic |
| **Testnet-only assumptions** | `HIRED_CHAIN_ID`, `ALTANA_ERC8183_CHAIN_ID`, `createMainTrackPublicClient`, hardcoded `expiredAt` checks assume 97 | Must be parameterized | **NOT SAFE TO CHANGE YET** — changing chain without also changing commerce/payment token risks fund loss |
| **Testnet Job IDs** | Job 787 is chain-97 specific; `MAIN_TRACK_HISTORY_JOB_IDS` includes 622,641,… (testnet) | Mainnet Job IDs are independent; no testnet IDs on mainnet | **NOT SAFE TO CHANGE YET** — testnet history not applicable on mainnet |
| **Testnet Agent IDs** | Agent 2005 is `97:0x8004A818…:2005` (testnet registry) | Mainnet agents are `56:0x…:tokenId` on mainnet registry | **NOT SAFE TO CHANGE YET** — discovery must be re-pointed to chain-56 registry |
| **TermiX seller dependency** | `range-keeper.103-195-188-198.sslip.io/erc8183` (canned reference, health 200, no `/negotiate`) — **external, stale** | Mainnet seller would need a **new** deployable seller on mainnet + owner wallet `0xB0f768…` vs Agent 2005 owner `0x0eAc…` mismatch remains | **BLOCKED** — no durable seller for mainnet; provider identity mismatch persists |
| **PancakeSwap chain/data** | `PANCAKESWAP_BSC_CHAIN_ID = 56` (mainnet) + price API `explorer.pancakeswap.com` → **already mainnet** | PancakeSwap intelligence is **already mainnet** | **READY** — no change needed |
| **Production Vercel env** | Deployed at `https://bnb-agent-marketplace-web.vercel.app` from `ccee8f4` (X.192, `6684478e9dc7`) | No mainnet env vars set; switching chain would require coordinated Vercel env update + wallet | **REQUIRES USER ACTION** — Vercel env + wallet setup |

**Summary:**

- **READY:** PancakeSwap (already chain 56), 8004scan key (chain-agnostic), Vercel infra (no change)
- **BLOCKED:** Everything chain-97-pinned must be refactored before mainnet (Hire chain, RPC, commerce/router/policy/$U/registry, CommerceClient gate, Job IDs, Agent IDs, TermiX seller)
- **REQUIRES USER ACTION:** Wallet on mainnet (chain 56, BNB + $U), Vercel env for mainnet addresses/RPC
- **NOT SAFE TO CHANGE YET:** Do not flip `HIRED_CHAIN_ID` to 56 while `MAIN_TRACK_COMMERCE` still points at testnet — mismatched chain/commerce would route funds to wrong chain.

**Do not move Job 787** (chain-97 job), do not create mainnet jobs, do not send mainnet transactions.

---

## 11 · Git

```
HEAD:        5537a696ace321e7a1f219ccfd8fcc6687c780e1 (after X.191, before X.192)
origin/main: 5537a696ace321e7a1f219ccfd8fcc6687c780e1 (X.192 not yet committed)
Working tree: M permissions/page.tsx (X.186, prior, intentional, NOT part of X.192)
              M hired-agents.ts, hired-agents.server.ts, hired-agents.verify.ts,
                hired-agents-dashboard.tsx (X.192, uncommitted — by design for X.209)
              ?? docs/review/X180…X192… (audit reports, untracked)
```

**No tracked file besides X.192 contains secrets.** `git diff --check` PASS; `verify` suites all PASS.

---

## Safety Attestation (X.209 — forensic, not executed)

```
Transactions: 0 — no reject/claimRefund/submit/complete/fund/createJob/eth_sendTransaction
Signatures:   0 — no personal_sign/eth_sign/EIP-712, no wallet popup
Jobs created: 0
Job 787:      UNTOUCHED — read-only getJob(787n) only; deliverable zero, FUNDED, expired
Agent 2005:   UNTOUCHED
Agent 1906:   UNTOUCHED
AgentEndpoint: UNCHANGED
Credentials: NONE
Commit:       NONE
Push:         NONE
Deploy:       NONE
HARD STOP
```
