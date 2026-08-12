/**
 * Shared Leaderboard types (framework-neutral, safe for client + server).
 *
 * These describe the NORMALIZED internal model derived from 8004scan. They carry
 * no server-only imports so the client view can import them as types without
 * pulling server code into the browser bundle.
 *
 * Honesty rule encoded in the types: every metric 8004scan does NOT provide is
 * typed as `null` (category, risk, reputationLevel, activity, successRate).
 */

import type { AgentCategory } from "@bnb-marketplace/config";
import type { Scan8004Pagination } from "./types";

/** Verification is the only trust signal the API exposes (`is_verified: bool`). */
export type NormalizedVerification = "verified" | "unverified";

export interface LeaderboardAgent {
  id: string;
  agentId: string;
  tokenId: string;
  /** Slug used for the marketplace detail route (`/agents/[slug]`). */
  slug: string;
  name: string;
  chainId: number;
  chainType: string;
  isTestnet: boolean;

  /** Product category — NOT provided by 8004scan → always null. */
  category: AgentCategory | null;
  /** Supported protocols (real array; may be empty). */
  protocols: string[];
  /** Agent display description (real API field; may be null when absent). */
  description: string | null;
  /** Whether the agent's registry record declares x402 payment support. */
  x402Supported: boolean;

  /** Verification tier derived from `is_verified` (real boolean). */
  verification: NormalizedVerification;
  /** Risk — NOT provided by 8004scan → always null. */
  risk: null;

  /** Registry/total score as returned by the API (real number). */
  registryScore: number | null;
  /** API's own rank (real field; currently null upstream). */
  sourceRank: number | null;
  /** API's network rank (real field; currently null upstream). */
  networkRank: number | null;

  /** Reputation raw signals (real). No qualitative "level" is invented. */
  averageScore: number | null;
  totalFeedbacks: number | null;
  starCount: number | null;
  /** Reputation *level* (excellent/good/…) — NOT provided → null. */
  reputationLevel: null;

  /** Activity *level* — NOT provided → null. */
  activity: null;
  /** Success rate — NOT provided → null. */
  successRate: null;

  updatedAt: string | null;
  createdAt: string | null;

  ownerAddress: string | null;
  /** Registry contract address (real API field). */
  contractAddress: string | null;
  /** Registry health score (real API field; null when absent upstream). */
  healthScore: number | null;
  imageUrl: string | null;

  source: "8004scan";
}

/** Discriminated data availability the UI switches on (honest states only). */
export type LeaderboardDataState =
  "missing-key" | "ready" | "empty" | "unauthorized" | "rate-limited" | "offline" | "error";

export interface LeaderboardData {
  state: LeaderboardDataState;
  agents: LeaderboardAgent[];
  pagination: Scan8004Pagination | null;
  lastIndexed: string | null;
}
