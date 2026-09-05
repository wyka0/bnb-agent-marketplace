/**
 * BSC category classifier — deterministic, transparent, evidence-keeping.
 *
 * 8004scan records carry NO category/capability/skills fields, so the
 * marketplace never claims 8004scan classified anything. This module matches
 * real agent metadata (name + description) against a fixed, documented phrase
 * table and returns, for every match, the actual evidence excerpt it used.
 *
 * Honesty rules (Main Track P8):
 *  - Description evidence always wins. A NAME-only match counts ONLY when the
 *    agent has no description at all (a name is never sufficient when better
 *    metadata exists).
 *  - No category is assigned when no phrase matches (→ `uncategorized`).
 *  - An agent may match MULTIPLE categories if its real metadata supports them.
 *  - Pure + deterministic: same input ⇒ same output, no randomness, no state,
 *    no network, no server imports (framework-free; type-only deps).
 *
 * The result is always framed as an INFERENCE:
 *   source: "8004scan metadata" — never "8004scan category = …".
 */

import type { LeaderboardAgent } from "../leaderboard-types";

export type DiscoveryCategoryKey =
  "rebalancing" | "grid-trading" | "yield-optimisation" | "health-factor-monitoring";

export const DISCOVERY_CATEGORIES: ReadonlyArray<{
  key: DiscoveryCategoryKey;
  /** Canonical admin label (Main Track P7/P8). */
  label: string;
  /** Primary search keyword used for bounded server-side retrieval. */
  searchKeyword: string;
  description: string;
}> = [
  {
    key: "rebalancing",
    label: "Rebalancing",
    searchKeyword: "rebalanc",
    description: "Portfolio/asset rebalancing agents.",
  },
  {
    key: "grid-trading",
    label: "Grid Trading",
    searchKeyword: "grid",
    description: "Grid trading bots and strategies.",
  },
  {
    key: "yield-optimisation",
    label: "Yield Optimisation",
    searchKeyword: "yield",
    description: "Yield optimisation, farming, compounding, vaults.",
  },
  {
    key: "health-factor-monitoring",
    label: "Health Factor Monitoring",
    searchKeyword: "health",
    description: "Health-factor / lending-loan-health monitoring.",
  },
] as const;

/** Map a UI facet label (any spelling) or canonical label → discovery key. */
export function discoveryCategoryKeyFromLabel(label: string): string {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, "-");
  switch (normalized) {
    case "rebalancing":
      return "rebalancing";
    case "grid-trading":
      return "grid-trading";
    case "yield-optimisation":
    case "yield-optimization":
      return "yield-optimisation";
    case "health-factor-monitoring":
    case "health-factor":
      return "health-factor-monitoring";
    default:
      return normalized; // unknown labels stay as-is (match nothing by design)
  }
}

/* ------------------------------------------------------------------ *
 * Phrase table — the SINGLE transparency surface. Every rule is a
 * documented phrase (case-insensitive regex) plus OPTIONAL context
 * requirement (`requires`) so generic words never fire in isolation.
 * ------------------------------------------------------------------ */

interface CategoryPhrase {
  /** Raw phrase from live metadata this rule looks for. */
  phrase: string;
  /** Case-insensitive match on the metadata text. */
  pattern: RegExp;
  /** When set, the FULL text must also match this context to accept. */
  requires?: RegExp;
}

const CATEGORY_PHRASES: Record<DiscoveryCategoryKey, CategoryPhrase[]> = {
  // Rebalancing — the word family is unambiguous in DeFi metadata.
  rebalancing: [
    { phrase: "rebalancing", pattern: /\brebalanc(?:e|er|es|ing|ed)?\b/i },
    { phrase: "portfolio rebalancing", pattern: /portfolio rebalanc/i },
    { phrase: "asset rebalancing", pattern: /asset rebalanc/i },
  ],

  // Grid Trading — strong compound phrases; the bare word "grid" only
  // fires when the metadata also has trading context (energy/power-grid
  // roleplay agents must NOT match).
  "grid-trading": [
    { phrase: "grid trading", pattern: /grid trading/i },
    { phrase: "grid trader", pattern: /grid trader/i },
    { phrase: "spot grid", pattern: /spot grid/i },
    { phrase: "perp grid", pattern: /perp grid/i },
    { phrase: "grid bot", pattern: /grid bot/i },
    { phrase: "grid strategy", pattern: /grid strategy/i },
    { phrase: "DCA, grid", pattern: /dca[, ]*grid/i },
    {
      phrase: "grid",
      pattern: /\bgrid\b/i,
      requires: /\b(dca|trading|trade|trader|bot|strateg(?:ies|y)|orders?)\b/i,
    },
  ],

  // Yield Optimisation — the word "yield" is the canonical DeFi signal.
  "yield-optimisation": [
    { phrase: "yield", pattern: /\byield\b/i },
    { phrase: "auto-compounding", pattern: /auto-?compound(?:ing|s)?/i },
    { phrase: "yield farming", pattern: /yield farming/i },
    { phrase: "yield optimizer", pattern: /yield optimi[sz](?:e|er|es|ing|ation)?/i },
  ],

  // Health Factor Monitoring — MUST describe lending/loan health explicitly.
  // Generic phrases like "health monitoring", "monitors … health" (medical,
  // validator, site-health) do NOT match.
  "health-factor-monitoring": [
    { phrase: "health factor", pattern: /health[ -]?factor/i },
    { phrase: "loan health", pattern: /loan health/i },
    { phrase: "lending health", pattern: /lending health/i },
    { phrase: "borrow health", pattern: /borrow health/i },
    { phrase: "collateral health", pattern: /collateral health/i },
    { phrase: "debt health", pattern: /debt health/i },
  ],
};

/** Truncate a description excerpt around a match (deterministic). */
function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 48);
  const end = Math.min(text.length, index + length + 64);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

/** Evidence kept for one accepted category match. */
export interface DiscoveryMatchEvidence {
  category: DiscoveryCategoryKey;
  /** Canonical admin label. */
  label: string;
  /** Where the evidence came from: description (preferred) or name. */
  evidence: "description" | "name";
  /** The actual excerpt of real metadata that matched (never fabricated). */
  evidenceText: string;
  /** Honest framing: inferred from registry METADATA, never the registry's own verdict. */
  source: "8004scan metadata";
}

export interface DiscoveryResult {
  categories: DiscoveryMatchEvidence[];
  uncategorized: boolean;
}

/** Classify raw metadata strings (framework-free, testable). */
export function classifyAgentText(input: {
  name: string | null;
  description: string | null;
}): DiscoveryResult {
  const description = input.description?.trim() ?? "";
  const name = input.name?.trim() ?? "";

  const categories: DiscoveryMatchEvidence[] = [];

  for (const { key, label } of DISCOVERY_CATEGORIES) {
    const phrases = CATEGORY_PHRASES[key];

    // 1) Description evidence — always accepted (preferred).
    let fromDescription: DiscoveryMatchEvidence | undefined;
    if (description.length > 0) {
      for (const rule of phrases) {
        const m = rule.pattern.exec(description);
        if (!m) continue;
        // Context guard: the whole description must satisfy `requires`.
        if (rule.requires && !rule.requires.test(description)) continue;
        fromDescription = {
          category: key,
          label,
          evidence: "description",
          evidenceText: excerptAround(description, m.index, m[0].length),
          source: "8004scan metadata",
        };
        break;
      }
    }

    // 2) Name evidence — ONLY when there is no description to judge by.
    //    (Never trust a name when better metadata exists.)
    if (!fromDescription && description.length === 0 && name.length > 0) {
      for (const rule of phrases) {
        const m = rule.pattern.exec(name);
        if (!m) continue;
        fromDescription = {
          category: key,
          label,
          evidence: "name",
          evidenceText: excerptAround(name, m.index, m[0].length),
          source: "8004scan metadata",
        };
        break;
      }
    }

    if (fromDescription) categories.push(fromDescription);
  }

  return { categories, uncategorized: categories.length === 0 };
}

/** Classify a normalized live agent record (deterministic). */
export function classifyAgent(agent: LeaderboardAgent): DiscoveryResult {
  return classifyAgentText({ name: agent.name, description: agent.description });
}

/**
 * BSC inclusion guard — discovery surfaces BNB Chain ONLY (never other
 * chains). X.154: both BSC mainnet (chain 56) and BSC testnet (chain 97) are
 * supported for the hackathon, so testnet records are included. The marketplace
 * must surface real BSC Testnet agents; a stale/unreachable seller endpoint is
 * a data-quality state, not a reason to hide the agent.
 */
export function includeInBscDiscovery(chainId: number, isTestnet: boolean): boolean {
  return (chainId === 56 && isTestnet === false) || (chainId === 97 && isTestnet === true);
}
