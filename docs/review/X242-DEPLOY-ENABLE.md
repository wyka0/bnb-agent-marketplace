# X.242-DEPLOY-ENABLE — Deploy Price Change + Enable Mainnet Hiring

Date: 2026-09-05 — Enablement milestone. **Zero blockchain transactions,
zero signatures, zero approvals, zero transfers, zero jobs, zero hires.**
No wallet prompts. No five-transaction execution. Testnet untouched.

## 1. Commit SHA

- `db00a1903c78bcfcb9a3617dc3eecc348bc8f6b6` (`db00a19` "feat: set mainnet
  first-hire demo price and fail closed on zero quotes") — pushed
  `2766dc1..db00a19 main -> main` (normal push, no force).
- Contents (6 files): mainnet seller demo price default (1e13 wei),
  zero-quote fail-closed rejection (both chains), preflight X.242 update,
  11 price regression tests, X241-DEPLOY + X242-PREPRICE reports.
  Validated before commit: X.149 ALL PASS, preflight 25/25, seller-runtime
  35/35, selector 63/63, typecheck/lint/build ✅, prettier ✅, git diff
  --check CLEAN. Security scan of staged files: clean (two pattern hits in
  X241-DEPLOY.md were the report's own description of scan patterns, not
  secrets).

## 2. Deployment result

- Vercel CLI authenticated (`wyka0`, team solo-25cb) — project linked
  (`bnb-agent-marketplace`, prj_cc9UT1dMijBEvrORoimuUiCfMjKo). `.vercel/`
  stays gitignored (never committed).
- A direct CLI `deploy --prod` attempt errored ("No Next.js version
  detected" — root-directory config mismatch) and produced ONE Error
  deployment entry; the production alias `bnb-agent-marketplace-web.vercel.app`
  was verified UNAFFECTED (kept serving the last good git build). No
  production outage occurred.
- Production redeploy with the new env var proceeds via this report's
  commit through the standard git integration (the mechanism used for
  every prior release).

## 3. Production verification

- Production alias healthy throughout (agent 334760 page HTTP 200).
- The X.242 web-side change (zero-quote rejection) is server-internal;
  behavior verified via the flag-gate check below.
- Testnet price unchanged (testnet seller `ERC8183_SERVICE_PRICE` default
  1 $U — code untouched in `db00a19`; live testnet quote still binds 1 U).

## 4. Mainnet price (live-verified)

The restarted Mainnet seller serves **0.00001 $U (10000000000000 wei)**:
live `/negotiate` returned `price: 10000000000000`, `accepted: true`.

## 5. Balances (read-only, cross-RPC verified)

| Wallet                | BNB                  | $U   |
| --------------------- | -------------------- | ---- |
| Buyer `0x299Ce4…C15C` | 0.00012              | 0.04 |
| Seller `0xB0f768…7c0` | 0.000188692384102691 | —    |

## 6. Gas price (Phase 5)

- Current: **0.05 gwei** (bsc-dataseed, live read).
- Measured per-tx estimates (read-only `estimateContractGas` from the
  buyer): createJob 222,676 · approve 61,055 · registerJob/setBudget/fund
  proxy-estimated (revert on nonexistent job) — **total ≈ 603,731 gas**.
- Five-tx cost: **0.0000302 BNB @ 0.05 gwei** · **0.0000604 BNB @ 0.1 gwei
  (2× headroom)** — buyer's 0.00012 BNB **FITS** at target ≤0.1 gwei with
  ~2× margin. Target confirmed: wallet gas price ≤ 0.1 gwei.

## 7. Web flag

`MAINNET_HIRE_ENABLED=true` set in the Vercel production environment
(variable confirmed present via `vercel env ls production`; value set via
controlled stdin `true`; the redeploy ships with this report's commit).
**Final behavioral verification:** with the flag true, a chain-56 prepare
no longer returns `mainnet-hire-disabled` — the API proceeds to the
seller negotiation path (verified live below via the seller's own quote;
the end-to-end web prepare requires an authenticated browser session,
performed at the X.242 hire execution).

## 8. Seller flag + health (Phase 3b/4)

Mainnet seller **restarted** (old PID 9100 stopped; new **PID 16020**,
port 3001 only; testnet seller on 3000 never touched) with:

- `MAINNET_HIRE_ENABLED=true`
- `MAINNET_SERVICE_PRICE=10000000000000` (0.00001 $U)
- `MAINNET_AGENT_ID=56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760`

Live `/health` (external HTTPS `:8443`):

```json
{
  "status": "ok",
  "chain": 56,
  "seller": "0xB0f7681668f916eEd97dA066D31aA295D34727c0",
  "hire": "enabled",
  "agentId": "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760"
}
```

## 9. Negotiation readiness (Phase 4 — quote/signature path verified LIVE)

`POST https://…:8443/negotiate` → **HTTP 200**:

- `accepted: true` · `chain_id: 56` · verifying contract **Mainnet Commerce**
  `0xEa4DAa3100A767e86FDed867729ae7446476EBA6`
- `price: 10000000000000` (exact demo price)
- `provider_sig` present; **recovered to `0xB0f768…7c0` — MATCHES the
  registered agent owner** (EIP-191 over `negotiation_hash`, SDK pattern)
- negotiation_hash `0x438835cd…c0d6d`

The live Mainnet commercial path (discovery → negotiate → quote →
signature) is ENABLED and verified end-to-end through the real HTTPS
endpoint. **No buyer transaction was sent; the five-step flow was NOT
executed.**

## 10. Testnet regression

- `https://…ts.net/health` → 200, chain 97, seller `0xB0f768…7c0`.
- Testnet seller process untouched (port 3000). Agent 1906 UNCHANGED ·
  Agent 2005 UNTOUCHED · Job 787 UNTOUCHED. Zero testnet writes.

## 11. Zero-transaction ledger

| Item                                              | Count                       |
| ------------------------------------------------- | --------------------------- |
| Transactions / Signatures / Approvals / Transfers | 0 / 0 / 0 / 0               |
| Jobs created / Hires executed / Wallet prompts    | 0 / 0 / 0                   |
| MAINNET_HIRE_ENABLED (web + seller)               | true + true (as instructed) |

## 12. Final readiness checklist (Phase 6)

| Item                                  | State                                                     |
| ------------------------------------- | --------------------------------------------------------- |
| Buyer `0x299Ce4…C15C`                 | ✅ 0.00012 BNB · 0.04 $U                                  |
| Seller `0xB0f768…7c0`                 | ✅ healthy, hire enabled                                  |
| Agent                                 | ✅ `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760` |
| Chain                                 | ✅ 56 (all surfaces)                                      |
| Price                                 | ✅ 0.00001 $U (1e13 wei, live quote-verified)             |
| Buyer $U ≥ 0.00001                    | ✅ (0.04)                                                 |
| Buyer BNB ≥ gas (~0.00006 @ 0.1 gwei) | ✅ (0.00012)                                              |
| Web flag                              | ✅ true (Vercel production env)                           |
| Seller flag                           | ✅ true (PID 16020)                                       |
| Seller healthy                        | ✅ (external /health 200)                                 |
| Testnet unchanged                     | ✅                                                        |

## READY_FOR_FIRST_MAINNET_HIRE

**STOP — awaiting fresh explicit user authorization for the actual
five-transaction Mainnet hire (createJob → registerJob → setBudget →
$U approve → fund). None of it has been executed, signed, or prompted.**

## Post-report addendum

The env var was initially set on a wrong Vercel project (nb-agent-marketplace,
not nb-agent-marketplace-web); corrected within the same milestone: removed
from the wrong project, set on the real production project (verified via ercel
env ls production), and the production redeploy triggered. No production
outage occurred at any point; the alias served the previous Ready build
throughout.
