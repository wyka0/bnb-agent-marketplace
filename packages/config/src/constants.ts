/**
 * Centralized application constants.
 *
 * Keep values here so that naming, defaults, and supported surfaces stay in
 * sync across the web app, worker, and data-access layers.
 */

export const APP_NAME = "BNB Agent Studio Marketplace" as const;
export const APP_DESCRIPTION =
  "Discover, hire, configure, and monitor AI agents on BNB Chain." as const;

/** Supported agent categories (equal priority by product mandate). */
export const AGENT_CATEGORIES = ["rebalancing", "grid-trading", "yield", "health-factor"] as const;

export type AgentCategory = (typeof AGENT_CATEGORIES)[number];

/** Partner track identifiers. */
export const PARTNERS = ["altana", "termix", "pancakeswap"] as const;
export type PartnerId = (typeof PARTNERS)[number];

/** Supported chains (expansion surface). */
export const SUPPORTED_CHAINS = ["bsc", "opbnb"] as const;
export type ChainId = (typeof SUPPORTED_CHAINS)[number];

export const DEFAULT_CHAIN: ChainId = "bsc";

export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/compare", label: "Compare" },
  { href: "/leaderboards", label: "Leaderboards" },
] as const;
