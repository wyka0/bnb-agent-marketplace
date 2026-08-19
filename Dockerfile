# BNB Agent Studio Marketplace — monorepo Dockerfile
# Builds the Next.js web app using pnpm workspaces + Turborepo.
# Uses prism as the workspace manager and the Next.js standalone output.

##############################
# deps: install full dependency graph
##############################
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages ./packages
COPY apps ./apps
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile --ignore-scripts

##############################
# builder: build the web app
##############################
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

COPY --from=deps /app ./

# Generate the Prisma client explicitly: the dependency install runs with
# --ignore-scripts, so the client is never produced by a postinstall hook.
# Schema validation/generation needs no database connection.
RUN pnpm --dir prisma exec prisma generate

# Build workspace packages + web
RUN pnpm turbo run build --filter=@bnb-marketplace/web

##############################
# runner: minimal runtime image with standalone output
##############################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
