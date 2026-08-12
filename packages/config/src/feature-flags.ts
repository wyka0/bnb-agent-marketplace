/**
 * Feature flags and feature availability.
 *
 * Flags are intentionally environment-driven so behaviour can change between
 * local, staging, and production without code changes. The base configuration
 * is static; consumers may override at deploy time via env vars.
 */

export type FeatureFlag =
  | "feature.agents"
  | "feature.categories"
  | "feature.compare"
  | "feature.leaderboards"
  | "feature.realtime"
  | "feature.wallet"
  | "feature.permissions";

type FlagEnv = Record<FeatureFlag, boolean>;

/** Default flags. Feature-specific surfaces are enabled marketplace-wide. */
export const defaultFeatureFlags: FlagEnv = {
  "feature.agents": true,
  "feature.categories": true,
  "feature.compare": true,
  "feature.leaderboards": true,
  "feature.realtime": false,
  "feature.wallet": false,
  "feature.permissions": false,
};

/**
 * Resolve a single flag, honouring an optional env override.
 *
 * @example
 *   // via env: FEATURE_REALTIME=false
 *   const realtime = isEnabled("feature.realtime");
 */
export function isEnabled(
  flag: FeatureFlag,
  overrides?: Partial<Record<FeatureFlag, boolean>>
): boolean {
  const envKey = toEnvKey(flag);
  if (overrides && flag in overrides) return overrides[flag]!;
  if (typeof process !== "undefined" && process.env[envKey] !== undefined) {
    return process.env[envKey] === "true";
  }
  return defaultFeatureFlags[flag];
}

function toEnvKey(flag: FeatureFlag): string {
  const upper = flag
    .replace(/^feature\./, "")
    .replace(/-/g, "_")
    .toUpperCase();
  return `FEATURE_${upper}`;
}

export { toEnvKey };
