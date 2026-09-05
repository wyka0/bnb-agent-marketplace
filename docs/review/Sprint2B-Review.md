# Sprint 2B — Marketplace Framework — Review

**Route:** `/marketplace` (`apps/web/app/(app)/marketplace/page.tsx`)
**Objective:** Assemble the Marketplace page from the existing design system only. Production-ready shell before live data exists.
**Result:** ✅ Complete. `lint` · `typecheck` · `build` all green. Desktop / Laptop / Tablet / Mobile screenshots captured.

No new design-system components were created. No search / compare / API / 8004scan / details / dashboard / Altana / PancakeSwap logic was built (per STOP list).

---

## 1. Implemented components (all pre-existing, assembled only)

| Area    | Components used (from `@bnb-marketplace/ui`)                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout  | `MarketplaceContainer`, `MarketplaceHeader`, `MarketplaceLayout`, `MarketplaceSidebar`, `MarketplaceContent`, `MarketplaceGrid`                                      |
| Toolbar | `StickyToolbar`, `SearchToolbar`, `SearchInput`, `ResultCounter`, `SortDropdown`, `ViewToggle`, `GridToggle`, `ActiveFilterBar`, `FilterBadge`, `ResetFiltersButton` |
| Filters | `FilterSidebar`, `FilterSection`, `FilterGroup`, `FilterCheckbox`, `FilterChip`, `FilterRadio`, `FilterToggle`                                                       |
| States  | `SkeletonAgentCard` (×12), `WaitingHint`, `NoAgents`                                                                                                                 |
| Shared  | `Pagination`, `Button`, `Modal`/`ModalTrigger`/`ModalContent`/`ModalHeader`/`ModalTitle`/`ModalDescription`                                                          |
| App     | `Breadcrumbs` (existing app component)                                                                                                                               |

### Mapping to the sprint spec

- **Header** — `MarketplaceHeader` with title **"Marketplace"**, subtitle **"Discover verified autonomous AI agents on BNB Chain."**, right-side `ResultCounter` (loading) + `ViewToggle` + `SortDropdown`.
- **Search Toolbar** — `SearchInput`, `SortDropdown`, `ViewToggle`, `GridToggle`, `ResultCounter`, plus `FilterBadge` + `ResetFiltersButton` in the `ActiveFilterBar`. Wrapped in `StickyToolbar` (sticky under the app `TopNav`, `offset={64}`).
- **Filter Sidebar** — `FilterSidebar` with all 8 sections in UX-Blueprint priority order: **Category → Verification → Risk → Protocols → Builder → Registry → Activity → Status**. Every control is interactive UI-only (local `useState`, no backend). Category uses the four equal-priority product categories from TIS §10 (Rebalancing, Grid Trading, Yield Optimization, Health Factor).
- **Main Grid** — `MarketplaceGrid` renders **12 `SkeletonAgentCard`s**. No invented agents, names, or metrics. A `WaitingHint` banner reads **"Waiting for ERC-8004 Registry"**.
- **Empty state** — `NoAgents` (the `EmptyMarketplace` preset) wired for the zero-row branch (not shown while skeletons render).
- **Loading** — skeleton grid is the loading representation (`LoadingGrid` equivalent = `MarketplaceGrid` + `SkeletonAgentCard`, wrapped in a `role="status"` region).
- **Pagination** — existing `Pagination`, **page 1, disabled** (`totalPages={1}`, no-op `onPageChange`).
- **Mobile filters** — `Modal` drawer holding the same `filterPanel` (single source of truth, shared with desktop sidebar).

### Naming reconciliation (spec → design system)

The spec used a few aliases that map to existing exports; no new components were made:

| Spec name                                           | Assembled with                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `EmptyMarketplace`                                  | `NoAgents` / `MarketplaceEmptyState` preset                                  |
| `LoadingGrid`                                       | `MarketplaceGrid` + `SkeletonAgentCard` in a `role="status"` region          |
| `SkeletonAgentCard` "Waiting for ERC-8004 Registry" | `SkeletonAgentCard` ×12 + `WaitingHint text="Waiting for ERC-8004 Registry"` |

> Note: `ViewMode` is not re-exported from the UI barrel, so the page declares a local `type ViewMode = "grid" | "list"` inline rather than modifying the design system.

---

## 2. Responsive validation

Screenshots in `docs/review/screenshots/`:

| Breakpoint         | File                            | Grid columns            | Sidebar                                              |
| ------------------ | ------------------------------- | ----------------------- | ---------------------------------------------------- |
| Desktop (1440×900) | `marketplace-final-desktop.png` | 4 (compact density, xl) | Left sticky sidebar                                  |
| Laptop (1280×800)  | `marketplace-final-laptop.png`  | 3–4 (xl boundary)       | Left sticky sidebar                                  |
| Tablet (834×1112)  | `marketplace-final-tablet.png`  | 2 (sm)                  | Collapses → "Filters" drawer button; toolbar remains |
| Mobile (390×844)   | `marketplace-final-mobile.png`  | 1                       | Drawer filters (Modal); toolbar stacked              |

Grid column behavior is driven by `MarketplaceGrid density="compact"`: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` — satisfying the required **Desktop 4 / Laptop 3 / Tablet 2 / Mobile 1** progression. The sidebar is `hidden lg:block`; below `lg` the "Filters" `Modal` drawer supplies the identical panel. The `StickyToolbar` stacks its search over actions below `sm`.

All routes still build; `/marketplace` prerenders as static (○), 3.9 kB page / 157 kB First Load JS.

---

## 3. Accessibility validation

Inherited from the design-system components + page wiring:

- **Keyboard navigation** — all controls are native `button`/`input`/`label`; `FilterSection` headers are real buttons with `aria-expanded`/`aria-controls`; the `Modal` drawer traps focus (Radix Dialog).
- **Focus order** — DOM order is breadcrumb → header → sticky toolbar → active filters → content → sidebar (content precedes sidebar in `MarketplaceLayout` source order for logical reading), then pagination.
- **ARIA** —
  - `SearchInput` has an associated visually-hidden `<label>` and `role="searchbox"`.
  - `ResultCounter` is `aria-live="polite"`.
  - `ViewToggle` / `GridToggle` buttons use `aria-pressed`; `FilterChip` uses `role="checkbox"` + `aria-checked`; `FilterToggle` uses `role="switch"`; `FilterRadio` group uses `role="radiogroup"`.
  - The skeleton grid is wrapped in `role="status"` + `aria-label="Waiting for ERC-8004 registry data"` with an `sr-only` announcement; individual `SkeletonAgentCard`s are `aria-hidden`.
  - `FilterBadge` remove buttons and the mobile "Open filters" button carry descriptive `aria-label`s.
- **Reduced motion** — the only motion is `animate-pulse` (skeletons, `WaitingHint`) and short `transition-*`; no essential meaning is motion-only (every animated element has text). App-level `prefers-reduced-motion` handling remains a global concern.
- **Contrast / touch targets** — inherited BNB-gold token palette (AA) and ≥32–40px control heights from the design system.

---

## 4. Quality gates

| Check     | Command                                        | Result                       |
| --------- | ---------------------------------------------- | ---------------------------- |
| Lint      | `pnpm --filter @bnb-marketplace/web lint`      | ✅ pass                      |
| Typecheck | `pnpm --filter @bnb-marketplace/web typecheck` | ✅ pass                      |
| Build     | `pnpm --filter @bnb-marketplace/web build`     | ✅ pass (19/19 static pages) |

**Data honesty:** no fake agents, names, or metrics anywhere. `ResultCounter` renders in `loading` mode (no fabricated count). The grid shows only skeletons + an explicit "Waiting for ERC-8004 Registry" banner. Everything maps to a future 8004scan field (documented in page comments).

---

## 5. Known blockers

1. **`next start` vs `output: standalone`** — the app's `next.config.mjs` uses `output: "standalone"`, so `next start` warns and won't serve; screenshots were captured against the standalone server via the built output on port 3210. Not a page defect; noted for the review pipeline (use `node .next/standalone/server.js` or `next dev` for local runs).
2. **`ViewMode` type not exported** from `@bnb-marketplace/ui` — worked around with a local type alias to avoid modifying the frozen design system. Optional future polish: re-export `ViewMode`/`GridDensity` from the toolbar barrel.
3. **Playwright not a repo dependency** — Chromium + `playwright-core` were installed on-demand (temp dir) to capture screenshots. Consider adding a dev-only screenshot script to the repo for repeatable QA.
4. **No live counts on filters** — filter option counts are intentionally omitted (would require registry data); they are ready to accept a `count` prop when 8004scan lands.

None of these block Sprint 2C.

---

## 6. Readiness for Sprint 2C

The framework is a clean seam for the next sprint:

- **Grid swap-in** — replace the 12 `SkeletonAgentCard`s with `AgentCard[]` mapped from 8004scan results; the `MarketplaceGrid` + `view`/`density` wiring already exists.
- **Result counting** — `ResultCounter` already reads `count`/`total`/`loading`; flip `loading` off and pass real numbers.
- **Filter application** — filter `useState` and the derived `activeFilters`/`FilterBadge` chips are in place; Sprint 2C connects them to query logic (still no UI work needed).
- **Empty / offline** — `NoAgents` is wired for zero rows; `RegistryOffline` / `LoadingRegistry` presets are available for the registry states.
- **Pagination** — swap the static `page=1/totalPages=1` for real values + a handler.

**Verdict:** ✅ **Marketplace Framework complete and ready for Sprint 2C (data integration).** Stop here per sprint instructions.
