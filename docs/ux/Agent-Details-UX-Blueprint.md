# Agent Details UX Blueprint

**Status:** Frozen UX specification — final before implementation
**Owner:** Product Design
**Applies to:** Agent Details page (`/agents/[id]`), the successor to the Marketplace Blueprint §9 "Agent Details Priority" contract.
**Scope rule:** No pages are built from this document. This is the UX contract for Sprint 2C. Implementation happens after freeze, assembled at the app layer from the existing Design System + Agent Card System. No new UI primitives may be invented without design-system review.
**Dependencies:** Frozen docs — `docs/ux/Marketplace-UX-Blueprint.md` (hierarchy, trust tiers, demo path), `docs/design-system/Marketplace-Design-System.md` (tokens, badges, responsive rules), `docs/review/Sprint2B-Final.md` (page assembly conventions), Homepage (branding source of truth).

---

## Section 1 — Product Goal

### What a user must accomplish on this page, in under 60 seconds

Arrive at `Agent Details` (from Marketplace, Search, Compare, Favorites, or a shared link) and be able to:

1. **Confirm identity** — "Is this the exact agent I saw on the card?" (same logo, name, category, token reference).
2. **Settle trust instantly** — verification, builder, risk, registry, and reputation states are read without scrolling, with visible source attribution.
3. **Understand function** — description, capabilities, supported protocols, and "what it is allowed to do" (permissions) in one pass.
4. **Know the cost** — pricing tiers and/or whether hire is available; if data is not live yet, an honest pending/"—" answer, never an invented number.
5. **Decide next** — favorite, share, compare, or return to Marketplace in ≤1 click; Hire proceeds only when the agent is actually hireable.

The fastest path: Marketplace card → Details → read trust row + Hire affordance. That is ≤2 interactions and ≤20 seconds. The scroll-free commitment: on desktop the **trust row + primary Hire CTA are above the fold on load**; on mobile they are reachable in one swipe or via a persistent bottom bar.

### What a judge must immediately understand (within 10 seconds)

- This is the same official BNB Agent Studio product as the Marketplace and Homepage (identical tokens, logo, typography, navigation).
- The page is **information-dense but trust-first**: badges and provenance outrank decoration; no animated jank.
- **Data is real or honestly pending** — every number/score/tier has a visible source; where no data exists yet, the field shows a loading or "—" state rather than a fabricated value.
- The agent is **grounded in context** — related agents prove ecosystem breadth (diversity), not an isolated page.

Design decisions map to judging criteria:

| Judging criterion   | Primary design lever on this page                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Functionality**   | Every control works; Hire is honest; sub-navigation + all states (loading/empty/offline/not-found) are traversable with zero dead ends                                      |
| **Data Quality**    | Source attribution on every trust/provenance field; live/pending/loading/offline states; registry references (`tokenId`, chain, contract, `updatedAt`) visible and copyable |
| **Agent Diversity** | "Related agents", category/protocol/capability clusters, and builder provenance tie the page back into the marketplace grid                                                 |

---

## Section 2 — User Journey

### Primary flow (happy path)

```
Marketplace grid 🔗 / Search result / Compare row / Favorite
   │  tap agent row or "View Details"
   ▼
Agent Details  (hero: name + logo + trust strip + Hire CTA)
   │
   ▼
Decide / trust · capabilities · permissions · pricing   (1 swipe or 1 tab)
   │
   ▼
Step 5: Hire (CTA → "Coming soon" if not live; real flow once hireable)
   │
   ▼
Back to Marketplace — state preserved (filters, sort, scroll) ≤1 click
```

### Inside-page reading order (content vs. sidebar)

- Reads **top → bottom** in the two-column layout: hero → story (description/capabilities) → operational truth (permissions/performance/pricing) → history (activity) → discover (related).
- The **sidebar pin is secondary** but always visible on desktop: it mirrors identity + trust + primary action + provenance so the user never scrolls back up to act.

### Alternate paths (must all be supported)

- **Search → result → details** (query preserved; back returns to those exact results).
- **Compare → "Open details"** — an agent opens in the same detail view; back returns to Compare with tray state intact.
- **Direct deep link** (`/agent/{chainId}/{tokenId}`) — shareable, browsable, breaks value on the "Agent not found in registry" state (§15) when the link is dead.
- **3 favorites → 3 details** — favoriting works anywhere (header-star and in-page Favorite).
- **Hire from card, hire from page** — one contract; "Coming Soon" chip identical everywhere.
- **Registry offline / pending** — the page shell renders banner + pending placeholders; never an error wall.

Constraint: every path back to Marketplace keeps **filters + sort + scroll** with no browser-back penalty (page-local scroll container, client-side state, as in the Marketplace §2 constraint).

---

## Section 3 — Information Hierarchy

Visual priority is a contract: HIGH reads first and without hover; LOW is metadata. Same tokens as the Marketplace §3.

| Tier       | Elements on this page                                                                                         | Styling intent                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **HIGH**   | Name + logo, Trust strip (verification/builder/registry/reputation), Hire CTA, registry status line           | Large, bold, primary color for CTA, strongest contrast, above the fold |
| **MEDIUM** | Section headings, capability tags, protocol chips, pricing tiers, permissions rows, performance metric values | Neutral-medium text, icon-paired, card borders, secondary actions      |
| **LOW**    | `tokenId`/chain/contract, `updatedAt`/sync time, builder address, review timestamps, guidance on "pending"    | Muted text, smaller type, non-interactive, copy-on-hover surfaces      |

Applied per section, top-to-bottom:

- **Breadcrumb eyebrow** (LOW) → **Name + logo + trust strip + actions** (HIGH) → **short lead-in** (MEDIUM) → **trust side rail** (MEDIUM/HIGH for registry line).
- **Capabilities** (MEDIUM heading, HIGH tag chips), **protocols** (MEDIUM), **permissions** (MEDIUM heading, HIGH rows for allow/deny), **performance** (MEDIUM), **pricing** (MEDIUM heading → HIGH tier cards), **activity** (MEDIUM), **related** (MEDIUM cards).
- **Bottom:** provenance block (LOW) — registry coordinates, contract, copyable; never above the fold.

**Fold rule:** fold = 768px-height laptop beneath the site header. On desktop the hero + trust strip + primary Hire CTA fit; on mobile the sticky Hire bar keeps the action reachable.

---

## Section 4 — Desktop Layout (≥1280, xl)

Two-zone layout reusing the marketplace layout primitives inside the `(app)` shell (TopNav + Sidebar + Footer as on Marketplace).

```
MarketsplaceContainer (max-width, gutters)
└── Breadcrumb (Home / Marketplace / Agent)
└── Page header row
│    ├─ [logo lg] [name + tagline] [category chip]      ↦ actions: Favorite · Share · Compare
│    └─ Trust strip  VerificationRiskRegistryReputationBuilder · · Registry line (role=status)
└── Two-column body
│    ├─ Left (main, min 0 flex-1):
│    │    ├─ Description
│    │    ├─ Capabilities · Protocols  (summary + show all)
│    │    ├─ Permissions              (matrix rows: action, scope, allow/deny)
│    │    ├─ Performance  (metric grid; each metric either value or pending)
│    │    └─ Pricing      (tier cards; CTA per tier)
│    │    └─ Activity timeline (newest first; empty state if none)
│    │    └─ Related Agents   (3 sidebar AgentCards or compact cards)
│    └─ Right rail (lg:sticky, self start, top 88):
│         ├─ Hire card (primary CTA + price min + "coming soon" when not hireable)
│         ├─ Permissions summary (deny)
│         ├─ Performance mini (uptime bar, task count)
│         ├─ Registry provenance card (tokendId, chain, contract, updatedAt, sync)
│         └─ Builder card (name, verified, address)
```

- Column widths: left `flex-1`, right fixed ~22rem; gap `gap-8`; max-width container inherits MarketplaceContainer.
- The **sticky rail** scrolls under itself (its own internal scroll for long provenance), sticking below the header (`offset` matches the app header).
- **No horizontal scroll** anywhere; all tags rock to a new line.

---

## Section 5 — Tablet Layout (768–1023, md)

- The two columns collapse to a single scroll; the right rail becomes **blocks inside the main column** in this order: Hire card → Permissions → Performance mini → Registry snapshot. No side-by-side — paragraph reading.
- Trust strip wraps to two lines (badges are not squashed; `flex-wrap` with `gap`).
- Sticky **bottom action bar** appears (see §7): persistent Hire + price bar over full width (safe-area aware).
- Capability/activity sections may collapse under a `FilterSection`-style collapsible (`defaultOpen` true for capabilities, false for long timeline).
- Breadcrumb shortens: "Marketplace / Agent / name".

---

## Section 6 — Mobile Layout (<768) & Small Mobile (<400)

- Fully single column; hero left-aligns; logo 48px; name may wrap; trust strip is wrap-only.
- **Sticky bottom action bar** is mandatory: [Hire (primary)] [Favorite] [Share]; floats `bottom-0 inset-x-0`, backdrop blur, `z-30`, respects safe-area `pb-[env(safe-area-inset-bottom)]`.
- Tabs (if used) become full-width swipeable `TabsList` with scroll; **accessible** (see §19).
- Smaller structure — all long sections under **collapse** (cards reopen closed) to keep the page skimmable; the trust section stays always-open.
- small `<400px,` gutters `px-4`, no horizontal overflow; touch targets ≥40×40 (44px preferred).

On both tablet/mobile the **Hire affordance must never disappear** as the user scrolls the timeline.

---

## Section 7 — Hero Section

| Element                  | Behavior                                                                                                                       | Rules                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Breadcrumb**           | `Breadcrumbs` `[Marketplace] / [Agent]`; low                                                                                   | Links preserve grid state                                        |
| **Logo + Name**          | `Avatar size=lg` (rounded), `h1 font-semibold tracking-tight`; name is the registry `name`                                     | If no logo — fallback letter avatar                              |
| **Tagline**              | Subtitle under the name (description first sentence, clamp 1 line)                                                             | Not invented copy; empty → "Description pending"                 |
| **Category chip**        | `CategoryTag`-style chip (Rebalancing / Grid Trading / Yield Optimization / Health Factor)                                     | Only if present                                                  |
| **Actions row**          | `FavoriteButton` (active state) · `Share` (copy-link button) · `Compare` (checkbox-like)                                       | One each, `md`+ inline; icon buttons on mobile with `aria-label` |
| **Trust strip**          | Sequence: `VerificationBadge` → `BuilderBadge` → `RiskBadge` → `RegistryBadge` → `ReputationBadge` → (StatusBadge if non-live) | Filled by state tokens; see §8                                   |
| **Registry status line** | Understrip: `RegistryBadge` shows live/updating/waiting/offline + "Last synced Xs/m/h"                                         | Never hides registry health                                      |

The hero is **never collapsed or truncated** at any breakpoint — it is trust + identity.

---

## Section 8 — Trust & Verification

Trust is the design principle that drives the whole page (§17). Every trust signal ^ has **attribution**; nothing is displayed as a bare number.

### The trust strip (identity → certainty)

| Badge               | Criterion                                                                  | Source (attributed)                               |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| `VerificationBadge` | Registry-level ERC-8004 status (`verified/pending/unverified/deprecated`)  | ERC-8004 registry verifier state                  |
| `BuilderBadge`      | `verified-builder`, `community-builder`, `unknown-builder`, `experimental` | Builder record (Altana later)                     |
| `RiskBadge`         | Low / Medium / High / Critical / Unknown                                   | Registered agent risk + audit (Pillé later)       |
| `RegistryBadge`     | synced / updating / waiting / offline / unknown                            | Registry sync state — drives Data Quality honesty |
| `ReputationBadge`   | Excellent / Good / Average (score + reviews)                               | 8004scan reputation + reviews                     |

### Attribution rules (Data Quality)

- Each badge in the strip carries a **rouser tooltip** "from the ERC-8004 registry" / "builder-claimed" / "platform editorial — see source". No bare badge without a source.
- A read-only "View registry record" link (tokenId, chainId, contract) is **always present** in the provenance block.
- If a value is **unknown**, the badge shows "Unknown" not a blank. If the registry failed, the RegistryBadge goes Offline + banner (§2).

### The three honesty rules

1. **Never fabricate** an attractor (reviews, scores, uptime, task counts) before live data.
2. **Pending ≠ hidden** — pending values render as Loading (skeleton or `…`/"—") and are labeled "pending registry sync" where needed, never omitted.
3. **Exposed freshness** — the registry line "Last synced {X}" enables the user to judge data freshness, per design principle "Self-report data freshness."

---

## Section 9 — Capability Overview

Purpose: "what does this agent do, and what does it know how to do it on."

### Two sub-blocks

**Capabilities (what)** — list of `CapabilityTag`s from registry `capabilities[]`, plus a title sentence from the description server-side. **No more than 6 tags** redacted at "show all" (count).

**Protocols (where)** — supported operating surfaces as `ProtocolChip`s (Altana, PancakeSwap, …). If both empty → honest "capabilities & protocols sync with registry" state (mirror of card).

### Display

```
Capabilities        [Rebalancing] [Take profit] [DCA] [Grid] [stop loss]
Protocols           [PancakeSwap] [Altana] [Aave]
```

- Priority: identity → what → where → permissions.
- Tags are non-editable, symmetric 28px hit area, focusable.
- If the source returns zero tags: neutral "No capabilities listed yet — pending registry sync" (a `text-muted-foreground` note, never a red error).

Rationale: capability + protocol + permission reads as "I understand the agent's function" → the user can judge fit and the judge sees **functionality** and **data quality**.

---

## Section 10 — Permissions

"Who can do what on and for the agent" — the single clearest trust signal.

### Permission matrix (read-optimized)

```
Action                Scope                    Allow | Deny
Transfer assets       X2L0 wallet contract     allow
Swap                  PancakeSwap Router      allow
Bridge                  —                      deny (no scope)
Call arbitrary        limit to listed          deny
```

- Rows derive from future integration (Altana scopes, ERC-8004 `permissions`).
- Each scope cell is either `allow` / `deny` / `—` (not configured). `—` = explicit unknown, not "no".
- Everything is **read-only** on this page (management toasts/permission mgmt live in Dashboard).
- Visual: status chips reusing the `StateBadge`-color language (emerald allow, muted neutralize deny, amber pending).

### Rules

- A table with **zero rows** when permissions not yet published → `EmptyState` style `DataUnavailable` note, never fake rows.
- The most applicable line for Hire ("Transfer assets: allow") is surfaced as a one-line "access summary" in the right rail, and mirrors the same truth.
- Security-first: negative-scope (deny) rows come first if present (sorted — allows then denies default).

---

## Section 11 — Performance

### Application provenance

Live metrics from the agent's own reporting / registry data source. Each metric has a unit + method + freshness. No invented headlines (uptime %, tasks).

| Metric                        | State  | When pending             |
| ----------------------------- | ------ | ------------------------ |
| Task counter (count lifetime) | value  | `—` + "registry pending" |
| Success rate                  | 0–100% | `—` + "pending"          |
| Uptime (30d)                  | %      | `—` + "pending"          |
| Avg latency / task            | sec    | `—` + "pending"          |
| Total value managed (TVL)     | `—`    | `—` (no fake values)     |

- When pending: numeric trunk built from `Skeleton` blocks; never show 0 or a fabricated number.
- Numbers formatted with 2 sig-figs, thousands `,` separator; percentages without decimals unless <1%.

Rationale: honesty Data Quality; performance is the "does it work?" evidence a judge needs, and pending state is equally credible.

---

## Section 12 — Pricing

The Hire contract. Honest cost always; "Coming Soon" when not yet.

### Presentation

- **Right rail card:** primary `Hire (CTA)` shows **minimum tier price**; if not hireable → disabled button + `Coming Soon` chip (matches the card's "Hire · Soon" pattern exactly).
- **Body block: tier cards** for pricing tiers:
  - **Tiers each:** name, price, unit (per hire / per task / per month), what it includes.
  - **Selected/hovered** tier highlights → its price becomes the rail's primary; CTA enabled only for hireable states.
- If **no pricing** published → body shows a neutral "Pricing by agent — available after registry integration" (honest, matches §12 empty-state tone).

### Rules

- Price always currency-formatted `XB`/`USDC`; **no fake amounts** — tiers come from the agent profile, `—` if not set.
- Hire is **never** enabled when the agent is not hireable, regardless of tier UI.
- Plan copy consistent: "per hire", "per task", "per month" — no marketing word amplification.

---

## Section 13 — Activity Timeline

Purpose: **trust by history** — "has this agent been reliably used/updated?" Low-priority info but always present (or the empty state).

### Data

- Events: `updated`, `version`, `hire`, `review`, `protocol`, `paused`, `retired` — newest first, time-grouped (Today, 7d, 30d).
- Each event: icon + action + timestamp (relative, 「n days ago」) + source chip if available.
- **Limit:** latest 20 events, then "View all history" (→ Dashboard monitor later).
- No invented events; empty registry → friendly "No activity recorded yet" + trust that the RegistryBadge story is a Data Quality signal.

Visuals: thin left vertical line + dot markers, compact. Hover = subtle elevation; click = expand to show that event's tx hash (if tx-linked).

---

## Section 14 — Related Agents

Purpose: **agent diversity** and keep the user inside the delivery journey.

### Cards & audience

- 3 `AgentCard variant="standard"` (from the Agent Card System) side by side (stacked on mobile).
- Selection rule when discovering: same **category** → nearest. else same **capabilities** → then same **protocol** → then **same builder**. Always deterministic; never random-popping.
- CTA behavior with compare disabled — cards here are `Favorite` + `View`, not Hire (avoids nested action risk).
- If fewer than 2 related: reduce to the available matching; if 0 → **no section rendered** (lighter than an empty state — no ghost block).

Rationale: cross-links the details page into the marketplace, exposes breadth (Data Quality → Diversity criteria), and gives the back-end a cheap, real signal for "like this".

---

## Section 15 — Loading States

Every field has a loading tier; the shell scrolls and trusts the structure even while loading (no layout shift — global rule).

### per-section strategy

| Level                                | What renders                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry fetch in flight             | `SkeletonAgentCard`-like hero skeleton (logo block + line bars) + `Skeleton` rows in describe/permission/timeline; the trust strip shows `LoadingRegistry` + RegistryBadge `updating` |
| Registry reachable, agent incomplete | Hero renders real fields it has; missing blocks show `Skeleton`-bar + `PendingHint "Pending registry sync"` per area                                                                  |
| Registry offline                     | `RegistryOffline` banner + stale cache warning + Retry; sections either stale (badge 'stale') or `—`                                                                                  |
| Agent not in registry                | `NoAgents`-style full empty state "no agent in registry" + Return to Marketplace (see §16)                                                                                            |

### Reused / consistent with Marketplace

- The `Skeleton` primitive + `SkeletonGrid` row patterns keep the same pulse/shimmer tokens.
- Never show "0" or a false "loading complete" flash; no infinite spinner — each skeleton lives behind a meaningful "waiting" message.

---

## Section 16 — Empty States

Honest, sourced, one recovery action each (matching Marketplace §11).

| State                                   | UX behavior                                                                      | Recovery CTA                          |
| --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- |
| **Agent not found** (`/agent/{id}` 404) | "No agent in the registry under this reference." + the queried `chainId/tokenId` | "Back to Marketplace" + "Search"      |
| **Registry offline**                    | Full-page/block: `RegistryOffline` + cached/pending note + Retry                 | "Retry" + "Continue with cached data" |
| **No description**                      | Hero shows muted title (tagline removed)                                         | — (auto pending once synced)          |
| **No capabilities/protocols**           | Medium note "Capabilities & protocols sync with the registry."                   | —                                     |
| **No permissions data**                 | "No permissions published yet."                                                  | "View registry record"                |
| **No performance**                      | All metrics `—` + "data pending"                                                 | —                                     |
| **No pricing**                          | "Pricing arrives with registry integration."                                     | —                                     |
| **No activity**                         | "No recorded activity yet."                                                      | "Back to Marketplace"                 |
| **No reviews** (if reputation exists 0) | "No reviews yet" (as the card already does)                                      | —                                     |

Empty states **never** present mock data; that absence is what a judge should trust.

---

## Section 17 — Error States

| Error                                | UX behavior                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Registry unavailable**             | Page-level banner (`RegistryOffline` tint) + keep cached content with stale badge + Retry; CTA Hire disabled |
| **Network failure**                  | `navigator.onLine` → "Connection lost" banner, last state visible, actions disabled                          |
| **Rate-limited**                     | Banner "Too many requests — retry in n s" with countdown; actions disabled; never auto-loop                  |
| **Bad token/reference**              | → "Not found in registry" empty state (§16) with the raw reference shown, never a 500 wall                   |
| **Permission denied** (future admin) | Toasting + dismissible permission card, hide the blocked control entirely (never render-then-error)          |

Global: errors are **actionable**, not red-full-page; primary CTA = recovery, secondary = documentation/inspect.

---

## Section 18 — Accessibility

Builds on the Design System §5.

- **Keyboard order** — source order = visual: breadcrumb → hero/trust → content L → rail R → related. Rail is `aria-hidden` until tab arrives (skip remain present).
- **Tabs/sections** — each section uses a `<section aria-labelledby>` with an `h2 heading`; collapsible area uses button + `aria-expanded`. Tabs primitive (if used) from `Tabs` follows Radix keyboard model.
- **Badge a11y** — badges convey _state_ not _color alone_: icon + label; `RegistryBadge`/`StatusBadge` announce via `role="status"`; `aria-live="polite"` where live status text changes in place.
- **Table (permissions/performance)** — `Table` with `th scope="col"` / `scope="row"`; caption summarizes; `—` reads as "not configured" via `aria-label` on the cell.
- **Timeline** — rendered as UA-list with `aria-label="Activity"`; markers are `aria-hidden` (content is text-only).
- **Reduced motion** — `prefers-reduced-motion` disables all spin/pulse translate on badges, timeline dot, sticky bar entrance. Components don't hard-code meaning into motion (tokens say the same).
- **Contrast/touch** — AA everywhere; 44×44 interactive targets on touch, 40px min; focus-visible rings via DS `ring` values.
- **Skip link** — "Skip to agent content" present linking past app nav.

---

## Section 19 — Responsive Rules (priority ordering)

What survives, what collapses, in priority order:

| Tier            | First visible/in order                                                                  | Collapses/hides first                                                       |
| --------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Desktop ≥1280   | Breadcrumb · Hero (trust including + CTA) · capabilities/protocols · rights rail sticky | Grid/sidebar → rect rail                                                    |
| Laptop ≥1024    | same as desktop; rail starts below left, sticky                                         | rail slightly narrower                                                      |
| Tablet 768–1023 | Hero + Hire bar sticky · capabilities · permission content in-flow · activity           | rail becomes in-flow blocks; `Tabs` wrap                                    |
| Mobile <768     | Hero + Hire bar persistent · permissions mat → allow/deny list · timeline compact       | long sections collapsed; performance table becomes key/metric rows (`grid`) |

**Sticky / persistent:** desktop xl+ right rail; <lg → bottom action bar (Hire + price). The trust strip is **not** sticky-blocked on mobile (page scroll reachable in 1 swipe, bar cannot scroll over it).

---

## Section 20 — Judge Experience (5-minute demo)

Scripted demo; dev-free; if registry offline the pending/honesty path is demoed instead (still Data Quality).

| #   | Judge action                                    | What they see                                                                                                 | Criterion                        |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | "Open Marketplace."                             | BNB-branded grid — real/pending states, verified count                                                        | Official + credible              |
| 2   | "Click View Details on one **verified** agent." | Detail hero: same name/logo + trust strip (Verified, Builder, Low Risk, Reputation) above the fold + Hire CTA | **Functionality + Data Quality** |
| 3   | "Scroll capabilities."                          | Capability tags + protocol chips; description; "what it does" not fabricated                                  | **Functionality**                |
| 4   | "Open Permissions."                             | Read-only matrix — allow scopes surfaced; pinned scope . —                                                    | **Trust + Data Quality**         |
| 5   | "Show performance."                             | Task success/uptime metrics; rows with no data show _—_ _pending_ — honest                                    | **Data Quality**                 |
| 6   | "Show pricing."                                 | Tier cards with real currency; rail price mirrors selection; if pending → "registry" note                     | **Data Quality / road-mapping**  |
| 7   | "Scroll to related agents."                     | 3 standard cards in same category/protocol; clickable → detail                                                | **Diversity + routing**          |
| 8   | "Back to Marketplace."                          | grid state (sort/filters) preserved, ≤1 click                                                                 | **Usability**                    |
| 9   | "Toggle dark mode."                             | same tokens; gold accent; AA contrast                                                                         | **Polish/brand**                 |
| 10  | "Open an agent that isn't in the registry yet." | honest `One` empty state + retry; no purple, no fake                                                          | **Honesty**                      |

If registry offline on the day: Demo History = **registry warns + pending rows** instead of fabricating — judge "Data Quality = data visibility" over "it must have numbers".

---

## Section 21 — Freeze Rules

Any change to the freezes below **requires a signed UX change request** that updates this document + the affected Design System tokens in the same commit:

- Fold priority (hero trust strip + CTA above the fold) — §3, §7
- Trust strip ordering and attribution rules — §8
- Capability / protocol block — §9
- Permissions matrix (read-only, allow/deny/—) — §10
- Performance honesty (all metrics `—`/pending when no data) — §11
- Pricing/Hire honesty (never enabled when not hireable) — §12
- Activity timeline ordering + empty-state tone — §13
- Responsive sticky behavior (desktop rail, mobile Hire bar) — §4/§5/§6/§19
- A11y contract — §18
- All "Frozen Elements" listed below

---

## Frozen Elements (contract)

Changing **any** of the following requires a design review approval before implementation. These are the signature UX decisions that testing the judging criteria:

1. **Single truthful trust strip** — verification / builder / risk / registry / reputation badge, in that order, with source attribution enabled. The strip may not be ornamented, collapsed, or reordered without review.
2. **Honest data representation** — no fabricated values anywhere on the page; anything without source renders as pending / `—` / labeled empty — at every breakpoint and in every state.
3. **Hire is a single, honest contract** — Hire CTA == card's Hire CTA; disabled + "Coming soon" until actually hireable; pricing never invents amounts.
4. **Hero + trust + CTA above the fold** on desktop, reachable on mobile, and the mobile bottom bar persists.
5. **Permissions show allow / deny / "—" read-only** — never a fake "approved" batch, no hiding the deny list.
6. **Timeline ordering** (newest-first) and **related-agent determinism** (category → capabilities → protocol) — no random or decor for either.
7. **Page-state round-trip** — returning to Marketplace from any path preserves filters, sort, scroll.
8. **Components, not forks** — page assembled only from existing primitives; any new UI must land in the Design System first, then this contract re-verified.
9. **Accessibility contract** — AA contrast, keyboard/focus order, `role` contracts, 40–44px targets, reduced-motion compliance.
10. **Legend consistency** — this page reuses brand tokens unchanged; it adds no new colors, glows, or unit glyphs.

> **Final status marker:** When implemented, mark this document's Status line `implemented` in the Agent Studio repo only after a judged walk-through in the §20 demo order passes.

— End of Agent Details UX Blueprint (frozen contract).
