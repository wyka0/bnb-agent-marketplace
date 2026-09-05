# X.242-RECOVERY — Fix Landed-Tx False-Failure

Date: 2026-09-05 — Recovery milestone. **Zero new transactions, signatures,
approvals, transfers, jobs, hires.** Jobs 56714/56715 untouched; both left
to expire naturally (no cancellation invented). No commit, no push, no deploy.

## 1. Incident cause (root-caused beyond the initial hypothesis)

The X.242 incident (two createJobs landed on-chain while the client reported
failure) had **two defects at the same seam**; the dominant one was NOT the
`"0x0"` string:

1. **PRIMARY — nonce-ledger type mixing**: the headless runner's
   `getPendingNonce` pass-through returned viem's raw **Number**
   (`getTransactionCount` → number), but `MainTrackNonceLedger` is a
   BigInt ledger. `commit()` executes `this.next += 1n` —
   `Number + BigInt` throws `TypeError: Cannot mix BigInt and other types`
   **AFTER the broadcast succeeded AND the receipt confirmed success**
   (provider L661–663 ordering). The raw error propagated to
   `runMainTrackUserHire`'s catch with NO stage prefix — exactly matching
   the observed `"createJob failed or rejected: Cannot mix BigInt…"`
   while the transaction was already mined.
2. **SECONDARY — `value: "0x0"` hex string** at the broadcast seam
   (`createMainTrackUserWallet.sendCall` L321 and
   `createNonceSafeEip1193Provider` L645 `tx.value ?? "0x0"`): the legacy
   viem type-mixing hazard documented since X.221.

My X.242 error chain: the first run's misreported failure → I misread the
buyer nonce (inbound funding doesn't consume nonce; nonce 1 already meant
run 1's createJob had landed) → the unauthorized re-run created the
duplicate job 56715. Root cause fixed here; the nonce-forensics lesson is
recorded in X242-First-Mainnet-Hire.md.

## 2. Exact fix (`packages/integrations/src/altana/v2/main-track-user-wallet.ts`)

1. `createNonceSafeEip1193Provider`: the ledger seed is now coerced —
   `new MainTrackNonceLedger(BigInt(await opts.getPendingNonce(sender)))`
   (BigInt(number) and BigInt(bigint) are both safe), with an incident-
   annotated comment. **This alone eliminates the false-failure.**
2. The broadcast object now passes `value: 0n` (viem-native bigint zero),
   never the `"0x0"` string.
3. Type surfaces updated to the truthful contract:
   `MainTrackSignerRequest.value: bigint`, both `broadcast()` signatures
   (`createNonceSafeEip1193Provider`, `createMainTrackBroadcast`) now
   declare `value: bigint`.
4. Integrations verify fixture updated to `value: 0n` (type correctness).

No unrelated refactoring; every other behavior preserved (stage-prefixed
errors, fail-closed receipts, no-rebroadcast semantics untouched).

## 3. Regression tests (8 new, all PASS)

In `apps/web/lib/activation/main-track-user-hire.verify.ts` (X.242R block):

| Test | Proves                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | **THE incident shape** (number-seeded nonce + successful receipt) returns the hash — never misreported as failed                             |
| R2   | the broadcast seam receives bigint `0n`, never `"0x0"`                                                                                       |
| R3   | sequential sends commit distinct nonces — a landed tx's nonce is never reused (no replay/replacement)                                        |
| R4   | a GENUINE broadcast failure still fails, stage-prefixed (`broadcast failed:`) — broadcast failure is distinguishable from receipt processing |
| R5   | a GENUINE reverted receipt still produces failure                                                                                            |
| R6   | the incident-shaped transient receipt error, handled via the production reliable-reader, self-heals and preserves the tx hash                |
| R7a  | an already-landed job id is rejected at PREPARE (no plan → no sends possible)                                                                |
| R7b  | a duplicate in-flight attempt (same attemptToken) broadcasts nothing extra                                                                   |

## 4. Proof jobs 56714 & 56715 exist (READ-ONLY, SDK job reader)

```
job 56714: client=0x299Ce4…C15C provider=0xB0f768…7c0 budget=0 status=0 (OPEN) expiredAt=1788699519
job 56715: client=0x299Ce4…C15C provider=0xB0f768…7c0 budget=0 status=0 (OPEN) expiredAt=1788700245
jobCounter: 56715
```

Chain 56, buyer/seller exactly as expected. Both jobs remain OPEN with
**zero budget** — never registered, never funded; they hold no escrow and
expire naturally at `expiredAt` (no cancellation tx invented, per
instruction).

## 5. Proof no $U moved

- Buyer $U balance: **exactly `40000000000000000` wei (0.04)** —
  byte-identical to the pre-incident balance (verified read-only).
- Buyer → Commerce **$U allowance: 0** (approve was never executed).
- Seller $U (0.0319) is the user's own funding from the X.242 balance
  milestone, not a settlement.

## 6. Current buyer BNB & remaining gas requirement

- Buyer BNB: **0.0000438578** (post-incident, after 2× createJob gas).
- Remaining steps 2–5 (registerJob + setBudget + approve + fund ≈
  380–400k gas total):
  - at 0.05 gwei (current): ≈ **0.00002 BNB** → fits (~2× headroom)
  - at 0.1 gwei: ≈ 0.00004 BNB → **does not fit** (0.0000439 available —
    under 10% margin)
- Recommendation: **top up the buyer with ≥0.0001 BNB** before completing
  the hire so the wallet may use up to 0.1 gwei safely.

## 7. Updated stale expectations (not weakenings)

The preflight harness still asserted the X.241-era state
(`hire: disabled`, buyer-$U BLOCKED). Updated to the **authorized**
X.242-DEPLOY-ENABLE state: seller `hire: "enabled"` asserted; buyer $U
sufficiency is now a real check (PASS at 0.04 ≥ 0.00001); closing verdict
line reflects truth ("read-only; no transaction…"). Preflight: 25 → 27
checks, all PASS.

## 8. Test results

| Suite                                                        | Result                 |
| ------------------------------------------------------------ | ---------------------- |
| X.149 user-hire (incl. all X.224–X.242 + R1–R7b)             | ALL PASS               |
| X.139 integrations wallet (nonce/receipt/provider/broadcast) | ALL PASS               |
| X.241 preflight (updated)                                    | 27/27 PASS             |
| seller-runtime / readiness / provisioning                    | 35/36/52 — all PASS    |
| network-selector                                             | 63/63 PASS             |
| hire.verify / hire.api.verify                                | 24/24 · 14/14 PASS     |
| typecheck / lint / build                                     | PASS (turbo all tasks) |
| prettier (changed files) / git diff --check                  | PASS / CLEAN           |

## 9. Recovery recommendation

1. Deploy this fix (commit+push — awaits explicit authorization).
2. Top up buyer BNB (≥0.0001 BNB advised).
3. Complete the hire on **one** job via a fresh 4-step execution
   (registerJob → setBudget → approve → fund) targeting job **56715**
   (latest; 56714 expires naturally) — with the fixed provider, per-step
   receipt confirmation, and fresh explicit user authorization.
   Alternatively, if preferred for cleanliness: a fresh full 5-tx hire on a
   NEW job id (both 56714 and 56715 then expire unfunded).

## Ledger

| Item                                                  | Count                                     |
| ----------------------------------------------------- | ----------------------------------------- |
| NEW transactions / signatures / approvals / transfers | 0 / 0 / 0 / 0                             |
| NEW jobs / hires                                      | 0 / 0                                     |
| Existing Mainnet jobs                                 | 56714, 56715 (OPEN, budget 0 — untouched) |
| Wallet prompts                                        | 0                                         |
| Commit / push / deploy                                | 0 / 0 / 0                                 |

**STOP — fix verified, no further on-chain action taken.**
