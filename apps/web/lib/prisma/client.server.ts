import "server-only";

import { PrismaClient } from "../../../../prisma/generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as typeof globalThis & {
  bnbMarketplacePrisma?: PrismaClient;
};

/**
 * X.61: apps/web-side Prisma client. Imports the generated client directly by
 * relative path (no package symlink, no tsc dist indirection) so the Next.js
 * build bundles the client into the route chunks that need it. PG driver
 * adapter (`@prisma/adapter-pg`) used whenever DATABASE_URL is present — the
 * query engine binary is pinned at runtime by PRISMA_QUERY_ENGINE_LIBRARY on
 * Vercel (see next.config.mjs tracing), and local dev falls back to the native
 * build. Plain client kept as fallback for module-scope evaluation during
 * `next build` when no env is loaded. Never import from a client component.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString && connectionString.length > 0) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.bnbMarketplacePrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.bnbMarketplacePrisma = prisma;
}