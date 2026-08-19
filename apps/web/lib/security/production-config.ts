/**
 * X.50 production configuration assertions.
 *
 * Pure, offline-verifiable policy checks that make production misconfiguration
 * fail CLOSED instead of degrading silently at request time. This module never
 * reads or returns secret VALUES — it only inspects presence, scheme/host
 * class, and enum selections, and it never logs anything.
 *
 * Enforced in production (`NODE_ENV=production`):
 *   - Altana chain must be BNB Testnet 97; `ALTANA_NETWORK=bnb` (mainnet 56) is
 *     rejected outright.
 *   - PostgreSQL runtime + migration URLs must be present and non-local.
 *   - KMS must be the real AWS provider with region + key id; the test adapter
 *     is forbidden.
 *   - Rate limiting must use a cross-instance backend (`prisma`), never
 *     process-local memory.
 *   - The canonical auth origin must be HTTPS.
 *   - The long-lived Altana admin key must NOT be supplied as a raw env private
 *     key; production requires the remote-signer/custody reference instead.
 *   - No secret may be exposed through a `NEXT_PUBLIC_*` variable.
 */

export const PRODUCTION_CHAIN_ID = 97 as const;
export const FORBIDDEN_CHAIN_ID = 56 as const;

export type ProductionConfigIssue = {
  code: string;
  variable: string;
  message: string;
};

export type ProductionConfigReport = {
  production: boolean;
  ok: boolean;
  issues: ProductionConfigIssue[];
};

const SECRETISH_PUBLIC_PATTERN = /^NEXT_PUBLIC_.*(KEY|TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL)/i;

function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

function classifyPostgresUrl(variable: string, raw: string | undefined, issues: ProductionConfigIssue[]): void {
  if (!present(raw)) {
    issues.push({ code: "database-url-missing", variable, message: `${variable} is required in production.` });
    return;
  }
  let host: string;
  let scheme: string;
  try {
    const parsed = new URL(raw as string);
    host = parsed.hostname;
    scheme = parsed.protocol;
  } catch {
    issues.push({ code: "database-url-invalid", variable, message: `${variable} is not a valid connection URL.` });
    return;
  }
  if (scheme !== "postgres:" && scheme !== "postgresql:") {
    issues.push({ code: "database-url-scheme", variable, message: `${variable} must use a postgres connection scheme.` });
  }
  if (isLocalHost(host)) {
    issues.push({ code: "database-url-local", variable, message: `${variable} must not point at a local database in production.` });
  }
}

/**
 * Evaluate the production configuration policy. Returns a structured report so
 * callers can fail closed; never throws for inspection purposes.
 */
export function inspectProductionConfig(env: Record<string, string | undefined>): ProductionConfigReport {
  const production = (env.NODE_ENV ?? "development") === "production";
  const issues: ProductionConfigIssue[] = [];

  // Chain safety applies in every environment: mainnet is never a valid target.
  if ((env.ALTANA_NETWORK ?? "bnb-testnet") !== "bnb-testnet") {
    issues.push({
      code: "chain-not-testnet",
      variable: "ALTANA_NETWORK",
      message: `ALTANA_NETWORK must select BNB Testnet ${PRODUCTION_CHAIN_ID}; mainnet ${FORBIDDEN_CHAIN_ID} is forbidden.`,
    });
  }

  for (const [name, value] of Object.entries(env)) {
    if (SECRETISH_PUBLIC_PATTERN.test(name) && present(value)) {
      issues.push({ code: "public-secret", variable: name, message: `${name} must not carry a secret through NEXT_PUBLIC_.` });
    }
  }

  if (!production) return { production, ok: issues.length === 0, issues };

  classifyPostgresUrl("DATABASE_URL", env.DATABASE_URL, issues);
  classifyPostgresUrl("DIRECT_DATABASE_URL", env.DIRECT_DATABASE_URL, issues);

  const kmsProvider = env.ALTANA_KMS_PROVIDER ?? "aws";
  if (kmsProvider !== "aws") {
    issues.push({ code: "kms-provider", variable: "ALTANA_KMS_PROVIDER", message: "production custody requires ALTANA_KMS_PROVIDER=aws." });
  }
  if (!present(env.AWS_REGION)) {
    issues.push({ code: "kms-region-missing", variable: "AWS_REGION", message: "AWS_REGION is required for AWS KMS custody." });
  }
  if (!present(env.ALTANA_KMS_KEY_ID)) {
    issues.push({ code: "kms-key-missing", variable: "ALTANA_KMS_KEY_ID", message: "ALTANA_KMS_KEY_ID is required for AWS KMS custody." });
  }

  if ((env.RATE_LIMIT_BACKEND ?? "memory") !== "prisma") {
    issues.push({
      code: "rate-limit-not-distributed",
      variable: "RATE_LIMIT_BACKEND",
      message: "production requires a cross-instance rate-limit backend (prisma); memory is per-instance only.",
    });
  }

  if (!present(env.AUTH_CANONICAL_ORIGIN)) {
    issues.push({ code: "auth-origin-missing", variable: "AUTH_CANONICAL_ORIGIN", message: "AUTH_CANONICAL_ORIGIN is required in production." });
  } else {
    try {
      if (new URL(env.AUTH_CANONICAL_ORIGIN as string).protocol !== "https:") {
        issues.push({ code: "auth-origin-insecure", variable: "AUTH_CANONICAL_ORIGIN", message: "AUTH_CANONICAL_ORIGIN must be https in production." });
      }
    } catch {
      issues.push({ code: "auth-origin-invalid", variable: "AUTH_CANONICAL_ORIGIN", message: "AUTH_CANONICAL_ORIGIN must be a valid origin." });
    }
  }

  // The long-lived admin key must live in remote/HSM custody, never as a raw
  // env private key in the deployment platform.
  if (present(env.ALTANA_TESTNET_PRIVATE_KEY)) {
    issues.push({
      code: "admin-key-in-env",
      variable: "ALTANA_TESTNET_PRIVATE_KEY",
      message: "a raw Altana admin private key must never be configured in production; use remote-signer custody.",
    });
  }
  if (!present(env.ALTANA_ADMIN_CUSTODY_PROVIDER) || !present(env.ALTANA_ADMIN_KEY_REFERENCE)) {
    issues.push({
      code: "admin-custody-missing",
      variable: "ALTANA_ADMIN_CUSTODY_PROVIDER",
      message: "production requires ALTANA_ADMIN_CUSTODY_PROVIDER and ALTANA_ADMIN_KEY_REFERENCE (remote signer custody).",
    });
  }

  return { production, ok: issues.length === 0, issues };
}

/**
 * Fail-closed assertion for server startup / release gating. Throws with issue
 * CODES and variable NAMES only — never values.
 */
export function assertProductionConfig(env: Record<string, string | undefined> = process.env): void {
  const report = inspectProductionConfig(env);
  if (report.ok) return;
  const summary = report.issues.map((issue) => `${issue.variable}:${issue.code}`).join(", ");
  throw new Error(`X.50 production configuration is not deployable: ${summary}`);
}
