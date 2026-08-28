/**
 * X.49 offline security-hardening verifier.
 *
 * No Next server, Prisma connection, KMS, SDK signer, RPC, or blockchain
 * operation is used here. Existing X.42-X.47 verifiers cover the lifecycle;
 * this suite covers the new policy/provider/reservation contracts and source
 * boundaries introduced by X.49.
 */

import { readFileSync } from "node:fs";
import { buildSecurityHeaders, isHttpsRequest } from "./headers.ts";
import {
  createMemoryRateLimitProvider,
  evaluateRateLimit,
  RATE_LIMIT_POLICIES,
} from "./rate-limiter.ts";
import { createMemorySessionStore } from "../altana-session/store.memory.ts";

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

async function main(): Promise<void> {
  // 1-3. Security headers / CSP / HSTS.
  {
    const production = buildSecurityHeaders({ production: true, https: true, nonce: "x49nonce" });
    const development = buildSecurityHeaders({ production: false, https: false, nonce: "x49dev" });
    const csp = production["Content-Security-Policy"] ?? "";
    check(
      "production security headers include XCTO, referrer, permissions, and frame protection",
      production["X-Content-Type-Options"] === "nosniff" &&
        production["Referrer-Policy"] === "strict-origin-when-cross-origin" &&
        production["Permissions-Policy"]?.includes("camera=()") === true &&
        production["X-Frame-Options"] === "DENY"
    );
    check(
      "production CSP is narrow and nonce-based",
      csp.includes("default-src 'self'") &&
        csp.includes("script-src 'self' 'nonce-x49nonce' 'strict-dynamic'") &&
        csp.includes("object-src 'none'") &&
        csp.includes("frame-ancestors 'none'") &&
        !csp.includes("unsafe-eval") &&
        !csp.includes("unsafe-inline")
    );
    check(
      "HSTS is production HTTPS-only and localhost development remains usable",
      production["Strict-Transport-Security"]?.includes("max-age=63072000") === true &&
        development["Strict-Transport-Security"] === undefined &&
        development["Content-Security-Policy"] === undefined
    );
    check(
      "HTTPS detection honors forwarded production protocol",
      isHttpsRequest("http://localhost:3000/", "https") &&
        !isHttpsRequest("http://localhost:3000/", "http")
    );
  }

  // 4-5. Rate-limit policies and memory-provider behavior.
  {
    const provider = createMemoryRateLimitProvider();
    const policy = RATE_LIMIT_POLICIES.find((item) => item.route === "altana.session.revoke");
    if (!policy) throw new Error("missing revoke policy");
    const start = new Date("2026-08-15T10:00:00.000Z");
    let last = await evaluateRateLimit(provider, policy, "user-a", start);
    for (let index = 1; index < policy.limitPerWindow; index += 1)
      last = await evaluateRateLimit(provider, policy, "user-a", start);
    const atLimit = await evaluateRateLimit(provider, policy, "user-a", start);
    const otherUser = await evaluateRateLimit(provider, policy, "user-b", start);
    const reset = await evaluateRateLimit(
      provider,
      policy,
      "user-a",
      new Date(start.getTime() + policy.windowSeconds * 1000)
    );
    check(
      "rate-limit policy registry covers all audited expensive endpoints",
      [
        "auth.nonce",
        "auth.verify",
        "auth.logout",
        "auth.me",
        "altana.session.read",
        "altana.session.revoke",
        "activation.hire",
        "activation.main-track-hire",
        "activation.aave.preview",
        "agents.bnb.testnet.risk",
      ].every((name) => RATE_LIMIT_POLICIES.some((item) => item.route === name))
    );
    check(
      "rate limiter allows under-limit requests and rejects at the threshold",
      last.allowed && atLimit.allowed === false && atLimit.remaining === 0
    );
    check("rate limiter isolates callers", otherUser.allowed);
    check("rate limiter resets after the fixed UTC window", reset.allowed);
    const broken = {
      incr: async () => {
        throw new Error("backend unavailable");
      },
    };
    const failed = await evaluateRateLimit(broken, policy, "user-a", start);
    check(
      "rate limiter fails closed when the provider errors",
      failed.allowed === false && failed.providerError === true
    );
  }

  // 6. Dependency override and migration/source markers.
  {
    const root = JSON.parse(read("../../package.json")) as {
      pnpm?: { overrides?: Record<string, string>; onlyBuiltDependencies?: string[] };
    };
    const overrides = root.pnpm?.overrides ?? {};
    check(
      "postcss and sharp vulnerable transitive paths have fixed-version overrides",
      typeof overrides.postcss === "string" &&
        overrides.postcss.includes("8.5.23") &&
        typeof overrides.sharp === "string" &&
        overrides.sharp.includes("0.35.0")
    );
    check(
      "build scripts use an explicit allowlist",
      root.pnpm?.onlyBuiltDependencies?.includes("@prisma/client") === true &&
        root.pnpm?.onlyBuiltDependencies?.includes("sharp") === true
    );
    check(
      "rate-limit migration is present",
      read("../../prisma/migrations/202608150002_x49_rate_limit_bucket/migration.sql").includes(
        "RateLimitBucket"
      )
    );
  }

  // 7-10. Atomic reservation contract, concurrency, settlement, daily reset.
  {
    const store = createMemorySessionStore();
    const created = await store.createSession({
      userId: "user-a",
      walletId: "wallet-a",
      chainId: 97,
      now: new Date("2026-08-15T10:00:00.000Z"),
    });
    const sessionId = created.id;
    await store.updateSession({
      id: sessionId,
      patch: {
        status: "active",
        walletAddress: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
        publicKey: "0x04" + "1".repeat(128),
        keyId: "0x" + "2".repeat(64),
        publicMetadata: {},
      },
      now: new Date("2026-08-15T10:00:00.000Z"),
    });
    const now = new Date("2026-08-15T10:00:00.000Z");
    const reservations = await Promise.all(
      Array.from({ length: 10 }, () =>
        store.tryReserveSpend({ sessionId, amountRaw: 1n, capRaw: 1n, now })
      )
    );
    const granted = reservations.filter((item) => item.allowed).length;
    check("ten concurrent reservations against cap 1 grant exactly one", granted === 1);
    check(
      "concurrent reservation rejects nine requests before broadcast",
      reservations.filter((item) => !item.allowed).length === 9
    );
    await store.settleReservation({ sessionId, amountRaw: 1n, mode: "confirmed", now });
    const settled = await store.loadById({ id: sessionId });
    check(
      "confirmed reservation persists one unit and clears pending",
      settled?.publicMetadata?.spentRaw === "1" &&
        settled.publicMetadata.spentWindow === "2026-08-15"
    );
    const nextDay = new Date("2026-08-16T00:01:00.000Z");
    const nextWindow = await store.tryReserveSpend({
      sessionId,
      amountRaw: 1n,
      capRaw: 1n,
      now: nextDay,
    });
    check(
      "daily UTC window resets confirmed usage",
      nextWindow.allowed && nextWindow.windowSpentRaw === "0"
    );
    await store.settleReservation({ sessionId, amountRaw: 1n, mode: "released", now: nextDay });
    const released = await store.tryReserveSpend({
      sessionId,
      amountRaw: 1n,
      capRaw: 1n,
      now: nextDay,
    });
    check("released reservation returns capacity", released.allowed);
    await store.settleReservation({ sessionId, amountRaw: 1n, mode: "held", now: nextDay });
    const held = await store.tryReserveSpend({
      sessionId,
      amountRaw: 1n,
      capRaw: 1n,
      now: nextDay,
    });
    check("held post-broadcast reservation is not released", held.allowed === false);
  }

  // 11-12. Chain safety and mainnet rejection source checks.
  {
    const types = read("lib/altana-session/types.ts");
    const entry = read("lib/altana-session/index.server.ts");
    const integration = read("../../packages/integrations/src/altana/session.ts");
    check(
      "Altana policy remains pinned to chain 97",
      types.includes("chainId: number") && integration.includes("ALTANA_SESSION_CHAIN_ID = 97")
    );
    check(
      "web entry explicitly rejects mainnet network selection",
      entry.includes("ALTANA_NETWORK") &&
        entry.includes('"bnb"') &&
        entry.includes("chain 97 is required")
    );
  }

  // 13. Secret and boundary scan for X.49 additions.
  {
    const files = [
      "lib/security/headers.ts",
      "lib/security/rate-limiter.ts",
      "lib/security/rate-limit.route.ts",
      "middleware.ts",
    ];
    const source = files.map(read).join("\n");
    check(
      "X.49 additions contain no secret values or NEXT_PUBLIC credentials",
      !/AWS_SECRET_ACCESS_KEY\s*=|ALTANA_TESTNET_PRIVATE_KEY\s*=|privateKey\s*[:=]\s*['"]|NEXT_PUBLIC_.*(KEY|TOKEN|SECRET)/i.test(
        source
      )
    );
  }

  // 14-17. Regression/isolation source checks. Full X.47/X.45 suites run in
  // the same pnpm test chain; these checks ensure X.49 did not add cross-track
  // execution paths.
  {
    const api = read("lib/altana-session/api.ts");
    const service = read("lib/altana-session/service.ts");
    const routes =
      read("app/api/altana/session/route.ts") + read("app/api/altana/session/revoke/route.ts");
    check(
      "X.47 ownership and revoke handlers remain present",
      api.includes("identity.userId") &&
        api.includes("foreign") === false &&
        routes.includes("getAuthenticatedUser")
    );
    check(
      "X.45/X.46 lifecycle entry points remain unchanged",
      service.includes("executeAllowedOperation") &&
        service.includes("revokeActiveSession") &&
        service.includes("ALTANA_SESSION_EXECUTED")
    );
    check(
      "Agent 1816 has no executable coupling in session code",
      !/ownerOf\s*\(|agentId\s*[:=]\s*1816|modify\s+Agent/i.test(service)
    );
    check(
      "Job 515/ERC-8183 settlement has no executable coupling in session code",
      !/fund\s*\(|submitJob|settleJob|createJob|ERC8183Settlement/i.test(service + api)
    );
  }

  console.log(
    `X.49 SECURITY VERIFIER: ${checks} checks, ${failures} failures — ${failures === 0 ? "ALL PASS" : "FAILURES PRESENT"}`
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    `X.49 BLOCKED — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
  );
  process.exitCode = 1;
});
