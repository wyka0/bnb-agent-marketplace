import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarketplaceAgentBySlug } from "@/lib/eight004scan/marketplace";
import { decodeSlugParam } from "@/lib/agent-slug";
import { HireActivationView } from "./hire-activation-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Static-equivalent metadata; runs BEFORE the response streams so an agent
 * identity that cannot be resolved produces a true 404 (a page-level
 * notFound() alone would stream 200 after the head is committed).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const raw = (await params).slug;
  const slug = decodeSlugParam(raw);
  if (slug === null) notFound();
  const result = await getMarketplaceAgentBySlug(slug);
  if (!result.ok) notFound();
  return {
    title: "Review Agent Activation",
    description: "Review an agent identity and permission scope before creating an Altana session.",
  };
}

export default async function HirePage({ params }: { params: Promise<{ slug: string }> }) {
  const raw = (await params).slug;
  const slug = decodeSlugParam(raw);
  if (slug === null) notFound();
  const result = await getMarketplaceAgentBySlug(slug);
  if (!result.ok) notFound();

  const agent = result.agent;
  return (
    <HireActivationView
      agent={{
        name: agent.name,
        agentId: agent.slug,
        description: agent.description,
        category: agent.category,
        protocols: agent.protocols,
        x402Supported: agent.x402Supported,
        chainId: agent.chainId,
        isTestnet: agent.isTestnet,
        verification: agent.verification,
      }}
    />
  );
}
