# X.165 — Main Track Hire Execution Idempotency / Duplicate-Broadcast Fix

**Classification: A — Critical.** The bug was live in production and caused real, repeated,
user-confirmed blockchain transactions (ERC-20 spending-cap approvals on chain 97).

## Symptom (operator report)

During a real Main Track Hire of Agent 2005 on the production web app, MetaMask repeatedly
prompted for transactions. The operator confirmed an ERC-20 spending-cap approval (0.001 U,
spender `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` = `MAIN_TRACK_COMMERCE`), the transaction
confirmed (the operator's screenshot read "Transaction 33 confirmed"), yet the UI stayed in
"Preparing…" and another request appeared.

## Root cause (proven)

The duplication originates at the UI/state-machine boundary, **not** in the wallet layer or in
receipt polling:

- **(A) Duplicate UI invocation.** `confirmHire` in `main-track-hire-view.tsx` had no
  re-entrancy guard. `busy` is set via async `setState`, so it is racy — a double-click, a
  re-render that re-runs `prepare()`, or a stale closure can invoke `confirmHire` (and therefore
  `runMainTrackUserHireFromWallet`) twice.
- **(B) Duplicate execution state transition.** Each `confirmHire` calls `prepare()` then
  `runMainTrackUserHireFromWallet`. The running-state button also calls `prepare()`
  (`main-track-hire-view.tsx:297`), so re-entry re-runs the whole 5-step plan
  (createJob → registerJob → setBudget → approve → fund) → re-broadcasts approve + others.
- **(C) Wallet rebroadcast — RULED OUT.** `packages/integrations/src/altana/v2/main-track-user-wallet.ts`
  `sendCall` (line 311) calls `eth_sendTransaction` exactly once per call; there is no internal
  retry/rebroadcast loop.
- **(D) Receipt polling resubmission — RULED OUT.** `verifyStep` and
  `/api/activation/main-track-hire` `receipt`/`verify` actions are strictly read-only
  (`eth_getTransactionReceipt`); they never broadcast.
- **(E) Route/API resubmission — RULED OUT.** The route handler never calls `sendCall`; it only
  reads plan/receipt state.

**Conclusion:** a single user action invoked twice produces two full 5-step runs → two (or more)
broadcast sequences. This matches the operator's observation exactly.

## Fix

1. **Executor-level idempotency guard** (`apps/web/lib/activation/main-track-user-hire.ts`):
   - Module-level `const MAIN_TRACK_USER_HIRE_IN_FLIGHT = new Set<string>();` (`:67`).
   - `runMainTrackUserHireFromWallet` accepts `attemptToken?: string` (`:326`). If
     `MAIN_TRACK_USER_HIRE_IN_FLIGHT.has(token)` it returns
     `{ok:false, reason:"Hire execution already in progress; no additional transaction was submitted."}`
     and **broadcasts nothing** (`:330`).
   - On start it adds the token (`:338`); on every terminal outcome (success or fatal revert) it
     deletes it in `finally` (`:430`) so the next real attempt can proceed.
   - Keyed by `attemptToken` (per prepared plan, `${agent.slug}:${plan.jobId}`) — distinct
     agents/jobs execute independently; this is **not** a global kill-switch.
2. **Component-level re-entrancy guard** (`apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx`):
   - `const hireInFlight = React.useRef(false);` (`:60`).
   - `confirmHire` returns early if `hireInFlight.current` (`:101`), sets it `true` before any
     work (`:103`), and clears it in `finally` on every terminal outcome (`:217`).
   - `prepare()` also guards on `hireInFlight.current` (`:65`) so re-renders/stale closures cannot
     re-prepare.
   - `attemptToken: \`${agent.slug}:${plan.jobId}\`` is passed into the executor (`:166`).

## Phase 5 — Read-only forensic (no transaction sent)

- **Confirmed tx:** the spending-cap approval whose spender is
  `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (= `MAIN_TRACK_COMMERCE`, the ERC-8183 commerce
  contract). Because `runMainTrackUserHireFromWallet` advances sequentially and only proceeds past
  a step after `verifyStep` confirms its receipt, reaching **approve (step 4)** implies
  **createJob, registerJob, and setBudget (steps 1–3) were also sent and confirmed**. Therefore at
  least one Agent-2005 job was created and budgeted on the commerce contract.
- The repeated MetaMask prompts indicate the execution re-ran via re-entry (root cause A/B); if the
  operator kept confirming, **multiple jobs may have been created**. Determining the exact job
  id(s)/tx hash(es) requires the operator-supplied transaction hash or a block-explorer lookup — a
  read-only action I did **not** perform, and I did **not** broadcast anything to discover it.

## Verification (all passing, zero transactions)

- `activation:main-track-user-hire:verify` — X.149, **ALL CHECKS PASSED** (section 16.1–16.6):
  - 16.1 one attempt → exactly 5 sends, createJob once, approve once, no step broadcast twice
  - 16.2 concurrent same-token → first runs (5 sends), second blocked (0 sends)
  - 16.3 distinct tokens → both run, 10 sends (guard not a global kill-switch)
  - 16.4 receipt polling → still 5 sends, each step polled twice, 0 broadcasts
  - 16.5 successful receipt → 5 sends, 5 polls, advances once
  - 16.6 reverted approve → halts at 4 sends (approve broadcast then fails), no fund, no rebroadcast
- Full read-only suite green: marketplace (104), discovery (60), activation (33), hire (23),
  hire-api (14), capability-source, main-track-v2 server (X.131), x80, x81, x84 (14), x85 (13),
  x49 (25), x55 (22), integrations wallet (X.139), erc8183 (READY).
- `web` lint + `next build` pass (no type errors). `integrations` typecheck + build pass.

## Status

- Committed `fcd9ddc` on `main` (includes the previously-uncommitted X.164 `marketplace.ts` P6
  `only` guard so the repo matches the live build).
- Pushed to `origin/main` (`a860803..fcd9ddc`).
- **Deployment PENDING:** Vercel CLI/authentication is not available in this session (no `vercel`
  binary, no `VERCEL_TOKEN`, no cached auth), so I did not deploy. The fix is ready to ship; please
  run `vercel deploy --prod` (or connect the Git push to auto-deploy). After deploy: verify
  production UI **read-only** — do **not** execute another Main Track Hire transaction.

## Remediation / follow-ups

- (Optional) surface the "already in progress" reason as a visible UI notice instead of a silent
  no-op.
- (Optional) add an on-chain job-counter read (read-only `eth_call`) to the operator console so
  repeated hires of the same agent are visually de-duplicated before wallet confirmation.
- **Operator action:** review on-chain state for Agent 2005 (owner
  `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a`) to confirm how many jobs were created by the
  earlier duplicate prompts, and revoke/ignore any unintended ones.
