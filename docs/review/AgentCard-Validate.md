# Agent Card System — Validation Record

**Status:** Implemented (lint + typecheck + build green)
**Package:** `@bnb-marketplace/ui` · `packages/ui/src/components/agent-card/`
**Status date:** Sprint 2 component 1 — before Marketplace page

UI-only system. No Marketplace page, no APIs, no 8004/8004scan connectivity, no
backend. All library code; consumed by any future screen unchanged.

---

## 1. Folder structure

```
packages/ui/src/components/agent-card/
├── index.tsx                   # AgentCard compound — variant switch
├── types.ts                    # domain model (AgentCardData, AgentCardActions, AgentCardVariant, …)
├── agent-card-compact.tsx      # search-result row (horizontal)
├── agent-card-standard.tsx     # primary marketplace card (vertical)
├── agent-card-detailed.tsx     # dashboard / favorites card (full metadata)
├── agent-badges.tsx            # AgentBadge · RiskBadge · VerificationBadge · CapabilityTag · ProtocolChip
├── registry-status.tsx         # RegistryStatus (5 sync states)
├── favorite-compare.tsx        # FavoriteButton · CompareCheckbox
└── states.tsx                  # SkeletonAgentCard · AgentCardLoadingState · AgentCardEmptyState · PendingHint
```

Exported from `packages/ui/src/index.ts` (all components + `export type *`).

## 2. Component hierarchy

```
AgentCard (variant="compact" | "standard" | "detailed")
├── AgentCardCompact / AgentCardStandard / AgentCardDetailed   (article root)
│   ├── Avatar                     (logo; fallback = first letter)
│   ├── RegistryStatus             (loading · pending · live · offline · updating)
│   ├── AgentBadge ×n              (erc8004-verified · builder-verified · audited · trending · featured · new · experimental · coming-soon)
│   ├── VerificationBadge          (ERC-8004 / builder / none)
│   ├── RiskBadge                  (low · medium · high · critical · unknown)
│   ├── CapabilityTag ×n           (capability facet tags)
│   ├── ProtocolChip ×n            (protocol chips w/ verified dot)
│   ├── FavoriteButton             (aria-pressed, heart)
│   ├── CompareCheckbox            (role=checkbox, aria-checked)
│   └── footer: View Details button · Hire (Coming Soon, disabled until live registry)
└── states.tsx
    ├── SkeletonAgentCard         (mirrors each variant's layout)
    ├── AgentCardLoadingState     (role="status" grid of skeletons)
    ├── AgentCardEmptyState       (wraps EmptyState)
    └── PendingHint               ("Waiting for registry sync" pill)
```

## 3. Props interface

```ts
interface AgentCardProps {
  agent: AgentCardData; // domain data, read-only
  favorite?: { active: boolean; onToggle(): void };
  compare?: { selected: boolean; onToggle(): void };
  onViewDetails?: (agent: AgentCardData) => void;
  variant?: "compact" | "standard" | "detailed"; // AgentCard only
  className?: string;
}
```

State ownership: cards are stateless, data comes in as props;
favorite/compare/hire state lives at the page layer, so the same card works in
home, marketplace, dashboard, favorites and future ERC-8004 views.

`AgentCardData` (mandatory only name + registry):

| Field                                                                                                                                                    | Type            | Notes                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------- |
| registry                                                                                                                                                 | `{chainId, id}` | unique registry row             |
| name                                                                                                                                                     | `string`        | 8004scan name                   |
| logoUrl                                                                                                                                                  | `string?`       | tokenURI logo; fallback initial | </think> —————— |
| Sorry, the write got cut off mid-way (I wrote a placeholder line and then a trailing marker). Let me rewrite the validation doc properly and completely. |

<｜DSML｜tool_calls>
<｜DSML｜invoke name="write">
<｜DSML｜parameter name="content" string="true"># Agent Card System — Validation Record

**Status:** lint · typecheck · build all green (`@bnb-marketplace/ui`)
**Location:** `packages/ui/src/components/agent-card/`
**Scope:** Sprint 2 component 1 — design-system card system, UI only.
No Marketplace page, no APIs, no ERC-8004 / 8004scan connectivity, no backend.

---

## 1. Folder structure

```
packages/ui/src/components/agent-card/
├── index.tsx                   # AgentCard compound entry point (variant switch)
├── types.ts                   # domain model + actions + variant types (UI-only, source-mapped)
├── agent-card-compact.tsx     # compact variant — search/result row
├── agent-card-standard.tsx    # standard variant — primary marketplace card
├── agent-card-detailed.tsx    # detailed variant — dashboard / favorites
├── agent-badges.tsx           # AgentBadge · RiskBadge · VerificationBadge · CapabilityTag · ProtocolChip
├── registry-status.tsx        # RegistryStatus — 5 sync states
├── favorite-compare.tsx       # FavoriteButton · CompareCheckbox
└── states.tsx                 # SkeletonAgentCard · AgentCardLoadingState · AgentCardEmptyState · PendingHint
```

All exported from `packages/ui/src/index.ts` (components + `export type * from .../types.js`).

## 2. Component hierarchy

```
AgentCard (variant="compact" | "standard" | "detailed")
├── AgentCardCompact / AgentCardStandard / AgentCardDetailed   — shared article shell
│   ├── Avatar (logo, first-letter fallback)
│   ├── RegistryStatus (loading · pending · offline · live · updating)
│   ├── AgentBadge       (erc8004-verified · builder-verified · audited · trending · featured · new · experimental · coming-soon)
│   ├── RiskBadge        (low · medium · high · critical · unknown; "—" until known)
│   ├── VerificationBadge (erc8004 / builder / none)
│   ├── CapabilityTag ×n
│   ├── ProtocolChip ×n   (with verified dot)
│   ├── FavoriteButton    (aria-pressed)
│   ├── CompareCheckbox   (role=checkbox)
│   └── actions: View Details → onViewDetails(agent) · Hire (disabled "Soon")
└── states
    ├── SkeletonAgentCard        — shape-matches the chosen variant
    ├── AgentCardLoadingState    — role="status" skeleton grid (default 6)
    ├── AgentCardEmptyState      — no-agent empty view
    └── PendingHint              — "Waiting for registry sync" pill
```

## 3. Props

```ts
type AgentCardVariant = "compact" | "standard" | "detailed";

interface AgentCardActions {
  favorite?: { active: boolean; onToggle: () => void }; // omit → hidden
  compare?: { selected: boolean; onToggle: () => void }; // omit → hidden
  onViewDetails?: (agent: AgentCardData) => void;
}

// <AgentCard agent={agent} variant="standard" favorite={…} compare={…} onViewDetails={…} />
type AgentCardProps = { agent: AgentCardData; variant?: AgentCardVariant } & AgentCardActions & {
    className?: string;
  };
```

- Cards never own state — the page owns favorite/compare; cards expose handlers.
- All fields optional except `registry`, `name` — the rest degrade gracefully.

## 4. Future data mapping (field → production source)

| Display field              | Source                                     | Loading/empty behavior            |
| -------------------------- | ------------------------------------------ | --------------------------------- |
| name                       | 8004scan agent detail `name`               | —                                 |
| logoUrl                    | 8004scan `agentUri                         | tokenURI` logo                    | `Avatar` initial fallback |
| description                | registry `description` / partner payload   | muted "No description yet"        |
| category                   | registry category slot                     | hidden if absent                  |
| capabilities               | agent capabilities manifest                | hidden / "Syncing" note           |
| protocols                  | integrations (PancakeSwap, Altana, …)      | chips · hidden when empty         |
| reputation score · reviews | 8004scan feedbacks (`/feedback`)           | "Awaiting registry feedback"      |
| risk                       | registry flags + editor decision           | `—` (RiskBadge "unknown")         |
| builder                    | registry `owner` (+ ENS / agent studio)    | "Builder pending"                 |
| builder.verified           | registry request/app stamp                 | VerificationBadge "none" → hidden |
| registryStatus             | live chain query                           | `loading/pending/…` pill          |
| updatedAt                  | registry `block` ts / sync timestamp       | "Updated — registry" text         |
| badges                     | flags (audited, experimental…) + editorial | hidden when empty                 |
| hireable                   | marketplace job rail (coming soon)         | disabled button "Hire · Soon"     |

## 5. Accessibility checklist

- `article` landmark per card; heading (`h3`) per card name
- favorite: `aria-pressed` toggle · compare: `role="checkbox"` + `aria-checked`
- skeleton containers `aria-hidden="true"`; loading grid `role="status"` + `aria-label`
- RegistryStatus uses `role="status"`, no focusable animation
- focus-visible rings on every button, `:focus-visible` Tailwind pattern
- `disabled` Hire still focusable w/ tooltip title; never removes content
- hover states never the only cue; color not sole signal (icons + text)
- minimum target ≥ 32–36px on interactive atoms

## 6. Responsive behavior

- Compact: min-width 0 truncation, wraps badges to 2 rows on ≤ mobile
- Standard: stack (flex-col) always; footer buttons `flex-1` equal; badge rows wrap
- Detailed: 2-col meta grid → 1 col `sm:` breakpoint; badges/capabilities wrap
- No horizontal scroll in any width; skeleton widths mirror live layout
