# X.40 - Production Infrastructure Provisioning Plan

- Date: 2026-08-14
- Source of truth: X.38 architecture and X.39 readiness audit
- Scope: production infrastructure/configuration planning only
- Source implementation: none
- Database/schema/migrations: none
- Auth/KMS setup: none
- Blockchain activity/signing/broadcast: none
- Mainnet: not touched
- Agent 1816 / Job 515: unchanged
- Commit/push: none

## Recommended Smallest Production-Safe Stack

| Concern | Recommendation | Status in repository |
|---|---|---|
| Web runtime | Existing Next.js App Router, Node 20, standalone output | Available |
| Database | **Neon PostgreSQL** with pooled runtime endpoint and direct migration endpoint | Must provision |
| ORM | Existing Prisma 6.19.3 | Tooling only; schema absent |
| Wallet auth | SIWE/EIP-4361 with maintained `siwe` parser plus explicit `viem` | Must add later |
| Auth sessions | Opaque random token, SHA-256 token hash in PostgreSQL, HTTP-only cookie | Must implement later |
| Short-lived session-key custody | **AWS KMS envelope encryption** plus PostgreSQL ciphertext metadata | Must provision |
| Long-lived admin key | **HSM-backed remote signer/custody provider** compatible with Altana signer flow | Must select/provision |
| Challenge/lock cache | PostgreSQL initially; optional Upstash Redis later | Redis currently local scaffold only |
| Deployment | Existing Vercel project with external Neon/KMS/custody services | Project/config not checked in |

This plan does not create accounts, resources, credentials, keys, packages,
models, migrations or application code.

## X.40A - PostgreSQL

### Recommendation: Neon PostgreSQL

Neon is the recommended database provider for this repository because the
project is already a Prisma/PostgreSQL monorepo targeting Vercel serverless
runtime, and the needed topology is straightforward:

- a pooled connection endpoint for application requests;
- a direct connection endpoint for Prisma migrations;
- PostgreSQL 16-compatible service;
- TLS connections;
- managed backups/branching/restore controls;
- Vercel-oriented integration options.

No Neon account or database was accessed or provisioned.

### Alternatives considered

**Supabase PostgreSQL:** realistic and compatible with Prisma, pooling and TLS;
adds a broader platform surface than this project currently needs. Suitable
alternative if the team already uses Supabase authentication/storage.

**Railway/Render PostgreSQL:** viable managed PostgreSQL with TLS, but the
Vercel integration and serverless pooling workflow are less directly aligned
with this deployment than Neon.

**AWS RDS:** mature, controllable and strong for enterprise operations, but
requires more networking, pooling and operational configuration for a small
Vercel application. It becomes more attractive if AWS KMS and the remote signer
will also be hosted in AWS.

**PlanetScale:** not recommended because it is MySQL-oriented and does not fit
the existing PostgreSQL/Prisma datasource.

### Required resource

Provision one Neon project/database per environment as needed:

- Development: optional hosted database; local Docker PostgreSQL remains valid.
- Preview/Staging: isolated branch or database with non-production auth/custody.
- Production: dedicated database with backups/restore policy and restricted
  runtime/migration roles.

### Variables, names only

```text
DATABASE_URL
DIRECT_DATABASE_URL
```

`DATABASE_URL` is the pooled runtime connection. `DIRECT_DATABASE_URL` is the
direct TLS connection used only by Prisma migration/release jobs. Values must
never be logged or included in client bundles.

### SSL and Prisma considerations

- Require TLS for hosted connections.
- Keep `prisma-client-js` and Prisma 6.19.3 unless a later upgrade is separately
  tested.
- Add `directUrl = env("DIRECT_DATABASE_URL")` to the Prisma datasource later.
- Use pooled runtime connections to avoid Vercel connection exhaustion.
- Use `prisma migrate deploy` from a controlled release job, not from a request,
  function startup or ordinary Vercel build.
- Keep migration credentials separate from the runtime application role.
- Never use `prisma db push` for production.
- Run migration validation against an empty PostgreSQL 16-compatible database
  in CI before release.

### Local development

The existing `docker-compose.yml` PostgreSQL 16 service remains the simplest
local option:

- local variable: `DATABASE_URL`;
- local direct migration URL may point to the same local database during
  development;
- no production Neon credentials belong in repository files;
- local migration execution remains a later implementation step.

## X.40B - Authentication

### Recommended architecture

Use SIWE/EIP-4361 only as wallet ownership proof. After successful signature
verification, issue an opaque server session stored in PostgreSQL. Do not use an
Altana session key as the marketplace login session.

Security domains:

- Marketplace auth session: human/user identity and wallet ownership.
- Altana session: scoped agent authority.

### Minimum dependencies to add later

Add explicitly to `apps/web` or a dedicated server package:

- `siwe` at an approved maintained version for strict EIP-4361 parsing and
  validation;
- `viem` as an explicit dependency wherever signature verification runs;
- existing Zod for request/envelope validation;
- existing Prisma client through a shared database package.

Do not install these packages in X.40.

### Challenge flow

#### `POST /api/auth/siwe/challenge`

1. Require exact trusted `Origin` and JSON content type.
2. Generate a cryptographically random nonce server-side using Node `crypto`.
3. Generate an opaque attempt token; store only its hash.
4. Construct the complete SIWE message server-side.
5. Bind:
   - canonical domain;
   - canonical URI;
   - chain ID `97` for the BNB Testnet marketplace flow;
   - wallet address after strict normalization;
   - nonce;
   - issued-at;
   - five-minute expiration;
   - request/attempt ID;
   - explicit statement describing marketplace login.
6. Store the exact message/hash, nonce hash, attempt hash, expiry and
   `consumedAt = null` in PostgreSQL.
7. Set a short-lived `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`
   `__Host-siwe_attempt` cookie.
8. Return only the exact message and public expiry.

The browser must not choose domain, URI, nonce, chain or timestamps.

#### `POST /api/auth/siwe/verify`

1. Require the attempt cookie and exact trusted origin.
2. Load the challenge by hashed attempt token.
3. Reject missing, expired or already-consumed challenges.
4. Parse SIWE strictly.
5. Revalidate domain, URI, chain 97, nonce, issued-at and expiration against the
   stored challenge.
6. Verify the signature with `viem`/SIWE. If contract-wallet login is required,
   define and test ERC-1271 verification explicitly; do not silently generalize
   the address policy.
7. In one database transaction:
   - atomically consume the challenge;
   - upsert the normalized `User` and `Wallet` ownership;
   - create a new `AuthSession`.
8. Generate a random 256-bit bearer session token.
9. Store only `SHA-256(token)`.
10. Set the trusted HTTP-only session cookie.
11. Return public user/wallet state only.

Concurrent verification of one challenge must allow exactly one successful
consumption.

### Ownership binding

- The verified SIWE address becomes the server-trusted wallet identity.
- Later Altana requests use `requireSession()` and database relations.
- Client-supplied `walletAddress`, `sessionId`, `keyId` or `agentId` is never
  authority.
- An Altana session belongs to a specific `User -> Wallet` relationship.

### Session rotation/logout

- Rotate the opaque server token after login and sensitive wallet changes.
- Store idle and absolute expiry.
- `POST /api/auth/logout` requires authentication, exact origin and CSRF token;
  atomically set `revokedAt` and clear the cookie.
- Disconnecting a browser wallet is not server logout.

### Replay and CSRF

- Single-use hashed challenge with expiry and atomic consumption.
- Domain/URI/chain/time binding in SIWE.
- Exact `Origin`, JSON content type and Fetch Metadata checks for mutations.
- Session-bound CSRF token or synchronizer token for authenticated POST/DELETE.
- SameSite cookie is defense in depth only.
- Rate-limit challenge/verify by IP and wallet without logging signatures.

## X.40C - Opaque Server Sessions

### Session token requirements

- Generate at least 256 bits from a cryptographic random source.
- Store only a cryptographic hash, never the bearer token.
- Cookie name: `__Host-bnb_session`.
- Flags: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- No `Domain` attribute for `__Host-` cookie.
- Recommended policy: 24-hour idle expiry and 7-day absolute expiry, subject to
  product approval.
- Store `createdAt`, `lastSeenAt`, `idleExpiresAt`, `absoluteExpiresAt`,
  `revokedAt`, user ID, wallet ID, chain ID and CSRF secret hash.
- Revoke server-side; cookie deletion alone is insufficient.

### Environment names only

```text
AUTH_ORIGIN
AUTH_SESSION_HASH_SALT
AUTH_SESSION_IDLE_SECONDS
AUTH_SESSION_ABSOLUTE_SECONDS
```

These are design names only. `AUTH_SESSION_HASH_SALT` must be server-only and
must not be reused as a KMS key or Altana private key.

## X.40D - KMS / Envelope Encryption

### Recommendation: AWS KMS envelope encryption

AWS KMS is the recommended short-lived session-signer custody layer because it
provides a managed customer-controlled key, decrypt audit events, key policy,
versioning/rotation and Node-compatible SDK access from Vercel server routes.
No AWS account, key, credentials or SDK was created in X.40.

### Alternatives considered

- **Google Cloud KMS:** technically equivalent; prefer only if deployment and
  workload identity are already Google-based.
- **Azure Key Vault:** technically viable; no existing Azure footprint.
- **HashiCorp Vault Transit:** powerful but adds an always-on Vault/auth/network
  operational surface not currently present.
- **Vercel environment secrets:** suitable for configuration, not per-user
  restart-safe signer custody, ownership, rotation or audit.
- **Database-only encryption:** rejected because a database-stored master key
  defeats separation from database compromise.

### Envelope structure

The application must use an approved cryptographic/provider library later; it
must not invent crypto.

Per persisted session signer:

- KMS customer-managed symmetric key: encrypts/wraps a per-record data key;
- data encryption key (DEK): used only in server memory for one operation;
- ciphertext: encrypted session private-key bytes;
- nonce/IV: unique per encryption;
- authentication tag: produced by authenticated encryption;
- wrapped data key: KMS-encrypted DEK stored beside ciphertext;
- AAD: session ID, user ID, wallet ID/address, chain 97, key version and
  algorithm version;
- key version/algorithm version: persisted metadata for rotation/recovery.

Conceptual flow:

1. Generate or request a DEK through KMS.
2. Encrypt session private-key bytes with authenticated AES-256-GCM and a unique
   nonce/AAD.
3. Wrap the DEK with the KMS key.
4. Persist ciphertext, nonce, tag, wrapped DEK, KMS key ID/version and AAD
   version. Never persist plaintext.
5. On reconstruction, authorize KMS decrypt, unwrap DEK, verify AAD/tag, decrypt
   only in Node server memory and reconstruct the Altana signer.
6. Require reconstructed public key to match persisted `publicKey`/`keyId`.

### KMS authorization

The Vercel runtime identity should have only the required data-plane actions:

- GenerateDataKey, if used;
- Decrypt;
- DescribeKey.

It must not have KMS key administration or deletion permission. Enable provider
audit logs. Prefer short-lived brokered cloud credentials over static access
keys in Vercel.

### Rotation/deletion

- Enable managed KMS backing-key rotation where appropriate.
- Record KMS key ID/version per secret.
- Rewrap DEKs during key migration without exposing plaintext session keys to
  logs or persistence.
- For session rotation, create a new session key, register it, revoke the old
  key, verify inactive, then destroy old ciphertext.
- For normal revoke, verify KeyStore inactive first, then delete/destroy the
  encrypted session secret and retain public audit metadata.
- During KMS compromise response, deny decrypt, revoke affected Altana sessions,
  rotate credentials and re-enroll keys.

### Required names only

```text
KMS_PROVIDER
KMS_KEY_ID
AWS_REGION
AWS_RUNTIME_CREDENTIAL_BROKER
```

These names are not currently configured.

## X.40E - Altana Admin Key Custody

### Recommendation: HSM-backed remote signer

The long-lived Altana admin/provider key should use a remote signer or
HSM-backed custody provider compatible with the Altana SDK signer requirements.
The private key must not be placed in Vercel environment variables or an
encrypted database row merely because it is convenient.

Required policy restrictions:

- BNB Testnet chain 97 only for the current track;
- approved Altana wallet/account only;
- approved KeyStore/session-management operations only;
- destination/method/selector restrictions;
- spend and rate limits;
- human/admin approval where appropriate;
- complete custody-provider audit logs.

Candidates to evaluate, not silently select:

- Turnkey;
- Fireblocks;
- Coinbase Developer Platform;
- HashiCorp Vault/HSM;
- AWS CloudHSM or compatible remote-signing service.

Compatibility must be proven against Altana’s required `Signer` behavior before
implementation. No provider is currently installed or configured.

### Short-lived session signer versus admin key

**Short-lived Altana session signer**

- generated per Altana session;
- scoped by target/signature/spend/expiry;
- encrypted with KMS envelope encryption;
- temporarily decrypted in server memory for authorized operations;
- destroyed after revocation/retention policy.

**Long-lived Altana admin/provider key**

- authorizes grant/register/revoke operations;
- higher blast radius and longer lifetime;
- should remain in remote/HSM custody;
- referenced by `ALTANA_ADMIN_KEY_REFERENCE`;
- never returned to Vercel application code as raw private-key bytes if remote
  signer compatibility is available.

Design-only names:

```text
ALTANA_ADMIN_CUSTODY_PROVIDER
ALTANA_ADMIN_KEY_REFERENCE
```

## X.40F - Database Schema Plan

No schema is being created. These model designs are the minimum architecture.

### `User`

- PK: UUID `id`.
- Fields: `createdAt`, `updatedAt`, nullable `deletedAt`, optional primary
  wallet relation.
- Relations: wallets, auth sessions, Altana sessions, audit events.
- Indexes: created/deleted timestamps.
- Deletion: soft-delete; restrict while custody records exist; audit FKs set null.

### `Wallet`

- PK: UUID `id`.
- Fields: `userId`, `chainId`, normalized lowercase `address`, status,
  `verifiedAt`, timestamps, optional `deletedAt`.
- Unique: `(chainId,address)`.
- Indexes: `(userId,status)`, `address`.
- Deletion: logical first; restrict dependent Altana sessions.

### `AuthSession`

- PK: UUID `id`.
- Fields: `userId`, `walletId`, `tokenHash`, `csrfHash`, `chainId`,
  `createdAt`, `lastSeenAt`, idle/absolute expiry, `revokedAt`, optional
  rotation/replacement ID.
- Unique: `tokenHash`.
- Indexes: `(userId,revokedAt)`, `idleExpiresAt`, `absoluteExpiresAt`.
- Sensitive: bearer hash and CSRF hash; never raw tokens.
- Deletion: revoke immediately; purge after retention.

### `SiweChallenge`

- PK: UUID `id`.
- Fields: `nonceHash`, `attemptHash`, exact canonical message or a canonical
  message digest, requested address, chain ID, domain, URI, issued/expiry,
  `consumedAt`, `createdAt`.
- Unique: `nonceHash`, `attemptHash`.
- Indexes: `expiresAt`, `(consumedAt,expiresAt)`.
- Deletion: purge consumed/expired challenges after short retention; no private
  signature storage.

### `AltanaSession`

- PK: UUID `id`.
- Fields: `userId`, `walletId`, chain 97, optional agent ID, wallet address,
  session `publicKey`, `keyId`, status, KeyStore status, expiry, timestamps,
  spent/limit raw units, native fee cap, grant/registration/revoke calls IDs and
  transaction hashes.
- Unique: `(chainId,keyId)`, `(chainId,publicKey)`.
- Indexes: `(userId,status)`, `(walletId,status)`, `(status,expiresAt)`, expiry.
- Deletion: revoke on chain, destroy encrypted secret, retain public audit.

### `SessionPermission`

- PK: UUID `id`.
- Fields: `sessionId`, kind (`call`, `token_spend`, `native_spend`), target,
  canonical function signature, token address, raw limit, period, timestamp.
- Index: `(sessionId,kind)`.
- Unique: use migration-level null-safe index or separate permission tables;
  PostgreSQL nullable compound unique semantics need explicit handling.
- Deletion: cascade after session lifecycle completion.

### `EncryptedSecret`

- PK: UUID `id`, unique `sessionId`.
- Fields: ciphertext, nonce, auth tag, wrapped data key, KMS key ID/version,
  algorithm/AAD version, created/rotated/destroyed timestamps.
- Indexes: `(kmsKeyId,keyVersion)`, destroyed timestamp.
- Sensitive: ciphertext and wrapped key are still sensitive; never API/log.
- Deletion: destroy/delete after confirmed revoke.

### `AuditEvent`

- PK: UUID `id`.
- Fields: optional user/wallet/session IDs, action, result, actor type/ID,
  request ID, chain ID, calls ID, transaction hash, public-safe metadata,
  created timestamp.
- Indexes: subject plus timestamp, action, result, request ID.
- Deletion: parent FKs set null; retain audit history.

## X.40G - Vercel Configuration

### PUBLIC

Existing public URL names only:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_WS_URL
```

Only public URLs/configuration belong under `NEXT_PUBLIC_`. No wallet private
key, session secret, bearer token, KMS credential, KMS key material, database
credential, custody credential or encryption secret may use this prefix.

### SERVER-ONLY

Existing/server-only names:

```text
DATABASE_URL
REDIS_URL
ALTANA_NETWORK
ALTANA_RPC_URL
8004SCAN_API_KEY
ALTANA_PAYTO
ALTANA_FACILITATOR_ADDRESS
ALTANA_OPERATOR_ADDRESS
ALTANA_SERVICE_PRICE_RAW_U
FACILITATOR_KEY
MERCHANT_PAYTO
PANCAKESWAP_API_KEY
X402_PAYTO
```

Future X.40/X.38 design names:

```text
AUTH_ORIGIN
AUTH_SESSION_HASH_SALT
AUTH_SESSION_IDLE_SECONDS
AUTH_SESSION_ABSOLUTE_SECONDS
KMS_PROVIDER
KMS_KEY_ID
AWS_REGION
AWS_RUNTIME_CREDENTIAL_BROKER
ALTANA_ADMIN_CUSTODY_PROVIDER
ALTANA_ADMIN_KEY_REFERENCE
```

### MIGRATION-ONLY

```text
DIRECT_DATABASE_URL
```

The direct migration URL must not be included in the Vercel runtime bundle or
general web function environment. It belongs to the controlled migration job.

### Deployment requirements

- Explicit Node runtime for Prisma/KMS/custody route handlers.
- Vercel Preview and Production environments separated.
- Production auth origin fixed to the canonical HTTPS domain.
- Preview auth origins explicitly configured or auth disabled for previews.
- External PostgreSQL provisioned before schema migration.
- `prisma migrate deploy` runs before application traffic receives the schema-
  dependent build.
- KMS/custody credentials scoped to the relevant environment and least privilege.
- No secrets in source, client bundles, logs or error responses.

## X.40H - Implementation Dependency Graph

```text
External PostgreSQL + pooled/direct URLs
        |
        v
X.40A PostgreSQL provisioning
        |
        v
X.40B Prisma schema + migration
        |
        +------------------------------+
        v                              v
X.40C SIWE authentication       X.40E KMS/custody provisioning
        |                              |
        v                              v
X.40D trusted AuthSession        X.40F encrypted Altana signer persistence
        |                              |
        +--------------+---------------+
                       v
             X.40G session reconstruction
                       |
                       v
             X.40H authenticated revoke
                       |
                       v
             X.40I permissions UI
                       |
                       v
             X.40J security verification
                       |
                       v
             X.40K Vercel deployment/release
```

### X.40A PostgreSQL

External first: Neon project/database, pooled runtime endpoint, direct migration
endpoint, TLS and roles. No application code yet.

### X.40B Prisma schema

Depends on A. Add eight requested models plus auth support models, reviewed
constraints, migration tests and controlled `migrate deploy` path.

### X.40C SIWE authentication

Depends on A/B. Add approved SIWE and explicit viem dependencies, challenge,
verify, ownership binding and replay tests.

### X.40D Trusted sessions

Depends on C. Add opaque token hashing, cookies, rotation, logout, CSRF and
`requireSession()`.

### X.40E KMS integration

External first: AWS account, customer-managed KMS key, policy, audit logging and
brokered runtime credentials. Then add provider integration later.

### X.40F Encrypted Altana signer persistence

Depends on B/D/E. Persist public policy separately from ciphertext; implement
grant/registration recovery and secret destruction. Requires an approved admin
custody mechanism before any authenticated chain write.

### X.40G Session reconstruction

Depends on F. Implement `loadActiveAltanaSession(user)` with expiry, ownership,
KeyStore read, AAD decrypt, public-key match and exact policy reconstruction.

### X.40H Authenticated revoke

Depends on G and remote admin custody. Add active-to-revoking lock, official
Altana revoke call, KeyStore re-read, secret destruction and audit event.

### X.40I Permissions UI

Depends on D/G/H. Replace static X.36 state with authenticated public DTOs and
revoke confirmation/status.

### X.40J Security verification

Depends on A-I. Add auth/replay/CSRF/ownership/custody/tamper/bundle/migration
tests and incident drills.

### X.40K Vercel deployment

Depends on all prior steps. Configure environment scopes, Node routes, external
services, migration release ordering, preview policy and observability.

## X.40I - Cost / Complexity Classification

| Service/component | Classification | Notes |
|---|---|---|
| Neon PostgreSQL | Required production; local Docker development-only | Smallest Vercel-compatible external database choice |
| AWS KMS | Required production; emulator/test double development-only | Per-request KMS cost/latency; one key can serve scoped encrypted records |
| Remote signer/HSM | Required production for long-lived admin key | Higher operational/cost complexity; not needed for offline unit tests |
| SIWE/viem packages | Required implementation dependency | No hosted service required for custom SIWE |
| Prisma migration job | Required production/release | One controlled job per deployment/migration set |
| Vercel project/config | Required production | Existing deployment evidence; config not checked in |
| Redis/Upstash | Optional | Avoid initially; PostgreSQL can hold challenges/locks at small scale |
| Auth vendor | Optional alternative | Not recommended for smallest explicit architecture; adds vendor cost/lock-in |
| Vault/HSM instead of KMS | Alternative production custody | Select only if organization already operates it or remote signing demands it |

Smallest practical service set:

- Neon PostgreSQL;
- AWS KMS;
- one approved remote/HSM signer for the long-lived admin key;
- Vercel;
- no Redis initially unless load/locking requirements justify it.

## Manual Provisioning Checklist Before X.41

### Accounts/resources

- [ ] Choose Neon organization/project and create isolated environments.
- [ ] Create production PostgreSQL database.
- [ ] Enable TLS and backups/restore policy.
- [ ] Create pooled runtime role/URL.
- [ ] Create direct migration role/URL.
- [ ] Choose AWS account/region or formally approve an equivalent KMS provider.
- [ ] Create customer-managed symmetric KMS key and alias.
- [ ] Define least-privilege KMS key policy and audit logging.
- [ ] Establish brokered/short-lived Vercel runtime credentials.
- [ ] Choose Altana-compatible remote signer/HSM provider.
- [ ] Create custody vault/key reference and testnet-only policy.
- [ ] Establish Vercel project Preview/Production environment ownership.

### Configuration names

- [ ] `DATABASE_URL`
- [ ] `DIRECT_DATABASE_URL`
- [ ] `AUTH_ORIGIN`
- [ ] `AUTH_SESSION_HASH_SALT`
- [ ] `AUTH_SESSION_IDLE_SECONDS`
- [ ] `AUTH_SESSION_ABSOLUTE_SECONDS`
- [ ] `KMS_PROVIDER`
- [ ] `KMS_KEY_ID`
- [ ] `AWS_REGION`
- [ ] `AWS_RUNTIME_CREDENTIAL_BROKER`
- [ ] `ALTANA_ADMIN_CUSTODY_PROVIDER`
- [ ] `ALTANA_ADMIN_KEY_REFERENCE`

No values are created or populated by X.40.

### Operational decisions

- [ ] Approve SIWE library/version and optional ERC-1271 policy.
- [ ] Approve canonical production auth origin and Preview behavior.
- [ ] Approve 24-hour idle/7-day absolute auth session policy, or alternatives.
- [ ] Approve one-live-session-per-wallet versus multiple-session policy.
- [ ] Approve KMS key rotation and session-secret destruction retention.
- [ ] Approve remote signer policies, approvals and incident response.
- [ ] Approve migration rollout/rollback procedure.
- [ ] Approve whether Redis is necessary at initial traffic.

## Security Requirements Before X.41

- No client-supplied wallet/session ID is authority.
- SIWE challenge is server-generated, hashed, single-use and time-bound.
- Auth sessions are opaque, hashed, HTTP-only and revocable.
- CSRF and exact origin enforced on authenticated mutations.
- Session signer ciphertext is separated from KMS key.
- AAD binds ciphertext to user/session/wallet/chain/version.
- Long-lived admin key is remote/HSM-custodied.
- Expired/revoked KeyStore state fails before decrypt/sign.
- Database, Redis, logs, telemetry, browser bundles and errors contain no
  plaintext signer or custody credentials.
- Chain-write plus database-failure recovery is designed before any new grant.
- All new chain actions remain BNB Testnet chain 97 only and never touch Agent
  1816 or Job 515.

## X.37 Readiness After Provisioning

```text
Current X.37 readiness: NO

Blocked by:
- no managed PostgreSQL/runtime repository
- no migration/direct URL
- no SIWE/auth/session implementation
- no KMS/envelope encryption
- no remote admin signer/HSM custody
- no Vercel release/migration workflow

X.37 may begin only after the manual provisioning checklist is complete and
verified, but no blockchain session should be created merely by provisioning.
```

## Final Report

```text
X.40 STATUS: PLAN COMPLETE

POSTGRESQL: Neon recommended; not provisioned
PRISMA: 6.19.3 tooling available; schema/migrations absent
AUTH: SIWE/EIP-4361 + opaque PostgreSQL sessions recommended; not installed
KMS: AWS KMS envelope encryption recommended; not provisioned
ADMIN KEY: HSM-backed remote signer recommended; not provisioned
VERCEL: existing Node standalone app; production config/workflow incomplete
REDIS: optional; local scaffold only
X.37 READY: NO, external provisioning required

DATABASE CHANGES: NONE
AUTH SETUP: NONE
KMS SETUP: NONE
PRIVATE KEYS: NONE GENERATED/IMPORTED/STORED
TRANSACTIONS/SIGNING/BROADCAST: NONE
MAINNET: NOT TOUCHED
AGENT 1816 / JOB 515: UNCHANGED
COMMIT/PUSH: NONE
```

## Verification

```text
pnpm typecheck: PASS (exit 0)
pnpm lint:      PASS (exit 0)
pnpm build:     PASS (exit 0)
pnpm test:      PASS (exit 0)
```

STOP after the X.40 report.
