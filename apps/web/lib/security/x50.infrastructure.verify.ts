/**
 * X.50 offline production-infrastructure verifier.
 *
 * Verifies only what can be proven WITHOUT external infrastructure: the
 * production configuration policy, the 8004scan record validation added in
 * X.50, migration/constraint evidence in the checked-in SQL, deployment
 * configuration, security headers, and chain-97 / isolation regressions.
 *
 * No database, KMS, Vercel, RPC, or blockchain access occurs here.
 */

import { readFileSync } from "node:fs";
import { inspectProductionConfig, PRODUCTION_CHAIN_ID } from "./production-config.ts";
import { buildSecurityHeaders } from "./headers.ts";
import { filterValidAgentRecords, isValidAgentRecord } from "../eight004scan/client.ts";

let checks = 0;
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${checks}. ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const PRODUCTION_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://runtime@db.example-pooler.neon.tech:5432/marketplace",
  DIRECT_DATABASE_URL: "postgresql://migrator@db.example.neon.tech:5432/marketplace",
  ALTANA_KMS_PROVIDER: "aws",
  AWS_REGION: "example-region",
  ALTANA_KMS_KEY_ID: "example-key-reference",
  RATE_LIMIT_BACKEND: "prisma",
  AUTH_CANONICAL_ORIGIN: "https://marketplace.example",
  ALTANA_ADMIN_CUSTODY_PROVIDER: "example-remote-signer",
  ALTANA_ADMIN_KEY_REFERENCE: "example-key-ref",
  ALTANA_NETWORK: "bnb-testnet",
} satisfies Record<string, string>;

function withEnv(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return { ...PRODUCTION_ENV, ...overrides };
}

function hasIssue(env: Record<string, string | undefined>, code: string): boolean {
  return inspectProductionConfig(env).issues.some((issue) => issue.code === code);
}

async function main(): Promise<void> {
  // 1-2. Production configuration policy baseline.
  {
    const fullyConfigured = inspectProductionConfig(PRODUCTION_ENV);
    const development = inspectProductionConfig({ NODE_ENV: "development" });
    check("fully provisioned production configuration passes the policy", fullyConfigured.ok && fullyConfigured.production);
    check("development configuration is not blocked by production-only requirements", development.ok && development.production === false);
  }

  // 3-9. Fail-closed production requirements.
  {
    check("missing pooled DATABASE_URL fails closed", hasIssue(withEnv({ DATABASE_URL: undefined }), "database-url-missing"));
    check("local database host is rejected in production", hasIssue(withEnv({ DATABASE_URL: "postgresql://runtime@localhost:5432/marketplace" }), "database-url-local"));
    check("missing direct migration URL fails closed", hasIssue(withEnv({ DIRECT_DATABASE_URL: undefined }), "database-url-missing"));
    check("test KMS provider cannot be selected in production", hasIssue(withEnv({ ALTANA_KMS_PROVIDER: "test" }), "kms-provider"));
    check("missing AWS KMS region/key fails closed", hasIssue(withEnv({ AWS_REGION: undefined }), "kms-region-missing") && hasIssue(withEnv({ ALTANA_KMS_KEY_ID: undefined }), "kms-key-missing"));
    check("per-instance memory rate limiting is rejected in production", hasIssue(withEnv({ RATE_LIMIT_BACKEND: "memory" }), "rate-limit-not-distributed"));
    check("non-HTTPS canonical origin is rejected in production", hasIssue(withEnv({ AUTH_CANONICAL_ORIGIN: "http://marketplace.example" }), "auth-origin-insecure"));
  }

  // 10-12. Custody and secret-exposure policy.
  {
    check("raw Altana admin private key in environment is rejected", hasIssue(withEnv({ ALTANA_TESTNET_PRIVATE_KEY: "0x" + "1".repeat(64) }), "admin-key-in-env"));
    check("missing remote-signer custody reference is rejected", hasIssue(withEnv({ ALTANA_ADMIN_CUSTODY_PROVIDER: undefined }), "admin-custody-missing"));
    check("secrets exposed through NEXT_PUBLIC_ are rejected in any environment", hasIssue({ NODE_ENV: "development", NEXT_PUBLIC_API_KEY: "x" }, "public-secret"));
  }

  // 13-14. Chain safety.
  {
    check(`mainnet network selection is rejected (chain ${PRODUCTION_CHAIN_ID} only)`, hasIssue(withEnv({ ALTANA_NETWORK: "bnb" }), "chain-not-testnet"));
    const entry = read("lib/altana-session/index.server.ts");
    check("web Altana entry still refuses mainnet at construction", entry.includes("chain 97 is required"));
  }

  // 15-17. 8004scan per-record validation (X.49 LOW finding closed).
  {
    const valid = { id: "a", agent_id: "97:0xabc:1", token_id: "1", chain_id: 97, chain_type: "evm", is_testnet: true };
    check("well-formed upstream agent records are accepted", isValidAgentRecord(valid));
    check("malformed upstream agent records are rejected", !isValidAgentRecord({ ...valid, agent_id: 12 }) && !isValidAgentRecord({ ...valid, chain_id: "97" }) && !isValidAgentRecord(null));
    check("malformed rows are dropped from list results", filterValidAgentRecords([valid, { id: "b" }, null, { ...valid, id: "" }]).length === 1);
  }

  // 18-21. Migration + constraint evidence (no database access).
  {
    const baseline = read("../../prisma/migrations/202608150001_x41_postgres_prisma_foundation/migration.sql");
    const rateLimit = read("../../prisma/migrations/202608150002_x49_rate_limit_bucket/migration.sql");
    const combined = `${baseline}\n${rateLimit}`;
    const requiredTables = ["User", "Wallet", "AuthSession", "SiweChallenge", "AltanaSession", "SessionPermission", "EncryptedSecret", "AuditEvent", "RateLimitBucket"];
    check("all required production tables are created by checked-in migrations", requiredTables.every((table) => combined.includes(`CREATE TABLE "${table}"`)));
    check("chain-97 constraints are present for chain-bearing tables", ["Wallet", "SiweChallenge", "AuthSession", "AltanaSession"].every((table) => combined.includes(`"${table}_chainId_check" CHECK ("chainId" = 97)`)));
    check("ownership and uniqueness constraints are present", combined.includes('CREATE UNIQUE INDEX "Wallet_chainId_address_key"') && combined.includes('CREATE UNIQUE INDEX "AuthSession_tokenHash_key"') && combined.includes('"AltanaSession_one_live_per_wallet_idx"'));
    check("restrictive deletion and audit preservation semantics are present", combined.includes("ON DELETE RESTRICT") && combined.includes('ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey"') && combined.includes("ON DELETE SET NULL"));
    check("migrations contain no destructive statements", !/DROP\s+TABLE|TRUNCATE|DROP\s+SCHEMA|DELETE\s+FROM/i.test(combined));
  }

  // 22-24. Deployment configuration.
  {
    const rootPackage = JSON.parse(read("../../package.json")) as { packageManager?: string; engines?: { node?: string } };
    const nextConfig = read("next.config.mjs");
    const dockerfile = read("../../Dockerfile");
    check("pinned Node and pnpm toolchain is declared", rootPackage.packageManager?.includes("9.15.9") === true && rootPackage.engines?.node?.includes("20") === true);
    check("standalone output and server-external packages remain configured", nextConfig.includes('output: "standalone"') && nextConfig.includes("@prisma/client") && nextConfig.includes("@aws-sdk/client-kms"));
    check("container image generates the Prisma client before building", dockerfile.includes("prisma generate"));
  }

  // 25-27. Security headers survive production policy.
  {
    const headers = buildSecurityHeaders({ production: true, https: true, nonce: "x50nonce" });
    const csp = headers["Content-Security-Policy"] ?? "";
    check("production HSTS and hardening headers are present", headers["Strict-Transport-Security"]?.includes("max-age=") === true && headers["X-Content-Type-Options"] === "nosniff" && headers["Referrer-Policy"] === "strict-origin-when-cross-origin" && headers["Permissions-Policy"] !== undefined && headers["X-Frame-Options"] === "DENY");
    check("production CSP remains narrow (no unsafe directives, no wildcard)", csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'") && !csp.includes("unsafe-eval") && !csp.includes("unsafe-inline") && !csp.includes("*"));
    check("no third-party origin was added to the production CSP", !/https?:\/\//.test(csp));
  }

  // 28-30. Isolation regressions.
  {
    const productionConfig = read("lib/security/production-config.ts");
    const service = read("lib/altana-session/service.ts");
    const api = read("lib/altana-session/api.ts");
    check("no mainnet RPC endpoint was introduced", !/bsc-dataseed|binance\.org|bsc-rpc\.publicnode/i.test(productionConfig + service + api));
    check("Agent 1816 remains untouched by production configuration code", !/1816/.test(productionConfig));
    check("Job 515 / ERC-8183 settlement remains untouched by production configuration code", !/515|settleJob|submitJob|fund\(/i.test(productionConfig));
  }

  // 31-33. Credential-bearing server modules keep a build-enforced boundary.
  {
    const serverOnlyModules = [
      "lib/pancakeswap/client.ts",
      "lib/auth/session.server.ts",
      "lib/custody/index.ts",
      "lib/altana-session/index.server.ts",
    ];
    check("credential-bearing server modules import the server-only barrier", serverOnlyModules.every((path) => read(path).includes('import "server-only"')), serverOnlyModules.filter((path) => !read(path).includes('import "server-only"')).join(","));
    const pancake = read("lib/pancakeswap/client.ts");
    check("PancakeSwap loader remains read-only (no execution surface)", !/writeContract|sendTransaction|signTypedData|walletClient|privateKey/i.test(pancake));
    check("PancakeSwap credential is never exposed through NEXT_PUBLIC_", !/NEXT_PUBLIC_PANCAKESWAP/i.test(pancake.replace(/never NEXT_PUBLIC_\*/g, "")));
  }

  console.log(`X.50 INFRASTRUCTURE VERIFIER: ${checks} checks, ${failures} failures — ${failures === 0 ? "ALL PASS" : "FAILURES PRESENT"}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`X.50 BLOCKED — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
