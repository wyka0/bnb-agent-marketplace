/**
 * X.49 PostgreSQL-backed rate-limit provider — the authoritative,
 * cross-instance limiter. Uses a single atomic upsert (INSERT ... ON CONFLICT
 * DO UPDATE ... RETURNING count) against the `RateLimitBucket` table, so
 * concurrent requests from multiple Vercel instances serialize correctly at
 * the row level. No Redis required; no in-memory pretending.
 *
 * Server-only. Selected at runtime via the rate-limit factory when a
 * reachable Prisma/PostgreSQL backend is available.
 */

import "server-only";
import { prisma } from "@/lib/prisma/client.server";
import type { RateLimitProvider } from "./rate-limiter.ts";

export function createPrismaRateLimitProvider(): RateLimitProvider {
  return {
    async incr(key: string, windowKey: string, ttlSeconds: number) {
      void ttlSeconds; // window rotation supersedes rows; pruning is an ops job
      const rows = await prisma.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "RateLimitBucket" ("key", "windowKey", "count")
        VALUES (${key}, ${windowKey}, 1)
        ON CONFLICT ("key", "windowKey")
        DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
        RETURNING "count"`;
      const first = rows[0];
      if (!first) throw new Error("X.49 prisma rate limiter: upsert returned no row.");
      return Number(first.count);
    },
  };
}
