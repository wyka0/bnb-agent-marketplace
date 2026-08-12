/**
 * PancakeSwap Pool Intelligence — display copy + formatters.
 *
 * Kept FRAMEWORK-FREE (no JSX) so the verify harness can import and assert the
 * exact display semantics WITHOUT rendering React in Node. The client component
 * imports these helpers, so the tested copy is the shipped copy (no drift).
 *
 * Honesty rules enforced here:
 *   - cumulative volume is LABELED cumulative — NEVER "24h";
 *   - APR/APY are NEVER fabricated — the V2 subgraph does not provide them;
 *   - no composite/merged reputation score is produced;
 *   - every failure/absence state maps to honest copy (never a fake row).
 */

import type { PancakeSwapPoolsData, PancakeSwapPool } from "../../../../lib/pancakeswap/client";

/**
 * Human-readable copy for each honest non-ready PancakeSwap state. `error` is
 * the catch-all (no raw GraphQL/server text is surfaced to users).
 */
export const PANCAKESWAP_FAILURE_COPY: Record<string, string> = {
  "not-found": "PancakeSwap pool data is not currently available.",
  timeout: "PancakeSwap data is taking too long to respond.",
  "network-error": "PancakeSwap data is temporarily unavailable.",
  "server-error": "PancakeSwap data is temporarily unavailable.",
  "rate-limited": "PancakeSwap data is temporarily unavailable.",
  "bad-request": "PancakeSwap data is temporarily unavailable.",
  unauthorized: "PancakeSwap data is temporarily unavailable.",
  forbidden: "PancakeSwap data is temporarily unavailable.",
  error: "PancakeSwap data is temporarily unavailable.",
};

/** The mandatory source label — identifies PancakeSwap distinctly. */
export const PANCAKESWAP_SOURCE_LABEL = "PancakeSwap · BSC · Chain ID 56" as const;

/** The honest cumulative-volume label (NEVER "24h Volume"). */
export const PANCAKESWAP_CUMULATIVE_VOLUME_LABEL = "Cumulative volume" as const;

/** Mandatory APR/APY honesty note (the V2 subgraph provides neither). */
export const PANCAKESWAP_APR_NOTE = "APR/APY unavailable from PancakeSwap V2 data" as const;

/** True when the result is a ready state with usable pools. */
export function isPancakeSwapReady(data: PancakeSwapPoolsData | undefined): data is {
  state: "ready";
  pools: PancakeSwapPool[];
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
export function pancakeSwapFailureCopy(data: PancakeSwapPoolsData | undefined): string {
  const reason = data && data.state !== "ready" ? data.state : "error";
  return PANCAKESWAP_FAILURE_COPY[reason] ?? PANCAKESWAP_FAILURE_COPY.error ?? "";
}

/** Bounded pools list (display cap). Never returns more than `limit`. */
export function displayPools(data: PancakeSwapPoolsData | undefined, limit = 5): PancakeSwapPool[] {
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

/** Compact numeric formatter (swap counts, prices) — tabular, honest. */
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
