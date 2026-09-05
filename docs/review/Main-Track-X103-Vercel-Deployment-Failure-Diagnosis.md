# X.103 Vercel Deployment Failure Diagnosis

**Audit mode:** Diagnosis only. No retry, push, commit, amend, deployment, source modification, activation change, or infrastructure change was performed.

**Audit date:** 2026-08-22

## 1. X.102 Starting State

X.102 pushed the authorized release commit successfully:

- Release SHA: `141143ba20413a8cf974394c8805329ac1426dfa`
- Short SHA: `141143b`
- Remote: `origin/main`
- Existing Vercel deployment: `dpl_4yJazJZo4V8nZh5xXwMfpxh87ci9`

The existing GitHub → Vercel deployment failed. Production continued serving the previous artifact.

## 2. Git Release State

Confirmed:

- `HEAD`: `141143ba20413a8cf974394c8805329ac1426dfa`
- `origin/main`: `141143ba20413a8cf974394c8805329ac1426dfa`
- Branch: `main`
- Latest commit: `141143b feat: finalize BNB Agent Studio marketplace release`
- No tracked modifications exist.
- Only previously excluded experimental/history files remain untracked.

**GIT RELEASE: PASS**

## 3. Existing Vercel Project

Existing project inspected:

- Project: `bnb-agent-marketplace-web`
- Project ID: `prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`
- Existing project only; no new project created.
- Framework preset: Next.js
- Root directory: `apps/web`
- Node.js version: `24.x`
- Project build command: `pnpm turbo run build --filter=@bnb-marketplace/web`
- Output directory: Next.js default
- Install command: Vercel-managed package-manager install selection

Repository configuration:

- Package manager: pnpm `9.15.9`
- Lockfile: repository-root `pnpm-lock.yaml`
- Vercel configuration: repository-root `vercel.json`
- Repository build command: workspace-root `pnpm build`
- Repository Vercel build command: `env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'`
- Next config: `apps/web/next.config.mjs`
- Prisma generated client: repository-root `prisma/generated`

Environment variable names/status were not exposed in this report. The project environment listing command returned `Custom Environment not found`, so no secret values were printed or inferred.

## 4. Failed Deployment Details

Deployment inspection returned:

- Deployment ID: `dpl_4yJazJZo4V8nZh5xXwMfpxh87ci9`
- Target: production
- Created: `2026-08-22 07:33:36 IST`
- Status: `ERROR`
- Vercel deployment URL: `https://bnb-agent-marketplace-29ram69fs-solo-25cb.vercel.app`
- Existing aliases were created for the failed deployment, but the production domain continued serving the prior successful artifact.
- Source commit association: GitHub status associated the deployment with `141143ba20413a8cf974394c8805329ac1426dfa`.

Structured Vercel inspection returned:

```json
{
  "readyState": "ERROR",
  "builds": [
    {
      "use": "@vercel/vc-build",
      "entrypoint": ".",
      "readyState": "READY",
      "output": []
    }
  ]
}
```

Vercel CLI log retrieval returned:

```text
Logs are unavailable because deployment ... never reached READY and ended in ERROR.
```

The deployment dashboard and structured inspection did not expose an install command error, compiler error, route error, package error, or runtime configuration error. Therefore no unseen error is claimed here.

### First meaningful observable failure

The first meaningful evidence available is a pre-output Vercel build failure:

- Deployment reached `ERROR`.
- `@vercel/vc-build` did not produce build output.
- Vercel logs were unavailable because the deployment never reached `READY`.

The failure is before a usable Next build artifact, but the exact internal command error is not exposed by the available Vercel APIs/CLI output.

## 5. Local Build Comparison

The exact release tree was tested locally:

- `pnpm install --frozen-lockfile`: passed from repository root.
- `pnpm lint`: passed.
- `pnpm build`: completed successfully; all 8 Turbo tasks succeeded.
- Configured monorepo command `pnpm turbo run build --filter=@bnb-marketplace/web`: entered the expected workspace build and compiled the web app successfully before the tool timeout during the long local build output.

The local build did not reproduce the Vercel deployment error.

Local build warnings were existing non-fatal warnings from `viem/ox` dynamic dependency analysis and Next.js ESLint plugin detection.

**LOCAL BUILD: PASS**

## 6. Vercel Configuration Comparison

The material mismatch is repository-root context:

1. Vercel project Root Directory is `apps/web`.
2. `pnpm-lock.yaml` is at the repository root, not `apps/web/pnpm-lock.yaml`.
3. `vercel.json` is at the repository root, not `apps/web/vercel.json`.
4. Workspace packages used by the web app are siblings under `packages/` and `prisma/`.
5. The intended custom Vercel build command uses workspace-root-relative paths such as `pnpm --dir ../../prisma` and `pnpm build`.
6. The project-level Vercel build command is `pnpm turbo run build --filter=@bnb-marketplace/web`, executed under the configured `apps/web` root.

This means the deployment configuration and repository workspace layout disagree about the build root. In particular, a Vercel build rooted at `apps/web` cannot naturally discover the repository-root lockfile and root-level Vercel configuration through the same path assumptions used by the repository build.

No credential, Node, Prisma engine, or dependency-version failure was proven by the available failed-deployment output.

## 7. Historical Deployment Comparison

The previous successful production artifact predates `141143b` and remained live after the failed deployment. The release commit changed application code and verification/documentation files but did not change:

- `pnpm-lock.yaml`
- repository `vercel.json`
- `apps/web/next.config.mjs`
- root package manager declaration
- Prisma schema/build architecture

The failure therefore correlates with deployment of the same monorepo configuration under the existing Vercel project settings, not with a new dependency or lockfile change in `141143b`.

The project’s `apps/web` Root Directory setting is the significant configuration difference identified by inspection. The old deployment’s exact source/build metadata was not available in the local project metadata, so no stronger historical claim is made.

## 8. Root-Cause Classification

**ROOT CAUSE: C. VERCEL CONFIGURATION FAILURE**

Evidence:

- Existing project Root Directory is `apps/web`.
- Workspace lockfile and Vercel configuration are at repository root.
- The project build command is evaluated under the configured project root.
- The failed deployment produced no build output and no usable logs.
- The same release tree installs and builds successfully from repository-root workspace context.

This is best classified as a Vercel project/root-directory and monorepo build-context mismatch. The exact underlying Vercel internal command error is unavailable because Vercel reports that logs do not exist for this pre-READY failure.

**VERCEL CONFIGURATION: BLOCKED**

## 9. Minimum Remediation

The smallest justified remediation is configuration-only:

- Align the existing Vercel project Root Directory with the repository build context, most likely the repository root (`.`), so the root `pnpm-lock.yaml` and root `vercel.json` are available.
- Use the repository’s existing `vercel.json` install/build configuration, or equivalently configure the existing project to run the workspace-root build command from the repository root.
- Keep the existing project, Git integration, production branch, project ID, and domain.

No source modification is justified by the evidence currently available. No dependency, activation, Prisma schema, or application-code change is recommended from this diagnosis.

This configuration remediation is not implemented in X.103. A later separately authorized deployment/configuration step should verify the exact Vercel UI/CLI setting and then retry the existing project only.

## 10. Production Safety

Production remained on the previous artifact and remained reachable:

- Pages returned `200` for the audited production routes.
- `/api/auth/me` returned `200`.
- Unauthenticated Hire returned `403`.
- `/api/altana/session` returned `503`.
- No ACTIVE session, fake job, execution control, capability, or transaction was observed or created.
- Security headers remained intact: CSP nonce/`strict-dynamic`, HSTS, nosniff, frame denial, Referrer-Policy, and Permissions-Policy.

Production was not claimed to be `141143b`.

## 11. Final Recommendation

Correct the existing Vercel project’s root/build-context configuration only, then perform a separately authorized deployment retry. Do not create a second project, modify application source, amend `141143b`, or introduce activation/custody/provider changes.

## Final Classification

- GIT RELEASE: **PASS**
- VERCEL CONFIGURATION: **BLOCKED**
- DEPLOYMENT DIAGNOSIS: **PASS**
- LOCAL BUILD: **PASS**
- PRODUCTION SAFETY: **PASS**

## ROOT CAUSE

**Vercel project Root Directory is `apps/web`, while the pnpm workspace lockfile and Vercel build configuration are at repository root; the failed `@vercel/vc-build` deployment produced no output and no accessible build logs.**

## REMEDIATION

**Configuration-only alignment of the existing Vercel project to repository-root workspace context; no source change is justified.**

## OVERALL X.103

**DIAGNOSIS COMPLETE**

The exact internal Vercel error text was not available because the deployment failed before `READY` and Vercel returned no logs. The configuration mismatch is the first and only substantiated root cause category. No retry, push, commit, deployment, or code modification was performed.
