# X.108 Apply Minimum Vercel Build Fix

## 1. Previous Release SHA

`141143ba20413a8cf974394c8805329ac1426dfa`

## 2. New Fix SHA

`46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`

Short SHA: `46fcdc6`

Commit message:

`fix: build web workspace correctly on Vercel`

## 3. Exact `vercel.json` Change

The commit changes only the repository-root `vercel.json` build command:

```diff
- "buildCommand": "env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'",
+ "buildCommand": "env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && cd ../.. && pnpm turbo run build --filter=@bnb-marketplace/web'",
```

The change preserves:

- Build-time removal of the runtime-only Prisma engine path.
- Explicit Prisma generation.
- Clean `.next` output.
- Existing Next.js framework, output directory, region, and install command.

It replaces direct app build execution with the workspace-root Turbo build so shared packages are built before Next.js.

## 4. Local Build Result

- `pnpm install --frozen-lockfile`: passed.
- Prisma generation: passed.
- `pnpm build`: passed.
- Turbo built the shared config, Prisma, UI, telemetry, data-api, integrations, worker, and web packages.
- `@bnb-marketplace/ui` built and resolved successfully.
- Next.js `15.5.23` compiled successfully.
- Static generation completed for all 12 static pages.
- All expected application and API routes were emitted.

Existing non-fatal warnings remained for the `viem/ox` dynamic dependency and Next.js ESLint plugin detection.

## 5. Typecheck / Lint

The first typecheck attempt ran concurrently with `next build` and observed transient missing `.next/types` files while Next replaced build output. It was rerun sequentially after Prisma generation and the completed build.

Final sequential results:

- Prisma generation: passed.
- Typecheck: all 14 Turbo tasks passed.
- Lint: all 14 Turbo tasks passed.

No source modification was required.

## 6. Regression Results

Passed:

- Capability-source verifier: all checks passed
- Activation verifier: `33/33`
- Hire verifier: `23/23`
- Hire API verifier: `14/14`
- Session verifier: `25/25`
- Session API verifier: `72/72`
- Security X.49: `25/25`
- Security X.55: `22/22`
- Compare verifier: `10/10`
- Category X.53: `21/21`
- Category X.54: `38/38`
- PancakeSwap UI verifier: all checks passed
- TermiX web verifier: all checks passed

X.50 check-24 remains untouched.

## 7. Security Result

**SECURITY: PASS**

The change:

- Adds no secret or credential.
- Changes no runtime permission.
- Changes no environment variable value.
- Preserves the build-only unsetting of `PRISMA_QUERY_ENGINE_LIBRARY`.
- Changes no activation, custody, session, authentication, or transaction code.

## 8. Application Behavior

No application source file changed. No route, UI component, data source, activation rule, capability provider, SignedQuoteReader, custody path, TermiX behavior, or PancakeSwap execution behavior changed.

The commit changes only build orchestration for Vercel.

## 9. Push / Deployment Confirmation

- Push: **NOT PERFORMED**
- Deployment: **NOT PERFORMED**
- `origin/main` remains `141143ba20413a8cf974394c8805329ac1426dfa`.
- Local `main` is one commit ahead of `origin/main`.
- No staged files remain.
- No unexpected tracked modifications remain.

Previously excluded untracked experimental files and historical reports remain outside the commit.

## 10. Next Step

The next operation requires separate explicit authorization:

1. Push `46fcdc6` to `origin/main`.
2. Allow the existing Vercel project to deploy with the already-configured app-root monorepo settings.
3. Verify deployment source SHA, READY status, production alias, route health, judge copy, activation safety, and security headers.

## Final Classification

- VERCEL BUILD FIX: **PASS**
- LOCAL BUILD: **PASS**
- REGRESSION: **PASS**
- SECURITY: **PASS**
- COMMIT: **PASS**

## OVERALL X.108

**FIX COMMITTED — READY FOR PUSH**

No push, deployment, application-source change, activation change, custody operation, AWS/KMS work, ALTANA work, transaction, Agent 1816 change, Job 515 change, TermiX change, or PancakeSwap execution change was performed.
