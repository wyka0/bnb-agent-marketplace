# X.242-PREPRICE — Reduce First Mainnet Hire Price

Date: 2026-09-05 — Preparation only. Zero transactions, zero signatures,
zero approvals, zero transfers, zero jobs. `MAINNET_HIRE_ENABLED` remains
**false**. No commit, no push, no deploy.

## 1. Previous price

**1 $U** (`1000000000000000000` wei) — the Mainnet seller's
`MAINNET_SERVICE_PRICE` default (`services/v2-mainnet-seller/seller-mainnet.ts`
L96, X.236-P2) and the preflight's assumed required amount. The price is a
**seller runtime env**, never hardcoded in marketplace code: quote
`terms.price` → `prepareMainTrackUserHire` binds it as the budget → the
5-call plan carries it into setBudget/approve/fund. The running seller
process (PID 9100, from X.239) still holds 1 $U in memory — harmless while
`hire: disabled`; it will be restarted with the demo price at the
user-authorized X.242 enablement step.

## 2. Requested price

**0.00001 $U = 10,000,000,000,000 wei = `10000000000000`** ($U has 18
decimals — exact integer, no rounding loss).

## 3. Minimum-price validation — **PASS (0.00001 $U is valid everywhere checked)**

| Layer                                                                                 | Constraint found                                                                                                                                                                      | 1e13 wei valid?          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| SDK `NegotiationHandler`                                                              | price must match `/^-?\d+$/` and `BigInt(price) >= 0n` (non-negative integer string) — no minimum, no precision floor                                                                 | ✅                       |
| SDK job validation                                                                    | budget must be `>= servicePrice` when servicePrice > 0 (only a floor relative to the seller's own price, now 1e13)                                                                    | ✅                       |
| Commerce `setBudget`/`fund` (on-chain `eth_call` simulation with 1e13 from the buyer) | revert `0x71c8f460` = `InvalidJob()` — **job-state only** (fake job id), zero amount-related reverts; `platformFeeBp` read timed out on the proxy but no amount-floor revert surfaced | ✅                       |
| Marketplace `prepareMainTrackUserHire`                                                | integer `BigInt(terms.price)`, `>= 0n`; **gap found: zero was accepted — FIXED** (new `price === 0n` fail-closed rejection, both chains)                                              | ✅ (after fix)           |
| Frontend                                                                              | renders plan values; no minimum logic                                                                                                                                                 | ✅                       |
| 0-wei screening                                                                       | `setBudget(0)` also reverted only `InvalidJob()` (job-state) — marketplace layer must (and now does) reject zero before any tx                                                        | ✅ (marketplace-guarded) |

## 4. All affected code paths (changed in this milestone)

1. `services/v2-mainnet-seller/seller-mainnet.ts` — `MAINNET_SERVICE_PRICE`
   default **1e15th→1e13**: `1000000000000000000` → `10000000000000`
   (MAINNET-ONLY; env-overridable).
2. `services/v2-mainnet-seller/.env.example` — documents the X.242 default.
3. `apps/web/lib/activation/main-track-user-hire.ts` — NEW zero-price
   fail-closed rejection (`price === 0n` → "Quote price is zero; a hire
   requires a positive $U budget.") — applies to BOTH chains (a zero
   budget hire is meaningless on testnet too; no testnet behavior change
   for any positive price).
4. `apps/web/lib/activation/mainnet-hire-preflight.verify.ts` — P5 now
   checks the **user-designated buyer** `0x299Ce4…C15C` (buyer ≠ seller
   allowed) at the **0.00001 $U** requirement, reports both buyer and
   seller/owner balances, flags BUYER BNB=0, asserts the price constant is
   exactly 1e13 wei, and prints `MAINNET_HIRE_ENABLED` (local env).
5. `apps/web/lib/activation/main-track-user-hire.verify.ts` — +11 X.242
   regression tests (§7).

**Consistency (Phase 4)**: the amount flows as ONE exact integer
`10000000000000` through quote → `price` → plan `budget` → setBudget
calldata → approve calldata → fund calldata (verified by the new
calldata-content tests). No wei conversion, no rounding anywhere.

## 5. Mainnet-only behavior (Phase 3)

- The Testnet seller's `ERC8183_SERVICE_PRICE` (default 1 $U) is **untouched**
  (`services/v2-seller/seller.ts` L54/L63 — verified unchanged).
- Testnet quote path: 1-U quote still binds 1 U (new test X.242 "testnet
  1-U quote behavior unchanged" — PASS).
- Chain-56 cannot use chain-97 pricing config (commerce/$U disjoint —
  asserted by test).

## 6. Buyer readiness (Phase 5) — READ-ONLY, independently verified

Buyer (user-designated): **`0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`**

| Check              | Result (3 RPCs: bsc-dataseed, defibit, publicnode — all agree)             |
| ------------------ | -------------------------------------------------------------------------- |
| Mainnet $U balance | **0 $U** — the stated "~0.143864 $U" is **NOT on this wallet on chain 56** |
| Mainnet BNB        | **0 BNB**                                                                  |

⚠️ **Discrepancy reported (not assumed away)**: the user-stated
~0.143864 $U was not found on-chain for this buyer address on chain 56
(verified across three independent public RPCs). Possibilities: funds are
on a different chain (e.g. chain 97 testnet $U — that wallet holds testnet
assets), on a different address, or not yet sent. **The buyer is NOT
funded on chain 56. Verdict: BLOCKED — INSUFFICIENT BUYER $U (and 0 BNB
for gas).** No transfers attempted.

(Seller/owner wallet for reference: 0 $U · 0.000427122 BNB — unchanged.)

## 7. Tests (Phase 6)

New X.242 regression tests (all PASS within the X.149 suite):

- demo price 0.00001 $U prepares successfully
- exact integer amount bound (`10000000000000` wei)
- no rounding loss (`BigInt(price) === 10n ** 13n`)
- setBudget calldata carries the exact amount
- approve calldata carries the exact amount
- fund calldata carries the exact amount
- zero price rejected
- malformed price (decimal string `"0.00001"`) rejected — integer wei only
- negative price rejected
- chain 56 cannot use chain 97 pricing config
- testnet 1-U quote behavior unchanged

Full matrix: X.149 user-hire ALL PASS (incl. all X.224–X.241 tests) ·
preflight 25/25 (with truthful BLOCKED verdicts) · selector 63/63 ·
seller-runtime 35/35 · readiness 36/36 · provisioning 52/52 · hire.verify
24/24 · hire.api 14/14 · main-track-v2 ALL · activation 33/33 ·
typecheck 14/14 · lint 14/14 · build ✅ · prettier PASS ·
git diff --check CLEAN.

## 8. Safety

`MAINNET_HIRE_ENABLED` remains **false** (local + web + seller — the seller
`/health` still reports `hire: disabled`). Zero transactions / signatures /
wallet prompts / approvals / transfers / jobs / hires. Testnet Agent 1906
UNCHANGED · Agent 2005 UNTOUCHED · Job 787 UNTOUCHED. No commit, no push,
no deploy.

## 9. Remaining blockers for X.242 (first real Mainnet hire)

1. **Buyer $U on chain 56** — buyer wallet holds **0 $U** (stated balance
   not found on-chain; must be funded with ≥ 0.00001 $U, or the correct
   funded buyer address must be designated).
2. **Buyer BNB on chain 56** — buyer holds **0 BNB** (needs gas for 5 txs;
   at current ~0.05 gwei, ~0.00015 BNB is ample).
3. **Enable both Mainnet flags** (user-authorized): web
   `MAINNET_HIRE_ENABLED=true` (Vercel env) + seller
   `MAINNET_HIRE_ENABLED=true` with `MAINNET_SERVICE_PRICE=10000000000000`
   and a seller restart (port 3001).
4. **Deploy the price/zero-rejection code** (this milestone is uncommitted)
   — requires explicit commit/push/deploy authorization.
5. **Fresh X.242 precondition run + fresh explicit hire authorization**
   (the registration authorization does NOT extend to a hire).
