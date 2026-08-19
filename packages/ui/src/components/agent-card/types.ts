/**
 * Shared domain types for the Agent Card system.
 *
 * These types are deliberately UI-only: they describe *what an agent is* in
 * display terms and each field carries a comment mapping it to the future
 * production source (ERC-8004 / 8004scan, Altana, PancakeSwap, Agent Studio).
 * Consumers (marketplace, dashboard, favorites) pass data in this shape;
 * the Agent Card never fetches anything itself.
 */

/** ERC-8004 registry token id (`tokenId`) + chain id. Both unique keys. */
export interface AgentRegistryRef {
  chainId: number;
  tokenId: string;
}

/** Reputation block — future source: 8004scan agent detail (score + feedback). */
export interface AgentReputation {
  /** 0–5 aggregate score. `undefined` = no data (registry pending). */
  score?: number;
  /** Number of reviews/feedback entries. */
  reviews?: number;
}

/** Builder/owner block — future source: 8004 registry `owner` + account scan. */
export interface AgentBuilder {
  /** Display name the builder chose (or ENS). */
  name?: string;
  /** Wallet address (0x…). */
  address?: string;
  /** Registry-level builder verification. */
  verified?: boolean;
}

/**
 * Status of the agent in the ERC-8004 registry.
 * - `loading`: no registry round-trip finished yet
 * - `pending`: agent found but fields incomplete
 * - `live`: fully synced, hireable data present
 * - `offline`: registry reachable, agent absent/unlisted
 * - `updating`: a registry resync is in flight
 */
export type RegistryStatus = "loading" | "pending" | "live" | "offline" | "updating";

/** Risk posture of an agent; unknown when registry data is missing. */
export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

/** All badge kinds the card understands. */
export type AgentBadgeKind =
  | "erc8004-verified"
  | "builder-verified"
  | "audited"
  | "trending"
  | "featured"
  | "new"
  | "experimental"
  | "coming-soon";

/** Badges derived from registry flags + platform editorial decisions. */
export interface AgentBadge {
  kind: AgentBadgeKind;
  label?: string;
}

/** A single capability of the agent (auto-trading strategy, rebalancing…). */
export interface AgentCapability {
  /** Stable id used for filtering/facet search later. */
  id: string;
  /** Human label ("Rebalancing", "Take profit"…). */
  label: string;
}

/** A protocol the agent can operate (Altana, PancakeSwap…). */
export interface AgentProtocol {
  /** Protocol id ("altana", "pancakeswap", "aave"…). */
  id: string;
  /** Human label. */
  label: string;
}

/** Agent card root: raw registry + UI-consumer fields. */
export interface AgentCardData {
  /** ERC-8004 registry coordinates. */
  registry: {
    chainId: number;
    tokenId: string;
  };
  /** Agent display name — 8004scan `name` field. */
  name: string;
  /** Logo URL — 8004scan `agentUri/tokenURI` logo. */
  logoUrl?: string;
  /** Short description — registry or agent-owned copy. */
  description?: string;
  /** Primary category — maps to category taxonomy. */
  category?: string;
  /** Capability tags. */
  capabilities?: AgentCapability[];
  /** Supported protocols. */
  protocols?: AgentProtocol[];
  /** Reputation — 8004scan agent statistic. */
  reputation?: AgentReputation;
  /** Agent-approved risk level. */
  risk?: RiskLevel;
  /** Builder/owner record. */
  builder?: AgentBuilder;
  /** Registry sync status. */
  registryStatus?: RegistryStatus;
  /** Last updated timestamp (ISO string). */
  updatedAt?: string;
  /** Display badges. */
  badges?: AgentBadge[];
  /** Detail page href — if card is to be an exposed anchor. */
  href?: string;
  /** Whether the agent is hireable right now (coming soon → always false). */
  hireable?: boolean;
  /** Honest disabled-state reason when activation is unavailable. */
  hireUnavailableReason?: string;
}

/**
 * Interaction events. The card component never owns state — the consumer
 * (marketplace/dashboard page) owns favorite + compare state and passes
 * handlers + current values down. This keeps the card fully reusable.
 */
export interface AgentCardActions {
  /** Favorite controls. Omit to hide the favorite button. */
  favorite?: {
    active: boolean;
    /** Toggle favorite for this agent. */
    onToggle: () => void;
  };
  /** Compare controls. Omit to hide the compare checkbox. */
  compare?: {
    selected: boolean;
    /** Toggle compare selection for this agent. */
    onToggle: () => void;
  };
  /** Open the agent detail view (route/page or drawer). */
  onViewDetails?: (agent: AgentCardData) => void;
}

/** Which card layout is being composed. */
export type AgentCardVariant = "compact" | "standard" | "detailed";
