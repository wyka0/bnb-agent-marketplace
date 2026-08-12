# Marketplace UX Blueprint

**Status:** Frozen UX specification — final before implementation
**Owner:** Product Design
**Applies to:** Marketplace, Categories, Dashboard, Compare, Search, Favorites, Agent Details, and all future admin surfaces
**Scope rule:** No pages are built from this document. This is the UX contract. Implementation happens after freeze.

---

## Section 1 — Product Goal

### What a user must accomplish in under 60 seconds

A first-time user should be able to:

1. **See** that this is a real, working agent marketplace on BNB Chain (not a mockup).
2. **Find** a relevant agent by search or a single category click.
3. **Trust** a specific agent by its verification, risk, reputation, and registry state.
4. **Understand** that the agent can be hired, and see what it costs to hire (even if hiring is "coming soon").

The fastest path: open Marketplace → click a category card or type a word → open an agent → read its trust row → land on the Hire affordance. That is ≤4 interactions and ≤60 seconds.

### What judges must immediately understand (within 10 seconds of load)

- This is **official-feeling** BNB Chain product work (consistent brand tokens, restrained motion, info-dense but clean).
- **It works**: a real grid of agents, real filters respond, states (loading/empty/offline) are honest.
- **Data is real or honestly pending**: every field is source-attributed; nothing looks fake.
- **The domain is broad**: multiple categories, multiple protocols, multiple builders — agent diversity is obvious at a glance.

Design decisions map to judging criteria:

| Judging criterion | Primary design lever                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Functionality     | The full journey (search→filter→compare→details→hire) must be traversable with zero dead ends       |
| Data Quality      | Source attribution, live/pending/offline states, reputation and risk scores with visible provenance |
| Agent Diversity   | Category chips + category cards, protocol variety, builder variety visible on first paint           |

---

## Section 2 — User Journey

### Primary flow (happy path)

```
Landing (Hero → data preview → category strip)
   │
   ▼
Marketplace  ──(default sort: Featured / Verified)──►
   │            Sees grid + trust metadata + diversity
   ▼
Search  (live results, counter updates, highlight match)
   │
   ▼
Filter  (progressive disclosure; active filter bar always visible)
   │
   ▼
Compare (select 2–3, side-by-side trust comparison)
   │
   ▼
Agent Details (full trust row, description, reviews, hire CTA)
   │
   ▼
Hire (CTA → "coming soon" state; paywall/queue intent)
   │
   ▼
Dashboard (hired/favorited agents, status, spend)
   │
   ▼
Monitor (live status, registry sync badge, recent activity)
```

### Alternate paths (must also be supported)

- **Landing → Category card → filtered Marketplace** (self-select between )
- **Landing → Featured agent CTA → Agent Details** (shortest path to a single agent)
- **Marketplace → pick 2 agents → Compare drawer → open one in Details** (decision-heavy user)
- **Search → no results → suggested resets** (failure path must recover)
- **Registry offline → cached/offline state → retry CTA** (resilience path — still exposes data quality)
- **Direct link → Agent Details → back to Marketplace** (share-capable, contextual back)

Constraint: every path must return to Marketplace in ≤1 click without a browser-back penalty. The filter state is preserved across the detail round-trip (client-side, not URL-bound for v1).

---

## Section 3 — Visual Hierarchy

Visual priority controls where the eye lands and in what arc. It is applied per section, per breakpoint.

**Hierarchy tiers**

| Tier       | Examples                                                                   | Styling intent                                                     |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **HIGH**   | Page title, search, top actions, trust badges, primary CTAs, hire button   | Largest type, primary color, bold, high contrast, primary position |
| **MEDIUM** | Section headings, filters, sort/toolbar, category cards, secondary actions | Neutral-medium text, card borders, icon-paired, lower contrast     |
| **LOW**    | Metadata, timestamps, secondary links, helper copy, footer links           | Muted text, smaller type, non-interactive, decorative              |

Applied per section (visual order top-to-bottom):

- **Marketplace header:** HIGH title, MEDIUM subtitle, LOW support links.
- **Toolbar:** HIGH search (dominant), HIGH primary sort, HIGH result counter when results return, MEDIUM view/density toggles.
- **Sidebar:** MEDIUM heading, HIGH active filter chips (they summarize selection), MEDIUM facet groups, LOW hints.
- **Content grid:** HIGH agent cards with trust hierarchy inside each card, MEDIUM section dividers, LOW per-card metadata timestamps.
- **Pagination:** MEDIUM; LOW when only 1 page.
- **Empty/Error/Offline:** HIGH primary message + HIGH recovery action (retry / reset).
- **Compare tray:** HIGH selected agents + primary "Compare now" CTA; MEDIUM count.
- **Agent Details:** HIGH name + verification + risk + price/hire, MEDIUM description, LOW raw registry IDs.

---

## Section 4 — Marketplace Layout

### Desktop (≥1280, xl)

- **Header:** full-width, max-width container, breadcrumb eyebrow (LOW) over title (HIGH), subtitle (MEDIUM), right-aligned actions (HIGH primary CTA).
- **Toolbar:** sticky under header (offset 64px), single row — Search (flex-1, HIGH), ResultCounter (HIGH when results), Sort (MEDIUM), ViewToggle (MEDIUM), GridToggle (LOW).
- **Sidebar:** left column, sticky, max-height with internal scroll, 17rem default width, contains FilterSidebar.
- **Content:** right column, MarketplaceGrid comfortable 3 columns.
- **Pagination:** bottom of content, centered.
- **Sticky elements:** header optional (site header); toolbar is sticky within content scroll; sidebar internal scroll.

### Laptop (1024–1279, lg)

- **Header / Toolbar:** full row, sidebar width 14–17rem.
- **Sidebar:** collapsible; sticky once layout shifts to 2-col.
- **Content:** comfortable 3 columns start; compacts to 2 columns at 1024.
- **Pagination:** bottom.

### Tablet (768–1023, md)

- **Header:** stacked, actions wrap under title.
- **Toolbar:** wraps to two rows (search row, then sort/view/count).
- **Sidebar:** single column flow — filters render **above** content by default (collapsible "Filters" toggle that becomes a sticky button).
- **Content:** 2 columns.
- **Pagination:** bottom, compact.

### Mobile (<768) & Small Mobile (<400)

- **Header:** compact, title + condensed actions.
- **Toolbar:** Search full width (HIGH). Sort/View collapsed into a single "Filters" bottom-sheet activated control; the sheet contains filters + sort + view.
- **Sidebar:** replaced by the bottom sheet (same FilterSection components inside).
- **Content:** 1 column; card density increases (compact cards) after a threshold of 20 results.
- **Pagination:** compact; infinite scroll optional on mobile after page 3 (explicit "Load more" button, not silent auto-load).
- **Sticky:** toolbar becomes a minimal floating "Filters (n)" button with badge; result counter drops into the toolbar row.

---

## Section 5 — Search Priority

Search field ranking determines both ranking weight and display order in the search results summary.

| Rank | Field          | Priority                              | Why                                                                            |
| ---- | -------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | **Name**       | Exact prefix match, boosted strongest | Users search "Pancake", "lending bot" → name is the identity they remember     |
| 2    | **Capability** | Phrase + token boost                  | "rebalance", "DCA", "stop loss" → capabilities describe intent                 |
| 3    | **Category**   | Multi-match boost (any)               | Category terms group many agents; essential for diversity discovery            |
| 4    | **Protocol**   | Boost                                 | Power users target protocols (PancakeSwap, Altana)                             |
| 5    | **Builder**    | Exact / prefix, moderate boost        | Trust-linked; search by "builder:name" secondary                               |
| 6    | **Reputation** | Range filter, not keyword             | Ranked low because reputations are better suited to sort/filter than free-text |

**Display behavior:** search results render in the same grid as browse, with the matched field visibly highlighted (bold highlight of the keyword in name / description). Result counter reports "12 agents found for "DCA"".

**Fallback:** if 0 results, show friendly state with one-click reset buttons for the top 2 used facets (category + verification) plus a "clear search" CTA.

---

## Section 6 — Filter Priority

Order is fixed (not user-reorderable) because it maps to the trust and discovery hierarchy.

| #   | Filter           | Why & behavior                                                                                                                                                                          |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Category**     | Highest — maps to agent diversity; first click most users make; default open. Order: categories in curated discovery order (defi, trading, tooling, social, data, …). Each shows count. |
| 2   | **Verification** | Trust-first; explains "why trust this?" — Verified / Pending / Unverified / Deprecated. Default open.                                                                                   |
| 3   | **Risk**         | Tight follow to verification; Low/Medium/High/Critical/Unknown. Default open when user engagement.                                                                                      |
| 4   | **Protocols**    | Where it operates; multi-select chips with counts. Collapsed after 5 items with "Show all".                                                                                             |
| 5   | **Status**       | Live / Paused / Updating / Coming Soon / Retired. Curated order.                                                                                                                        |
| 6   | **Builder**      | Verified Builder / Community / Unknown / Experimental, ranked by trust first.                                                                                                           |
| 7   | **Registry**     | Synced / Updating / Waiting / Offline / Unknown. Default collapsed (always available).                                                                                                  |
| 8   | **Activity**     | Trending / Popular / New / Stable / Inactive. Default collapsed.                                                                                                                        |

**Rules:**

- Each filter renders counts next to options (truncate at 99+).
- Filters apply **immediately** (no Apply button); Reset is one click.
- Active filters surface at the top of the filter sidebar and mirrored in the ActiveFilterBar above the grid (X to remove individual).
- "No agents match" shows a contextual empty state (not full page empty) with CTA "Clear filters" and "Clear search term".
- Facet order is identical to these priorities in the collapsed view (FilterSidebar on mobile is the same order).

---

## Section 7 — Sort Priority

| #   | Sort                   | Behavior / why                                                                                                             |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Default**            | Curated blend of Featured + Verified + recency + activity; the "show me what's important" view; this is what shows on load |
| 1   | **Featured**           | Curation hard-pins featured agents (platform editorial); always visible second; never used alone                           |
| 2   | **Verified**           | Verification first; stable within verification — by Reputation, then by recent                                             |
| 3   | **Highest Reputation** | Reputation desc; ties broken by Verified, then newest                                                                      |
| 4   | **Trending**           | Activity trending desc (score visible); ties by reputation                                                                 |
| 5   | **Newest**             | Registry `createdAt` desc                                                                                                  |
| 6   | **Alphabetical**       | Name A→Z, normalized (no markdown symbols)                                                                                 |

**Default sort = Default.**

- Dropdown label always shows "Sort: Featured" (current selection) so state is visible.
- Sorting works **in combination** with filters (not reset by switching sort).
- Search results: relevance ranking within the search, then Default handles ties.

## Section 8 — Agent Card Information Hierarchy

Finite order: users scan left-to-right, top-to-bottom; the card optimizes identity → trust → capability → action.

```
[1] Logo + Name (+ Verification icon)      — identity + trust (instant)
[2] Description (2-line clamp)             — what it does (scannable)
[3] Category chip + Capabilities + Protocols — what it's for (diversity)
[4] Risk + Reputation + RegistryStatus     — trust (decision input)
[5] Last updated + Token # (metadata, LOW)  — provenance (transparency)
[6] Footer: View Details | Hire (CTA)      — action
```

**Reasoning:**

- **Identity first** (logo/name): users need to recognize at a glance.
- **Verification before everything second** — this is the single most important trust signal; it must be visible without hover.
- **Description** explains function; clamped to two lines.
- **Capabilities + protocols + category** answer "what does it do?" and surface diversity.
- **Risk + reputation + registry** answer "can I trust it right now?" — RegistryStatus drives honesty about data freshness.
- **Last-updated** proves the registry isn't stale — credibility cue.
- **Actions last** — users decide, then act; Hire is the primary revenue-like action and is visually emphasized (gold) only when trust signals are strong; otherwise it's muted with a tooltip "Requires verification".

**Progressive disclosure:** detailed metadata (builder address, full registry ref, audit id, protocol ids) live only in Details, not on the card.

## Section 9 — Agent Details Priority

| Position                    | Content                                                              | Tier   | Notes                    |
| --------------------------- | -------------------------------------------------------------------- | ------ | ------------------------ |
| **Never below the fold**    | Name + logo                                                          | HIGH   | Identity                 |
|                             | VerificationBadge + BuilderBadge                                     | HIGH   | Trust anchor             |
|                             | RiskBadge + RegistryBadge                                            | HIGH   | Data freshness + risk    |
|                             | Price/Hire CTA (primary)                                             | HIGH   | Action                   |
| **Below fold, top**         | Reputation score + review count                                      | MEDIUM | Decision input           |
|                             | Category + Capabilities + Protocols                                  | MEDIUM | Data quality / diversity |
| **Mid**                     | Full description                                                     | MEDIUM | Details                  |
|                             | Supported job types / pricing tiers                                  | MEDIUM | Functionality            |
| **Below fold, low**         | Registry record (`tokenId`, chain, contract, updatedAt, sync status) | LOW    | Transparency             |
|                             | Audit report link + builder wallet                                   | LOW    | Provenance               |
|                             | Recent activity (reviews, hires)                                     | LOW    | Trust history            |
| **Always inline with name** | Favorite + Share + Compare                                           | MEDIUM | Quick actions            |

**Fold** = inner height of a standard laptop (768px) with the site header. The **trust row + primary CTA** must always fit above the fold on desktop and be reachable in one swipe on mobile.

## Section 10 — Compare Experience

### Selection

- Compare toggle appears on every card (checkbox hover affordance on desktop, visible on touch).
- Selecting drops the agent into a **Compare tray** — a bottom sheet that slides up (non-modal, can be dismissed with ESC / swipe).

### Max & behavior

- Maximum **3 agents** compared at once (cognitive overload guard; fits within a 768-height without scroll).
- With >3 selected, the tray shows "Remove one to compare" and disables adding a 4th (tooltip).
- The tray persists across route changes (sticky state), so users can browse + collect then review.

### Metrics compared (columns, first-per-agent)

1. Agent (logo/name)
2. Verification + Builder status
3. Risk level
4. Reputation score + review count
5. Category + capabilities
6. Protocols
7. Registry status + last updated
8. Hire CTA (per agent)

Compare stays aligned — each metric row is labelled on the left and vertically aligned across agents; missing/different states are shown explicitly ("—") rather than hidden.

### Actions remaining

From Compare, the user may: **Open Details** (per agent), **Favorite**, **Remove from compare**, **Reset compare**, and **Hire** (if permitted). Selecting an agent keeps the tray open.

## Section 11 — Empty States

Every empty state explains **why** and provides the **single best recovery**.

| State                       | UX behavior                                                                                                                                               | Recovery CTA                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Marketplace (no agents)** | "No agents to show" + neutral icon. If registry is down, show **RegistryOffline** instead.                                                                | "View categories" + "Check status"                      |
| **Search (no results)**     | "No results found for “X”" + a subtle highlight of what was searched. Show top suggestion chips for likely intent (top 2 used facets).                    | "Clear search" + "Clear top filter"                     |
| **Filters (no matches)**    | "No agents match these filters." List the active filters that produced zero results as `FilterBadges`.                                                    | "Clear filters" button + each badge's remove affordance |
| **Registry offline**        | "Registry offline — data may be incomplete." Applies to full page only when the registry is down; partial offline shows an offline banner and stale data. | "Retry" + muted "Continue with cached data"             |
| **Favorites (empty)**       | "No favorites yet." + "Star agents to track them here".                                                                                                   | "Browse marketplace"                                    |

Empty states never under sell the domain; they are honest about data availability and registry status instead of showing mock entries.

## Section 12 — Loading Strategy

| Layer                   | Behavior                                                                                                                                  | Fallback / limit                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Skeletons**           | SkeletonGrid (results), SkeletonSidebar (filters), SkeletonSearch, SkeletonToolbar mirror real layout; 6 cards initial                    | Never show "0 agents" flash; wait until first paint                         |
| **Progressive loading** | First paint shows skeleton + hero/heading; results stream by category (no layout shift on later rows)                                     | Progressive up to page size 24                                              |
| **Registry waiting**    | If registry is slow, a **PendingHint** "Waiting for registry sync" pinned above grid; old data stays visible with a "stale" RegistryBadge | Marketing data holds no data                                                |
| **API timeout**         | After 15s without a response, treat as RegistryOffline (show cached + retry)                                                              | Retry button with countdown; uses ETag for cache-bypass                     |
| **Retry**               | Single click triggers a revalidation request; button shows a loading spinner; repeated failures keep the error visible                    | Retries capped at 3 with exponential backoff before a manual retry is shown |

Global rule: every load step has a stable layout; no jump/layout shift as data arrives.

## Section 13 — Error Strategy

| Error                    | UX behavior                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Registry unavailable** | Full-page or banner (partial); `RegistryOffline` empty state; allow cached content with stale badge; provide Retry                               |
| **Network failure**      | Detect offline via `navigator.onLine`; banner "Connection lost"; keep last state visible, disable actions (hire/compare)                         |
| **Rate limit**           | Banner "Too many attempts — slow down" + countdown for retry; actions disabled temporarily; never loop-submit                                    |
| **No data**              | Empty state with honest reason (no filter hits / empty registry / no favorites); never fabricate data                                            |
| **Permission denied**    | If any future admin action is blocked, show a toast + dismissible permissions card; hide the admin control entirely rather than render-and-error |

Errors are never styled as failure red over the entire page; actionable language, primary CTA = recovery, secondary CTA = documentation.

## Section 14 — Accessibility

| Area               | Requirement                                                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keyboard order** | Tab order matches visual order: header → toolbar → ActiveFilterBar → sidebar (desktop) or Filters button (mobile) → grid → pagination                                                                                                               |
| **Focus order**    | Cards receive focus in a sensible order (top-left to bottom-right); details open with focus moved to heading; sidebar collapse keeps focus visible                                                                                                  |
| **ARIA**           | FilterSidebar has `aria-label`; FilterSection `aria-expanded`/`aria-controls`; chips/checkboxes use `role=checkbox`; toggles use `role=switch`; view toggles use `aria-pressed`; gridcells inside Compare are labeled with `role=columnheader` etc. |
| **Reduced motion** | Animations (pulse, spin, translate, fade) are suppressed when `prefers-reduced-motion` is on — automatic in components, document for consumers                                                                                                      |
| **Contrast**       | AA across all badge text/background pairs; tinted backgrounds 10% with text 600 (light) / 400 (dark) always; focus rings meet 3:1 against surface                                                                                                   |
| **Touch targets**  | All interactive controls ≥ 40×40px (44×44 preferred on mobile); hit areas include padding; filters and chips are ≥36px high                                                                                                                         |

Accessibility is not a separate phase — it is part of the QA/acceptance criteria for each screen.

## Section 15 — Responsive Priority

What survives first, what collapses, in priority order:

| Tier        | First visible (in order)                                           | Collapses/hides first                                                                                         |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Desktop** | Header → Search → Results grid → Sidebar → Pagination              | Grid density toggle                                                                                           |
| **Tablet**  | Title → Search → Filters sheet toggle → Grid (2 cols) → Pagination | Sidebar collapses into a top filter sheet; ViewToggle hides; header actions move to a menu                    |
| **Mobile**  | Title → Search → Filters (sticky button) → 1-col grid → Load more  | Sort/View collapse into filter sheet; GridToggle hides; description shortens; pagination turns into Load More |

**Sticky / always visible (mobile):** the "Filters (n)" button and primary hire CTA on detail pages.

## Section 16 — Judge Experience (the 5-minute demo)

This is the exact demo path for the hackathon judging. Every step is scripted so a reviewer can follow it without developer intervention.

| #   | Judge action                            | What they see                                                                                                                       | Why it lands (criteria)           |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | "Open the site."                        | Clean BNB-branded landing with announcement bar, value proposition, and live-looking stats strip                                    | Official + credible               |
| 2   | "Click Explore Marketplace."            | Marketplace loads with a real grid; agents include verified, categories, and risk variants; each card shows a status badge          | **Functionality** + data quality  |
| 3   | "Type 'rebalance' in search."           | Grid updates live; result counter reads "3 agents found for 'rebalance'"; each has a name-highlighted match                         | **Search** works & data is real   |
| 4   | "Open 'Trading' category from sidebar." | Filtered grid appears; active filter chip appears in the bar; "Category: Trading" pinned                                            | **Filter** + diversity visible    |
| 5   | "Swap Sort to Trending."                | Grid reorders instantly; Trending badge appears; the "Sort" dropdown shows the current state                                        | **Sort** works                    |
| 6   | "Select 2 agents → click Compare."      | Compare tray slides up; side-by-side trust rows (verification, risk, reputation), missing fields shown as "—"; CTA "Open details"   | **Comparison** + trust            |
| 7   | "Click one agent."                      | Agent Details: big trust header (Verification + Builder + Risk + Status), Hiring CTA, full description, recent activity, provenance | **Details** + transparency        |
| 8   | "Click Hire."                           | "Hire — coming soon" state with queue/waitlist CTA, no fake checkout                                                                | **Show roadmap,** no fake feature |
| 9   | "Back to Marketplace."                  | State persists (filters, sort, scroll position)                                                                                     | **Usability**                     |
| 10  | "Toggle site to dark mode."             | Whole system flips gracefully with the same tokens (gold stays the accent)                                                          | **Polish / brand adherence**      |

If the registry is offline during the demo, the **LoadingRegistry → PendingHint → cached/stale → retry** path is demonstrated instead, which strengthens the "data quality / honesty" story.

## Section 17 — Design Principles (binding for all future screens)

1. **Never fake blockchain data.** No placeholder scores or invented reviews under any state; loading hides the number, empty names it missing, offline exposes stale-ness.
2. **Always identify the data source.** Every field has a known origin (registry, builder, reputation engine, marketplace curation). UI shows "registered on-chain", "aggregated from reviews", "platform editorial" — users trust what they can audit.
3. **Use progressive disclosure.** Summary on cards; detail in Details; settings collapse; "Show all" in long lists.
4. **Minimize clicks.** Primary flows (search→filter→details→hire) in ≤3 clicks; favorite and compare are one click.
5. **Prioritize trust over decoration.** If space or animation budget is limited, the trust badges win; motion is always subtle and serves comprehension.
6. **Equal treatment for all four required categories.** No category is visually favored beyond its current data; each category surfaces equally (no special card sizes, no biased default filters).
7. **Every UI element must map to a future real API field.** No decoration-only fields; if a chip exists, its data source exists (or is named "pending").
8. **Honest incomplete states.** Missing or stale data is labeled; never hidden silently. The app must self-report data freshness (RegistryBadge / Last updated).
9. **Brand-consistent, not brand-decorating.** BNB gold is the accent only; no gradients-on-gradients; restrained elevation; official-product readability.
10. **Stateless components, page-owned state.** Components never own data; pages own state and pass controlled values; this keeps the same UI usable across all surfaces.

## Section 18 — Build Order

```
Marketplace Layout (shell: header, sidebar, content, container, responsive frame)
   ↓
Agent Grid + Loading/Empty states (cards inside layout; states shown through mock fixture flags)
   ↓
Filters (FilterSidebar + toolbar wiring; existing schema, controlled)
   ↓
Search (SearchInput + query state + result counter + highlight + no-results state)
   ↓
Compare (compare tray, 2–3 agent compare, open details/hire inside tray)
   ↓
8004scan integration (registry read; RegistryBadge drives honesty)
   ↓
Agent Details (detail page priority from §9; hire CTA behind registry)
   ↓
Dashboard (favorites, hired agents, status;empty states from §11)
   ↓
Altana integration (builder verified/agent hire behind Altana)
   ↓
PancakeSwap integration (protocol chips + hire routing)
```

Ordering rationale: the layout and grid are visible first; integrations come after the UX is stable so the same components don't need rework. Data source integrations are layered in after the UX freeze — the UI contracts are defined by this blueprint and the design-system, not by the backend.

---

**Freeze note:** Any change to the list below requires a signed UX change request and updates this document + the design-system tokens in the same commit:

- Section 06 (Filter priority) fixed order
- Section 07 (Sort priority) order + default
- Section 08 (Card hierarchy) fixed order
- Section 09 (Agent Details priority) above-the-fold content list
- Section 16 (demo path) — required judging steps

After freeze, UX review focuses on polish and consistency, not on flow changes.
