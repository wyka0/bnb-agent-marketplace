/**
 * X.49 rate limiting — pure core + providers (server-side only by import
 * discipline; consumed from route handlers and the server entry).
 *
 * Design:
 * - Fixed UTC time windows (`Math.floor(now / windowMs)`). Deterministic,
 *   timezone-independent, identical across instances for the same clock.
 * - Providers are the ONLY place counters live:
 *     - memory: atomic single-process map (safe within ONE server instance).
 *     - prisma: PostgreSQL bucket rows (atomic across instances; requires a
 *       provisioned database — X.50 prerequisite, selected via env opt-in).
 *     - redis:  slot documented for a future Redis provider (`INCR` + `EXPIRE`);
 *       NOT implemented or claimed until the dependency and service exist.
 * - Fail-safe: a provider error is surfaced as `providerError` and callers
 *   must deny (503), never silently bypass.
 * - Identity keys come from the authenticated server identity or the
 *   request's own shape; nothing client-controlled defines the bucket key.
 */

export type RateLimitScope = "identity" | "wallet" | "global";

export type RateLimitPolicy = {
  readonly route: string;
  readonly limitPerWindow: number;
  readonly windowSeconds: number;
  readonly scope: RateLimitScope;
  readonly rationale: string;
};

/**
 * X.49 endpoint rate-limit policy registry. Limits are conservative on
 * unauthenticated and amplified endpoints and generous on authenticated
 * read paths so normal UI usage (polling the permissions page) never breaks.
 */
export const RATE_LIMIT_POLICIES = [
  {
    route: "auth.nonce",
    limitPerWindow: 12,
    windowSeconds: 600,
    scope: "wallet",
    rationale: "mirrors + front-runs the DB-backed SIWE challenge limits",
  },
  {
    route: "auth.verify",
    limitPerWindow: 120,
    windowSeconds: 60,
    scope: "global",
    rationale: "signature recovery is computationally expensive",
  },
  {
    route: "auth.logout",
    limitPerWindow: 30,
    windowSeconds: 60,
    scope: "identity",
    rationale: "session revocation churn bound",
  },
  {
    route: "auth.me",
    limitPerWindow: 120,
    windowSeconds: 60,
    scope: "identity",
    rationale: "authenticated identity polling",
  },
  {
    route: "altana.session.read",
    limitPerWindow: 60,
    windowSeconds: 60,
    scope: "identity",
    rationale: "each read performs live KeyStore RPC",
  },
  {
    route: "altana.session.revoke",
    limitPerWindow: 10,
    windowSeconds: 60,
    scope: "identity",
    rationale: "retries re-broadcast a relay transaction",
  },
  {
    route: "activation.hire",
    limitPerWindow: 10,
    windowSeconds: 60,
    scope: "identity",
    rationale: "authenticated registry resolution and session creation boundary",
  },
  {
    route: "activation.main-track-hire",
    limitPerWindow: 10,
    windowSeconds: 60,
    scope: "identity",
    rationale:
      "authenticated Main Track hire: live seller negotiation, quote verification, receipt/verify reads",
  },
  {
    route: "activation.aave.preview",
    limitPerWindow: 10,
    windowSeconds: 60,
    scope: "global",
    rationale: "unauthenticated; x4 upstream amplification",
  },
  {
    route: "agents.bnb.testnet.risk",
    limitPerWindow: 30,
    windowSeconds: 60,
    scope: "global",
    rationale: "unauthenticated public RPC oracle",
  },
] as const satisfies readonly RateLimitPolicy[];

export type RateLimitOutcome = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  providerError: boolean;
};

export interface RateLimitProvider {
  /**
   * Atomically increment `key` within `windowKey` and report the new count.
   * Implementations MUST make the increment atomic (single op / transaction).
   * Must reject on backend failure (the policy layer fails closed on errors).
   */
  incr(key: string, windowKey: string, ttlSeconds: number): Promise<number>;
}

export const RATE_LIMIT_MEMORY_PROVIDER = "memory" as const;
export const RATE_LIMIT_PRISMA_PROVIDER = "prisma" as const;
export const RATE_LIMIT_REDIS_PROVIDER = "redis" as const;

export function windowKeyOf(now: Date, windowSeconds: number): string {
  return `${Math.floor(now.getTime() / (windowSeconds * 1000))}`;
}

/**
 * Evaluate one policy for one caller. `keyPart` is the scope-specific
 * identifier (identity id, wallet address, or a fixed global constant) and
 * MUST NOT be client-supplied free text.
 */
export async function evaluateRateLimit(
  provider: RateLimitProvider,
  policy: RateLimitPolicy,
  keyPart: string,
  now: Date
): Promise<RateLimitOutcome> {
  const windowKey = windowKeyOf(now, policy.windowSeconds);
  const key = `rl:${policy.route}:${policy.scope}:${keyPart}`;
  let count: number;
  try {
    count = await provider.incr(key, windowKey, policy.windowSeconds);
  } catch {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: policy.windowSeconds * 1000,
      providerError: true,
    };
  }
  const windowEnd = (Number(windowKey) + 1) * policy.windowSeconds * 1000;
  if (count <= policy.limitPerWindow) {
    return {
      allowed: true,
      remaining: policy.limitPerWindow - count,
      retryAfterMs: 0,
      providerError: false,
    };
  }
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: Math.max(1, windowEnd - now.getTime()),
    providerError: false,
  };
}

/**
 * Resolve the identity key used to bucket an identity-scoped route from the
 * authenticated server identity only (never browser input). Returns `null`
 * when no identity exists — callers decide whether that denies the route.
 */
export function identityKeyOf(identity: { userId: string } | null): string | null {
  return identity === null || identity.userId.length === 0 ? null : identity.userId;
}

export function globalKeyOf(route: string): string {
  return `${route}:all`;
}

/**
 * In-memory provider. Correct ONLY within a single server process: the X.49
 * deployment runs on multiple Vercel instances, so this provider is a
 * per-instance safety net (and the honest default while PostgreSQL/Redis are
 * provisioned). It is NEVER the claimed production-distributed limiter.
 */
export function createMemoryRateLimitProvider(): RateLimitProvider & {
  counters: Map<string, number>;
} {
  const counters = new Map<string, number>();
  return {
    counters,
    async incr(key: string, windowKey: string, ttlSeconds: number) {
      void ttlSeconds; // window rotation evicts entries implicitly below
      const composite = `${key}:${windowKey}`;
      const current = counters.get(composite) ?? 0;
      counters.set(composite, current + 1);
      if (counters.size > 10_000) {
        // Bounded growth: drop entries belonging to older windows.
        for (const stored of counters.keys()) {
          const suffix = stored.slice(stored.lastIndexOf(":") + 1);
          if (suffix !== windowKey) counters.delete(stored);
        }
      }
      return counters.get(composite) ?? 1;
    },
  };
}
