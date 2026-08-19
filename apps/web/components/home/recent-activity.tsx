import { RegistryBadge } from "@bnb-marketplace/ui";
import { Reveal } from "./reveal";
import type { MarketplaceData } from "@/lib/eight004scan/marketplace";

const ACTIVITY_ROWS = 5;

export function RecentActivity({ data }: { data: MarketplaceData }) {
  const ready = data.state === "ready";
  const agents = ready ? data.agents.slice(0, ACTIVITY_ROWS) : [];
  const anyListed = agents.length > 0;

  return (
    <section aria-label="Recent marketplace activity" className="container py-10">
      <Reveal>
        <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Activity
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Newest marketplace listings
              </h2>
            </div>
            {anyListed ? (
              <RegistryBadge state="synced" size="sm" />
            ) : (
              <RegistryBadge state={data.state === "missing-key" ? "waiting" : "offline"} size="sm" />
            )}
          </div>

          {anyListed ? (
            <ul className="mt-8 divide-y divide-border/70">
              {agents.map((agent) => (
                <li key={agent.slug} className="flex items-center gap-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(agent.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {agent.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {agent.protocols.length > 0
                        ? agent.protocols.join(" · ")
                        : "No protocols listed"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {agent.verification === "verified" ? "Verified · " : ""}
                    {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
              {data.state === "missing-key"
                ? "The 8004scan API key is missing on the server (8004SCAN_API_KEY) — newest listings will appear once it is configured; nothing is simulated."
                : "The ERC-8004 registry is unavailable right now — newest listings will appear when it responds."}
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Newest ERC-8004 records from 8004scan (page 1, newest first) — real registry data, no
            simulated events.
          </p>
        </div>
      </Reveal>
    </section>
  );
}