/**
 * Normalize raw 8004scan agents → the internal `LeaderboardAgent` model.
 *
 * Built ONLY from fields 8004scan actually returns (`GET /agents`). Any metric
 * the API does not expose (product category, risk, reputation *level*, activity
 * *level*, success rate) is `null` — never fabricated, never defaulted to 0.
 *
 * Rank is NOT invented here: `sourceRank`/`networkRank` mirror the API's own
 * fields (currently `null` upstream). Positional ordinals (1,2,3…) are assigned
 * at render time from the API's returned order — they are not a computed score.
 */

import type { LeaderboardAgent } from "./leaderboard-types";
import type { Scan8004Agent } from "./types";

/** Coerce a finite number or return null (never 0-as-missing). */
function num(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Map one raw 8004scan agent → LeaderboardAgent. Unsupported fields → null. */
export function normalizeAgent(a: Scan8004Agent): LeaderboardAgent {
  const name = a.name && a.name.trim().length > 0 ? a.name : `Agent #${a.token_id}`;

  return {
    id: a.id,
    agentId: a.agent_id,
    tokenId: a.token_id,
    // Detail route key: the composite agent_id is the only stable, real identifier.
    slug: a.agent_id,
    name,
    chainId: a.chain_id,
    chainType: a.chain_type,
    isTestnet: a.is_testnet,

    category: null, // 8004scan does not classify product category
    protocols: Array.isArray(a.supported_protocols) ? a.supported_protocols : [],
    description: a.description && a.description.trim().length > 0 ? a.description : null,
    x402Supported: a.x402_supported === true,

    verification: a.is_verified ? "verified" : "unverified",
    risk: null, // not provided by 8004scan

    registryScore: num(a.total_score),
    sourceRank: num(a.rank),
    networkRank: num(a.network_rank),
    healthScore: num(a.health_score),

    averageScore: num(a.average_score),
    totalFeedbacks: num(a.total_feedbacks),
    starCount: num(a.star_count),
    reputationLevel: null, // qualitative level not provided
    activity: null, // activity level not provided
    successRate: null, // not provided

    updatedAt: a.updated_at ?? null,
    createdAt: a.created_at ?? null,

    ownerAddress: a.owner_address ?? null,
    contractAddress: a.contract_address ?? null,
    imageUrl: a.image_url ?? null,

    source: "8004scan",
  };
}

export function normalizeAgents(list: Scan8004Agent[]): LeaderboardAgent[] {
  return list.map(normalizeAgent);
}
