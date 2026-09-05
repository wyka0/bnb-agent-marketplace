# X.166 — Partially-Executed Agent 2005 Hire: Forensics

**Classification: A — exact post-create state fully identified, NO safety defect.**
The underlying hidden error is a fail-closed read-only verification stub (effectively a
**B-class verification-infrastructure-unavailable** condition), **not** a protocol, contract,
wallet, or X.165-guard defect.

> HARD STOP HONORED: this analysis submitted **zero** blockchain transactions. All chain reads
> used `eth_call` / `getJob` only. No `eth_sendTransaction`, no deploy, no commit, no push.

## TL;DR

The production UI message _"Job created, but Hire could not be safely completed. No additional
transaction was submitted."_ does **not** mean the executor stopped after `createJob`. On-chain
evidence (job `787`) proves the **entire 5-step sequence completed and the job is FUNDED**. The
message is emitted **only** because the final read-only `verify` API call returns a hardcoded
fail-closed stub (`"On-chain verification is not reachable from this deployment"`). The hire
actually succeeded; the UI simply cannot confirm it.

## 1. The real job

Read-only query of `MAIN_TRACK_COMMERCE` (`0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`) on chain 97:

- `jobCounter() = 787`
- Agent-2005 jobs (provider = `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a`):

| jobId   | client        | budget      | status     | submittedAt | deliverable |
| ------- | ------------- | ----------- | ---------- | ----------- | ----------- |
| 782     | `0x299C…C15C` | 0.001 U     | OPEN       | 0           | 0x0…0       |
| 783     | `0x299C…C15C` | **0**       | OPEN       | 0           | 0x0…0       |
| 784     | `0x299C…C15C` | 0.001 U     | OPEN       | 0           | 0x0…0       |
| **787** | `0x299C…C15C` | **0.001 U** | **FUNDED** | 0           | 0x0…0       |

**The real, completed hire is job `787`**: client `0x299C…C15C` (the connected browser wallet used
for this hire — matches the operator's known test address, also referenced as `forbiddenClientAddress`
in the marketplace-client path), provider = Agent 2005 verified owner, budget `0.001 U`
(`1000000000000000` wei), `status = FUNDED`, `submittedAt = 0`, deliverable zero.

The per-step transaction hashes are **not** captured by the UI on this failure path; they are
recoverable from any block explorer by filtering `from = 0x299C…C15C` and `to = 0xa206c…3B0DE`
around the hire time.

Jobs 782 / 783 / 784 are **stranded OPEN remnants of the pre-X.165 duplicate attempts** (partial
executions that created jobs but never funded them). Job 783 has a `0` budget — an anomalous
createJob-without-budget artifact. These are abandoned and should be noted to the operator; they are
unrelated to the X.165 fix.

## 2. Exact stop step

**None stopped.** The executor (`runMainTrackUserHireFromWallet`) returns `ok: true` **only after**
all five steps — `createJob → registerJob → setBudget → approve → fund` — have been sent AND their
receipts confirmed via the per-step `verifyStep` (PublicNode `readMainTrackReceipt`). For the view to
reach the `"Job created…"` branch, `outcome.ok` must be `true`; a mid-sequence failure would instead
produce `"Hire stopped while verifying…"` / `"Network verification failed…"` / `"Hire stopped
safely…"`. Therefore every step was broadcast and confirmed; the sequence completed.

The **only** action after the 5th transaction was the read-only `fetch('/api/activation/main-track-hire',
{action:"verify", …})`, which performed **no** broadcast.

## 3. X.165 idempotency guard — exonerated

- `MAIN_TRACK_USER_HIRE_IN_FLIGHT` is a module-level `Set`; a duplicate same-`attemptToken` invocation
  returns `{ok:false, reason:"Hire execution already in progress; no additional transaction was submitted."}`
  and broadcasts nothing (`main-track-user-hire.ts:329-339`, `:430`).
- The view's `hireInFlight` ref guards `confirmHire`/`prepare()` (`main-track-hire-view.tsx:60,101,217`).
- The production outcome was `ok: true`, which is **only possible** if the guard admitted the single
  execution and released it in `finally`. A blocked execution returns `ok:false` with
  `"already in progress"` → that maps to a _different_ message, not `"Job created…"`.
- **Conclusion:** the X.165 re-entrancy fix did **not** cause an incorrect early stop. (Confirmed by
  regression test 17.1: after a successful run the guard is released and a later same-token attempt
  still executes — no false block, no duplicate-job risk.)

## 4. Read-only on-chain forensics

- **Job 787 is FUNDED** → all five transactions succeeded on-chain.
- **Escrow moved:** `0.001 U` was escrowed into the commerce contract as the job budget.
- **Allowance changed:** the `approve` step set an ERC-20 allowance for payment token
  `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` to the commerce contract — this is the `0.001 U`
  spending cap the operator saw in MetaMask.
- **Not stranded:** job 787 is a valid `funded-commercial-hire` awaiting submission (intended state).
- **Stranded earlier jobs:** 782 / 783 / 784 (OPEN, unfunded) are pre-X.165 artifacts — see §1.
- **Boundary:** scenario **E** — fully funded job; the failure is verification-only, after the fact.
- **Secondary latent defect (separate, not the cause of this message):** `USER_HIRE_PRICE_WEI` is
  hardcoded to `1 U` (`main-track-user-hire.ts:57`) while the real negotiated price for Agent 2005 is
  `0.001 U`. `verifyMainTrackUserHireFinalState` would reject `budget != 1 U`. That function is
  currently unreachable (see §5), so it did not cause the message — but it must be reconciled before
  `verifyUserHire` is ever wired.

## 5. The actual (hidden) error

The generic message hides a precise, captured error:

1. View does `fetch('/api/activation/main-track-hire', {action:"verify", jobId, walletAddress})`.
2. Route `verifyUserHire` dependency is **hardcoded** (`main-track-hire.route.ts:57-61`):
   ```ts
   verifyUserHire: async () => ({
     ok: false,
     reason: "On-chain verification is not reachable from this deployment; the job was not verified.",
   }),
   ```
3. API maps this to **HTTP 409**, `error.code = "main-track-verify-blocked"`,
   `error.message = "On-chain verification is not reachable from this deployment; the job was not verified."`
   (`main-track-hire.api.ts:249-260`).
4. The view **discards** that specific reason and shows the generic string
   (`main-track-hire-view.tsx:196-201`, `:209-214`).

**Exact error (task A–J):** verification layer intentionally unreachable — a deliberate fail-closed
stub (≈ **I — RPC/verification infrastructure**). It is **not** A (wallet rejection), B/C/D/E/F/G/H in
the execution sense, because the contract and wallet executed perfectly.

## 6. Critical question

- **Not** a protocol/contract issue — contract ran all 5 steps; job 787 FUNDED.
- **Not** a wallet/RPC execution issue — wallet signed all 5; receipts confirmed via PublicNode.
- **It is an application verification/observability issue:** the post-success read-only verification is
  a hardcoded fail-closed stub (consistent with the X.131/X.149 design where no marketplace-client
  custody is provisioned, so `verifyUserHire` returns not-ok by design). The X.165 re-entrancy fix is
  **exonerated** — it did not cause an early stop.

## 7. UI safety

- The message is **fail-closed and accurate in its critical claim**: no transaction was submitted
  after the verify failure (the verify call is read-only). ✓
- It is **misleading** in _"could not be safely completed"_: the hire actually completed and is
  FUNDED (job 787). The UI cannot know this because verification is stubbed.
- Per the brief, since `createJob` succeeded and no later transaction was submitted after the failure,
  the message is **acceptable and must remain fail-closed**. **No UI change for X.166.**
- **Recommendation (non-blocking, future):** once `verifyUserHire` is wired, distinguish
  "funded but unverified" from "failed". Also note the UX risk: an operator seeing this message may
  retry and create a _second_ funded job (788) — job 787 is already complete; do not re-hire.

## 8. Tests (read-only / mock)

Added **section 17** to `main-track-user-hire.verify.ts` (no production code changed in X.166):

- 17.1 executor broadcasts all 5 steps and returns `ok:true` (proves it did **not** stop early);
  every step returns a tx hash; the in-flight guard is released after success (no false block, no
  duplicate-job risk).
- 17.2 the read-only verify failure maps to the exact production `"Job created…"` message and adds
  **zero** additional broadcasts.

Full read-only suite green: marketplace (104), discovery (60), activation (33), hire (23), hire-api
(14), capability-source, main-track-v2 server (X.131), x80, x81, x84 (14), x85 (13), x49 (25), x55
(22), main-track-user-hire (X.149 incl. 16.1–16.6 + 17.1–17.2), integrations wallet (X.139), erc8183
(READY). `web` typecheck + lint + `next build` pass; `integrations` typecheck + build pass; prettier
clean. **No production code changed — only a read-only test file and this report.**

## 9. Deployment

**No deploy, no commit, no push** (per brief). The forensic change is test-only.

## 10. Confirmation

- **Exact jobId:** 787 (FUNDED, 0.001 U, client `0x299C…C15C`, provider Agent 2005 owner).
- **Successful tx(s):** all five (createJob, registerJob, setBudget, approve, fund) — confirmed on-chain.
- **Failing step:** none in execution; the post-success read-only `verify` API (hardcoded stub).
- **Exact error:** `main-track-verify-blocked` — "On-chain verification is not reachable from this
  deployment; the job was not verified."
- **Current on-chain state:** job 787 FUNDED, awaiting submission; escrow + allowance set.
- **Escrow moved:** yes (0.001 U). **Allowance changed:** yes. **Stranded:** only the pre-X.165 OPEN
  jobs 782/783/784.
- **Duplicate transaction submitted:** **NONE.** The X.165 guard held; the only post-success action
  was a read-only `verify` fetch.
