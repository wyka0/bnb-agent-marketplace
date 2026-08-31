"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, GitCompareArrows, Info, Plus, Search, Star, Trash2, X } from "lucide-react";
import {
  Avatar,
  Button,
  MarketplaceContainer,
  MarketplaceEmptyState,
  MarketplaceHeader,
  RegistryBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bnb-marketplace/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { agentHrefFromId, chainLabelForId } from "@/lib/eight004scan/card";
import { matchesSearch, type MarketplaceData } from "@/lib/eight004scan/marketplace";
import type { LeaderboardAgent } from "@/lib/eight004scan/leaderboard-types";
import {
  MAX_COMPARE_AGENTS,
  addCompareAgent,
  removeCompareAgent,
  serializeCompareAgents,
} from "@/lib/eight004scan/compare";

function unavailable(label: string) {
  return <span className="text-muted-foreground/70">{label}</span>;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

function agentMeta(agent: LeaderboardAgent): string {
  return agent.protocols.length > 0 ? agent.protocols.join(" · ") : chainLabelForId(agent.chainId);
}

function comparisonValue(agent: LeaderboardAgent, field: string): React.ReactNode {
  switch (field) {
    case "Description":
      return (
        <span className="leading-relaxed">
          {agent.description ?? unavailable("Not provided by 8004scan")}
        </span>
      );
    case "Category":
      return unavailable("Not classified by 8004scan");
    case "Capabilities":
      return agent.x402Supported ? (
        <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium">
          x402 payments
        </span>
      ) : (
        unavailable("Not provided by 8004scan")
      );
    case "Protocols":
      return agent.protocols.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {agent.protocols.map((p) => (
            <span
              key={p}
              className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium text-foreground"
            >
              {p}
            </span>
          ))}
        </span>
      ) : (
        unavailable("No protocols listed")
      );
    case "Chain":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {chainLabelForId(agent.chainId)}
          <span className="text-xs text-muted-foreground">({agent.chainId})</span>
        </span>
      );
    case "Verification":
      return agent.verification === "verified" ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Verified
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Unverified
        </span>
      );
    case "Reputation":
      return agent.averageScore != null ? (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
          <span className="font-semibold text-foreground">{agent.averageScore}/5</span>
          {agent.totalFeedbacks != null ? (
            <span className="text-xs text-muted-foreground">· {agent.totalFeedbacks} reviews</span>
          ) : null}
        </span>
      ) : (
        unavailable("No reputation data")
      );
    case "Registry score":
      return agent.registryScore != null ? (
        <span className="font-semibold text-foreground">{agent.registryScore}</span>
      ) : (
        unavailable("Not provided by 8004scan")
      );
    case "Registry / source":
      return (
        <span className="break-all font-mono text-xs text-muted-foreground">
          8004scan · {agent.slug}
        </span>
      );
    case "Listed status":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Listed in 8004scan
        </span>
      );
    case "Listed":
      return formatDate(agent.createdAt) ?? unavailable("Listing date unavailable");
    default:
      return unavailable("Unavailable");
  }
}

const FIELDS = [
  "Description",
  "Category",
  "Capabilities",
  "Protocols",
  "Chain",
  "Verification",
  "Reputation",
  "Registry score",
  "Registry / source",
  "Listed status",
  "Listed",
] as const;

function AgentIdentity({ agent, className }: { agent: LeaderboardAgent; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <Avatar
        src={agent.imageUrl ?? undefined}
        alt={`${agent.name} agent logo`}
        fallback={agent.name.charAt(0).toUpperCase()}
        size="md"
        className="h-10 w-10 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{agent.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{agentMeta(agent)}</p>
      </div>
    </div>
  );
}

export function CompareView({
  catalog,
  initialAgents,
}: {
  catalog: MarketplaceData;
  initialAgents: LeaderboardAgent[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState(initialAgents.slice(0, MAX_COMPARE_AGENTS));
  const [query, setQuery] = React.useState("");

  const updateUrl = (agents: LeaderboardAgent[]) => {
    const value = serializeCompareAgents(agents);
    router.replace(value ? `/compare?compare=${encodeURIComponent(value)}` : "/compare", {
      scroll: false,
    });
  };

  const addAgent = (agent: LeaderboardAgent) => {
    const next = addCompareAgent(selected, agent);
    if (next === selected) return;
    setSelected(next);
    updateUrl(next);
  };

  const removeAgent = (slug: string) => {
    const next = removeCompareAgent(selected, slug);
    setSelected(next);
    updateUrl(next);
  };

  const clear = () => {
    setSelected([]);
    updateUrl([]);
  };

  const candidates =
    catalog.state === "ready"
      ? catalog.agents
          .filter((agent) => !selected.some((item) => item.slug === agent.slug))
          .filter((agent) => matchesSearch(agent, query))
          .slice(0, 8)
      : [];

  return (
    <MarketplaceContainer className="py-5">
      <Breadcrumbs items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Compare" }]} />
      <MarketplaceHeader
        title="Compare Agents"
        subtitle="Compare up to three real ERC-8004 registry agents side by side. Unavailable fields stay explicitly unavailable."
        className="py-4"
      />

      {/* Selected agents + search panel */}
      <section className="mb-6 rounded-xl border border-border/70 bg-card/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Select agents</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {selected.length} / {MAX_COMPARE_AGENTS} selected · live 8004scan records
            </p>
          </div>
          {selected.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clear}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear comparison
            </Button>
          ) : null}
        </div>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden="true"
          />
          <input
            type="search"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the live ERC-8004 registry…"
            aria-label="Search the live ERC-8004 registry"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {selected.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.map((agent) => (
              <div
                key={agent.slug}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background/60 py-1.5 pl-1.5 pr-1"
              >
                <Avatar
                  src={agent.imageUrl ?? undefined}
                  alt={`${agent.name} agent logo`}
                  fallback={agent.name.charAt(0).toUpperCase()}
                  size="sm"
                  className="h-7 w-7 shrink-0 rounded-md"
                />
                <div className="min-w-0">
                  <p className="max-w-40 truncate text-xs font-semibold text-foreground">
                    {agent.name}
                  </p>
                  <p className="max-w-40 truncate text-[11px] text-muted-foreground">
                    {agentMeta(agent)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAgent(agent.slug)}
                  aria-label={`Remove ${agent.name} from comparison`}
                  className="ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {catalog.state === "ready" ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {candidates.map((agent) => (
              <button
                key={agent.slug}
                type="button"
                disabled={selected.length >= MAX_COMPARE_AGENTS}
                onClick={() => addAgent(agent)}
                className="flex min-h-[4.5rem] items-center gap-3 rounded-lg border border-border/70 bg-background/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar
                  src={agent.imageUrl ?? undefined}
                  alt={`${agent.name} agent logo`}
                  fallback={agent.name.charAt(0).toUpperCase()}
                  size="sm"
                  className="h-8 w-8 shrink-0 rounded-lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{agent.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {agentMeta(agent)}
                  </span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
            {candidates.length === 0 ? (
              <p className="col-span-full py-3 text-sm text-muted-foreground">
                {query
                  ? `No available registry agents match “${query}”.`
                  : "No additional agents are available on this registry page."}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
            <RegistryBadge
              state={catalog.state === "missing-key" ? "waiting" : "offline"}
              size="sm"
            />
            <span className="truncate">
              {catalog.state === "missing-key"
                ? "The 8004scan server credential is not configured; no agents are simulated."
                : "The registry is unavailable right now. Existing URL selections remain honest and unresolved."}
            </span>
          </div>
        )}
      </section>

      {selected.length === 0 ? (
        <MarketplaceEmptyState
          icon={GitCompareArrows}
          tone="primary"
          title="No agents selected"
          description="Choose up to three live registry agents above, or use Compare from a Marketplace card."
          className="py-6"
          action={
            <Button asChild>
              <Link href="/marketplace">Browse Marketplace</Link>
            </Button>
          }
        />
      ) : (
        <section aria-labelledby="comparison-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="comparison-heading" className="text-base font-semibold tracking-tight">
                Comparison
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {selected.length === 1
                  ? "Add one or two more agents for a useful side-by-side comparison."
                  : `${selected.length} agents selected`}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              8004scan
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/70">
            <Table className="min-w-[820px]">
              <caption className="sr-only">Real registry fields for the selected agents.</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40 bg-background/60 align-top font-medium text-muted-foreground">
                    Field
                  </TableHead>
                  {selected.map((agent) => (
                    <TableHead key={agent.slug} className="min-w-56 align-top">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={agentHrefFromId(agent.slug)}
                          className="group block min-w-0 flex-1 no-underline"
                          title={`View ${agent.name}`}
                        >
                          <AgentIdentity agent={agent} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeAgent(agent.slug)}
                          aria-label={`Remove ${agent.name} from comparison`}
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {FIELDS.map((field, index) => (
                  <TableRow
                    key={field}
                    className={index % 2 === 0 ? "bg-background/30" : undefined}
                  >
                    <TableCell className="sticky left-0 bg-background/95 font-semibold text-foreground backdrop-blur">
                      {field}
                    </TableCell>
                    {selected.map((agent) => (
                      <TableCell
                        key={agent.slug}
                        className="max-w-80 align-top text-sm text-muted-foreground"
                      >
                        {comparisonValue(agent, field)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            All data is sourced from live 8004scan registry records at the time of selection.
            Unavailable fields remain honest and unresolved.
          </p>
        </section>
      )}
    </MarketplaceContainer>
  );
}
