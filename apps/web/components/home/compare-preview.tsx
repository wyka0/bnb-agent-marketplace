import Link from "next/link";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import { RegistryBadge } from "@bnb-marketplace/ui";
import { Reveal } from "./reveal";
import { chainLabelForId } from "@/lib/eight004scan/card";
import type { MarketplaceData } from "@/lib/eight004scan/marketplace";

const AGENT_SLOTS = 3;

export function ComparePreview({ data }: { data: MarketplaceData }) {
  const ready = data.state === "ready";
  const agents = ready ? data.agents.slice(0, AGENT_SLOTS) : [];
  const anyAgents = agents.length > 0;

  return (
    <section aria-label="Compare agents preview" className="container py-10">
      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Compare
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Compare agents side by side
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {anyAgents
                  ? "The newest registry agents below — compare their real registry fields."
                  : "Compare agents by their real registry fields once the catalog responds."}
              </p>
            </div>
            <Link
              href="/compare"
              className="group inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_28px_-6px_hsl(var(--primary)/0.7)]"
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              Open Compare
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="overflow-x-auto border-t border-border/70">
            {anyAgents ? (
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <caption className="sr-only">
                  Comparison preview — the first {agents.length} of the newest ERC-8004 registry
                  records, real fields only.
                </caption>
                <thead>
                  <tr className="border-b border-border/70">
                    <th scope="col" className="w-1/4 px-6 py-4 text-left font-semibold">
                      Metric
                    </th>
                    {agents.map((agent) => (
                      <th
                        key={agent.slug}
                        scope="col"
                        className="px-6 py-4 text-left font-medium text-muted-foreground"
                      >
                        {agent.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="px-6 py-4 text-left font-medium">
                      Capabilities
                    </th>
                    {agents.map((agent) => (
                      <td key={agent.slug} className="px-6 py-4 tabular-nums text-muted-foreground">
                        {agent.protocols.length > 0 ? agent.protocols.join(" · ") : "None listed"}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-card/40">
                    <th scope="row" className="px-6 py-4 text-left font-medium">
                      Verification
                    </th>
                    {agents.map((agent) => (
                      <td key={agent.slug} className="px-6 py-4 tabular-nums text-muted-foreground">
                        {agent.verification === "verified" ? "Verified" : "Unverified"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="px-6 py-4 text-left font-medium">
                      Chain
                    </th>
                    {agents.map((agent) => (
                      <td key={agent.slug} className="px-6 py-4 tabular-nums text-muted-foreground">
                        {chainLabelForId(agent.chainId)}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-card/40">
                    <th scope="row" className="px-6 py-4 text-left font-medium">
                      Listed
                    </th>
                    {agents.map((agent) => (
                      <td key={agent.slug} className="px-6 py-4 tabular-nums text-muted-foreground">
                        {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <RegistryBadge state={data.state === "missing-key" ? "waiting" : "offline"} size="sm" />
                <p className="max-w-md text-sm text-muted-foreground">
                  {data.state === "missing-key"
                    ? "The 8004scan API key is missing on the server (8004SCAN_API_KEY) — comparison rows will appear once it is configured."
                    : "The ERC-8004 registry is unavailable right now — comparison rows will appear when it responds."}
                </p>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}