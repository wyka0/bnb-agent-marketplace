import { Bot, Clock3, FolderOpen, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RegistryBadge } from "@bnb-marketplace/ui";
import { Reveal } from "./reveal";
import { SectionTitle } from "./section-title";
import type { MarketplaceData } from "@/lib/eight004scan/marketplace";
import type { BscDiscoveryData } from "@/lib/eight004scan/discovery/service";

interface SnapshotItem {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}

export function MarketplaceSnapshot({
  data,
  discovery,
}: {
  data: MarketplaceData;
  discovery: BscDiscoveryData;
}) {
  const ready = data.state === "ready";

  const items: SnapshotItem[] = ready
    ? [
        {
          icon: Bot,
          label: "Agents in registry",
          value: data.pagination?.total != null ? data.pagination.total.toLocaleString() : "—",
          hint: "8004scan registry total",
        },
        {
          icon: FolderOpen,
          label: "Live listings shown",
          value: data.agents.length.toLocaleString(),
          hint: "Page 1 · newest first",
        },
        {
          icon: UserCheck,
          label: "Verified agents",
          value: data.agents
            .filter((agent) => agent.verification === "verified")
            .length.toLocaleString(),
          hint: "Registry is_verified · page 1",
        },
        {
          icon: Clock3,
          label: "Last indexed",
          value: data.lastIndexed
            ? new Date(data.lastIndexed).toLocaleDateString()
            : "—",
          hint: "8004scan snapshot timestamp",
        },
      ]
    : [];

  const liveCategories =
    discovery.state === "ready"
      ? discovery.buckets.filter((b) => b.state === "ready" || b.state === "empty").length
      : null;

  return (
    <section aria-label="Marketplace snapshot" className="container py-10">
      <Reveal>
        <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle
              align="left"
              eyebrow="Snapshot"
              title="Marketplace snapshot"
              description={
                ready
                  ? `Aggregate state from the live 8004scan registry surface (page 1, newest first). ${liveCategories != null ? `${liveCategories} / 4 category tracks answered BSC discovery.` : ""}`
                  : "Aggregate marketplace state comes from the live 8004scan registry surface."
              }
            />
            {ready ? (
              <RegistryBadge state="synced" size="sm" />
            ) : (
              <RegistryBadge state={data.state === "missing-key" ? "waiting" : "offline"} size="sm" />
            )}
          </div>

          {items.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, index) => (
                <Reveal key={item.label} delay={index * 80}>
                  <div className="flex flex-col rounded-xl border border-border bg-card/70 p-5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-sm font-medium text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight">{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
              {data.state === "missing-key"
                ? "The 8004scan API key is missing on the server (8004SCAN_API_KEY) — live figures will appear once it is configured; nothing is simulated."
                : "The ERC-8004 registry is unavailable right now — live figures will appear when it responds."}
            </p>
          )}
        </div>
      </Reveal>
    </section>
  );
}