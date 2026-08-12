# MAIN P6 — Marketplace Agent Details live wiring (8004scan)

## Status

DONE — Live identity resolution added to the Agent Details route, registry
metrics surfaced honestly, harness + scripts added, full verification green
(83 fixture checks + 14 live API checks + all prior suites + prod build +
smoke tests).

## What changed

### Agent Details route — live registry record (`/agents/[slug]`)

The page still hosts the TermiX reputation and PancakeSwap sections unchanged;
P6 adds the LIVE 8004scan record as the primary source for the hero, trust
strip, registry rail, capabilities, and activity.

- **Identity key = the registry `agent_id`** (composite `chainId:contract:tokenId`,
  produced by the verified `normalize.ts`). The Marketplace cards and
  Leaderboards rows already link to this exact key (`agentHrefFromId` /
  `encodeURIComponent(agent.slug)`) — no slug guessing anywhere.
- `resolveAgent` (`[slug]/page.tsx`): only `isAgentIdSlug` shapes attempt a
  lookup — ONE bounded request (`listAgents search=<agent_id>` + exact
  key-equality `pickAgentBySlug`). Legacy name-style slugs render the existing
  honest "waiting" page (unchanged behavior).
- `generateMetadata` uses the real registry name when the record resolves
  (never a guess; fallback = existing `titleFromSlug`).
- `AgentDetailView` gains optional `agent` prop — when present:
  - Hero: real name, description, honest "Uncategorized" chip (8004scan does
    not classify product category), chain + `#tokenId` chip.
  - Trust strip: real `Verification` (verified/unverified) + `Registry synced`
    badges; Builder/Risk/Reputation/Status badges stay at their honest pending
    states (8004scan provides no data for them).
  - Registry record rail: reference, chain label, token ID, contract, owner,
    last synced (real), plus a 6-tile metrics grid (registry score, stars,
    avg score, feedbacks, health score, x402 support) — nulls stay em-dashes,
    genuine 0 passes verbatim.
  - Capabilities: real `supported_protocols` as `ProtocolBadge`s; capability
    tags honestly noted as "not provided by the registry yet".
  - Activity: real "first listed / last updated" lines.
- `LeaderboardAgent` type + `normalize.ts` extended with the two remaining
  real fields used by the rail: `contractAddress`, `healthScore`.

### Harness (framework-free, Node-only)

- `lib/eight004scan/fixtures.ts` — 4 labeled raw-record fixtures (verified EVM,
  solana null-heavy, zero-signals, testnet x402).
- `lib/eight004scan/marketplace.verify.ts` — 83 checks across normalize, state
  shaping, exact-key identity matching, card mapping, filters + stable sorts.
- `lib/eight004scan/live.verify.ts` — bounded (1 request, keyless-safe)
  end-to-end check against the real public API; if `8004SCAN_API_KEY` is set a
  single additional exact-identity round-trip runs.
- Scripts: `marketplace:verify`, `marketplace:live:verify` (apps/web).
- `tsconfig.json`: `allowImportingTsExtensions` (needed for Node strip-types
  relative imports; verify files remain excluded from typecheck as before).

### Fixes found while wiring

- `marketplace-view.tsx`: removed stale `data.state === "loading"` branch and
  unused skeleton imports (state space has no loading state), typed empty
  `registryStates` set as `Set<string>`.
- Soft-404 semantics documented: invalid slugs render the not-found UI with
  Next's injected `<meta name="robots" content="noindex">`; HTTP status stays
  200 because dynamic streamed responses commit headers before `notFound()`
  (Next-documented behavior, matches `vercel.store`). Verified the noindex
  tag is present.

## Verification evidence

- `marketplace:verify` — 83/83 passed (fixtures: identity, zeros, nulls,
  testnet; states: ready/empty/401/403/429/500/network; identity: exact-match
  only; cards: href/badges/reputation/hireable-false; filters/sorts).
- `marketplace:live:verify` — 14/14 passed against the real 8004scan API
  (anonymous tier returned 5 real agents, normalized cleanly).
- Regressions — termix:reputation:web 11/11; pancakeswap:server green;
  pancakeswap:ui green; pancakeswap:live honestly skipped (no key).
- `tsc --noEmit` + `eslint app lib` — clean.
- `next build` — clean; `/agents/[slug]`, `/leaderboards`, `/marketplace`
  remain dynamic routes.
- Prod-server smoke (`next start`): /marketplace, /leaderboards, live-shaped
  slug, legacy slug → 200 with correct content; invalid slug → not-found UI.
- Secret scan of `.next/static`: no env-key/private-key patterns.

## Honesty invariants preserved

- Nothing is fabricated: category/risk/reputation-level/activity/success-rate
  stay null (8004scan does not provide them); genuine 0s pass through.
- Identity never fuzzy-matched; only the exact composite `agent_id` resolves.
- Keyless deployments keep the designed "Registry not connected" states on
  marketplace/leaderboards/detail (consistent with `8004SCAN_API_KEY` gate in
  `leaderboard.ts` / `marketplace.ts`); the live request paths themselves are
  keyless-safe per the verified client.
- Number of network calls per request stays bounded (1 detail lookup + the
  pre-existing TermiX (only when identity params supplied) + PancakeSwap top-5).

## Where to verify

- `npm run marketplace:verify` — offline harness (no key needed)
- `npm run marketplace:live:verify` — 1 bounded public request (no key needed;
  identity round-trip additionally runs with `8004SCAN_API_KEY` set)
- Full suite: termix:reputation:web:verify · pancakeswap:server:verify ·
  pancakeswap:ui:verify · pancakeswap:live:verify · typecheck · lint
