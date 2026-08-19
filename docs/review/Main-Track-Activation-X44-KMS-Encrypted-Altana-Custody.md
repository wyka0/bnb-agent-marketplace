# Main Track Activation — X.44 KMS-Encrypted Altana Session-Signer Custody

- **Date:** 2026-08-15
- **Layer:** Custody infrastructure (`apps/web/lib/custody/`, server-only)
- **Base:** X.41 schema (`EncryptedSecret`, `AltanaSession`, `AuditEvent`), X.43 authentication ownership, X.40 AWS KMS decision
- **Scope:** Envelope-encrypted custody of an Altana session signer with AWS KMS. No production key, no production signer, no Altana session, no transactions, no commit/push.

## Architecture

```
lib/custody/
  index.ts               server-only entry (createAltanaCustody) — the ONLY module X.45 may import
  persistence.server.ts  server-only Prisma adapter (EncryptedSecret, AltanaSession, AuditEvent)
  kms/factory.ts         server-only provider factory (fail-closed selection)
  kms/aws-kms.ts         server-only AWS KMS provider (@aws-sdk/client-kms)
  kms/test-kms.ts        test-only adapter, same interface, throws in production
  kms/config.ts          pure env resolution (AWS_REGION / ALTANA_KMS_KEY_ID / ALTANA_KMS_PROVIDER)
  service.ts             pure repository core (encrypt/decrypt/destroy/rotate + audits)
  envelope.ts            envelope orchestration (DEK + AEAD + KMS wrap/unwrap)
  aead.ts                AES-256-GCM seal/open
  aad.ts                 canonical AAD encoding
  errors.ts              typed fail-closed error taxonomy
  types.ts               KmsProvider / CustodyPersistence / record contracts
  custody.verify.ts      offline 44-check verifier (runner-only)
```

Layers: pure core (offline-testable) → server-only entry (browser-proof via `server-only`). AWS SDK is externalized (`serverExternalPackages`).

## Envelope Encryption Flow

```
plaintext signer secret (memory only)
  → random 32-byte DEK per record (randomBytes)
  → AES-256-GCM seal(plaintext, DEK, AAD) with fresh 12-byte nonce
  → KMS Encrypt(DEK) → wrapped DEK (+ keyId/keyVersion/algorithm metadata)
  → PostgreSQL: ciphertext | nonce | authenticationTag | wrappedDataKey | kmsKeyId | kmsKeyVersion | algorithm | aadMetadata | aadVersion
  → plaintext and DEK discarded (references dropped; zeroization not guaranteed — documented limitation)

Decrypt:
  → record + ownership check
  → KMS Decrypt(wrappedDataKey) → DEK
  → AES-256-GCM open (tag verified before plaintext) with canonical AAD
  → plaintext exists ONLY in memory, used immediately, references discarded
```

Never stored: plaintext signer, privateKey, rawSecret, seedPhrase, DEK in plaintext (schema has no such columns; no code writes them).

## AEAD Choice

- **AES-256-GCM** (`node:crypto`) — standard AEAD, tag length 16 bytes, fresh random 96-bit nonce per encryption, no deterministic encryption, no plaintext fallback, auth failure fails closed (`AeadError`, `WrappedKeyCorruptionError`). Nonce/key reuse impossible by construction (fresh DEK + nonce per record).

## AAD Design

Deterministic canonical encoding (`aad.ts`), embedded version (`aadVersion=1`):

```
aadVersion=1
secretType=ALTANA_SESSION_SIGNER
userId=<uuid>
sessionId=<uuid>
chainId=97
```

Bound into the AEAD tag and mirrored in the `aadMetadata` Json column. Any change to context, format, or version breaks decryption. The Prisma adapter additionally validates the Json column on read (malformed → `RecordMalformedError`) and re-checks the context at the service layer (`AadMismatchError`) before KMS unwrap — ciphertext cannot be silently moved between users/sessions.

## KMS Abstraction

`KmsProvider` interface (`wrapDataKey`, `unwrapDataKey`, `getKeyMetadata`) implemented by AWS and test adapters. Business logic never touches the SDK — swap-in replacement of the provider does not touch Altana session logic. All KMS modules are server-only; no `NEXT_PUBLIC_*`.

## KMS Configuration

- `AWS_REGION` — region of the customer-managed key (server-only, optional in env schema, fail-closed in resolver)
- `ALTANA_KMS_KEY_ID` — key id/alias/ARN, consumed only (never provisioned by app code)
- `ALTANA_KMS_PROVIDER` — `aws` (default) | `test`; `test` is rejected in production by both `resolveKmsConfig` and the `TestKmsProvider` constructor
- `NEXT_PUBLIC_AWS_*` / `NEXT_PUBLIC_ALTANA_KMS_*` — forbidden (none exist)
- Env templates updated with names only: `AWS_REGION=`, `ALTANA_KMS_KEY_ID=`, `ALTANA_KMS_PROVIDER=aws`

## IAM Requirements (least privilege, documented only)

- **Application runtime role:** `kms:Encrypt`, `kms:Decrypt`, `kms:DescribeKey` on the specific key ARN — never `kms:*`, never resource `*`.
- **Migration role:** no KMS permission needed (schema migrations do not touch ciphertext).
- **Administrative KMS role:** key creation/rotation/deletion protection — out-of-band, separate role.
- **Credentials:** no long-lived AWS access keys in source. On Vercel, use the approved server-side mechanism (e.g. Vercel AWS-native integration supplying short-lived role credentials) configured through the server-only environment variables above; document it at deploy time. (Vercel runtime not provisioned in this milestone.)

## EncryptedSecret Schema (X.41, unchanged)

`sessionId` (unique, FK→AltanaSession), `secretType`, `ciphertext`, `nonce`, `authenticationTag`, `wrappedDataKey`, `kmsKeyId` (VarChar 512), `kmsKeyVersion` (VarChar 128), `algorithm`, `aadMetadata` (Json), `aadVersion` (Int), `createdAt`, `updatedAt`, `destroyedAt` — all X.44 requirements present. **No new columns added; no migration needed; `db push` not run.** No `privateKey`/`plaintextSecret`/`rawSigner`/`seedPhrase` columns exist.

## Repository/Service Design

`createAltanaCustody()` (server-only) → `encryptAltanaSecret`, `decryptAltanaSecret`, `destroyAltanaSecret`, `rotateAltanaSecret`. Encrypt returns record ID/metadata only; decrypt returns the buffer in memory only; destroy is a soft lifecycle mark (`destroyedAt`); re-encrypt after destroy replaces the record in place (schema is 1:1). No generic API endpoint ever returns the raw secret.

## Ownership Enforcement

Authorization derives exclusively from the X.43 authenticated session identity (`CustodyOwner.userId` passed by server code — never client-supplied). Every operation loads the `AltanaSession` and rejects `userId` mismatch (`OwnershipError`, audited `DENIED`). Context is additionally bound into AAD (`userId` + `sessionId` + `chainId`).

## Failure Behavior (all fail closed)

Missing/partial KMS config, unknown provider, test-in-production, KMS access denied, unknown/disabled key, wrapped-key corruption, ciphertext/nonce/tag corruption, AAD mismatch, ownership mismatch, destroyed secret, missing secret/session, malformed DB record → typed `CustodyError` (stable `code`), audit `FAILURE`/`DENIED` with IDs/status only, no plaintext fallback, no silent empty secret, no plaintext in logs.

## Rotation Design

Records persist `kmsKeyId` (key ARN) + `kmsKeyVersion` (ARN, AWS CMKs are not versioned; rotation = new key) at seal time. Old ciphertext stays decryptable while the configured key still exists. Procedure: decrypt with old provider → encrypt fresh (new DEK/nonce) with new provider → atomic `replaceCiphertext` last. Failure leaves the old record fully intact (verified) + `ALTANA_SECRET_ROTATION_FAILED` audit. Old material is never deleted before successful re-encryption. No automatic rotation from application code.

## Audit Events

`ALTANA_SECRET_ENCRYPTED`, `ALTANA_SECRET_DECRYPTED`, `ALTANA_SECRET_DECRYPT_FAILED`, `ALTANA_SECRET_DESTROYED`, `ALTANA_SECRET_ROTATION_STARTED/COMPLETED/FAILED` via X.41 `AuditEvent` (userId, sessionId, chainId, resourceType, safeMetadata). Never: plaintext, private key, DEK, session token, KMS credentials, ciphertext.

## Test Results (offline verifier, 44 checks — all PASS)

Round trip; unique nonce; non-deterministic ciphertext; tag validation; tampered ciphertext/nonce/tag/wrapped-DEK rejected; AAD mismatch (envelope + service); wrong user; missing secret; destroyed secret (+idempotent destroy, in-place re-encrypt); KMS access/unknown-key/corrupt failures fail closed (no record persisted on failure); missing/partial/unknown config fail closed; test provider allowed outside production; plaintext never persisted; DEK never persisted plaintext; raw signer never logged; server-only boundary (4 modules marker, no client component imports, app imports entry only); key metadata persisted; rotation completes/re-encrypts/audits, failure preserves old material; restart-safety (fresh provider + fresh service decrypt persisted record, no shared in-memory state); production guards ×2; audit content; stable error codes.

Gate results: `prisma validate` PASS, `prisma generate` PASS, typecheck PASS (exit 0), lint PASS (exit 0), build PASS (exit 0, all auth routes compiled), `pnpm test` PASS (X.42 24 + X.43 41 + X.44 44 checks). `migrate status` BLOCKED — P1001 `localhost:5432`.

## PostgreSQL Integration Status

**BLOCKED** — no local Postgres/Docker (P1001). The 44-check matrix runs against an in-memory persistence double implementing the exact `CustodyPersistence` contract (labeled test double; this is NOT claimed as a real database persistence pass). The Prisma adapter compiles, typechecks, and follows the verified X.41 schema; real persist→reload→decrypt verification remains for an environment with Postgres. `db push` not used; no fake DB success.

## Restart-Safety

Deterministic two-instance test: encrypt with provider/service A → drop all references → fresh provider/service B (no shared memory) decrypts the persisted record from the record store alone. Proves no in-memory crypto state is required for decryption. A true process-restart test was NOT run (no DB/KMS environment) — not claimed.

## Secret-Leak Scan

`privateKey | private_key | seedPhrase | mnemonic | rawSecret | plaintextSecret | sessionToken | AWS_SECRET | AWS_ACCESS_KEY | NEXT_PUBLIC_(AWS|ALTANA_KMS)` → **no matches** in `lib/custody` or `lib/auth`. `console.log` only in the test verifier's `PASS` lines. Fixture plaintext is explicit: `"fixture altana session signer — TEST ONLY, not a real credential"`. `.env.example` contains names only.

## Exact Limitations

- No real AWS KMS key provisioned or exercised (test adapter only) — `REAL KMS: NOT CONFIGURED`
- No real Postgres round trip (BLOCKED, P1001)
- No real process-restart test (deterministic substitute used)
- Node memory zeroization is not guaranteed — documented, references discarded
- No API routes expose custody; the service is infrastructure for X.45
- Rotation of production keys is out-of-band (manual), per design

## Summary

```
X.44 STATUS: PASS

KMS ABSTRACTION:           PASS (interface + factory, server-only, fail-closed selection)
ENVELOPE ENCRYPTION:       PASS (AES-256-GCM, fresh DEK/nonce, KMS wrap, hash-free custody)
ENCRYPTED PERSISTENCE:     PASS (schema + adapter) / real DB integration BLOCKED (P1001)
OWNERSHIP BINDING:         PASS (X.43-derived owner, session binding, AAD context)
ROTATION:                  PASS (implemented + failure-preserving, verified)
REAL KMS:                  NOT CONFIGURED (test adapter only; key provisioned out-of-band later)
REAL ALTANA SESSION:       NOT STARTED (X.45)
BLOCKCHAIN:                NO TRANSACTIONS
MAINNET:                   NOT TOUCHED
AGENT 1816:                NOT TOUCHED
JOB 515:                   NOT TOUCHED
COMMIT:                    NO
PUSH:                      NO
```

Working tree intentionally dirty/uncommitted. Stopping after X.44; X.45 not started.
