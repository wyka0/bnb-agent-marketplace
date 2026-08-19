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
  DIRECT_DATABASE_URL: z
    .string()
    .url()
    .optional()
    .describe("Direct PostgreSQL connection for Prisma migrations only."),
  AUTH_CANONICAL_ORIGIN: z
    .string()
    .url()
    .default("http://localhost:3000")
    .describe("Server-authoritative origin used for SIWE domain and URI binding."),
  AUTH_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(900)
    .max(2_592_000)
    .default(604_800)
    .describe("Opaque marketplace authentication session lifetime."),
  RATE_LIMIT_BACKEND: z
    .enum(["memory", "prisma", "redis"])
    .default("memory")
    .describe("Rate-limit backend. Use prisma after the X.49 migration is deployed; redis remains unprovisioned."),
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

  /**
   * X.44 KMS custody configuration. SERVER-ONLY — never prefix with
   * NEXT_PUBLIC_. The AWS KMS key is customer-managed and provisioned
   * out-of-band; application code only consumes the key identifier.
   * All three variables are optional so builds/CI without KMS still pass;
   * the custody factory fails closed when AWS config is missing.
   */
  AWS_REGION: z
    .string()
    .min(1)
    .optional()
    .describe("AWS region hosting the customer-managed KMS custody key (server-only)."),
  ALTANA_KMS_KEY_ID: z
    .string()
    .min(1)
    .optional()
    .describe("Customer-managed AWS KMS key id/alias/ARN for Altana signer custody (server-only)."),
  ALTANA_KMS_PROVIDER: z
    .enum(["aws", "test"])
    .default("aws")
    .describe("KMS provider. 'test' is a test-only in-memory adapter, rejected in production (server-only)."),
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
