# X.38 - Auth + Secure Session Custody Architecture

- Date: 2026-08-14
- Scope: read-only architecture audit to unblock X.37 persisted Altana sessions
- Repository changes: none to application/source/database configuration
- Blockchain activity: none
- Signing/broadcast: none
- Mainnet: not touched
- Agent 1816 / Job 515: unchanged
- Commit/push: none

## Executive Decision

X.37 cannot begin until four external/application foundations are selected and
approved:

1. Cryptographic wallet authentication and trusted server sessions.
2. PostgreSQL models, repositories and production migration deployment.
3. KMS/Vault/HSM-backed encrypted custody for session signer material.
4. A custody decision for the long-lived Altana admin/provider signer.

The recommended architecture is:

- **Authentication:** SIWE/EIP-4361 challenge verification using `viem` plus a
  maintained SIWE parser/validator, followed by opaque random database-backed
  sessions.
- **Database:** managed PostgreSQL using the existing Prisma 6.19.3 setup,
  pooled runtime connections and a separate direct migration connection.
- **Short-lived session signer custody:** managed KMS envelope encryption;
  PostgreSQL stores ciphertext and wrapped data-key metadata only.
- **Long-lived admin/provider key:** remote signer or HSM-backed custody,
  preferably outside Vercel. It must not become a plaintext or ordinary
  encrypted database row by convenience.
- **Redis:** optional support for short-lived challenges, locks, rate limits and
  idempotency; never the authoritative secret store.

No package, migration, auth route, environment variable, or secret mechanism was
added in X.38.

## Repository Baseline

### Application/runtime

- Next.js App Router: `apps/web/app/**`.
- Declared web version: `apps/web/package.json` declares Next `^15.0.3`.
- Lockfile version: Next `15.5.23`, React `19.2.8`, React DOM `19.2.8`.
- Node requirement: `>=20` in the root `package.json`.
- `apps/web/next.config.mjs` uses `output: "standalone"` and transpiles the
  workspace packages.
- No `middleware.ts`, `proxy.ts`, `vercel.json`, or `.vercel` project metadata.
- Root layout and `(app)` layout install no authentication provider or session
  guard. `(app)/layout.tsx` only renders `DashboardShell`.
- Existing client provider is TanStack Query only.

### Existing routes

Current route handlers include:

- `GET /.well-known/agent-registration.json`
- `POST /api/agents/bnb-testnet-risk/service`
- `POST /api/activation/hire`
- `POST /api/activation/aave-preview`
- `GET|POST /api/altana/session`

The X.36 `/api/altana/session` route returns a static public snapshot and uses
same-origin validation for its POST. Same-origin is useful transport/CSRF
defense, but it is not authentication or wallet ownership proof.

`apps/web/app/(app)/login/page.tsx` explicitly describes wallet authentication as
future work and renders a disabled wallet input. `TopNav` renders a disabled
Connect Wallet control.

### Existing dependencies

`apps/web/package.json` does not declare Auth.js/NextAuth, Better Auth, SIWE,
JOSE, iron-session, Privy, Clerk, Dynamic, WalletConnect, wagmi, or a database
client. It does declare Next, React, TanStack Query, Zustand, Zod and the Altana
SDK.

`viem` is available as a direct dependency of
`packages/integrations/package.json` and resolves to `2.55.11`, but it is not a
direct web dependency. Future web auth code must not rely on pnpm transitive
hoisting; add an explicit web dependency or expose a carefully scoped shared
server package.

## X.38A - Authentication

### Recommendation: SIWE/EIP-4361 + opaque database sessions

Use SIWE as the one-time proof that a user controls an EVM wallet, then issue a
conventional opaque server session. Do not use an Altana KeyStore session as the
marketplace login session; they are separate security domains:

- SIWE authenticates a human/user wallet to the marketplace.
- Altana sessions authorize an agent wallet to perform scoped operations.

### Why this fits

- Works with the existing EVM/viem stack and BNB Testnet chain 97.
- Does not require a hosted identity vendor.
- Supports immediate server-side logout and revocation.
- Lets database ownership checks bind a user, wallet, Altana wallet and
  Altana session.
- Works with Vercel Node route handlers and an external PostgreSQL database.
- Keeps auth cookies separate from Altana session signer material.

### Alternatives considered

**Auth.js/NextAuth with a credentials provider:** provides callbacks and session
plumbing, but adds framework complexity. JWT sessions are a poor default here:
they remain valid until expiry unless every protected operation performs a
revocation lookup. A database session adapter could work, but then the critical
SIWE nonce, wallet verification and ownership rules remain custom. Prefer the
smaller explicit SIWE route surface for this repository.

**Stateless signed/encrypted cookie:** avoids a database lookup but weakens
immediate revocation, wallet unlinking, concurrent-session control and audit
behavior. Not suitable for authorizing persisted Altana signer operations.

**Privy/Dynamic/Clerk/thirdweb or similar managed wallet auth:** can accelerate
wallet UX, but introduces vendor identity, hosted-token verification, cost and
lock-in. It still requires local user/session ownership and persistence. Select
one only if the product explicitly chooses managed identity.

### Proposed flow

#### `POST /api/auth/siwe/challenge`

1. Require JSON and exact trusted origin.
2. Generate at least 128 bits of randomness using Node `crypto`.
3. Construct the complete EIP-4361 message on the server. The browser may not
   choose domain, URI, nonce, chain, or timestamps.
4. Bind:
   - canonical production domain
   - canonical URI
   - chain ID 97 for the marketplace wallet flow
   - server nonce
   - issued-at
   - short expiration
   - request ID/statement
5. Store a hash of the nonce and exact message in PostgreSQL with a five-minute
   expiry and `consumedAt = null`.
6. Set a short-lived `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`
   `__Host-siwe_attempt` cookie containing an opaque attempt identifier.
7. Return only the exact message to sign.

#### `POST /api/auth/siwe/verify`

1. Require the attempt cookie, exact origin and JSON content type.
2. Load the stored challenge by a hash of the attempt token.
3. Strictly parse EIP-4361 and revalidate domain, URI, chain, nonce, issued-at,
   expiry and request ID.
4. Verify the wallet signature against the declared address. If contract-wallet
   login is required, support ERC-1271 using a chain-97 public client and define
   that policy explicitly; do not silently accept arbitrary contract addresses.
5. In one database transaction, atomically consume the challenge, upsert the
   normalized wallet/user, and create a new auth session. Concurrent reuse must
   allow exactly one consumption.
6. Generate a random 256-bit bearer token. Store only `SHA-256(token)`.
7. Set:

```text
__Host-bnb_session=<random-token>; HttpOnly; Secure; SameSite=Lax; Path=/
```

8. Return only public user/account state.

#### Trusted session helper

Implement server-only `requireSession()`:

1. Read the cookie.
2. Hash the bearer token.
3. Load an unexpired, unrevoked `AuthSession`.
4. Update `lastSeenAt` under an appropriate throttle.
5. Return `{ userId, walletId, walletAddress, chainId }` from the database, not
   from request JSON.

Every protected route must call this helper. Middleware may redirect based on
cookie presence, but must not be the authorization boundary and should not query
Prisma on every request.

#### Logout

`POST /api/auth/logout` must require the trusted session, exact origin and CSRF
token, atomically set `revokedAt`, clear the cookie with matching attributes,
and return `204`. Disconnecting an injected wallet alone does not log out the
server session.

### Replay/CSRF controls

- Challenge is single-use, hashed, short-lived and atomically consumed.
- SIWE binds origin/domain, URI, chain and time window.
- Authenticated mutations require exact `Origin`, JSON content type, a
  session-bound `X-CSRF-Token`, and reject cross-site Fetch Metadata when
  present.
- SameSite cookies are defense in depth, not the only CSRF control.
- Rotate the auth session after login and sensitive ownership changes.
- Rate-limit challenge and verify by IP and wallet identifier without logging
  signature or secret contents.

## X.38B - Database

### Existing configuration

- `prisma/schema.prisma` uses `prisma-client-js` and PostgreSQL via
  `env("DATABASE_URL")`.
- Declared Prisma versions are `^6.0.0`; lockfile resolves Prisma `6.19.3`.
- `prisma/package.json` provides `generate`, `migrate`, `migrate:deploy`,
  `db:push` and Studio scripts.
- There are no models and no migration directory.
- `docker-compose.yml` provisions local PostgreSQL 16 and Redis 7.
- Redis has no client dependency and is infrastructure scaffolding only.
- CI runs Prisma generate but does not apply migrations.

### Minimum models

The following is an architecture design, not a schema edit.

#### `User`

Fields:

- `id` UUID primary key
- `createdAt`, `updatedAt`, optional `deletedAt`
- optional `primaryWalletId`

Relationships:

- `User 1:N Wallet`
- `User 1:N AuthSession`
- `User 1:N AltanaSession`
- `User 1:N AuditEvent`

Indexes/constraints:

- index `createdAt`
- index `deletedAt`
- primary wallet relation must be named explicitly

Deletion:

- soft-delete users first;
- restrict deletion while wallet/session custody records exist;
- preserve audit events with nullable foreign keys.

#### `Wallet`

Fields:

- `id` UUID primary key
- `userId`
- `chainId`
- normalized lowercase `address`
- `status` (`active`, `revoked`, `deleted`)
- `verifiedAt`, `createdAt`, `updatedAt`, optional `deletedAt`

Constraints/indexes:

- unique `(chainId, address)`
- index `(userId, status)`
- index `address`
- migration-level check for supported chain 97 for the X.37 Altana path

Sensitive data:

- wallet address is public metadata after authentication;
- signature/challenge data is not retained beyond the necessary audit policy.

Deletion: logical deletion; restrict while sessions depend on the wallet.

#### `AltanaSession`

Fields:

- `id` UUID primary key
- `userId`, `walletId`
- `chainId` (must be 97)
- optional `agentId`
- `walletAddress`
- `publicKey`, `keyId`
- `status`: `pending`, `active`, `expired`, `revoking`, `revoked`, `failed`
- `keyStoreActive`
- `expiresAt`, `createdAt`, `updatedAt`, `verifiedAt`, `revokedAt`
- raw `$U` cap and usage as PostgreSQL `DECIMAL(78,0)` or canonical decimal text
- native fee cap as `DECIMAL(78,0)` or canonical decimal text
- registration/grant/revoke calls IDs and transaction hashes
- provider metadata JSON only if it contains no secrets

Constraints/indexes:

- unique `(chainId, keyId)`
- unique `(chainId, publicKey)`
- index `(userId, status)`
- index `(walletId, status)`
- index `(status, expiresAt)`
- index `expiresAt`
- partial unique index for one live session per wallet if concurrent sessions
  are not a product requirement
- migration checks for chain, nonnegative usage, and revoked-state consistency

Deletion: revoke on chain first; destroy secret; retain minimal public audit.

#### `SessionPermission`

Fields:

- `id`, `sessionId`
- `kind`: `call`, `token_spend`, `native_spend`
- optional `targetAddress`
- optional canonical `functionSignature`
- optional `tokenAddress`
- optional raw `limit`
- optional `period`
- `createdAt`

Constraints/indexes:

- index `(sessionId, kind)`
- uniqueness must account for PostgreSQL nullable fields; use migration-level
  `COALESCE` indexes or separate permission tables.

Deletion: cascade with the session after revocation policy permits.

#### `EncryptedSecret`

Fields:

- `id`, unique `sessionId`
- `ciphertext`
- `nonce`
- optional separate `authTag`
- optional `wrappedDataKey`
- `kmsKeyId`, `keyVersion`
- `algorithm`, `aadVersion`
- `createdAt`, `rotatedAt`, `destroyedAt`

Sensitive data:

- ciphertext is sensitive and must never be returned or logged;
- no plaintext private key, signer object or KMS credential belongs here.

Indexes: `(kmsKeyId, keyVersion)`, `destroyedAt`.

Deletion: cryptographically destroy/delete ciphertext after confirmed revoke.

#### `AuditEvent`

Fields:

- optional `userId`, `walletId`, `sessionId`
- `action`, `result`, `actorType`, optional `actorId`
- optional request ID, chain ID, calls ID, transaction hash
- public-safe metadata JSON
- `createdAt`

Indexes:

- `(userId, createdAt)`
- `(walletId, createdAt)`
- `(sessionId, createdAt)`
- `(action, createdAt)`
- `(result, createdAt)`
- `requestId`

Deletion: parent foreign keys `SetNull`; audit history is retained.

### Migration strategy

1. Create a managed PostgreSQL database for each environment.
2. Add models and a reviewed Prisma migration; use SQL migration statements for
   partial indexes/check constraints that Prisma schema syntax cannot express
   precisely.
3. Run `prisma generate` during CI/build as today.
4. Run `prisma migrate deploy` as a separate controlled release step using a
   direct migration connection, not during every serverless request.
5. Use a pooled runtime `DATABASE_URL` for Vercel and a separate direct
   `DIRECT_DATABASE_URL`/migration URL.
6. Never use local Docker credentials in production.
7. Add migration status and rollback/forward-fix procedures to deployment runbook.

## X.38C - Secret Custody

### Options evaluated

#### Managed KMS envelope encryption

Recommended for short-lived Altana session keys.

Flow:

1. Generate a per-record data key through KMS or generate it and wrap it with
   KMS.
2. Encrypt the session private key with authenticated AES-256-GCM using a
   unique nonce.
3. Store ciphertext, nonce/tag, wrapped data key, KMS key ID/version, algorithm
   and AAD version in PostgreSQL.
4. Bind AAD to session ID, user ID, wallet ID/address, chain 97 and key version.
5. On reconstruction, decrypt only in a Node server runtime, validate AAD and
   public-key equality, construct the SDK signer, perform the operation, and
   release references as soon as practical.

Advantages:

- separates database compromise from decryption permission;
- provides KMS audit logs;
- supports rewrap rotation without exposing plaintext private keys;
- fits Vercel Node route handlers through an external SDK/API call.

Limitations:

- decrypted short-lived signer material exists in Vercel memory during use;
- Vercel needs securely brokered cloud credentials;
- KMS adds latency, quotas and external failure modes.

#### Vault / HSM

Vault Transit is operationally similar to KMS: it can encrypt/decrypt, but the
Vercel process still receives plaintext if it constructs the Altana signer.
An HSM-backed remote signer/custody provider is stronger for long-lived admin
keys because the private key never enters Vercel.

Candidates such as HashiCorp Vault/HCP Vault, AWS CloudHSM, Turnkey, Fireblocks,
Coinbase Developer Platform or another compatible custody provider require
separate evaluation of Altana signer compatibility, API policy, cost, region,
availability and audit requirements. None is currently configured.

#### Platform environment secrets

Vercel environment variables are suitable for configuration and service
credentials, but are not a restart-safe encrypted database for per-user session
keys. They also do not provide per-record ownership, rotation, audit or revoke
semantics. Do not use them to store user session private keys.

### Recommendation

Use managed KMS envelope encryption for short-lived Altana session private keys,
with PostgreSQL as metadata/ciphertext storage. Use remote signer or HSM-backed
custody for the long-lived Altana admin/provider signer. This is a two-tier
design: Vercel may briefly reconstruct a scoped session key, but should not hold
the long-lived admin key.

Do not use Redis as the secret source of truth.

### Required external setup

Managed PostgreSQL:

- production provider such as Neon, Supabase, Railway, Render, AWS RDS or
  equivalent;
- pooled runtime connection;
- direct migration connection;
- TLS;
- separate runtime/migration roles;
- connection limits suitable for Vercel concurrency.

KMS example, if AWS is selected:

- AWS account;
- customer-managed symmetric KMS key and alias;
- key policy;
- runtime identity limited to `kms:GenerateDataKey`, `kms:Decrypt`,
  `kms:DescribeKey`;
- CloudTrail/audit logging;
- short-lived brokered credentials preferred over static Vercel access keys.

Potential server-only configuration names, not to be populated in X.38:

```text
DATABASE_URL=
DIRECT_DATABASE_URL=
AUTH_ORIGIN=
AUTH_SESSION_HASH_SALT=
KMS_PROVIDER=aws-kms
KMS_KEY_ID=
AWS_REGION=
AWS_RUNTIME_CREDENTIAL_BROKER=
ALTANA_ADMIN_CUSTODY_PROVIDER=
ALTANA_ADMIN_KEY_REFERENCE=
```

These names require final provider/auth review before adding to the env schema.
No `NEXT_PUBLIC_*` variable may contain any of them or their secrets.

## X.38D - Altana Session Persistence

### `createAltanaSession(authenticatedUser, policy)`

Server-only sequence:

1. `requireSession()` returns trusted `userId`, `walletId`, wallet address and
   chain; ignore any client-supplied wallet as authority.
2. Load the wallet record and require chain 97.
3. Load the admin signer from approved remote custody/HSM path.
4. Generate a session signer in memory.
5. Build exact target/signature, `$U`, native fee cap and bounded expiry policy.
6. Call Altana `client.grantSession({ register: false })`.
7. Call `client.registerSessionKey`.
8. Verify `isValidKey(wallet,keyId)` and public key/expiry/policy consistency.
9. Encrypt only the session private-key bytes via KMS envelope encryption.
10. Insert `AltanaSession`, normalized `SessionPermission` rows and
    `EncryptedSecret` in a transaction; record public operation metadata.
11. Return a public DTO only.

If persistence fails after chain registration, mark/repair the orphan through a
separately designed recovery workflow. Do not silently create another session.

### `loadActiveAltanaSession(authenticatedUser)`

Server-only return type:

```text
{ wallet, session, publicRecord }
```

Sequence:

1. authenticate with `requireSession()`;
2. locate by trusted user/wallet relation;
3. reject status other than active;
4. reject expired record;
5. verify key ID = `keccak256(publicKey)`;
6. read KeyStore `isValidKey` on chain 97;
7. decrypt only server-side with KMS and AAD;
8. reconstruct `signerFromPrivateKey`;
9. require reconstructed public key equals persisted public key;
10. reconstruct exact SDK `Session` object from persisted permissions/expiry;
11. return only to the server operation that needs it.

### `revokeAltanaSession(authenticatedUser)`

1. Require trusted auth and CSRF.
2. Atomically transition `active -> revoking` with an idempotency key.
3. Load/reconstruct the active session.
4. Verify KeyStore active.
5. Load admin signer from remote custody/HSM.
6. Call official `client.revokeSession` on chain 97.
7. Re-read KeyStore and require inactive.
8. Destroy/delete encrypted session secret.
9. Transition `revoking -> revoked`.
10. Write public-safe audit event.
11. Return public status only.

## X.38E - Vercel Deployment

### What can run on Vercel

- SIWE challenge/verify route handlers in Node runtime.
- Authenticated opaque-session lookup.
- Prisma runtime queries through a managed pooled PostgreSQL connection.
- Public permission DTO routes.
- KMS calls and short-lived decryption in Node runtime, provided the selected
  KMS integration supports secure server credentials.
- Revoke route, subject to request timeout, idempotency and custody-provider
  latency limits.

### What requires external infrastructure

- Production PostgreSQL. The local Docker PostgreSQL is not production.
- Managed KMS/Vault/HSM/custody provider.
- Authenticated cloud credential broker or tightly scoped runtime credentials.
- Production migration execution. Existing CI only runs Prisma generate; it does
  not run `migrate deploy`.
- Optional managed Redis for challenge/rate-limit/lock support. PostgreSQL can
  hold one-time challenges if traffic is modest and transactions are used.

### Vercel evidence and limitations

- `docs/review/Main-Track-Activation-X19-Deployment-Verification.md` records
  production origin `https://bnb-agent-marketplace-web.vercel.app`.
- No `vercel.json` or deployment metadata is checked into the repository.
- `next.config.mjs` uses standalone output; the Dockerfile is a separate Node 20
  deployment path and is not evidence of Vercel migration execution.
- Preview deployments must not issue production-domain SIWE messages. Bind auth
  to a canonical configured origin and either configure preview origins
  explicitly or disable auth there.

## X.38F - Security Model

### Wallet ownership

- Verify SIWE signature before creating `User`/`Wallet` ownership.
- Bind domain, URI, chain 97, nonce, time and statement.
- Normalize address once and compare with checksummed display only.
- Never trust a wallet address from revoke/session request JSON.
- Require authenticated `userId -> walletId -> AltanaSession` relationships.

### Session hijacking

- Store only SHA-256 of opaque auth bearer token.
- Use HTTP-only, Secure, SameSite cookies.
- Rotate after login and sensitive changes.
- Do not put Altana session public keys or secrets in bearer tokens.
- Do not return encrypted/decrypted signer material.

### Replay

- Hash and single-use SIWE challenge.
- Atomic challenge consumption.
- Short challenge expiration.
- SIWE issued-at/expiration and domain binding.
- Request idempotency for grant/revoke.

### CSRF

- Exact origin and JSON content type.
- Session-bound CSRF token for mutations.
- Fetch Metadata rejection for cross-site requests.
- SameSite cookie defense in depth.

### Unauthorized revoke/cross-user access

- `requireSession()` on every protected route.
- Query by trusted user ID and wallet relation.
- Compare persisted key ID/wallet/session ownership.
- Return generic not-found or forbidden responses without leaking existence to
  unrelated users.
- Lock/transition state to make concurrent revoke idempotent.

### Secret leakage

- No `NEXT_PUBLIC_*` secret.
- No private key, ciphertext, KMS credential, signer object or decrypted value in
  API response, logs, telemetry, audit metadata, browser bundles, error strings,
  query parameters or database JSON.
- Redact request/response logging for auth and custody routes.
- Separate runtime roles: public web, database migration, KMS/custody.

### Expired/revoked sessions

- Reject locally before decrypt/signing.
- Re-read KeyStore before revoke/execution.
- Treat KeyStore inactive as authoritative.
- Mark local expired/revoked state only with clear audit transitions.

### Database compromise

- Database contains metadata and ciphertext only.
- KMS permission is separate from database access.
- AAD prevents ciphertext transplantation between users/sessions.
- Disable KMS decrypt and revoke Altana sessions during incident response.

### KMS compromise

- Rotate/disable KMS key and runtime credentials.
- Revoke all affected Altana sessions.
- Re-enroll sessions under a new signer and key version.
- Review KMS audit logs and application logs.
- Use remote/HSM custody for long-lived admin keys to limit impact.

## X.38G - Permissions UI

Current `/permissions` is an X.36 public snapshot and not a live authenticated
per-user state surface. After X.38A-D it should call a protected read endpoint
that returns only:

- wallet address and associated agent ID;
- session status;
- KeyStore active status and last verification time;
- target addresses and canonical function signatures;
- `$U` limit, usage and remaining amount;
- native relay-fee cap;
- expiry;
- registration/revoke transaction status and public hashes.

The UI must show loading, stale, expired, revoked and unavailable states. Revoke
must require confirmation and call the authenticated revoke endpoint; it must
not accept a signer or wallet authority from the browser.

## X.38H - Verification Plan

### Authentication tests

- challenge has server-controlled domain/URI/chain/nonce/time;
- nonce is single-use and expires;
- invalid signature rejected;
- wrong domain/URI/chain rejected;
- concurrent verification consumes once;
- logout invalidates the server session;
- expired/revoked auth cookie rejected.

### Database/repository tests

- wallet address cannot be reassigned across users;
- cross-user session query returns no record;
- live-session uniqueness works;
- status transitions are atomic;
- migrations apply from empty PostgreSQL;
- `migrate deploy` is required in release procedure.

### Custody tests

- ciphertext differs across records/nonces;
- AAD mismatch fails closed;
- tampered ciphertext fails closed;
- KMS key ID/version persisted without plaintext;
- rotation rewraps without exposing plaintext to logs;
- deletion destroys secret and preserves public audit;
- signer public key must match stored public key after reconstruction.

### API/UI security tests

- unauthenticated access returns 401;
- user B cannot read/revoke user A;
- arbitrary client wallet substitution rejected;
- expired/revoked session rejected before decrypt/sign;
- responses contain no private key, ciphertext, signer, KMS or auth secret;
- browser bundle and client build contain no server-only secrets;
- CSRF/cross-origin mutations rejected;
- revoke is idempotent under concurrency.

## Implementation Plan

### X.38A Authentication

1. Approve SIWE library/version and add it explicitly to `apps/web`.
2. Add explicit web/server `viem` dependency or a server integration package.
3. Add auth env schema for canonical origin and server session settings.
4. Add challenge/verify/logout routes and trusted `requireSession()`.
5. Add wallet connect UI only after route tests pass.

External requirement: selected SIWE dependency and production auth origin.

### X.38B Database

1. Provision managed PostgreSQL.
2. Add User, Wallet, AuthSession, SiweChallenge and the six requested custody
   models (`AltanaSession`, `SessionPermission`, `EncryptedSecret`, `AuditEvent`)
   plus required auth session/challenge models.
3. Add migration-level checks and partial indexes.
4. Add repository methods and ownership transactions.
5. Configure pooled runtime and direct migration URLs.

External requirement: managed PostgreSQL account and migration credentials.

### X.38C Secret custody

1. Approve managed KMS provider and region/account.
2. Create customer-managed symmetric key and least-privilege runtime policy.
3. Define `SessionSecretCipher` interface and authenticated envelope format.
4. Add key ID/version/AAD metadata; no cryptography invented outside the
   approved provider/library.
5. Select remote/HSM custody for the long-lived admin signer.

External requirement: KMS account/key plus custody provider/admin key reference.

### X.38D Session persistence

1. Create only after auth, DB and custody are live.
2. Persist public policy/permissions separately from encrypted signer.
3. Implement atomic grant/registration/storage recovery states.
4. Return public DTO only.

External requirement: no additional blockchain action should occur until the
implementation has an approved recovery design for chain write followed by DB
failure.

### X.38E Session reconstruction

1. Implement `loadActiveAltanaSession(authenticatedUser)`.
2. Verify expiry, key ID, wallet ownership and live KeyStore state.
3. Decrypt/reconstruct only in server memory.
4. Assert reconstructed public key and policy equality.

### X.38F Authenticated revoke

1. Require trusted session and CSRF.
2. Lock active session and transition to revoking.
3. Load admin custody and call official `client.revokeSession` on chain 97.
4. Verify inactive, destroy secret, persist revoked/audit state.
5. Return public-safe status.

### X.38G Permissions UI

1. Add authenticated session list/detail DTOs.
2. Replace static snapshot loading with live user-scoped data.
3. Add revoke confirmation/result/stale states.
4. Ensure no secret-bearing server code crosses client boundaries.

### X.38H Security verification

1. Add unit/repository/route/UI tests above.
2. Add migration CI validation from empty PostgreSQL.
3. Add browser-bundle secret scans.
4. Add production-like KMS integration tests with a non-funded test key.
5. Only after all tests pass, schedule a separately approved chain-97 revoke
   verification. Never touch mainnet, Agent 1816 or Job 515.

## Final Report

```text
X.38 STATUS: ARCHITECTURE COMPLETE

AUTHENTICATION: NOT IMPLEMENTED; SIWE + opaque DB sessions RECOMMENDED
DATABASE: PostgreSQL + Prisma 6.19.3; models/migrations NOT IMPLEMENTED
SECRET CUSTODY: KMS envelope encryption RECOMMENDED; not configured
ADMIN CUSTODY: remote signer/HSM RECOMMENDED; not configured
VERCEL: Node route handlers viable; external DB/KMS/migrations required
X.37 UNBLOCKED: NO

TRANSACTIONS: NONE
SIGNING: NONE
BROADCAST: NONE
MAINNET: NOT TOUCHED
AGENT 1816 / JOB 515: UNCHANGED
SOURCE IMPLEMENTATION: NONE
DATABASE MIGRATION: NONE
AUTH SETUP: NONE
COMMIT/PUSH: NONE
```

## Local Quality Gates

```text
pnpm typecheck: PASS (exit 0)
pnpm lint:      PASS (exit 0)
pnpm build:     PASS (exit 0)
pnpm test:      PASS (exit 0)
```

STOP after the architecture report.
