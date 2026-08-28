# X.107 Vercel JSON Build Override Audit

**Audit mode:** Read-only. No file, package, source, Vercel setting, deployment, commit, push, activation, or custody change was performed.

**Release:** `141143ba20413a8cf974394c8805329ac1426dfa` (`141143b`)

## 1. X.106 Failure

X.106 applied the verified Vercel project settings:

- Root Directory: `apps/web`
- Framework: Next.js
- Source files outside Root Directory: enabled
- Project Build Command: `cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web`
- Node: `24.x`

The redeploy reached install, workspace linking, Prisma generation, and Next compilation. It failed at the first webpack error:

```text
./app/(app)/agents/[slug]/aave-activation-preview.tsx
Module not found: Can't resolve '@bnb-marketplace/ui'
```

The build command actually executed was the committed `vercel.json` command, not the Vercel project command.

## 2. Exact `vercel.json`

The committed repository-root file contains:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "github": {
    "silent": true
  }
}
```

Configuration findings:

- `buildCommand`: present and overriding the project setting
- `installCommand`: `pnpm install --frozen-lockfile`
- `framework`: `nextjs`
- `outputDirectory`: `.next`
- `rootDirectory`: absent
- `functions`: absent
- `regions`: `iad1`
- `github.silent`: `true`

## 3. Historical Reason

Git history shows `vercel.json` was introduced in commit `b441c219abc7d48798bba1c2465a6404972ab733`, the X.49–X.71 reconciliation checkpoint.

The reports identify its purpose:

- X.50 introduced the Vercel configuration to run `prisma generate` before the build.
- X.61 added the `env -u PRISMA_QUERY_ENGINE_LIBRARY` workaround because the runtime Prisma engine path exists in Vercel but not during build-time generation.
- X.61 also added `rm -rf .next` to prevent stale restored Next build output from being reused.
- The command was documented as a clean-build and Prisma-engine packaging workaround.

The historical command was valid for the earlier deployment context, but its final `pnpm build` invokes the web package directly. With the current app-root monorepo configuration, it bypasses Turbo’s dependency build ordering.

## 4. Local Build Comparison

The repository-root workspace commands were previously run on the exact release tree:

- `pnpm install --frozen-lockfile`: passed.
- `pnpm lint`: passed.
- `pnpm build`: completed successfully in the repository workspace.
- `pnpm turbo run build --filter=@bnb-marketplace/web`: entered the expected Turbo dependency graph and compiled the web application successfully locally.

The Vercel failure is reproducible by the deployment logs for the direct app build path: shared packages were linked but not built, and Next failed to resolve `@bnb-marketplace/ui`.

The important distinction is:

- Workspace/Turbo path: builds dependency packages first, then `apps/web`.
- Direct app `pnpm build` path: runs `apps/web`’s `next build` without first producing shared package `dist` outputs.

The local workspace may have cached or previously generated package outputs, so a local direct build is not sufficient to disprove the Vercel clean-build failure. Vercel’s clean deployment log is the authoritative reproduction of the direct path failure.

## 5. Prisma Dependency Analysis

The Prisma workspace package has:

- `build`: `tsc -p tsconfig.json`
- `generate`: `prisma generate`

Turbo’s generic `build` task depends on upstream package `build` tasks. It does not invoke the Prisma package’s separate `generate` script.

The Prisma schema emits the generated client and engines under `prisma/generated/client`, including native, Debian OpenSSL 3, and RHEL OpenSSL 3 targets. The web app imports the generated client by relative path, and `next.config.mjs` includes that generated path in output tracing. The production environment separately provides the RHEL engine path through `PRISMA_QUERY_ENGINE_LIBRARY`.

Therefore Prisma generation remains necessary before the Next build. It should be retained exactly once before Turbo runs. It should not be duplicated by an additional package build task unless a future separately authorized change proves that necessary.

The existing CI workflow confirms the intended order:

```text
pnpm install --frozen-lockfile
pnpm --dir prisma exec prisma generate
pnpm build
```

## 6. Workspace / Turbo Analysis

The workspace includes `apps/*`, `packages/*`, and `prisma`. The web package declares workspace dependencies such as `@bnb-marketplace/ui`, `@bnb-marketplace/config`, `@bnb-marketplace/data-api`, `@bnb-marketplace/integrations`, `@bnb-marketplace/prisma`, and `@bnb-marketplace/telemetry`.

Those packages expose compiled files from `dist/`. Turbo’s `build` task uses `dependsOn: ["^build"]`, so it builds the shared packages before `apps/web`.

The X.106 Vercel log demonstrates the failure mode when the final command is direct `pnpm build` from `apps/web`: `@bnb-marketplace/ui` is installed as a workspace link but its build output is unavailable to webpack.

## 7. Recommended Correction

**Recommended option: C, replace the `vercel.json` build command while retaining Prisma generation.**

Replace only the `buildCommand` value with:

```text
env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web'
```

This is the smallest correction because it preserves the three historical requirements:

- Removes the runtime-only Prisma engine variable during generation/build.
- Generates the Prisma client before Next compilation.
- Clears `.next` before rebuilding.

It then invokes Turbo from the repository root so workspace dependencies build in the required order.

Option A, removing `buildCommand` entirely, is not the minimum safe fix because it would discard the required Prisma generation and stale-cache workarounds unless those are independently proven unnecessary.

Option B, replacing the command with only `cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web`, is insufficient because Turbo’s Prisma `build` script is TypeScript compilation and does not run `prisma generate`.

Option D is unnecessary because the documented app-root Vercel monorepo configuration is already in place.

## 8. Exact File / Change Required

The exact source/configuration change would be one line in the repository-root `vercel.json`:

```diff
- "buildCommand": "env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'",
+ "buildCommand": "env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web'",
```

This change was **not implemented** in X.107.

## 9. Release Impact

- New commit required: **YES**
- Push: **NOT AUTHORIZED**
- Deployment: **NOT AUTHORIZED**
- Existing release `141143b`: unchanged
- Application source change required: **NO**
- Activation/custody/provider change required: **NO**

Because `vercel.json` is committed, changing it requires a new commit before GitHub → Vercel can consume the correction. That commit must be separately authorized.

## 10. Production Safety

Production remains the previous artifact and remains safe:

- Pages remain reachable.
- `/api/auth/me` → `200`.
- Unauthenticated Hire → `403`.
- `/api/altana/session` → `503`.
- Security headers remain intact.
- No ACTIVE session, job, capability, execution control, transaction, custody, or provider wiring was created.

## 11. Next Authorized Operation

The next separately authorized operation should:

1. Change only the `buildCommand` in `vercel.json` to preserve Prisma generation/cache cleanup and invoke Turbo from the workspace root.
2. Create a new explicitly authorized commit.
3. Push that commit only after review.
4. Allow the existing Vercel project to deploy.
5. Verify the exact source SHA, build logs, production alias, routes, judge copy, headers, and activation safety.

No part of that operation was performed in X.107.

## Final Classification

- VERCEL.JSON ANALYSIS: **PASS**
- ROOT CAUSE: **CONFIRMED**
- MONOREPO BUILD PATH: **PASS** when Turbo runs from workspace root; **BLOCKED** under current direct command
- PRISMA PATH: **PASS** with one explicit pre-build generation step
- MINIMUM FIX IDENTIFIED: **YES**
- SOURCE CHANGE REQUIRED: **NO** for application code; **YES** for committed `vercel.json` configuration

## OVERALL X.107

**FIX IDENTIFIED**

The minimum correct fix is a one-line `vercel.json` build-command replacement that retains Prisma generation and `.next` cleanup, then changes the final build step from direct `pnpm build` to a workspace-root Turbo build. No source, dependency, activation, custody, or transaction changes are required.
