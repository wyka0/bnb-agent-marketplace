/**
 * PancakeSwap Market Intelligence — display copy + formatters.
 *
 * Kept FRAMEWORK-FREE (no JSX) so the verify harness can import and assert the
 * exact display semantics WITHOUT rendering React in Node. The client component
 * imports these helpers, so the tested copy is the shipped copy (no drift).
 *
 * Honesty rules enforced here:
 *   - every value is either real measured data or an explicit "—" (unknown),
 *     never a fabricated 0;
 *   - 24h volume is NOT available from the on-chain source → honest note, and
 *     the pool model always carries `volume24hUsd: null`;
 *   - APR/APY are NEVER fabricated — on-chain data provides neither;
 *   - the sample scope (registry head/tail window) is stated verbatim;
 *   - the read-only disclaimer is mandatory copy (no execution is possible);
 *   - every failure/absence state maps to honest copy (never a fake row).
 */

import type {
  PancakeSwapIntelligenceData,
  PancakeSwapIntelligencePool,
  PancakeSwapSample,
} from "../../../../lib/pancakeswap/intelligence";

/** The section title — identifies this as market intelligence, not agent data. */
export const PANCAKESWAP_SECTION_TITLE = "PancakeSwap Market Intelligence" as const;

/** The mandatory read-only disclaimer (no swaps / LP transactions exist here). */
export const PANCAKESWAP_READ_ONLY_DISCLAIMER =
  "Read-only market intelligence — no swaps or liquidity transactions are executed by this marketplace." as const;

/** The mandatory source label — identifies PancakeSwap + network distinctly. */
export const PANCAKESWAP_SOURCE_LABEL = "PancakeSwap · BSC mainnet · Chain ID 56" as const;

/** Honest 24h-volume framing: the field exists but on-chain data cannot supply it. */
export const PANCAKESWAP_VOLUME_LABEL = "24h volume" as const;
export const PANCAKESWAP_VOLUME_NOTE =
  "24h volume is not available from the on-chain source." as const;

/** Fee-tier label + the official V2 constant display. */
export const PANCAKESWAP_FEE_TIER_LABEL = "Fee tier" as const;

/** Mandatory APR/APY honesty note (on-chain data provides neither). */
export const PANCAKESWAP_APR_NOTE = "APR/APY not available from on-chain data" as const;

/** Section description — states the source chain, the sample scope and independence. */
export const PANCAKESWAP_SECTION_DESCRIPTION =
  "Live read-only market and liquidity intelligence for PancakeSwap V2 pairs on BSC mainnet (chain 56): on-chain reserves + official PancakeSwap price API. Bounded sample of the pair registry, ranked by computed TVL (USD). Independent of 8004scan reputation and TermiX AACP — never combined. This is market data, not the agent's own performance." as const;

/**
 * Human-readable copy for each honest non-ready state. `not-found` states the
 * task requirement verbatim: no matching pools → "No pool data available".
 */
export const PANCAKESWAP_FAILURE_COPY: Record<string, string> = {
  "not-found": "No pool data available.",
  timeout: "PancakeSwap data is taking too long to respond.",
  "network-error": "PancakeSwap data is temporarily unavailable.",
  "server-error": "PancakeSwap data is temporarily unavailable.",
  "rate-limited": "PancakeSwap data is temporarily unavailable.",
  "bad-request": "PancakeSwap data is temporarily unavailable.",
  unauthorized: "PancakeSwap data is temporarily unavailable.",
  forbidden: "PancakeSwap data is temporarily unavailable.",
  error: "PancakeSwap data is temporarily unavailable.",
};

/** True when the result is a ready state with usable pools. */
export function isPancakeSwapReady(data: PancakeSwapIntelligenceData | undefined): data is {
  state: "ready";
  pools: PancakeSwapIntelligencePool[];
  sample: PancakeSwapSample;
  source: "pancakeswap";
  chainId: 56;
  retrievedAt: string;
} {
  return (
    data !== undefined &&
    data.state === "ready" &&
    Array.isArray(data.pools) &&
    data.pools.length > 0
  );
}

/** Resolve the non-ready failure copy for a discriminated result. */
export function pancakeSwapFailureCopy(data: PancakeSwapIntelligenceData | undefined): string {
  const reason = data && data.state !== "ready" ? data.state : "error";
  return PANCAKESWAP_FAILURE_COPY[reason] ?? PANCAKESWAP_FAILURE_COPY.error ?? "";
}

/** Bounded pools list (display cap). Never returns more than `limit`. */
export function displayPools(
  data: PancakeSwapIntelligenceData | undefined,
  limit = 5
): PancakeSwapIntelligencePool[] {
  if (!isPancakeSwapReady(data)) return [];
  return data.pools.slice(0, Math.max(1, limit));
}

/** Compact USD formatter — honest unknown is "—", never a fabricated 0. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

/** Compact numeric formatter — tabular, honest. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(value);
  }
}

/** Fee-tier display: the official V2 constant (0.25%) or an honest "—". */
export function formatFeeTier(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Honest sample-scope label, e.g.
 * "Sample: first 8 and latest 8 of 2,690,351 registered V2 pairs."
 * Null registry length → "Sample: first 8 and latest 8 registered V2 pairs."
 */
export function formatSampleScope(sample: PancakeSwapSample | undefined | null): string {
  const head = sample?.headCount ?? 0;
  const tail = sample?.tailCount ?? 0;
  const prefix = `Sample: first ${head} and latest ${tail} registered PancakeSwap V2 pairs`;
  if (sample?.registryLength !== null && sample?.registryLength !== undefined) {
    return `${prefix} (registry ${sample.registryLength.toLocaleString()}).`;
  }
  return `${prefix}.`;
}
