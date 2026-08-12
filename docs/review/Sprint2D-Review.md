# Sprint 2D — Navigation & Routing Review

**Scope:** Implement the application navigation + routing layer only. Sprint 2B (Marketplace) and Sprint 2C (Agent Details) UI are FROZEN and were not redesigned. No blockchain, registry, backend, wallet, API, or fake data. No design-system, homepage, typography, color, spacing, card, badge, or loading-state changes.
**Result:** ✅ Complete. `pnpm lint` · `pnpm typecheck` · `pnpm build` all green. 4 navigation screenshots captured.

---

## 1. Files changed

| File                                                     | Change                                                                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/agent-slug.ts`                             | **New.** Pure string helpers: `slugify`, `titleFromSlug`, `agentHref`, `isValidSlug`. Dependency-free; no data.                                                                         |
| `apps/web/app/(app)/agents/[slug]/page.tsx`              | `generateMetadata` (dynamic title/description from slug); `isValidSlug` guard → `notFound()` for malformed slugs.                                                                       |
| `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` | Back button now uses `router.back()` with `/marketplace` fallback (never Home); title derived via shared `titleFromSlug`. **No UI/markup/style change** to any section.                 |
| `apps/web/app/(app)/marketplace/page.tsx`                | URL-state sync for search/sort/view/density/filters via search params; `<Suspense>` wrapper for `useSearchParams`. **No UI/markup/style change** — same frozen components, same layout. |

No other files touched. Design system, homepage, breadcrumbs component, not-found page, and all frozen UI are unchanged.

---

## 2. Navigation implemented

- **Marketplace → Agent Details:** routing plumbing added via `agentHref(name)` (`"Momentum Rebalancer"` → `/agents/momentum-rebalancer`). Real `AgentCard`s will call this once live data exists.
  - **SkeletonAgentCards remain disabled & non-clickable** — no `onClick`, no anchor, no `href` was added to skeletons; they stay inert until registry data exists. No fake agents were invented.
- **Back navigation (§4):** the in-page "Back to Marketplace" control uses browser history when available (`window.history.length > 1` → `router.back()`), otherwise falls back to `router.push("/marketplace")`. It **never** navigates to Home. Appearance is byte-identical (same classes/icon/label); only the element changed from `<Link>` to `<button type="button">`.
- **Breadcrumbs (§3):** reuse the existing `Breadcrumbs` component. Marketplace → `Home > Marketplace`; Agent → `Home > Marketplace > <Title>`. The current page renders with `aria-current="page"` (unchanged component behavior).

## 3. Dynamic routing (§2)

- Route `app/(app)/agents/[slug]/page.tsx` reads `params.slug`, derives the display title via `titleFromSlug` (`momentum-rebalancer` → `Momentum Rebalancer`). No hardcoded agent names.
- **Metadata (§11):** `generateMetadata` returns
  `title: { absolute: "Momentum Rebalancer | Agent Studio Marketplace" }` (uses `absolute` to bypass the root layout title template so it matches the spec exactly) and `description: "Agent details for Momentum Rebalancer."` Verified in served HTML.
- **Not found (§12):** malformed slugs (not matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`) call `notFound()`, rendering the existing app `not-found.tsx`. No custom 404 was built. (With no registry, well-formed slugs still render the honest pending detail page — data-driven not-found arrives with registry integration.)

## 4. URL state (§5)

Marketplace toolbar/filter state is mirrored to the URL search params so it survives navigation and is shareable:

| State                                                         | Param                                                                     | Notes                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| Search                                                        | `q`                                                                       | omitted when empty                |
| Sort                                                          | `sort`                                                                    | omitted when default (`featured`) |
| View                                                          | `view`                                                                    | omitted when `grid`               |
| Density                                                       | `density`                                                                 | omitted when `comfortable`        |
| Category / Verification / Risk / Protocol / Activity / Status | `category` / `verification` / `risk` / `protocol` / `activity` / `status` | comma-separated multi-select      |
| Registry                                                      | `registry`                                                                | single value                      |
| Builder toggle                                                | `builder=verified`                                                        | boolean                           |

- Example: `/marketplace?q=yield&view=list&category=Rebalancing`.
- State is **initialized from the URL** on mount (lazy `useState` snapshot) and **written back** via `router.replace(..., { scroll: false })` (no new history entry, no scroll reset). Values are validated against the allowed facet sets, so junk params are ignored.
- Returning from an agent restores search / sort / view / filters from the URL.

## 5. Scroll restoration (§6)

- Relies on the Next.js App Router's built-in scroll restoration for back/forward navigation; the URL-sync uses `{ scroll: false }` so it never forces a jump to top. Navigating **into** an agent scrolls to the top of the detail page (expected); pressing **Back** restores the previous marketplace scroll position. No manual scroll hacks, no new dependencies.

## 6. Hero actions (§7)

- **Favorite** — temporary local `useState` toggle only (no persistence, no backend).
- **Share** — copies the current URL to the clipboard (browser API), with a transient "Copied" state.
- **Compare** — remains a local placeholder toggle; no backend, no persistence. (UI unchanged from frozen 2C.)

## 7. Related agents (§8)

- Related cards **remain skeletons** — no fake names, no fake metrics. When live cards exist they will reuse the same `agentHref` routing. Unchanged this sprint.

## 8. Empty / loading (§9, §10)

- Existing empty states and skeleton loading are unchanged; only navigation actions (Back to Marketplace) are wired. No spinners added, no API requests.

## 9. Accessibility verification (§13)

- **Breadcrumbs** expose `aria-current="page"` on the active crumb (existing component).
- **Back button** is a real `<button>` — keyboard focusable, Enter/Space activate, `focus-visible` ring preserved; label "Back to Marketplace".
- **Hero actions** keep persistent `aria-label`s and `aria-pressed` (from 2C RC2/RC3); focus order unchanged.
- **Future clickable cards:** `agentHref` is designed to back a real anchor/`role="link"` with Enter/Space/Tab support; skeletons stay non-interactive so there is no misleading focusable target now.
- No focus traps introduced; DOM order unchanged.

## 10. Responsive verification

Screenshots (dark, deviceScaleFactor 2, full page) in `docs/review/screenshots/`:
`navigation-marketplace-desktop.png`, `navigation-marketplace-mobile.png`, `navigation-agent-desktop.png`, `navigation-agent-mobile.png`.

- Marketplace shown with URL state applied (`?q=yield&sort=featured&view=grid&category=Rebalancing`) on desktop + mobile — layout unchanged, no horizontal scroll.
- Agent detail on desktop + mobile — unchanged frozen UI; Back button and breadcrumbs present.

## 11. Performance observations (§14)

- **No new dependencies** (no Redux/Zustand); only `next/navigation` hooks already in the framework.
- `/marketplace` stays **prerendered static** (○) — the `useSearchParams` consumer is isolated under `<Suspense>`, so the route did not become fully dynamic. Size 4.71 kB / 158 kB First Load (was 4.07 kB / 157 kB): +~0.6 kB from URL-state serialization logic — negligible, no new libraries.
- `/agents/[slug]` remains `ƒ (Dynamic)` (expected for `generateMetadata` + `notFound`), 11.5 kB / 126 kB.
- Shared First Load JS unchanged at 102 kB.

| Gate             | Result         |
| ---------------- | -------------- |
| `pnpm lint`      | ✅ 12/12 pass  |
| `pnpm typecheck` | ✅ 12/12 pass  |
| `pnpm build`     | ✅ 19/19 pages |

Runtime checks on the served build confirmed: URL-state route returns 200, agent `<title>` = `Momentum Rebalancer | Agent Studio Marketplace`, description = `Agent details for Momentum Rebalancer.`

## 12. Build note (non-blocking)

- On Windows, a leftover standalone preview server can hold a lock on `.next` and stall `next build`. Stop any running preview server before building. (No code impact.)

## 13. Final recommendation

✅ **APPROVED.** The navigation & routing layer is complete: dynamic `/agents/[slug]` routing with derived titles and dynamic metadata, breadcrumbs with `aria-current`, history-aware Back (with `/marketplace` fallback, never Home), URL-persisted marketplace state (search/sort/view/filters) that survives the agent round-trip, browser scroll restoration, and a `notFound()` guard rendering the existing not-found page. Skeletons stay non-clickable, no fake data, and all frozen 2B/2C UI, the design system, and the homepage are untouched.

**Stop. Do not begin Sprint 3. No ERC-8004, Altana, Compare, or Dashboard work.**
