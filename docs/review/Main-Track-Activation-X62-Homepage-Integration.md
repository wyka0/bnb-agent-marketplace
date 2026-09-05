# Main Track Activation — X.62 Homepage Integration

**Scope:** production homepage `/` only. Wire the homepage data sections to the
already-verified 8004scan data layer that powers `/marketplace`; remove every
obsolete "future integration" / placeholder state; preserve all marketing/hero
sections and the four Main Track category tracks. No deploy was made — local
verification only, per instructions.

## Root cause found

`apps/web/app/(home)/page.tsx` was a synchronous, static server component. The
eleven home sections were hard-coded marketing/placeholder compositions:

| Section | Obsolete state (now removed) |
|---|---|
| `GlobalSearch` | "Search will query the live ERC-8004 agent registry once integration ships." |
| `FeaturedAgents` | 6 shimmer skeletons + "Loading live agents from registry… — ready for future 8004scan integration." |
| `MarketplaceSnapshot` | 4 cards with hard-coded `--` values + hints "Synced from 8004scan once live" / "Populated after registry sync" + "Waiting for registry sync" pill |
| `RecentActivity` | 5 shimmer skeleton rows + "Waiting for registry sync" + "will appear here as the live feed connects" |
| `ComparePreview` | "--" cells + "agent slots are awaiting registry sync" |
| `EcosystemStats` | "Live figures are loaded from the on-chain registry and verification pipeline once integration ships." |

Meanwhile `/marketplace` (`app/(app)/marketplace/page.tsx`) already renders live
data through the proven, honest-state pipeline:
`lib/eight004scan/marketplace.ts` (`getMarketplaceAgents`, 1 bounded request) +
`lib/eight004scan/discovery/service.ts` (`getBscCategoryDiscovery`, ≤ 4 bounded
BSC keyword requests) → discriminated states (missing-key · ready · empty ·
unauthorized · forbidden · rate-limited · server-error · network-error · error).
The homepage simply had never been wired to it.

## Changes (all under `apps/web/`)

- **`app/(home)/page.tsx`** — now an async dynamic server page
  (`force-dynamic` + `revalidate = 0`, mirroring `/marketplace` so nothing is
  fetched at build time): `Promise.all([getMarketplaceAgents({ limit: 24, page: 1 }), getBscCategoryDiscovery({ maxPerCategory: 100 })])`, awaited **before**
  render, and the page content wrapped in `Suspense fallback={null}`. Data is
  passed into the sections as props. Marketing sections (Hero, TrustBanner,
  WhyChoose, EcosystemPartners) untouched.
- **`components/home/featured-agents.tsx`** — client component rendering real
  `AgentCard`s (the same `@bnb-marketplace/ui` component and
  `toAgentCardData` mapping as `/marketplace`, newest 6 agents, navigation to
  `/agents/[slug]`). Non-ready states emit compact honest messages + a
  registry badge (missing-key → "8004SCAN_API_KEY missing on the server",
  otherwise "registry unavailable — retry shortly") + Open Marketplace link.
  No skeletons, no loader, no fabrications.
- **`components/home/marketplace-snapshot.tsx`** — real, derived-only figures:
  **Agents in registry** = API pagination total; **Live listings shown** =
  page-1 row count; **Verified agents** = `is_verified` count on page 1;
  **Last indexed** = the snapshot timestamp. Badge flips to `synced` when the
  registry answered. All values come from the verified surface — nothing is
  invented, and non-ready states show a single honest message instead of `--`.
- **`components/home/recent-activity.tsx`** — retitled "Newest marketplace
  listings"; renders the 5 newest real registry records (name, protocols,
  verification, listing date). Honest footer: "Newest ERC-8004 records from
  8004scan (page 1, newest first) — real registry data, no simulated events."
- **`components/home/compare-preview.tsx`** — top 3 newest agents with rows for
  **Capabilities** (real protocols), **Verification** (real), **Chain**
  (`chainLabelForId`), **Listed** (real date). No `--` placeholders; honest
  states otherwise.
- **`components/home/global-search.tsx`** — the form is now functional: it
  navigates to `/marketplace?q=<query>` (the live registry search). Caption
  updated to "Searches the live ERC-8004 agent registry — results open on the
  Marketplace."
- **`components/home/category-showcase.tsx` + `category-card.tsx`** — the four
  Main Track sections keep their marketing copy and destinations; each card now
  shows a real **live matched** count from its BSC discovery bucket when the
  bucket answered (hidden otherwise). Section copy no longer promises future
  data.
- **`components/home/ecosystem-stats.tsx` + `stat-card.tsx`** — real figures:
  Registered Agents (API total), BSC Category Matches (sum of bucket
  `matched`), Supported Categories (4, constant), Networks on Page 1
  (distinct `chainId`s in the fetched page). `StatCard` gained an optional
  `value` prop; `--` renders only when the API truly supplied no number.
- **Deleted** `components/home/skeleton-agent-card.tsx` (unused).

Nothing was touched in AWS/KMS, Neon, mainnet, Agent 1816, Job 515, the
blockchain, or any credentials. No commits, no pushes, no deploy.

## Honesty rules preserved

- Category/risk/reputation-level/activity/sessions are **NOT** provided by
  8004scan and are **never** fabricated on the homepage.
- Every figure shown is derived from the exact same loader + normalizer as
  `/marketplace` (verified by `marketplace:verify`, 83 checks; and
  `discovery:verify`, 59 checks — both PASS).
- Missing-key / offline states render honest messages and badges — never fake
  cards, never simulated numbers.

## Verification (local, no deploy)

1. `pnpm typecheck` — PASS (0 errors).
2. `pnpm lint` — PASS (0 problems).
3. `pnpm build` — PASS. `/` is now `ƒ` (dynamic, server-rendered on demand);
   13/13 pages generated; the homepage first-load JS is 167 kB, same family as
   `/marketplace` (169 kB). No 8004scan requests at build time.
4. `pnpm test` — 10 harnesses: X.42, X.43, X.44, X.45, X.47 verifier (72/72),
   X.49 (25/25), X.53, X.54, X.55 all PASS. **One pre-existing failure**: X.50
   check 24 asserts the literal string `@prisma/client` inside
   `next.config.mjs` `serverExternalPackages`, which the X.61 fix deliberately
   removed (Prisma client now direct-imported + traced, engine pinned via
   `PRISMA_QUERY_ENGINE_LIBRARY`). `next.config.mjs` was **not touched** by
   X.62; the assertion is stale from before X.61 and unrelated to the homepage.
5. `pnpm marketplace:verify` (83/83) and `pnpm discovery:verify` (59/59) — PASS.
6. Runtime render (`next start`, port 3100, `http://localhost:3100/`):
   - `/` → HTTP 200, 120,403 bytes, complete RSC stream
     (`B:0` template = 1, `$RC("B:0","S:0")` swap = 1, `S:0` container complete)
     — identical structure to the working `/marketplace`; the boundary
     completes synchronously so **no spinner can persist**.
   - All seven data sections render server-side.
   - All obsolete strings absent from the HTML: "once integration ships",
     "Loading live agents", "Waiting for registry sync", "Synced from 8004scan
     once live", "awaiting registry sync", "Populated after registry sync",
     "ready for future 8004scan integration", "live feed".
   - `app/loading.tsx` is the shared root loading UI used by **all** dynamic
     routes (including `/marketplace`); it is not homepage-specific and
     resolves via the stream swap — left unchanged.
   - `/marketplace` → HTTP 200, unchanged structure (B:0 = 1, swap = 1), same
     honest states as before.
   - Local runs without an env file, so the homepage exercised the honest
     `missing-key` path (no `8004SCAN_API_KEY` locally); the live-data path is
     the exact same loader verified in production by the earlier
     `marketplace:live:verify` / `discovery:live:verify` sessions and the
     current production homepage.

## Notes / follow-ups

- No fabrication was introduced; no metrics, APY, health factors, agent
  statistics, or activity beyond the 8004scan surface.
- The homepage and `/marketplace` now share one honest data philosophy; if a
  session-level "activity/hires" feed is ever implemented, `RecentActivity` is
  the single place to wire it.
- The stale X.50 check 24 assertion should be updated in a future session that
  owns `next.config.mjs` policy (out of X.62 scope).