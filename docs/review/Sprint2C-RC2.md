# Sprint 2C — RC2 Final UI Polish & Bug Fix (Agent Details)

**Scope:** Page-level polish + bug-fix pass on `/agents/[slug]` before freezing Sprint 2C. No features, no design-system changes, no UX-Blueprint changes, no backend/API, no wallet, no 8004scan, no Altana. Only the two fixes below (+ alignment/safe-area verification).
**Result:** ✅ Complete. `pnpm lint` · `pnpm typecheck` · `pnpm build` all green. Desktop / Tablet / Mobile screenshots (+ overlap-proofs) captured.

Only file changed: `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`. No design-system, blueprint, shell, token, or navigation files were touched.

---

## 1. Problem found

1. **Persistent Hire bar overlap (tablet & mobile).** The fixed bottom Hire bar (`fixed inset-x-0 bottom-0 … lg:hidden`) overlaid page content while scrolling; near the end of the page the last content (Permissions rows, in-page Footer, Back button) could sit **underneath** the bar and be partially hidden.
2. **Mobile hero action buttons inconsistent.** The Compare button rendered an abbreviated **"Cmp"** on narrow screens (`<span className="sm:hidden">Cmp</span>`), while Favorite/Share collapsed to icon-only — three different mobile treatments, and an abbreviation the spec explicitly forbids.

---

## 2. Root cause

1. The page reserved bottom clearance with a fixed `pb-28` (112px) on the container. That value was **not tied to the actual bar height + iOS safe-area inset**, so on devices with a home-indicator inset (or slightly taller bar), the reserved space was insufficient and content scrolled under the bar. The clearance needed to be **derived from the bar's real height plus `env(safe-area-inset-bottom)`**.
2. The Compare button had **no icon** and used a separate abbreviated label for `<sm`, instead of the icon-only-with-persistent-label pattern the other two buttons used. There was no single responsive strategy.

---

## 3. Fix implemented

**Fix 1 — overlap / safe area (positioning only, appearance untouched):**

- Container bottom padding changed from `pb-28` →
  **`pb-[calc(5.75rem_+_env(safe-area-inset-bottom))] lg:pb-8`**.
- `5.75rem` ≥ the bar's real height (top `py-3` 0.75rem + `h-11` button 2.75rem + bottom `max(0.75rem, inset)` + border) with ~1.4rem breathing room; `env(safe-area-inset-bottom)` adds the iOS inset so content can **never** scroll underneath the bar.
- `lg:pb-8` keeps desktop unchanged (the bar is `lg:hidden`; the sticky right sidebar is untouched).
- The Hire bar itself is **unchanged** — colors, typography, `h-11` button size, shadows, badge placement, and its own `pb-[max(0.75rem,env(safe-area-inset-bottom))]` are all preserved. Only the page's reserved bottom space changed.

**Fix 2 — hero action buttons (one consistent strategy, Option A):**

- Compare now uses the **`GitCompareArrows`** icon (from the existing `lucide-react` set) + a `hidden sm:inline` label — matching Favorite (Star) and Share (Share2). On mobile all three are **icon-only**; on ≥sm all three show **full labels** (Favorite / Share / Compare). No abbreviations remain.
- Every button carries a **persistent `aria-label`** (Favorite: "Add/Remove … favorites", Share: "Copy link to this agent", Compare: "Add/Remove … compare") so the icon-only state stays accessible.
- All three keep `variant="outline" size="sm"` → **equal height & equal spacing** (`gap-2`); the group stays `flex shrink-0 items-center` and top-aligned via the hero's `sm:items-start`, so there is **no layout shift** on wrap.

---

## 4. Responsive verification

Screenshots in `docs/review/screenshots/`:
`agent-details-final-desktop.png` (1440), `agent-details-final-tablet.png` (834), `agent-details-final-mobile.png` (390),
plus overlap-proofs `agent-details-final-tablet.png` and `agent-details-final-mobile.png` (viewport scrolled to Permissions, showing the fixed bar clearing the table).

| Breakpoint               | Result                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop (1440)**       | Sticky right sidebar unchanged; no bar; full labels; no scroll issues.                                                                                |
| **Large laptop (≥1024)** | Same as desktop (bar `lg:hidden`); sidebar sticky.                                                                                                    |
| **Tablet (834)**         | Fixed Hire bar present; reserved padding clears content; Permissions/Performance/Pricing/Activity/Related/Footer/Back all fully visible; full labels. |
| **Mobile (390)**         | Icon-only actions (no "Cmp"); bar never overlaps content; safe-area reserved; no horizontal scroll.                                                   |
| **Small mobile (<400)**  | Actions remain icon-only and equal-size; content clears the bar; no clipping.                                                                         |

Verified checklist (item 1): ✓ Permissions table fully visible · ✓ Performance cards · ✓ Pricing cards · ✓ Activity · ✓ Related Agents · ✓ in-page Footer · ✓ Back button · ✓ no overlap anywhere · ✓ no horizontal scroll · ✓ no z-index conflict (bar `z-30`, no competing fixed element on this page) · ✓ no layout jumps.

---

## 5. Accessibility verification

- **Hire bar keyboard-reachable** — it is in normal DOM order at the end of the page; the disabled Hire control and the bar's Favorite button are focusable (Favorite) / correctly disabled (Hire), with `aria-label`s.
- **Action buttons** — all three now expose persistent `aria-label`s, so the mobile icon-only state is fully labeled; `aria-pressed` retained on Favorite/Compare.
- **Focus order** — unchanged and logical (breadcrumb → hero actions → trust → sections → sidebar → footer → fixed bar); no focus traps introduced.
- **Focus visible** — inherited `focus-visible:ring-2` on all buttons; unchanged.
- **Contrast** — unchanged (no color edits).

---

## 6. Performance impact

- **No new dependencies**, no animation libraries, no client polling, no API changes.
- One icon (`GitCompareArrows`) added from the already-bundled `lucide-react`.
- `/agents/[slug]`: **11.3 kB** page / **126 kB** First Load JS (was 11.2 kB / 125 kB) — **+~0.1 kB**, negligible, no meaningful bundle increase. Route stays `ƒ (Dynamic)` (expected for `[slug]`). `/marketplace` unchanged (4.07 kB / 157 kB).

---

## 7. Before vs After

| Item                    | Before                                             | After                                                                                  |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Bottom clearance        | `pb-28` (fixed 112px, inset-blind)                 | `pb-[calc(5.75rem + env(safe-area-inset-bottom))]` (bar-height + safe-area), `lg:pb-8` |
| Content under bar       | Permissions/Footer could be hidden while scrolling | Never — content always clears the bar                                                  |
| Compare button (mobile) | Text "Cmp"                                         | `GitCompareArrows` icon (icon-only), full "Compare" label ≥sm                          |
| Action strategy         | 3 inconsistent treatments                          | 1 strategy: icon-only <sm, icon+label ≥sm                                              |
| aria-labels             | Share only                                         | Favorite + Share + Compare (persistent)                                                |
| Hire bar appearance     | —                                                  | **Unchanged** (colors/type/size/shadow/badge)                                          |

Screenshots: `agent-details-final-{desktop,tablet,mobile}.png` in `docs/review/screenshots/`.

---

## 8. Validation summary

| Gate             | Result                                                      |
| ---------------- | ----------------------------------------------------------- |
| `pnpm lint`      | ✅ 12/12 tasks pass                                         |
| `pnpm typecheck` | ✅ 12/12 tasks pass                                         |
| `pnpm build`     | ✅ 19/19 pages; `/agents/[slug]` 11.3 kB / 126 kB (dynamic) |

Runtime check on the served build confirmed "Cmp" is gone and the safe-area reserve padding is present.

---

## 9. Final recommendation

✅ **APPROVED.** Both bugs are fixed with positioning/markup-only changes: the fixed Hire bar can no longer overlap content on tablet/mobile (clearance derived from bar height + iOS safe-area inset), and the hero actions now use one consistent responsive strategy with no abbreviations and full accessible labels. No design-system, token, blueprint, navigation, branding, or component-API changes; negligible bundle impact.

Sprint 2C RC2 polish is complete — stopping here.
