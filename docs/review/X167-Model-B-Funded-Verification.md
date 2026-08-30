# X.167 — Model-B Funded Verification Fix

**Classification: A — root cause fixed with a read-only final verification path; zero new
blockchain transactions.**

> HARD STOP HONORED: X.167 broadcast **zero** transactions. All chain reads in this work use
> `eth_call` / `getJob` / `paymentToken()` only. No `eth_sendTransaction`, no deploy performed
> inside this session (deploy is a follow-up step gated on these passing results).

## TL;DR

X.166 proved that a **real** production browser-wallet hire completed successfully: Agent 2005
(Canned Range Keeper), job **787**, all **five** steps (`createJob → registerJob → setBudget →
approve → fund`) confirmed, **0.001 U** escrow moved, job `FUNDED` on chain 97. The UI nevertheless
showed _"Job created, but Hire could not be safely completed. No additional transaction was
submitted."_

The false-negative had **two** causes, both fixed here:

1. **Custody-gated verification stub.** The final read-only `verify` API returned
   `main-track-verify-blocked` because the deployment's `verifyUserHire` implementation was a
   hardcoded stub — `"On-chain verification is not reachable from this deployment"` — even though
   Model-B verification requires **no** server custody, key, KMS, or signer.
2. **Hardcoded price.** `verifyMainTrackUserHireFinalState` rejected any job whose budget was not
   exactly `USER_HIRE_PRICE_WEI = 1 U`, while Agent 2005's real quote was **0.001 U**. The final
   verification now receives the **exact quoted/executed amount** (dynamic) and verifies against it.

After the fix, a Model-B browser-wallet hire that reaches FUNDED returns:

```
state = "funded-commercial-hire"
active = false
```

and the UI shows **"Hire funded successfully"** with Job ID, amount, seller, and BSC Testnet (97).
Never `ACTIVE`. Never a fabricated failure.

## 1. Root cause (X.166 recap)

`main-track-hire.route.ts:57-61` defined:

```ts
verifyUserHire: async () => ({
  ok: false,
  reason: "On-chain verification is not reachable from this deployment; the job was not verified.",
}),
```

`main-track-hire.api.ts` maps a not-`ok` verify result to HTTP `409 main-track-verify-blocked`, and
the view surfaced the generic failure copy. The Model-B user-wallet path only needs **public chain
reads** — custody availability is irrelevant to it — yet it was routed through a custody-era stub.

## 2. The fix

### 2.1 Read-only final verification (new)

`apps/web/lib/activation/main-track-user-hire.server.ts` adds `verifyMainTrackUserHireFunded`:

- chain pinned to **97** via `createMainTrackNetworkConfig()` (PublicNode);
- exact `jobId` read with the proven MainTrack read-only client (`ERC8183Client.create({network})`
  - `getJob`), same path as X.157/X.166;
- verifies `client == connected user wallet`, `provider == negotiated registered seller owner`,
  `commerce == official ERC-8183 commerce`, `payment token == official $U` (read-only
  `paymentToken()` call), `status == FUNDED`, `submittedAt == 0`, deliverable zero;
- `budget == expectedBudget` where `expectedBudget` is the **exact quoted amount used by the
  execution plan** (dynamic — the quote is authoritative, never a hardcoded 1 U or 0.001 U);
- a best-effort cross-check against the seller's **current** live quote fails closed on a mismatch,
  but accepts the on-chain FUNDED record when the quote endpoint is unreachable (on-chain is
  authoritative);
- returns `activationState = "funded-commercial-hire"`, `active = false`. **No signer, no private
  key, no KMS, no `sendRawTransaction`, no custody.**

All chain access is injectable via ports (`network`, `readPaymentToken`, `readJob`, `negotiate`),
so the regression harness runs fully offline.

### 2.2 Dynamic price

`verifyMainTrackUserHireFinalState` (in `main-track-user-hire.ts`) now takes `expectedBudget` and
compares it to `job.budget` with exact integer wei equality. `USER_HIRE_PRICE_WEI` is no longer used
by final verification. Works identically for 0.001 U, 1 U, or any valid seller quote.

### 2.3 Wiring

- `main-track-hire.route.ts` now wires `verifyUserHire` to `verifyMainTrackUserHireFunded`.
- `main-track-hire.api.ts` accepts `expectedBudget` on the `verify` action and passes
  `agent` + `expectedBudget` to the verifier.
- `main-track-hire-view.tsx` sends `expectedBudget: plan.price` with the verify request, renders a
  **success** panel (Job / Amount / Seller / Chain) when verification confirms FUNDED, and only shows
  the failure copy when the job genuinely is not FUNDED. A verification-unavailable condition shows an
  honest message instead of falsely claiming the Hire failed.
- `x157-hire-agent2005.ts` updated to pass `expectedBudget: prepared.price`.

## 3. Verification evidence

### 3.1 Regression harness (section 18, all green)

`lib/activation/main-track-user-hire.verify.ts` — `X.149 … ALL CHECKS PASSED`, including:

- 0.001 U quote → FUNDED success (Agent 2005's real amount);
- 1 U quote → FUNDED success;
- arbitrary quote (0.25 U) → FUNDED success;
- wrong expected amount → fail closed;
- wrong job → fail closed;
- wrong buyer → fail closed;
- wrong provider → fail closed;
- wrong token → fail closed;
- wrong commerce → fail closed;
- OPEN job → not funded;
- FUNDED job → success;
- RPC unavailable → **honest** verification error (never a false "job failed");
- payment-token RPC unavailable → honest error;
- live quote mismatch → fail closed;
- quote endpoint unreachable → on-chain FUNDED still accepted;
- already-submitted / non-zero deliverable → blocked;
- server verifier has **no private-key handling** and performs only public chain reads;
- dynamic-verify equivalence at the pure layer;
- X.165 idempotency (sections 16–17) preserved: one execution attempt, one wallet request per step,
  no duplicate broadcast, receipt polling never broadcasts.

### 3.2 Full regression — ALL PASS

- `main-track-user-hire.verify` (X.149, incl. section 18)
- `main-track-v2.server.verify` (X.131)
- `activation.verify` (33/33)
- `hire.verify` (23/23) + `hire.api.verify` (14/14)
- `capability-source.verify` (X.76)
- `x80.verify`, `x81.verify`
- `x49.security.verify` (25/25), `x55.gap.verify` (22/22)
- `marketplace.verify` (104/104), `discovery.verify` (60/60)
- integrations: `main-track-user-wallet.verify` (X.139), `main-track-hire.verify` (X.130),
  `erc8183.verify`
- web `tsc --noEmit`, `eslint .`, `next build` — clean
- integrations `tsc` + build — clean
- `prettier` — clean

## 4. Architecture preserved

```
CLIENT:  user wallet — eth_requestAccounts / eth_chainId / eth_sendTransaction (owns signing/broadcast)
SERVER:  prepare (quote verification) → receipt verification (PublicNode) → read-only final verification
SERVER NEVER: signs, broadcasts, stores a buyer/seller key, or touches KMS for Model B
```

Model B is explicitly **user-controlled-wallet**; it does not require AWS/KMS custody. The
marketplace-client (Model A / X.76) path is untouched.

## 5. Files changed

- `apps/web/lib/activation/main-track-user-hire.server.ts` — **new** read-only final verifier
  (`verifyMainTrackUserHireFunded`).
- `apps/web/lib/activation/main-track-user-hire.ts` — `verifyMainTrackUserHireFinalState` now takes
  `expectedBudget` (dynamic); `USER_HIRE_PRICE_WEI` removed from verification.
- `apps/web/lib/activation/main-track-hire.api.ts` — `verify` action accepts `expectedBudget`; passes
  `agent` + `expectedBudget`.
- `apps/web/app/api/activation/main-track-hire/route.ts` — stub replaced with the real read-only
  verifier.
- `apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx` — success UX + honest failure copy.
- `apps/web/lib/activation/main-track-user-hire.verify.ts` — regression section 18 (X.167).
- `apps/web/lib/activation/x157-hire-agent2005.ts` — passes `expectedBudget`.

## 6. Outstanding (follow-up, NOT in this session)

- Commit + push + Vercel deploy (no `vercel` CLI/auth available in this session).
- Read-only production check of job 787 after deploy: FUNDED, 0.001 U, active:false.
- Note to operator: jobs 782/783/784 remain stranded OPEN (pre-X.165 artifacts); untouched.

## 7. Hard-stop declaration

X.167 performed **zero** blockchain transactions. Job 787 was not touched. No new job, no approve,
no fund, no `sendRawTransaction`. Final state contract: **funded-commercial-hire**, **active=false**.
