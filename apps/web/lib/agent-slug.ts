/**
 * Agent slug + title helpers (Sprint 2D — Navigation & Routing).
 *
 * Pure, dependency-free string utilities shared by:
 *  - the Agent Details route (`/agents/[slug]`) for the display title + metadata
 *  - the future Marketplace → Agent Details navigation (real `AgentCard`s will
 *    call `agentHref(name)` to build their link once live registry data exists)
 *
 * No data, no fetching, no fake agents — these only transform strings.
 */

/**
 * Turn an agent display name into a URL-safe slug.
 *
 * "Momentum Rebalancer" → "momentum-rebalancer"
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/**
 * Turn a slug back into a human display title (Title Case).
 *
 * "momentum-rebalancer" → "Momentum Rebalancer"
 */
export function titleFromSlug(slug: string): string {
  return slug
    .replace(/-+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Build the canonical Agent Details href from an agent display name.
 *
 * Used by real `AgentCard`s once live data exists. Skeleton cards must NOT use
 * this — they stay non-interactive until the registry is connected.
 */
export function agentHref(name: string): string {
  return `/agents/${slugify(name)}`;
}

/**
 * Whether a route param is a well-formed agent slug (lowercase alphanumeric
 * segments separated by single hyphens). Malformed slugs are treated as
 * "unknown" and routed to the not-found page (Sprint 2D §12). This is a shape
 * check only — no registry lookup, no data.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Whether a route param is the deterministic registry identity used by live
 * records: the composite 8004scan `agent_id` — `chainId:contractAddress:tokenId`
 * (e.g. "56:0x8004a1…:264183"). The Marketplace and Leaderboards link to this
 * exact key. This is the ONLY slug form that can resolve to a live agent.
 */
export function isAgentIdSlug(slug: string): boolean {
  return /^\d+:0x[0-9a-fA-F]{40}:\d+$/.test(slug);
}

/**
 * Decode a dynamic route segment exactly once at the route boundary.
 *
 * The App Router can deliver dynamic params still percent-encoded
 * (`/agents/8453%3A0x…%3A63854` arrives as `8453%3A0x…%3A63854`).
 * Registry identities and name slugs never contain `%`, so a single decode
 * is idempotent for every valid slug; malformed escapes (`%zz`) are rejected
 * as invalid input so callers keep their not-found behavior.
 */
export function decodeSlugParam(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
