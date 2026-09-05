# X.242-RECOVERY-DEPLOY — Deploy Transaction Receipt/Nonce Fix

Date: 2026-09-05 — Deployment only. **Zero new transactions, signatures,
approvals, transfers, jobs, hires.** Jobs 56714/56715 untouched.

## 1. Commit SHA

**`779fa542194f2f994efad0327aff4c624a22f0ef`** (`779fa54`
"fix(hire): prevent landed transaction false failures")
Pushed `849a3c0..779fa54 main -> main` (normal push, no force).

Files (6): the fix (`main-track-user-wallet.ts` — bigint nonce coercion,
`value: 0n`, bigint type contracts), the integrations verify fixture,
the X.242R regression-test block, the preflight refresh, and the two
X.242 incident/recovery reports. Staged set verified minimal — permissions
page, TermiX files, and pre-X.218 review docs deliberately excluded;
security scan of all staged files clean (no secrets, no keys, no passwords).

## 2. Deployment result

Deployed through the existing Vercel git integration (push-triggered).
New production deployment `a61a863v5` (dpl created 21:05 GMT+0530) —
**Ready**, verified holding the production alias
`https://bnb-agent-marketplace-web.vercel.app`. No environment variables,
service price, or buyer/seller configuration were changed:
`MAINNET_HIRE_ENABLED` remains **true**, price remains
**10000000000000 wei (0.00001 $U)**.

## 3. Recovery fix verification (pre-commit re-validation)

| Suite | Result |
| --- | --- |
| X.149 user-hire (incl. R1–R7b regression block) | ALL PASS |
| X.139 integrations wallet (nonce/receipt/provider) | ALL PASS |
| X.241 preflight (authorized-state refresh) | 27/27 PASS |
| seller-runtime | 35/35 PASS |
| network-selector | 63/63 PASS |
| typecheck / lint / build | PASS (turbo all tasks) |
| prettier (changed files) / git diff --check | PASS / CLEAN |

## 4. Production verification (post-deploy, read-only)

- Production alias: agent 334760 page → **HTTP 200**
- Production hire API: unauthenticated prepare probe → **403** (healthy
  auth/CSRF layer response — not 5xx; the full authenticated prepare path
  requires a browser session, exercised at the actual hire execution)
- Mainnet seller `/health` (external `:8443`): `status: ok`, **chain 56**,
  seller `0xB0f768…7c0`, **`hire: "enabled"`**, **agentId
  `56:0x8004…a432:334760`** — all as required
- Seller `/negotiate`: **accepted=true, chain 56, price 10000000000000,
  provider signature present** — the live Mainnet commercial preparation
  path is healthy end-to-end
- Buyer `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` — configuration
  unchanged; the deployed code contains no buyer-side changes (the fix is
  in the shared headless executor seam)
- **No createJob was executed** (per instruction)

## 5. Job status (READ-ONLY, SDK job reader)

| Job | Status | Budget | Note |
| --- | --- | --- | --- |
| **56714** | OPEN (0) | **0** | untouched; expires naturally at `expiredAt` 1788699519 |
| **56715** | OPEN (0) | **0** | untouched; **intended surviving job** for the eventual continuation |

Both: client=`0x299Ce4…C15C`, provider=`0xB0f768…7c0`, chain 56. No
writes to either job in this milestone.

## 6. Testnet regression

- Testnet seller `https://…ts.net/health` → 200, chain 97, seller
  `0xB0f768…7c0` — unchanged.
- Agent 1906: UNCHANGED · Agent 2005: UNTOUCHED · Job 787: UNTOUCHED.
- Zero Testnet transactions.

## 7. Ledger

| Item | Count |
| --- | --- |
| New transactions / signatures / approvals / transfers | 0 / 0 / 0 / 0 |
| New jobs / hires / wallet prompts | 0 / 0 / 0 |
| Jobs 56714 / 56715 | untouched / untouched (both OPEN, zero budget) |

**STOP — deployment verified. Job 56715 continuation NOT started; no
transaction authorization requested; no blockchain write performed.**
