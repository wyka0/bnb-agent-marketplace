import { Activity, ArrowLeftRight, LayoutGrid, TrendingUp } from "lucide-react";
import { CategoryCard } from "./category-card";
import { SectionTitle } from "./section-title";
import { discoveryCategoryKeyFromLabel } from "@/lib/eight004scan/discovery/classifier";
import type { BscDiscoveryData } from "@/lib/eight004scan/discovery/service";

const CATEGORIES = [
  {
    title: "Rebalancing",
    description:
      "Agents that keep portfolio allocations aligned to target weights, adjusting positions as markets move to maintain strategy discipline.",
    href: "/categories/rebalancing",
    icon: <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />,
    category: "rebalancing" as const,
  },
  {
    title: "Grid Trading",
    description:
      "Automated grid strategies that place buy and sell orders across a price range, capturing volatility in ranging markets.",
    href: "/categories/grid-trading",
    icon: <LayoutGrid className="h-5 w-5" aria-hidden="true" />,
    category: "grid-trading" as const,
  },
  {
    title: "Yield Optimization",
    description:
      "Agents that seek the best risk-adjusted yield across lending markets and liquidity pools, compounding returns automatically.",
    href: "/categories/yield",
    icon: <TrendingUp className="h-5 w-5" aria-hidden="true" />,
    category: "yield" as const,
  },
  {
    title: "Health Factor Monitoring",
    description:
      "Continuous surveillance of collateral health and liquidation distance, alerting and reacting before positions become at risk.",
    href: "/categories/health-factor",
    icon: <Activity className="h-5 w-5" aria-hidden="true" />,
    category: "health-factor" as const,
  },
] as const;

export function CategoryShowcase({ discovery }: { discovery: BscDiscoveryData }) {
  /** Live matched count for a track — only when its BSC discovery bucket answered. */
  const countFor = (title: string): number | null => {
    if (discovery.state !== "ready") return null;
    const key = discoveryCategoryKeyFromLabel(title);
    const bucket = discovery.buckets.find((b) => b.key === key);
    if (!bucket || (bucket.state !== "ready" && bucket.state !== "empty")) return null;
    return bucket.matched;
  };

  return (
    <section className="container py-20 lg:py-24">
      <SectionTitle
        eyebrow="Categories"
        title="Four specialized tracks"
        description="Every marketplace category gets equal emphasis — its own directory, dashboard, rankings, and live BSC category discovery from the 8004scan registry."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => (
          <CategoryCard
            key={category.title}
            {...category}
            count={countFor(category.title)}
          />
        ))}
      </div>
    </section>
  );
}