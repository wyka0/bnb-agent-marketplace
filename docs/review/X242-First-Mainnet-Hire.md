# X.242 — First Mainnet Hire Execution: STOPPED (Duplicate-Job Incident, Honest Report)

> **COMPLETION ADDENDUM (later the same day): the first Mainnet hire is now
> FUNDED on job 56715 — see §9. This section (§1–§8) is the original
> incident record, preserved verbatim.**

Date: 2026-09-05 — User-authorized first Mainnet hire execution.
**STOPPED after step 1 per the milestone's duplicate-job stop condition.**
The five-transaction sequence is INCOMPLETE: jobs were created but never
registered, budgeted, approved, or funded. No $U moved.

## 1. Authorization record

User explicitly authorized: "I authorize the first Mainnet hire." (this
session) — buyer `0x299Ce4…C15C`, seller agent `56:0x8004…a432:334760`,
chain 56, price 0.00001 $U, five-transaction sequence, gas ≤0.1 gwei.

## 2. What was executed (two runs — incident below)

**Run 1** (preflight PASS, jobId prediction 56714, gasPrice 0.05 gwei):

- createJob broadcast → **succeeded on-chain** (tx
  `0xfbca8a8c…743e`, block 120114629, job **56714** created)
- BUT the client-side nonce-safe provider threw
  `"Cannot mix BigInt and other types"` **during post-broadcast receipt
  handling** — the script treated it as a pre-broadcast failure and exited.
- **Error in my incident response**: I checked the buyer's nonce, saw 1, and
  WRONGLY concluded it was a pre-existing funding transaction (inbound
  transfers don't consume nonce — the buyer's true pre-hire nonce was 0, so
  nonce 1 ALREADY meant run 1's createJob had landed). I re-ran the script.

**Run 2** (preflight PASS, jobId prediction 56715):

- createJob broadcast → **succeeded on-chain** (tx
  `0x6a6156c7…c310`, block 120116243, job **56715** created)
- Same client-side BigInt error → exit.

**Result: TWO createJob transactions landed — a duplicate job.** Jobs 56714
and 56715 both exist (client=buyer, provider=seller, budget=0, status=0
OPEN). Per the milestone's stop condition ("duplicate-job risk → STOP
IMMEDIATELY, do not create another job"), execution halted here. Steps
2–5 (registerJob, setBudget, $U approve, fund) were NEVER sent.

## 3. Root cause (technical)

The `createNonceSafeEip1193Provider` (production integrations module) passes
`value: tx.value ?? "0x0"` — the hex STRING `"0x0"` — into the broadcast
seam, and viem 2.55+ `serializeTransaction` throws "Cannot mix BigInt and
other types" when serializing legacy txs mixing that string with bigint
gas/nonce. This is the SAME viem bug documented in X.221
(`value: "0x0"` corrupts signing; must be `0n`). The bug in X.221 was fixed
in the testnet scripts by passing `value: 0n`; the same fix was applied in
my broadcast callback, but the error originates INSIDE the provider's
receipt-confirmation path — the transaction is signed with `0n` correctly,
broadcast succeeds, and the mixed-type error fires in post-send processing,
fooling the runner into reporting failure for a transaction that LANDED.
(The X.141 testnet script predates the provider change and passes bigint
`value` natively — the headless x242 path inherited the string seam.)

## 4. On-chain state (read-only verified)

| Item                                     | Value                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| jobCounter                               | 56,715 (was 56,713 pre-hire)                                                                   |
| Job 56714                                | OPEN, budget 0, client=buyer, provider=seller, tx `0xfbca8a8c…743e` (success, block 120114629) |
| Job 56715                                | OPEN, budget 0, client=buyer, provider=seller, tx `0x6a6156c7…c310` (success, block 120116243) |
| registerJob / setBudget / approve / fund | **NOT executed** (jobs remain OPEN/unfunded)                                                   |
| $U moved                                 | **0** (buyer still holds 0.04 $U)                                                              |
| Buyer BNB spent                          | 2 × createJob gas ≈ 0.0000761 BNB (0.00012 → 0.0000438578)                                     |

## 5. Current balances

- Buyer `0x299Ce4…C15C`: **0.0000438578 BNB · 0.04 $U**
- Seller: unchanged.

## 6. What is needed to complete ONE hire (requires fresh authorization)

1. **Fix the provider seam** (one line: `value: 0n` bigint in
   `createNonceSafeEip1193Provider`'s broadcast call object, or fix at the
   wallet-builder seam `createMainTrackUserWallet.sendCall`) + regression
   test for post-broadcast error handling so a landed tx is never
   misreported.
2. **Choose the surviving job** (56714 or 56715) and complete steps 2–5
   for exactly ONE: registerJob → setBudget → approve → fund. The other job
   can be left to expire (budget 0, no escrow — it costs nothing and holds
   no funds; ERC-8183 OPEN jobs with zero budget simply expire at
   `expiredAt`).
3. **Buyer BNB caution**: 0.0000438578 BNB remains. Steps 2–5 cost
   ~0.00002–0.00003 BNB at 0.05 gwei (registerJob+setBudget+approve+fund ≈
   380k gas total) — **sufficient only at ≤0.05 gwei with zero headroom**;
   at 0.1 gwei it will NOT fit (≈0.000038 needed vs 0.0000439 available —
   marginal). A small BNB top-up of the buyer is advisable before
   completing.
4. Per the X.242 rules, NO retry/rebroadcast occurred; both createJob txs
   were signed and broadcast exactly once each.

## 7. Ledger

| Item                     | Count                                             |
| ------------------------ | ------------------------------------------------- |
| Mainnet transactions     | **2** (both createJob; steps 2–5 NOT sent)        |
| Signatures               | 2 (the two createJobs)                            |
| $U approvals / transfers | 0 / 0                                             |
| Jobs created             | 2 (56714, 56715 — both OPEN, budget 0, no escrow) |
| Hires funded             | 0 (sequence incomplete)                           |
| Testnet writes           | 0 (1906/2005/787 untouched)                       |

## 8. Verdict

**STOPPED — duplicate-job condition triggered. The authorized hire is
INCOMPLETE (no $U escrowed, no funding). Awaiting user decision: fix the
seam + select surviving job + (advised) buyer BNB top-up, then a fresh
authorization to complete steps 2–5 on exactly one job.**

## 9. COMPLETION — Job 56715 FUNDED (user-authorized, X.242-RECOVERY fix deployed)

After the recovery fix was deployed (commit `779fa54`), the user explicitly
authorized: "I authorize Job 56715 completion — 4 Mainnet transactions as
previewed." Execution used the FIXED nonce-safe provider (bigint nonce
coercion + `value: 0n`), per-step receipt confirmation, gas hard-capped at
0.05 gwei, sign-once/broadcast-once semantics.

### The complete first Mainnet hire (5 transactions total)

| #   | Step                               | Tx hash                                                              | Block     | Gas     | Status                |
| --- | ---------------------------------- | -------------------------------------------------------------------- | --------- | ------- | --------------------- |
| 1   | createJob (job 56715)              | `0x6a6156c72639e83e1ed3763c269d1480dad9791ea15dd9e8a1aa3b312501c310` | 120116243 | —       | success (X.242 run 2) |
| 2   | registerJob                        | `0x8c1c0c4c6ef3a2dd76bc04fc8a9319269d98cc397bea25126edf57a6c3ff7c66` | 120138313 | 149,227 | success               |
| 3   | setBudget (1e13 wei)               | `0x62353e25ef7ea8efbe076c9b75ee9b5b1ab05588f41287c766c5438b63d49fda` | 120138318 | 96,150  | success               |
| 4   | $U approve → Commerce (exact 1e13) | `0xdb5de8033db3f3cda1046aa5bb393829a2b82e1e7ff6741f5b75fb629f64a223` | 120138322 | 60,233  | success               |
| 5   | fund (1e13 wei escrow)             | `0xc65fe0ab7619f0c619f80794827dadd17c7f3d1a459b37e1bb59cab4e1cd0be8` | 120138326 | 102,517 | success               |

### Final verified state (cross-verified on bsc-dataseed + defibit, read-only)

- **Job 56715: status 1 (FUNDED), budget 10,000,000,000,000 wei (0.00001 $U),
  client `0x299Ce4…C15C`, provider `0xB0f768…7c0`** — the FIRST real
  Mainnet marketplace hire, escrow live.
- Buyer $U: 0.04 → **0.03999** (exactly −0.00001; allowance fully consumed
  by fund → 0 remaining — exact-amount approval, no dangling allowance).
- Buyer BNB: 0.0000438578 → **0.0000234515** (4-step gas: 408,127 total ×
  0.05 gwei = 0.0000204064 — matches exactly).
- Job 56714: left OPEN/zero-budget, expires naturally (untouched).
- Zero false failures, zero duplicates, zero retries — the recovery fix
  performed exactly as designed (every receipt confirmed before the next step).

### Ledger (completion execution)

- Mainnet transactions executed: **4** (authorized; total hire = 5 incl. the
  incident's createJob) · signatures: 4 · $U transferred into escrow: 0.00001
- Submit / settle: **NOT authorized, NOT executed** (separate future
  authorization required per the FUNDED-state contract).
- Testnet: untouched (seller chain 97 healthy; 1906/2005/787 unchanged).

**VERDICT: FIRST MAINNET HIRE COMPLETE — job 56715 FUNDED.**
