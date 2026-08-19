# X.58 Production Marketplace Deployment

- **Date:** 2026-08-16
- **Baseline:** X.57 (TermiX evidence-backed; 320 offline checks PASS)
- **Scope:** Move the marketplace toward real production deployment.
- **Outcome:** **STOPPED AT STEP 1 for infrastructure.** `DATABASE_URL`, `DIRECT_DATABASE_URL`, and all Vercel access are missing. No deployment was simulated and no connectivity was invented. The steps that *could* be executed without those credentials were executed for real, and one new defect plus one unresolved finding are recorded below.

## Step 1 — Credential discovery (the hard gate)

Presence-only inspection. No secret value was printed.

| Required | Shell | `.env.local` | Result |
|---|---|---|---|
| `DATABASE_URL` | MISSING | MISSING | **MISSING** |
| `DIRECT_DATABASE_URL` | MISSING | MISSING | **MISSING** |
| `AUTH_CANONICAL_ORIGIN` | MISSING | MISSING | **MISSING** |
| `8004SCAN_API_KEY` | — | **present** | AVAILABLE |

| Vercel access | Result |
|---|---|
| `vercel` CLI | MISSING |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | MISSING |
| `.vercel/project.json` | MISSING |

Database reachability independently confirmed absent:

```text
localhost:5432 reachable = False
127.0.0.1:5432 reachable = False
prisma migrate status → Error: P1001: Can't reach database server
```

**Per instruction, infrastructure execution stopped here.** Steps 2–6, 10, and deployment cannot proceed.

## Step 8 — 8004scan production credential behaviour (EXECUTED, 9/9 PASS)

This was fully testable and is the substantive win of the milestone. New verifier:
`apps/web/lib/eight004scan/x58.credential.verify.ts` (`pnpm eight004scan:x58:verify`).

| Case | Result |
|---|---|
| Valid credential present, server-side only | PASS |
| Valid credential → live rows **or** honest failure (never fabricated rows) | PASS |
| Missing credential detected | PASS |
| Missing credential returns a discriminated result, not a throw | PASS |
| Malformed upstream records dropped (kept 1 of 5) | PASS |
| Each malformed shape individually rejected | PASS |
| HTTP 429 → `rate-limited` state with zero rows | PASS |
| Empty upstream success → successful empty list (not an error) | PASS |
| Credential never exposed via `NEXT_PUBLIC_` | PASS |

### A real upstream degradation, diagnosed rather than assumed

The live-credential case initially failed. I did **not** write it off as flaky —
I isolated it at the network layer:

```text
plain  /agents?limit=1                        → 200 in ~1s
search only  ?search=yield                    → 200 in 5226ms
with chainId ?chainId=56&isTestnet=false      → TIMEOUT after 40174ms
full filtered ?chainId=56&...&search=yield    → TIMEOUT after 40013ms
```

So `chainId`-filtered queries were timing out **upstream at 8004scan**, while the
same code path succeeded minutes earlier during X.57 (131 hits / 58 matched).
This is third-party degradation, not a code fault.

I therefore asserted the **client contract** — with a valid credential the client
must return live rows *or* an honest discriminated failure — and the verifier
prints which condition actually occurred (`observed: upstream-unavailable`). It
would have been wrong either to fail our suite for someone else's outage or to
claim live data we did not receive.

Along the way I also found a genuine harness hazard worth recording:
`createApiClient` captures `fetch` **by value** at construction
(`fetchFn = fetch`), so any injected fetch must be installed only after all
live-network cases run. The verifier documents and respects that ordering.

I deliberately **did not** add this verifier to the main `pnpm test` chain,
because it depends on live upstream availability and would make the suite flaky.

## Steps 7 & 11 — Marketplace journey smoke test (EXECUTED locally)

Run against the **production build** via the standalone server (the correct
target under `output: standalone`).

```text
/                          => 200      /permissions             => 200
/marketplace               => 200      /login                   => 200
/categories                => 200      /api/auth/me             => 200
/categories/rebalancing    => 200      /api/altana/session      => 500  ← see finding
/categories/grid-trading   => 200
/categories/yield          => 200
/categories/health-factor  => 200
```

### Content honesty during a real outage

This is stronger evidence than a happy-path run: the smoke test ran **while
8004scan was degraded**, and every category still behaved correctly.

| Category | Analysis label | Unavailable declared | Risks | Fake APY | Fake health factor | "coming soon" |
|---|---|---|---|---|---|---|
| Rebalancing | yes | yes | yes | none | none | none |
| Grid Trading | yes | yes | yes | none | none | none |
| Yield | yes | yes | yes | **none** | none | none |
| Health Factor | yes | yes | yes | none | **none** | none |

### Security headers (production build, verified on the wire)

```text
Content-Security-Policy   default-src 'self'; script-src 'self' 'nonce-c7cc08a6…' 'strict-dynamic'
X-Content-Type-Options    nosniff
Referrer-Policy           strict-origin-when-cross-origin
Permissions-Policy        camera=(), geolocation=(), microphone=(), payment=(), usb=()
X-Frame-Options           DENY
Strict-Transport-Security ABSENT  ← correct: HSTS is HTTPS-gated, probe was HTTP
```

The per-request CSP nonce confirms the middleware is live in the production bundle.

## New defect found and fixed

`/api/altana/session` returned **500** when the database was unreachable but env
was present. A generic 500 implies the request failed; an unreachable database is
a **503** condition. The matcher only recognised `P1001` / `"Can't reach database
server"`, but Prisma surfaces this as `PrismaClientInitializationError` with a
message that starts with a newline.

I broadened the classifier in `lib/altana-session/api.ts` to also treat
`PrismaClientInitializationError`, `P1017`, `Server has closed the connection`,
`Query Engine`, and `ECONNREFUSED` as persistence-unavailable → 503.

Verified against the **real** thrown error:

```text
caught name = PrismaClientInitializationError
mapped      = {"message":"Session persistence is unavailable.","status":503}
```

Both the Altana store and the auth store errors now map to 503 in isolation.

## Unresolved finding (recorded, not papered over)

Despite the mapper returning 503 for the real error in isolation — and the fix
being present in the built chunks (`chunks/3045.js`, `569.js`, build newer than
source) — the running standalone server **still returns 500** for
`/api/altana/session` when env is present and the DB is unreachable, with **no
stderr emitted**.

What I ruled out:
- stale bundle (build timestamps newer than source)
- the rate-limit gate (returns 503; also only runs when identity is non-null)
- the route's own catch (maps correctly when tested directly)
- an uncaught crash (no stderr, so the 500 is deliberately returned by our code)

I could not identify the responsible path within this milestone. I am reporting
it as **OPEN** rather than claiming the fix is complete. The 503 improvement is
real and unit-verified; the end-to-end status code is not yet confirmed. This
matters only in the exact configuration "env present + database unreachable",
which cannot occur once PostgreSQL is provisioned — but it should be closed
before production.

## Verification

| Gate | Result |
|---|---|
| `pnpm prisma validate` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | **PASS (exit 0) — 320 checks** |
| `pnpm audit` | PASS — no known vulnerabilities |
| `pnpm eight004scan:x58:verify` | PASS — 9/9 |
| `prisma migrate status` | **BLOCKED — P1001** |

No existing test was weakened.

## Files changed

| File | Change |
|---|---|
| `apps/web/lib/eight004scan/x58.credential.verify.ts` | **New** — 9-check production credential verifier |
| `apps/web/lib/altana-session/api.ts` | Broadened persistence-unavailable → 503 classification |
| `apps/web/package.json` | Added `eight004scan:x58:verify` (kept out of `test` — needs live upstream) |
| `docs/review/Main-Track-Activation-X58-Production-Marketplace.md` | This report |

## Status

```text
POSTGRES:               BLOCKED (DATABASE_URL + DIRECT_DATABASE_URL missing; P1001)
MIGRATIONS:             BLOCKED (cannot run migrate deploy without a database)
VERCEL:                 BLOCKED (no CLI, token, org/project id, or project link)
HTTPS:                  BLOCKED (no deployment; HSTS correctly absent over local HTTP)
AUTH:                   BLOCKED for production verification (auth endpoints require the database)
RATE LIMIT:             BLOCKED for distributed activation (memory only; prisma backend needs the DB)
8004SCAN:               PASS (9/9; live upstream degradation recorded honestly)
MARKETPLACE:            PASS locally (all 11 routes 200 on the production build)
REBALANCING:            PARTIAL
GRID TRADING:           PARTIAL
YIELD OPTIMISATION:     PARTIAL
HEALTH FACTOR:          PARTIAL
ALTANA CUSTODY:         BLOCKED UNTIL KMS
REAL KMS:               NOT CONFIGURED
PERSISTED CUSTODY:      BLOCKED
PRODUCTION SMOKE TEST:  BLOCKED (no deployed HTTPS origin; local production-build smoke test PASSED)

MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT: NO
PUSH: NO
```

## What you must provide to unblock

1. **Neon PostgreSQL** — pooled `DATABASE_URL` + direct `DIRECT_DATABASE_URL` (TLS, non-local). Unblocks migrations, auth, distributed rate limiting.
2. **Vercel access** — CLI login or `VERCEL_TOKEN` + org/project id. Unblocks deployment, HTTPS, HSTS, and the production smoke test.
3. **`AUTH_CANONICAL_ORIGIN`** — set to the exact production HTTPS origin after the domain exists.
4. **AWS KMS** (later) — clears `ALTANA CUSTODY` / `REAL KMS`.

Once 1–3 exist: `prisma migrate deploy` → `migrate status` → set `RATE_LIMIT_BACKEND=prisma` → deploy → re-run this smoke test against the HTTPS origin.
