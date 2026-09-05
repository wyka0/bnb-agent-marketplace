# Leaderboards UX Blueprint

**Status:** Frozen UX specification — Phase 1 blueprint only (no implementation)
**Owner:** Product Design
**Applies to:** Leaderboards page (`/leaderboards`) and all future ranking surfaces
**Scope rule:** This document is the UX contract only. No React code, no API calls, no 8004scan integration, and no live leaderboard data are produced in this phase. Implementation begins only after freeze review.
**Dependencies:** Frozen docs — `docs/ux/Marketplace-UX-Blueprint.md` (trust tiers, badge language, empty/loading/error tone), `docs/ux/Agent-Details-UX-Blueprint.md` (badge semantics, navigation round-trip, fold), `docs/design-system/Marketplace-Design-System.md` (tokens, badge states, responsive rules)

---

## Section 1 — Product Goal

### What a user must accomplish in under 60 seconds

A first-time user opens `/leaderboards` and can:

1. **See at a glance** which agents are ranked highest and _why_ (transparent ranking metric).
2. **Filter** by category / protocol / network / verification to find agents in a specific scope.
3. **Trust the ranking** — every score is source-attributed and freshness-stamped; no invented numbers.
4. **Navigate** from any ranked agent row to its `/agents/[slug]` Detail page in 1 click.
5. **Understand the data story** — the ranking methodology and registry freshness are visible, not hidden behind a "magic score".

The fastest path: open Leaderboards → read the top row's metric + source + last-updated → click a row → land on that agent's Details. That is 2 interactions and 15 seconds.

### What a judge must immediately understand (within 10 seconds)

- This is the **same official BNB Agent Studio product** as the Marketplace and Agent Details (identical shell, tokens, navigation, trust badges).
- The ranking is **explainable, not magical** — the active metric + its source + last-sync time are surfaced above the table.
- **Data is real or honestly pending** — where registry/reputation data is absent, rows render `—` / pending hints / skeleton rows, never fabricated scores.
- **Diversity is visible** — agents across all four existing categories appear; category/protocol filters exist before any data fills them.

Design decisions map to judging criteria:

| Judging criterion   | Primary design lever on this page                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Functionality**   | Table → row → Agent Details navigation; filters/sort work; all states handled with zero dead ends                               |
| **Data Quality**    | Each metric carries a source + freshness label; pending/offline/unknown states never look "filled"; ranking methodology exposed |
| **Agent Diversity** | Four-category filter + protocol filter; category column always visible so category breadth is obvious even on a 1-row table     |

---

## Section 2 — User Journey

### Primary flow (happy path)

```
Open /leaderboards
  → sees default ranking (by Registry Score) with freshness banner
  → narrows by category and/or metric to rank by Reputation
  → sorts descending → clicks row 1
  → lands on Agent Details (trust strip + provenance intact)
  → back to Leaderboards — filters/sort/scroll preserved
```

### Alternate paths (must all be supported)

- **Direct link with query** — `/leaderboards?metric=reputation&category=yield&time=all` resolves and round-trips.
- **Leaderboard → Agent Details → back** — back returns to the same ranking/filter/sort state (page-local state, client-side, 1 click).
- **Filter → no matches** — honest `No agents match` state (mirrors Marketplace §11) with "Clear filters" + "Reset time window".
- **Registry offline** — `RegistryOffline` banner + stale ranking stays visible with a "stale" freshness badge; ranking metric attribution degrades to "(pending)".
- **Empty registry** — "No leaderboard data yet" empty state, single CTA "Browse Marketplace".

**Constraint:** every path back to Marketplace (or vice-versa) preserves the visible filter/sort state with no browser-back penalty. The Leaderboards page shares the Marketplace shell so the top nav/sidebar remain consistent (see §11).

---

## Section 3 — Information Hierarchy

Visual priority is a contract reused from **Marketplace UX Blueprint §3**. HIGH reads first without hover; LOW is attribution/metadata.

| Tier       | Elements on this page                                                                                  | Styling intent                                    |
| ---------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **HIGH**   | Page title, ranking metric selector, active-filter chips, the ranking column (rank), row→name, top CTA | Largest type, primary color, bold, above-the-fold |
| **MEDIUM** | Category/protocol/status badges, freshness line, table header labels, sort chevron, methodology toggle | Neutral-medium text, icon-paired, borders         |
| **LOW**    | Last-updated timestamp, registry source attribution, methodology footnote text, footer note            | Muted text, smaller type, non-interactive         |

Applied per section, top-to-bottom:

- **Breadcrumb eyebrow** (LOW) → **Title + description** (HIGH) → **Trust/freshness banner** (MEDIUM) → **Controls** (HIGH for active state) → **Table** (rank HIGH, name HIGH, metrics MEDIUM) → **Methodology** (LOW) → **Footer** (LOW).

**Fold rule:** fold = 768px-height laptop beneath the site header. On desktop, the **ranking metric selector + at least 5 ranked rows + freshness banner** fit above the fold; on mobile the metric selector and freshness must be reachable without scrolling past halfway.

---

## Section 4 — Desktop Layout (>=1280, xl)

Reuses the marketplace layout primitives inside the `(app)` shell (TopNav + Sidebar + Footer as on Marketplace, frozen §2D).

```
MarketplaceContainer (max-width, gutters)
└── Breadcrumb  (Home / Leaderboards)
└── Page header row
│   ├─ Title "Leaderboards"           ↦ MEDIUM subtitle
└── Trust/freshness banner   (MEDIUM, role=status)
└── Controls bar  (flex-wrap)
│   ├─ Category filter  (Select / chips)
│   ├─ Network filter   (Select)
│   ├─ Time period      (Select)
│   ├─ Ranking metric   (Select)  ← primary, HIGH
│   └─ Search           (flex-1)
└── Table        (Desktop: native <Table>; sticky header; rank / name first)
└── Ranking methodology   (collapsible, LOW)
└── Footer      (Registry/freshness note + Back to Marketplace)
```

- Table columns use the DS `Table` primitive (`table.tsx`) with `TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (same as Compare implementation).
- The `Rank` column is the leading HIGH column; the leading row is visually emphasized (gold accent bar on the row, per DS trust-color language) but uses only existing tokens — no new color.
- Sticky toolbar offset matches the app header (64px), consistent with Compare's `StickyToolbar`.

---

## Section 5 — Laptop (1024–1279, lg) & Tablet (768–1023, md)

- Controls bar wraps to two rows: `(Category · Network · Time · Metric)` then `(Search)`.
- Table keeps the same columns but fonts/icons shrink one token step; column `Rank` and `Name` never collapse first.
- At 1024 the table scrolls horizontally with a `min-width` equal to the desktop column set (no horizontal page overflow — `overflow-x-auto` wrapper, same as the marketplace `Table` wrapper).
- On tablet the controls compress further: `Category` and `Metric` stay; `Network`/`Time` collapse into a single "More filters" toggle sheet (mirrors Marketplace §4 tablet Filters sheet).
- Sticky header remains so column labels stay readable when scrolling.

---

## Section 6 — Mobile (<768) & Small Mobile (<400)

The `<Table>` becomes **leaderboard cards** (one card per agent row) — never fake/half-width rows. Each card is a vertical read of the same fields:

```
Card
 ├─ Rank pill (TOP)            HIGH, gold accent
 ├─ Name + category chip       identity
 ├─ metric value / source      MEDIUM — the active ranking metric + its label
 └─ trust strip (2–3 badges) + freshness line   LOW
```

- At `<400px` gutters shrink to `px-4`; touch targets >=40×40 (44 preferred).
- Search is always present in the sticky controls (icon-only on very small, label shown >=400px).
- Top bar: the active ranking metric + active filters are summarized as a single line; tapping it opens the same filter sheet.
- No horizontal scroll — cards stack 1-col.

---

## Section 7 — Page Structure (exact hierarchy)

1. **Breadcrumb** — `Breadcrumbs` `[Home] / [Leaderboards]`.
2. **Page title** — `h1` "Leaderboards".
3. **Description** — muted, e.g. "Rankings are produced from ERC-8004 Registry and reputation data. Every score shows its source and last update time — nothing here is invented."
4. **Ranking explanation / trust banner** — a `role="status"` banner (MEDIUM) stating the active metric + source + freshness (e.g. "Ranking by Registry Score — from ERC-8004 registry — last updated 7m ago"). Honest missing-state: when the registry is not connected, "Rankings pending registry sync."
5. **Leaderboard controls** — Category · Network · Time period · Ranking metric · Search (+ clear filters).
6. **Leaderboard table / cards** — ranked rows (see §8).
7. **Ranking methodology** — collapsible `section` (LOW), toggleable, explaining the default rank and metric definitions (§9).
8. **Registry/data freshness information** — footer note + timestamp.
9. **Empty/loading/error states** — §13–§16.
10. **Footer** — registry/disclaimer line + "Back to Marketplace" button (reuses `Button variant="outline"`).

---

## Section 8 — Leaderboard Controls

Priority order (fixed; not user-reorderable) — maps to the Marketplace §6 filter-priority convention.

| #   | Control             | Priority | Behavior / default                                                                                                             |
| --- | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Category filter** | Highest  | Chips or Select: Rebalancing · Grid Trading · Yield · Health Factor · `All` (default = All). Each shows a count. Default open. |
| 2   | **Network filter**  | High     | BNB Chain (mainnet) · BNB Chain Testnet · All (default All). Mirrors registry `chainId` values.                                |
| 3   | **Time period**     | Medium   | All-time · 30d · 7d · 24h (default All-time). Drives "freshness" framing; per-metric source explains what time means.          |
| 4   | **Ranking metric**  | Primary  | Select with options (see §9). Default = Registry Score. Always visible in the top bar.                                         |
| 5   | **Sort direction**  | Primary  | Implicit from metric (desc by rank); a toggle reverses ASC/DESC where meaningful (e.g. Success Rate).                          |
| 6   | **Search**          | High     | Search by agent name only (matches Marketplace §5 Rank 1: Name). Counter: "n agents ranked".                                   |

Behavior rules (from Marketplace §6/§7):

- Filters & metric apply **immediately** (no Apply button). Reset is one click ("Clear all").
- Active selections surface as removable filter chips above the table.
- Switching metric does **not** reset filters; it only re-sorts.
- Search works with metric/filter combined.
- On mobile, 2+ controls collapse into a "More filters" sheet; the active metric stays inline in the top bar.

---

## Section 9 — Ranking Metrics (specification)

Each metric defines: **meaning**, **source**, **freshness / cadence**, and **fallback state**. Metrics are named for future real data — no numbers are invented here.

| Metric (key)               | Meaning                                                          | Source                                            | Freshness cadence                                | Fallback state                                                                     |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `registry-score` (Default) | Composite trust ranking of the agent as registered               | ERC-8004 Registry verifier + status (see §10)     | On registry sync (per "Last synced")             | `—` + "pending registry sync"; row sortable but appears at bottom of any DESC sort |
| `reputation`               | Community trust (reviews/ratings aggregate)                      | 8004scan reputation engine                        | Updated as reviews arrive (per review timestamp) | `—` + "no reputation data yet"                                                     |
| `success-rate`             | % of runs reported successful                                    | Agent's own reporting / registry (when available) | Per-run reported value                           | `—` + "pending run data"                                                           |
| `activity`                 | Recent on-chain usage volume/trend                               | 8004scan activity index                           | Rolling 24h / 7d window                          | `—` + "no activity yet"                                                            |
| `verification`             | Verification tier (verified > pending > unverified > deprecated) | ERC-8004 registry `verification` state            | On registry sync                                 | `—` + "pending"                                                                    |
| `risk`                     | Risk level (inverted: low risk ranks high)                       | Registered risk field (Pillé later)               | On registry sync                                 | `—` + "pending risk"                                                               |

UI representation per metric in the table:

- A **named column** (not a hidden score) — users always see _what_ is ranked.
- A **source attribution** inline in the header (info tooltip or subtext): e.g. "Registry" / "8004scan" / "Agent".
- When the metric is **unavailable** for a row, the cell renders `—` with `PendingHint`/`WaitingHint` language rather than 0.
- The **active metric** is always echoed in the trust/freshness banner (§7 #4).

**Do not invent:** there are no fallback numeric proxies (no "estimated score", no placeholder percentages). Missing = `—` + labeled pending.

---

## Section 10 — Default Ranking ("Default")

**Default metric:** `registry-score` (composite Registry Ranking), numerically-ranked (rank 1 = best).

### What "Registry Ranking" means and why

The Default column is **not a magic number**. It is an explainable, registry-derived composite:

1. **Primary key (registry)** — Verification tier (verified > pending > unverified > deprecated). This matches Marketplace §3 trust priority (verification before everything).
2. **Tie-breakers, in order:**
   - a. `verification` tier (descending: Verified first)
   - b. `risk` (ascending: Low before High before Unknown; Critical ranked last)
   - c. `reputation` (descending, only when present)
   - d. `activity` (descending, only when present)
     e. **`updatedAt` freshness** — most recently synced first (keeps stale-but-verified visible, fresher wins ties)
3. **Ranks are positional:** column shows 1 / 2 / 3 … (ordinal), not a 0–100 score, so there is never an invented "score".

### Normalization & missing-data behavior

- A row with **all-unknown** fields sorts to the **bottom** of any DESC ranking; on Default it is still shown (ranked last) with `—` cells so the table is never empty-looking.
- Verification tier is the **only** field that can force-rank an agent above a higher-risk verified peer — so "verified but high risk" still out-ranks "unverified", with risk flagged in-band.
- If two rows are identical across all keys, they share a **dense rank** (e.g. both `3`, next is `4`) — never an arbitrary split.

### Why this is explainable

A judge reading §7 #4 banner + §10 methodology can reconstruct why an agent is #N: it is primarily "is it verified?", then "is its risk low?", then "is its reputation/activity strong?", then "when last did it sync?". No opaque algorithm.

This ordering and tie-break list is a **freeze item** (§18) — changing the primary key, the tie-break order, or the rank/ordinal-vs-score choice requires a UX change request.

---

## Section 11 — Leaderboard Table (columns + rows)

Desktop/tablet `<Table>` columns, in fixed order (left→right):

| #   | Column        | Content                                                                            | Tier   | Note                                             |
| --- | ------------- | ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------ |
| 1   | Rank          | ordinal (1, 2, 3…) or `—` if pending                                               | HIGH   | gold accent for rank 1 row; never a hidden score |
| 2   | Agent         | name (link) + `VerificationBadge` + `RiskBadge`                                    | HIGH   | Row is clickable to `/agents/[slug]`             |
| 3   | Category      | Rebalancing, Grid Trading, Yield, Health Factor chip                               | MEDIUM | Equal visibility across the four; never hidden   |
| 4   | Protocol      | protocol chips (Altana / PancakeSwap / …) or `—`                                   | MEDIUM | optional chips                                   |
| 5   | Active metric | the currently-selected metric value (Registry Ranking / reputation / success-rate) | MEDIUM | Source-attributed in header                      |
| 6   | Risk          | `RiskBadge`                                                                        | MEDIUM |                                                  |
| 7   | Verification  | `VerificationBadge`                                                                | MEDIUM |                                                  |
| 8   | Freshness     | `RegistryBadge` + "synced {X}"                                                     | LOW    | Last-update provenance                           |

Row interaction: clicking a row's Name link (or an explicit "View details" affordance) navigates to `/agents/[slug]`, preserving the Marketplace shell + navigation behavior (no redesign of Agent Details — see §12). Sticky header stays on scroll (same `overflow-x-auto` wrapper as the Compare table). Rank-1 gets a subtle gold left border/accent via existing DS tokens only. Accessibility: `caption` "Leaderboard, ranked by {metric}, N agents"; the name cell is `scope=row`.

---

## Section 12 — Agent Navigation (Leaderboards → Details)

- Entry: row Name link and a per-row "View details" text link point to `/agents/[id]` using the same routing as Sprint 2D — no navigation changes.
- Behavior preserved (frozen): the Agent Details page opens the same Detail page already built for the Marketplace (trust strip, provenance, fold rules); Leaderboards adds nothing to that page.
- Back: back returns to Leaderboards with filters/sort/scroll preserved (mirrors Marketplace §2 constraint and Agent-Details §9 freeze).
- Do not redesign Agent Details — the detail page must not gain leaderboard-specific inputs; ranking context stays on the Leaderboards page.

---

## Section 13 — Empty State

Rendered only when the registry yields zero agents across all categories.

Honest language:

> No leaderboard data yet
> Live rankings will appear once the ERC-8004 Registry is connected. Rankings are derived from registry verification and reputation signals — they are never pre-filled.

Recovery: single CTA "Browse Marketplace" (navigates to `/marketplace`). An optional secondary "Retry" appears only if a transient error produced the zero state. No fake rows or sample ranks. Matches the Marketplace §11 tone.

---

## Section 14 — Loading State

Reuses existing DS primitives from the Marketplace §12 conventions:

- Controls bar renders (Search/filter/metric placeholders via muted `Skeleton`).
- The table renders a `<Skeleton>` header + N Skeleton row placeholders (≈8 rows), no agent names, no fake scores.
- The trust/freshness banner shows `LoadingRegistry` + `WaitingHint` "Waiting for ERC-8004 Registry".
- Layout is stable (no jump) — row height placeholders match the final row height.
- If the registry is merely slow: keep the skeleton for a patience threshold, then degrade to the empty state with a retry CTA (never auto-loop).

---

## Section 15 — Error State

One clear, sourced condition with one recovery action each:

| Error                 | UX behavior                                                                                                                                                                                | Recovery action                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Registry unavailable  | `RegistryOffline` banner (role=status) + table shows stale/last-known ranking with a "stale" freshness badge, or empty state if no prior data. Metric values degrade to `—` + "(pending)". | "Retry"                           |
| Network failure       | Detect `navigator.onLine`; "Connection lost" banner; last state visible; table read-only; controls disabled.                                                                               | "Retry"                           |
| Rate limit            | Banner "Too many requests — retry in {n}s" countdown; table view frozen; actions briefly disabled; never auto-loop.                                                                        | Wait for countdown / manual retry |
| No ranking data       | Distinct from empty: note "No ranking data yet — registry connected but no scoreable agents."                                                                                              | "Browse Marketplace"              |
| Metric source missing | Active metric column degrades to all `—` + banner "Reputation source unavailable — metric shown as pending."                                                                               | "Retry" or switch metric          |

Global rule: each error is actionable (primary CTA = recovery, secondary = documentation/inspect), styled as a banner — never a full red-error page.

---

## Section 16 — Accessibility

- Keyboard order = visual: header → freshness banner → controls → table (or cards). Tab into the table moves row by row; focus ring on the active row.
- Table semantics: `Table` with `th scope=col` / `scope=row`; `caption` summarizes the ranking. Rank column is announced positionally.
- Rank announcement: the Rank header carries an accessible name so "1, 2, 3" reads as "rank 1".
- Focusable controls: every filter/metric select is keyboard-operable; active filter chips expose a remove button with an accessible label.
- Reduced motion: any row-1 hover elevation and skeleton shimmer respect `prefers-reduced-motion`.
- Contrast/touch: AA across badge text/background pairs; targets >=40x40 (44 preferred on mobile); focus rings meet 3:1 against surface (DS ring values).
- Mobile: cards are keyboard-navigable; the Rank pill is not interactive.

---

## Section 17 — Judge Demo (5-minute path)

The exact demo path a reviewer can follow without developer intervention. If the registry is offline, the honesty path (pending/stale/empty) is demoed instead.

| #   | Judge action                    | What they see                                                                                                                                                                                   | Criterion                       |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | "Open the site."                | Same BNB shell; nav to Leaderboards.                                                                                                                                                            | Official + credible             |
| 2   | "Open Leaderboards."            | Title "Leaderboards"; banner "Ranking by Registry Score — from ERC-8004 registry — last updated ..."; table with Rank / Agent / Category / Protocol / metric / Risk / Verification / Freshness. | Functionality + Data Quality    |
| 3   | "Explain why this agent is #1." | Methodology toggle → verification-first, then risk, then reputation/activity, then freshness; ordinal ranks shown, no fake score.                                                               | Data Quality / explainability   |
| 4   | "Filter to Yield."              | Category filter updates; count changes; table re-ranks within Yield.                                                                                                                            | Agent Diversity / Functionality |
| 5   | "Switch metric to Reputation."  | Metric column swaps meaning; rows re-sort; source attribution updates to 8004scan.                                                                                                              | Functionality / Data Quality    |
| 6   | "Click row 1."                  | Navigates to Agent Details (trust strip intact).                                                                                                                                                | Functionality                   |
| 7   | "Back to Leaderboards."         | State preserved; filters/sort/scroll intact.                                                                                                                                                    | Usability                       |
| 8   | "Turn off the registry."        | `RegistryOffline` banner + stale rows or empty state depending on data age — honest, no fabrication.                                                                                            | Data Quality                    |

Degraded (no-registry) demo: open Leaderboards → banner "Rankings pending registry sync" → skeleton rows → toggle methodology → switch metric shows `—` cells → "No leaderboard data yet" + Browse Marketplace. The judge sees honesty rather than fake rankings.

---

## Section 18 — Freeze Rules

Any change below requires a signed UX change request that updates this document + affected DS tokens in the same commit:

- Default ranking (§10): primary key = verification tier; tie-break order verification → risk → reputation → activity → freshness; ordinal ranks (never a score); dense ranks for ties.
- Ranking metric list (§9): metrics, meaning/source/fallback string, and the "never invent" rule.
- Category filter set + order: Rebalancing · Grid Trading · Yield · Health Factor (no renames, no additions).
- Column order + contents (§11): Rank, Agent, Category, Protocol, Active metric, Risk, Verification, Freshness — Rank + Agent always leading; Category never hidden.
- Navigation contract (§12): route `/agents/[id]`, back-state preservation, no Agent-Details redesign.
- Empty / loading / error state copy and tone.
- Mobile behavior (cards vs table, 400px / 768px breakpoints).
- Accessibility contract (keyboard order, table scope, rank announcement, reduced motion, touch targets, contrast).

---

## Section 19 — Cross-Sprint Consistency

Leaderboards is part of the same product surface as the frozen Marketplace and Agent Details. To keep the contract unified:

- Reuses the **exact** badge set: `VerificationBadge`, `BuilderBadge`, `RiskBadge`, `RegistryBadge`, `ReputationBadge`, `StatusBadge` — no new badge or color.
- Reuses `Breadcrumbs`, `MarketplaceContainer`, `StickyToolbar`, `SearchInput`, `SearchToolbar`, `Skeleton`/`SkeletonAgentCard`, `MarketplaceEmptyState`, `LoadingRegistry`, `WaitingHint`, `PendingHint`, `RegistryBadge` states (`synced`/`updating`/`waiting`/`offline`/`unknown`).
- Trust/freshness banner language mirrors Agent-Details §7 registry status line and Marketplace §12 `PendingHint`/`WaitingHint` usage.
- Navigation round-trip mirrors Marketplace §2 constraint and Agent-Details §9 back-state rule.
- All four categories are treated with equal visibility (Marketplace §3 principle, no special card sizes; Leaderboards principle: "no biased default filters").
- Skeleton rows reuse `Skeleton` and shimmer tokens (never animate meaning into motion — DS principle).

---

## Section 20 — Unresolved Questions (to resolve at Implementation freeze)

1. Does 8004scan expose a single composite `registry-score`/reputation number, or must Reputation rank by review-count then rating? (Affects §9/§10 tie-break c.)
2. Should the Active-metric column header be sortable by click (toggle ASC/DESC), or is metric-switching (the Select) the only ordering control the judge sees? (Affects §8 item 5.)
3. Exact freshness threshold wording: 1 decimal "7m" vs "7 minutes" vs "just now" — recommend keeping consistent with the Agent-Details §7 "Last synced {X}" format; pending DS decision.
4. Mobile card: which 2–3 badges sit in the card's trust strip (currently 2–3) — recommend VerificationBadge + RiskBadge + RegistryBadge to match Compare §Trust row density.
5. Whether "No ranking data" (§15) and "Empty registry" (§13) should be unified into one message — currently split intentionally; recommend keeping split for honest data provenance.

---

## End of document — Sprint 2F Phase 1 (Blueprint only). Do not implement.
