"use client";

/**
 * Leaderboards view â€” Sprint 2F UI (design frozen) + Sprint 2G data wiring.
 *
 * The visual design, layout, columns, filters, metric labels, and copy are
 * UNCHANGED from Sprint 2F. Sprint 2G only feeds real, normalized 8004scan data
 * into the already-existing view states and renders real rows when present.
 * When no data is available (no API key, error, empty, etc.) the page falls
 * back to the exact honest "Waiting for ERC-8004 Registry" states shipped in 2F.
 *
 * URL state: /leaderboards?metric=â€¦&category=â€¦&time=â€¦ (+ q= for search).
 *
 * Columns (desktop table; â‰¤768px cards):
 *   Rank | Agent | Category | Protocol | Active Metric | Risk | Verification | Freshness
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MarketplaceContainer,
  MarketplaceHeader,
  MarketplaceLayout,
  MarketplaceSidebar,
  MarketplaceContent,
  FilterSidebar,
  FilterSection,
  FilterGroup,
  FilterChip,
  FilterRadio,
  StickyToolbar,
  SearchToolbar,
  SearchInput,
  SortDropdown,
  ActiveFilterBar,
  FilterBadge,
  ResetFiltersButton,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  RegistryBadge,
  MarketplaceVerificationBadge,
  WaitingHint,
  NoSearchResults,
  NoAgents,
  RegistryOffline,
  MarketplaceEmptyState,
  Pagination,
  Button,
} from "@bnb-marketplace/ui";
import { ChevronDown, Database, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import type { LeaderboardAgent, LeaderboardData } from "@/lib/eight004scan/leaderboard-types";

type StringOption = { value: string; label: string };

/* ------------------------------------------------------------------ *
 * Static facet + option definitions (labels unchanged from Sprint 2F).
 * ------------------------------------------------------------------ */

const METRIC_OPTIONS: StringOption[] = [
  { value: "registry-score", label: "Registry Score" },
  { value: "reputation", label: "Reputation" },
  { value: "activity-7d", label: "Activity (7d)" },
  { value: "volume-30d", label: "Volume (30d)" },
  { value: "win-rate", label: "Win Rate" },
  { value: "verification-level", label: "Verification Level" },
  { value: "freshness", label: "Freshness" },
];

const DEFAULT_METRIC = "registry-score";

const CATEGORY_OPTIONS = [
  { value: "rebalancing", label: "Rebalancing" },
  { value: "grid-trading", label: "Grid Trading" },
  { value: "yield", label: "Yield Optimization" },
  { value: "health-factor", label: "Health Factor" },
] as const;

const NETWORK_OPTIONS = [
  { value: "all", label: "All BNB networks" },
  { value: "mainnet", label: "BNB Mainnet" },
  { value: "testnet", label: "BNB Testnet" },
] as const;

const TIME_OPTIONS = [
  { value: "all-time", label: "All-time" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
] as const;

const SORT_OPTIONS: StringOption[] = [
  { value: "desc", label: "Highest first" },
  { value: "asc", label: "Lowest first" },
];
const DEFAULT_SORT = "desc";

const SKELETON_ROWS = 8;
const SKELETON_CARDS = 8;

/** View states â€” the Sprint 2F set, now driven by real data availability. */
type ViewState =
  "ready" | "loading" | "no-results" | "no-data" | "offline" | "no-metric" | "unavailable";

/** Map the server data state â†’ the existing view state (design unchanged). */
function toViewState(dataState: LeaderboardData["state"], hasQuery: boolean): ViewState {
  switch (dataState) {
    case "ready":
      return "ready";
    case "empty":
      return hasQuery ? "no-results" : "no-data";
    case "unauthorized":
    case "offline":
      return "offline";
    case "rate-limited":
      return "offline";
    case "error":
      return "offline";
    case "missing-key":
    default:
      // Honest pending/unavailable â€” the original Sprint 2F skeleton state.
      return "unavailable";
  }
}

/** Freshness label from a real ISO timestamp (no fabrication when absent). */
function freshnessLabel(iso: string | null): string {
  if (!iso) return "â€”";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "â€”";
  const diffMs = Date.now() - t;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

/** Chain id â†’ display label (only where known; else the raw id). */
function chainLabel(chainId: number): string {
  switch (chainId) {
    case 1:
      return "Ethereum";
    case 56:
      return "BNB Chain";
    case 196:
      return "X Layer";
    case 8453:
      return "Base";
    default:
      return `Chain ${chainId}`;
  }
}

/** Toggle a value inside a string-set, returning a new Set (multi-select). */
function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
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

function buildQueryString(state: {
  metric: string;
  category: Set<string>;
  time: string;
  query: string;
}): string {
  const p = new URLSearchParams();
  if (state.query) p.set("q", state.query);
  if (state.metric !== DEFAULT_METRIC) p.set("metric", state.metric);
  if (state.category.size) p.set("category", [...state.category].join(","));
  if (state.time !== "all-time") p.set("time", state.time);
  return p.toString();
}

/* ------------------------------------------------------------------ *
 * View (client) â€” receives normalized data from the server component.
 * ------------------------------------------------------------------ */

export function LeaderboardsView({
  data,
  scope = "all",
  page = 1,
}: {
  data: LeaderboardData;
  /** X.232 â€” discovery-network scope (read-only prop; switching is URL-driven). */
  scope?: "all" | "mainnet" | "testnet";
  /** X.232 â€” current catalog page (read-only prop; navigation is URL-driven). */
  page?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [initial] = React.useState<URLSearchParams>(
    () => new URLSearchParams(searchParams.toString())
  );

  const [query, setQuery] = React.useState(() => initial.get("q") ?? "");
  const [metric, setMetric] = React.useState(() =>
    readOne(
      initial,
      "metric",
      METRIC_OPTIONS.map((o) => o.value),
      DEFAULT_METRIC
    )
  );
  const [category, setCategory] = React.useState<Set<string>>(() => {
    const raw = initial.get("category");
    if (!raw) return new Set<string>();
    const allow: Set<string> = new Set(CATEGORY_OPTIONS.map((c) => c.value));
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => allow.has(s))
    );
  });
  const [time, setTime] = React.useState<string>(() =>
    readOne(
      initial,
      "time",
      TIME_OPTIONS.map((t) => t.value),
      "all-time"
    )
  );

  // X.232 â€” `network` state replaced by the URL-driven `scope` prop (server
  // re-reads on switch); no client-only network state remains.
  const [sort, setSort] = React.useState<string>(() =>
    readOne(
      initial,
      "sort",
      SORT_OPTIONS.map((o) => o.value),
      DEFAULT_SORT
    )
  );

  const queryString = buildQueryString({ query, metric, category, time });
  React.useEffect(() => {
    const current = searchParams.toString();
    if (current === queryString) return;
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [queryString, pathname, router, searchParams]);

  const activeFilters = React.useMemo(() => {
    const list: { facet: string; label: string; onRemove: () => void }[] = [];
    category.forEach((c) =>
      list.push({
        facet: "Category",
        label: CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c,
        onRemove: () => setCategory((s) => toggleInSet(s, c)),
      })
    );
    if (time !== "all-time")
      list.push({
        facet: "Time",
        label: TIME_OPTIONS.find((o) => o.value === time)?.label ?? time,
        onRemove: () => setTime("all-time"),
      });
    return list;
  }, [category, time]);

  const hasActiveFilters = activeFilters.length > 0 || query.length > 0;
  const resetAll = React.useCallback(() => {
    setQuery("");
    setCategory(new Set());
    setTime("all-time");
    setSort(DEFAULT_SORT);
    // X.232 â€” network scope is URL-driven; reset also clears it.
    const p = new URLSearchParams(searchParams.toString());
    p.delete("network");
    p.delete("page");
    router.replace(p.toString() ? `${pathname}?${p.toString()}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const metricLabel = METRIC_OPTIONS.find((o) => o.value === metric)?.label ?? metric;

  // Client-side text filter over the already-fetched rows (search box behaviour).
  const rows = React.useMemo(() => {
    if (data.state !== "ready") return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.agents;
    return data.agents.filter((a) => a.name.toLowerCase().includes(q));
  }, [data, query]);

  const viewState = toViewState(data.state, query.trim().length > 0 || activeFilters.length > 0);
  // When a search yields no local matches but data is ready â†’ honest no-results.
  const effectiveViewState: ViewState =
    viewState === "ready" && rows.length === 0 ? "no-results" : viewState;

  const lastIndexedLabel = data.lastIndexed ? freshnessLabel(data.lastIndexed) : "â€”";
  // X.232 — truthful pagination derived from ACTUAL upstream metadata.
  const leaderboardTotalIndexed = data.pagination?.total ?? null;
  const leaderboardUpstreamLimit = data.pagination?.limit ?? 20;
  const leaderboardUpstreamHasMore = data.pagination?.hasMore === true;
  const leaderboardRealTotalPages =
    leaderboardTotalIndexed != null
      ? Math.max(1, Math.ceil(leaderboardTotalIndexed / leaderboardUpstreamLimit))
      : 1;
  const leaderboardTotalPages = Math.min(leaderboardRealTotalPages, 10);
  const leaderboardHasMoreBeyondWindow =
    leaderboardUpstreamHasMore && page >= 10 && leaderboardRealTotalPages > 10;

  const filterPanel = (
    <FilterSidebar
      title="Filters"
      action={<ResetFiltersButton onReset={resetAll} disabled={!hasActiveFilters} />}
    >
      <FilterSection title="Metric" hint={metricLabel} collapsible={false}>
        <FilterGroup label="Ranking metric" role="radiogroup">
          {METRIC_OPTIONS.map((m) => (
            <FilterRadio
              key={m.value}
              name="metric"
              value={m.value}
              label={m.label}
              checked={metric === m.value}
              onSelect={setMetric}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      <FilterSection title="Category">
        <FilterGroup label="Category" layout="wrap">
          {CATEGORY_OPTIONS.map((c) => (
            <FilterChip
              key={c.value}
              label={c.label}
              selected={category.has(c.value)}
              onToggle={() => setCategory((s) => toggleInSet(s, c.value))}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      <FilterSection title="Network" defaultOpen={false}>
        <FilterGroup label="Network" role="radiogroup">
          {NETWORK_OPTIONS.map((n) => (
            <FilterRadio
              key={n.value}
              name="network"
              value={n.value}
              label={n.label}
              checked={scope === n.value}
              onSelect={(next) => {
                // X.232 â€” URL-driven scope switching (server re-reads); resets
                // to page 1 on scope change. Discovery-only; hire untouched.
                const p = new URLSearchParams(searchParams.toString());
                if (next !== "all") p.set("network", next);
                else p.delete("network");
                p.delete("page");
                router.replace(p.toString() ? `${pathname}?${p.toString()}` : pathname, {
                  scroll: false,
                });
              }}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      <FilterSection title="Time range">
        <FilterGroup label="Time range" role="radiogroup">
          {TIME_OPTIONS.map((t) => (
            <FilterRadio
              key={t.value}
              name="time"
              value={t.value}
              label={t.label}
              checked={time === t.value}
              onSelect={setTime}
            />
          ))}
        </FilterGroup>
      </FilterSection>

      <FilterSection title="Sort direction">
        <FilterGroup label="Sort direction" role="radiogroup">
          {SORT_OPTIONS.map((s) => (
            <FilterRadio
              key={s.value}
              name="sort"
              value={s.value}
              label={s.label}
              checked={sort === s.value}
              onSelect={setSort}
            />
          ))}
        </FilterGroup>
      </FilterSection>
    </FilterSidebar>
  );

  return (
    <MarketplaceContainer className="py-5">
      <Breadcrumbs items={[{ label: "Leaderboards" }]} />

      <MarketplaceHeader
        title="Leaderboards"
        subtitle="Ranked agents by registry score, reputation, activity, volume, win rate and freshness."
        className="py-4"
      />

      <StickyToolbar className="mb-4" offset={64}>
        <SearchToolbar
          actions={
            <>
              <span className="hidden xs:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
                {metricLabel}
              </span>
              <SortDropdown options={SORT_OPTIONS} value={sort} onChange={setSort} />
              <div className="lg:hidden">
                <MobileFilterButton label="Open filters" filterPanel={filterPanel} />
              </div>
            </>
          }
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search agents by name or capabilityâ€¦"
            label="Search leaderboards"
          />
          <span className="hidden md:inline-flex">
            <WaitingHint text="Waiting for ERC-8004 Registry" />
          </span>
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
          <>
            <div className="hidden lg:block">
              <MarketplaceSidebar offset={80}>{filterPanel}</MarketplaceSidebar>
            </div>
          </>
        }
      >
        <MarketplaceContent>
          <div className="border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold tracking-tight">Agents</h2>
              <WaitingHint text="Waiting for ERC-8004 Registry" />
              <RegistryBadge
                state={data.state === "ready" ? "synced" : "waiting"}
                variant="soft"
                size="sm"
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Last indexed: {lastIndexedLabel}</span>
              <span aria-hidden="true">Â·</span>
              <span>Ranking metric: {metricLabel}</span>
            </div>
          </div>

          {renderBody(effectiveViewState, query, rows, resetAll)}

          {/* X.232 â€” truthful, bounded pagination from REAL upstream metadata.
              Discovery buckets/leaderboards deliberately expose only the first
              MARKETPLACE_MAX_PAGE pages (score-ordered browsing + search). */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <Pagination
              page={page}
              totalPages={leaderboardTotalPages}
              onPageChange={(next) => {
                const p = new URLSearchParams(searchParams.toString());
                if (next > 1) p.set("page", String(next));
                else p.delete("page");
                router.replace(p.toString() ? `${pathname}?${p.toString()}` : pathname, {
                  scroll: false,
                });
              }}
            />
            {leaderboardHasMoreBeyondWindow ? (
              <p className="text-xs text-muted-foreground">
                Showing the 10 highest-scored pages â€”{" "}
                {(data.pagination?.total ?? 0).toLocaleString()} agents are indexed. Use search to
                explore beyond the top window.
              </p>
            ) : null}
          </div>
        </MarketplaceContent>
      </MarketplaceLayout>

      <Methodology />
    </MarketplaceContainer>
  );
}

/* ------------------------------------------------------------------ *
 * Body renderer â€” one branch per honest view state.
 * ------------------------------------------------------------------ */

function renderBody(
  viewState: ViewState,
  query: string,
  rows: LeaderboardAgent[],
  onClearFilters: () => void
) {
  switch (viewState) {
    case "ready":
      return (
        <div className="mt-4">
          <div className="hidden md:block">
            <LeaderboardTable rows={rows} />
          </div>
          <div className="md:hidden">
            <LeaderboardCardList rows={rows} />
          </div>
        </div>
      );
    case "no-results":
      return (
        <NoSearchResults
          query={query}
          action={
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    case "no-data":
      return <NoAgents />;
    case "offline":
      return (
        <RegistryOffline
          action={
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          }
        />
      );
    case "no-metric":
      return (
        <MarketplaceEmptyState
          icon={Database}
          tone="primary"
          title="No ranking data"
          description="This metric has no indexed agents yet. Try another metric or check back after the next registry sync."
        />
      );
    case "unavailable":
    case "loading":
    default:
      return (
        <div role="status" aria-label="Waiting for ERC-8004 Registry data" className="mt-4">
          <span className="sr-only">
            Waiting for ERC-8004 Registry data. {SKELETON_ROWS} agent leaderboard slots pending
            ERC-8004 Registry sync.
          </span>
          <div className="hidden md:block">
            <LeaderboardTableSkeleton rows={SKELETON_ROWS} />
          </div>
          <div className="md:hidden">
            <LeaderboardCardSkeletonList count={SKELETON_CARDS} />
          </div>
        </div>
      );
  }
}

/* ------------------------------------------------------------------ *
 * Mobile filter drawer (native modal â€” no new DS primitive).
 * ------------------------------------------------------------------ */

function MobileFilterButton({
  label,
  filterPanel,
}: {
  label: string;
  filterPanel: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" aria-label={label} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-4 w-4" />
        {label}
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end overflow-y-auto bg-black/40"
          onClick={() => setOpen(false)}
          aria-label="Close filters"
        >
          <div
            className="mt-4 h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto border-l border-border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {filterPanel}
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Real data â€” desktop table (same 8 columns as the Sprint 2F skeleton).
 * Unsupported fields render "â€”" (never fabricated).
 * ------------------------------------------------------------------ */

const TABLE_HEADERS = [
  "Rank",
  "Agent",
  "Category",
  "Protocol",
  "Active Metric",
  "Risk",
  "Verification",
  "Freshness",
] as const;

/** Em-dash cell for values 8004scan does not provide. */
function Dash({ label }: { label?: string }) {
  return (
    <span className="text-muted-foreground/70" aria-label={label ?? "Not available"}>
      â€”
    </span>
  );
}

function LeaderboardTable({ rows }: { rows: LeaderboardAgent[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <caption className="sr-only">
          Leaderboard, ranked by Registry Score, {rows.length} agents
        </caption>
        <TableHeader>
          <TableRow>
            {TABLE_HEADERS.map((h) => (
              <TableHead key={h} className="bg-muted/40 text-xs font-medium text-muted-foreground">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a, i) => (
            <LeaderboardRow key={a.id} agent={a} ordinal={i + 1} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeaderboardRow({ agent, ordinal }: { agent: LeaderboardAgent; ordinal: number }) {
  return (
    <TableRow className={ordinal === 1 ? "ring-1 ring-inset ring-amber-400/30" : undefined}>
      <TableCell className="font-medium tabular-nums">{ordinal}</TableCell>
      <TableCell>
        <Link
          href={`/agents/${encodeURIComponent(agent.slug)}`}
          className="font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {agent.name}
        </Link>
      </TableCell>
      <TableCell>
        {/* 8004scan does not classify product category â†’ honest â€” */}
        <Dash label="Category not provided by 8004scan" />
      </TableCell>
      <TableCell>
        {agent.protocols.length > 0 ? (
          <span className="text-sm text-muted-foreground">{agent.protocols.join(", ")}</span>
        ) : (
          <Dash label="No protocols listed" />
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {/* Active metric (default Registry Score) uses the API's real total_score. */}
        {agent.registryScore != null ? agent.registryScore : <Dash label="No score yet" />}
      </TableCell>
      <TableCell>
        {/* Risk not provided by 8004scan â†’ honest â€” */}
        <Dash label="Risk not provided by 8004scan" />
      </TableCell>
      <TableCell>
        <MarketplaceVerificationBadge state={agent.verification} size="sm" />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {agent.updatedAt ? freshnessLabel(agent.updatedAt) : <Dash label="No sync time" />}
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------------------------------------------ *
 * Real data â€” mobile cards (one row per agent).
 * ------------------------------------------------------------------ */

function LeaderboardCardList({ rows }: { rows: LeaderboardAgent[] }) {
  return (
    <div className="space-y-3">
      {rows.map((a, i) => (
        <div key={a.id} className="rounded-xl border border-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums text-muted-foreground">{i + 1}</span>
            <Link
              href={`/agents/${encodeURIComponent(a.slug)}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {a.name}
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {a.registryScore != null ? `Score ${a.registryScore}` : "Score â€”"}
            </span>
            <MarketplaceVerificationBadge state={a.verification} size="sm" />
            <span>{a.updatedAt ? freshnessLabel(a.updatedAt) : "â€”"}</span>
            <span>{chainLabel(a.chainId)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Desktop table skeleton (Sprint 2F â€” unchanged).
 * ------------------------------------------------------------------ */

function LeaderboardTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {TABLE_HEADERS.map((h) => (
              <TableHead key={h} className="bg-muted/40 text-xs font-medium text-muted-foreground">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <LeaderboardRowSkeleton key={i} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeaderboardRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-8 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-18 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14 rounded" />
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------------------------------------------ *
 * Mobile card skeleton (Sprint 2F â€” unchanged).
 * ------------------------------------------------------------------ */

function LeaderboardCardSkeletonList({ count }: { count: number }) {
  return (
    <div role="status" aria-label="Waiting for ERC-8004 Registry data" className="space-y-3">
      <span className="sr-only">Waiting for ERC-8004 Registry data.</span>
      {Array.from({ length: count }).map((_, i) => (
        <LeaderboardCardSkeleton key={i} />
      ))}
    </div>
  );
}

function LeaderboardCardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-4 w-6" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-18 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Methodology â€” native <details> disclosure (Sprint 2F â€” unchanged).
 * ------------------------------------------------------------------ */

function Methodology() {
  return (
    <details className="mt-8">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        How rankings are calculated
        <ChevronDown
          className="h-4 w-4 text-muted-foreground transition-transform"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-3 text-sm text-muted-foreground">
        <p>
          Leaderboards rank agents by the active metric (default: Registry Score). Rank is an
          ordinal position (1, 2, 3 â€¦) â€” not a 0â€“100 score. When two agents tie on the primary
          metric, the following tie-breaks decide the order:
        </p>
        <ol className="mt-2 list-decimal pl-5">
          <li>Verification status (verified &gt; pending &gt; unverified)</li>
          <li>Risk level (low &gt; medium &gt; high &gt; critical)</li>
          <li>Reputation (excellent &gt; good &gt; average)</li>
          <li>Relative activity (trending &gt; popular &gt; stable &gt; new)</li>
          <li>Freshness (most recently indexed)</li>
        </ol>
        <p className="mt-2">
          Ranks update on each ERC-8004 Registry sync. Until the registry is connected, all slots
          show â€” and are flagged pending.
        </p>
      </div>
    </details>
  );
}
