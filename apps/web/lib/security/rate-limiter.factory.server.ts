/**
 * X.49 rate-limit provider selection — server-only.
 *
 * Priority:
 *   1. `RATE_LIMIT_BACKEND=prisma` → authoritative cross-instance limiter
 *      (PostgreSQL `RateLimitBucket` table; X.50 once provisioned).
 *   2. Anything else → in-memory per-instance limiter (honest default).
 *
 * `RATE_LIMIT_BACKEND=redis` is a reserved selection slot: the Redis client
 * and a provisioned Redis do not exist yet, so selecting it throws at
 * construction (fail-safe — never silently degrades, never pretends).
 */

import "server-only";
import { createPrismaRateLimitProvider } from "./rate-limiter.prisma.server.ts";
import type { RateLimitProvider } from "./rate-limiter.ts";
import { createMemoryRateLimitProvider, RATE_LIMIT_MEMORY_PROVIDER, RATE_LIMIT_PRISMA_PROVIDER, RATE_LIMIT_REDIS_PROVIDER } from "./rate-limiter.ts";

export type RateLimitBackend = typeof RATE_LIMIT_MEMORY_PROVIDER | typeof RATE_LIMIT_PRISMA_PROVIDER | typeof RATE_LIMIT_REDIS_PROVIDER;

function configuredBackend(): RateLimitBackend {
  const raw = (process.env.RATE_LIMIT_BACKEND ?? RATE_LIMIT_MEMORY_PROVIDER).toLowerCase();
  if (raw === RATE_LIMIT_PRISMA_PROVIDER) return RATE_LIMIT_PRISMA_PROVIDER;
  if (raw === RATE_LIMIT_REDIS_PROVIDER) return RATE_LIMIT_REDIS_PROVIDER;
  return RATE_LIMIT_MEMORY_PROVIDER;
}

let cachedProvider: RateLimitProvider | null = null;
let cachedBackend: RateLimitBackend | null = null;

export function getRateLimitProvider(): RateLimitProvider {
  const backend = configuredBackend();
  if (cachedProvider !== null && cachedBackend === backend) return cachedProvider;
  if (backend === RATE_LIMIT_REDIS_PROVIDER) {
    throw new Error("X.49: RATE_LIMIT_BACKEND=redis is not provisioned; configure Prisma/PostgreSQL or memory instead.");
  }
  cachedProvider = backend === RATE_LIMIT_PRISMA_PROVIDER ? createPrismaRateLimitProvider() : createMemoryRateLimitProvider();
  cachedBackend = backend;
  return cachedProvider;
}
