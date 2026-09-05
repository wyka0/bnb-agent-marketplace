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

- Commit: (recorded post-commit below)
- Deployed via the Vercel git integration to the existing project
  `bnb-agent-marketplace-web` (production alias
  `https://bnb-agent-marketplace-web.vercel.app`).
- Deployment ID: (recorded post-deploy below)

## 6. Production verification (12 acceptance criteria)

| #   | Criterion                                                                            | Result                                  |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------- |
| 1   | `/marketplace` loads                                                                 | (post-deploy)                           |
| 2   | Mainnet scope = chain 56 only                                                        | (post-deploy)                           |
| 3   | Testnet scope = chain 97 only                                                        | (post-deploy)                           |
| 4   | Invalid scope fails closed to Mainnet                                                | (post-deploy)                           |
| 5   | Switch waits ≤ ~4s on degraded registry                                              | (post-deploy)                           |
| 6   | Healthy registry renders normally                                                    | (post-deploy)                           |
| 7   | Degraded registry → truthful offline within ~4s                                      | (post-deploy)                           |
| 8   | Agent 334760 correctly represented                                                   | (post-deploy)                           |
| 9   | Agent 334760 hire eligibility correctly reported (real hire view, not "unavailable") | (post-deploy)                           |
| 10  | Mainnet seller healthy, `hire: enabled`, agentId 334760, chain 56                    | (post-deploy)                           |
| 11  | `MAINNET_HIRE_ENABLED` remains true                                                  | (post-deploy)                           |
| 12  | Job 56715 FUNDED and unchanged                                                       | (post-deploy, read-only on-chain check) |

## 7. Blockchain ledger

Zero new transactions · zero new signatures · zero escrow changes ·
Job 56715 FUNDED/untouched (re-verified post-deploy read-only) · Testnet
1906/2005/787 untouched.
