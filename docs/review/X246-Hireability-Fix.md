# X.246 — Final Hireability + Pagination Reliability Fix

Date: 2026-09-06 — User-authorized fix milestone. **Zero blockchain
activity**: no transactions, no signatures, no jobs, no approvals; Job 56715
FUNDED/untouched (on-chain re-verified); Testnet 1906/2005/787 untouched;
`MAINNET_HIRE_ENABLED` unchanged (true); seller runtime unchanged; pricing,
X.231 freshness, X.243 isolation, X.245 4s timeout — all unchanged. No repo
cleanup, no squash, no project deletion.

## 1. Root cause — Mainnet "Unavailable" (cards)

**Stale per-file UI pin (the X.245 miss).** The hireability knowledge
("chain 56 + 97 are the two hire chains") was hand-duplicated in THREE
display files. X.245 fixed two (`agent-detail-view.tsx`,
`main-track-hire-view.tsx`) but missed **`card.ts`** — the marketplace
catalog card mapper still pinned `agent.chainId === 97`, so EVERY Mainnet
card rendered "Unavailable" in the catalog even though Mainnet hiring is
enabled and the detail page showed the real Hire UI. Answering the trace:
(1) yes 334760 is returned by the Mainnet catalog when 8004scan is healthy
(it sits deep in newest-first ordering — ~1000 registrations older than
page 1; reachable via search/direct link); (2–5) no filtering caused this;
(6) yes, stale card logic; (7) the detail page already used
MainTrackHireView (X.245); (8–9) the CARD's `mainTrackHireable` boolean was
the disabling condition; (10–11) server-side X.241 eligibility accepts
chain-56 (proven by Job 56715); (12) the card mapper was the incorrect
frontend guard.

**Note on the agent PAGE "Hire requires a resolved registry agent"
fallback**: that state (observed during registry-outage windows) is the
honest `agent=undefined` resolution failure — the registry degradation
(Category A), truthful by design and preserved.

### The fix (structural, minimal)

Centralized the predicate in the ONE authoritative seam:
`isHireChain(chainId)` exported from `packages/integrations/src/altana/
hire-chains.ts` (56 + 97), and all THREE display sites now consume it:

- `apps/web/lib/eight004scan/card.ts` — `mainTrackHireable = isHireChain(...) && owner`
- `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` — hireCard branch
- `apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx` — `isAvailableAgent`

No per-file `chainId === 97 || chainId === 56` duplication remains — the
class of miss that caused this bug cannot recur by the same mechanism.
Non-hireable agents keep truthful fallbacks (owner-less card, non-hire-chain
reason); server-side X.241 eligibility remains the sole authority (no gate
weakened).

## 2. Root cause — page-2 "Registry offline"

**NOT an application bug — the same uniform 8004scan degradation.**
Replicated the exact page-2 reads: page 2 issues the same 5 scope-isolated
requests as page 1 (1 catalog read at page=2 + 4 discovery reads), and
measured page=1 and page=2 failing **interchangeably** (~50% at the 4s
timeout) across multiple trials — page 2 is not specially broken. The X.243
fetch-stub tests prove page-2 scope isolation (mainnet page 2 → chain 56
only; testnet page 2 → chain 97 only; verified in production: page-2 HTML
is chain-pure per scope). One failed page request maps to the honest
per-request degraded state and does not corrupt global state (server-props
architecture — the next navigation re-renders fresh). The 4s X.245 timeout
is respected (production page responses measured 279ms–4.7s even during
hard-outage windows). **No fix applied for B — none was warranted.** The
user-visible association with page 2 is simply that a fresh navigation
(paging) re-rolls the flaky upstream, same as any switch/refresh.

## 3. Files changed

| File                                                        | Change                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/integrations/src/altana/hire-chains.ts`           | NEW `isHireChain()` predicate (the single source of the two-hire-chain truth)                                |
| `apps/web/lib/eight004scan/card.ts`                         | card mapper consumes `isHireChain` (the X.245 miss — root cause of "Unavailable" cards)                      |
| `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`    | consumes `isHireChain`                                                                                       |
| `apps/web/app/(app)/agents/[slug]/main-track-hire-view.tsx` | consumes `isHireChain`                                                                                       |
| `apps/web/lib/eight004scan/network-selector.verify.ts`      | +5 X.246 checks (D1–D3, D8, no-duplication) — harness 95 → 100                                               |
| `apps/web/lib/eight004scan/marketplace.verify.ts`           | 1 fixture updated to post-fix truth (chain-56 owned agent IS hireable — the old assertion enshrined the bug) |

## 4. Tests (all PASS)

| Suite                                                   | Result            |
| ------------------------------------------------------- | ----------------- |
| network-selector.verify (X.216/231/232/243/245/**246**) | **100/100**       |
| marketplace.verify                                      | 104/104           |
| X.149 user-hire (incl. X.224–X.245 chains)              | ALL PASS          |
| hire.verify (X.6)                                       | 24/24             |
| mainnet-hire-preflight                                  | 27/27             |
| hire.api.verify (X.65)                                  | 14/14             |
| activation.verify (P12)                                 | 33/33             |
| x80                                                     | ALL PASS          |
| X.139 integrations wallet                               | ALL PASS          |
| seller-runtime / readiness / provisioning               | 35/36/52 all PASS |
| typecheck / lint / build                                | 14/14 · 14/14 · ✓ |
| prettier / git diff --check                             | PASS / CLEAN      |

Milestone D-requirements coverage: D1 (334760/chain-56 hireable at every
site) ✓ new check · D2 (stale "coming soon" cannot return — absent
everywhere) ✓ · D3 (truthful non-hireable fallbacks) ✓ · D4/D5 (page-2
scope isolation — X.243I fetch-stub + production HTML) ✓ · D6 (4s timeout
— X.245 behavioral abort test) ✓ · D7 (502 → truthful degraded state —
X.245 + honest-state architecture tests) ✓ · D8 (server-authoritative
eligibility — new gate-intact check + X.241 C/E/E2 suites) ✓.

## 5. Deployment

- Commit: **`16aebf0a64ef53f8382ad40519563e5592b21bbd`** (`16aebf0`),
  pushed `ed7d05a..16aebf0 main -> main`.
- Deployed via the Vercel git integration to the EXISTING project
  **`bnb-agent-marketplace-web`** (no new project, no deletion).
- **Deployment ID: `q81gn8kab`** (Ready, holds the production alias).

## 6. Production verification

| #   | Criterion                                                  | Result                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mainnet marketplace loads                                  | ✅ HTTP 200 (279ms–4.7s across registry windows)                                                                                                                                                                                                     |
| 2   | Testnet marketplace loads                                  | ✅ HTTP 200                                                                                                                                                                                                                                          |
| 3   | Mainnet Agent 334760 reaches the REAL Hire UI              | ✅ verified in the healthy window: "A real ERC-8183 commercial hire" renders, no stale "coming soon", no fallback (during outage windows the honest unresolved-fallback renders — truthful, preserved)                                               |
| 4   | Hire preparation reachable without executing a transaction | ✅ Hire affordance present (24/24 rendered chain-56 cards carry Hire markers; ZERO `>Unavailable<` badges — pre-fix every chain-56 card had one); the prepare path itself remains the X.241 server gate (all suites green) — no transaction executed |
| 5   | Page-2 behavior correct                                    | ✅ page-2 HTML chain-pure per scope (mainnet p2 → 56 only, testnet p2 → 97 only); page-1/page-2 semantics identical; failures are the uniform upstream flakiness with honest states                                                                  |
| 6   | Registry degradation remains truthful                      | ✅ honest "Waiting/Registry offline" states during outage windows; fast 4s-capped responses; zero fabricated data                                                                                                                                    |
| 7   | Network isolation correct                                  | ✅ mainnet → 56 only, testnet → 97 only, default/bogus → mainnet                                                                                                                                                                                     |

## 7. Blockchain ledger

**ZERO new transactions · ZERO new signatures · ZERO escrow changes.**
Job 56715 on-chain re-verified post-deploy: **FUNDED (status 1), budget
1e13 wei, client `0x299Ce4…C15C`, provider `0xB0f768…7c0`** — untouched.
Testnet Agent 1906/2005 and Job 787 untouched. Mainnet seller healthy
(`hire: enabled`, agentId 334760, chain 56); Testnet seller healthy (97).
`MAINNET_HIRE_ENABLED=true` unchanged.

**STOP — X.246 complete. No repository cleanup performed (per instruction).**
