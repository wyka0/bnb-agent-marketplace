# Sprint 2B — RC1 — Marketplace Refinement Review

**Scope:** Refinement of the existing Sprint 2B Marketplace to match the frozen `Marketplace-UX-Blueprint.md`. No new features, no APIs, no search/compare logic, no 8004scan, no design-system changes, no fake data.
**Result:** ✅ Complete. `lint` · `typecheck` · `build` all green. Desktop / Laptop / Tablet / Mobile screenshots captured.

Files touched (assembly + app-shell branding only):

- `apps/web/components/brand-logo.tsx` — **new** shared branding component (single source of truth).
- `apps/web/components/top-nav.tsx` — branding parity with Homepage; removed "BMS" + `/login` "Connect".
- `apps/web/components/home/home-nav.tsx` — now consumes shared `BrandLogo` (de-duplicated).
- `apps/web/components/sidebar.tsx` — reduced app-nav visual weight; hidden below `xl`.
- `apps/web/app/(app)/marketplace/page.tsx` — single toolbar, one sort control, per-card pending state, tighter balance.

No design-system files were modified.

---

## 1. Issues fixed

| #   | Fix                               | What changed                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Marketplace first**             | App-nav `Sidebar` weight reduced (transparent bg, `border-border/50`, lighter labels, `w-52`, smaller type) and now only shows at `xl`. Below `xl` the marketplace's own content leads. Nav is **not removed**.                                                                                                             |
| 2   | **Remove duplicate sort**         | The header no longer renders a `SortDropdown`. Exactly **one** Sort control remains, in the toolbar (`Sort ▼ …`).                                                                                                                                                                                                           |
| 3   | **Cohesive search toolbar**       | One `StickyToolbar` row: Search · Result Count · Sort · View · Grid/List; `ActiveFilterBar` (chips + Reset) sits directly beneath. Stacks gracefully on tablet/mobile via `SearchToolbar`'s `sm:flex-row`.                                                                                                                  |
| 4   | **Filter sidebar = filters only** | Unchanged frozen order (Category → Verification → Risk → Protocols → Builder → Registry → Activity → Status), collapsible `FilterSection`s, existing DS components. No app-nav inside the filter panel.                                                                                                                     |
| 5   | **Agent grid**                    | 12 `SkeletonAgentCard`s (Agent Card System), each overlaid with a **"Pending Registry Sync"** `PendingHint`. A **"Waiting for ERC-8004 Registry"** `WaitingHint` heads the section. No fake names/logos/metrics/reputation/protocols.                                                                                       |
| 6   | **Visual balance**                | Header padding tightened (`py-4`), a bordered "Agents" section header introduces the grid, denser default grid, less dead space — the grid reads as "where agents live."                                                                                                                                                    |
| 7   | **Consistency**                   | Reuses homepage tokens (typography, radius, elevation, hover, BNB-gold). No new visual styles introduced.                                                                                                                                                                                                                   |
| 8   | **Branding consistency**          | "BMS" badge removed. `TopNav` uses the identical gold "B" mark + "Agent Studio / MARKETPLACE" wordmark, `h-16` header, same nav-link style, `Search` icon, `ThemeToggle`, and the **"Connect Wallet · Coming Soon"** disabled chip — all matching the Homepage. Extracted to a shared `BrandLogo` so future pages reuse it. |
| 9   | **Layout continuity**             | Same header height, branding, typography, spacing, palette, buttons, and backdrop-blur treatment across `HomeNav` and `TopNav`; entering `/marketplace` now reads as entering the _app_, not a new site.                                                                                                                    |
| 10  | **Agent-card hierarchy**          | Page reads Search → Filters → Agent Cards → Pagination. Cards are the primary content; toolbar + sidebar support them.                                                                                                                                                                                                      |
| 11  | **Responsive quality**            | `MarketplaceGrid` → Mobile 1 / Tablet 2 / Laptop 3 / Desktop 4. No horizontal scroll; equal gap spacing.                                                                                                                                                                                                                    |
| 12  | **Accessibility**                 | Semantic `h1`/`h2`; `role="status"` + `sr-only` count on the pending grid; `aria-current` on active nav; existing DS ARIA (search, chips, toggles, radios); visible focus rings; reduced-motion-safe (pulse only); ≥40px targets.                                                                                           |
| 13  | **Performance**                   | No new dependencies; reused components + animations; `/marketplace` First Load JS **157 kB** (below the 164 kB shared by other routes). Server components kept where possible (nav is server-rendered; only the interactive page + home-nav are client).                                                                    |

---

## 2. Before vs After

| Aspect          | Before (Sprint 2B)                                                            | After (RC1)                                                                                         |
| --------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Header branding | "BMS" badge + "Agent Studio Marketplace", `/login` **Connect** primary button | Gold **B** mark + "Agent Studio / MARKETPLACE", **Connect Wallet · Coming Soon** (matches Homepage) |
| Sort controls   | Two (`Default` in header + `Sort` in toolbar)                                 | **One** (`Sort ▼` in toolbar)                                                                       |
| Toolbar         | Split: counter/view/sort in header, sort/density in toolbar                   | **Single cohesive row** in the sticky toolbar                                                       |
| App side-nav    | `w-60`, solid `bg-card/40`, bold labels, visible at `lg`                      | `w-52`, transparent, light labels, visible at `xl` only                                             |
| Skeleton cards  | 12 skeletons, no per-card status                                              | 12 skeletons, each with **"Pending Registry Sync"** pill                                            |
| Section framing | Loose banner above grid                                                       | Bordered **"Agents"** header + waiting hint; tighter rhythm                                         |
| Feel            | Admin dashboard (2 competing nav rails)                                       | Official marketplace — content-led                                                                  |

---

## 3. Responsive validation

Screenshots in `docs/review/screenshots/`:

| Breakpoint   | File                            | Grid     | Notes                                                |
| ------------ | ------------------------------- | -------- | ---------------------------------------------------- |
| Desktop 1440 | `marketplace-final-desktop.png` | 4 cols   | App rail + filter sidebar + grid; toolbar single row |
| Laptop 1280  | `marketplace-final-laptop.png`  | 3–4 cols | App rail appears at `xl`; filter sidebar + grid      |
| Tablet 834   | `marketplace-final-tablet.png`  | 2 cols   | Filter sidebar → drawer button; toolbar wraps        |
| Mobile 390   | `marketplace-final-mobile.png`  | 1 col    | Filters drawer (Modal); toolbar stacked; no h-scroll |

Grid classes (`MarketplaceGrid density="compact"`): `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` — satisfies the required 1/2/3/4 progression with equal `gap-4`. No horizontal scrolling at any width.

---

## 4. Accessibility validation

- **Semantic headings:** page `h1` ("Marketplace" via `MarketplaceHeader`) → section `h2` ("Agents") → filter `h2` ("Filters") → collapsible section buttons.
- **Keyboard/focus:** tab order breadcrumb → header → toolbar → active filters → sidebar/drawer → grid → pagination; all controls native with visible `focus-visible` rings; `Modal` traps focus.
- **ARIA:** pending grid is `role="status"` + `aria-label` with an `sr-only` "12 agent slots pending registry sync"; nav uses `aria-current="page"`; DS provides `role="searchbox"`, `role="checkbox"`/`switch`/`radiogroup`, `aria-pressed` toggles.
- **Reduced motion:** only `animate-pulse` (skeletons, pending/waiting dots); every animated element also carries text, so meaning is never motion-only.
- **Contrast / targets:** BNB-gold token palette (AA); interactive controls ≥40px; the pending pill uses `bg-primary/10` + primary text for legibility over skeletons.

---

## 5. Performance observations

- `/marketplace`: **4.01 kB** page, **157 kB** First Load JS (was 3.9 kB / 157 kB) — the added single toolbar row + per-card pending pill added ~0.1 kB and **zero** new dependencies.
- Reused existing components/animations only; no animation library added.
- Nav components (`TopNav`, `Sidebar`, `Footer`) remain server components where possible; the page and `HomeNav` are the only client components on this route.
- `/marketplace` still prerenders as **static** (○).

---

## 6. Remaining issues (non-blocking)

1. **`next start` vs `output: standalone`** — screenshots were captured against the standalone server (`node .next/standalone/apps/web/server.js`, static/public copied in). Not a page defect; a build-pipeline note for QA repeatability.
2. **App rail at `xl`** — at ≥1280 the app nav rail + filter sidebar + grid form three columns. This keeps navigation available (per "do not remove nav") while staying content-led; if judges prefer an even cleaner marketplace, a follow-up could collapse the app rail into the TopNav on `/marketplace` specifically. Deferred (out of RC scope).
3. **`ViewMode` not exported from DS** — page keeps a local `type ViewMode` alias to avoid modifying the frozen design system. Optional future polish: re-export from the toolbar barrel.
4. **Playwright is not a repo dependency** — installed on demand for capture. Consider adding a dev-only screenshot script.

None block Sprint 2C.

---

## 7. Final recommendation

✅ **APPROVED.** The Marketplace now leads with content, shares the Homepage's exact branding, has a single cohesive toolbar with one sort control, an agent-card grid where every slot honestly reads "Pending Registry Sync" under a "Waiting for ERC-8004 Registry" banner, and clean 1/2/3/4 responsive behavior. It reads as an official BNB Chain product, not an admin dashboard. A judge opening `/marketplace` immediately understands what it is, how to search, how to filter, where agents live, and that the platform is awaiting live ERC-8004 data.

**Stop here — Sprint 2B RC1 complete.** No 8004scan, backend, compare, wallet, details, dashboard, or partner integrations were implemented.
