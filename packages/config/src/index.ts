/**
 * @bnb-marketplace/config
 *
 * Shared configuration, constants, feature flags, and domain types used
 * across the monorepo (web app, worker, data layer, and integrations).
 */

export * from "./constants.js";
export * from "./feature-flags.js";
export * from "./types.js";
export { env } from "./env.js";
export type { ServerEnv } from "./env.js";
