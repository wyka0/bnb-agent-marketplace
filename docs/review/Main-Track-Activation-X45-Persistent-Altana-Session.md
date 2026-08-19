# Main Track Activation — X.45 Persistent Altana Session

- **Date:** 2026-08-15
- **Layer:** Session lifecycle (`apps/web/lib/altana-session/`, server-only entry `index.server.ts`), product route + UI
- **Base:** X.44 KMS custody (`apps/web/lib/custody/`), X.43 auth ownership, X.42 SIWE, X.41 schema (`AltanaSession`, `SessionPermission`, `AuditEvent`, `EncryptedSecret`), X.36 demonstrated policy (unchanged constants)
- **Scope:** Restart-safe persistent Altana session lifecycle: grant → KeyStore register → custody-sealed signer → DB ACTIVE → restart reconstruct → policy-gated execute → revocation/reconciliation. No schema change, no production credentials, no chain-97 transactions, no commit/push.

## Architecture

```
lib/altana-session/
  types.ts             pure shared types — lifecycle union, store/adapter/custody contracts, DB enum mapping (no schema change)
  adapter.ts           real @altananetwork/sdk adapter (chain 97 only) + reconstructAdapterSession + keyIdOf (keccak256)
  adapter-fake.ts      offline mini-chain double (real signer crypto, synthetic Approval log, injectable failures)
  store.memory.ts      in-memory SessionStore (mirrors the Prisma boundary contract exactly)
  store.prisma.server.ts  server-only Prisma SessionStore (X.41 schema)
  service.ts           pure lifecycle core: create / load / execute / revoke + audits + spend accounting
  view.ts              permissions-safe public snapshot (the ONLY rendered shape)
  index.server.ts      server-only wiring — the ONLY module route handlers may import
  session.verify.ts    offline 25-check verifier (runner-only)

app/api/altana/session/route.ts   GET authenticated + DB-backed; POST same-origin operator idempotent API (unchanged semantics)
app/(app)/permissions/page.tsx    renders the public session view / blocked reasons
```

Layering identical to X.44: pure core (offline-testable) → server-only entry (browser-proof). `index.server.ts` wires Prisma store + SDK adapter (admin key from env, held in memory only) + X.44 custody + X.36 policy.

## Lifecycle State Machine

DB enum `AltanaSessionStatus` is reused as-is (PENDING/ACTIVE/EXPIRED/REVOKING/REVOKED/FAILED); the two PENDING-facing phases (creating / grantSubmitted) are distinguished in memory during create and reconciled as blocked after a crash — no SQL change (Postgres unreachable P1001, an enum extension would be untestable SQL).

```
creating → grantSubmitted → active
                         → failed        (any grant/registration/custody/persistence error; secret destroyed best-effort)
active   → expired | revoking → revoked (terminal)
```

Crash safety: every phase persists before the next broadcast (`creating` row exists before grant; `grantSubmitted` + granted key material persisted before KeyStore registration; ACTIVE only after register confirmed AND KeyStore `isValidKey`).

## KeyStore Authority + Reconciliation

KeyStore is authoritative on load (`isKeyStoreActive(wallet, keyId)`):

| DB | KeyStore | Action |
|---|---|---|
| ACTIVE | inactive | reconcile → REVOKED + audit `ALTANA_SESSION_RECONCILED_KEYSTORE_REVOKED`, blocked |
| REVOKED | active | blocked `session-revoked`, no re-registration |
| PENDING (crash leftover) | any | blocked `incomplete-grant` for operator review — never silently retried |
| ACTIVE | active, expired policy | transition EXPIRED + audit `ALTANA_SESSION_MARKED_EXPIRED`, blocked |

Expiry is re-evaluated against the current policy each load; `lastVerifiedAt` refreshes only on genuine online verification.

## Restart Safety

Persistence is the single source of truth: `sessionIdentifier` (a45:{chainId}:{walletId}:{ts36}:{rand}), `publicKey`, `keyId`, wallet, permissions rows, expiry, and spend accounting (`publicMetadata.spentRaw` / `lastSpentAt`) are all durable. After restart the signer is reconstructed from the custody-decrypted private key via `signerFromPrivateKey` — no re-grant, no duplicate KeyStore key. Deterministic restart-equivalent test: fresh service instance + fresh custody provider over the same store decrypts and reproduces a cryptographically identical signer (ECDSA-recovered public key matches the registered key).

## Execution Path

`executeAllowedOperation` gates every broadcast:

1. load (reconciliation above) must be `active`
2. policy check: `assertAltanaSessionPolicyCall` — exact target `0xc70B...E5565`, selector `approve(address,uint256)`, amount = `ALTANA_SESSION_APPROVAL_RAW (1)`, plus explicit zero-native-value guard (defense in depth: the integration helper does not check `value`)
3. cap check: `spentRaw + 1 ≤ spendLimitRaw` (1 raw unit/day) → else denied pre-broadcast
4. on-chain allowance read (`allowance(wallet, spender)`): if `allowance ≥ 1` the operation is already satisfied → `skipped-existing`, no broadcast
5. execute via session key → receipt status success AND `Approval(address,address,uint256)` log with the exact amount tail → spend accounting persisted atomically after confirmation

Native fee cap (10_000_000_000_000_000 wei/day) is enforced by policy + fake-chain validator; never enabled in the real path (native value always 0).

## Audit Events

`ALTANA_SESSION_CREATE_STARTED, GRANTED, KEYSTORE_REGISTERED, ACTIVATED, CREATE_FAILED, RECONSTRUCTED, RECONSTRUCT_FAILED, MARKED_EXPIRED, RECONCILED_KEYSTORE_REVOKED, EXECUTED, EXECUTION_SKIPPED, EXECUTION_DENIED, EXECUTION_FAILED, REVOKE_STARTED, REVOKED, REVOKE_FAILED` — userId/sessionId/chainId/tx hashes/safe metadata only; never keys, ciphertext, or secrets. Audits are best-effort (`safeAudit` can never break the lifecycle).

## Public View

`toPublicSessionView` is the only rendered shape: wallet, status, KeyStore active, expiry, verification timestamps, spend/remaining, permission list (with per-row period/caps), tx/calls ids. Never: `publicKey`, `keyId`, signer, private key, ciphertext, AAD, KMS metadata (verified by check 21).

## Test Results (offline verifier, 25 checks — ALL PASS)

1–2 create two-phase (PENDING row before broadcast; ends ACTIVE with KeyStore active + verified timestamp); 3 permission rows match the X.36 demonstrated policy exactly; 4 signer sealed + decrypt round-trips the granted key; 5 restart reconstruction; 6 reconstruction cryptography (recovered key == registered key); 7 permission round-trip; 8–11 policy non-broadening (foreign target/selector/amount/value); 12 first execution is a genuine confirmed session-key tx; 13 duplicate execution skipped (executeCount stays 1); 14 spend accounting persists (spent=1 remaining=0); 15 cap-exhausted denied without broadcast; 16 KeyStore-revoked reconciles to REVOKED without re-grant; 17 DB-REVOKED + KeyStore-ACTIVE blocked; 18 expired → EXPIRED + denied; 19 crash-left PENDING blocked, no re-grant; 20 cross-user isolation (load + decrypt); 21 public view clean of key material; 22 revoke destroys KeyStore key + sealed secret, idempotent second revoke; 23 ineffective revoke stays REVOKING with secret intact, blocked; 24 full-lifecycle SUCCESS audit trail; 25 registration failure → FAILED + audit.

Gate results: `prisma validate` PASS, `prisma generate` PASS, typecheck PASS (exit 0), lint PASS (exit 0), build PASS (exit 0; the Prisma client-engine page-data warning is the expected no-Postgres path, identical to X.43/X.44), `pnpm test` PASS (X.42 24 + X.43 41 + X.44 44 + X.45 25 checks). `migrate status` BLOCKED — P1001 `localhost:5432`.

## PostgreSQL Integration Status

**BLOCKED** — no local Postgres/Docker (P1001). The verifier runs against the in-memory store implementing the exact `SessionStore` contract (labeled test double; NOT claimed as a real DB pass). `updateSession` object shape `{id, patch, now}` is the store contract; the Prisma store round-trips `Decimal ↔ string`, derives `hasEncryptedSecret` from the `EncryptedSecret` 1:1 relation, and writes `AuditEvent` rows. Real persist→restart→act verification remains for a Postgres environment. `db push` not used; the responder reports P1001 at runtime (`/api/altana/session` → 503 persistence-unavailable).

## Restart-Safety Evidence vs. Limitation

Fresh-instance reconstruction passes (checks 5/6). A true OS process-restart test was NOT run (no DB/KMS environment) and is not claimed.

## Secret-Leak Scan

`privateKey | rawSecret | seedPhrase | mnemonic | sessionToken | ciphertext` → **no matches** outside typed interfaces and the verifier's regex test (which never prints values). No fixed 64-hex key literals in `lib/altana-session`; only public addresses (`0x299C...15C` fixture wallet, `0xc70B...E5565` token) and the public X.36 snapshot constants. `console.log` only in the verifier's PASS/FAIL lines. Root `.env.local` read names only, never values; the admin private key enters the adapter as an env string and is never logged.

## Exact Limitations

- No real PostgreSQL round trip (BLOCKED, P1001); store contracts exercised against the in-memory double
- `REAL KMS: NOT CONFIGURED` (X.44 test KMS only)
- No real chain-97 transaction run (no broadcast without an explicit user-gated pre-sign preflight)
- No real process-restart test (deterministic substitute used)
- Spend accounting is service-level (durable in DB), not on-chain enforced — on-chain guard is the 1-unit KeyStore policy itself

## Summary

```
X.45 STATUS: PASS (offline verification complete; live chain-97 run intentionally not executed)

LIFECYCLE:              PASS (create/grant/register/activate → restart reconstruct → execute → revoke, 25 checks)
KEYSTORE AUTHORITY:     PASS (reconciliation both directions, crash-left PENDING blocked, no silent retry)
PERSISTENCE:            PASS (contract + Prisma adapter) / real DB integration BLOCKED (P1001)
POLICY:                 PASS (X.36 constants unchanged; non-broadening verified 8–11, 15)
SECRET CUSTODY:         PASS (X.44 integration; signer sealed post-registration, destroyed on revoke/failure)
SPEND ACCOUNTING:       PASS (durable spentRaw/lastSpentAt, skip-existing, cap denial pre-broadcast)
PUBLIC SURFACE:         PASS (authenticated GET, permissions-safe view, no key material)
REAL KMS:               NOT CONFIGURED
REAL ALTANA SESSION:    NOT STARTED (no chain-97 transaction)
BLOCKCHAIN:             NO TRANSACTIONS
MAINNET:                NOT TOUCHED
AGENT 1816:             NOT TOUCHED
JOB 515:                NOT TOUCHED
COMMIT:                 NO
PUSH:                   NO
```

Working tree intentionally dirty/uncommitted. Stopping after X.45 per instructions.