# X.37 - Persisted Altana Session Management

- Date: 2026-08-14
- Status: **BLOCKED**
- Scope: authenticated encrypted persistence and restart-safe Altana revocation
- Chain activity: none
- Signing/broadcast: none
- Mainnet: not touched
- Agent 1816 / Job 515: unchanged
- Commit/push: none

## Executive Decision

X.37 cannot be securely implemented on the existing repository foundation.
The required stop condition applies: there is no working marketplace
authentication mechanism and no existing encrypted-at-rest secret persistence
or KMS/vault abstraction. Implementing a database-backed session signer now
would require inventing both identity and key management, contrary to the X.37
instructions and the repository's current security boundaries.

No session private key was persisted, encrypted or plaintext. No new session,
transaction, signing operation, or revocation was performed.

## AUTHENTICATION

**MISSING - BLOCKER**

Evidence:

- `apps/web/app/(app)/login/page.tsx`
  - `LoginPage` states: "Wallet authentication is implemented in the auth
    phase. For now this is a placeholder route."
  - Wallet input is disabled.
- `apps/web/components/top-nav.tsx`
  - Connect Wallet is disabled and marked Coming Soon.
- Repository search found no Auth.js/NextAuth, Better Auth, SIWE/EIP-4361,
  signature challenge, nonce store, signed-message verification, authenticated
  session cookie, JWT implementation, or auth middleware.
- Existing same-origin checks in the X.36 session route are CSRF/transport
  controls, not cryptographic user authentication.

Consequences:

- There is no trusted `user` object for `loadActiveAltanaSession(user)`.
- The server cannot cryptographically associate a browser user with the Altana
  wallet.
- Any API accepting a wallet address would permit arbitrary address
  substitution and must not be implemented.

Required infrastructure before implementation:

1. A selected, repository-standard authentication library or service.
2. Server-issued single-use nonce/challenge persistence.
3. Wallet signature verification (SIWE/EIP-4361 or an explicitly selected
   equivalent) binding origin, chain 97, nonce, issued-at and expiry.
4. Secure HTTP-only, SameSite session cookie with rotation and revocation.
5. Auth middleware returning a server-trusted user/account ID and verified
   wallet address.
6. Ownership checks that compare the authenticated account to persisted wallet
   ownership; never use a client-supplied address as proof.

## SESSION PERSISTENCE

**MISSING - BLOCKER**

Evidence:

- `prisma/schema.prisma` explicitly has no models.
- There is no `User`, `Wallet`, `Session`, `Permission`, encrypted credential,
  operation or audit model.
- No Prisma migrations directory exists.
- No repository/data-access layer exists for sessions.
- `DATABASE_URL` has a development default, but a connection string alone is
  not persistence architecture.
- X.36 `session.x36.public.ts` is static public evidence, not an active session
  store and contains no secret material.

Minimum schema required:

```text
User
  id
  authenticatedWalletAddress (unique)
  createdAt / updatedAt

AltanaWallet
  id
  userId (FK)
  chainId (must be 97)
  walletAddress (unique per chain)
  agentId (1816 association where applicable)
  createdAt / updatedAt

AltanaSession
  id
  userId / walletId (FK)
  chainId (97)
  publicKey
  keyId (unique)
  targetAllowlist JSON
  signatureAllowlist JSON
  tokenAddress
  tokenSpendLimitRaw decimal/string
  nativeFeeLimitWei decimal/string
  spentRaw decimal/string
  expiry
  status (pending/active/expired/revoking/revoked/failed)
  keyStoreActive
  registrationCallsId / registrationTxHash
  revokeCallsId / revokeTxHash
  createdAt / revokedAt / verifiedAt

AltanaSessionSecret
  sessionId (unique FK)
  ciphertext
  iv/nonce
  authTag
  encryptionKeyVersion
  algorithm/version
  createdAt / rotatedAt

AltanaSessionAudit
  sessionId / userId
  action / result
  callsId / txHash
  timestamp
  public-safe metadata only
```

The secret table must never contain plaintext private keys or serialized signer
functions.

## ENCRYPTION

**MISSING - HARD BLOCKER**

Evidence:

- Repository search found no encryption/decryption implementation,
  `createCipheriv`/`createDecipheriv`, envelope encryption, KMS, Vault, HSM,
  secretbox, key-versioning, or key-rotation service.
- `packages/config/src/env.ts` defines no session encryption key, KMS key ID,
  Vault configuration or secret-store contract.
- `.env.example` has no session encryption configuration.
- The existing `ALTANA_TESTNET_PRIVATE_KEY` is an operator admin key and is not
  an encryption key or multi-user secret store.

Per the X.37 stop condition, a new ad-hoc AES helper or plaintext database
column was not created.

Required infrastructure decision:

1. Select a managed envelope-encryption service (for example cloud KMS/Vault)
   or an established repository-standard secret-store library.
2. Define server-only configuration such as a KMS key identifier/endpoint and
   workload credentials; never `NEXT_PUBLIC_*`.
3. Encrypt a serialized session private key with an authenticated encryption
   algorithm and unique per-record nonce/data key.
4. Bind authenticated additional data to session ID, user ID, wallet address,
   chain 97 and key version.
5. Store ciphertext/nonce/tag/key version only.
6. Restrict decrypt permission to the server revoke/execution workload.
7. Implement rotation, audit, deletion and failure behavior.
8. Ensure errors/logs never include plaintext, ciphertext, env values or signer
   objects.

## SESSION RECONSTRUCTION

**NOT IMPLEMENTED - DEPENDS ON AUTH + DB + ENCRYPTION**

Required server-only contract after infrastructure exists:

```ts
loadActiveAltanaSession(authenticatedUser): Promise<{
  wallet: Wallet;
  session: Session;
  publicRecord: PublicAltanaSession;
}>
```

Required sequence:

1. Resolve authenticated user from server session, never request JSON.
2. Load session by trusted `user.id` and status.
3. Require stored wallet address equals authenticated wallet association.
4. Require chain ID exactly 97.
5. Reject expired, revoked, revoking or failed records.
6. Read `isValidKey(wallet,keyId)` from SDK `BNB_TESTNET.keyStore`.
7. Require public key hashes to stored keyId and KeyStore reports active.
8. Decrypt signer secret using KMS/vault on server.
9. Reconstruct with `signerFromPrivateKey`.
10. Require reconstructed signer public key equals stored public key.
11. Rebuild `Session` from the exact persisted permissions/expiry.
12. Return it only inside server code; expose a separately mapped public DTO.

## KEYSTORE VERIFICATION

**AVAILABLE, BUT NO ACTIVE PERSISTED SESSION TO LOAD**

- X.36 already implemented verified chain-97 KeyStore reads using the official
  SDK address.
- `isValidKey(wallet,keyId)` is read-only and can be reused.
- X.36 sessions are revoked and must not be reconstructed as active.
- X.37 performed no chain read requiring a signer and no transaction.

## REVOKE API

**NOT IMPLEMENTED - BLOCKED**

`POST /api/altana/session/revoke` cannot safely be implemented until a trusted
user and encrypted active-session record exist.

Required endpoint behavior after prerequisites:

1. Require authenticated server session and CSRF/same-origin protections.
2. Accept no wallet address, private key, session signer or public key from the
   browser as authority.
3. Call `loadActiveAltanaSession(authenticatedUser)`.
4. Lock/transition record `ACTIVE -> REVOKING` idempotently.
5. Re-read KeyStore active state.
6. Load the wallet admin signer from its separately approved custody mechanism.
7. Call official `client.revokeSession` on chain 97.
8. Persist callsId/tx hash/status without secret data.
9. Re-read `isValidKey == false` after confirmation.
10. Set `REVOKED`, remove/cryptographically destroy session signer ciphertext
    according to retention policy, and return only a public DTO.

No revoke transaction was submitted in X.37.

## PERMISSIONS UI

**CURRENTLY STATIC X.36 EVIDENCE; LIVE PERSISTED STATE BLOCKED**

- `/permissions` displays the verified public X.36 snapshot.
- It does not load authenticated per-user persistence because no auth/session
  store exists.
- It exposes no private key, encrypted secret, decryption key or signer.
- Once prerequisites exist, it must fetch only the authenticated user's public
  session DTO and display wallet, state, KeyStore state, targets/signatures,
  `$U` cap, native fee cap, usage, expiry and revoke status.

## RESTART TEST

**NOT IMPLEMENTED - BLOCKED BY ABSENT STORE/CRYPTO CONTRACT**

The meaningful test requires independently injectable interfaces:

```text
AuthenticatedUserProvider
AltanaSessionRepository
SessionSecretCipher / KMS client
AltanaKeyStoreReader
AltanaClientFactory
```

Then the test can persist encrypted signer bytes, destroy process memory,
construct a new service instance, load by authenticated user, verify public
metadata/key match, locate revoke inputs, and prove API serialization excludes
secrets without making a blockchain transaction.

An in-memory map or plaintext fixture would not demonstrate restart-safe secure
persistence and was not substituted.

## SECURITY TESTS

**NOT IMPLEMENTED - BLOCKED BY MISSING AUTH/ENCRYPTION IMPLEMENTATION**

Required tests after infrastructure selection:

- unauthenticated request -> 401
- user B cannot read/revoke user A session -> 404/403
- client-supplied wallet is ignored/rejected
- expired session rejected before decrypt/signing
- revoked session rejected before decrypt/signing
- public response deep-scan contains no plaintext/ciphertext/signer fields
- logger capture contains no private key/ciphertext/encryption env values
- built browser assets contain none of those values or server env names
- encryption key/KMS credentials never enter Next client bundles
- ciphertext tampering/AAD mismatch fails closed with generic error
- wrong reconstructed public key fails closed
- KeyStore inactive fails before revoke submission
- concurrent revoke is idempotent

## BLOCKERS

1. No cryptographic marketplace authentication or trusted user session.
2. No user/wallet/session persistence models or migrations.
3. No repository/data-access layer for sessions.
4. No encrypted-at-rest secret store, KMS, Vault or key-rotation mechanism.
5. No approved custody mechanism for restart-safe session signer recovery.
6. No persisted active session exists; X.36 sessions are intentionally revoked.

These are foundational dependencies, not small missing helpers. Implementing
them ad hoc would violate the instruction not to invent authentication or an
insecure secret mechanism.

## LOCAL QUALITY GATES

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS (exit 0) |
| `pnpm lint` | PASS (exit 0) |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | PASS (exit 0; existing offline X.36 policy suite) |

## FINAL REPORT

```text
X.37 STATUS: BLOCKED

AUTHENTICATION: MISSING
SESSION PERSISTENCE: MISSING
ENCRYPTION: MISSING
SESSION RECONSTRUCTION: NOT IMPLEMENTED
KEYSTORE VERIFICATION: AVAILABLE, NO ACTIVE PERSISTED SESSION
REVOKE API: BLOCKED
PERMISSIONS UI: STATIC X.36 PUBLIC EVIDENCE ONLY
RESTART TEST: BLOCKED
SECURITY TESTS: BLOCKED

BLOCKERS:
- cryptographic user authentication
- database schema/migrations/repository
- approved KMS/vault/envelope-encryption infrastructure
- active encrypted session record

TRANSACTIONS: NONE
SIGNING: NONE
BROADCAST: NONE
CHAIN WRITES: NONE
MAINNET: NOT TOUCHED
AGENT 1816 / JOB 515: UNCHANGED
COMMIT/PUSH: NONE
```

STOP. Secure persistence was not available, so no secret persistence was
implemented.
