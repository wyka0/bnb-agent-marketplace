import { z } from "zod";

/**
 * Environment variable validation.
 *
 * Uses plain Zod (no schema-to-env reflection) so it works identically on the
 * server and in edge/worker runtimes without framework-specific helpers.
 * `NEXT_PUBLIC_*` variables are server-declared here; the web build injects
 * them into the client at compile time.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_WS_URL: z.string().url().default("ws://localhost:4000"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/marketplace"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  OTEL_SERVICE_NAME: z.string().default("bnbsm"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

  /**
   * 8004scan public API (ERC-8004 agent registry).
   * Base URL is safe to expose; the API key is SERVER-ONLY.
   *
   * IMPORTANT: `8004SCAN_API_KEY` must NEVER be exposed to the browser — it is
   * intentionally NOT prefixed with `NEXT_PUBLIC_`. When it is absent the app
   * still works (anonymous tier / graceful "unavailable" state); it is optional.
   */
  EIGHT004SCAN_BASE_URL: z.string().url().default("https://8004scan.io/api/v1/public"),
  "8004SCAN_API_KEY": z.string().min(1).optional(),

  /**
   * Altana integration (non-custodial agentic wallets + KeyStore sessions).
   * All Altana variables are SERVER-ONLY. The Altana SDK requires no API key,
   * and read-only verification must not require a private key.
   *
   * IMPORTANT: never prefix these with `NEXT_PUBLIC_`. They stay testnet-first
   * by default (`bnb-testnet`, chain 97) — the integration must never default
   * to mainnet. A private-key signer variable (for sessions/execution) is NOT
   * added yet; it arrives with the session phase.
   */
  ALTANA_NETWORK: z
    .enum(["bnb", "bnb-testnet"])
    .default("bnb-testnet")
    .describe("Altana execution network. Defaults to BNB testnet (97)."),
  ALTANA_RPC_URL: z
    .string()
    .url()
    .optional()
    .describe("Override Altana public RPC per-environment (server-side)."),
});

/**
 * Strictly parsed environment, or `null` when validation is skipped.
 * Skipping is intended for contexts where env vars are not present yet
 * (e.g. build-time CI stages) and consumers must not crash on load.
 */
export function loadEnv(
  overrides: Record<string, string | undefined> = process.env
): z.infer<typeof envSchema> | null {
  const result = envSchema.safeParse(overrides);
  if (result.success) return result.data;
  console.error("Environment validation failed", result.error.flatten().fieldErrors);
  return null;
}

/** Lazily-cached parsed environment (best-effort). */
const env = loadEnv();

export type ServerEnv = NonNullable<typeof env>;
export { env };
