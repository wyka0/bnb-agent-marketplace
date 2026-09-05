# Main-Track-Activation — X.61 Production Verification

Status: **COMPLETE** — all reachable checklist items PASS; production deployment
`https://bnb-agent-marketplace-web.vercel.app/` verified end-to-end (latest
deployment: `bnb-agent-marketplace-kgd6ahc51-solo-25cb`, 2026-08-16T21:04Z).

## Scope rules honored
- Used the existing Vercel project `solo-25cb/bnb-agent-marketplace-web` (no new project).
- No commit / no push (repo remains zero-commit by policy).
- Production env values never printed — report uses presence/length/host-prefix only.
- No AWS/KMS work, no mainnet, no agent/job touching, no transactions (the SIWE
  sign-in test used message-signing only, off-chain).
- Honest states only; every claim below has captured evidence.

---

## Checklist

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Production env configured via CLI (Sensitive, stdin, values not printed) | **PASS** | `vercel env ls production` shows: `DATABASE_URL` (len 156, pooled, host prefix `ep-weathered-wind-b3zwslpg-pooler`), `E8004SCAN_API_KEY` (alias — Vercel rejects `8004SCAN_API_KEY` leading-digit names), `AUTH_CANONICAL_ORIGIN=https://bnb-agent-marketplace-web.vercel.app`, `RATE_LIMIT_BACKEND=prisma`, `PRISMA_QUERY_ENGINE_LIBRARY=/var/task/prisma/generated/client/libquery_engine-rhel-openssl-3.0.x.so.node`. All `Sensitive`/`Production`; added non-interactively via `cmd /c … < file` redirection |
| 2 | Current code deployed (no stale build) | **PASS** | Fixed pipeline: `vercel.json` buildCommand = `env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'` (no turbo, no remote cache, `.next` wiped every build). A build-marker planted in a temp route confirmed deployed bundles byte-current; marker removed after verification. Root cause of earlier staleness: Vercel-restored Next incremental build cache re-emitted chunk `7795.js` with pre-marker content |
| 3 | Neon database reachable from production | **PASS** | Prisma `siweChallenge.count()` on prod returned `ok:1` → `ok:5` as challenges were created (each nonce persisted a row). `/var/task/prisma/generated/client/*` confirmed on-lambda via temp fs probe |
| 4 | 8004scan live registry discovery | **PASS** | `/marketplace` contains `Live from the 8004scan registry`, 307 agent-data markers (`agentId`/`evidence`/`agents indexed`), no `API key is missing` state, no fake APY (`APY` and `\d+\.?\d*\s*%` matched 0 times) |
| 5 | SIWE authentication flow | **PASS** | `/api/auth/me` → 200 `{"ok":true,"data":null}` unauthenticated; `/api/auth/nonce` (valid address) → 200 with full SIWE message: EIP-4361 format, Chain ID 97, nonce, `URI: https://bnb-agent-marketplace-web.vercel.app/login`, 5-min expiry, `__Host-siwe_attempt` cookie set; CSRF gate rejects foreign `Origin` → 403; nonce GET → 405 |
| 6 | Signature verification | **PASS** | Signed the real challenge off-chain (viem `privateKeyToAccount`, testnet key, message-signature only — no transaction) → `/api/auth/verify` → 200 `{walletAddress, chainId:97, sessionExpiresAt}`; forged zero signature → 400 `Authentication request is incomplete.` |
| 7 | Session persistence | **PASS** | Verify set `__Host-bnb_session` + `__Host-bnb_csrf` cookies; `/api/auth/me` with cookies → 200 with wallet address + chain + expiry (7-day session); logout requires matching `x-csrf-token` header (constant-time compare, 403 otherwise); with header → 204, session revoked, `/me` back to null. AuthSession rows created/revoked in Neon |
| 8 | Prisma-backed rate limiting | **PASS** | `RATE_LIMIT_BACKEND=prisma` on prod. Per-address nonce limit (10/window): burst of 8 requests after 4 earlier → 6×200 then **429 ×2** exactly at the configured limit; `Retry-After` present. Buckets are persisted to Neon (`RateLimitBucket` upsert by design); row-level SQL inspection not performed (no psql/session access from the CLI) |
| 9 | CSP / HTTPS / security headers | **PASS** | On `/`: `Content-Security-Policy` (nonce + `strict-dynamic`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`), `Permissions-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`. HTTPS-only (HSTS + upgrade-insecure-requests); nonces present on all script tags |
| 10 | Marketplace + category pages | **PASS** | `/` 200 (156 KB); `/marketplace` 200 (live registry content); `/categories/{rebalancing,grid-trading,yield,health-factor}` all 200 |
| 11 | Altana session endpoint honesty | **PASS** (*expected, out of scope*) | `/api/altana/session` → 503 `Altana session support is not configured on this deployment.` — correct because KMS/AWS is intentionally not configured (X.61 scope excludes it) |
| 12 | Temp diagnostics removed | **PASS** | `/api/diag-env` → 404 after cleanup; `__x61PrismaMode` markers, TEMP console.error blocks, `.x61-*.mts/.mjs` files, stray temp files all deleted; gates re-run: `pnpm build` ok, `pnpm typecheck` 0 errors, `pnpm lint` 0 errors, `prisma exec tsc -p tsconfig.json` 0 errors |

---

## Root-cause write-up (Prisma engine on Vercel lambdas)

Deployed lambda ran `PrismaClientInitializationError: could not locate the Query
Engine for runtime "rhel-openssl-3.0.x"` for many deploys while the same code
worked locally and in `next dev`. Investigated with a TEMP `/api/diag-env` route
(env-presence + prisma probe + on-disk file hashes + `/var/task` engine scan —
all removed after verification). Three compounding causes:

1. **Vercel-restored Next incremental build cache.** `next build` re-emitted the
   shared client chunk `7795.js` with old content while route bundles updated
   (proved by a hardcoded source marker appearing live while the marker inside
   the client module did not). Fix: `rm -rf .next` at the start of the
   buildCommand (in addition to dropping turbo/turbo remote cache from the
   build), then re-verified.
2. **Engine resolution next to the bundle.** Vercel's serverless tracer copies
   traced files at trace-root-relative paths (`/var/task/prisma/generated/client`,
   proven by hash-verified engine files there), but Prisma's default loader
   looks next to the bundled chunk (`/var/task/apps/web/.next/server/chunks`),
   so the engine was never found regardless of engineType. Fix: pin
   `PRISMA_QUERY_ENGINE_LIBRARY` (production, Sensitive) to the traced rhel
   engine path, and keep `outputFileTracingIncludes: { "/api/**": ["../../prisma/generated/**"] }`.
   (WASM engine `engineType = "wasm"` was tried first — the wasm glue's
   import.meta.url resolution is also chunk-relative, so it failed identically;
   reverted to library engine + env pin, which is what works.)
3. **`prisma generate` validation vs build env.** The env var can't exist during
   the build (path doesn't exist on the build runner), so the buildCommand
   strips it: `env -u PRISMA_QUERY_ENGINE_LIBRARY`. Runtime env comes from the
   platform, not the build shell.

Supporting architecture kept: the generated client is imported by direct
relative path from `apps/web/lib/prisma/client.server.ts` (no workspace symlink
/ tsc dist indirection) and paired with `@prisma/adapter-pg` for the connection
layer.

## Known residue / notes (not defects in scope)
- `vercel deploy --prebuilt` produces an incomplete Build Output locally for
  this Next version (function payloads reference files outside `.vercel/output`)
  — prebuilt flow is unusable here; cloud builds work.
- Local `next dev` still misses root `.env.local` (pre-existing, documented in
  X.60; verified flow locally by seeding env explicitly).
- PowerShell 5.1 native-arg quoting mangles inline JSON/values for native CLIs —
  the reason all uploads/probes use `@file` redirection (this caused a false
  400 during final smoke; re-verified with file body → 200).
- AWS/KMS, mainnet, Agent 1816, Job 515 untouched by instruction.

## Remediation & follow-up (outside X.61)
- Row-level `RateLimitBucket` SQL verification would require a psql/DB session.
- Consider committing the repo (out of policy here) to unlock git-integrated deploys.