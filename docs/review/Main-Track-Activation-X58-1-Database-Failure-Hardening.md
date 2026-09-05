# X.58.1 Database-Failure Hardening

- **Date:** 2026-08-16
- **Baseline:** X.58 (500 on `/api/altana/session` when PostgreSQL unreachable; report declared the finding OPEN)
- **Outcome:** **PASS.** The 500 is closed. Root cause found by instrumenting the production bundle; fixed with a two-line classification change; verified on the running standalone production server.

## Root cause (exactly traced)

The X.58 report's own evidence invalidated the Prisma hypothesis: the standalone server emitted **no stderr** even for the 500, and the mapper returned 503 for every Prisma error shape when tested in isolation. So the error reaching the route catch was **not a Prisma error at all**.

Instrumenting the compiled route handler and mapper inside `.next/standalone` showed the sequence:

1. `getAuthenticatedUser()` runs first. **When the `Cookie` header actually arrives** (see probe note below), the auth store's `prisma.authSession.findFirst()` throws `PrismaClientInitializationError` (the DB is unreachable) **before** any session-service construction — that path always produced the intended 503 even before this milestone.
2. With **no cookie** (the common case for this route), `identity` is `null` and the route proceeds to `createSessionService()`, which calls `createAltanaCustody(env)` → `createKmsProvider(env)` → **`CustodyConfigError`**: `"AWS_REGION and ALTANA_KMS_KEY_ID are required when ALTANA_KMS_PROVIDER=aws"`.
3. The mapper's classification checked only for *persistence* failure and *missing required environment variable* — `CustodyConfigError` matched neither, so it fell through to the generic **500** `"Unable to complete the session request."`

So the reported 500 was a **KMS-not-configured** condition misclassified as a generic server failure on **every** request to the route (because `createSessionService()` runs on every request, authenticated or not). Once real KMS is absent, this was the only error path that fired in the reported scenari later milestones also carried the old `missing required env` branch — for THIS deployment state, CustodyConfigError was the one that matched nothing and produced 500.

**Probe note (why previous "cookie" tests looked contradictory):** PowerShell's `Invoke-WebRequest` silently dropped the `Cookie` header in this setup (`request.headers.get("cookie")` was empty inside the bundle), so earlier cookie-case probes never sent the cookie and never touched the database. `curl.exe` delivers the header correctly, and with it the real auth path (and its real Prisma error, mapped to 503) was observed end-to-end. This was a test-harness artifact, not an application bug.

## Fix (`apps/web/lib/altana-session/api.ts`)

Classify `CustodyConfigError` by **error name only** (the deliberate app error class, same pattern already used for `PrismaClientInitializationError`) into the existing "not configured on this deployment" 503 branch:

- persistence-unavailable patterns unchanged → 503 "Session persistence is unavailable."
- missing env var OR `CustodyConfigError` → 503 "Altana session support is not configured on this deployment."
- everything else → unchanged generic 500

No message content, config variable name, or stack trace can ever reach a response body. No error class is swallowed: sibling `CustodyError`/`KmsAccessError` instances still fall through to 500. Auth behavior (401 unauthenticated), rate-limit behavior, and security headers are untouched — the change is purely in the catch classifier.

## Regression test (`apps/web/lib/altana-session/session.api.verify.ts`)

Nine deterministic checks added (no real PostgreSQL anywhere; offline fixture/class based):

- **DATABASE UNAVAILABLE:** real `CustodyConfigError` (constructed from the actual class, exact production message) → 503 not-configured, and the mapped message leaks **no** config internals; realistic `PrismaClientInitializationError`/P1001 fixture (real `Error` instance, engine-style stack) → 503 persistence, no engine paths/URLs in message.
- **UNAUTHENTICATED → 401** behavior re-asserted unchanged.
- **DATABASE AVAILABLE** (memory store) → 200 with safe view, unchanged.
- **Unrelated errors not swallowed:** arbitrary `Error` → 500; non-Error value → 500; `KmsAccessError` → 500 (only `CustodyConfigError` becomes not-configured).

## Verification

| Gate | Result |
|---|---|
| `pnpm prisma validate` | PASS |
| `pnpm prisma generate` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | **PASS (exit 0) — 329 checks** (320 + 9 new) |
| `pnpm audit` | PASS — no known vulnerabilities |

## Running standalone server (the required verification)

Clean production build (`output: standalone`), `NODE_ENV=production`, `DATABASE_URL` pointing at an unreachable PostgreSQL, via `curl`:

```text
Cookie present + no-KMS env + DB down  => 503  body: {"ok":false,"error":{"message":"Session persistence is unavailable."}}
No cookie     + no-KMS env            => 503  body: {"ok":false,"error":{"message":"Altana session support is not configured on this deployment."}}
```

The exact X.58 reproduction (env present, PostgreSQL unreachable) now returns **503**, twice — once through the real Prisma error path and once through the config path. Neither body contains a credential, a stack trace, or an internal name.

Preserved behavior on the same running server:

```text
/categories, /categories/{rebalancing,grid-trading,yield,health-factor} => 200
/marketplace, /permissions, /login                                      => 200
yield page: analysis-only label present, unavailable declared, NO fake APY, NO fake health factor, NO "coming soon"
Content-Security-Policy with per-request nonce: present
Strict-Transport-Security over HTTP: correctly absent (HTTPS-gated by design)
8004scan during its chain-56 upstream degradation: surfaced as an honest unavailable state on the page (no fabricated rows)
```

## X.58.1 STATUS: PASS

```text
X.58.1 STATUS: PASS
DATABASE-UNAVAILABLE RESPONSE: 503
REGRESSION TEST: PASS
BUILD: PASS
TESTS: PASS (329 checks)
AUDIT: PASS

POSTGRES: BLOCKED
VERCEL: BLOCKED
HTTPS: BLOCKED
PRODUCTION SMOKE TEST: BLOCKED

MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT: NO
PUSH: NO
```

## Files changed

- `apps/web/lib/altana-session/api.ts` — `CustodyConfigError` classified (by name) as 503 not-configured; doc comment updated.
- `apps/web/lib/altana-session/session.api.verify.ts` — X.58.1 regression section (9 checks; total now 72 in this verifier).
- `docs/review/Main-Track-Activation-X58-1-Database-Failure-Hardening.md` — this report.

## Note

The `X.58` report's "open finding" is now fully closed with a definitive root cause. The only infrastructure still missing is the same as before this milestone: a real PostgreSQL (and Vercel) — this milestone intentionally changed nothing about provisioning.