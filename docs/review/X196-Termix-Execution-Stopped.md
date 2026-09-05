# X.196 — TermiX Authorized Hires: STOPPED at Signer Gate

**Date:** 2026-08-30 · **Mode:** EXECUTION BLOCKED — NO TRANSACTIONS SENT · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Commit/Push/Deploy:** NONE

> The user authorized "Option B — execute exactly 3 TermiX marketplace hires." The execution requires 18 state-changing transactions (6/task) signed by the **user's EIP-1193 browser wallet** via the production Model B Hire flow. **This environment cannot perform that step**, and the X.196 hard rules explicitly forbid every alternative. This report states the blocker precisely, confirms zero state was changed, and gives the exact browser procedure + evidence capture checklist so the authorized execution can be performed by the user's wallet and recorded afterward.

---

## Why Execution Cannot Proceed Here

| Constraint (X.196) | Environment reality |
|---|---|
| "Use the user's connected EIP-1193 wallet" | This is a **terminal/CLI environment — no browser, no DOM, no `window.ethereum`, no EIP-1193 provider**, and no connected wallet exists here |
| "Every transaction must be explicitly surfaced for wallet approval" / "Never bypass a wallet confirmation" | I have **no mechanism to surface a wallet prompt** to the user; every `eth_sendTransaction` requires the user's in-browser approval, which I cannot trigger |
| "Do NOT use server custody/private keys" | The only signer material on disk is a **seller** keystore (`services/v2-seller/.agent-data/erc8183-job-622.json`) — using it for buyer Hires would be server custody + a private key, both **forbidden** by X.196 |
| Model B architecture | The marketplace **deliberately never signs**; `main-track-user-hire.ts` executes only through `window.ethereum.request({method:"eth_sendTransaction",…})` from the browser wallet (verified in X.149/X.167/X.168) |
| "Do NOT fabricate a deliverable / metrics / assume job IDs" | I will not simulate, estimate, or fake any of the 3 jobs/deliverables/tx hashes |

**Conclusion:** The authorized on-chain execution **must happen in the user's browser** through the production Hire UI (or an equivalent EIP-1193 wallet session). No component of this toolchain can sign or broadcast these transactions without violating X.196's own safety rules. The correct, safe action is to **STOP here** rather than fabricate or misuse custody.

---

## What I Did NOT Do (confirmation)

```
Transactions:           0   (no createJob/registerJob/setBudget/approve/fund/submit)
Wallet signatures:      0   (no personal_sign / EIP-712 / wallet popup)
Jobs created:           0   (no task-04/05/06 jobs; no 4th job)
Job 787:                UNTOUCHED (FUNDED, deliverable zero — read-only only)
Agent 2005:             UNTOUCHED (read-only tokenURI/endpoint verified)
Agent 1906:             UNTOUCHED
Seller keystore used:   NO   (services/v2-seller/.agent-data NOT touched)
Mainnet:                NO
Fabricated evidence:    NO   (no docs/termix/evidence/task-04|05|06 content created)
Source / commit/push/deploy: NONE
```

---

## The Authorized Execution — How It Must Run (user wallet)

Each task = the existing production Model B Hire flow on the **Agent 2005 detail page** (`https://bnb-agent-marketplace-web.vercel.app/agents/97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005`) with the user's wallet on **chain 97**:

1. **Connect wallet** (MetaMask/Trust/etc.) on BSC Testnet (chain 97). Confirm chainId `0x61`.
2. **Open Hire** → review the dynamically negotiated quote (provider `0x0eAc2F4d…`, price ~0.001 U, expiry, chain 97, commerce + $U).
3. **Approve each of 6 wallet prompts** per task in order: `createJob → registerJob → setBudget → approve → fund → submit`.
   - After each: wait for receipt, record tx hash, confirm state transition; stop on any failure (no blind retry — X.165 guard).
4. **Submit** is signed by the **seller** (Agent 2005's operator) to commit the deliverable hash; if the seller never submits, the job stays FUNDED with no deliverable (Task fails closed — do not create a replacement job).

**Per-task inputs (Tasks 4-6):**
- **Task 4 — Grid-strategy analytical report:** `HIRE_TASK_DESCRIPTION` + `HIRE_TERMS` (`deliverables:"JSON analysis report"`, `success_criteria:["valid JSON","chain 97 only"]`). Deliverable = deterministic chain-97 grid-strategy JSON.
- **Task 5 — Hired discovery shortlist:** agent returns a justified registry shortlist JSON (discovery research, matching advertised capability).
- **Task 6 — Security verdict (satisfies trading/stock/security):** agent returns a JSON security verdict (e.g., untrusted 402 / chain-policy screening) — must satisfy the TermiX security category.

**After each task**, the executor must save evidence under `docs/termix/evidence/task-04|05|06/` exactly per the X.195 §7 evidence package (input, quote + provider_sig verification, jobId read from receipt/state, tx hashes, timestamps, gas, arm-a-baseline + arm-b-paid + deliverable + adjudication + quality-scoring + run-metadata).

**Budget (estimates, from receipts at execution):** 6 tx/task × 3 = **18 tx**; ~0.001 U/task escrow (~0.003 U total); gas from receipts. Job IDs: **NOT YET CREATED** — read from contract/receipts at execution (current `jobCounter=835`).

---

## Blocker & Next Safe Action

- **Blocker:** no browser wallet / EIP-1193 provider is reachable from this environment, and X.196 forbids server custody/private keys — so I cannot sign or broadcast the 18 transactions.
- **Next safe action (user-side):** perform the 3 Hires in the browser per the procedure above, then have evidence recorded under `docs/termix/evidence/task-04|05|06/`. A follow-up read-only pass (verify 3 jobs + 3 deliverables + Job 787 unchanged + full test suite) can then be executed and the TermiX evidence/report updated with the **real** results.

I will not fabricate any part of this. Nothing was committed, pushed, deployed, or broadcast.

---

## Final Report

```
X.196 TERMIX EXECUTION — STOPPED AT SIGNER GATE (NOT COMPLETED)

Task 4: NOT CREATED — requires user browser wallet (6 tx)
Task 5: NOT CREATED — requires user browser wallet (6 tx)
Task 6: NOT CREATED — requires user browser wallet (6 tx)

TOTAL:
Jobs created: 0
Transactions: 0 (actual: n/a — none sent)
Escrow: 0 U sent
Gas: 0 BNB sent

TERMIX:
Previous status: PARTIAL
New status: PARTIAL (unchanged — no new evidence executed)

JOB 787: UNCHANGED (FUNDED 0.001 U, deliverable zero)
AGENT 2005: UNCHANGED
AGENT 1906: UNCHANGED
MAIN TRACK: UNCHANGED

BLOCKER: Execution requires the user's EIP-1193 browser wallet
         (production Model B Hire flow, chain 97). No browser wallet
         or signer is available in this CLI environment, and server
         custody / private keys are forbidden by X.196.

DO NOT COMMIT / PUSH / DEPLOY.
HARD STOP.
```

**Safety:** `Transactions 0 · Signatures 0 · Jobs created 0 · Job 787 UNTOUCHED · Agent 2005/1906 UNTOUCHED · No seller keystore used · No fabrication · No commit/push/deploy`.
