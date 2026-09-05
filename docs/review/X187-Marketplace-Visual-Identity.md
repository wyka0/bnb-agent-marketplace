# X.187 — Marketplace Visual Identity Redesign (Light Premium Direction)

**Date:** 2026-08-30 · **Mode:** UI/THEME ONLY · **Transactions:** ZERO · **Wallet signatures:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Model A/B:** UNCHANGED · **Logic:** UNCHANGED

> Light premium visual identity adapted from the Optimus reference principles (white/off-white canvas, subtle grid, ambient yellow sphere, dark typography, generous whitespace, restrained borders). Application UI kept an application; no marketing-landing conversion, no business logic change.

---

## Files Changed (X.187 — 4 files, theme/UI only)

| File | Change |
|---|---|
| `apps/web/app/globals.css` | Light `:root` tokens re-tuned to warm off-white; added global subtle grid + ambient BNB-gold orb (CSS-only, no image deps); responsive orb handling |
| `apps/web/components/dashboard-shell.tsx` | `ThemeProvider defaultTheme="dark"` → `"light"` |
| `apps/web/app/(home)/layout.tsx` | `ThemeProvider defaultTheme="dark"` → `"light"` |
| `apps/web/components/sidebar.tsx` | Active item: subtle warm-yellow bg + dark text + small yellow accent dot |

*(Prior working-tree changes not from X.187: `auth-controls.tsx` + `permissions/page.tsx` = X.186.)*

---

## Token Changes (`globals.css` `:root`)

| Token | Before | After | Effect |
|---|---|---|---|
| `--background` | `0 0% 100%` (pure white) | `48 23% 97%` (~`#FAFAF7`) | Warm off-white canvas |
| `--foreground` | `222 47% 11%` | unchanged | Near-black headings |
| `--card` | `0 0% 100%` | unchanged | White cards |
| `--border` | `220 13% 91%` | `44 16% 90%` | Warm neutral thin border |
| `--input` | `220 13% 91%` | `44 16% 88%` | Warm neutral input border |
| `--muted` / `--secondary` | `220 14% 96%` | `45 30% 95%` / `45 33% 96%` | Warm subtle surfaces |
| `--accent` | `220 14% 94%` | `45 28% 93%` | Warm hover surface |
| `--muted-foreground` | `220 9% 46%` | `40 10% 36%` | **Darker** — readable on off-white (a11y) |
| `--primary` | `43 96% 51%` (BNB gold) | unchanged | Gold accent retained (single yellow system) |

**No duplicate color system** — all components remain token-driven.

---

## Global Background Layer (`globals.css` base)

**Grid (subtle, behind content):**
```
body {
  background-image:
    linear-gradient(to right,  hsl(var(--border) / 0.5) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px);
  background-size: 72px 72px;
}
```
Thin 1px lines at `--border` 50% opacity, 72px pitch — extremely low-contrast, sits behind application content (opaque cards cover it; shows only in transparent gaps). Not dominant.

**Ambient sphere (`body::after`, fixed, pointer-events: none, z-index: -10):**
```
top: -20vmax; right: -14vmax; width/height: 60vmax; border-radius: 9999px;
background: radial-gradient(circle at 32% 32%,
  hsl(var(--primary)/0.55), hsl(var(--primary)/0.2) 42%, transparent 68%);
filter: blur(50px); opacity: 0.5;
```
Large abstract gold orb, upper-right, partially clipped by viewport, behind content, cannot cover text / intercept clicks / cause horizontal scroll. `body { isolation: isolate }` keeps it behind content but above canvas. Mobile: smaller arc (`top:-28vmax; right:-38vmax; 78vmax`). Dark mode: `opacity 0.28` (theme toggle preserved).

---

## Per-Surface Result (token-driven, verified)

| Surface | Result |
|---|---|
| Page | off-white canvas + subtle grid + upper-right gold orb |
| Nav (TopNav/HomeNav) | `bg-background/80 backdrop-blur` → translucent white, thin `border-b` |
| Sidebar | `bg-transparent border-r`; active = `bg-primary/10 text-foreground` + `h-1.5 w-1.5 bg-primary` dot (subtle warm yellow, dark text, small accent) |
| Content | transparent off-white |
| Cards (Marketplace/Home/Dashboard/Categories) | `bg-card` white, `border-border` thin neutral, `rounded-xl` |
| Primary action / Hire | `bg-primary` BNB gold |
| Secondary action | white, `border-border`, dark text |
| Text | near-black headings (`foreground`), dark-gray body, muted-gray metadata (now darker for contrast) |
| Marketplace search | white `bg-background`, `border-input`, dark icon, dark-muted placeholder (unchanged from X.178) |
| Dashboard cards | light `bg-card`; `Funded hires`/`Active agents`/`Total value`/`Net P&L` semantics unchanged |
| Compare (X.184) | white table, neutral borders, subtle alternating rows, gold selected accents, dark text, sticky Field column preserved |
| Leaderboards | token-driven light table, gold highlight where selected/ranking accent already used |
| Permissions | light cards; Wallet identity primary; Altana empty state subordinate (X.186 preserved) |

---

## Semantics / A11y / Responsive

- **No logic changed:** ERC-8004/8183, Hire, Dashboard data, Job 787, PancakeSwap/TermiX/Altana, SIWE, wallet auth/connection, permissions backend, registry, search scoring (`scoreAgentMatch`), compare logic — all untouched.
- **A11y:** `muted-foreground` darkened to `40 10% 36%` for off-white contrast; borders/inputs remain visible; focus rings (token `--ring`) unchanged; button labels unchanged.
- **Responsive:** orb is `position: fixed` (no layout impact, no horizontal overflow); grid is a background image; mobile orb reduced/clipped; sidebar keeps `hidden xl:block` responsive behavior.

---

## Verification

| Check | Result |
|---|---|
| `marketplace:verify` | **PASS — 104** |
| `discovery:verify` | **PASS — 60** |
| `compare:verify` | **PASS — 10** |
| `dashboard:hires:verify` | **PASS** |
| `pancakeswap:intel:verify` | **PASS — 10** |
| `pancakeswap:ui:verify` | **PASS — 17** |
| `web typecheck` | **PASS** |
| `web lint` | **PASS** |
| `web build` | **PASS — 12/12** |
| `prettier` | **PASS** (sidebar.tsx fixed) |

**Visual observations (code-level; no screenshot tooling in environment):** light canvas, grid behind content, gold orb upper-right (partial viewport clip, no interaction), white cards, dark typography, gold primary accent on nav/Hire/wallet, subtle sidebar active state, no overflow (`position: fixed`, `pointer-events: none`, `bg-size` only), no broken images (Avatar initials fallback), wallet + Logout visible, Compare bottom-aligned (X.183), long agent names truncate (X.183/X.184), X.184 Compare retained.

---

## Git

```
HEAD:        2ebb2aa7253fd39c6f2cd49b51fb90eb2f905c98
origin/main: 2ebb2aa7253fd39c6f2cd49b51fb90eb2f905c98
Working tree: M globals.css, dashboard-shell.tsx, (home)/layout.tsx, sidebar.tsx  (X.187)
              M auth-controls.tsx, permissions/page.tsx                          (X.186, prior, uncommitted)
              ?? docs/review/X180…X186… (audit reports, untracked)
```

**No unexpected files changed by X.187.**

---

## Safety

```
Blockchain transactions: 0
Wallet signatures:       0
Jobs created:            0
Job 787:                 UNTOUCHED
Agent 2005:              UNTOUCHED
Agent 1906:              UNTOUCHED
No credentials / API keys / backend changes
Commit:                  NONE
Push:                    NONE
Deploy:                  NONE
HARD STOP after verification.
```
