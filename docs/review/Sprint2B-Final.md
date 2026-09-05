# Sprint 2B — Final Polish Review

**Scope:** Final Sprint 2B polish before Sprint 2C. Copy + micro-styling only. No redesign, no new features, no APIs, no design-system changes, no UX-Blueprint changes, no fake data.
**Result:** ✅ Complete. `lint` · `typecheck` · `build` all green. Fresh Desktop / Laptop / Tablet / Mobile screenshots captured.

Only file changed: `apps/web/app/(app)/marketplace/page.tsx` (page assembly + inline copy/styling). The design system, UX Blueprint, and app shell were not modified.

---

## 1. Changes applied

| #   | Fix                      | Change                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Sort label**           | Default sort selection changed from `default` → **`featured`**, so the control reads **"Sort: Featured"**. Behavior/options unchanged.                                                                                                                                                                              |
| 2   | **Result counter**       | The blank loading placeholder beside Search is replaced with a small muted status: a `Database` icon + **"Waiting for registry"** (`aria-live="polite"`). No fake numbers. Implemented as an inline page helper (`RegistryStatusCount`), not a design-system change.                                                |
| 3   | **Search placeholder**   | Now **"Search by agent name, capability, protocol or category…"** (adds _protocol_, matching future 8004scan search).                                                                                                                                                                                               |
| 4   | **Filter headings**      | Verified the design-system `FilterSection` titles already render at full `text-foreground` + `font-medium` (maximum contrast, medium weight). No change made: increasing further would require a bolder weight (typography change — disallowed) or a design-system edit (disallowed). Documented rather than faked. |
| 5   | **Registry badge**       | The per-card **"Pending Registry Sync"** badge is scaled to **92%** (`scale-[0.92]`, `origin-top-right`). Color, typography, border, and animation are untouched — only visual weight is reduced so it supports the skeleton.                                                                                       |
| 6   | **Registry information** | Added a subtle, non-error informational line under the "Agents / Waiting for ERC-8004 registry" header: **"The marketplace will populate automatically once the ERC-8004 registry is connected."** (muted `text-xs`).                                                                                               |
| 7   | **Microcopy**            | Sentence case + consistent terms (Marketplace, agent, registry, verification, Pending Registry Sync). "Waiting for ERC-8004 Registry" → "Waiting for ERC-8004 registry"; removed the redundant "Live agent data connects in a later sprint." span in favor of the clearer helper line.                              |
| 8   | **Visual consistency**   | Section header restructured for cleaner vertical rhythm (heading + hint on one row, helper beneath); toolbar/pagination/filter/skeleton spacing and hover/focus states left on their existing design-system values (already consistent).                                                                            |

---

## 2. Before vs After

| Element            | Before (RC1)                                                | After (Final)                                                                                       |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Sort control       | "Sort: Default"                                             | **"Sort: Featured"**                                                                                |
| Beside search      | Blank pulsing placeholder                                   | **⛁ Waiting for registry** (muted, `aria-live`)                                                     |
| Search placeholder | "Search agents by name, capability, or category…"           | "Search by agent name, capability, **protocol** or category…"                                       |
| Pending badge      | 100% scale                                                  | **92% scale** (same color/type/border/animation)                                                    |
| Section status     | Heading + hint + right-aligned "connects in a later sprint" | Heading + hint + **helper: "will populate automatically once the ERC-8004 registry is connected."** |
| Waiting copy       | "Waiting for ERC-8004 Registry" (title case)                | "Waiting for ERC-8004 registry" (sentence case)                                                     |

---

## 3. Visual QA

- **Spacing / rhythm** — header `py-4`, section header `pb-3` with helper `mt-1.5`, grid `mt-4`, pagination `mt-8`; consistent `gap-4` grid gutters.
- **Alignment** — toolbar controls align on one row (desktop); search + status left cluster, sort/view/density right cluster; wraps cleanly ≤`sm`.
- **Button sizes** — unchanged design-system sizes (Sort `h-10`, view/density segments `h-8`, mobile Filters `sm`).
- **Pending badge** — anchored top-right of each card, now 92% — legible over skeletons via `bg-primary/10`, no overlap with card shapes.
- **Hover / focus** — inherited from design-system components (focus-visible rings, hover tints); no custom overrides introduced.
- **Responsive** — grid Mobile 1 / Tablet 2 / Laptop 3 / Desktop 4; no horizontal scroll. Screenshots: `marketplace-final-{desktop,laptop,tablet,mobile}.png` in `docs/review/screenshots/`.

---

## 4. Accessibility check

- `RegistryStatusCount` uses `aria-live="polite"` and a decorative `aria-hidden` icon; text conveys the state (not icon-only).
- Sort/view/density, search, filters retain their design-system ARIA (`role="searchbox"`, `aria-pressed`, `role="checkbox"/"switch"/"radiogroup"`).
- Pending grid remains `role="status"` with an `sr-only` summary ("…12 agent slots pending registry sync").
- Semantic `h1` (Marketplace) → `h2` (Agents / Filters); helper text is a plain muted `<p>`, not styled as an alert/error.
- Motion limited to `animate-pulse`; the 92% badge scale is static (no new animation). Reduced-motion safe.
- Contrast: muted helper/status use `text-muted-foreground` on background (AA); badge uses primary-on-primary/10.

---

## 5. Performance observations

- `/marketplace`: **4.07 kB** page, **157 kB** First Load JS (RC1 was 4.01 kB / 157 kB). Net change negligible — one `Database` icon added, `ResultCounter` import removed.
- No new dependencies; no new animations; still prerendered **static** (○).

---

## 6. Remaining issues (non-blocking)

1. **FIX 4 (filter heading contrast)** — intentionally a no-op: headings are already at full foreground contrast; any further increase needs a typography or design-system change, both disallowed this sprint. If a stronger look is desired later, bump the section-title weight inside the design system (Sprint 2C+).
2. **`next start` vs `output: standalone`** — screenshots captured via `node .next/standalone/apps/web/server.js` (static/public copied in). Build-pipeline note only.
3. **`ViewMode` not exported from the design system** — page keeps a local type alias to avoid modifying the frozen design system.
4. **Playwright not a repo dependency** — installed on demand for capture.

None block Sprint 2C.

---

## 7. Final recommendation

✅ **APPROVED — Sprint 2B is visually complete and final.** The Marketplace now shows "Sort: Featured", a meaningful muted "Waiting for registry" status (never blank, never fake), an 8004scan-aligned search placeholder, a lighter per-card "Pending Registry Sync" badge, and a clear non-error helper explaining automatic population once the ERC-8004 registry connects. It communicates search, discovery, filtering, registry readiness, and honest loading states with zero fake blockchain data.

**Stop here. Do not begin Sprint 2C.**
