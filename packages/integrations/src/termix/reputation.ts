/**
 * TermiX AACP — READ-ONLY reputation normalization + ERC-8004 identity mapping.
 *
 * This is the public entry point of the TermiX reputation adapter. It:
 *   1. resolves an ERC-8004 agent identity to an AACP `agentId` (deterministic
 *      only when the NFT is the TermiX `MockAgentNFT` on chain 97), and
 *   2. fetches the public reputation record and normalizes it honestly.
 *
 * Guarantees:
 *   - READ-ONLY. No wallet, no signer, no private key, no transaction, no
 *     staking/hiring/settlement. It can only call read-only client GETs.
 *   - Never fabricates data. A missing/unmapped agent yields an explicit
 *     `not-found`/`unsupported` result — NEVER `score: 0`.
 *   - Keeps TermiX distinct from 8004scan: the normalized record carries
 *     `source: "termix-aacp"`; it does not overwrite or merge any other score.
 */

import { createTermixClient, isRawReputation, type TermixClientOptions } from "./client.js";
import {
  TERMIX_AACP_CHAIN_ID,
  TERMIX_AGENT_NFT_ADDRESS,
  TERMIX_REPUTATION_SOURCE,
  type Erc8004AgentIdentity,
  type TermixAnomaly,
  type TermixIdentityMapping,
  type TermiXRawReputation,
  type TermixReputation,
  type TermixReputationResult,
} from "./types.js";

/** Documented anomaly bit mask (reputation.md). Bit → decoded flag. */
const ANOMALY_BITS: readonly { bit: number; flag: TermixAnomaly }[] = [
  { bit: 0, flag: "overturn-count" },
  { bit: 1, flag: "borderline-count" },
  { bit: 2, flag: "llm-deviation" },
  { bit: 3, flag: "extreme-pass-rate" },
];

/** Decode the 4-bit `anomalyFlags` mask into human-readable flags. */
export function decodeAnomalyFlags(mask: number): TermixAnomaly[] {
  if (!Number.isFinite(mask) || mask <= 0) return [];
  const flags: TermixAnomaly[] = [];
  for (const { bit, flag } of ANOMALY_BITS) {
    if ((mask & (1 << bit)) !== 0) flags.push(flag);
  }
  return flags;
}

/** Whether an `agentId` looks like the documented uint256 token-id string. */
export function isValidAgentId(agentId: string): boolean {
  return typeof agentId === "string" && /^[0-9]+$/.test(agentId);
}

/**
 * Resolve an ERC-8004 agent identity (as exposed by 8004scan: `token_id`,
 * `chain_id`, `contract_address`) to a TermiX AACP `agentId`.
 *
 * Deterministic ONLY when the NFT is the TermiX `MockAgentNFT` on chain 97,
 * because AACP defines `tokenId = agentId` for that contract. Any other chain
 * or contract has NO documented mapping → `unsupported` (never guessed).
 */
export function mapErc8004ToTermixAgentId(identity: Erc8004AgentIdentity): TermixIdentityMapping {
  if (identity.chainId !== TERMIX_AACP_CHAIN_ID) {
    return {
      ok: false,
      reason: "unsupported",
      message: `TermiX AACP is BSC Testnet (chain ${TERMIX_AACP_CHAIN_ID}); identity is on chain ${identity.chainId}.`,
    };
  }
  const contract = identity.contractAddress.trim().toLowerCase();
  if (contract !== TERMIX_AGENT_NFT_ADDRESS) {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "No deterministic mapping: the ERC-8004 NFT is not the TermiX MockAgentNFT, so its token id is not an AACP agentId.",
    };
  }
  if (!isValidAgentId(identity.tokenId)) {
    return {
      ok: false,
      reason: "unsupported",
      message: `token id "${identity.tokenId}" is not a uint256 string.`,
    };
  }
  // MockAgentNFT on chain 97: tokenId === agentId (documented in network.md).
  return { ok: true, agentId: identity.tokenId };
}

/**
 * Normalize a RAW AACP reputation record into the honest application shape.
 * Only fields the API documents are copied; the anomaly mask is decoded; the
 * source + retrieval time are stamped. No value is invented.
 */
export function normalizeReputation(raw: TermiXRawReputation): TermixReputation {
  const normalized: TermixReputation = {
    agentId: raw.agentId,
    chainId: TERMIX_AACP_CHAIN_ID,
    score: raw.score,
    totalJobs: raw.totalJobs,
    completedJobs: raw.completedJobs,
    onTimeJobs: raw.onTimeJobs,
    approvedJobs: raw.approvedJobs,
    disputeWins: raw.disputeWins,
    anomalyFlags: raw.anomalyFlags,
    anomalies: decodeAnomalyFlags(raw.anomalyFlags),
    source: TERMIX_REPUTATION_SOURCE,
    retrievedAt: new Date().toISOString(),
  };
  if (raw.evaluatorMetrics !== undefined) {
    normalized.evaluatorMetrics = raw.evaluatorMetrics;
  }
  return normalized;
}

/**
 * Fetch + normalize a TermiX reputation record by AACP `agentId` (uint256
 * string). Read-only; returns a discriminated result. Malformed upstream
 * bodies degrade to `error`, never to a fabricated score.
 */
export async function getTermixReputationByAgentId(
  agentId: string,
  options: TermixClientOptions = {}
): Promise<TermixReputationResult> {
  if (!isValidAgentId(agentId)) {
    return {
      ok: false,
      reason: "bad-request",
      message: `agentId "${agentId}" must be a uint256 string.`,
    };
  }
  const client = createTermixClient(options);
  const result = await client.getRawReputation(agentId);
  if (!result.ok) {
    return { ok: false, reason: result.reason, status: result.status, message: result.message };
  }
  if (!isRawReputation(result.data)) {
    return { ok: false, reason: "error", message: "unexpected reputation shape" };
  }
  return { ok: true, data: normalizeReputation(result.data) };
}

/**
 * Fetch + normalize a TermiX reputation record for an ERC-8004 agent identity
 * (the 8004scan → AACP path). Resolves identity first; when no deterministic
 * mapping exists it returns `unsupported` WITHOUT any network call.
 */
export async function getTermixReputationForAgent(
  identity: Erc8004AgentIdentity,
  options: TermixClientOptions = {}
): Promise<TermixReputationResult> {
  const mapping = mapErc8004ToTermixAgentId(identity);
  if (!mapping.ok) {
    return { ok: false, reason: "unsupported", message: mapping.message };
  }
  return getTermixReputationByAgentId(mapping.agentId, options);
}
