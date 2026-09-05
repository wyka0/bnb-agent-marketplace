# X.192 — Hire Lifecycle + Honest P&L Audit

**Date:** 2026-08-30 · **Mode:** READ-ONLY + UI/resolver extension · **Transactions:** ZERO · **Wallet signatures:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Model A/B:** UNCHANGED

> Traced the ERC-8183 lifecycle on-chain (read-only), added truthful state-dependent dashboard actions (no fake Unhire, no on-chain execution), and confirmed honest P&L. No `reject`/`claimRefund`/`submit`/`complete`/`fund`/`createJob` was called; no job created; Job 787 unmodified.

---

## Phase 1 — ERC-8183 Implementation Trace (read-only)

| Item | Finding |
|---|---|
| Commerce (kernel) | `MAIN_TRACK_COMMERCE = 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (`AgenticCommerceUpgradeable`) |
| Router | `MAIN_TRACK_ROUTER = 0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` (`EvaluatorRouterUpgradeable`) |
| Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` · Policy `0xd6a42175…` · $U `0xc70B…` |
| Read path | `apps/web/lib/dashboard/hired-agents.server.ts` `readHiredJobs` → `@bnbagent/sdk` `ERC8183Client.getJob(id)` (PublicNode) |
| Job fields | `Job { id, client, provider, evaluator, description, budget, expiredAt, status, hook, deliverable, submittedAt }` (SDK `negotiation-*.d.ts`) |
| ABI methods | `CommerceClient`: `createJob, setProvider, setBudget, fund, submit(jobId,deliverable), complete(jobId) [evaluator-only], reject(jobId) [client while OPEN / evaluator while FUNDED+SUBMITTED], claimRefund(jobId) [permissionless after expiredAt], getJob, jobCounter, paymentToken`. `RouterClient`: `registerJob, settle(jobId), markExpired(jobId)` |

**Job 787 (read-only `getJob 787n`):**

```json
{ "id":"787", "client":"0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
  "provider":"0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a",
  "evaluator":"0xD7d36D66d2F1B608A0F943f722D27e3744f66F25", "budget":"1000000000000000",
  "expiredAt":"1788030232", "status":1, "hook":"0xD7d36D66d2F1B608A0F943f722D27e3744f66F25",
  "deliverable":"0x00…00", "submittedAt":"0", "now":1788173706, "expired":true }
```

---

## Final Report

- **Job 787 evaluator:** `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` = **MAIN_TRACK_ROUTER** (Router acts as `evaluator` + `hook`). `evaluatorIsRouter = true`.
- **Job 787 expiredAt:** `1788030232` (unix). **Now `1788173706`** → **expired ≈ 39.8h ago** (`expired: true`).
- **Job 787 current status:** `1` = **FUNDED** (`statusName` derived `FUNDED`), `deliverable` zero, `submittedAt` 0.
- **Is current wallet authorized to reject?** **NO** — `reject` is client-only while OPEN and **evaluator-only while FUNDED**. The viewing wallet is the **client** (`0x299Ce…`), and the evaluator is the Router contract; no user wallet is the evaluator. No `Cancel hire`/`Reject hire` is surfaced to the client.
- **Is refund currently eligible?** **YES** — `claimRefund(jobId)` is **permissionless after `expiredAt`**; Job 787 is expired. The client wallet is therefore entitled to `claimRefund(787)`.
- **Exact contract method for the valid lifecycle action:** `CommerceClient.claimRefund(787n)` (kernel `claimRefund(uint256)`), surfaced as a **disabled** "Claim refund" control with the explanation that it requires a wallet signature and is **not executed** by the dashboard. (`RouterClient.markExpired` exists for post-refund counter reconciliation; not surfaced as a client action.)
- **Current P&L data availability:** **None** — dashboard returns `netPnl: "Not available"`, `totalValue: "0.00 BNB"`. P&L is never derived from escrow budget; missing performance data is never shown as zero. A real performance dataset (funded job → submitted deliverable → settled outcome) would be required before P&L can become available.
- **FUNDED ≠ ACTIVE / ≠ EXECUTED / ≠ PROFIT / ≠ P&L** — enforced in the resolver (FUNDED is the only hire state surfaced) and lifecycle (only truthful actions).

---

## Phase 4 — UI Improvement (files changed)

| File | Change |
|---|---|
| `apps/web/lib/dashboard/hired-agents.ts` | Added `expiredAt/evaluator/submittedAt` to `HiredJobRead`; `HiredLifecycle` type; `HiredAgent` gains `evaluator/expiredAt/submittedAt/lifecycle`; pure `parseErcTimestamp` + `deriveHiredLifecycle` (claim-refund iff expired, reject iff viewer is evaluator & unexpired, else awaiting); populated in `resolveHiredAgents` |
| `apps/web/lib/dashboard/hired-agents.server.ts` | `readHiredJobs` now maps `expiredAt/evaluator/submittedAt` (read-only) |
| `apps/web/app/(app)/dashboard/hired-agents-dashboard.tsx` | `Expires` row when present; `LifecycleNotice` — truthful state-dependent action: **Claim refund** (disabled, explains wallet signature, expired) / **Reject hire** (disabled, evaluator) / **awaiting** text (funded & unexpired, no invented Unhire) |
| `apps/web/lib/dashboard/hired-agents.verify.ts` | +24 tests (below) |

**No fake Unhire, no executable button** — every on-chain action is disabled + explained; nothing is called during render.

---

## Phase 5 — Tests

| Check | Result |
|---|---|
| FUNDED state | **PASS** (1) |
| Evaluator ownership (Router flow → client not evaluator) | **PASS** (16) |
| Non-evaluator user (awaiting, no unhire) | **PASS** (19) |
| Evaluator wallet → `reject` action | **PASS** (17) |
| Expired job → `claim-refund` | **PASS** (18) |
| Terminal job (COMPLETED/REJECTED/EXPIRED) not shown as funded hire | **PASS** (20) |
| P&L unavailable | **PASS** (21) |
| P&L never zero when data missing | **PASS** (22) |
| No transaction invocation during rendering | **PASS** (23) |
| No wallet signature during dashboard load | **PASS** (23) |
| Lifecycle derivation pure/deterministic | **PASS** (24) |
| `marketplace:verify` / `discovery:verify` / `compare:verify` | **104 / 60 / 10 PASS** |
| `dashboard:hires:verify` | **PASS (ALL)** |
| `pancakeswap:intel:verify` / `pancakeswap:ui:verify` | **10 / 17 PASS** |
| `web typecheck` / `lint` / `build` | **PASS / PASS / PASS (12/12)** |
| `prettier` / `git diff --check` | **PASS / PASS** |

---

## Git

```
HEAD:        5537a696ace321e7a1f219ccfd8fcc6687c780e1
origin/main: 5537a696ace321e7a1f219ccfd8fcc6687c780e1
Working tree: M hired-agents.ts, hired-agents.server.ts, hired-agents.verify.ts,
              hired-agents-dashboard.tsx (X.192)
              M permissions/page.tsx (X.186, prior, uncommitted)
              ?? docs/review/X180…X190… (audit reports, untracked)
No integrations/prisma/API/main-track/erc8183 changes. No secrets.
```

---

## Safety

```
Transactions: 0 — no reject/claimRefund/submit/complete/fund/createJob/eth_sendTransaction
Signatures:   0 — no personal_sign/eth_sign/EIP-712, no wallet popup
Jobs created: 0
Job 787:      UNTOUCHED — read-only getJob(787n) only; deliverable zero, submittedAt 0, status FUNDED
Agent 2005:   UNTOUCHED
Agent 1906:   UNTOUCHED
Commit:       NONE
Push:         NONE
Deploy:       NONE
HARD STOP.
```
