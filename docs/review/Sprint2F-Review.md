# Sprint 2F — Leaderboards (Phase 2) Review

**Status:** Complete (UI-only)
**Route:** `/leaderboards`
**Blueprint:** `docs/ux/Leaderboards-UX-Blueprint.md` (frozen)
**Date:** 2026-08-08

## Summary

Replaced the 24-line stub `apps/web/app/(app)/leaderboards/page.tsx` with a full
Leaderboards page that reuses **only existing** `@bnb-marketplace/ui` components
and the app-local `@/components/breadcrumbs`. No new badge / icon / color /
routing / state primitives were added to the Design System. No data is fabricated:
the default state is an honest **registry-pending** view (8 skeleton rows +
`WaitingHint` + `RegistryBadge`), and all ranks/metrics render as `—` until the
ERC-8004 Registry is connected.

## Build gates

| Gate      | Command          | Result                                               |
| --------- | ---------------- | ---------------------------------------------------- |
| Lint      | `pnpm lint`      | 12/12 packages clean                                 |
| Typecheck | `pnpm typecheck` | 12/12 packages clean (web `tsc --noEmit` 0 errors)   |
| Build     | `pnpm build`     | 7/7 packages built; Next.js 15.5.23, 19 static pages |

`/leaderboards` prerendered as static (○): **9.44 kB**, First Load **159 kB**.

## Files changed (scope guard)

| Path                                       | Change                             |
| ------------------------------------------ | ---------------------------------- |
| `apps/web/app/(app)/leaderboards/page.tsx` | Rewritten from stub → full UI page |
| `packages/ui/**`                           | **Untouched**                      |
| `apps/web/app/(app)/compare/**`            | Untouched (frozen 2E)              |
| `docs/ux/Leaderboards-UX-Blueprint.md`     | Untouched (frozen)                 |

All other sprints (2B marketplace, 2C agent details, 2D nav/app-shell, 2E compare)
remain exactly as released in their RC revisions.

## Components reused (zero new primitives)

All from `@bnb-marketplace/ui` (root re-export) + `@/components/breadcrumbs`:

- **Layout:** `MarketplaceContainer`, `MarketplaceHeader`, `MarketplaceLayout`, `MarketplaceSidebar`, `MarketplaceContent`
- **Filters:** `FilterSidebar`, `FilterSection`, `FilterGroup`, `FilterChip` (category), `FilterRadio` (metric / network / time / sort)
- **Toolbar:** `StickyToolbar`, `SearchToolbar`, `SearchInput`, `SortDropdown`, `ActiveFilterBar`, `FilterBadge`, `ResetFiltersButton`
- **States / empty:** `WaitingHint`, `LoadingRegistry`, `RegistryOffline`, `NoSearchResults`, `NoAgents`, `MarketplaceEmptyState`
- **Skeletons:** `Skeleton`
- **Table:** `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- **Badges:** `RegistryBadge`, `StatusBadge` (imported; `RiskBadge`/`VerificationBadge` available for future row data)
- **Primitives:** `Pagination`, `Button`

## Routing & URL state

- **Route:** `/leaderboards` (canonical shape per blueprint).
- **Persisted params:** `q` (search), `metric`, `category` (comma-set), `time`.
  The default values (`metric=registry-score`, `time=all-time`) are **omitted**
  from the URL to keep it clean — mirroring the marketplace page's
  `DEFAULT_SORT` omission convention.
- **Ephemeral UI-only state** (not in the URL, per the frozen blueprint which
  lists only `metric`/`category`/`time`): `network`, `sort` direction.
- **Metric switch preserves filters** (verified): starting from
  `?metric=reputation&category=yield&time=7d` and switching the metric radio to
  "Registry Score" produced `?category=yield&time=7d` — `category` and `time`
  survived, and `metric` was dropped because `registry-score` is the default.

## Default state — honest, no fake data

- `viewState = "loading"` → renders the **8-column table skeleton** on desktop
  (`LeaderboardTableSkeleton`) and **8 card skeletons** on mobile.
- Toolbar status slot: `<WaitingHint text="Waiting for ERC-8004 Registry" />`.
- Section header: `RegistryBadge state="waiting"` + subtitle stating the active
  metric.
- Columns match the blueprint exactly:
  **Rank · Agent · Category · Protocol · Active Metric · Risk · Verification · Freshness**.
- Ranks are ordinal (`1/2/3/…`/`—`) — no 0–100 score, per §8 of the blueprint.
- Verified in QA: `fakeRankMarkers=0` (no fabricated "Rank #" labels).

## Methodology (§5 / §13)

A native `<details>` disclosure (no new DS primitive) explains the ranking
order and tie-break cascade:
`verification → risk → reputation → activity → freshness`.

## Responsive verification (7 viewports)

| Viewport | Key          | scrollWidth = clientWidth | Overflow |
| -------- | ------------ | ------------------------- | -------- |
| 1440     | desktop      | 1440 = 1440               | none     |
| 1280     | desktop-1280 | 1280 = 1280               | none     |
| 1024     | laptop       | 1024 = 1024               | none     |
| 834      | tablet-834   | 834 = 834                 | none     |
| 768      | tablet-768   | 768 = 768                 | none     |
| 390      | mobile-390   | 390 = 390                 | none     |
| 320      | mobile-320   | 320 = 320                 | none     |

Desktop ≥768px renders the responsive `<Table>` (DS `overflow-auto` wrapper);
mobile <768px renders card rows via `md:hidden`/`md:block` splits. The filter
sidebar collapses to a `lg:hidden` drawer button (`role="button" name="Open filters"`)
below `lg`.

## Accessibility

- `Breadcrumbs` trail (`Home → Leaderboards`) via app-local component.
- `role="status"` + `aria-label` on loading/empty regions (inherited from DS
  `MarketplaceEmptyState`/`WaitingHint`).
- `sr-only` live status text describing pending slot count.
- `FilterRadio` `role="radiogroup"` labels, `FilterChip` `role="checkbox"`,
  `ActiveFilterBar` `role="region" aria-label="Active filters"`,
  `ResetFiltersButton` with accessible aria-label.
- `details`/`summary` native disclosure for methodology (keyboard + a11y native).
- Touch targets ≥40px (radio labels, chip taps, drawer button).

## Error / edge states (UI-only, wired but not user-reachable yet)

`renderBody()` switches on `viewState` and renders honest UI-only banners for:

| State        | Rendered component                      | Recovery CTA    |
| ------------ | --------------------------------------- | --------------- |
| `no-results` | `NoSearchResults`                       | "Clear filters" |
| `no-data`    | `NoAgents`                              | —               |
| `offline`    | `RegistryOffline`                       | "Retry"         |
| `no-metric`  | `MarketplaceEmptyState` (Database icon) | —               |

These are implemented and import-valid but not reachable from user interaction
because the page performs **no data fetching** (by design — Sprint 2F is
UI-only). They become reachable once the ERC-8004 registry integration replaces
the `const viewState: ViewState = "loading"` default with real state.

## Integration blockers (for the data sprint)

1. **No data source.** Ranks/metrics are `—`; the table/cards are skeletons.
   Wire `viewState` to the 8004scan response to unlock real rows.
2. **`useSearchParams` + `Suspense fallback={null}`** means the **prerendered
   SSR HTML is shell-only** (page content hydrates client-side) — identical to
   the marketplace page pattern, so this is consistent and safe.
3. **Standalone `server.js` requires `.next/static`** to be copied into
   `apps/web/.next/standalone/apps/web/.next/static` for local serving. Without
   it, responsive Tailwind classes and hydration chunks 404 and the page renders
   as the bare layout shell (this was reproduced and fixed during QA).
4. **`network` filter is ephemeral** (not persisted to URL) per the frozen
   blueprint; consider persisting it in a follow-up if deep-linking is desired.

## Unresolved blueprint questions (§20)

- §20 Q3 (rank-1 gold accent): implemented via an existing amber ring token
  (`ring-amber-400/30`) on the rank-1 `<TableRow>` rather than a new gold
  CSS variable — please confirm this satisfies the "existing DS token"
  constraint.
- §20 Q7 (error-toast vs inline): chosen inline banners (`RegistryOffline` etc.).
  Confirm inline is preferred over a toast for this surface.

## Screenshots

`docs/review/screenshots/leaderboards-*.png` (dark color scheme):

- `leaderboards-desktop.png` (1440) — full layout: breadcrumbs, header, sticky
  toolbar with WaitingHint, active-filter row, 8-column table skeleton, methodology.
- `leaderboards-desktop-1280.png`, `leaderboards-laptop.png` (1024) —
  sidebar collapses at `lg` boundary; table still visible.
- `leaderboards-tablet-834.png`, `leaderboards-tablet-768.png` —
  sidebar → drawer button; table becomes scrollable, no overflow.
- `leaderboards-mobile-390.png`, `leaderboards-mobile-320.png` —
  card skeletons (8), drawer filter button, toolbar stacked, no horizontal overflow.

## QA script

Re-runnable from `<temp>/opencode/capture-2f.js`
(starts the standalone server, hits `/leaderboards`, asserts 200 + 0 overflow
across 7 viewports, verifies metric-switch preserves filters, then shuts down).
