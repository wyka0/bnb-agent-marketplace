# X.39 - Infrastructure Readiness Audit

- Date: 2026-08-14
- Scope: read-only readiness audit for X.37 implementation
- Architecture authority: X.38
- Source implementation: none
- Database connection or migration: none
- Blockchain activity/signing/broadcast: none
- Mainnet: not touched
- Agent 1816 / Job 515: unchanged
- Commit/push: none

## Executive Status

| Area | Status | Result |
|---|---|---|
| Prisma tooling and PostgreSQL declaration | PASS | Prisma 6.19.3 resolves; PostgreSQL datasource uses `DATABASE_URL` |
| Database runtime/models/repository | MISSING | No models, PrismaClient runtime or repositories |
| Migrations and production release path | MISSING | No migrations; CI only generates client |
| Authentication | MISSING | Login/connect-wallet placeholders only |
| CSRF/request-shape controls | PARTIAL | Same-origin/no-store/body limits exist on selected routes; no authenticated CSRF token |
| KMS/Vault/HSM/envelope encryption | MISSING | No dependency, abstraction or configuration |
| Remote admin signer | MISSING | Operator scripts use a raw server env private key |
| Vercel-compatible Next runtime | PASS | Next App Router/Node standalone build works |
| Vercel production persistence/custody | BLOCKED | External database, KMS, credentials and migration workflow absent |
| Redis runtime | MISSING | Local Compose service/env name only; no client or usage |
| X.37 security foundation | BLOCKED | Auth, persistence and custody prerequisites absent |

## 1. PostgreSQL / Prisma

### Available - PASS

- Schema: `prisma/schema.prisma`.
- Generator: `prisma-client-js`.
- Datasource: PostgreSQL.
- Datasource URL: `env("DATABASE_URL")`.
- Package: `prisma/package.json` declares Prisma and `@prisma/client` `^6.0.0`;
  `pnpm-lock.yaml` resolves both to `6.19.3`.
- Commands: `generate`, `migrate`, `migrate:deploy`, `db:push`, `studio`.
- Root commands: `prisma:generate`, `prisma:migrate`.
- Local development: `docker-compose.yml` provisions PostgreSQL 16 with a
  persistent volume and health check.
- Variable name references:
  - `DATABASE_URL` in `schema.prisma`, `packages/config/src/env.ts` and
    `prisma/.env.example`.

No database was contacted during this audit and no values were printed.

### Missing

- No Prisma models.
- No `prisma/migrations` directory or migration SQL.
- No `PrismaClient` construction/import in application runtime.
- No shared database package/repository layer.
- No users, wallets, auth sessions, SIWE challenges, Altana sessions,
  permissions, encrypted secrets or audit records.
- No application database transaction or ownership query.
- No pooled production connection configuration.
- No separate direct migration URL in schema/config.
- No runtime and migration role separation.
- No database readiness/migration-state check.

### Direct/migration URL support

- Prisma supports a direct datasource URL, and X.38 recommends
  `DIRECT_DATABASE_URL`, but this repository does not currently declare or use
  `directUrl = env("DIRECT_DATABASE_URL")`.
- `DIRECT_URL`, `DIRECT_DATABASE_URL` and `SHADOW_DATABASE_URL` are not active
  configuration.
- `migrate:deploy` exists as a package script but is not invoked by CI or a
  deployment workflow.
- `db push` must not be used as production migration management.

### Vercel runtime assessment

Prisma can run in the current Next Node architecture after:

1. provisioning managed PostgreSQL;
2. adding models/migrations and a singleton/runtime client module;
3. using a serverless-compatible pooled `DATABASE_URL`;
4. using a direct `DIRECT_DATABASE_URL` for controlled migration deployment;
5. adding explicit Node runtime to routes importing Prisma/custody code;
6. establishing connection limits and release migration sequencing.

Current status: **BLOCKED** for production runtime.

## 2. Authentication

### Existing placeholders

- `apps/web/app/(app)/login/page.tsx`:
  - states wallet authentication is a future auth phase;
  - wallet input is disabled.
- `apps/web/components/top-nav.tsx`:
  - Connect Wallet disabled and marked Coming Soon.
- `apps/web/app/(app)/layout.tsx`:
  - only wraps `DashboardShell`; no auth/session guard.
- Root layout/providers:
  - no auth or session provider.
- `apps/web/app/api/altana/session/route.ts`:
  - returns static X.36 public state;
  - POST enforces same origin and revoke-only shape;
  - does not authenticate, load ownership or submit revocation.
- `/permissions` reads that static public endpoint.

### Missing - MISSING

- SIWE/EIP-4361 library and parser.
- Server-generated nonce/challenge.
- Nonce/challenge persistence and atomic consumption.
- Wallet signature verification.
- EOA/optional ERC-1271 ownership policy.
- User/wallet binding.
- Opaque trusted server session.
- HTTP-only session cookie.
- Session token hashing, rotation, expiry and revocation.
- `requireSession()` or equivalent server authorization helper.
- Logout/session invalidation route.
- Protected route-group layout.
- Session-bound CSRF token and Fetch Metadata policy.
- Auth rate limiting and audit records.

### Narrow controls already present - PARTIAL

- Same-origin check on the static Altana POST.
- `Cache-Control: no-store` on selected routes.
- Body-size/JSON validation on selected activation routes.
- Server-only API key patterns for 8004scan and other integrations.

These controls do not prove identity or ownership.

## 3. KMS / Secret Custody

### Present dependencies

- `@altananetwork/sdk`, `porto` and `viem` provide wallet/session/signing
  primitives.
- They are not custody systems.
- Historical operator scripts read `ALTANA_TESTNET_PRIVATE_KEY` from server
  environment configuration. That is an operator/test flow, not encrypted
  multi-user persistence or remote custody.

### Missing - MISSING

Repository/package/config search found no:

- AWS KMS SDK/integration;
- Google Cloud KMS;
- Azure Key Vault;
- HashiCorp Vault;
- Cloud KMS abstraction;
- envelope-encryption provider;
- HSM integration;
- remote signer/custody provider;
- encrypted-secret repository;
- KMS key/version metadata;
- AAD/rotation/deletion implementation;
- runtime cloud credential broker.

No approved custody mechanism exists today.

### Architecture requirement

Per X.38:

- short-lived session signer: managed KMS envelope encryption;
- long-lived Altana admin/provider key: remote signer or HSM-backed custody;
- plaintext session key: server memory only during an authorized operation;
- database: ciphertext/wrapped-key metadata only;
- browser/API/logs: no plaintext, ciphertext, signer or custody credential.

## 4. Vercel

### Available - PASS

- Next.js App Router application.
- Next `15.5.23` resolved.
- Node `>=20` requirement.
- `next.config.mjs` sets `output: "standalone"` and transpiles workspace
  packages.
- Dockerfile provides a Node 20, non-root standalone runtime as a separate
  deployment path.
- X.19 documents production origin:
  `https://bnb-agent-marketplace-web.vercel.app`.
- Existing route handlers are compatible with Node runtime.

### Missing / blocked

- No `vercel.json` or checked-in Vercel project metadata.
- No deployment workflow or migration release job.
- No production environment mapping/runbook.
- No canonical auth-origin implementation or preview-origin policy.
- No explicit `runtime = "nodejs"` on future Prisma/KMS routes.
- No KMS credential integration/broker.
- No managed database/pooling configuration.
- No operational timeout/idempotency/recovery design for custody writes.
- No startup gate that requires production auth/database/custody variables.

### Environment-variable inventory

Existing central configuration names:

```text
NODE_ENV
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_WS_URL
DATABASE_URL
REDIS_URL
LOG_LEVEL
OTEL_SERVICE_NAME
OTEL_EXPORTER_OTLP_ENDPOINT
EIGHT004SCAN_BASE_URL
8004SCAN_API_KEY
ALTANA_NETWORK
ALTANA_RPC_URL
```

Existing `.env.example` names:

```text
8004SCAN_API_KEY
ALTANA_PAYTO
ALTANA_FACILITATOR_ADDRESS
ALTANA_OPERATOR_ADDRESS
ALTANA_SERVICE_PRICE_RAW_U
ALTANA_RPC_URL
ALTANA_TESTNET_PRIVATE_KEY
FACILITATOR_KEY
MERCHANT_PAYTO
PANCAKESWAP_API_KEY
X402_PAYTO
```

Required design-only names not yet configured:

```text
DIRECT_DATABASE_URL
AUTH_ORIGIN
AUTH_SESSION_HASH_SALT
KMS_PROVIDER
KMS_KEY_ID
AWS_REGION
AWS_RUNTIME_CREDENTIAL_BROKER
ALTANA_ADMIN_CUSTODY_PROVIDER
ALTANA_ADMIN_KEY_REFERENCE
```

No existing secret is incorrectly named with `NEXT_PUBLIC_`. Current public
variables are URLs only. Actual values were not read or reported.

## 5. Redis / Cache

### Available - PARTIAL

- `docker-compose.yml` provisions local Redis 7 with volume and health check.
- `REDIS_URL` exists in central env schema with a local default.

### Missing

- No `redis`, `ioredis`, `@upstash/redis` or equivalent client dependency.
- No connection module or runtime usage.
- No managed production Redis.
- No TLS/auth configuration.
- No challenge, rate-limit, lock, idempotency or cache implementation.

### Reasonable future use

Redis can support:

- short-lived SIWE challenge lookup;
- IP/wallet rate limits;
- distributed revoke/grant locks;
- idempotency keys;
- short-lived public cache.

PostgreSQL can also provide transactional SIWE challenge consumption and locks
at initial scale. Redis must never hold authoritative or decryptable session
signer custody.

## 6. External Infrastructure Checklist

### Already available

- [x] Next.js 15 App Router and Node build.
- [x] Prisma 6.19.3 tooling.
- [x] PostgreSQL datasource declaration.
- [x] Local PostgreSQL 16 Compose service.
- [x] Local Redis 7 Compose service.
- [x] `DATABASE_URL` and `REDIS_URL` configuration names.
- [x] `prisma migrate deploy` command exists.
- [x] Basic CI install/lint/typecheck/build/format jobs.
- [x] Altana SDK, Porto and viem dependencies.
- [x] Chain-97 session/KeyStore read patterns from X.36.
- [x] Public Vercel production origin documented.
- [x] Selected-route same-origin/no-store/body validation controls.

### Must be provisioned

#### Managed PostgreSQL - REQUIRED local and production

- Purpose: auth challenges/sessions, ownership, Altana session metadata,
  permissions, encrypted-secret records and audit events.
- Recommended service: Neon, Supabase, Railway, Render, AWS RDS or equivalent
  PostgreSQL with Vercel-compatible pooling. Provider is not silently selected.
- Required resource: database per environment, pooled runtime endpoint, direct
  migration endpoint, runtime/migration roles, TLS.
- Variable names:
  - `DATABASE_URL`
  - `DIRECT_DATABASE_URL`
- Local: local Docker PostgreSQL is sufficient after models/migrations exist.
- Vercel: required external managed service.

#### SIWE/auth implementation dependencies - REQUIRED local and production

- Purpose: cryptographic wallet ownership and trusted server session.
- Recommended: maintained EIP-4361/SIWE parser plus explicit web/server `viem`.
- Required account/resource: no hosted account for custom SIWE; package and DB
  models required. A managed auth vendor remains an alternative requiring an
  account and separate assessment.
- Variable names:
  - `AUTH_ORIGIN`
  - `AUTH_SESSION_HASH_SALT`
- Local: required to develop/test X.37.
- Vercel: required.

#### Managed KMS - REQUIRED production; emulator/mock allowed locally

- Purpose: envelope encryption/decryption of short-lived session signer keys.
- Recommended: AWS KMS, Google Cloud KMS, Azure Key Vault or equivalent managed
  KMS. X.38 recommends managed KMS but does not choose a cloud account.
- Required resource: customer-managed symmetric key, least-privilege runtime
  identity, audit logs, rotation policy.
- Generic variable names:
  - `KMS_PROVIDER`
  - `KMS_KEY_ID`
- AWS-specific names if AWS is selected:
  - `AWS_REGION`
  - `AWS_RUNTIME_CREDENTIAL_BROKER`
- Local: deterministic provider emulator/test double with no real keys, or a
  dedicated development KMS key/account; never plaintext persistence.
- Vercel: required external KMS and secure credential integration.

#### Remote signer/HSM custody - REQUIRED production

- Purpose: keep the long-lived Altana admin/provider private key outside
  Vercel/database.
- Recommended providers for evaluation: HSM-backed cloud signer, Turnkey,
  Fireblocks, Coinbase Developer Platform, Vault/HSM or equivalent compatible
  signer. No provider is selected without Altana signer compatibility review.
- Required resource: custody account/vault/key and policy restricting chain,
  targets, methods and spend.
- Variable names:
  - `ALTANA_ADMIN_CUSTODY_PROVIDER`
  - `ALTANA_ADMIN_KEY_REFERENCE`
- Local: a dedicated unfunded development signer may be used under explicit
  test controls; production key must not be copied locally.
- Vercel: external service required.

#### Redis - OPTIONAL

- Purpose: rate limits, distributed locks, idempotency and challenge cache.
- Recommended: Upstash Redis or another TLS managed Redis compatible with
  Vercel if PostgreSQL-only coordination is insufficient.
- Required resource: managed Redis database/namespace.
- Variable name: `REDIS_URL`.
- Local: existing Docker Redis is sufficient after client code is approved.
- Vercel: optional depending on PostgreSQL challenge/locking design.

#### Vercel project/release configuration - REQUIRED production

- Purpose: environment scoping, Node runtime, build/deploy and migration order.
- Recommended: existing Vercel project plus a separate controlled migration
  job in CI/release tooling.
- Required resource: Vercel project/environment configuration and deployment
  credentials managed outside source.
- Variable names: all production names above, scoped separately for Preview and
  Production.
- Local: not required.
- Vercel: required.

## 7. Security Gate

### `loadActiveAltanaSession(user)` - BLOCKED

Blocking dependencies:

- no authenticated trusted `user`;
- no User/Wallet/AltanaSession repository;
- no encrypted secret record;
- no KMS decrypt provider;
- no restart-safe signer reconstruction;
- no ownership transaction/query.

Available reusable components: X.36 policy/session types and read-only KeyStore
verification. They are insufficient without identity/persistence/custody.

### `createAltanaSession(user)` - BLOCKED

Blocking dependencies:

- no cryptographic wallet ownership proof;
- no trusted auth session/CSRF/idempotency;
- no database recovery state for chain-write/DB-failure ordering;
- no KMS encryption before secret persistence;
- no remotely protected admin signer;
- no atomic metadata/permission/secret repository transaction.

### `revokeAltanaSession(user)` - BLOCKED

Blocking dependencies:

- no authenticated owner;
- no persisted active session;
- no encrypted signer reconstruction;
- no remote admin signer;
- no active->revoking lock/state machine;
- no transaction/audit persistence;
- no post-confirmation secret destruction workflow.

The current static X.36 revoke-shaped route is not a real persisted revoke API.

## 8. Recommended Provisioning Order

1. Approve SIWE dependency and custom opaque-session architecture from X.38.
2. Provision managed PostgreSQL and runtime/migration roles.
3. Configure pooled `DATABASE_URL` and direct `DIRECT_DATABASE_URL` by
   environment, without adding values to source.
4. Design/review User, Wallet, SiweChallenge, AuthSession, AltanaSession,
   SessionPermission, EncryptedSecret and AuditEvent models.
5. Create/review the initial migration and empty-database migration CI test in a
   later implementation milestone.
6. Implement SIWE challenge/verify/logout and trusted `requireSession()`.
7. Select/provision KMS, key policy, audit logging and runtime credentials.
8. Select/provision Altana-compatible remote admin signer/HSM custody.
9. Implement envelope-encryption interface and repository security tests.
10. Implement persisted Altana create/load/revoke with recovery/idempotency.
11. Replace static permissions API/UI with authenticated live state.
12. Add Vercel environment, migration release, preview-origin and incident
    response procedures.

## 9. Security Risks

- Promoting `ALTANA_TESTNET_PRIVATE_KEY` operator scripts into web runtime would
  expose long-lived admin authority to Vercel memory and broad application code.
- Accepting client wallet/session IDs as ownership would enable cross-user
  access and unauthorized revocation.
- Stateless JWT/cookie-only auth would weaken immediate server revocation unless
  backed by a DB lookup.
- Running Prisma with non-pooled serverless connections risks exhaustion.
- Running migrations during every Vercel build/request risks concurrent schema
  changes and partial releases.
- Storing session keys in PostgreSQL or Redis plaintext is prohibited.
- Storing a master encryption key beside ciphertext defeats database-compromise
  separation.
- Using Redis as signer custody creates durability, backup and access-control
  risks.
- Missing idempotency/recovery can orphan an on-chain session if a database
  write fails after grant/registration.
- Preview domains can break or weaken SIWE domain binding unless explicitly
  configured.
- Current central env validation is permissive and does not fail production
  startup when future auth/custody variables are absent.

## X.37 Prerequisite Gate

```text
PRISMA TOOLING: PASS
POSTGRESQL DATASOURCE DECLARATION: PASS
DATABASE MODELS/REPOSITORY: MISSING
MIGRATIONS: MISSING
POOLED PRODUCTION DATABASE: MISSING
DIRECT MIGRATION URL: MISSING
AUTHENTICATION/SIWE: MISSING
TRUSTED SERVER SESSION: MISSING
KMS/ENVELOPE ENCRYPTION: MISSING
REMOTE ADMIN SIGNER/HSM: MISSING
REDIS RUNTIME: MISSING (OPTIONAL)
VERCEL RELEASE/MIGRATION CONFIG: MISSING

loadActiveAltanaSession(user): BLOCKED
createAltanaSession(user): BLOCKED
revokeAltanaSession(user): BLOCKED

X.37 IMPLEMENTATION READY: NO
```

## Verification

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS (exit 0) |
| `pnpm lint` | PASS (exit 0) |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | PASS (exit 0) |

## Final Status

```text
X.39 STATUS: AUDIT COMPLETE - INFRASTRUCTURE BLOCKED
DATABASE: PARTIAL TOOLING / MISSING RUNTIME
AUTHENTICATION: MISSING
CUSTODY: MISSING
VERCEL PRODUCTION READINESS: BLOCKED
REDIS: LOCAL SCAFFOLD ONLY
X.37 READY: NO

DATABASE CONNECTIONS: NONE
MIGRATIONS: NONE
AUTH SETUP: NONE
KMS SETUP: NONE
TRANSACTIONS/SIGNING/BROADCAST: NONE
MAINNET: NOT TOUCHED
AGENT 1816 / JOB 515: UNCHANGED
COMMIT/PUSH: NONE
```

STOP after X.39 report and verification.
