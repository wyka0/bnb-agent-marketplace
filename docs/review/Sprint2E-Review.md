# Sprint 2E — Compare Page Review

**Status:** Implemented · Validated · Screenshots captured
**Scope:** `/compare` page, reusing the Marketplace Design System. No redesign, no backend, no APIs, no wallet, no registry.

## Files created

- `apps/web/app/(app)/compare/compare-view.tsx` — the full client Compare view.
- Rewritten `apps/web/app/(app)/compare/page.tsx` — server page wrapper exporting static metadata.

## Files modified

- `apps/web/app/(app)/compare/page.tsx` — replaced the placeholder (was a bare EmptyState) with a wrapper rendering `CompareView`.

## What was built

Assembled purely from existing Design System exports (`@bnb-marketplace/ui`) — no edits to any component, token, badge, or layout file.

- **Hero** — `Breadcrumbs` (Home / Marketplace / Compare) + `MarketplaceHeader` "Compare Agents" + subtitle.
- **Compare toolbar** (`StickyToolbar` + `SearchToolbar` + `SearchInput`) — reusable marketplace search (state only, no querying) and a live `N of 3 slots` counter.
- **Compare slots** — 3 columns (1-col mobile) of slot cards, each: skeleton via `SkeletonAgentCard`, a `PendingHint "Pending Registry Sync"`, a Remove button, an Add-Agent placeholder (disabled, with title explaining it arrives with registry sync). Removing all 3 slots reveals the empty state.
- **Comparison table** — existing `Table`; columns Feature / Agent A / B / C; rows Category, Builder, Verification, Risk, Capabilities, Protocols, Permissions, Performance, Pricing, Registry, Status, Reviews, Activity. Every cell is an honest pending placeholder: em-dash `Dash`, `PendingChip`, `BuilderBadge unknown-builder`, `MarketplaceVerificationBadge pending`, `RegistryBadge waiting`, `StatusBadge coming-soon`.
- **Mobile/tablet** — comparison matrix is a real `Table` (scrollable wrapper) on `md+`; on mobile it swaps to vertical stacked detail cards. No horizontal page overflow (verified `document.scrollWidth <= clientWidth`).
- **Capabilities** — per-slot cards of pending skeleton capability/protocol chips.
- **Permissions** — per-slot permissions mini-tables (Action / Scope / Access) with `PendingChip` access (replicated from whole screen details styling, assembled from the DS `Table`).
- **Performance** — per-slot metric cards using `Skeleton` tiles for Tasks / Uptime (30d) / Success rate / Avg. latency.
- **Pricing** — per-slot Standard/Pro/Enterprise pricing cards, all em-dash + `StatusBadge coming-soon`.
- **Trust & Verification** — per-slot badge rows reusing `MarketplaceVerificationBadge` (pending), `BuilderBadge` (unknown-builder), `RegistryBadge` (waiting), `PendingChip` (risk), `StatusBadge` (coming-soon), `ReputationBadge` (unknown).
- **Empty state** — `MarketplaceEmptyState` "No agents selected" with primary `Button` → `Browse Marketplace` (verticadel-free).
- **Footer** — in-page footer: registry disclaimer + `Button` "Back to Marketplace" linking to `/marketplace`. App Shell footer (via `DashboardShell`) unchanged.

No fake numbers, metrics, prices, uptime, success rates, builders, or reviews. Every live value is `—` / `Pending` / `Waiting` / `Coming Soon` / a Skeleton.

## Validation

- `pnpm lint` — 12/12 tasks successful
- `pnpm typecheck` — 12/12 tasks successful (2 type fixes during implementation: `SLOT_NAMES[index]` tuple indexing, `slots[index] ?? false`)
- `pnpm build` — 7/7 tasks successful

## Bundle size

- `/compare` — page 7.79 kB, First Load JS 158 kB (prev placeholder 853 B / same first-load; grew because real page content now ships as part of the route chunk)
- No shared chunk regressions.

## Screenshots

`docs/review/screenshots/`:

- `compare-final-desktop.png` (1440×900, full page)
- `compare-final-tablet.png` (1024×768)
- `compare-final-mobile.png` (390×844)
- `compare-empty-final-desktop.png` (empty state after removing all 3 slots)

## Frozen-sprint confirmation

No modifications to:

- Marketplace page, Agent Details page, Navigation, Sidebar, Header, Footer, Design System (components/tokens/typography/colors/shadows/borders/animations), existing routing behavior, database, or any existing route other than `/compare`.
- Verified: the only files under `apps/web/app/(app)/compare/` changed; `packages/ui` untouched (build was cache hit).

Sprint 2E complete. Sprint 2F not started.
