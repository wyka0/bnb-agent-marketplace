import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentDetailView } from "./agent-detail-view";
import { titleFromSlug, isValidSlug, isAgentIdSlug, decodeSlugParam } from "@/lib/agent-slug";
import { getMarketplaceAgentBySlug, type AgentLookupResult } from "@/lib/eight004scan/marketplace";
import { getTermixReputationForAgent, type TermixReputationResult } from "@/lib/termix/reputation";
import {
  getPancakeSwapPoolIntelligence,
  type PancakeSwapIntelligenceData,
} from "@/lib/pancakeswap/intelligence";

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
 *
 * Malformed slugs and well-formed registry identities that do not exist are
 * rejected here via `notFound()` — metadata runs BEFORE the response streams,
 * so an unknown agent yields a true 404 (a page-level notFound() alone would
 * stream 200 after the head is committed). Registry failures other than
 * "not-found" stay honest pages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const raw = (await params).slug;
  const slug = decodeSlugParam(raw);
  if (slug === null || (!isValidSlug(slug) && !isAgentIdSlug(slug))) notFound();
  if (!isAgentIdSlug(slug)) {
    return {
      title: { absolute: `${titleFromSlug(slug)} | Agent Studio Marketplace` },
      description: `Agent details for ${titleFromSlug(slug)}.`,
    };
  }
  const agentResult = await getMarketplaceAgentBySlug(slug);
  if (!agentResult.ok && agentResult.reason === "not-found") notFound();
  if (!agentResult.ok) {
    return {
      title: { absolute: `${titleFromSlug(slug)} | Agent Studio Marketplace` },
      description: `Agent details for ${titleFromSlug(slug)}.`,
    };
  }
  const agent = agentResult.agent;
  return {
    title: { absolute: `${agent.name} | Agent Studio Marketplace` },
    description:
      agent.description ?? `Live agent record from the ERC-8004 registry (${agent.slug}).`,
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
 * KEYLESS by design (Option B): official public BNB Chain JSON-RPC (eth_call)
 * + the official PancakeSwap price API (explorer.pancakeswap.com). NO wallet,
 * signing, approval, swap or transaction of any kind — a strict read-only
 * boundary. Always resolves to a discriminated `PancakeSwapIntelligenceData`;
 * any failure becomes an honest non-ready state — the page core still renders.
 */
function resolvePancakeSwap(): Promise<PancakeSwapIntelligenceData> {
  return getPancakeSwapPoolIntelligence({ limit: 5 });
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await params).slug;
  const slug = decodeSlugParam(raw);
  if (slug === null || (!isValidSlug(slug) && !isAgentIdSlug(slug))) notFound();
  // Live agent + TermiX + PancakeSwap resolve independently server-side; a
  // failure in any one leaves an honest state and NEVER breaks the page.
  const [agentResult, termix, pancakeswap] = await Promise.all([
    resolveAgent(slug),
    resolveTermix(await searchParams),
    resolvePancakeSwap(),
  ]);
  // A well-formed registry identity that does not exist is a genuine 404
  // (matches the hire route; slug-only pages keep their neutral 200 state).
  if (isAgentIdSlug(slug) && !agentResult.ok && agentResult.reason === "not-found") notFound();
  return (
    <AgentDetailView
      slug={slug}
      agent={agentResult.ok ? agentResult.agent : undefined}
      termix={termix}
      pancakeswap={pancakeswap}
    />
  );
}
