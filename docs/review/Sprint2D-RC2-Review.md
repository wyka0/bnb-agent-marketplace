# Sprint 2D RC2 — Navigation & Routing Review

**Status:** SHIPPED (freeze polish only) · **Scope:** 4 spacing-only fixes, ~9 utility-class deltas

## 1. Summary

Sprint 2D RC2 is a freeze-polish release. It makes four tiny spacing refinements to the
already-shipped marketplace and agent-detail pages. No routing, navigation, components,
Design System, typography, colors, shadows, borders, animations, breakpoints, business
logic, state, or data were touched. Total diff: ~10 lines across 2 files.

## 2. Fixes applied

| #   | Surface                                       | File                                                     | Exact utility-class change                                                                | Effect                                                  |
| --- | --------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Active filter bar spacing                     | `apps/web/app/(app)/marketplace/page.tsx`                | `className="mb-4"` → `className="mb-6"` on `<ActiveFilterBar>`                            | +8px clearance below the bar                            |
| 2   | Trust & Verification badge breathing room     | `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` | 5 DS badges gain `className="px-2.5"`; local `Pending` chip gains `className="!px-3"`     | +4px total horizontal padding per badge                 |
| 3   | Performance metric skeleton optical centering | `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` | `<Skeleton className="h-6 w-20" />` → `<Skeleton className="h-6 w-20 translate-y-0.5" />` | skeleton drops 2px, vertically centered under its label |
| 4   | Related Agents heading-to-grid gap            | `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` | `<div className="grid gap-4 ...">` → `<div className="grid -mt-1 gap-4 ...">`             | heading-to-grid spacing tightened 4px                   |

### Fix 2 detail (trust badges — 6 rows)

| Row          | Badge component                     | Change                                           |
| ------------ | ----------------------------------- | ------------------------------------------------ |
| Verification | `MarketplaceVerificationBadge` (DS) | base `px-2` → `px-2.5` (+2px/side) via className |
| Builder      | `BuilderBadge` (DS)                 | base `px-2` → `px-2.5`                           |
| Risk         | local `Pending` chip                | base `px-2.5` → `!px-3` (+2px/side)              |
| Registry     | `RegistryBadge` (DS)                | base `px-2` → `px-2.5`                           |
| Reputation   | `ReputationBadge` (DS)              | base `px-2` → `px-2.5`                           |
| Status       | `StatusBadge` (DS)                  | base `px-2` → `px-2.5`                           |

> The `Pending` chip concatenates class strings (no merge), so `!px-3` (Tailwind v3.4
> important modifier) is used to reliably override its base `px-2.5`. DS badges merge
> `className` via `cn` (tailwind-merge), so plain `px-2.5` wins cleanly.

## 3. Validation

- `pnpm lint` — 12/12 tasks successful (11 cached)
- `pnpm typecheck` — 12/12 tasks successful (11 cached)
- `pnpm build` — 7/7 tasks successful; `/marketplace` stayed static, `/agents/[slug]` dynamic (unchanged)

## 4. Screenshots

`docs/review/screenshots/` (port 3102):

- `navigation-marketplace-desktop.png` — active filter bar (`?q=yield&view=grid&category=Rebalancing`)
- `navigation-marketplace-mobile.png`
- `navigation-agent-desktop.png` (trust badges + perf skeletons + related grid)
- `navigation-agent-mobile.png`

## 5. DOM / computed-style verification

- ActiveFilterBar `margin-bottom: 24px` ✔
- Trust badges: `pl=10px pr=10px` each (DS badges), Risk chip `pl=12px pr=12px` ✔
- Perf skeletons computed `transform: matrix(1,0,0,1,0,2)` (2px translateY) ✔
- Related grid `margin-top: -4px` ✔

## 6. Confirmations (unchanged)

- Routing, navigation, URLs, breadcrumbs, back-button behavior — untouched
- No DS components/layout/typography/color/shadow/animation edit (padding overrides via
  call-site `className` props only)
- No business logic, state, data, or loading-state changes
- No new files
