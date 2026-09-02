"use client";

/**
 * Marketplace view — Sprint 2B "Marketplace Framework" + Main Track P1 live
 * catalog wiring + Main Track P8 BSC category discovery.
 *
 * Receives the server-fetched `MarketplaceData` (discriminated honest states)
 * plus the P8 `BscDiscoveryData` (bounded BSC category discovery) and renders
 * the EXACT existing UI: toolbar, filters, URL state. The results grid
 * renders real `AgentCard`s from the live 8004scan records when the data is
 * `ready`; every other state (missing-key, empty, unauthorized, forbidden,
 * rate-limited, server-error, network-error, error) renders an honest state —
 * never fake cards, never fabricated numbers.
 *
 * Search + filters run CLIENT-SIDE over real fetched records using only fields
 * the registry actually provides (name, description, protocols, verification).
 * P8: a Category facet now surfaces the matching BSC discovery bucket — live
 * chain-56 records whose category match is an INFERENCE from 8004scan
 * metadata (never an 8004scan classification), each carrying its evidence
 * excerpt. Unknown/empty buckets keep the honest promise: zero matches are
 * shown as "No verified BSC agents found for this category."
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  // layout
  MarketplaceContainer,
  MarketplaceHeader,
  MarketplaceLayout,
  MarketplaceSidebar,
  MarketplaceContent,
  MarketplaceGrid,
  // toolbar
  StickyToolbar,
  SearchToolbar,
  SearchInput,
  SortDropdown,
  ViewToggle,
  GridToggle,
  ActiveFilterBar,
  FilterBadge,
  ResetFiltersButton,
  // filters
  FilterSidebar,
  FilterSection,
  FilterGroup,
  FilterCheckbox,
  FilterChip,
  FilterToggle,
  FilterRadio,
  // cards + states
  AgentCard,
  RegistryBadge,
  NoAgents,
  NoSearchResults,
  RegistryOffline,
  MarketplaceEmptyState,
  // shared primitives
  Pagination,
  Button,
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@bnb-marketplace/ui";
import { Database, Scale, SlidersHorizontal } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  applyMarketplaceFilters,
  sortMarketplaceAgents,
  type MarketplaceData,
  type MarketplaceSortKey,
  type MarketplaceNetworkScope,
} from "@/lib/eight004scan/marketplace";
import { NetworkSelector } from "./network-selector";
import { discoveryCategoryKeyFromLabel } from "@/lib/eight004scan/discovery/classifier";
import type { BscDiscoveryData, DiscoveredAgent } from "@/lib/eight004scan/discovery/service";
import { toAgentCardData } from "@/lib/eight004scan/card";

/** Local mirror of the design-system ViewToggle value (kept inline so the
 * design system is not modified for this assembly-only sprint). */
type ViewMode = "grid" | "list";

/**
 * Toolbar status — real result count when the catalog is ready, otherwise the
 * honest waiting/unavailable hint. Never blank and never a fake number.
 */
function RegistryStatusCount({
  ready,
  shown,
  total,
  className,
}: {
  ready: boolean;
  shown?: number;
  total?: number;
  className?: string;
}) {
  return (
    <p
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground ${className ?? ""}`}
    >
      <Database className="h-3.5 w-3.5" aria-hidden="true" />
      {ready ? (
        <>
          {shown} / {total ?? shown} agents · 8004scan
        </>
      ) : (
        "Waiting for ERC-8004 Registry"
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * Static facet definitions (labels only — counts arrive with 8004scan).
 * These mirror the UX-Blueprint filter priority order exactly.
 * ------------------------------------------------------------------ */

// Category — the four equal-priority product categories (TIS §10 / PRD).
const CATEGORIES = ["Rebalancing", "Grid Trading", "Yield Optimization", "Health Factor"] as const;
const VERIFICATIONS = ["Verified", "Pending", "Unverified", "Deprecated"] as const;
const RISKS = ["Low", "Medium", "High", "Critical"] as const;
const PROTOCOLS = ["PancakeSwap", "Aave", "Venus", "Altana"] as const;
const BUILDERS = [
  "Verified Builder",
  "Community Builder",
  "Unknown Builder",
  "Experimental",
] as const;
const REGISTRY_STATES = ["Synced", "Updating", "Waiting", "Offline"] as const;
const ACTIVITY = ["Trending", "Popular", "New", "Stable"] as const;
const STATUS = ["Live", "Paused", "Updating", "Coming Soon"] as const;

const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "featured", label: "Featured" },
  { value: "verified", label: "Verified" },
  { value: "reputation", label: "Highest Reputation" },
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "alphabetical", label: "Alphabetical" },
];

/** Stable DOM id for the marketplace search input (header search targets it). */
export const MARKETPLACE_SEARCH_INPUT_ID = "marketplace-search-input";

/** Toggle a value inside a string-set, returning a new Set. */
function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/* ------------------------------------------------------------------ *
 * URL-state helpers (Sprint 2D — Navigation & Routing).
 *
 * The marketplace toolbar/filter state is mirrored to the URL search params so
 * it survives navigation to an agent and back (and is shareable). Pure string
 * (de)serialization — no querying, no data. Multi-select facets serialize as
 * comma-separated values; the single-select registry and boolean builder use
 * simple scalars. Defaults (sort=featured, view=grid, density=comfortable) are
 * omitted from the URL to keep it clean.
 * ------------------------------------------------------------------ */

const DEFAULT_SORT = "featured";

/** Read a comma-separated multi-select param, filtered to the allowed set. */
function readSet(params: URLSearchParams, key: string, allowed: readonly string[]): Set<string> {
  const raw = params.get(key);
  if (!raw) return new Set();
  const allow = new Set(allowed);
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => allow.has(s))
  );
}

/** Read a single scalar param constrained to the allowed set (else fallback). */
function readOne<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = params.get(key);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** Build the canonical query string from the current marketplace state. */
function buildQueryString(state: {
  query: string;
  sort: string;
  view: ViewMode;
  density: "comfortable" | "compact";
  categories: Set<string>;
  verifications: Set<string>;
  risks: Set<string>;
  protocols: Set<string>;
  registryState: string;
  activity: Set<string>;
  status: Set<string>;
  verifiedBuildersOnly: boolean;
  compareSlugs: Set<string>;
  network?: string;
}): string {
  const p = new URLSearchParams();
  if (state.query) p.set("q", state.query);
  if (state.sort && state.sort !== DEFAULT_SORT) p.set("sort", state.sort);
  if (state.view !== "grid") p.set("view", state.view);
  if (state.density !== "comfortable") p.set("density", state.density);
  if (state.categories.size) p.set("category", [...state.categories].join(","));
  if (state.verifications.size) p.set("verification", [...state.verifications].join(","));
  if (state.risks.size) p.set("risk", [...state.risks].join(","));
  if (state.protocols.size) p.set("protocol", [...state.protocols].join(","));
  if (state.registryState) p.set("registry", state.registryState);
  if (state.activity.size) p.set("activity", [...state.activity].join(","));
  if (state.status.size) p.set("status", [...state.status].join(","));
  if (state.verifiedBuildersOnly) p.set("builder", "verified");
  if (state.compareSlugs.size) p.set("compare", [...state.compareSlugs].join(","));
  // X.216 — explicit discovery-network selection persists in the URL; the
  // default ("all") stays out (clean canonical URL).
  if (state.network && state.network !== "all") p.set("network", state.network);
  return p.toString();
}

export function MarketplaceView({
  data,
  discovery = null,
  scope = "all",
}: {
  data: MarketplaceData;
  discovery?: BscDiscoveryData | null;
  /** X.216 — discovery-network scope (read-only prop; switching is URL-driven). */
  scope?: MarketplaceNetworkScope;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize toolbar/filter state from the URL once (lazy initializers), so
  // returning from an agent restores search / sort / view / filters. Reading the
  // snapshot a single time on mount is intentional.
  const [initial] = React.useState<URLSearchParams>(
    () => new URLSearchParams(searchParams.toString())
  );
  const [query, setQuery] = React.useState(() => initial.get("q") ?? "");
  // X.204 — when the header search navigates here with ?focus=1, focus the
  // live search input after mount (uses the stable id the header targets).
  React.useEffect(() => {
    if (searchParams.get("focus") === "1") {
      const el = document.getElementById(MARKETPLACE_SEARCH_INPUT_ID);
      if (el instanceof HTMLInputElement) {
        el.focus();
        el.select();
      }
    }
  }, [searchParams]);
  // Default selection is "Featured" — meaningful to users (Sprint 2B polish FIX 1).
  const [sort, setSort] = React.useState<string>(() =>
    readOne(
      initial,
      "sort",
      SORT_OPTIONS.map((o) => o.value),
      DEFAULT_SORT
    )
  );
  const [view, setView] = React.useState<ViewMode>(() =>
    readOne(initial, "view", ["grid", "list"] as const, "grid")
  );
  const [density, setDensity] = React.useState<"comfortable" | "compact">(() =>
    readOne(initial, "density", ["comfortable", "compact"] as const, "comfortable")
  );

  // Filter UI state.
  const [categories, setCategories] = React.useState<Set<string>>(() =>
    readSet(initial, "category", CATEGORIES)
  );
  const [verifications, setVerifications] = React.useState<Set<string>>(() =>
    readSet(initial, "verification", VERIFICATIONS)
  );
  const [risks, setRisks] = React.useState<Set<string>>(() => readSet(initial, "risk", RISKS));
  const [protocols, setProtocols] = React.useState<Set<string>>(() =>
    readSet(initial, "protocol", PROTOCOLS)
  );
  const [registryState, setRegistryState] = React.useState<string>(() => {
    const raw = initial.get("registry");
    return raw && (REGISTRY_STATES as readonly string[]).includes(raw) ? raw : "";
  });
  const [activity, setActivity] = React.useState<Set<string>>(() =>
    readSet(initial, "activity", ACTIVITY)
  );
  const [status, setStatus] = React.useState<Set<string>>(() => readSet(initial, "status", STATUS));
  const [verifiedBuildersOnly, setVerifiedBuildersOnly] = React.useState(
    () => initial.get("builder") === "verified"
  );
  const [compareSlugs, setCompareSlugs] = React.useState<Set<string>>(
    () => new Set((initial.get("compare") ?? "").split(",").filter(Boolean).slice(0, 3))
  );

  // Mirror state → URL (replace, no scroll reset, no new history entry) so the
  // marketplace is shareable and survives an agent round-trip.
  const queryString = buildQueryString({
    query,
    sort,
    view,
    density,
    categories,
    verifications,
    risks,
    protocols,
    registryState,
    activity,
    status,
    verifiedBuildersOnly,
    compareSlugs,
    network: scope,
  });
  React.useEffect(() => {
    const current = searchParams.toString();
    if (current === queryString) return;
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [queryString, pathname, router, searchParams]);

  const isReady = data.state === "ready";
  const allAgents = isReady ? data.agents : [];

  // Active-filter chips are derived from the raw filter state.
  const activeFilters = React.useMemo(() => {
    const list: { facet: string; label: string; onRemove: () => void }[] = [];
    categories.forEach((c) =>
      list.push({
        facet: "Category",
        label: c,
        onRemove: () => setCategories((s) => toggleInSet(s, c)),
      })
    );
    verifications.forEach((v) =>
      list.push({
        facet: "Verification",
        label: v,
        onRemove: () => setVerifications((s) => toggleInSet(s, v)),
      })
    );
    risks.forEach((r) =>
      list.push({ facet: "Risk", label: r, onRemove: () => setRisks((s) => toggleInSet(s, r)) })
    );
    protocols.forEach((p) =>
      list.push({
        facet: "Protocol",
        label: p,
        onRemove: () => setProtocols((s) => toggleInSet(s, p)),
      })
    );
    activity.forEach((a) =>
      list.push({
        facet: "Activity",
        label: a,
        onRemove: () => setActivity((s) => toggleInSet(s, a)),
      })
    );
    status.forEach((s2) =>
      list.push({
        facet: "Status",
        label: s2,
        onRemove: () => setStatus((s) => toggleInSet(s, s2)),
      })
    );
    if (registryState)
      list.push({ facet: "Registry", label: registryState, onRemove: () => setRegistryState("") });
    if (verifiedBuildersOnly)
      list.push({
        facet: "Builder",
        label: "Verified only",
        onRemove: () => setVerifiedBuildersOnly(false),
      });
    return list;
  }, [
    categories,
    verifications,
    risks,
    protocols,
    activity,
    status,
    registryState,
    verifiedBuildersOnly,
  ]);

  const hasActiveFilters = activeFilters.length > 0 || query.length > 0;

  const resetAll = React.useCallback(() => {
    setQuery("");
    setCategories(new Set());
    setVerifications(new Set());
    setRisks(new Set());
    setProtocols(new Set());
    setRegistryState("");
    setActivity(new Set());
    setStatus(new Set());
    setVerifiedBuildersOnly(false);
  }, []);

  // P8: BSC category discovery — when a Category facet is selected, the rows
  // come from the real chain-56 discovery buckets (deduped union across the
  // selected categories; category matches are INFERENCES from 8004scan
  // metadata, each backed by its evidence excerpt in the service).
  const discoveryReady = discovery?.state === "ready";
  const discoveryBuckets = discoveryReady ? discovery.buckets : [];
  const discoveryMode = categories.size > 0;

  const catalogReady = discoveryMode ? discoveryReady : isReady;
  const catalogMissingKey = discoveryMode
    ? discovery?.state === "missing-key"
    : data.state === "missing-key";

  const discoveryCountByKey = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const b of discoveryBuckets) m.set(b.key, b.matched);
    return m;
  }, [discoveryBuckets]);

  const discoveryFailedByKey = React.useMemo(() => {
    const m = new Map<string, boolean>();
    for (const b of discoveryBuckets) m.set(b.key, b.state !== "ready" && b.state !== "empty");
    return m;
  }, [discoveryBuckets]);

  /** Live matched count for a facet label — only when the bucket is usable. */
  const countForCategory = React.useCallback(
    (label: string): number | undefined => {
      if (!discoveryReady) return undefined;
      const key = discoveryCategoryKeyFromLabel(label);
      return discoveryFailedByKey.get(key) ? undefined : discoveryCountByKey.get(key);
    },
    [discoveryReady, discoveryCountByKey, discoveryFailedByKey]
  );

  // Union of the selected buckets (multi-select), deduped by registry identity.
  const discoveredRows = React.useMemo(() => {
    if (!discoveryReady || !discoveryMode) return null;
    const keys = [...categories].map(discoveryCategoryKeyFromLabel);
    const bySlug = new Map<string, DiscoveredAgent>();
    for (const bucket of discoveryBuckets) {
      if (!keys.includes(bucket.key)) continue;
      for (const item of bucket.discovered) bySlug.set(item.agent.slug, item);
    }
    return [...bySlug.values()];
  }, [discoveryReady, discoveryMode, discoveryBuckets, categories]);

  // Client-side search + filters + sort over REAL records. In discovery mode
  // the category facet is already satisfied by the bucket selection, so it is
  // removed before the remaining facets (verification/protocols/query/…) apply.
  const rows = React.useMemo(() => {
    if (discoveredRows) {
      const filters = {
        query,
        categories: new Set<string>(),
        verifications,
        risks,
        protocols,
        activities: activity,
        statuses: status,
        registryStates: registryState ? new Set([registryState]) : new Set<string>(),
        verifiedBuildersOnly,
      };
      return sortMarketplaceAgents(
        applyMarketplaceFilters(
          discoveredRows.map((d) => d.agent),
          filters
        ),
        sort as MarketplaceSortKey
      );
    }
    if (!isReady) return [];
    const filters = {
      query,
      categories,
      verifications,
      risks,
      protocols,
      activities: activity,
      statuses: status,
      registryStates: registryState ? new Set([registryState]) : new Set<string>(),
      verifiedBuildersOnly,
    };
    return sortMarketplaceAgents(
      applyMarketplaceFilters(allAgents, filters),
      sort as MarketplaceSortKey
    );
  }, [
    isReady,
    discoveredRows,
    allAgents,
    query,
    sort,
    categories,
    verifications,
    risks,
    protocols,
    activity,
    status,
    registryState,
    verifiedBuildersOnly,
  ]);

  const cards = React.useMemo(() => rows.map(toAgentCardData), [rows]);
  // Discovery buckets are single bounded pages — no pagination exists there.
  const total = discoveryMode ? rows.length : (data.pagination?.total ?? rows.length);

  const goToAgent = React.useCallback(
    (card: { href?: string }) => {
      if (card.href) router.push(card.href);
    },
    [router]
  );

  const toggleCompare = React.useCallback((slug: string) => {
    setCompareSlugs((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < 3) next.add(slug);
      return next;
    });
  }, []);

  const retry = React.useCallback(() => {
    window.location.reload();
  }, []);

  // The filter panel is shared by the desktop sidebar and the mobile drawer.
  const filterPanel = (
    <FilterSidebar
      title="Filters"
      action={<ResetFiltersButton onReset={resetAll} disabled={!hasActiveFilters} />}
    >
      {/* 1 — Category (default open, highest priority). P8: live matched
          counts from the bounded BSC discovery when available. */}
      <FilterSection title="Category">
        <FilterGroup label="Category">
          {CATEGORIES.map((c) => (
            <FilterCheckbox
              key={c}
              label={c}
              checked={categories.has(c)}
              count={countForCategory(c)}
              onToggle={() => setCategories((s) => toggleInSet(s, c))}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      {/* 2 — Verification */}
      <FilterSection title="Verification">
        <FilterGroup label="Verification">
          {VERIFICATIONS.map((v) => (
            <FilterCheckbox
              key={v}
              label={v}
              checked={verifications.has(v)}
              onToggle={() => setVerifications((s) => toggleInSet(s, v))}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      {/* 3 — Risk */}
      <FilterSection title="Risk">
        <FilterGroup label="Risk">
          {RISKS.map((r) => (
            <FilterCheckbox
              key={r}
              label={r}
              checked={risks.has(r)}
              onToggle={() => setRisks((s) => toggleInSet(s, r))}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      {/* 4 — Protocols (chip layout) */}
      <FilterSection title="Protocols">
        <FilterGroup label="Protocols" layout="wrap">
          {PROTOCOLS.map((p) => (
            <FilterChip
              key={p}
              label={p}
              selected={protocols.has(p)}
              onToggle={() => setProtocols((s) => toggleInSet(s, p))}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      {/* 5 — Builder */}
      <FilterSection title="Builder">
        <FilterToggle
          label="Verified builders only"
          description="Only show ERC-8004 Registry verified builders"
          checked={verifiedBuildersOnly}
          onToggle={() => setVerifiedBuildersOnly((v) => !v)}
        />
        <FilterGroup label="Builder" className="mt-1.5">
          {BUILDERS.map((b) => (
            <FilterCheckbox key={b} label={b} checked={false} onToggle={() => undefined} disabled />
          ))}
        </FilterGroup>
      </FilterSection>

      {/* 6 — Registry (single-select radios) */}
      <FilterSection title="Registry" defaultOpen={false}>
        <FilterGroup label="Registry status" role="radiogroup">
          {REGISTRY_STATES.map((rs) => (
            <FilterRadio
              key={rs}
              name="registry-state"
              value={rs}
              label={rs}
              checked={registryState === rs}
              onSelect={(v) => setRegistryState((cur) => (cur === v ? "" : v))}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      {/* 7 — Activity */}
      <FilterSection title="Activity" defaultOpen={false}>
        <FilterGroup label="Activity" layout="wrap">
          {ACTIVITY.map((a) => (
            <FilterChip
              key={a}
              label={a}
              selected={activity.has(a)}
              onToggle={() => setActivity((s) => toggleInSet(s, a))}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      {/* 8 — Status */}
      <FilterSection title="Status" defaultOpen={false}>
        <FilterGroup label="Status">
          {STATUS.map((s2) => (
            <FilterCheckbox
              key={s2}
              label={s2}
              checked={status.has(s2)}
              onToggle={() => setStatus((s) => toggleInSet(s, s2))}
            />
          ))}
        </FilterGroup>
      </FilterSection>
    </FilterSidebar>
  );

  return (
    <MarketplaceContainer className="py-6 lg:py-8">
      <Breadcrumbs items={[{ label: "Marketplace" }]} />

      <MarketplaceHeader
        title="Marketplace"
        subtitle="Discover verified autonomous AI agents on BNB Chain."
        className="py-4"
      />

      <StickyToolbar className="mb-4" offset={64}>
        <SearchToolbar
          actions={
            <>
              {/* Mobile/laptop: open filters in a drawer (Modal). */}
              <div className="lg:hidden">
                <Modal>
                  <ModalTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="Open filters">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                    </Button>
                  </ModalTrigger>
                  <ModalContent className="max-h-[85vh] overflow-y-auto">
                    <ModalHeader>
                      <ModalTitle>Filters</ModalTitle>
                      <ModalDescription>Refine the agent list. Applies instantly.</ModalDescription>
                    </ModalHeader>
                    {filterPanel}
                  </ModalContent>
                </Modal>
              </div>
              {/* X.216 — symmetric discovery-network selector (confirm-first). */}
              <NetworkSelector
                scope={scope}
                onSwitch={(next) => {
                  // The EXISTING network-switch mechanism: URL param routing.
                  // Build the canonical URL with the explicit network param so
                  // all other toolbar state survives the switch.
                  const p = new URLSearchParams(searchParams.toString());
                  p.set("network", next);
                  p.delete("focus");
                  router.replace(`${pathname}?${p.toString()}`, { scroll: false });
                }}
              />
              <SortDropdown options={SORT_OPTIONS} value={sort} onChange={setSort} />
              <Button
                variant="outline"
                disabled={compareSlugs.size === 0}
                onClick={() =>
                  router.push(`/compare?compare=${encodeURIComponent([...compareSlugs].join(","))}`)
                }
                className="h-10 rounded-md border-input bg-background px-3 text-sm font-medium gap-2"
              >
                <Scale className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
                Compare {compareSlugs.size > 0 ? `${compareSlugs.size}/3` : ""}
              </Button>
              <ViewToggle value={view} onChange={setView} />
              <GridToggle value={density} onChange={setDensity} className="hidden sm:inline-flex" />
            </>
          }
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search the live ERC-8004 registry…"
            inputId={MARKETPLACE_SEARCH_INPUT_ID}
          />
          <RegistryStatusCount
            ready={catalogReady}
            shown={rows.length}
            total={total}
            className="hidden md:inline-flex"
          />
        </SearchToolbar>
      </StickyToolbar>

      {activeFilters.length > 0 ? (
        <ActiveFilterBar hasActiveFilters className="mb-6" onReset={resetAll}>
          {activeFilters.map((f) => (
            <FilterBadge
              key={`${f.facet}-${f.label}`}
              facet={f.facet}
              label={f.label}
              onRemove={f.onRemove}
            />
          ))}
        </ActiveFilterBar>
      ) : null}

      <MarketplaceLayout
        sidebar={
          <MarketplaceSidebar offset={80} className="hidden lg:block">
            {filterPanel}
          </MarketplaceSidebar>
        }
      >
        <MarketplaceContent>
          {/* Section header — real registry status when ready, honest states otherwise. */}
          <div className="border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold tracking-tight">Agents</h2>
              {catalogReady ? (
                <RegistryBadge state="synced" size="sm" />
              ) : catalogMissingKey ? (
                <RegistryBadge state="waiting" size="sm" />
              ) : (
                <RegistryBadge state="offline" size="sm" />
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {discoveryMode ? (
                discoveryReady ? (
                  <>
                    Live BSC category discovery —{" "}
                    {discoveryBuckets
                      .map(
                        (b) =>
                          `${b.label}: ${b.state === "ready" || b.state === "empty" ? b.matched : "—"}`
                      )
                      .join(" · ")}
                    . Categories are inferred from 8004scan metadata (never classified by the
                    registry); each match is backed by its evidence excerpt.{" "}
                    {discovery?.fetchedAt
                      ? `Fetched ${new Date(discovery.fetchedAt).toLocaleString()}.`
                      : ""}
                  </>
                ) : catalogMissingKey ? (
                  "The 8004scan API key is missing on the server. Category discovery requires 8004SCAN_API_KEY (server-only); nothing is simulated meanwhile."
                ) : (
                  "BSC category discovery is unavailable right now. Honest pending status — please retry shortly."
                )
              ) : isReady ? (
                `Live from the 8004scan registry (page 1, newest first). ${data.pagination?.total != null ? `${data.pagination.total.toLocaleString()} agents indexed.` : ""} Last indexed: ${data.lastIndexed ? new Date(data.lastIndexed).toLocaleString() : "—"}.`
              ) : data.state === "missing-key" ? (
                "The 8004scan API key is missing on the server. Add 8004SCAN_API_KEY (server-only) to load live agents; nothing is simulated meanwhile."
              ) : (
                "The ERC-8004 registry is unavailable right now. Data shown is honest pending status — please retry shortly."
              )}
            </p>
          </div>

          {rows.length > 0 ? (
            <div className="mt-4">
              <MarketplaceGrid density={density} list={view === "list"}>
                {cards.map((card, index) => (
                  <AgentCard
                    key={`${card.registry.chainId}:${card.registry.tokenId}`}
                    agent={card}
                    variant={view === "list" ? "compact" : "standard"}
                    onViewDetails={goToAgent}
                    compare={{
                      selected: compareSlugs.has(rows[index]?.slug ?? ""),
                      onToggle: () => {
                        const slug = rows[index]?.slug;
                        if (slug) toggleCompare(slug);
                      },
                    }}
                  />
                ))}
              </MarketplaceGrid>
            </div>
          ) : discoveryMode ? (
            <div className="mt-4">
              {discoveryReady ? (
                <MarketplaceEmptyState
                  icon={Database}
                  title="No verified BSC agents found for this category"
                  description="No verified BSC agents found for this category. Category matches are inferred from 8004scan metadata; the registry currently surfaces no matching chain-56 records for the selected category."
                  action={
                    <Button variant="outline" size="sm" onClick={resetAll}>
                      Clear filters
                    </Button>
                  }
                />
              ) : catalogMissingKey ? (
                <MarketplaceEmptyState
                  icon={Database}
                  title="Category discovery not connected"
                  description="The 8004scan API key is not configured on the server (8004SCAN_API_KEY, server-side only). BSC category discovery will appear once it is set — no placeholder cards are shown."
                />
              ) : (
                <div className="mt-4" role="status">
                  <RegistryOffline
                    action={
                      <Button variant="outline" size="sm" onClick={retry}>
                        Retry
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          ) : !isReady && rows.length === 0 ? (
            data.state === "missing-key" ? (
              <div className="mt-4">
                <MarketplaceEmptyState
                  icon={Database}
                  title="Registry not connected"
                  description="The 8004scan API key is not configured on the server (8004SCAN_API_KEY, server-side only). Live agents will appear once it is set — no placeholder cards are shown."
                />
              </div>
            ) : data.state === "empty" && query.length > 0 ? (
              <div className="mt-4">
                <NoSearchResults
                  query={query}
                  action={
                    <Button variant="outline" size="sm" onClick={resetAll}>
                      Clear search
                    </Button>
                  }
                />
              </div>
            ) : data.state === "empty" ? (
              <div className="mt-4">
                <NoAgents />
              </div>
            ) : (
              <div className="mt-4" role="status">
                <RegistryOffline
                  action={
                    <Button variant="outline" size="sm" onClick={retry}>
                      Retry
                    </Button>
                  }
                />
              </div>
            )
          ) : (
            <div className="mt-4">
              {hasActiveFilters || query.length > 0 ? (
                <NoSearchResults
                  query={query || undefined}
                  action={
                    <Button variant="outline" size="sm" onClick={resetAll}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <NoAgents />
              )}
            </div>
          )}

          {/* Pagination — first bounded page only (no fetch loop); the real
              page count is shown in the toolbar. Discovery buckets are single
              bounded pages → no pagination in discovery mode. */}
          {!discoveryMode ? (
            <div className="mt-8 flex justify-center">
              <Pagination page={1} totalPages={1} onPageChange={() => undefined} />
            </div>
          ) : null}
        </MarketplaceContent>
      </MarketplaceLayout>
    </MarketplaceContainer>
  );
}
