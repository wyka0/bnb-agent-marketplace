# Main Track Activation — X.64 Search + Compare

**Scope:** local product completion only. No production deploy, infrastructure,
credentials, AWS/KMS, Neon, mainnet, Agent 1816, Job 515, transaction logic,
commit, or push.

## Results

| Area | Result | Notes |
|---|---|---|
| SEARCH | **PARTIAL** | Implementation and URL/offline-state verification pass. Live filtered rows could not be exercised locally because no `8004SCAN_API_KEY` is present; no production credentials were imported. |
| COMPARE | **PARTIAL** | Implementation, exact-identity URL state, and 10/10 fixture-state checks pass. Live 2/3-agent rendering could not be exercised locally without the registry credential. |
| MARKETPLACE | **PASS** | Existing UX preserved; server now passes `q` to the verified loader, cards have functional compare controls, max-three state, and a real Compare command. Verifier 83/83 passes. |
| BUILD | **PASS** | Final `pnpm build`, sequential typecheck, and lint pass. |
| TESTS | **PARTIAL** | Marketplace 83/83, discovery 59/59, compare 10/10, and all aggregate suites before X.50 pass. Aggregate `pnpm test` still stops at the pre-existing stale X.50 check 24 (`@prisma/client` string assertion vs the X.61 direct-import/tracing configuration). |

## Root Cause

- Homepage search already navigated to `/marketplace?q=<query>`, and the
  Marketplace initialized client state from `q`, but its server page always
  fetched the generic newest 24 records. Queries outside that first page could
  never be returned.
- Compare was a static placeholder page: three boolean skeleton slots, pending
  badges, invented permission/pricing row labels, and no registry selection.
- Marketplace omitted `AgentCard.compare`; details toggled local visual state
  only. Neither action reached a comparison route.

## Implementation

### Search

- Extended `getMarketplaceAgents` with optional `query`; it passes trimmed
  text into the existing verified `listAgents({ search })` client. No second
  client, parser, credential path, or client-side secret.
- `/marketplace` now reads server `searchParams.q` and performs the bounded
  live registry search before rendering.
- Existing URL-state behavior remains: `q` initializes the search box and is
  mirrored back to the URL, so refresh preserves it.
- Empty query remains the normal newest-first registry page.
- Empty live query response renders `NoSearchResults`; missing-key/rate-limit/
  network/error states reuse existing honest Marketplace states.

### Compare

- Replaced placeholder Compare with a live, dynamic server page.
- Selection URL: `/compare?compare=<agent_id>,<agent_id>,<agent_id>`.
- Exact identities are resolved independently with
  `getMarketplaceAgentBySlug`; unresolved identities are discarded honestly.
- Catalog selector reuses `getMarketplaceAgents({ limit: 100 })` and
  `matchesSearch` (same normalized data/search surface).
- Maximum three, no duplicates, remove-one, clear-all, empty, and one-agent
  states implemented.
- Compared fields are real model fields only: name, description, category
  (explicitly not classified), x402 capability when declared, protocols,
  chain, verification, score/reviews when present, registry score, exact
  registry/source identity, listed status, and listing date.
- Missing fields say `Not provided by 8004scan`, `No protocols listed`, or
  equivalent. No APY, health factor, risk, permission, pricing, uptime,
  latency, success-rate, or activity values are invented.
- Every selected header links to `/agents/<encoded agent_id>`.

### Entry Points

- Marketplace cards now expose the existing real Compare checkbox using each
  normalized record's exact `slug`; a `Compare N/3` button opens the route.
- Selection is preserved in Marketplace URL state via `compare=`.
- Agent details Compare now navigates to `/compare?compare=<exact slug>` and is
  disabled if no live agent resolved; the old local-only toggle is removed.
- Homepage Compare already linked to `/compare`; it now lands on the real UX.
- `Hire Soon` remains unchanged. No monitoring claims were added.

## Verification

### Gates

- `pnpm typecheck` — PASS (sequential final run).
- `pnpm lint` — PASS.
- `pnpm build` — PASS; `/compare` and `/marketplace` are dynamic server routes.
- `pnpm marketplace:verify` — PASS, 83/83.
- `pnpm discovery:verify` — PASS, 59/59.
- `pnpm compare:verify` — PASS, 10/10: two agents, three agents,
  duplicate prevention, fourth rejection, remove, clear, exact serialization,
  URL round-trip, URL duplicate collapse, URL max-three cap.
- `pnpm test` — PARTIAL: all suites through X.49 pass; the pre-existing X.50
  check 24 fails because it expects `@prisma/client` in
  `serverExternalPackages`, intentionally superseded by X.61. No infrastructure
  file was touched in X.64.
- One transient typecheck failure occurred only because typecheck and build
  ran in parallel while Next rewrote `.next/types`; the required sequential
  rerun passed.

### Local Runtime (port 3101)

- `/` — 200; homepage search remains present.
- `/marketplace?q=yield` — 200; input SSR value is `yield`, proving query/refresh
  persistence; honest `Registry not connected` state because local key absent.
- `/marketplace?q=no-such-agent-x64` — 200; query persists and no fake row is
  emitted. Live `NoSearchResults` branch requires a configured registry response.
- `/compare` — 200; useful empty state, selector, and no old placeholder slots.
- `/compare?compare=<unknown exact identity>` — 200; identity resolves honestly
  to no selection (never guessed).
- Agent-details navigation is wired in source to exact live `agent.slug`; a
  live detail page could not resolve locally without the same missing key.

## Constraints Honored

- No production deploy.
- No infrastructure, AWS/KMS, Neon, mainnet, Agent 1816, Job 515, signing,
  broadcast, transaction, credential, commit, or push activity.
- No fabricated registry results or comparison metrics.

STOP: X.64 ends here.
