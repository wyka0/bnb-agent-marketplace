# X.104 Existing Vercel Project Configuration Remediation

**Audit mode:** Existing-project configuration remediation only. No source, activation, custody, transaction, commit, push, or new project work was performed.

**Release SHA:** `141143ba20413a8cf974394c8805329ac1426dfa`

## Previous Vercel Configuration

Existing project: `bnb-agent-marketplace-web`

- Project ID: `prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`
- Framework: Next.js
- Root Directory: `apps/web`
- Node.js: `24.x`
- Build Command: `pnpm turbo run build --filter=@bnb-marketplace/web`
- Output Directory: Next.js default
- Existing GitHub integration and production project preserved
- Environment variable values were not exposed

The repository workspace is rooted at the repository root, with `pnpm-lock.yaml`, `vercel.json`, `packages/*`, and `prisma/` at that level.

## Changed Configuration

The existing project was updated using the authenticated Vercel project settings command:

```text
vercel project update bnb-agent-marketplace-web --auto-detect root-directory --json
```

Vercel confirmed:

```json
{
  "changed": true,
  "changedSettings": ["rootDirectory"],
  "settings": { "rootDirectory": null }
}
```

The project subsequently reported:

- Root Directory: `.`
- Node.js: `24.x`
- Framework: Next.js
- Build Command: unchanged in project settings
- Existing project and Git integration: preserved

No environment values or other project settings were changed.

## Reason

X.103 identified a monorepo context mismatch: Vercel was rooted at `apps/web`, while the workspace lockfile and repository Vercel configuration were at the repository root.

The root-directory reset was the minimum authorized configuration change to test repository-root workspace context.

## Deployment Result

The existing failed deployment was redeployed with production target:

- Original deployment: `dpl_4yJazJZo4V8nZh5xXwMfpxh87ci9`
- Redeploy URL: `https://bnb-agent-marketplace-bkfvzglbi-solo-25cb.vercel.app`
- Redeploy ID: `dpl_GLXdERNkF3mjJcv8cLuv6jmqLjdu`
- Status: `ERROR`

Exact Vercel failure message:

```text
Error: No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies". Also check your Root Directory setting matches the directory of your package.json file.
```

This is conclusive evidence that Root Directory `.` is not directly compatible with Vercel’s Next.js framework detection: Vercel sees the repository-root workspace `package.json`, while `next` is declared in `apps/web/package.json`.

No further configuration change or deployment retry was attempted in X.104.

## Deployment / Source SHA

The GitHub release remains exact:

- Local HEAD: `141143ba20413a8cf974394c8805329ac1426dfa`
- `origin/main`: `141143ba20413a8cf974394c8805329ac1426dfa`

The Vercel redeploy was generated from the existing failed deployment and was not confirmed READY. Production was not pointed to it.

## Production Provenance

**PROVENANCE: BLOCKED**

The release SHA is correct in GitHub, but both the original deployment and the root-directory redeploy failed. The public production domain remains the previous successful artifact and cannot be attributed to `141143ba`.

## Production Smoke Tests

The existing production domain remained reachable:

- `/` → `200`
- `/marketplace` → `200`
- `/agents` → `200`
- `/compare` → `200`
- `/categories/rebalancing` → `200`
- `/categories/grid-trading` → `200`
- `/categories/yield` → `200`
- `/categories/health-factor` → `200`

These responses are from the previous artifact, not the failed X.104 redeploy.

## Security and Auth Tests

- `/api/auth/me` → `200`
- Unauthenticated `POST /api/activation/hire` → `403`
- `/api/altana/session` → `503`
- Existing production security headers remained present, including CSP nonce/`strict-dynamic`, HSTS, nosniff, frame denial, Referrer-Policy, and Permissions-Policy.

No ACTIVE session, fake job, execution control, fabricated capability, or transaction was observed or created.

## Judge Experience

The current production homepage still serves the previous copy. The new evidence-first copy from `141143ba` is not live because deployment failed. The public artifact therefore still contains older messaging equivalent to:

- “Discover, compare, hire, and monitor”
- “Scoped sessions”
- “Live on-chain”

`Risk pending` and the X.100 judge corrections were not independently confirmed live after the failed redeploy.

## Activation Safety

Activation and custody were not changed. The pushed release remains fail-closed in source, while production remains the previous safe artifact:

- Hire remains `403` unauthenticated.
- Altana session remains `503`.
- No provider or SignedQuoteReader wiring was added.
- No transaction, job funding, custody, or execution occurred.

## Final Classification

- VERCEL CONFIGURATION: **BLOCKED**
- DEPLOYMENT: **BLOCKED**
- PROVENANCE: **BLOCKED**
- PRODUCTION HEALTH: **PARTIAL**
- JUDGE EXPERIENCE: **PARTIAL**
- ACTIVATION SAFETY: **PASS**

## OVERALL X.104

**RELEASE STILL BLOCKED**

The authorized existing-project configuration change was applied, but it exposed the complementary failure: repository-root Vercel framework detection cannot find `next` in the workspace-root package. The minimum next remediation requires an additional existing-project configuration that preserves monorepo root access while explicitly locating the Next.js app/build context. That remediation was not attempted because X.104 authorized only the root-directory change and one deployment verification.

No source code, activation, custody, environment values, commit, push, new project, or additional retry was created in X.104.
