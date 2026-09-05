# X.245 — Final Registry Latency + Hire Availability Fix

Date: 2026-09-06 — Minimal fix per X.244, user-authorized. Zero blockchain
activity (no transactions, no signatures, no jobs; Job 56715 untouched;
`MAINNET_HIRE_ENABLED` unchanged true; seller runtime unchanged; wallets
unchanged; X.231 freshness, X.243 isolation, pricing, discovery design all
unchanged).

## 1. Exact files changed

| File                                                        | Change                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/lib/eight004scan/client.ts`                       | upstream registry read timeout **8s → 4s** (`SCAN_READ_TIMEOUT_MS = 4_000`, exported + applied in `listAgents`; all catalog/discovery/leaderboard reads flow through it) |
| `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`    | chain-56 registered agents (with owner) now render the REAL `MainTrackHireView` (stale X.234 "coming soon" card removed; a fail-closed owner-less card retained)         |
| `apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx` | availability is chain-aware: `(chainId === 97 \|\| chainId === 56) && ownerAddress`                                                                                      |
| `apps/web/lib/eight004scan/network-selector.verify.ts`      | +6 X.245 checks (timeout constant, behavioral 4s abort, chain-56 hire card, backend-gate authority) — harness 92 → 98                                                    |
| `docs/review/X244-Registry-Latency-Diagnostic.md`           | fix-status addendum                                                                                                                                                      |
| This report                                                 | —                                                                                                                                                                        |

## 2. Exact timeout change

`options.timeoutMs ?? 8000` → `options.timeoutMs ?? SCAN_READ_TIMEOUT_MS`
(4,000ms). Rationale (X.244 measurements): healthy 8004scan reads complete in
~0.7–2.2s; degraded reads slow-fail at ~10.4s. 4s keeps ~1.8× headroom over
the worst observed healthy read while capping a degraded-render wait at 4s
(previously 8s app timeout / ~10.4s upstream slow-fail). Truthful degraded
behavior preserved: a timeout maps to the honest non-ready state — no
fabricated data, no thrown errors (behaviorally tested).

## 3. Exact cause of "agent unavailable"

**Category C — a separate frontend availability guard (stale UI), NOT the
registry failure.** The X.234-era `agent-detail-view.tsx` hire card
hardcoded ALL chain-56 agents to a permanently disabled "Mainnet hiring
coming soon" card — written when Mainnet hiring was disabled. Production
reality moved on (X.242: `MAINNET_HIRE_ENABLED=true`, seller live and
quoting at the demo price, first hire FUNDED as Job 56715, X.241 chain-aware
API gate live), but the UI branch was never updated. The registry
degradation (X.244) only affects catalog availability/paint latency — it
was never the cause of the hire card's disabled state.

**The minimal fix**: render the real hire view for chain-56 registered
agents. Safety is preserved — the X.241 server-side chain-aware gate (flag +
literal-"true" semantics + identity/registry pins) remains the sole
authority on whether a chain-56 prepare proceeds; the UI can never bypass
it. (The separate `/hire` _activation_ path's "Activation unavailable"
mobile-bar state is the X.76 Model-B custody subsystem with its own
truthful chain-97 pin — unrelated to the commercial hire card and out of
scope.)

## 4. Tests (all PASS)

| Suite                                               | Result            |
| --------------------------------------------------- | ----------------- |
| network-selector.verify (X.216/231/232/243/**245**) | **98/98**         |
| marketplace.verify                                  | 104/104           |
| X.149 user-hire (incl. X.224–X.245 chains)          | ALL PASS          |
| hire.verify (X.6)                                   | 24/24             |
| mainnet-hire-preflight                              | 27/27             |
| hire.api.verify (X.65)                              | 14/14             |
| activation.verify (P12)                             | 33/33             |
| x80 / x81 / p13-review / capability-source          | ALL PASS          |
| seller-runtime / readiness / provisioning           | 35/36/52 all PASS |
| typecheck / lint / build                            | 14/14 · 14/14 · ✓ |
| prettier / git diff --check                         | PASS / CLEAN      |

New X.245 checks: timeout constant + no residual 8000; **behavioral** — a
hanging upstream read aborts at ~4s and returns the honest non-ok result
(never throws, never fabricates); chain-56 registered agents get the real
hire view; the hire view's availability is chain-aware.

## 5. Production deployment

- Commit: **`b6ba4ef2c8e1d47c6410a0a42233e29b54f06470`** (`b6ba4ef`), pushed
  `8e9d34d..b6ba4ef main -> main`.
- Deployed via the Vercel git integration to the existing project
  `bnb-agent-marketplace-web` (production alias
  `https://bnb-agent-marketplace-web.vercel.app`).
- **Deployment ID: `du8ptrpit`** (Ready, holds the production alias).

## 6. Production verification (12 acceptance criteria — ALL PASS)

| #   | Criterion                                        | Result                                                                                                                                           |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/marketplace` loads                             | ✅ HTTP 200 (4.6s during registry degradation — capped by the new timeout)                                                                       |
| 2   | Mainnet scope = chain 56 only                    | ✅ chain-56 present, chain-97 absent (default AND `?network=mainnet`)                                                                            |
| 3   | Testnet scope = chain 97 only                    | ✅ chain-97 present, chain-56 absent                                                                                                             |
| 4   | Invalid scope fails closed to Mainnet            | ✅ `?network=bogus` → chain-56 only                                                                                                              |
| 5   | Switch waits ≤ ~4s on degraded registry          | ✅ measured **4.3–4.7s total page time during a live 8004scan degradation** (previously 8–10.4s)                                                 |
| 6   | Healthy registry renders normally                | ✅ mid-window recovery rendered the full ready catalog (255KB, all cards) in the same ~4.5s                                                      |
| 7   | Degraded registry → truthful offline within ~4s  | ✅ honest "Waiting/Registry offline" states rendered, no fabricated data, capped at ~4.6s                                                        |
| 8   | Agent 334760 correctly represented               | ✅ page 200, full render (93KB)                                                                                                                  |
| 9   | Agent 334760 hire eligibility correctly reported | ✅ **the REAL hire view renders** ("A real ERC-8183 commercial hire", BNB Mainnet chain label); stale "coming soon"/"unavailable" markers absent |
| 10  | Mainnet seller healthy                           | ✅ `/health`: chain 56, owner `0xB0f768…7c0`, **`hire: enabled`**, agentId 334760; Testnet seller chain 97 healthy                               |
| 11  | `MAINNET_HIRE_ENABLED` remains true              | ✅ unchanged since X.242-DEPLOY-ENABLE (no env changes in X.245)                                                                                 |
| 12  | Job 56715 FUNDED and unchanged                   | ✅ on-chain read: status 1 (FUNDED), budget 1e13 wei, client `0x299Ce4…C15C`, provider `0xB0f768…7c0` — untouched                                |

## 7. Blockchain ledger

Zero new transactions · zero new signatures · zero escrow changes ·
Job 56715 FUNDED/untouched (re-verified post-deploy read-only) · Testnet
1906/2005/787 untouched.
