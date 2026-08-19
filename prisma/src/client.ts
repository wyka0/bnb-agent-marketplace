import "server-only";

import { PrismaClient } from "../generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as typeof globalThis & {
  bnbMarketplacePrisma?: PrismaClient;
};

/**
 * Shared Node.js Prisma client. Never import from a client component.
 *
 * X.55: imports the client from this package's own `generated/client` output
 * rather than the pnpm virtual store, so the native query engine sits on a path
 * Next.js build tracing actually copies into the server bundle. Security
 * posture is unchanged: still `server-only`, still blocked from browser bundles
 * by the package `browser` map.
 *
 * X.61: uses the PG driver adapter (`@prisma/adapter-pg`) for the connection
 * layer — the query engine binary is still required and is pinned on Vercel by
 * the PRISMA_QUERY_ENGINE_LIBRARY env var to the traced rhel engine under
 * /var/task/prisma/generated/client (see apps/web/next.config.mjs). Local dev
 * uses the native engine. The engine path branch doubles as fallback for
 * construction-time evaluation during `next build` when no env is loaded
 * (module-scope safety: the client is constructed lazily at first query, so
 * builds and metrics collection never connect to the database).
 */
function createPrismaClient(): PrismaClient {
  // X.61: PG driver adapter whenever DATABASE_URL is available; plain client as
  // build-time fallback (page-data collection runs without env vars).
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
