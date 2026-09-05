# X.59 Neon Postgres Provisioning & Live Migration Verification

- **Date:** 2026-08-16 (resumed)
- **Baseline:** X.58.1 (DB-unreachable handling 503-verified; POSTGRES was BLOCKED, no credentials)
- **Outcome:** **PASS.** Real Neon PostgreSQL provisioned end-to-end: both endpoints reachable, migrations applied, models/constraints verified, auth persistence and rate limiting exercised against the real database, failure handling re-verified on the running production server, all gates green.

## Credentials handling

Provisioned into `.env.local` (never printed, never committed). Note: the values were stored wrapped in double quotes; the shell loaders in this milestone strip surrounding quotes (dotenv semantics). Only presence/flags were reported.

## Step 1 — Connectivity

| Endpoint | Result |
|---|---|
| Pooled `DATABASE_URL` (pooler host, TLS, via `prisma db execute`) | **PASS** (exit 0) |
| Direct `DIRECT_DATABASE_URL` (direct host, TLS, via env-based `db execute`) | **PASS** (exit 0) |

Both URLs parse as `postgresql`/TLS with expected hosts (pooler vs non-pooler). One probe via the `--url` CLI flag failed due to PowerShell arg plumbing; the env-based (authoritative) probe passed — no connectivity issue.

## Steps 2–3 — Validate / Generate / Migrate status

```text
prisma validate   → schema valid
prisma generate   → PASS
prisma migrate status → 2 migrations pending, target: PostgreSQL "neondb" (real)
```

## Step 4 — Migration review + Step 7 — migrate deploy

Pending migrations reviewed before applying:
- `202608150001_x41_postgres_prisma_foundation` (10,077 B) — CREATE types + 8 tables + RateLimitBucket-related indexes; **no** TRUNCATE/DELETE/DROP of any kind.
- `202608150002_x49_rate_limit_bucket` (469 B) — create-only.

`prisma migrate deploy` against the real database:
**All migrations successfully applied.** `migrate status` → **"Database schema is up to date!"** No `db push`, no ad-hoc migration.

## Step 4b — Models & constraints (real DB, pg catalogs)

All verified via live queries (exit 0, ALL PASS):
- Models: **User, Wallet, SiweChallenge, AuthSession, AltanaSession, SessionPermission, EncryptedSecret, AuditEvent, RateLimitBucket** — all present.
- FKs: Wallet.userId→User; AuthSession.userId→User; AuthSession.walletId→Wallet; SessionPermission.sessionId→AltanaSession; EncryptedSecret.sessionId→AltanaSession; AuditEvent.userId→User; AuditEvent.walletId→Wallet — all present.
- Unique indexes (Prisma creates unique indexes, not constraints): Wallet(chainId,address); SiweChallenge(nonceHash); SiweChallenge(attemptHash) — all present.
- Enums: WalletStatus, AltanaSessionStatus.

(First check run wrongly assumed a Wallet FK on SiweChallenge; the schema stores address+chainId scalars there by design, with the ownership key enforced via Wallet(chainId,address) and the two unique challenge indexes.)

## Step 5 — Real auth persistence (real PostgreSQL, 12/12 PASS)

The actual production store module (`prisma-store.server.ts`) exercised against Neon; no blockchain signature required (store layer only), no transactions created, all test rows cleaned up afterwards:

1. create + lookup challenge
2. completeAuthentication creates identity (user+wallet+session in one transaction)
3. second use of the same nonce refused (single-use, `challenge-unavailable`)
4. consumed challenge records `consumedAt`
5. wallet created + linked to the authenticated user (ownership)
6. session created and found by token hash
7. `touchSession` rotation updates `lastUsedAt`
8. `revokeSession` revokes the session
9. revoked session no longer active
10. double revocation is a no-op
11. audit event persisted
12. `countRecentChallenges` reflects the created challenge

## Step 6 — PostgreSQL-backed rate limiting (5/5 PASS)

- `RATE_LIMIT_BACKEND=prisma` selects the Prisma provider (proven on the real DB: its `incr` writes the `RateLimitBucket` row).
- Atomic upsert increments sequentially (1,2,3 via provider A; count observed 4,5).
- A **fresh provider instance** sees the exact same count — state persisted **in PostgreSQL**, outside process memory.
- `RATE_LIMIT_BACKEND=memory` selects the memory provider (no DB row written).
- Bucket rows cleaned up afterwards.
- Runtime activation on the future deployment is env-driven: `RATE_LIMIT_BACKEND=prisma` (factory fail-closes to memory today).

## Step 7 — Database failure regression (running production server)

Standalone production build (`output: standalone`), two servers, real cookie created via the store against the real DB:

| Scenario | Result |
|---|---|
| Real DB available + real cookie → `/api/auth/me` | **200** with real identity (wallet, chainId 97, expiry) |
| Real DB available + real cookie → `/api/altana/session` | 503 "not configured" (honest — KMS not configured yet) |
| Real DB available → `/categories/yield` | 200 |
| DB unreachable (mispointed URL) + real cookie → `/api/altana/session` | **503 `{"ok":false,"error":{"message":"Session persistence is unavailable."}}`** |
| DB unreachable + real cookie → `/api/auth/me` | 503 safe generic message |

Leak check on the 503 body: **no stack trace, no credentials, no Prisma internals, no URL components** (regex-verified). X.58.1 behavior preserved.

## Steps 8/12–16 — Full gates

| Gate | Result |
|---|---|
| `pnpm prisma validate` | PASS |
| `pnpm prisma generate` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | PASS (exit 0) — **329 checks, 0 failures** |
| `pnpm audit` | PASS — no known vulnerabilities |

## Status

```text
POSTGRES: PASS
POOLED DATABASE: PASS
DIRECT DATABASE: PASS
MIGRATIONS: PASS
AUTH PERSISTENCE: PASS
RATE LIMIT: PASS
DATABASE FAILURE HANDLING: PASS
PRISMA VALIDATE: PASS
PRISMA GENERATE: PASS
TYPECHECK: PASS
LINT: PASS
BUILD: PASS
TESTS: PASS
AUDIT: PASS

VERCEL: NOT STARTED
HTTPS: NOT STARTED
KMS: NOT STARTED
ALTANA CUSTODY: BLOCKED UNTIL KMS/CUSTODY
MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT: NO
PUSH: NO
```

## Notes / artifacts

- All live verification scripts were ad-hoc (temp workspace, removed from the repo tree); the report records them as executed steps, and all created test rows were deleted (challenges, wallet, session, user, rate-limit buckets).
- The auth/session persistence checks used the repository's production store modules against the real database; nothing was mocked.
- Remaining runtime config for later milestones: set `RATE_LIMIT_BACKEND=prisma` on the deployment; provision KMS before enabling Altana custody; deploy via Vercel.

## Files changed

- `docs/review/Main-Track-Activation-X59-Neon-Postgres.md` — this report (reports only; no code, schema, or configuration changes).