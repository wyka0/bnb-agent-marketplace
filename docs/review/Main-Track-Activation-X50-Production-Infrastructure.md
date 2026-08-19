# X.50 Production Infrastructure

- **Date:** 2026-08-15
- **Baseline:** `Main-Track-Activation-X49-Security-Remediation.md` (PASS WITH FINDINGS)
- **Scope:** Infrastructure + deployment preparation. No provisioning credentials, no managed services, no blockchain activity, no commit/push.
- **Result:** Every code-side production requirement is complete and verified offline. Every requirement that depends on **external infrastructure is BLOCKED** because no provisioning access exists in this environment.

## Environment Reality Check (evidence for all BLOCKED items)

Presence-only inspection (no values read, nothing logged):

```text
DATABASE_URL                   ABSENT
DIRECT_DATABASE_URL            ABSENT
AWS_REGION                     ABSENT
ALTANA_KMS_KEY_ID              ABSENT
ALTANA_KMS_PROVIDER            ABSENT
AWS_ACCESS_KEY_ID              ABSENT
AWS_SECRET_ACCESS_KEY          ABSENT
AWS_SESSION_TOKEN              ABSENT
RATE_LIMIT_BACKEND             ABSENT
AUTH_CANONICAL_ORIGIN          ABSENT
ALTANA_ADMIN_CUSTODY_PROVIDER  ABSENT
ALTANA_ADMIN_KEY_REFERENCE     ABSENT

vercel CLI   ABSENT
aws CLI      ABSENT
docker CLI   ABSENT
```

Consequence: no Neon/PostgreSQL database, no AWS KMS key, no Vercel project, and no custody provider can be provisioned, migrated, deployed, or live-verified in X.50. Nothing was simulated or faked.

## Architecture

Final target architecture (unchanged from X.40 intent, now matched by code):

```text
Vercel (Next.js 15 App Router, Node 20, standalone output)
  |
  +-- middleware.ts ....... production security headers (CSP nonce, HSTS)
  |
  +-- Neon PostgreSQL
  |     +-- DATABASE_URL ............ pooled runtime connection (SECRET)
  |     +-- DIRECT_DATABASE_URL ..... direct migration connection (SECRET, release job only)
  |
  +-- AWS KMS ............. envelope custody via existing KmsProvider abstraction (SECRET/CUSTODY)
  |
  +-- Redis ............... NOT provisioned, NOT required (PostgreSQL chosen instead)
  |
  +-- Altana remote signer / HSM .... long-lived admin key (CUSTODY) — BLOCKED
  |
  +-- 8004scan ............ server-side only, X-API-Key header (SERVER)
```

Redis was deliberately **not** adopted: the PostgreSQL-backed limiter already satisfies cross-instance enforcement without new infrastructure.

## PostgreSQL

- Runtime/migration URL split is implemented: `datasource db { url = env("DATABASE_URL"); directUrl = env("DIRECT_DATABASE_URL") }`.
- Neither variable is referenced with `NEXT_PUBLIC_`, and neither is ever logged.
- Production configuration assertion (new in X.50) rejects: missing URL, non-postgres scheme, and **local hosts** (`localhost`, `127.0.0.1`, `::1`, `*.local`).
- `prisma validate` and `prisma generate` PASS (validation needs no connection).
- `prisma migrate status`: **BLOCKED — P1001** (no reachable database).
- `prisma db push` was never used. No database was created, reset, or destroyed.

## Prisma Migration

Two reviewed, non-destructive migrations are checked in:

| Migration | Contents |
|---|---|
| `202608150001_x41_postgres_prisma_foundation` | 5 enums, 8 tables, FKs, chain-97 CHECKs, unique/partial indexes |
| `202608150002_x49_rate_limit_bucket` | `RateLimitBucket` (composite PK + window index) |

Verified offline (X.50 verifier checks 18–22):

- All required tables present: `User`, `Wallet`, `AuthSession`, `SiweChallenge`, `AltanaSession`, `SessionPermission`, `EncryptedSecret`, `AuditEvent`, plus `RateLimitBucket`.
- `chainId = 97` CHECK on `Wallet`, `SiweChallenge`, `AuthSession`, `AltanaSession`.
- Ownership/uniqueness: `Wallet(chainId,address)`, `AuthSession.tokenHash`, `AltanaSession(chainId,keyId)`, `(chainId,publicKey)`, partial `one_live_per_wallet_idx`.
- Restrictive deletion (`ON DELETE RESTRICT`) for security-bearing rows; `SET NULL` only for `AuditEvent` parents (audit preservation).
- **Zero** `DROP TABLE` / `TRUNCATE` / `DROP SCHEMA` / `DELETE FROM` statements.

Production migration workflow (documented, not executed): verify environment identity and non-local host → `pnpm --dir prisma exec prisma migrate deploy` from a controlled release job using `DIRECT_DATABASE_URL` → `prisma migrate status` → application connectivity check.

**MIGRATION EXECUTION: BLOCKED** (no production database).

## Authentication

Unchanged and fully green (X.42 + X.43 verifiers). X.50 additions:

- Production assertion requires `AUTH_CANONICAL_ORIGIN` to be present and **HTTPS**.
- X.49 origin validation (scheme allowlist, no credentials, HTTPS-in-production) remains in force.
- `__Host-` cookie policy, hash-only tokens, rotation, constant-time CSRF: unchanged.

## KMS

- The existing `KmsProvider` abstraction is used; **no new encryption system was invented**.
- `resolveKmsConfig` already fails closed on missing `AWS_REGION`/`ALTANA_KMS_KEY_ID`, unknown provider, and `test` provider in production; `TestKmsProvider` independently refuses construction in production.
- X.50 assertion additionally requires, in production: `ALTANA_KMS_PROVIDER=aws` + region + key id present.
- Implementation uses `DescribeKey` / `Encrypt` / `Decrypt` only — a **symmetric** customer-managed key (`SYMMETRIC_DEFAULT`) is the correct key type; no key administration APIs are called, and no key is created from application code.
- Credential model (documented, none configured): AWS credentials must come from Vercel's encrypted server-side environment or an AWS identity mechanism, scoped to `kms:Encrypt`, `kms:Decrypt`, `kms:DescribeKey` on **one key ARN** — never `kms:*`, never resource `*`, never in source, never in a browser bundle. CloudTrail audit logging must be enabled on the key.
- No AWS credentials, plaintext, DEK, signer, or private key was printed anywhere.

**KMS: NOT CONFIGURED. REAL KMS LIVE VERIFICATION: BLOCKED** (no AWS account/key/credentials).

## Altana Custody

- The long-lived admin/provider key is **not** placed in Vercel env, PostgreSQL, source, or browser storage.
- X.50 assertion **actively rejects** a raw `ALTANA_TESTNET_PRIVATE_KEY` in production and **requires** `ALTANA_ADMIN_CUSTODY_PROVIDER` + `ALTANA_ADMIN_KEY_REFERENCE`.
- `.env.example` documents `ALTANA_TESTNET_PRIVATE_KEY` as a local-development-only fallback.
- No production private key was generated, imported, or stored.
- Remaining work: the web Altana entry still constructs a local signer from the env key, which is correct for local/testnet but must be replaced by a remote-signer adapter before production writes.

**ALTANA CUSTODY: BLOCKED** — no HSM/remote-signer provider selected or available.

## Rate Limiting

PostgreSQL was chosen (option A) — no Redis added.

- Cross-instance provider implemented in X.49: atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count` against `RateLimitBucket`.
- Selection is explicit via `RATE_LIMIT_BACKEND`; `redis` remains a documented slot that throws rather than pretending.
- X.50 assertion **rejects `memory` in production**, so a deployment cannot silently ship per-instance limiting.
- Fail behavior: provider error → deny (503), never bypass.
- Covered routes: SIWE nonce, SIWE verify, logout, me, Altana session read, Altana revoke, hire preview, Aave preview, testnet risk oracle. No execution HTTP endpoint exists.

**RATE LIMIT: PER-INSTANCE today.** Distributed enforcement is implemented but **not verified** and cannot be enabled until PostgreSQL exists — deliberately not claimed.

## Vercel

- Added `vercel.json`: Next framework, `pnpm install --frozen-lockfile`, build runs `prisma generate` before `turbo run build`, standalone output directory.
- Node 20 / pnpm 9.15.9 pinned in root `package.json` (`engines`, `packageManager`).
- **Fixed a real deployment defect:** the Dockerfile installed with `--ignore-scripts` and never generated the Prisma client. It now runs `pnpm --dir prisma exec prisma generate` before building.
- `next.config.mjs` retains `output: "standalone"` and `serverExternalPackages` for `@prisma/client`, `@bnb-marketplace/prisma`, `@aws-sdk/client-kms`.
- Environment classification is documented in `.env.example` (PUBLIC / SERVER / SECRET / CUSTODY); no secret uses `NEXT_PUBLIC_`.
- `DIRECT_DATABASE_URL` is documented as migration-job-only.

**VERCEL: BLOCKED** — no project, token, or CLI; no deployment was performed.

## 8004scan

- Key remains server-only (`8004SCAN_API_KEY`, bracket access, no `NEXT_PUBLIC_`), sent as `X-API-Key`, never logged or returned.
- Requests are server-side with an 8s timeout; base URL is a compile/env constant (no SSRF).
- **X.49 LOW finding CLOSED:** added per-record validation (`isValidAgentRecord` / `filterValidAgentRecords`). Identity/type-critical fields (`id`, `agent_id`, `token_id`, `chain_id`, `chain_type`, `is_testnet`) are enforced and malformed rows are **dropped** rather than trusted. Nullable metrics still normalize without fabricating values.

**8004SCAN: PASS.**

## Security Headers

X.49 policy survives unchanged and was **not weakened**:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<per-request>' 'strict-dynamic';
  style-src 'self' 'nonce-<per-request>'; img-src 'self' data: blob:; font-src 'self' data:;
  connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;
Strict-Transport-Security: max-age=63072000; includeSubDomains   (production HTTPS only)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
```

No third-party origin was added. Verified: no `unsafe-eval`, no `unsafe-inline`, no wildcard, no external URL in the production CSP. Build output confirms Middleware is emitted (34.8 kB).

## Chain Safety

Now enforced at five layers:

1. **New X.50 configuration assertion** — `ALTANA_NETWORK` must be `bnb-testnet`; mainnet is rejected in every environment.
2. Web Altana entry refuses `ALTANA_NETWORK=bnb` at construction.
3. SDK adapter constructor throws unless the chain is 97; execution re-reads live `eth_chainId`.
4. Database `CHECK ("chainId" = 97)` on all chain-bearing tables.
5. 16-check revoke preflight asserts chain 97 and rejects serialized chain 56.

No mainnet RPC endpoint exists in executable code. Mainnet was not tested or touched.

## Deployment

| Gate | Result |
|---|---|
| `pnpm prisma validate` | PASS |
| `pnpm prisma generate` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (exit 0; middleware + all 6 auth/Altana routes + `/permissions` emitted) |
| `pnpm test` | PASS — 253 checks |
| `pnpm audit` | PASS — no known vulnerabilities |
| `pnpm install --frozen-lockfile` | PASS |
| Vercel production deploy | **BLOCKED** (no project/token/CLI) |

Local build still logs the known Windows Prisma query-engine lookup warning during page-data collection while exiting 0. The Dockerfile `prisma generate` fix addresses the packaging root cause for Linux images; this must be confirmed on a real deployment.

## Smoke Tests

**PRODUCTION SMOKE TEST: BLOCKED** — there is no deployed production URL to query. No smoke request was issued and no result was fabricated.

Expected behavior once deployed (to execute in X.51, read-only): `GET /` 200, `GET /api/auth/me` 200 with `data: null`, `GET /api/altana/session` **401** while unauthenticated, public pages 200, security headers present on every response.

## Regression Tests

| Milestone | Checks | Result |
|---|---:|---|
| X.42 authentication | 24 | PASS |
| X.43 trusted session | 41 | PASS |
| X.44 custody | 44 | PASS |
| X.45 persistence | 25 | PASS |
| X.46 Altana lifecycle | offline lifecycle regression | PASS (live verifier NOT run — would transact) |
| X.47 permissions/revoke | 63 | PASS |
| X.48 audit checks | re-verified via X.49/X.50 source + policy checks | PASS |
| X.49 remediation | 25 | PASS |
| X.50 infrastructure | 31 | PASS |

**Total: 253 offline checks, 0 failures.**

## Remaining Blockers

1. **PostgreSQL not provisioned** — no `DATABASE_URL`/`DIRECT_DATABASE_URL`; `migrate deploy` and `migrate status` blocked (P1001).
2. **AWS KMS not provisioned** — no account, key, or credentials; real custody round trip unverifiable.
3. **Altana admin custody not selected** — no HSM/remote-signer provider; production chain writes must not proceed until a signer adapter replaces the env-key path.
4. **Vercel project not available** — no deployment, therefore no smoke test.
5. **Distributed rate limiting not activated** — implemented and gated, but requires the migration deployed and `RATE_LIMIT_BACKEND=prisma`.
6. **Prisma engine packaging** — Dockerfile fix applied; needs verification in a real Linux deployment image.

## Production Readiness Matrix

| Item | Status | Evidence |
|---|---|---|
| DATABASE | BLOCKED | No URLs configured; P1001 on `migrate status` |
| MIGRATIONS | BLOCKED (content READY) | 2 reviewed non-destructive migrations verified offline; deploy impossible |
| AUTH | READY | X.42 24 + X.43 41 checks PASS; HTTPS origin assertion added |
| SESSION | READY | X.45 25 + X.47 63 checks PASS; atomic reservation intact |
| KMS | BLOCKED | Abstraction + fail-closed config READY; no key/credentials |
| CUSTODY | BLOCKED | Raw env admin key rejected in production; no remote signer selected |
| RATE LIMIT | DEFERRED | Postgres provider implemented + production-gated; not activated |
| SECURITY HEADERS | READY | X.49/X.50 checks PASS; middleware emitted in build |
| 8004SCAN | READY | Server-only key; per-record validation added |
| CHAIN SAFETY | READY | 5-layer chain-97 enforcement; mainnet rejected |
| CI/CD | READY | Lint, typecheck, build, test, and strict audit jobs in CI |
| MONITORING | BLOCKED | No provider configured; telemetry env only feature-detects OTLP |
| LOGGING | READY (app-side) | Zero `console.*` in production modules; audit rows carry ids/status only |
| BACKUPS | BLOCKED | Requires managed database provisioning |
| ROLLBACK | DEFERRED | Documented procedure; unexecutable without a deployment target |
| SECRETS | READY (policy) / BLOCKED (values) | Classification + `NEXT_PUBLIC_` rejection enforced; no real secrets exist here |

## X.51 Plan

1. Provision Neon PostgreSQL (production + preview), set pooled/direct URLs in Vercel scopes only.
2. Run `prisma migrate deploy` from a controlled release job; confirm `migrate status` and connectivity.
3. Set `RATE_LIMIT_BACKEND=prisma`; verify cross-instance counters with genuinely parallel clients.
4. Provision the customer-managed AWS KMS key with least-privilege policy + CloudTrail; run the encrypt → store → decrypt → destroy round trip with a synthetic fixture (never a real Altana key).
5. Select and integrate an Altana-compatible remote signer/HSM; replace the env-key path; keep chain 97 pinned.
6. Create the Vercel project, deploy, and run the read-only smoke suite; confirm headers, `401` behavior, and absence of Prisma engine failures.
7. Configure monitoring/alerting, backup/restore policy, and a rehearsed rollback.

## Final Status

```text
X.50 STATUS: BLOCKED (external infrastructure unavailable; all code-side work complete and verified)

POSTGRES:            BLOCKED
MIGRATIONS:          BLOCKED (migration content verified offline)
AUTH:                PASS
KMS:                 NOT CONFIGURED
ALTANA CUSTODY:      BLOCKED
RATE LIMIT:          PER-INSTANCE (distributed implemented, not activated)
VERCEL:              BLOCKED
8004SCAN:            PASS
SECURITY HEADERS:    PASS
CHAIN 97 SAFETY:     PASS

X.42: PASS
X.43: PASS
X.44: PASS
X.45: PASS
X.46: PASS
X.47: PASS
X.48: PASS
X.49: PASS
X.50 verifier: PASS (31/31)

PRODUCTION SMOKE TEST: BLOCKED
MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT: NO
PUSH: NO
```
