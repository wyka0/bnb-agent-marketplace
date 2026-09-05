# X.178 — Marketplace Visual Polish / De-Vibe-Code Pass

**Date:** 2026-08-30 · **Mode:** VISUAL-ONLY · **Transactions:** ZERO · **Wallet signatures:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Model A/B:** UNCHANGED · **Source logic:** UNCHANGED

> Marketplace functionality is frozen. This pass is visual-only: search treatment, Compare control, toolbar hierarchy, pills, card hierarchy, navigation consistency, and iconography. No data source, routing, search semantics, Hire flow, ERC-8004/ERC-8183, dashboard, or blockchain behavior was changed.

---

## 1 · Scope & Files Changed

| File                                                  | Change                                                                                                                                                                                                                                                                                                    | Logic impact                                                                                                                                                                                                      |
| ----------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/components/home/global-search.tsx`          | Homepage search: `h-14 rounded-full shadow-lg` → `h-10 rounded-md border-input bg-background`; icon `h-5 w-5 left-5` → `h-3.5 w-3.5 left-3 text-muted-foreground/70`; placeholder `“Search agents, strategies…”` → `“Search the live ERC-8004 registry…”`; removed `⌘K` badge and oversized `pl-13 pr-40` | **NONE** — `onSubmit` → `router.push(/marketplace?q=…)` unchanged                                                                                                                                                 |
| `packages/ui/src/components/marketplace/toolbar.tsx`  | `SearchInput`: icon `h-4 w-4` → `h-3.5 w-3.5 text-muted-foreground/60`, placeholder `“Search agents…”` → `“Search the live ERC-8004 registry…”`, `placeholder:text-muted-foreground/70`, container `flex-1` → `flex-1 lg:max-w-[520px]` (preserves slightly wider desktop search)                         | **NONE** — `value`/`onChange`/`onKeyDown`/`role=searchbox` unchanged                                                                                                                                              |
| `apps/web/app/(app)/marketplace/marketplace-view.tsx` | Placeholder `“Search by agent name…”` → `“Search the live ERC-8004 registry…”`; Compare: `size="sm"` → `h-10 rounded-md … px-3 text-sm gap-2` + `Scale h-3.5 w-3.5 text-muted-foreground/70` icon, matching `SortDropdown` height/border/radius/typography                                                | **NONE** — `compareSlugs` logic, `router.push(/compare?compare=…)` , `SortDropdown`/`ViewToggle`/`GridToggle`, `applyMarketplaceFilters`/`sortMarketplaceAgents` (X.164 chain-aware token-id logic) **untouched** |
| `apps/web/components/home/home-nav.tsx`               | Remove `Documentation` external link; add `Compare`; `NAV_LINKS` now `Marketplace/Categories/Compare/Leaderboards` (matches `NAV_ITEMS` in `@bnb-marketplace/config`); simplify rendering (no `external` branch, now consistent `Link` only)                                                              | **NONE** — navigation hrefs are frozen spec; no routing/logic change                                                                                                                                              |
| `packages/ui/src/components/marketplace/badges.tsx`   | `StateBadge`: `rounded-full` → `rounded-md` (soft variant); `dot` variant keeps `rounded-full` for dot only                                                                                                                                                                                               | **NONE** — `SIZE_CLASSES`, `token.className`, `label`, `variant`/`size` API unchanged; data behind badges unchanged                                                                                               |

**Total:** 5 files, 39 insertions / 68 deletions (net -29 lines, removal of pill noise). No `apps/web/lib/**`, no `packages/integrations/**`, no `prisma/**` touched.

---

## 2 · Before / After Observations

### 2.1 Search — Marketplace

| Before                                                                                                                                  | After                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Magnifying glass `h-4 w-4` left-3, `text-muted-foreground` (dominant)                                                                   | `h-3.5 w-3.5` left-3, `text-muted-foreground/60` (lighter, restrained)                                                                                        |
| `rounded-md h-10` already moderate, but placeholder generic `“Search by agent name, capability, protocol or category…”` (template-like) | Same `h-10 rounded-md border-input`, placeholder `“Search the live ERC-8004 registry…”` — marketplace-native, communicates live registry without AI-demo feel |
| `flex-1` (already wider on desktop)                                                                                                     | `flex-1 lg:max-w-[520px]` — preserves slightly wider desktop, caps at 520px for hierarchy                                                                     |
| Search competes equally with Sort/Compare (all `h-10`)                                                                                  | Search remains `flex-1` primary; Sort secondary; Compare tertiary (see §2.3) — hierarchy via **width**, not height                                            |

**Preserved:** `value`/`onChange` → `applyMarketplaceFilters` → `scoreAgentMatch` (X.164 chain-aware, `Agent 2005` token-id semantics) — **no backend change**.

### 2.2 Homepage Search

| Before                                                                                                                                                                                                                                                                          | After                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `h-14 w-full rounded-full border-border bg-card/70 shadow-lg backdrop-blur pl-13 pr-40 text-base` + `h-5 w-5 left-5` + `⌘K` badge `right-4 px-2.5 py-1 text-[11px]` — oversized pill, heavy shadow, excessive empty space, shortcut emphasis (generic AI landing-page template) | `h-10 w-full rounded-md border-input bg-background pl-9 pr-4 text-sm` + `h-3.5 w-3.5 left-3 text-muted-foreground/70` — **same design system as Marketplace search** (h-10, rounded-md, border-input, text-sm, no shadow, no pill, no shortcut) |
| Placeholder `“Search agents, strategies or categories…”`                                                                                                                                                                                                                        | `“Search the live ERC-8004 registry…”` — clearly communicates live registry, not generic assistant input                                                                                                                                        |
| Helper text `“Searches the live ERC-8004 agent registry — results open on the Marketplace.”`                                                                                                                                                                                    | **Kept** (already correct)                                                                                                                                                                                                                      |

### 2.3 Compare Control

| Before                                                                                                                                      | After                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Button variant="outline" size="sm" (h-9)` — slightly shorter than Sort `h-10`, no icon, text `Compare X/3` — looks bolted on, “vibecoded” | `<Button variant="outline" className="h-10 rounded-md border-input bg-background px-3 text-sm font-medium gap-2"` — **same height/border/radius/typography/spacing as Sort** (`h-10 rounded-md border-input bg-background px-3 text-sm`), adds simplest icon `Scale h-3.5 w-3.5 text-muted-foreground/70` — reads as secondary action, not bolted |
| No icon, generic                                                                                                                            | `Scale` (lucide) — simplest comparison metaphor, supports text, not visual focus                                                                                                                                                                                                                                                                  |
| Yellow for selected? Not present in current Compare, but spec warns against it — remains **subtle** (`disabled:opacity-40`, no yellow)      | **Preserved subtle** — `variant="outline"` + `disabled` opacity, no yellow; `ViewToggle` active is `bg-primary/15 text-primary` (existing, not yellow)                                                                                                                                                                                            |

**Preserved:** `compareSlugs` Set logic (max 3, toggle, `router.push(/compare?compare=…)`).

### 2.4 View / Filter Toolbar

| Before                                                                                                                                          | After                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SortDropdown` `h-10`, `Compare` `h-9`, `ViewToggle` `p-0.5 h-8`, `GridToggle` `p-0.5 h-8`, `Filters` `h-10` — all similar weight, no hierarchy | **Hierarchy:** **PRIMARY Search** (`flex-1 lg:max-w-[520px]`), **SECONDARY Sort** (`h-10`), **TERTIARY Compare/view/filter** (`h-10` Compare now matches Sort but muted via `text-muted-foreground/70` icon + secondary reading; `ViewToggle`/`GridToggle` segmented `p-0.5 h-8` remain tertiary, `GridToggle` `hidden sm` reduces mobile noise) |
| Every control looks equally important                                                                                                           | Search width + Sort secondary + Compare/view tertiary — hierarchy obvious without random colors                                                                                                                                                                                                                                                  |

### 2.5 Pills / Badges

| Before                                                                                                                          | After                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StateBadge` `rounded-full border` — pill overload, excessively rounded, louder than agent name                                 | `rounded-md border` (soft variant) — **compact** (`sm: px-2 py-0.5 text-[10px]` / `md: px-2.5 py-0.5 text-xs`), **consistent** (all badges share `SIZE_CLASSES`), **semantically differentiated** via `token.className` (not shape), **not excessively rounded** (md, not pill), **not louder than agent name** (`text-xs` vs `text-base font-semibold` name) |
| Preserved: Live, Synced, Risk, verification, reviews — all still rendered via `AgentBadge`/`RiskBadge`/`VerificationBadge` etc. | **Preserved** — `badges.slice(0,2)` + `RiskBadge` + `Reputation` still present; meaning/data unchanged                                                                                                                                                                                                                                                        |

### 2.6 Marketplace Card

| Before                                                                                                                                                                                                                                            | After (no card file changed — hierarchy already correct)                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card: `Avatar lg` + `h3 text-base font-semibold` (name) → `RegistryStatus` + 2 badges `sm` → `p line-clamp-2 text-sm` (description) → `RiskBadge` + reputation → capabilities/protocols → `View Details` `h-9` + `Activate/Hire` `h-9 bg-primary` | **Verified:** Visual priority remains **1. Agent name (`text-base font-semibold`) → 2. description (`line-clamp-2 text-sm`) → 3. live/verification (`sm` badges, `rounded-md` now) → 4. metadata (risk/reputation/capabilities) → 5. primary CTA (`bg-primary` Hire) — **Compare is `absolute right-3 top-3` checkbox `text-xs text-muted-foreground` (secondary, not competing with `View Details`/`Hire` `h-9` bottom CTA)**. No decorative elements added. |
| Compare at top-right `absolute`                                                                                                                                                                                                                   | **Kept** — already secondary, not competing with bottom CTA                                                                                                                                                                                                                                                                                                                                                                                                   |

No card file was modified; hierarchy verified as already correct per blueprint.

### 2.7 Navigation Consistency

| Before                                                                                                                                                                                                                   | After                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (`HomeNav`): `Marketplace / Categories / Leaderboards / Documentation (external)` — **inconsistent** with `NAV_ITEMS` (`Home/Marketplace/Categories/Compare/Leaderboards`); missing `Compare`, extra `Documentation` | `Marketplace / Categories / Compare / Leaderboards` — **matches** `NAV_ITEMS` (Home excluded as brand), no external link; `TopNav` (`dashboard-shell`, `marketplace`, `categories/*`, `compare`, `leaderboards`, `dashboard`, `agents/*`) already consistent; `Home` and `App` now share same primary nav |
| `Documentation` external to `docs.bnbchain.org`                                                                                                                                                                          | **Removed** from primary nav (not in frozen spec)                                                                                                                                                                                                                                                         |

### 2.8 Iconography

| Before                                                                                                                      | After                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace search `Search h-4 w-4`, homepage search `Search h-5 w-5`, Compare no icon, home-nav `Search h-5 w-5` jump link | **Consistent:** Marketplace search `Search h-3.5 w-3.5 text-muted-foreground/60`, homepage search `Search h-3.5 w-3.5 text-muted-foreground/70`, Compare `Scale h-3.5 w-3.5 text-muted-foreground/70` — all `lucide-react`, same 3.5 size, muted, supporting text, not visual focus; no custom AI icons |

---

## 3 · Tests & Verification

| Check                                                                           | Result                                                                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `web typecheck` (`tsc --noEmit`)                                                | **PASS**                                                                                                                                    |
| `web lint` (`eslint .`)                                                         | **PASS**                                                                                                                                    |
| `web build` (`next build`)                                                      | **PASS** — compiled successfully, 12/12 static pages, `/marketplace` `8.19 kB`                                                              |
| `marketplace:verify` (104 checks: scoring, label mapping, `health-factor` etc.) | **PASS — 104 checks passed**                                                                                                                |
| `discovery:verify` (60 checks: classification, buckets)                         | **PASS — 60 checks passed**                                                                                                                 |
| `integrations typecheck/build`                                                  | **PASS** (prior, not re-run; no `packages/integrations` change)                                                                             |
| `prettier`                                                                      | **PASS** for changed files (`--write` then `--check`); repo 167-file pre-existing debt in `packages/integrations` untouched per instruction |

Existing Marketplace UI freeze respected; responsive behavior intact (`flex-col gap-3 sm:flex-row`, `lg:max-w`, `hidden sm`, `max-w-2xl` container).

---

## 4 · Confirmations

```
Product logic changed:        NO — search matching/relevance (scoreAgentMatch, X.164 chain-aware token-id), ERC-8004 discovery, 8004scan, ERC-8183 endpoint resolution, Hire execution, X.165 idempotency guard, X.167 funded verification, X.168 dashboard resolver, Job 787, pricing, provider signatures, PancakeSwap/TermiX/Altana — ALL UNTOUCHED
Data sources changed:         NO — same 8004scan + discovery + marketplace filters
Routing changed:              NO — same app routes, NAV_ITEMS unchanged (HomeNav now matches it)
Search semantics changed:     NO — applyMarketplaceFilters/sortMarketplaceAgents untouched, placeholder only
Hire flow changed:            NO — MainTrackHireView + 5-TX sequence untouched
Blockchain transactions:      0 — no eth_sendTransaction, no eth_sendRawTransaction, no createJob, no fund, no approve
Wallet signatures:            0 — no personal_sign, no EIP-712
Job 787:                      UNTOUCHED — no getJob beyond prior read-only, no submit/settle
Agent 2005/1906:              UNTOUCHED — no registration, no endpoint change
Database schema:              UNCHANGED
API contracts:                UNCHANGED
```

---

## 5 · Files Changed (visual-only)

```
M  apps/web/app/(app)/marketplace/marketplace-view.tsx  (placeholder + Compare h-10 + Scale icon)
M  apps/web/components/home/global-search.tsx           (h-10 rounded-md, smaller icon, no pill/shadow/⌘K)
M  apps/web/components/home/home-nav.tsx                (remove Documentation, add Compare, simplify)
M  packages/ui/src/components/marketplace/badges.tsx    (rounded-full → rounded-md)
M  packages/ui/src/components/marketplace/toolbar.tsx   (SearchInput: smaller icon, refined placeholder, lg:max-w)
```

No `apps/web/lib/**`, no `packages/integrations/**`, no `prisma/**`.

---

## 6 · Production / Deployment

**Deployment:** **NO** — per instruction _“Do NOT deploy unless explicitly authorized.”_ Build was verified locally (`next build` PASS); production check via prior Vercel deployment (`k5wjv…5b5d2265d003`) still shows previous visual (pre-polish) — expected. No new Vercel deployment was triggered.

If authorized, the existing Git → Vercel integration would deploy the 5-file visual change with zero data/logic risk.

---

_Visual system: existing Marketplace UX Blueprint + `@bnb-marketplace/ui` design tokens (no new colors, no new visual system). Before/after observations above are visual-only; all product behavior, data, and blockchain state remain frozen._
