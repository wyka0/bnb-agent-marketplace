import { Bot, Network, ShieldCheck, UserCheck } from "lucide-react";
import { SectionTitle } from "./section-title";
import { StatCard } from "./stat-card";
import type { MarketplaceData } from "@/lib/eight004scan/marketplace";
import type { BscDiscoveryData } from "@/lib/eight004scan/discovery/service";

export function EcosystemStats({
  data,
  discovery,
}: {
  data: MarketplaceData;
  discovery: BscDiscoveryData;
}) {
  const ready = data.state === "ready";

  const stats = [
    {
      label: "Registered Agents",
      icon: <Bot className="h-5 w-5" aria-hidden="true" />,
      value: ready && data.pagination?.total != null ? data.pagination.total.toLocaleString() : undefined,
      hint: "8004scan registry total",
    },
    {
      label: "BSC Category Matches",
      icon: <UserCheck className="h-5 w-5" aria-hidden="true" />,
      value:
        discovery.state === "ready"
          ? discovery.buckets
              .filter((b) => b.state === "ready" || b.state === "empty")
              .reduce((sum, b) => sum + b.matched, 0)
              .toLocaleString()
          : undefined,
      hint: "Bounded keyword discovery (chain 56)",
    },
    {
      label: "Supported Categories",
      icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
      value: "4",
      hint: "Four equal-priority tracks",
    },
    {
      label: "Networks on Page 1",
      icon: <Network className="h-5 w-5" aria-hidden="true" />,
      value:
        ready
          ? new Set(data.agents.map((agent) => agent.chainId)).size.toLocaleString()
          : undefined,
      hint: "Distinct chains in the live list",
    },
  ] as const;

  return (
    <section className="container py-20 lg:py-24">
      <SectionTitle
        eyebrow="Ecosystem"
        title="Ecosystem statistics"
        description="Live figures from the 8004scan registry surface (page 1, newest first) and bounded BSC category discovery — no simulated numbers."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}