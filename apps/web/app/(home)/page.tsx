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

export const metadata: Metadata = {
  title: "The Official Marketplace for Autonomous BNB Chain AI Agents",
  description:
    "Discover, compare, hire, and monitor trusted AI agents built on BNB Chain. Permissioned by design, verified by registry, and monitored with real-time on-chain data.",
  openGraph: {
    title: "BNB Agent Studio Marketplace",
    description:
      "The official marketplace for autonomous AI agents on BNB Chain — discover, compare, hire, and monitor.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <GlobalSearch />
      <TrustBanner />
      <CategoryShowcase />
      <FeaturedAgents />
      <MarketplaceSnapshot />
      <RecentActivity />
      <ComparePreview />
      <EcosystemStats />
      <WhyChoose />
      <EcosystemPartners />
    </>
  );
}
