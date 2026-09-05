# X.184 — Compare Page Visual Redesign

**Date:** 2026-08-30 · **Mode:** VISUAL/UI ONLY · **Transactions:** ZERO · **Wallet signatures:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Model A/B:** UNCHANGED · **Logic:** UNCHANGED

> Redesign ONLY the Compare page presentation. No comparison logic, registry fetching, search behavior, selection state, routing, Hire, ERC-8004/8183, or blockchain behavior changed.

---

## Files Changed

| File | Change | Non-UI logic changed? |
|---|---|:---:|
| `apps/web/app/(app)/compare/compare-view.tsx` | Full visual redesign (see below) | **NO** |
| *(prior working-tree change, not from X.184)* `packages/ui/src/components/agent-card/agent-card-standard.tsx` | X.183 Compare-to-footer move (uncommitted per X.183 HARD STOP) | **NO** |

**X.184 itself = 1 file** (`compare-view.tsx`). The `agent-card-standard.tsx` modification predates X.184 (X.183 task) and remains uncommitted from that task — not an unexpected X.184 change.

---

## Visual Changes

### A. Page header
- Kept `Compare Agents` + subtitle (unchanged copy).
- `MarketplaceHeader className="py-4"` retains breadcrumb subtlety and Marketplace-aligned width. No oversized H1, no excess vertical whitespace.

### B. Selected agents panel (compact, Marketplace-consistent)
- Panel: `rounded-xl border border-border/70 bg-card/50 p-4 sm:p-5`.
- Header: `Select agents` + `N / 3 selected · live 8004scan records` muted; `Clear comparison` outline button right (only when selected).
- Search: `h-10 rounded-md border-input pl-9` + `h-3.5 w-3.5` icon + placeholder `Search the live ERC-8004 registry…` (matches Marketplace `SearchInput`).
- **Selected-agent chips** (NEW): compact row of chips, each `[Avatar h-7 w-7 rounded-md]` + `name (max-w-40 truncate text-xs font-semibold)` + `protocol/chain (text-[11px] truncate)` + `×` remove — wraps on mobile, no overlap, resembles Marketplace cards.
- Candidate selector cards: `min-h-[4.5rem] rounded-lg border p-3`, `Avatar h-8 w-8 rounded-lg` (initial fallback via `Avatar` onError), name + meta `truncate`, `Plus` aligned — consistent with Marketplace card avatars.

### C. Offline / registry message (compact, subtle)
- Changed from plain text row to `inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm` — subtle warning surface, not a giant red block. Meaning unchanged.

### D. Comparison header
- `Comparison` + `N agents selected` (muted) left; **`8004scan` source chip** right (`rounded-md border bg-muted/40 px-2 py-1 text-xs` + `Database h-3.5`) — source no longer competes with heading.

### E. Agent column headers (key improvement)
- Each agent column header: `[Avatar h-10 w-10 rounded-lg]` + **`name` (truncate, font-semibold)** + **`protocol / chain` (truncate, muted text-xs)** via new `AgentIdentity` helper; whole header links to agent detail; `×` remove button subtle (`h-7 w-7 text-muted-foreground hover:bg-accent`), `shrink-0`, never overlaps name (name in `min-w-0 flex-1` + `truncate`).
- First `Field` column header: muted label on `bg-background/60`.
- No giant text, no yellow-filled header, avatars `rounded-lg` ~40px.

### F. Table redesign
- Outer `overflow-x-auto rounded-xl border border-border/70`, `min-w-[820px]` (wider, readable with 3 agents).
- **Sticky field column**: `TableCell sticky left-0 bg-background/95 backdrop-blur font-semibold` — separates `Field` from data columns, stays visible on horizontal scroll (safe, no layout break).
- Alternating row surface: `bg-background/30` on even rows — subtle readability, no excessive borders.
- Values: `text-sm text-muted-foreground`, key values stronger.

### G. Value types (presentation only, no invented data)
- **Verification**: green `Verified` chip (dot + emerald) vs muted `Unverified` chip (from existing `agent.verification`).
- **Reputation**: `★ score/5 · N reviews` (existing `averageScore`/`totalFeedbacks`, no fabrication).
- **Listed status**: green dot + `Listed in 8004scan`.
- **Chain**: green dot + `chainLabelForId` + `(chainId)`.
- **Protocols**: per-protocol chips (existing `agent.protocols`).
- **Capabilities**: `x402 payments` chip when `x402Supported`.
- All unavailable states keep explicit `unavailable(...)` muted text.

### H. Empty state
- `MarketplaceEmptyState py-6` compact: `[GitCompareArrows icon]` + `No agents selected` + `Choose up to three…` + `Browse Marketplace`. No huge vertical padding.

### I. Info footer panel (compact, non-dominant)
- `rounded-lg border bg-muted/30 px-3 py-2.5 text-xs` + `Info` icon + `All data is sourced from live 8004scan registry records at the time of selection. Unavailable fields remain honest and unresolved.`

### J. Responsive
- Desktop: table uses width, columns `min-w-56`, names `truncate`.
- Tablet/mobile: `overflow-x-auto` horizontal scroll preserved; chips wrap; no horizontal page overflow (`max-w-full`, `min-w-0`).

### K. Marketplace consistency
- Reused `Avatar`, `RegistryBadge`, `Table*`, `Button`, `MarketplaceContainer/Header/EmptyState` from `@bnb-marketplace/ui`; same radius family (`rounded-md/lg/xl`), muted text hierarchy, `bg-primary/10`/`emerald` accents, `text-xs/sm` typography, `h-10` controls.

---

## Verification

| Check | Result |
|---|---|
| `marketplace:verify` | **PASS — 104 checks passed** |
| `discovery:verify` | **PASS — 60 checks passed** |
| `compare:verify` | **PASS — 10 checks passed (URL capped at three)** |
| `web typecheck` | **PASS — tsc --noEmit** |
| `web lint` | **PASS — eslint .** |
| `web build` | **PASS — 12/12 static pages, compiled successfully** |
| `prettier` | **PASS — compare-view.tsx** |

**Visual acceptance cases verified via code review + checks:** 3 short names, 3 very long names (`PQMWnBoyn.agent` truncates, no collision), missing-image `Avatar` initial fallback, offline registry compact banner, zero-selected compact empty state, long protocol lists (wrap chips), long descriptions (`leading-relaxed`), mobile chips wrap + table scroll, 3-column horizontal overflow with sticky field column.

---

## Git

```
HEAD:        021dd945483ac5cd36682cfb619e7c11efdb87c9 (feat: finalize marketplace visual polish — X.180)
origin/main: 021dd945483ac5cd36682cfb619e7c11efdb87c9
Working tree: M  apps/web/app/(app)/compare/compare-view.tsx      (X.184, this task)
              M  packages/ui/src/components/agent-card/agent-card-standard.tsx  (X.183, prior task, uncommitted)
              ?? docs/review/X180…, X183… (reports, untracked)
```

**No unexpected files changed by X.184.** Logic-preserved check: `addAgent`/`removeAgent`/`clear`/`updateUrl`/`matchesSearch`/`addCompareAgent`/`removeCompareAgent`/`serializeCompareAgents`/`MAX_COMPARE_AGENTS` **unchanged** (presentation-only diff).

---

## Safety

```
Blockchain transactions: 0
Wallet signatures:       0
Jobs created:            0
Job 787:                 UNTOUCHED
Agent 2005:              UNTOUCHED
Agent 1906:              UNTOUCHED
Logic changes:           0
Secrets introduced:      NO
Commit:                  NONE
Push:                    NONE
Deploy:                  NONE
HARD STOP after verification.
```
