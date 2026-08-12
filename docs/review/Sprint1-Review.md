# Sprint 1 — QA Review Report

## BNB Agent Studio Marketplace

**Reviewer:** Senior UX Reviewer (QA / Release Management)
**Date:** 2026-08-08
**Build:** `apps/web` production build (`next build` → `next start`)
**Scope:** Full visual, layout, accessibility, performance, SEO, and responsive review of the public-facing homepage plus supporting routes. **No code was modified during this review.**

---

## 1. Executive Summary

The Sprint 1 homepage is visually polished, component-consistent, and passes the majority of quality gates. Typography, spacing, color tokens, skeleton states, and empty-state honesty are all production-grade. However, **one user-visible responsive defect and three meaningful platform-quality gaps** block a clean release:

| #   | Issue                                                                            | Severity | Status    |
| --- | -------------------------------------------------------------------------------- | -------- | --------- |
| 1   | Horizontal page overflow at tablet widths (760–920px) — nav row exceeds viewport | **High** | Confirmed |
| 2   | Mobile Performance score 71 (LCP 3.3s)                                           | Medium   | Confirmed |
| 3   | `favicon.ico` 404 → console error in best-practices audit                        | Medium   | Confirmed |
| 4   | A11y: `<dl>` semantics (compare preview) + heading order (trust badge H3s)       | Medium   | Confirmed |
| 5   | SEO 90: non-descriptive "Learn More" link text (24 links)                        | Low      | Confirmed |

**Recommendation: ❌ CHANGES REQUIRED** (small, contained fixes — see §9. Approve after those land.)

---

## 2. Screenshots

All captures taken live against the production server (headless Chromium, viewport emulation, `--hide-scrollbars`).

| View                                                   | File                                     |
| ------------------------------------------------------ | ---------------------------------------- |
| Homepage — Desktop 1440px (full page)                  | `screenshots/home-full-desktop.png`      |
| Homepage — Laptop 1280px (full page)                   | `screenshots/home-full-laptop.png`       |
| Homepage — Tablet 1024px (full page)                   | `screenshots/home-full-tablet.png`       |
| Homepage — Tablet 768px (full page, 920 content width) | `screenshots/home-full-tablet-md.png`    |
| Homepage — Mobile 390px (full page)                    | `screenshots/home-full-mobile.png`       |
| Homepage — Small mobile 320px (full page)              | `screenshots/home-full-small-mobile.png` |

Homepage section close-ups, hover states, and per-route `page-*` captures were consolidated during the public-repo cleanup; the full-page captures above and the per-sprint final evidence (`marketplace-final-*`, `agent-details-final-*`, `compare-final-*`, `leaderboards-*`) in `screenshots/` remain the authoritative record.

Every section close-up was exported directly from the rendered DOM element bounding box, then captured at 2× device scale for clarity.

---

## 3. — Lighthouse Scores

Run against `http://localhost:3000/` (production build). Desktop preset + default mobile emulation, Lighthouse 12.

### 3.1 Desktop

| Category       | Score  | Weighted failings                               |
| -------------- | ------ | ----------------------------------------------- |
| Performance    | **93** | LCP 0.8s, TBT 210ms, SI 0.9s — nothing material |
| Accessibility  | **91** | `<dl>` grouping; heading order (see §5)         |
| Best Practices | **96** | `errors-in-console` — `favicon.ico` 404         |
| SEO            | **90** | `link-text` (descriptive)                       |

### 3.2 Mobile

| Category       | Score  | Weighted failings                                        |
| -------------- | ------ | -------------------------------------------------------- |
| Performance    | **71** | FCP 1.2s, **LCP 3.3s**, TBT 970ms, TTI 3.8s — long tasks |
| Accessibility  | **91** | (same as desktop)                                        |
| Best Practices | **96** | (same)                                                   |
| SEO            | **90** | (same)                                                   |

**Core Web Metrics** (both runs): CLS 0.004 desktop / 0.001 mobile — excellent, essentially no layout shift. Server response time 10ms.

---

## 4. — Responsive Matrix

| Breakpoint       | Horizontal overflow       | Vertical scroll | Findings                           |
| ---------------- | ------------------------- | --------------- | ---------------------------------- |
| Desktop 1440     | None                      | Normal          | Clean; no element exceeds viewport |
| Laptop 1280      | None                      | Normal          | Clean                              |
| Tablet 1024      | None                      | Normal          | Clean                              |
| Tablet 768       | **YES — scrollWidth 920** | Normal          | **Nav row overflows** (see §4.1)   |
| Mobile 390       | None                      | Normal          | Clean (table scroll is contained)  |
| Small mobile 320 | None                      | Normal          | Clean                              |

### 4.1 Tablet overflow (⚠ High)

At viewport 768px the document scrollWidth becomes **920px** (measured: 700px→700 clean, 768px→920, 900px→920, 960px→960 clean; the overflow band spans roughly 640–920px). The overflowing element is the navigation row:

- `div.ml-auto` (right edge 920px) containing the **Connect Wallet** button (`hidden h-10 … px-4 text-sm`) + "Coming Soon" chip.
- Cause: nav links switch to `md:flex` (show from 768px) while the full-width wallet CTA stays visible from `sm:`, and the row has no wrap/condense behavior. Below 640 the wallet CTA hides and the page is clean, so the band 640–920px (tablets in portrait, larger phones in landscape, windowed desktop) suffers a ragged horizontal scroll.
- Verified in headless render; screenshot `home-full-tablet-md.png` confirms the page renders at 920px content width.

---

## 5. — Accessibility Findings

| ID  | Audit                                 | Impact                                                                                                                                                                   | Location                                                   |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| A1  | `definition-list` / `dlitem`          | **Fail** — `<dl>` in Compare preview holds `<div>` wrappers containing `<dt>`/`<dd>`; `<dt>`/`<dd>` must be direct children of the `<dl>`                                | `components/home/compare-preview.tsx` → `dl.mt-8`          |
| A2  | `heading-order`                       | **Fail** — four `<h3>` trust badges ("Registry-verified identities", …) render before the first `<h2>` ("Four specialized tracks"); document order must descend h1→h2→h3 | `components/home/trust-banner.tsx` (H3s) + `hero.tsx` (h1) |
| A3  | `color-contrast`                      | **Pass** — 0 contrast failures at any scanned width                                                                                                                      | —                                                          |
| A4  | Landmarks / names / buttons           | **Pass** — all buttons, links, inputs named                                                                                                                              | —                                                          |
| A5  | `aria-hidden` — hamburger "Open menu" | **Pass**                                                                                                                                                                 | `home-nav.tsx`                                             |

---

## 6. — Visual polish & structural findings

### 6.1 What passes (verified programmatically)

- **Typographical scale** — consistent: h1 ≈ 60px, h2 ≈ 36px, card titles 16–18px, body 14px, caption 12px; no clipping of any heading or paragraph text at tested widths (0 clipped boxes at 1440/1024/390/320 after sr-only false positives corrected).
- **Button consistency** — radius 6px throughout; primary CTA (vibrant `#FBB309`—the BNB Gold) at 48px height, secondary outline 48px, nav-level 36px, wallet-pill 40px; all bg/font tokens match.
- **Card spacing** — grid gaps uniform (`gap-5`/`gap-4` containers); cards equal-height within rows (featured/partners).
- **Hover states** — CTA glow, card lift, link color shift have smooth transitions (0.2–0.4s); captured in `hover-*.png`.
- **Skeleton loading** — 18 shimmer elements present in Featured Agents & Snapshot; proper skeleton appearance with `sr-only` live text for screen readers.
- **Empty states** — 17 `--` dashes + "Waiting for registry sync" pills; no invented metrics.
- **Scroll spacing** — consistent `py-16/20` rhythm between sections; footer mt-0 flush.
- **Color consistency** — single CSS variable set; dark-mode-first respected; no stray hex values found.
- **No layout shift** — CLS 0.001–0.004 across both lighthouse runs.
- **All routes return HTTP 200** (including 4 category pages).
- **No page-level overflow** at 1440/1024/390/320 (the `min-w-[640px]` compare table + wide hero glow are correctly contained by `overflow-x-auto` / absolutely-positioned decorations, verified not to trigger page overflow at tested widths).

### 6.2 Issues

| #   | Finding                                    | Severity | Evidence                     |
| --- | ------------------------------------------ | -------- | ---------------------------- |
| I1  | Nav overflows at 768–920px (issue in §4.1) | High     | DocWidth 920 at viewport 768 |
| I2  | Compare `<dl>` semantics (A1)              | Medium   | Lighthouse audit             |
| I3  | Heading order (A2)                         | Medium   | Lighthouse audit             |
| I4  | 24 generic "Learn More" links              | Low      | SEO audit                    |
| I5  | Favicon 404                                | Medium   | `errors-in-console`          |

### 6.3 Structure / interaction notes (non-blocking)

- Nav CTA ("Connect Wallet — Coming Soon") is large at 768–920px; consider `lg:` visibility alongside the link-row condensing.
- Compare table `min-w-[640px]` means mobile users horizontally scroll the table — acceptable for a preview; primary CTA "Open Compare" sits above the fold to direct users out.

---

## 6.5 — Accessibility Detail (supplement)

- Per WCAG AA: lead-page text/background pairs all ≥ 4.5:1 (Lighthouse contrast audit 0 items at all scanned).
- Screen-reader semantics: skeleton text exposed via `sr-only`; no images require alt. Button names verified.
- Keyboard: all interactive elements are `<a>`/`<button>` with focus styles (`focus-visible` ring) — no focus trap issues found in static review.
- Heading tier order (H3 before any H2, see A2) is the only heading-level violation.

---

## 7. — Bugs (as found)

| ID  | Bug                                                                                     | Severity | Repro                                                           |
| --- | --------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| B1  | Page scrolls horizontally at 768–920px widths (nav row)                                 | High     | Set viewport 768 → `document.documentElement.scrollWidth` = 920 |
| B2  | `/favicon.ico` returns 404; browser console error                                       | Medium   | Inspect console after load; Lighthouse "errors-in-console"      |
| B3  | Compare `<dl>` mis-structures dt/dd; accessible name exposed to SR as improper grouping | Medium   | Lighthouse "definition-list"                                    |

---

## 8. — Recommended fixes (for Sprint 2 — _not applied in this review_)

1. **B1:** Give the header row `flex-wrap` / or add responsive hiding of the Connect CTA below `lg`, or drop nav links to `hidden lg:flex` (they already are) and condense gap at `md`. Smallest change: change button to `hidden lg:flex` (restrict to ≥1024px).
2. **B2:** Add a favicon to the web app (`app/favicon.ico` or a `.png`/SVG with `<link rel="icon">`) — zero-risk.
3. **B3/A1:** Change compare-preview `dl.mt-8` block to a plain semantic `div` grid (or reflow dt/dd direct children). Removing fake semantics kills the audit.
4. **A2:** Move trust-banner H3s to render after first H2 (or demote to `<h2>` when section level), ensuring h1→h2→h3 descend.
5. **I4/SEO:** Give the four Category-card links descriptive text (`aria-label="Learn more about Rebalancing agents"` etc.).
6. **Mobile perf:** LCP 3.3s / TBT 970ms dominated by long tasks in the main JS chunk — consider `priority` on the primary hero element, prefetch/preload, or code-split the below-fold sections; not release-blocking for Sprint 2 demo but worth a ticket.

---

## 9. — Release Recommendation

**❌ CHANGES REQUIRED**

The release is **90% ready**: visual design, typography, tokens, states (skeleton/empty/hover), spacing, no layout shift, and desktop/perf metrics are excellent. But the 768–920px nav overflow (B1) is user-visible across a whole class of devices/widows, the favicon 404 (B2) is a polish defect guests will notice, and the accessibility semantic fixes (B3/A2) are quick wins. All 5 recommended fixes are contained (~10 min each) and re-verify in one Lighthouse pass.

Route-count round-trip completed: **2026-08-08.**

---

_Generated by QA automation (headless Chromium, Playwright, Lighthouse 12). No source code, design, or content was changed during this review._
