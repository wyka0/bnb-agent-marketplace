/**
 * Homepage — Main Track X.62.
 *
 * Data-driven sections reuse the EXACT verified 8004scan surfaces that power
 * the Marketplace page (`getMarketplaceAgents` + `getBscCategoryDiscovery`,
 * both bounded, keyless-safe, honest-state). The marketing/hero sections and
 * the four Main Track category tracks are preserved unchanged.
 *
 * `force-dynamic` + `revalidate = 0`: NEVER fetches during `next build`;
 * data loads per request and is awaited BEFORE render, so the page streams
 * complete (no Suspense fallback, no infinite spinner).
 */

import * as React from "react";
import { getMarketplaceAgents } from "@/lib/eight004scan/marketplace";
import { getBscCategoryDiscovery } from "@/lib/eight004scan/discovery/service";
import { toAgentCardData } from "@/lib/eight004scan/card";
import type { Metadata } from "next";
import { CategoryShowcase } from "@/components/home/category-showcase";
import { ComparePreview } from "@/components/home/compare-preview";
import { EcosystemPartners } from "@/components/home/ecosystem-partners";
import { EcosystemStats } from "@/components/home/ecosystem-stats";
import { FeaturedAgents } from "@/components/home/featured-agents";
import { GlobalSearch } from "@/components/home/global-search";
import { Hero } from "@/components/home/hero";
import { MarketplaceSnapshot } from "@/components/home/marketplace-snapshot";
import { RecentActivity } from "@/components/home/recent-activity";
import { TrustBanner } from "@/components/home/trust-banner";
import { WhyChoose } from "@/components/home/why-choose";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "The Official Marketplace for Autonomous BNB Chain AI Agents",
  description:
    "Discover, compare, hire, and monitor trusted AI agents built on BNB Chain. Permissioned by design, verified by registry, and monitored with real-time on-chain data.",
  openGraph: {
    title: "BNB Agent Marketplace",
    description:
      "The official marketplace for autonomous AI agents on BNB Chain — discover, compare, hire, and monitor.",
    type: "website",
  },
};

export default async function HomePage() {
  // Two bounded reads, run in parallel — the same verified path as /marketplace.
  const [data, discovery] = await Promise.all([
    getMarketplaceAgents({ limit: 24, page: 1 }),
    getBscCategoryDiscovery({ maxPerCategory: 100 }),
  ]);

  const featuredCards = data.state === "ready" ? data.agents.slice(0, 6).map(toAgentCardData) : [];

  return (
    <React.Suspense fallback={null}>
      <Hero />
      <GlobalSearch />
      <TrustBanner />
      <CategoryShowcase discovery={discovery} />
      <FeaturedAgents cards={featuredCards} state={data.state} />
      <MarketplaceSnapshot data={data} discovery={discovery} />
      <RecentActivity data={data} />
      <ComparePreview data={data} />
      <EcosystemStats data={data} discovery={discovery} />
      <WhyChoose />
      <EcosystemPartners />
    </React.Suspense>
  );
}
