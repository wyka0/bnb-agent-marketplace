/**
 * Map a normalized LeaderboardAgent (8004scan) → the AgentCard display model.
 *
 * FRAMEWORK-FREE (no JSX, no React, no fetch): the market view and the verify
 * harness share this module so the shipped card data mapping is testable in
 * Node without rendering. Type-only imports only — nothing server-only, no
 * credential code, no network.
 *
 * Honesty rules encoded here:
 *   - Only fields 8004scan really returns are populated (name, logo, registry
 *     coordinates, protocols, reputation signals, verification).
 *   - Category is absent (8004scan does not classify) → never set.
 *   - Risk is absent → never set (the card renders its honest "pending").
 *   - A genuine 0 reputation signal is passed through verbatim (never hidden).
 *   - `hireable` is capability-derived (X.6) — true only for ACTIVATABLE
 *     agents (chain 97 + verified actionable capability); real registry
 *     agents never claim it.
 *   - The detail href is the deterministic registry identity (`agent_id`).
 */

import type { AgentCardData } from "@bnb-marketplace/ui";
import type { LeaderboardAgent } from "./leaderboard-types";
import { classifyAgentActivation } from "../activation/capability.ts";

/** Human label for a chain id (only where known; else the raw id). */
export function chainLabelForId(chainId: number): string {
  switch (chainId) {
    case 56:
      return "BNB Chain";
    case 1:
      return "Ethereum";
    case 97:
      return "BNB Testnet";
    case 196:
      return "X Layer";
    case 8453:
      return "Base";
    default:
      return `Chain ${chainId}`;
  }
}

/** Deterministic detail href from the immutable registry identity. */
export function agentHrefFromId(slug: string): string {
  return `/agents/${encodeURIComponent(slug)}`;
}

export function toAgentCardData(agent: LeaderboardAgent): AgentCardData {
  const activation = classifyAgentActivation({
    chainId: agent.chainId,
    isTestnet: agent.isTestnet,
  });
  const reputation =
    agent.averageScore != null || agent.totalFeedbacks != null
      ? {
          // genuine values; a real 0 passes through verbatim (never hidden)
          score: agent.averageScore ?? undefined,
          reviews: agent.totalFeedbacks ?? undefined,
        }
      : undefined;

  return {
    registry: { chainId: agent.chainId, tokenId: agent.tokenId },
    name: agent.name,
    logoUrl: agent.imageUrl ?? undefined,
    description: agent.description ?? undefined,
    protocols: agent.protocols.map((p) => ({ id: p, label: p })),
    reputation,
    registryStatus: "live",
    updatedAt: agent.updatedAt ?? undefined,
    badges: agent.verification === "verified" ? [{ kind: "erc8004-verified" }] : undefined,
    href: agentHrefFromId(agent.slug),
    // `hireable` is CAPABILITY-DERIVED, never hard-coded: true only when the
    // agent classifies ACTIVATABLE (chain 97 + a verified actionable
    // capability). All real registry agents stay non-hireable/honest.
    hireable: activation.state === "ACTIVATABLE",
    hireUnavailableReason:
      activation.state === "ACTIVATABLE" ? undefined : activation.detail,
  } as AgentCardData;
}
