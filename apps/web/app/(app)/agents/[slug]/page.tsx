import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentDetailView } from "./agent-detail-view";
import { titleFromSlug, isValidSlug, isAgentIdSlug } from "@/lib/agent-slug";
import { getMarketplaceAgentBySlug, type AgentLookupResult } from "@/lib/eight004scan/marketplace";
import { getTermixReputationForAgent, type TermixReputationResult } from "@/lib/termix/reputation";
import { getPancakeSwapPools, type PancakeSwapPoolsData } from "@/lib/pancakeswap/client";

// Per-request only: live registry + optional TermiX lookups must NEVER run
// during `next build` (no network/secrets needed for CI). Mirrors the
// Leaderboards route. With no identity query params, no TermiX call happens.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Resolve the LIVE agent record for an agent_id slug (ONE bounded request,
 * exact key-equality match — never a fuzzy name guess). Slug-only display
 * routes that are not registry identities simply have no record.
 */
async function resolveAgent(slug: string): Promise<AgentLookupResult> {
  if (!isAgentIdSlug(slug)) {
    return { ok: false, reason: "not-found" };
  }
  return getMarketplaceAgentBySlug(slug);
}

/**
 * Dynamic metadata. The title is the real agent name when the live registry
 * record resolves; otherwise a generic neutral title (never a guess).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug) && !isAgentIdSlug(slug)) {
    return { title: { absolute: "Agent not found | Agent Studio Marketplace" } };
  }
  const agentResult = await resolveAgent(slug);
  if (agentResult.ok) {
    const agent = agentResult.agent;
    return {
      title: { absolute: `${agent.name} | Agent Studio Marketplace` },
      description:
        agent.description ?? `Live agent record from the ERC-8004 registry (${agent.slug}).`,
    };
  }
  return {
    title: { absolute: `${titleFromSlug(slug)} | Agent Studio Marketplace` },
    description: `Agent details for ${titleFromSlug(slug)}.`,
  };
}

/**
 * Resolve the optional TermiX reputation SERVER-SIDE.
 *
 * Identity is supplied via OPTIONAL, explicit query params
 * (`?tokenId=&chainId=&contract=`). This is deterministic — the adapter only
 * maps the TermiX MockAgentNFT on chain 97; anything else (or no params)
 * yields the honest `unsupported` state WITHOUT a network call. No agentId is
 * ever guessed and no wallet address is used as an identity.
 */
async function resolveTermix(
  searchParams: Record<string, string | string[] | undefined>
): Promise<TermixReputationResult | undefined> {
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const tokenId = first(searchParams.tokenId);
  const chainId = first(searchParams.chainId);
  const contract = first(searchParams.contract);

  // No identity supplied → render honest unsupported state, no fetch.
  if (!tokenId && !chainId && !contract) {
    return {
      ok: false,
      reason: "unsupported",
      message: "No ERC-8004 identity provided for this agent.",
    };
  }

  return getTermixReputationForAgent({
    tokenId: tokenId ?? "",
    chainId: Number(chainId ?? NaN),
    contractAddress: contract ?? "",
  });
}

/**
 * Resolve the READ-ONLY PancakeSwap pool intelligence SERVER-SIDE.
 *
 * A small bounded top-pools set from the official V2 subgraph (public, no key,
 * chain 56). Always resolves to a discriminated `PancakeSwapPoolsData`; any
 * failure becomes an honest non-ready state — the page core still renders.
 */
function resolvePancakeSwap(): Promise<PancakeSwapPoolsData> {
  return getPancakeSwapPools({ limit: 5 });
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isValidSlug(slug) && !isAgentIdSlug(slug)) notFound();
  // Live agent + TermiX + PancakeSwap resolve independently server-side; a
  // failure in any one leaves an honest state and NEVER breaks the page.
  const [agentResult, termix, pancakeswap] = await Promise.all([
    resolveAgent(slug),
    resolveTermix(await searchParams),
    resolvePancakeSwap(),
  ]);
  return (
    <AgentDetailView
      slug={slug}
      agent={agentResult.ok ? agentResult.agent : undefined}
      termix={termix}
      pancakeswap={pancakeswap}
    />
  );
}
