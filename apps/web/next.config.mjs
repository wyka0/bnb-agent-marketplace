/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@bnb-marketplace/ui",
    "@bnb-marketplace/config",
    "@bnb-marketplace/data-api",
    "@bnb-marketplace/telemetry",
    "@bnb-marketplace/integrations",
  ],
  serverExternalPackages: [
    "@aws-sdk/client-kms",
  ],
  // X.61: the Prisma client is imported directly from `prisma/generated/client`
  // (apps/web/lib/prisma/client.server.ts), so Next.js bundles it into each route
  // chunk. The query engine binaries must travel with the lambda: tracing
  // `../../prisma/generated/**` copies them to /var/task/prisma/generated/client,
  // and the production env var PRISMA_QUERY_ENGINE_LIBRARY pins the rhel engine
  // path there (the runtime's default next-to-bundle lookup cannot see them).
  outputFileTracingIncludes: {
    "/api/**": ["../../prisma/generated/**"],
  },
};

export default nextConfig;
