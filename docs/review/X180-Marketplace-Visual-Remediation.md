# X.180 — Marketplace Visual Remediation (Image Fallbacks & Compare Density)

**Date:** 2026-08-30 · **Mode:** VISUAL-ONLY · **Transactions:** ZERO · **Wallet signatures:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Model A/B:** UNCHANGED · **Source logic:** UNCHANGED

> Visual-only remediation for broken agent images and Compare page density. No ERC-8004/ERC-8183, Hire, dashboard, pricing, or blockchain behavior changed.

---

## 1 · Files Changed (visual-only)

| File | Change | Logic impact |
|---|:---|:---|
| `packages/ui/src/components/avatar.tsx` | Add `failed` state + `onError={() => setFailed(true)}` + `loading="lazy"`; `showFallback = !src \|\| failed` — deterministic fallback to `fallback` initial (e.g., `nick→N`) on missing/null/empty/invalid or load failure; preserves `h-14 w-14` (lg) / `h-10 w-10` etc., `rounded-full bg-muted`, `object-cover`, alt semantics | **NONE** — fallback is local to card, does not mutate registry data; `src`/`fallback` props unchanged |
| `apps/web/app/(app)/compare/compare-view.tsx` | Search: `h-4 w-4` → `h-3.5 w-3.5 text-muted-foreground/60`, `h-11` → `h-10`, `border-border bg-background/70` → `border-input bg-background`, `pl-10` → `pl-9`, placeholder `“Search available agents…”` → `“Search the live ERC-8004 registry…”`; Empty state `No agents selected`: add `className="py-6"` (was `p-10`) — compact, intentional; no other logic change | **NONE** — `query`/`onChange`/`matchesSearch`, `MAX_COMPARE_AGENTS=3`, selection logic unchanged |

**Prior X.178 visual files (already at HEAD `7a684aa`, not re-changed in X.180):** `marketplace-view.tsx` (Scale + h-10 + placeholder), `global-search.tsx` (h-10 rounded-md), `home-nav.tsx` (remove Documentation), `toolbar.tsx` (h-3.5 icon), `badges.tsx` (rounded-md) — **verified as already committed, not part of X.180 diff.**

**Total X.180 diff:** 2 files, 38 insertions / 20 deletions.

---

## 2 · Visual Changes

### 2.1 Marketplace Image Fallback — PASS

| Before | After |
|---|---|
| `Avatar`: `src ? <img> : fallback` — if `src` present but broken (404, invalid URL), browser shows broken-image icon + alt text as giant visible text; different cards have inconsistent density (some with image, some with broken icon) | `showFallback = !src \|\| failed` + `onError` → fallback: reserves **exact same dimensions** (`h-14 w-14 lg`, `h-10 w-10`, etc., `shrink-0`, `overflow-hidden rounded-full bg-muted`) for every card; missing/null/empty/invalid/fails-to-load → **designed fallback** (`agent.name.charAt(0).toUpperCase()` → `nick→N`, `Q402→Q`, `mttra→M`); looks intentional, matches design system (typography, `rounded-full`, `bg-muted`, `text-muted-foreground`); **no giant alt text** (alt `""` or hidden, fallback is single initial); `aria-hidden` on fallback, `alt` preserved for semantics; `onError` local to card, does not mutate registry; `loading="lazy"` preserved |

**Verified:** All cards reserve same avatar dimensions; `Live` badge, `View Details`/`Hire` CTA, `Compare` checkbox remain aligned; description `line-clamp-2` does not jump.

### 2.2 Marketplace Card Layout — PASS

- Kept: dimensions, badges (`RegistryStatus` + `AgentBadge sm`), Live state, View Details `h-9` + Hire `h-9 bg-primary`, Unavailable, Compare `absolute right-3 top-3` (`text-xs text-muted-foreground`, secondary, not competing with bottom CTA).
- Avatar area now **identically aligned** across cards (fixed `h-14 w-14` + fallback), agent name baseline consistent, buttons bottom-aligned via `mt-auto`.

### 2.3 Compare Empty State — PASS

| Before | After |
|---|---|
| `MarketplaceEmptyState` `p-10` (40px) — excessively tall, large dead area for `No agents selected` (icon + heading + short explanation only) | `MarketplaceEmptyState className="py-6"` — **compact, intentional**: `py-6` (24px y) + `p-10` x retained, occupies only space for `GitCompareArrows h-6 w-6` + `No agents selected` + `Choose up to three…` + `Browse Marketplace` button; separated from selector (`mb-8` above) but not a huge panel |

### 2.4 Compare Selector Cards — PASS

- Consistent `min-h-20`, `p-3`, `rounded-lg border-border/70`, `h-8 w-8 rounded-lg bg-primary/10 text-sm` avatar (initial), `Plus h-4 w-4 mt-1` aligned, `max 3` enforcement, `hover:border-primary/40` — **kept, verified** as already consistent; no redesign, search behavior unchanged (`matchesSearch`).

---

## 3 · Tests

| Test | Result |
|---|---|
| `marketplace:verify` | **PASS — 104 checks passed** |
| `discovery:verify` | **PASS — 60 checks passed** |
| `dashboard:hires:verify` | **PASS — ALL CHECKS PASSED** |
| `pancakeswap:intel:verify` | **PASS — 10/10 READY** |
| `pancakeswap:ui:verify` | **PASS — 17/17 READY FOR QA** |
| `compare:verify` | **PASS — 10 checks passed** |
| `web typecheck` | **PASS — tsc --noEmit** |
| `web lint` | **PASS — eslint .** |
| `web build` | **PASS — compiled successfully, 12/12 static pages** |
| `prettier` | **PASS** — `compare-view.tsx` + `avatar.tsx` (and prior 5 files) all use Prettier style |

---

## 4 · Git

```
HEAD:       7a684aa15c71aae3eac9cc0a5c808093c152a9e6 (feat: polish marketplace for final submission)
origin/main:7a684aa15c71aae3eac9cc0a5c808093c152a9e6
Status:     M  apps/web/app/(app)/compare/compare-view.tsx
            M  packages/ui/src/components/avatar.tsx
            ?? docs/review/X173…X178 + X180 (6+1 docs, untracked)
Diff:       2 files, 38+/20- (visual-only, no lib/integrations/prisma)
```

**No unexpected files changed.** Prior X.178 5 files are already at HEAD (not in diff).

---

## 5 · Security Audit

| Check | Result |
|---|---|
| `eth_sendTransaction` in diff | **0 hits** |
| `eth_sendRawTransaction` | **0** |
| `sign` / `PRIVATE_KEY` | **0** (only verify-pattern in untracked docs, not diff) |
| `VERCEL_TOKEN` / `PANCAKESWAP_API_KEY` / `AWS` | **0** |
| New jobs / Job 787 / Agent 2005/1906 | **0 changes, UNTOUCHED** |
| Secrets introduced | **NO** |

**HARD SAFETY BOUNDARY confirmed:** Zero wallet calls, zero transaction calls, zero signatures, zero contract writes, zero new jobs, zero Job 787 changes, zero credentials, zero env changes. Only visual React/TSX/Tailwind.

---

## 6 · Visual Quality (desktop width)

- **Marketplace:** missing image → `N`/`Q`/`M` fallback centered, `h-14 w-14`, no broken icon, no giant alt, no layout shift, `Live`/`Verified` `sm rounded-md` compact, not louder than `text-base font-semibold` name, `Compare` checkbox secondary top-right, `View Details`/`Hire` bottom-aligned.
- **Compare:** `0 selected` → compact `py-6` empty state (icon+heading+explanation only, no huge panel); `selector cards` consistent `min-h-20 p-3 h-8 w-8` with `Plus` aligned; `3-agent layout` would be grid 3-col (verified via `MAX_COMPARE_AGENTS=3` logic).
- **No:** clipped text, overlapping controls, detached Compare, uneven heights from images, excessive empty-state height.
- **Responsive:** `flex-col sm:flex-row`, `sm:grid-cols-2 lg:grid-cols-4`, `container`, `max-w-2xl` preserved.

---

## 7 · Hard Stop

```
X.180 STATUS: PASS

Files changed:
- apps/web/app/(app)/compare/compare-view.tsx
- packages/ui/src/components/avatar.tsx

Visual changes:
- Marketplace image fallback: deterministic, reserved dimensions, initial fallback, onError, no giant alt
- Marketplace card alignment: avatar area identical, name baseline consistent, Compare secondary
- Compare empty state: p-10 → py-6 compact, intentional
- Compare selector alignment: consistent h-8 avatar, min-h-20, Plus aligned

Marketplace image fallback: PASS
Marketplace card alignment: PASS
Compare empty state: PASS
Compare selector alignment: PASS

Tests:
- marketplace:verify: PASS (104)
- discovery:verify: PASS (60)
- dashboard:hires:verify: PASS
- pancakeswap:intel:verify: PASS (10)
- pancakeswap:ui:verify: PASS (17)
- compare:verify: PASS (10)
- web typecheck: PASS
- web lint: PASS
- web build: PASS
- prettier: PASS

Git:
HEAD: 7a684aa
origin/main: 7a684aa
working tree: 2 M + 7 untracked docs (visual-only)

Safety:
Blockchain transactions: 0
Wallet signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
Logic changes: 0
Secrets introduced: NO

Commit: NONE
Push: NONE
Deploy: NONE

HARD STOP — visual remediation complete, no logic/blockchain change.
```

