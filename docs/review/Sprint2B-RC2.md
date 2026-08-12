# Sprint 2B — RC2 Final Freeze Polish (Marketplace)

**Scope:** Final visual/copy polish before freezing the Marketplace. NOT a redesign. No new features, no layout changes, no backend, no APIs, no wallet, no 8004scan, no Altana, no ERC-8183, no UX-Blueprint changes.
**Result:** ✅ Complete. `pnpm lint` · `pnpm typecheck` · `pnpm build` all green. Desktop / Tablet / Mobile screenshots captured.

Only file changed: `apps/web/app/(app)/marketplace/page.tsx` (page-level copy only). No design-system, blueprint, or app-shell files were touched.

---

## 1. Applied changes

| #   | Spec item                  | Result                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Toolbar alignment**      | Verified. `SearchToolbar` aligns its row with `sm:items-center`; Search (`h-10`) and Sort (`h-10`) share one baseline; View/Grid toggles are the design-system segmented control (`h-8` segments in a `p-0.5` frame ≈ 36px, vertically centered on the row). "Waiting for ERC-8004 Registry" status is centered inline. No visual jumps. No change required (control heights are design-system-owned and frozen). |
| 2   | **Search field width**     | Frozen. `SearchInput` keeps `flex-1` (unchanged). No change.                                                                                                                                                                                                                                                                                                                                                      |
| 3   | **Filter sidebar**         | Verified. Divider `divide-border/70`, equal section padding (`FilterSection py-3`), equal left padding (`px-1.5` option rows), collapse chevron consistently right-aligned (`justify-between` + `ChevronDown`). No change.                                                                                                                                                                                        |
| 4   | **Skeleton cards**         | Verified. Every card is the same `SkeletonAgentCard` primitive → identical height, padding (`p-5`), radius (`rounded-xl`), border (`border-border/60`). Only placeholder bar widths vary inside the primitive. No change.                                                                                                                                                                                         |
| 5   | **Pending Registry badge** | Frozen. Kept the current `scale-[0.92]` per-card "Pending Registry Sync" badge exactly (color/typography/border/animation/size unchanged). No change.                                                                                                                                                                                                                                                             |
| 6   | **Registry wording**       | **Changed.** Normalized every visible Marketplace string to **"ERC-8004 Registry"**: toolbar status "Waiting for registry" → "Waiting for **ERC-8004 Registry**"; section hint + helper "ERC-8004 registry" → "ERC-8004 **R**egistry"; grid `aria-label`/`sr-only` "registry" → "ERC-8004 Registry"; Builder toggle description "registry-verified" → "**ERC-8004 Registry**-verified".                           |
| 7   | **Marketplace spacing**    | Verified. Title (`MarketplaceHeader py-4`) → toolbar (`mb-4`, sticky `py-3`) → Agents section (`pb-3` header, grid `mt-4`, pagination `mt-8`). Balanced rhythm retained. No change.                                                                                                                                                                                                                               |

Remaining lowercase "registry" occurrences are non-visible: code comments, the `registryState` variable, and the radio input `name="registry-state"` — intentionally left.

---

## 2. Before / After

| Element                                               | Before                                            | After                                                              |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Toolbar status                                        | "Waiting for registry"                            | **"Waiting for ERC-8004 Registry"**                                |
| Section hint chip                                     | "Waiting for ERC-8004 registry"                   | "Waiting for ERC-8004 **R**egistry"                                |
| Section helper                                        | "…once the ERC-8004 registry is connected."       | "…once the ERC-8004 **R**egistry is connected."                    |
| Grid a11y label / sr-only                             | "…ERC-8004 registry data… pending registry sync." | "…ERC-8004 **R**egistry data… pending **ERC-8004 R**egistry sync." |
| Builder toggle description                            | "registry-verified builders"                      | "**ERC-8004 Registry**-verified builders"                          |
| Everything else (layout, widths, badge size, spacing) | —                                                 | **Unchanged**                                                      |

---

## 3. Responsive validation

Screenshots (dark, deviceScaleFactor 2, full page) in `docs/review/screenshots/`:
`marketplace-final-desktop.png` (1440) · `marketplace-final-tablet.png` (834) · `marketplace-final-mobile.png` (390).

| Tier               | Result                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Desktop 1440**   | Sidebar + 3/4-col grid; single-row toolbar; no horizontal scroll.                                                  |
| **Laptop (≥1024)** | Sidebar retained; toolbar single row; no overflow.                                                                 |
| **Tablet 834**     | Sidebar collapses to the Filters drawer (Modal); toolbar wraps gracefully; 2-col grid; pending badges not clipped. |
| **Mobile 390**     | 1-col grid; Filters button in toolbar; pending badge legible at 92%; no horizontal scroll.                         |

No horizontal scrolling, no clipped badges, no collapsed spacing.

---

## 4. Accessibility validation

- Toolbar status is `aria-live="polite"`; grid wrapper is `role="status"` with an updated `sr-only` summary using "ERC-8004 Registry".
- Filter controls keep their design-system ARIA (`role="checkbox"`/`"switch"`/`"radiogroup"`, `aria-expanded`/`aria-controls`, `aria-pressed`).
- Semantic `h1` (Marketplace) → `h2` (Agents / Filters); helper text is a plain muted `<p>`.
- Motion limited to inherited `animate-pulse`; reduced-motion safe. Contrast unchanged (AA).

---

## 5. Performance validation

- No new dependencies, packages, client state, or animations — copy-only edits.
- `/marketplace`: **4.07 kB** page, **157 kB** First Load JS — **unchanged** vs Sprint 2B Final. Still prerendered static (○).

---

## 6. Validation summary

| Gate             | Result                                                   |
| ---------------- | -------------------------------------------------------- |
| `pnpm lint`      | ✅ 12/12 tasks pass                                      |
| `pnpm typecheck` | ✅ 12/12 tasks pass                                      |
| `pnpm build`     | ✅ 19/19 pages; `/marketplace` 4.07 kB / 157 kB (static) |

---

## 7. Final recommendation

✅ **APPROVED.** The Marketplace toolbar, sidebar, skeletons, pending badge, spacing, and search width are all consistent and unchanged where frozen; the only edit was normalizing every visible string to "ERC-8004 Registry". Zero layout/feature/bundle change, zero fake data.

## ✅ Sprint 2B — Marketplace — FROZEN

Do not proceed to Sprint 2D.
