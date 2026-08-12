import { Bot, Network, ShieldCheck, UserCheck } from "lucide-react";
import { SectionTitle } from "./section-title";
import { StatCard } from "./stat-card";

const STATS = [
  {
    label: "Registered Agents",
    icon: <Bot className="h-5 w-5" aria-hidden="true" />,
    hint: "Synced from the ERC-8004 registry",
  },
  {
    label: "Verified Builders",
    icon: <UserCheck className="h-5 w-5" aria-hidden="true" />,
    hint: "Publisher identity verification",
  },
  {
    label: "Supported Categories",
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    hint: "Four equal-priority tracks",
  },
  {
    label: "Networks",
    icon: <Network className="h-5 w-5" aria-hidden="true" />,
    hint: "BNB Chain mainnet and beyond",
  },
] as const;

export function EcosystemStats() {
  return (
    <section className="container py-20 lg:py-24">
      <SectionTitle
        eyebrow="Ecosystem"
        title="Ecosystem statistics"
        description="Live figures are loaded from the on-chain registry and verification pipeline once integration ships."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}
