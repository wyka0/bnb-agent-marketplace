# X.183 — Marketplace Card Compare Control Polish

**Date:** 2026-08-30 · **Mode:** VISUAL-ONLY · **Transactions:** ZERO · **Wallet signatures:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Model A/B:** UNCHANGED

> Fix long agent-name collision with Compare at card top-right. Move Compare to bottom action row. No search, compare selection, discovery, Hire, dashboard, ERC-8004/8183, PancakeSwap/TermiX/Altana, or blockchain behavior changed.

---

## Files Changed

| File | Change |
|---|---|
| `packages/ui/src/components/agent-card/agent-card-standard.tsx` | Remove `absolute right-3 top-3` Compare from title area; add Compare to bottom `flex flex-wrap gap-2` action row as `inline-flex h-9 shrink-0 rounded-md border border-border bg-background px-3 text-xs` with `has-[input:checked]` subtle checked state, `CompareCheckbox` preserved |

**Total:** 1 file, 11+/14- (net -3 lines).

---

## Exact Visual Changes

**Before:** Compare `absolute right-3 top-3 z-10` beside title — on narrow cards (e.g., `PQMWnBoyn.agent`) long `h3 truncate text-base` collided / was visually constrained; title had `Avatar h-14 w-14 rounded-xl` + name + `RegistryStatus` + 2 badges, but top-right control reduced available width.

**After:**
- Title area: `Avatar h-14 w-14 rounded-xl` + `div min-w-0 flex-1` + `h3 truncate` + `RegistryStatus` + badges — **full available top-row width**, `overflow-hidden text-ellipsis whitespace-nowrap` via `truncate` preserved, no Compare beside/above.
- Visual target: `[P] PQMWnBoyn.agent` + `● Live` with **no Compare** beside/above — achieved.
- Bottom row: `mt-5 flex flex-wrap items-center gap-2 border-t pt-4` with `View Details h-9 flex-1` + `Compare h-9 shrink-0 rounded-md border bg-background px-3 text-xs gap-1.5` + `Hire/Unavailable h-9 flex-1 bg-primary` — **Compare belongs to action area**, compact secondary/ghost, `h-9` (≤h-10), no large yellow, no absolute, `has-[input:checked]:border-primary/30 bg-primary/10 text-primary` subtle checked, `focus-within:ring-2`.
- Responsive: `flex-wrap gap-2` prevents overlap; long names never obscured; `mt-auto` keeps actions bottom-aligned across cards.

**Preserved:** `View Details` `onViewDetails`, `Compare` `checked`/`onToggle`/`agentName`/`aria-label`, `Unavailable` `disabled`, keyboard `focus-visible:ring-2`, `AgentBadge sm`, `RiskBadge`, description `line-clamp-2`, capabilities, `FavoriteButton`.

---

## Verification

| Check | Result |
|---|---|
| `marketplace:verify` | **PASS — 104 checks passed** |
| `discovery:verify` | **PASS — 60 checks passed** |
| `compare:verify` | **PASS — 10 checks passed (URL capped at 3)** |
| `web typecheck` | **PASS — tsc --noEmit** |
| `web lint` | **PASS — eslint .** |
| `web build` | **PASS — 12/12 static pages** |
| `prettier` | **PASS — agent-card-standard.tsx** |
| Visual (desktop): short name, long `PQMWnBoyn.agent`, missing-image `N`/`Q`/`M` fallback, Live badge, Compare unchecked/checked, Unavailable disabled, View Details — **PASS** (no broken alt, no layout shift, no uneven heights, no detached controls, no clipped text) | **PASS** |

---

## Git

```
HEAD:        021dd945483ac5cd36682cfb619e7c11efdb87c9 (feat: finalize marketplace visual polish — X.180)
origin/main: 021dd945483ac5cd36682cfb619e7c11efdb87c9
Working tree: M packages/ui/src/components/agent-card/agent-card-standard.tsx
              ?? docs/review/X180-Marketplace-Visual-Remediation.md (X.180 report, untracked per HARD STOP)
              + this file (X.183 report, to be untracked)
Diff:        1 file visual-only, no lib/integrations/prisma/Hire/dashboard/Job 787
```

**No unexpected files changed.** Prior X.178 5 files already at HEAD; X.180 2 files at HEAD; this diff is solely the card Compare move.

---

## Safety

```
Blockchain transactions: 0 — no eth_sendTransaction, no eth_sendRawTransaction, no createJob, no fund
Wallet signatures:       0 — no personal_sign, no EIP-712
Jobs created:            0
Job 787:                 UNTOUCHED — no getJob beyond prior read-only, no submit/settle, FUNDED 0.001 U
Agent 2005:              UNTOUCHED
Agent 1906:              UNTOUCHED
Logic changes:           0 — search/compare/discovery/Hire/dashboard/ERC-8004/8183/PancakeSwap/TermiX/Altana unchanged
Secrets introduced:      NO
```

**Commit:** NONE (per HARD STOP — do not commit/push yet)
**Push:** NONE
**Deploy:** NONE

HARD STOP — visual fix verified, no business logic or blockchain change.
