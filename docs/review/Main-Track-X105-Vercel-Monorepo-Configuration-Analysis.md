# X.105 Vercel Monorepo Framework Configuration Analysis

**Audit mode:** Diagnosis only. No project retry, source modification, package modification, commit, push, or deployment was performed.

**Release:** `141143ba20413a8cf974394c8805329ac1426dfa` (`141143b`)

## 1. X.104 Failure

X.104 reset the existing project Root Directory from `apps/web` to repository root. The redeploy then failed before building with:

```text
Error: No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies". Also check your Root Directory setting matches the directory of your package.json file.
```

The error is expected from the repository-root framework-detection context: the root package is the workspace coordinator and does not declare `next`; `apps/web/package.json` declares the Next.js dependency.

## 2. Repository Structure

```text
/
  package.json                  workspace coordinator + turbo
  pnpm-lock.yaml                authoritative workspace lockfile
  pnpm-workspace.yaml           apps/*, packages/*, prisma
  turbo.json                    workspace task graph
  vercel.json                   repository build configuration
  prisma/                       workspace package + generated Prisma client
  packages/                     shared workspace packages
  apps/
    web/
      package.json              @bnb-marketplace/web + next dependency
      next.config.mjs           Next.js runtime configuration
      app/                      Next.js App Router
```

## 3. Monorepo Configuration

### Root package

- Name: `bnb-agent-marketplace`
- Package manager: `pnpm@9.15.9`
- Engine: Node `>=20`
- Build: `turbo run build`
- Typecheck: `turbo run typecheck`
- Lint: `turbo run lint`

### Workspace

`pnpm-workspace.yaml` includes:

- `apps/*`
- `packages/*`
- `prisma`

### Web package

- Name: `@bnb-marketplace/web`
- Build: `next build`
- Next.js: `^15.0.3`
- Workspace dependencies include config, data-api, integrations, Prisma, telemetry, and UI packages.

### Turbo

`turbo.json` builds dependency tasks first and declares `.next/**`, `dist/**`, and `build/**` outputs. The web package is a normal Turbo workspace member.

### Vercel file

The repository-root `vercel.json` declares:

- Framework: `nextjs`
- Install: `pnpm install --frozen-lockfile`
- Build: Prisma generation followed by workspace build
- Output: `.next`

Its relative Prisma command assumes repository-root workspace context and is not suitable for direct execution from `apps/web` without the correct relative working directory.

## 4. Current Vercel Settings

Current existing project: `bnb-agent-marketplace-web` (`prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`)

- Root Directory: `.` / API `rootDirectory: null`
- Framework: `nextjs`
- Build Command: `pnpm turbo run build --filter=@bnb-marketplace/web`
- Install Command: automatic / `null` in project API
- Output Directory: framework default / `null` in project API
- Node.js: `24.x`
- Production branch: `main`
- Git repository: `wyka0/bnb-agent-marketplace`
- `sourceFilesOutsideRootDirectory`: `true`
- Existing project and Git integration: preserved

Environment variable names were inspected without values. No credentials are included in this report.

## 5. Authoritative Vercel Behavior

The authoritative Vercel monorepo documentation states:

- A monorepo project should use the app directory as its Root Directory, such as `apps/web`.
- Vercel detects the package manager from the repository-root lockfile and explicit root `packageManager` field.
- Workspace dependencies are supported when declared in workspace package manifests.
- Source files outside the Root Directory can be enabled through the project Root Directory setting. The current project already reports `sourceFilesOutsideRootDirectory: true`.
- For Turborepo, the documented build pattern from an app Root Directory is `cd ../.. && turbo run build --filter=web`, or an equivalent workspace-root command.
- Next.js framework detection requires the selected project root to contain the Next.js package or otherwise be the Next.js application root.

Relevant documentation:

- https://vercel.com/docs/monorepos
- https://vercel.com/docs/monorepos/turborepo
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/project-configuration/vercel-json

## 6. Configuration Options

### Option A: Root Directory `.`

**Invalid for this repository under the current framework preset.** Vercel sees the root workspace `package.json`, which does not declare `next`; X.104 produced the exact framework-detection error. Adding `next` to the root package would be a source/package change and is prohibited.

### Option B: Root Directory `apps/web`

**Valid and supported, with monorepo settings.** This is the documented Vercel pattern for an app in a monorepo. The app package contains `next`, so framework detection succeeds. The project must retain/enable source access outside the root for workspace packages, Prisma, and the root lockfile. The current project already reports `sourceFilesOutsideRootDirectory: true`.

The build command must be evaluated from the app root and invoke the workspace root, for example:

```text
cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web
```

The install command should remain Vercel’s pnpm workspace-aware automatic install or an explicitly configured frozen-lockfile install that Vercel supports for the repository root.

### Option C: Root Directory `.` with framework/build pointing at `apps/web`

**Not a supported framework-detection solution.** `vercel.json` can override framework/build/output behavior, but it does not make the repository-root `package.json` become the Next.js app package for framework detection. A root build command can invoke `apps/web`, but the framework adapter still evaluates the configured project root and X.104 proved that root framework detection fails before that path is useful.

Using a custom “Other” framework with a hand-built output path would abandon the native Next.js project behavior and is not the minimum justified configuration.

### Option D: Existing Vercel monorepo app configuration

**Valid and recommended.** Keep the existing project, set Root Directory back to `apps/web`, preserve `sourceFilesOutsideRootDirectory: true`, and set the project Build Command to the documented app-root-to-workspace-root Turbo command. Keep the Next.js framework preset, Node `24.x`, GitHub integration, production branch, and environment variables.

## 7. Minimum Configuration-Only Arrangement

The minimum supported arrangement is:

1. Existing project Root Directory: `apps/web`.
2. Existing project option: source files outside Root Directory enabled. It is already `true`.
3. Existing project Framework Preset: Next.js.
4. Existing project Node.js: `24.x`.
5. Existing project Build Command, evaluated from `apps/web`:

   ```text
   cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web
   ```

6. Existing project Install Command: Vercel’s pnpm workspace-aware install, or an explicitly configured supported frozen-lockfile command if the project UI accepts it.
7. Existing GitHub integration and production branch `main` unchanged.
8. Existing environment variable names/values unchanged.

This arrangement allows Vercel to detect Next from `apps/web/package.json`, while the build command runs Turbo from the repository root and workspace dependencies remain accessible.

## 8. Source Change Required

**SOURCE CHANGE REQUIRED: NO**

The repository already contains the required monorepo structure, workspace declarations, lockfile, Turbo task graph, Next.js package, Next configuration, and root-relative build configuration. The problem is project/build-context configuration.

No package, lockfile, source, activation, Prisma, or Vercel repository file change is justified by this analysis.

## 9. New Commit Required

**NEW COMMIT REQUIRED: NO**

The existing release commit `141143b` is the intended source. The recommended change is an existing Vercel project setting/build-command adjustment only.

## 10. Exact Next Operation

The next separately authorized operation should update the existing project only:

- Set Root Directory to `apps/web`.
- Confirm source files outside Root Directory remains enabled.
- Set Build Command to `cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web` if the project setting is not already app-root-aware.
- Preserve Next.js framework, Node `24.x`, environment variables, GitHub integration, and production branch.
- Trigger one deployment for existing `main` / release SHA `141143b`.
- Inspect the resulting deployment source SHA and build logs before claiming production provenance.

No retry was performed in X.105.

## 11. Production Safety State

Production remains the prior artifact and remains safe:

- Existing pages remain reachable.
- `/api/auth/me` → `200`.
- Unauthenticated Hire → `403`.
- `/api/altana/session` → `503`.
- Security headers remain intact.
- No ACTIVE session, job, transaction, execution control, or fabricated capability exists.

Production is not claimed to correspond to `141143b`.

## Final Classification

- MONOREPO CONFIGURATION UNDERSTOOD: **PASS**
- NEXT.JS DETECTION PATH: **PASS** for `apps/web` Root Directory; **BLOCKED** for root `.`
- WORKSPACE RESOLUTION: **PASS** with app-root project plus outside-root source access and workspace-root Turbo command
- CONFIGURATION-ONLY SOLUTION: **PASS**
- SOURCE CHANGE REQUIRED: **NO**
- DEPLOYMENT RETRY AUTHORIZED: **NO** in X.105

## OVERALL X.105

**CONFIGURATION PATH IDENTIFIED**

The supported solution is the existing-project monorepo pattern: Root Directory `apps/web`, source files outside the root enabled, Next.js framework detection at the app package, and a build command that explicitly moves to repository root before invoking the workspace Turbo build. No source change or new commit is required. No deployment retry was performed.
