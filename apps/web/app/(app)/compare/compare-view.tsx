"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, GitCompareArrows, Plus, Search, Trash2, X } from "lucide-react";
import {
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

function comparisonValue(agent: LeaderboardAgent, field: string): React.ReactNode {
  switch (field) {
    case "Description":
      return agent.description ?? unavailable("Not provided by 8004scan");
    case "Category":
      return unavailable("Not classified by 8004scan");
    case "Capabilities":
      return agent.x402Supported ? "x402 payments" : unavailable("Not provided by 8004scan");
    case "Protocols":
      return agent.protocols.length > 0
        ? agent.protocols.join(" · ")
        : unavailable("No protocols listed");
    case "Chain":
      return `${chainLabelForId(agent.chainId)} (${agent.chainId})`;
    case "Verification":
      return agent.verification === "verified" ? "Verified" : "Unverified";
    case "Reputation":
      return agent.averageScore != null
        ? `${agent.averageScore}/5${agent.totalFeedbacks != null ? ` · ${agent.totalFeedbacks} reviews` : ""}`
        : unavailable("No reputation data");
    case "Registry score":
      return agent.registryScore ?? unavailable("Not provided by 8004scan");
    case "Registry / source":
      return <span className="break-all font-mono text-xs">8004scan · {agent.slug}</span>;
    case "Listed status":
      return "Listed in 8004scan";
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

      <section className="mb-8 rounded-xl border border-border/70 bg-card/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Select agents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the live ERC-8004 registry…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {catalog.state === "ready" ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {candidates.map((agent) => (
              <button
                key={agent.slug}
                type="button"
                disabled={selected.length >= MAX_COMPARE_AGENTS}
                onClick={() => addAgent(agent)}
                className="flex min-h-20 items-start gap-3 rounded-lg border border-border/70 bg-background/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {agent.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{agent.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {agent.protocols.length > 0
                      ? agent.protocols.join(" · ")
                      : chainLabelForId(agent.chainId)}
                  </span>
                </span>
                <Plus className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            ))}
            {candidates.length === 0 ? (
              <p className="col-span-full py-4 text-sm text-muted-foreground">
                {query
                  ? `No available registry agents match “${query}”.`
                  : "No additional agents are available on this registry page."}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <RegistryBadge
              state={catalog.state === "missing-key" ? "waiting" : "offline"}
              size="sm"
            />
            {catalog.state === "missing-key"
              ? "The 8004scan server credential is not configured; no agents are simulated."
              : "The registry is unavailable right now. Existing URL selections remain honest and unresolved."}
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
              <h2 id="comparison-heading" className="text-base font-semibold">
                Comparison
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.length === 1
                  ? "Add one or two more agents for a useful side-by-side comparison."
                  : `${selected.length} real registry agents selected.`}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="h-4 w-4 text-primary" aria-hidden="true" />
              Source: 8004scan
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/70">
            <Table className="min-w-[760px]">
              <caption className="sr-only">Real registry fields for the selected agents.</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Field</TableHead>
                  {selected.map((agent) => (
                    <TableHead key={agent.slug} className="min-w-56 align-top">
                      <div className="flex items-start justify-between gap-2 py-1">
                        <Link
                          href={agentHrefFromId(agent.slug)}
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {agent.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeAgent(agent.slug)}
                          aria-label={`Remove ${agent.name} from comparison`}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {FIELDS.map((field) => (
                  <TableRow key={field}>
                    <TableCell className="font-medium text-foreground">{field}</TableCell>
                    {selected.map((agent) => (
                      <TableCell
                        key={agent.slug}
                        className="max-w-80 align-top text-muted-foreground"
                      >
                        {comparisonValue(agent, field)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </MarketplaceContainer>
  );
}
