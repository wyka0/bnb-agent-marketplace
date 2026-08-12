# Marketplace Design System

**Status:** implemented · lint + typecheck + build green (`@bnb-marketplace/ui`)
**Location:** `packages/ui/src/components/marketplace/`
**Import:** `@bnb-marketplace/ui` (curated) or `@bnb-marketplace/ui/marketplace` (full kit)

The foundation layer for every marketplace-style screen — Marketplace,
Categories, Dashboard, Compare, Search, Favorites, and future Admin pages. All
components are **page-agnostic, controlled, and data-free**: they render state
passed to them and emit events. No pages, no APIs, no ERC-8004 calls, no
backend logic live here.

> Success criterion: the Marketplace page can be assembled entirely from these
> components without writing new UI primitives.

---

## 1. Folder structure

```
packages/ui/src/components/marketplace/
├── index.ts            # barrel — exports the full kit
├── tokens.ts           # data-state design tokens (visual language)
├── badges.tsx          # 8 badges + shared StateBadge renderer
├── filters.tsx         # FilterSidebar/Section/Group/Chip/Checkbox/Radio/Toggle
├── toolbar.tsx         # Search/Sort/View/Grid toggles + active-filter bar
├── layout.tsx          # Container/Header/Layout/Sidebar/Content/Grid/Divider
├── empty-states.tsx    # 6 empty presets + MarketplaceEmptyState base
└── loading.tsx         # skeletons: card/grid/filters/sidebar/search/toolbar/pagination
```

Pagination is re-exported from the shared primitive (`../pagination.js`) so the
kit is complete without duplicating it.

## 2. Component hierarchy

```
MarketplaceContainer                     (max-width, gutters)
└── MarketplaceHeader                     (title / subtitle / actions)
└── StickyToolbar                         (optional pin under header)
    └── SearchToolbar
        ├── SearchInput · ResultCounter
        └── actions: SortDropdown · ViewToggle · GridToggle
└── ActiveFilterBar
    ├── FilterBadge ×n
    └── ResetFiltersButton
└── MarketplaceLayout                     (responsive sidebar + content grid)
    ├── MarketplaceSidebar
    │   └── FilterSidebar
    │       └── FilterSection ×n
    │           └── FilterGroup
    │               └── FilterChip | FilterCheckbox | FilterRadio | FilterToggle
    └── MarketplaceContent
        ├── SectionDivider
        ├── MarketplaceGrid                (state: results)
        │   └── <AgentCard …>              (from agent-card system)
        ├── SkeletonGrid                    (state: loading)
        ├── NoSearchResults / NoAgents / … (state: empty)
        ├── RegistryOffline / LoadingRegistry (state: registry)
        └── Pagination

Badges (used inside cards, filters, headers):
  VerificationBadge · RiskBadge · RegistryBadge · ActivityBadge ·
  BuilderBadge · ProtocolBadge · StatusBadge · ReputationBadge
     └── all wrap → StateBadge → reads a StateToken from tokens.ts
```

## 3. Design token documentation

`tokens.ts` is the single source of truth. Each state maps to a `StateToken`:

```ts
interface StateToken {
  label: string; // human label
  icon: React.ComponentType<{ className?: string }>; // lucide icon
  className: string; // merged background + border + text (light + dark)
  dot: string; // standalone dot colour for compact indicators
  animated?: boolean; // drives spinner / pulse
  weight: 0 | 1 | 2 | 3; // severity, for sorting / emphasis
}
```

Colour surfaces (Part 3): every token bundles **background + border + text**
in `className`, an **icon** component, a **dot**, and — because they are
Tailwind utility classes — **hover** (via component classes) and **light/dark**
(each tinted background is paired with a `dark:` text colour). No new CSS
variables; semantic app tokens (`primary`, `muted`, `border`, `destructive`,
`ring`) plus fixed scales (emerald/amber/orange/red/sky/violet) are used.

### State → token → icon map (Parts 2 & 4)

Icon system: **lucide-react** (already the app's icon set), one consistent family.

| Domain           | State             | Icon               | Colour       |
| ---------------- | ----------------- | ------------------ | ------------ |
| **Verification** | verified          | `BadgeCheck`       | emerald      |
|                  | pending           | `Clock3` (pulse)   | amber        |
|                  | unverified        | `ShieldX`          | neutral      |
|                  | deprecated        | `CircleSlash`      | destructive  |
| **Registry**     | synced            | `Database`         | emerald      |
|                  | updating          | `RefreshCw` (spin) | sky          |
|                  | waiting           | `Clock3` (pulse)   | amber        |
|                  | offline           | `WifiOff`          | destructive  |
|                  | unknown           | `CircleSlash`      | neutral      |
| **Risk**         | low               | `ShieldCheck`      | emerald      |
|                  | medium            | `ShieldAlert`      | amber        |
|                  | high              | `AlertTriangle`    | orange       |
|                  | critical          | `AlertTriangle`    | red          |
| **Reputation**   | excellent         | `Star`             | emerald      |
|                  | good              | `Star`             | sky          |
|                  | average           | `Gauge`            | amber        |
|                  | unknown           | `Minus`            | neutral      |
| **Activity**     | trending          | `TrendingUp`       | amber        |
|                  | popular           | `Activity`         | violet       |
|                  | new               | `Plus`             | sky          |
|                  | stable            | `Activity`         | emerald      |
|                  | inactive          | `Minus`            | neutral      |
| **Builder**      | verified-builder  | `UserCheck`        | emerald      |
|                  | community-builder | `Users`            | sky          |
|                  | unknown-builder   | `CircleSlash`      | neutral      |
|                  | experimental      | `FlaskConical`     | orange       |
| **Agent status** | live              | `BadgeCheck`       | emerald      |
|                  | paused            | `Pause`            | amber        |
|                  | updating          | `RefreshCw` (spin) | sky          |
|                  | coming-soon       | `Sparkles`         | violet       |
|                  | retired           | `CircleSlash`      | neutral      |
| **Protocol**     | (name-driven)     | `ShieldCheck`      | neutral card |

Colour semantics: **emerald = healthy/good**, **amber = attention/pending**,
**orange = elevated risk**, **red/destructive = danger/failure**,
**sky = in-progress/new**, **violet = editorial/featured**, **neutral = unknown**.

## 4. Badge API

All eight badges share **one API**. Only the `state` prop's type differs.

```ts
interface BadgeBaseProps {
  size?: "sm" | "md" | "lg"; // default "md"
  variant?: "solid" | "soft" | "dot"; // default "soft"
  withIcon?: boolean; // default true
  label?: string; // override token label
  className?: string;
}
```

| Component           | `state` type                                |
| ------------------- | ------------------------------------------- |
| `VerificationBadge` | `VerificationState`                         |
| `RiskBadge`         | `RiskLevel`                                 |
| `RegistryBadge`     | `RegistryState` (announces `role="status"`) |
| `ActivityBadge`     | `ActivityLevel`                             |
| `BuilderBadge`      | `BuilderStatus`                             |
| `StatusBadge`       | `AgentStatus` (announces `role="status"`)   |
| `ReputationBadge`   | `ReputationLevel`                           |
| `ProtocolBadge`     | _(uses `label` instead of `state`)_         |

```tsx
<VerificationBadge state="verified" />
<RiskBadge state="high" size="sm" />
<RegistryBadge state="updating" />           // spinner auto-applied
<StatusBadge state="coming-soon" variant="dot" />
<ProtocolBadge label="PancakeSwap" />
```

> Note: `VerificationBadge` / `RiskBadge` here are the state-driven marketplace
> badges. At the root barrel they are aliased to
> `MarketplaceVerificationBadge` / `MarketplaceRiskBadge` to coexist with the
> agent-card badges; the un-aliased names are available from
> `@bnb-marketplace/ui/marketplace`.

## 5. Accessibility guide (Part 9)

- **Keyboard navigation** — every interactive element is a native
  `button`/`input`/`label`; `FilterSection` header is a real `<button>` with
  `aria-expanded`/`aria-controls`; tab order follows source order (content is
  ordered before the sidebar in `MarketplaceLayout` for logical reading).
- **ARIA roles** — `FilterChip` → `role="checkbox"` + `aria-checked`;
  `FilterToggle` → `role="switch"` + `aria-checked`; `FilterGroup` →
  `group`/`radiogroup`; `ViewToggle`/`GridToggle` buttons use `aria-pressed`;
  `ResultCounter` is `aria-live="polite"`; `RegistryBadge`/`StatusBadge`,
  `SkeletonGrid`, `RegistryOffline`, `LoadingRegistry` expose `role="status"`.
- **Labels** — `SearchInput` has an associated (visually hidden) `<label>` and
  an explicit "Clear search" button label; `FilterBadge` remove buttons carry a
  descriptive `aria-label`.
- **Focus states** — consistent `focus-visible:ring-2 ring-ring ring-offset-2`
  on all controls (matches existing primitives).
- **Reduced motion** — motion is limited to `animate-pulse` / `animate-spin` /
  short transitions; consumers should honour `prefers-reduced-motion` at the app
  layer (e.g. a global `motion-reduce:animate-none` utility) — no component
  hard-codes essential meaning into motion; every animated state also has an
  icon + text label.
- **High contrast** — colour is never the only signal: each state pairs a colour
  with an icon and a text label. Backgrounds are tinted at 10% with 40% borders
  and AA-oriented text colours in both themes.

## 6. Responsive rules (Part 8)

Tailwind breakpoints: `sm 640` · `md 768` · `lg 1024` · `xl 1280`.

| Tier         | Width      | Behaviour                                                      |
| ------------ | ---------- | -------------------------------------------------------------- |
| Desktop      | ≥1280 (xl) | Sidebar + content; grid 3 (comfortable) / 4 (compact) cols     |
| Laptop       | ≥1024 (lg) | Sidebar + content; grid 2–3 cols; sidebar becomes sticky       |
| Tablet       | ≥768 (md)  | Single column; sidebar stacks above content; grid 2 cols       |
| Mobile       | <768       | Single column; toolbar wraps (search over actions); grid 1 col |
| Small mobile | <400       | Fluid gutters (`px-4`), chips/badges wrap, no overflow         |

- `MarketplaceLayout` collapses the two-column grid to one below `lg`.
- `MarketplaceGrid` column counts respond to `density` and `list`.
- `MarketplaceSidebar` is `lg:sticky` with its own scroll; static on mobile.
- `SearchToolbar` switches from row to column below `sm`.

## 7. Animation rules (Part 10)

Subtle only — no large or looping motion beyond status indicators.

| Animation         | Where                     | Implementation                               |
| ----------------- | ------------------------- | -------------------------------------------- |
| Hover elevation   | cards / interactive tiles | `hover:-translate-y-0.5` + shadow            |
| Fade / zoom       | dropdown menu             | Radix `data-[state]` fade/zoom               |
| Shimmer           | skeletons                 | `animate-pulse` on `Skeleton`                |
| Glow              | primary actions           | `hover:shadow-[…primary…]`                   |
| Selection         | chips/checkbox/toggle     | `transition-colors` / `transition-transform` |
| Filter transition | section collapse          | height/`rotate-180` chevron, 200ms           |
| Status motion     | pending/updating          | `animate-pulse` dot / `animate-spin` refresh |

Guidance: durations ≤200ms, `transition-colors`/`transition-transform`
preferred; motion is decorative and always accompanied by a non-motion signal.

## 8. Usage examples

### Assemble a Marketplace page from the kit (no new UI)

```tsx
import {
  MarketplaceContainer,
  MarketplaceHeader,
  MarketplaceLayout,
  MarketplaceSidebar,
  MarketplaceContent,
  MarketplaceGrid,
  FilterSidebar,
  FilterSection,
  FilterGroup,
  FilterCheckbox,
  FilterToggle,
  SearchToolbar,
  SearchInput,
  ResultCounter,
  SortDropdown,
  ViewToggle,
  ActiveFilterBar,
  FilterBadge,
  SkeletonGrid,
  NoSearchResults,
  Pagination,
  AgentCard,
} from "@bnb-marketplace/ui";

export function MarketplacePage(props: MarketplaceVM) {
  const {
    query,
    setQuery,
    sort,
    setSort,
    view,
    setView,
    results,
    loading,
    page,
    totalPages,
    goPage,
    activeFilters,
    resetFilters,
  } = props; // page owns all state

  return (
    <MarketplaceContainer>
      <MarketplaceHeader title="Agent Marketplace" subtitle="Discover ERC-8004 agents" />

      <SearchToolbar
        actions={
          <>
            <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
            <ViewToggle value={view} onChange={setView} />
          </>
        }
      >
        <SearchInput value={query} onChange={setQuery} />
        <ResultCounter count={results.length} total={props.total} loading={loading} />
      </SearchToolbar>

      <ActiveFilterBar hasActiveFilters={activeFilters.length > 0} onReset={resetFilters}>
        {activeFilters.map((f) => (
          <FilterBadge key={f.id} facet={f.facet} label={f.label} onRemove={f.remove} />
        ))}
      </ActiveFilterBar>

      <MarketplaceLayout
        sidebar={
          <MarketplaceSidebar>
            <FilterSidebar>
              <FilterSection title="Category">
                <FilterGroup>
                  {props.categories.map((c) => (
                    <FilterCheckbox
                      key={c.id}
                      label={c.label}
                      count={c.count}
                      checked={c.checked}
                      onToggle={c.toggle}
                    />
                  ))}
                </FilterGroup>
              </FilterSection>
              <FilterSection title="Trust">
                <FilterToggle
                  label="Verified only"
                  checked={props.verifiedOnly}
                  onToggle={props.toggleVerified}
                />
              </FilterSection>
            </FilterSidebar>
          </MarketplaceSidebar>
        }
      >
        <MarketplaceContent>
          {loading ? (
            <SkeletonGrid
              count={9}
              density={view === "list" ? "comfortable" : "comfortable"}
              list={view === "list"}
            />
          ) : results.length === 0 ? (
            <NoSearchResults query={query} />
          ) : (
            <MarketplaceGrid list={view === "list"}>
              {results.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  variant={view === "list" ? "compact" : "standard"}
                />
              ))}
            </MarketplaceGrid>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={goPage} />
        </MarketplaceContent>
      </MarketplaceLayout>
    </MarketplaceContainer>
  );
}
```

### Badges & data states

```tsx
<VerificationBadge state="verified" />
<RegistryBadge state="offline" />
<StatusBadge state="coming-soon" />
<RiskBadge state="critical" size="lg" />
```

## 9. Marketplace Design System documentation (summary)

- **Reuse contract** — every component is controlled + data-free; the page owns
  state (query, sort, view, density, filters, pagination) and passes handlers.
- **Consistency** — one token file drives all colours/icons/labels, so a state
  looks identical across Marketplace, Compare, Dashboard, Favorites and Admin.
- **Honesty** — loading uses skeletons that mirror real layout; missing data
  renders empty/offline presets, never fabricated values.
- **Composability** — layout, toolbar, filters, badges, states and pagination
  are independent; screens pick what they need.
- **Extensibility** — new states = new `StateToken` entries; new screens reuse
  the same primitives. The Marketplace page is buildable with **no new UI
  components**.
