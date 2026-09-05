# X.243 — Network Isolation & Switch Reliability

Date: 2026-09-05 — Implementation complete, all tests green. **Zero blockchain
activity** (no transactions, signatures, approvals, transfers, jobs, hires;
Job 56715 remains FUNDED/UNTOUCHED; escrow untouched; Agents 334760/1906/2005
and Job 787 untouched; MAINNET_HIRE_ENABLED remains true; seller remains
enabled). **NOT committed, NOT pushed** (awaiting deployment authorization).

## 1. Reproduction & root cause (all three user-reported bugs confirmed)

| Bug                                          | Root cause (file:line, pre-fix)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. "Switching to Testnet…" hangs forever** | `network-selector.tsx`: `switching`/`pending` set at confirm (L63-69) with **ZERO code paths able to clear them** — no effect watches the scope prop, no finally, all close affordances guarded by `!switching` (Cancel disabled L133, Escape guard L111-115). The underlying `router.replace` is fire-and-forget (returns void) and Next 15's navigate reducer **silently swallows navigation failures**. Deterministic hang: every confirm click left the modal stuck until a full page reload. |
| **2. Mainnet agents under Testnet**          | Category discovery was completely scope-blind: `page.tsx` L48-51 fetched `getBscCategoryDiscovery()` with NO scope; `service.ts` L49-52 hardcoded BOTH chains (56+97); selecting any category facet swapped the scoped grid for the merged discovery buckets (`marketplace-view.tsx` L429, 459-493).                                                                                                                                                                                              |
| **3. Testnet agents under Mainnet**          | Default scope `"all"` merged chains 56+97 (`marketplace.ts` L165-166, 208-221) while the selector presented it as **"Mainnet active"** (`network-selector.tsx` L56-59); no client-side chain filter exists. The toolbar total was also the cross-chain sum.                                                                                                                                                                                                                                       |

Additional latent defects found and fixed: the network switch did NOT reset
`?page=` (page 7 of one network landed on page 7 of the other — unlike the
leaderboard's switch which resets); an in-flight switch had no failure signal
(see fix); the selector could never produce the pure chain-56 view from the
default landing (clicking the active network is a no-op).

## 2. Network state architecture (post-fix)

One authoritative source of truth, unchanged: **the URL `?network=` param →
server-parsed `scope` prop**. The modal's local state is now strictly
derived/reconciled against it:

```
URL ?network= ──(server parse, default now "mainnet")──▶ scope prop
   ▲                                                      │
   │ selector onSwitch (URL writer #1: sets network, deletes page/focus)
   │ mirror effect (writer #2: derives from scope PROP — server truth)
   └──────────────────────────────────────────────────────┘
scope prop ──▶ getMarketplaceAgents({scope})   (chain 56 XOR 97 upstream read)
scope prop ──▶ getBscCategoryDiscovery({scope}) (chain 56 XOR 97 discovery)
scope prop ──▶ NetworkSelector current ──▶ modal closes when current === pending
```

## 3. Catalog isolation fix (backend/data-layer enforced)

- `parseMarketplaceNetworkScope`: default and every unrecognized value now
  resolve to **"mainnet"** (fail closed — an invalid value can never yield
  the merged view). Explicit `"all"` remains a supported scope for
  scope-less callers (the homepage, which documents its merged X.154 view)
  but is unreachable from the UI selector.
- `getBscCategoryDiscovery` accepts `scope`; `listBscAgents` resolves the
  per-chain queries via `chainQueriesForScope` — **mainnet reads only the
  chain-56 registry, testnet only chain-97** (upstream-enforced, not client
  filtering). `marketplace/page.tsx` passes its resolved scope to discovery.
- Result: Mainnet selected (including the default view) → catalog and
  category facets contain ONLY chain-56 agents; Testnet → ONLY chain-97.

## 4. Switch lifecycle fix (the hang)

`network-selector.tsx` now has an explicit, bounded lifecycle:

- **PRIMARY completion**: an effect closes the modal, clears loading, and
  clears errors **the moment the scope prop becomes the pending target** —
  the same render that delivers the new network's catalog (success in both
  directions: C and D).
- **SECONDARY failure fallback**: a 15s bound (strictly above the 8s
  upstream read bound) clears the loading state and shows a truthful error
  (`role="alert"`: "The switch to X did not complete. The catalog still
  shows the previously selected network — try again."). The scope/URL never
  changed on failure, so the app stays consistent on the old network. The
  timeout is a safety net only — the primary mechanism is the state
  lifecycle (documented in-code).
- Loading starts exactly once (confirm), every close path clears
  `switching`/`pending`, and a stale error is cleared on the next attempt.
  **The user can never be permanently trapped.**

## 5. Stale-request protection (G/H)

The catalog is server-rendered per navigation (force-dynamic, no client
fetching — verified: no `fetch(`/`useQuery`/`useSWR` in the view), so there
is no client-side out-of-order response race by construction. The remaining
stale window (old grid visible while the RSC payload is in flight) is now
_bounded and covered_ by the modal, which closes only when the new scope
prop arrives — the user never interacts with the old grid as if it were the
new network. Upstream reads are `cache: "no-store"` (no cross-network cache
reuse); no client catalog cache exists (K).

## 6. Pagination/caching/URL behavior

- **Network switch now resets `?page=`** (matches the leaderboard pattern) —
  page N of one network can never land on page N of the other.
- Totals remain per-network upstream totals (never cross-chain sums under a
  scope; the merged "all" sum only exists for the explicit scope-less
  homepage path).
- URL-only persistence (documented behavior preserved): refresh keeps the
  selection; the mirror effect canonicalizes `?network=mainnet` onto the
  bare URL (the default now being mainnet, the URL always names the truth).
- Deep links: `/marketplace?network=mainnet|testnet` render the correct
  per-chain catalog (server-enforced); invalid values canonicalize to
  Mainnet.

## 7. Hire safety (L/M/N/O)

Untouched and re-asserted by tests: the selector is discovery-only (no
wallet calls, no hire wiring — X.216/X.231C assertions still pass);
`chainIdFromAgentId` resolves agent 334760→56 and 1906→97;
`resolveHireChainConfig` throws for unknown chains with fully disjoint
chain-56/97 contract tables — a Mainnet hire cannot fall back to chain-97
configuration (and vice versa). Backend validation remains authoritative
(the X.241 API-layer chain gate is unchanged).

## 8. Tests

**Updated (4 stale assertions that enshrined the buggy behavior):** parse
default ('all'→'mainnet'), Cancel/Escape clear-error patterns, useState
count (2→3: pending/switching/switchError). The X.154 "all" loader path
assertion still passes (path intact for scope-less callers).

**New: 29 X.243 checks (A–O coverage), harness total 63 → 92, all PASS:**

| Req | Tests                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A/B | behavioral fetch-stub: Mainnet selection → ONLY chain-56 registry queried + only chain-56 agents returned; Testnet → ONLY chain-97 (catalog AND discovery, both directions) |
| C/D | success effect closes the modal when current becomes pending (both directions, same effect)                                                                                 |
| E   | bounded fallback clears loading (no permanent "Switching to …")                                                                                                             |
| F   | failed switch: truthful error (role=alert) + loading cleared                                                                                                                |
| G/H | no client catalog fetches (server-props architecture); modal closes only on scope-prop change; upstream no-store                                                            |
| I/J | page 2 of each network queries only that chain with page=2; per-network totals (2, never summed)                                                                            |
| K   | no react-query/SWR client cache; force-dynamic + revalidate=0                                                                                                               |
| L/M | agent 334760 → chain 56; agent 1906 → chain 97                                                                                                                              |
| N/O | resolveHireChainConfig throws on unknown; disjoint 56/97 commerce/registry/$U                                                                                               |
| +   | switch resets page; discovery receives the page's scope; explicit-'all' parse retained                                                                                      |

**Full matrix:** network-selector 92/92 · marketplace.verify 104/104 ·
X.149 user-hire ALL PASS (incl. X.224–X.242) · hire.verify 24/24 · preflight
27/27 · seller harnesses 35/36/52 all PASS · typecheck 14/14 · lint 14/14 ·
build ✓ · prettier ✓ · git diff --check CLEAN.

## 9. Production verification (read-only, PRE-deploy)

Production (serving `779fa54`) — all three bugs confirmed live:

- Bare `/marketplace` → merged chain-56+chain-97 content under "Mainnet
  active" (bug 3 live).
- `?network=testnet` → main grid chain-97 but chain-56 agent links present
  via the scope-blind category discovery (bug 2 live).
- The modal hang (bug 1) is client-side (deterministic per the code path).

**The fix is NOT yet deployed** — deploying requires commit+push (awaiting
authorization, per this milestone's GIT constraints). Post-deploy
verification (switch both directions, modal completes, no stale cards) is
the first step of the follow-up deployment milestone.

## 10. Files changed (all uncommitted)

| File                                                   | Change                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `apps/web/app/(app)/marketplace/network-selector.tsx`  | modal lifecycle: success effect + bounded failure fallback + truthful error state |
| `apps/web/app/(app)/marketplace/marketplace-view.tsx`  | switch resets `?page=`                                                            |
| `apps/web/app/(app)/marketplace/page.tsx`              | passes resolved scope to discovery                                                |
| `apps/web/lib/eight004scan/marketplace.ts`             | parse default/invalid → "mainnet" (fail closed)                                   |
| `apps/web/lib/eight004scan/discovery/service.ts`       | scope-aware chain queries (data-layer enforcement)                                |
| `apps/web/lib/eight004scan/network-selector.verify.ts` | 4 assertions updated (de-bugged), +29 X.243 checks                                |

## 11. Remaining issues

- Deployment of this fix (commit + push + Vercel) — awaiting explicit
  authorization.
- The homepage intentionally keeps its documented merged X.154 view
  (scope-less caller; not part of the selector surface).
- `?network=all` remains a valid explicit deep link (documented merged
  view); unreachable from the UI selector.

## Ledger

Transactions 0 · Signatures 0 · Approvals 0 · Transfers 0 · Jobs 0 · Hires 0 ·
Job 56715 FUNDED/UNTOUCHED · Testnet untouched (1906/2005/787) ·
MAINNET_HIRE_ENABLED=true (unchanged) · Mainnet seller ENABLED (unchanged) ·
Commit 0 · Push 0.

**STOP — implementation and tests complete; awaiting deployment
authorization.**
