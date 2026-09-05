# X.106 Apply Verified Vercel Monorepo Configuration + Redeploy

**Release:** `141143ba20413a8cf974394c8805329ac1426dfa` (`141143b`)

**Mode:** Existing-project configuration and redeploy only. No source, package, lockfile, activation, custody, commit, push, or new-project work was performed.

## 1. X.105 Starting State

X.105 identified the documented Vercel monorepo path:

- Root Directory: `apps/web`
- Framework: Next.js
- Source files outside Root Directory: enabled
- Build Command: `cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web`
- Node: `24.x`
- Existing GitHub integration, production branch, environment variables, domains, and project preserved

## 2. Previous Configuration

Before X.106, the existing project reported:

- Project: `bnb-agent-marketplace-web`
- Project ID: `prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`
- Root Directory: repository root (`.` / API `null`)
- Framework: `nextjs`
- Build Command: `pnpm turbo run build --filter=@bnb-marketplace/web`
- Install Command: automatic
- Output Directory: framework default
- Node: `24.x`
- Source files outside Root Directory: `true`
- Production branch: `main`
- Git source: `wyka0/bnb-agent-marketplace`

Environment variable values were not exposed or changed.

## 3. New Configuration

The existing project accepted exactly two changed settings:

```text
Root Directory: apps/web
Build Command: cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web
```

Read-back verification confirmed:

- Root Directory: `apps/web`
- Framework: Next.js
- Source files outside Root Directory: `true`
- Build Command: exact authorized command
- Node: `24.x`
- Install Command: automatic
- Output Directory: Next.js default
- Production branch: `main`

No unexpected project setting changed.

## 4. Deployment ID

The existing failed release deployment was redeployed with production target:

- Source deployment: `dpl_4yJazJZo4V8nZh5xXwMfpxh87ci9`
- New deployment ID: `dpl_4oW5oF6LbQT6ozuKJPZ6ecBLMyyE`
- Deployment URL: `https://bnb-agent-marketplace-jg11ulxyv-solo-25cb.vercel.app`
- Target: production

No new Vercel project was created.

## 5. Deployment Status

**Status: ERROR**

The deployment progressed materially further than X.104:

- Cloned `main` at commit `141143b`.
- Detected repository-root `pnpm-lock.yaml` and pnpm workspace.
- Ran `pnpm install --frozen-lockfile` successfully across all 9 workspace projects.
- Linked workspace packages.
- Detected Next.js `15.5.23` from `apps/web/package.json`.
- Generated Prisma Client successfully.
- Started `next build`.

The first meaningful compilation error was:

```text
./app/(app)/agents/[slug]/aave-activation-preview.tsx
Module not found: Can't resolve '@bnb-marketplace/ui'
```

Equivalent errors then appeared for other files importing `@bnb-marketplace/ui`.

The final Vercel error was:

```text
Build failed because of webpack errors
Command "env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'" exited with 1
```

## 6. Why the Authorized Project Build Command Did Not Run

The repository’s committed `vercel.json` contains a `buildCommand`. Vercel documentation states that `vercel.json#buildCommand` overrides the Project Settings Build Command for the deployment.

Therefore, although the project setting was correctly changed to:

```text
cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web
```

Vercel actually ran the committed app-root command from `vercel.json`:

```text
env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'
```

That command runs `next build` directly in `apps/web` without first building the TypeScript workspace packages. The workspace packages were installed/linked but their expected build outputs were absent, so webpack could not resolve `@bnb-marketplace/ui`.

No source or configuration was changed after this failure, and no second retry was attempted.

## 7. Release SHA and Provenance Evidence

Git state remained exact:

- Local HEAD: `141143ba20413a8cf974394c8805329ac1426dfa`
- `origin/main`: `141143ba20413a8cf974394c8805329ac1426dfa`

Vercel build logs explicitly state:

```text
Cloning github.com/wyka0/bnb-agent-marketplace (Branch: main, Commit: 141143b)
```

Thus the failed deployment source provenance is **PASS** for the attempted deployment. Production provenance remains **BLOCKED** because the deployment did not reach READY and was not promoted to the public production domain.

## 8. Production Smoke Results

The existing production artifact remained reachable:

- `/` → `200`
- `/marketplace` → `200`
- `/agents` → `200`
- `/compare` → `200`
- `/categories/rebalancing` → `200`
- `/categories/grid-trading` → `200`
- `/categories/yield` → `200`
- `/categories/health-factor` → `200`

These responses remain the prior deployed artifact, not `141143b`.

## 9. Activation Safety

The existing production artifact remained safely fail-closed:

- `/api/auth/me` → `200`
- Unauthenticated `POST /api/activation/hire` → `403`
- `/api/altana/session` → `503`

No ACTIVE session, fake job, capability, execution control, transaction, provider, or SignedQuoteReader wiring was created.

## 10. Judge Experience

The new release copy was not deployed because the build failed. The production site still serves the previous artifact and does not contain the new evidence-first/fail-closed homepage copy from `141143b`.

The X.93 `Risk pending` and X.100 judge corrections were therefore not reconciled to the live production deployment in X.106.

## 11. Security

The existing production response retained:

- CSP nonce and `strict-dynamic`
- HSTS
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy`
- `Permissions-Policy`

No secret values were exposed or modified.

## 12. Final Classification

- VERCEL CONFIGURATION: **PASS**
- DEPLOYMENT: **BLOCKED**
- PROVENANCE: **PARTIAL**
- PRODUCTION HEALTH: **PARTIAL**
- JUDGE EXPERIENCE: **PARTIAL**
- ACTIVATION SAFETY: **PASS**
- SECURITY: **PASS**

## OVERALL X.106

**RELEASE STILL BLOCKED**

The documented monorepo project settings are now correct and Vercel successfully detects and installs the workspace. Deployment remains blocked because committed `vercel.json#buildCommand` overrides the project Build Command and runs `next build` before shared workspace packages are built. Resolving that override requires a separately authorized source/configuration change or another explicitly supported deployment-level override; neither was authorized or attempted in X.106.

No source change, commit, push, package change, lockfile change, activation change, custody operation, transaction, or additional retry was performed.
