/**
 * X.49 route-level rate-limit gate — server-only. Composes provider
 * selection, policy evaluation, and the safe denial response. Fails CLOSED:
 * any provider error denies the request (503), never silently bypasses the
 * limiter. The provider factory is imported lazily at request time (same
 * lazy-load discipline the auth routes use for the Prisma store) so the
 * server-only/Prisma modules never enter eager page-data analysis.
 */

import "server-only";
import { NextResponse } from "next/server";
import { evaluateRateLimit, RATE_LIMIT_POLICIES } from "./rate-limiter.ts";
import type { RateLimitOutcome, RateLimitPolicy } from "./rate-limiter.ts";

export function rateLimitPolicyByName(route: RateLimitPolicy["route"]): RateLimitPolicy {
  const policy = RATE_LIMIT_POLICIES.find((candidate) => candidate.route === route);
  if (!policy) throw new Error(`X.49: no rate-limit policy registered for ${route}`);
  return policy;
}

/**
 * Returns `null` when the request is allowed, or a response object the route
 * must return immediately when denied.
 */
export async function enforceRateLimit(route: RateLimitPolicy["route"], keyPart: string, now: Date = new Date()): Promise<NextResponse | null> {
  const policy = rateLimitPolicyByName(route);
  let outcome: RateLimitOutcome;
  try {
    const { getRateLimitProvider } = await import("./rate-limiter.factory.server.ts");
    outcome = await evaluateRateLimit(getRateLimitProvider(), policy, keyPart, now);
  } catch {
    outcome = { allowed: false, remaining: 0, retryAfterMs: policy.windowSeconds * 1000, providerError: true };
  }
  if (outcome.allowed) return null;
  const retryAfterSeconds = Math.max(1, Math.ceil(outcome.retryAfterMs / 1000));
  return NextResponse.json(
    { ok: false, error: { message: outcome.providerError ? "Unable to complete the request right now." : "Too many requests. Please try again shortly." } },
    { status: outcome.providerError ? 503 : 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) } }
  );
}
