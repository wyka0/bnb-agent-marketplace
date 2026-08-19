# Main Track Activation — X.47 Authenticated Altana Permissions + Revoke

- **Date:** 2026-08-15
- **Layer:** Authenticated API + UI for viewing Altana session permissions and for real key-store revocation — `apps/web/lib/altana-session/api.ts` (pure handlers), `app/api/altana/session/revoke/route.ts`, rewritten `app/api/altana/session/route.ts`, rewritten `app/(app)/permissions/page.tsx`, verifier `lib/altana-session/session.api.verify.ts`
- **Base:** X.46 live lifecycle (full chain-97 run: register/execute/revoke) + adapter fix; X.45 persistent session service/store/view + `revokeActiveSession`; X.44 KMS custody; X.43 auth (SIWE + CSRF cookie `__Host-bnb_csrf` / `x-csrf-token` / `hasSafeMutationRequest`)
- **Scope:** Authenticated permissions view with strict per-user ownership isolation (server identity authoritative; `sessionId` is selector-only, foreign ids indistinguishable from none); real SDK-based revoke endpoint behind CSRF/origin guards with idempotency, KeyStore-first reconciliation, 16-check read-only revoke preflight, REVOKING in-flight semantics, and safe error mapping; permissions UI with revoke UX. Testnet-only; test KMS only; NO new live transactions for UI testing; no commit/push.

## X.47 STATUS

```
X.47 STATUS: PASS

AUTHENTICATED VIEW:       PASS (401 unauthenticated; no-store; safe public view only)
OWNERSHIP ISOLATION:      PASS (User B cannot view/revoke User A; foreign sessionId = no session, no existence oracle)
REAL REVOKE PATH:         PASS offline (real revokeSession via adapter -> verified KeyStore inactive -> REVOKED + custody destroy)
REAL ALTANA REVOKE:       NOT PERFORMED (no new live tx; X.46 session already revoked; X.46 proved live revoke)
NEW BLOCKCHAIN TX:        NONE (apart from the API wrapping the X.45 real SDK revoke path, offline-verified)
CSRF / ORIGIN GUARDS:     PASS (403 on mismatch; GET / non-JSON / cross-site / bad JSON all rejected, zero broadcasts)
IDEMPOTENCY:              PASS (already-revoked / externally-revoked / REVOKING retry: no duplicate broadcasts)
RECONCILIATION:           PASS (KeyStore read is authoritative; DB never asserted; RECONCILED audited)
REVOCATION PREFLIGHT:     PASS (16/16 checks read-only before any broadcast; failures abort with 409 + DENIED audit)
EXECUTION AFTER REVOKE:   PASS (denied before broadcast; executeCount 0)
CLIENT TAMPERING:         PASS (permissions/cap/target/selector/sessionId in body ignored; server-side selection)
SECRET SURFACE:           PASS (view/audits/responses carry ids+status only; no key material, KMS material, or DB internals)
REAL KMS:                 NOT CONFIGURED (test KMS only, same as X.44-X.46)
POSTGRES:                 BLOCKED (P1001 no DB server; prisma validate P1012 missing env vars; generate OK)
COMMIT:                   NO
PUSH:                     NO
```

## Deliverables

- `lib/altana-session/api.ts` — pure GET/revoke handlers (offline-testable; route files are thin adapters): `getAltanaSessionApi` (401/200, selected-id after ownership check, VIEWED audit, no-store), `revokeAltanaSessionApi` (403 guards with `constantTimeEqual` CSRF; 400 action-only body; 404 no session; REVOKE_REQUESTED audit; already-revoked idempotent; failed 409; unconfirmed grant 409 no-broadcast; KeyStore read failure 502; KeyStore-inactive → reconcile + `reconciled:true` no tx; 16-check gate → 409 safe per-check message + REVOKE_FAILED DENIED; real `revokeActiveSession`; unconfirmed revoke → 502 "safe to retry", stays REVOKING), `altanaApiErrorMessage` (P1001 → 503 safe message, else generic 500; no Prisma/RPC/KMS/stack text anywhere)
- `app/api/altana/session/revoke/route.ts` — POST thin adapter (cookies → `__Host-bnb_csrf`, identity, error mapping)
- `app/api/altana/session/route.ts` — rewritten: same handler wiring, optional `sessionId` query param (selector-only after ownership)
- `lib/altana-session/service.ts` — added `resolveSessionStatus` display resolver (active = authoritative `loadActiveSession`; revoking/grantSubmitted/creating = live KeyStore re-read + reconcile-to-REVOKED when key inactive; terminal as-is), `loadSessionStatusForOwner`, `runRevokeSafetyGate` (16 read-only checks incl. live KeyStore re-read and `keyIdOf(publicKey) === keyId`), `safeStringify` (BigInt-safe policy scan for Job-515/Agent-1816/mainnet checks); exported `safeAudit`; existing real `revokeActiveSession` reused unchanged
- `lib/altana-session/view.ts` — PublicSessionView extended with `revokedAt` + `nativeFeeLimitRaw` (from NATIVE_SPEND row)
- `app/(app)/permissions/page.tsx` — rewritten: full X.47 permission fields (wallet, BNB Testnet, status meta incl. "Expired — revoke available" / "Reconciliation required", KeyStore Active/Inactive/Unknown, sessionId, `approve(address,uint256)`, spend cap/usage, native relay-fee cap, expiry, created, revoked, registration/revoke tx hashes with bscscan links); Revoke Session button with explicit confirm (disables current session, automated operations stop, BNB Testnet, does not modify Agent 1816 or Job 515), disabled for revoked/failed/busy/null, POST `{action:"revoke"}` with `x-csrf-token` from cookie; no secret material rendered
- `lib/altana-session/session.api.verify.ts` — 63-check offline verifier (memory store + fake adapter + test KMS), wired into `pnpm test` and `pnpm altana:session:api:verify`

## API/UI Security Cases (all 63 PASS)

- Unauthenticated GET → 401; authenticated GET → 200 safe view; field allowlist; no secrets/KMS material; no-store
- Owner A vs B isolation both directions; `sessionId` cannot cross the ownership boundary; owner resolves normally
- Real revoke path: SDK revoke via adapter → row REVOKED + revokedAt → custody secret destroyed → REVOKED audit with tx hash → response safe view + no-store
- CSRF mismatch / missing / cross-origin / cross-site fetch-metadata / non-JSON / GET / malformed JSON → 403/400, revokeCount stays 0
- Already-revoked → idempotent success, revokeCount 1 (no duplicate tx); wrong-user revoke → 404, no broadcast
- Expired: displays EXPIRED; KeyStore-live expired (and DB-EXPIRED + KeyStore-live) still real-revoked (preflight 8 permits cleanup)
- Externally-revoked (KeyStore inactive): reconcile to REVOKED with revokedAt + RECONCILED audit, zero transactions; same on GET (display reconciliation)
- 16-check preflight: all pass for live session; read-only; blocks failed state (check 6), keyId mismatch (check 15), tampered ownership (checks 3/5)
- Execution after revoke → denied BEFORE broadcast (executeCount 0)
- Client-crafted body (permissions/target/selector/spendCap/sessionId) fully ignored; rows unchanged; server-side session selection; crafted spend cap cannot alter stored policy
- P1001 → 503 safe message; arbitrary internals never leak into responses; all results no-store; no P1001/Prisma/stack text in bodies
- Audit trail: no ciphertext, no secret field names, no raw tokens; VIEWED/REVOKE_REQUESTED/REVOKE_STARTED/REVOKED present; gate denial records REVOKE_FAILED DENIED; unconfirmed grant → 409 no broadcast
- In-flight revoke (revokeIneffective): 502 + REVOKING (never REVOKED unverified); retry reconciles → REVOKED with exactly the second broadcast
- UI source: no custody/key material; no grant/execute endpoints; revoke button gated; confirm text covers scope/testnet/Agent 1816/Job 515; api.ts never serializes adapter/custody internals
- View carries no publicKey/keyId/hasEncryptedSecret

## Key Design Points

- Server identity from `getAuthenticatedUser()` is the ONLY ownership claim; browser userId/wallet/sessionId are never accepted; foreign `sessionId` GET returns the same `{session:null, load:{kind:"none"}}` as "no session" (no existence oracle) and wrong-user revoke returns 404
- Live KeyStore read is authoritative for reconcile (revoke API and display resolver) — never the DB flag, never the browser
- `runRevokeSafetyGate` is fully read-only; every failure path aborts before any broadcast and records `ALTANA_SESSION_REVOKE_FAILED` with the failing check ids
- REVOKING persists across an unconfirmed revoke; retry re-reads KeyStore first; REVOKED only after verified external revoke
- Single-session policy enforced server-side via `loadLatestForWallet` (X.43/X.45); revoking never touches another session

## Raw Transactions / Live Activity

- New live transactions for X.47: NONE. The revoke API wraps the X.45 real SDK `revokeActiveSession` (single `revokeSession` broadcast, confirmed, then custody destroy) — same code path already proven live in X.46 (revoke tx `0xda14cfc7b7dd4bcda5c6437296f334fae6413ba67b6587fd396fa880a70086fe`). User directive: X.46 session already revoked ⇒ no new session manufactured; offline fake-adapter verification + X.46 evidence stand in.

## Gates (re-run this session)

- typecheck: PASS (txs for the four X.47 files + wiring; two pre-existing-service fixes: `SessionRecord` type import; spread-widening in the revoke fallback record; page `csrfCookie` empty-value guard)
- lint: PASS (unused `sessionId` in the verifier removed)
- build: PASS (Next.js production build; `/permissions` included; Prisma client-engine page-data warning is the expected no-Postgres path)
- `pnpm test` (web): PASS, exit 0 — X.42 24 + X.43 41 + X.44 44 + X.45 25 + X.47 API 63 checks, all green (real-PostgreSQL persistence case inside the suites reports BLOCKED P1001 as designed)
- `prisma validate`: BLOCKED P1012 (DATABASE_URL/DIRECT_DATABASE_URL env vars absent from this shell — same root cause as P1001; schema unchanged since X.41)
- `prisma generate`: PASS (no DB required)
- `migrate status`: BLOCKED P1001 (no database server) — same as X.45/X.46

## Secret-Leak Scan

Scanned the X.47 diff (`api.ts`, `service.ts` additions, `view.ts`, `session.api.verify.ts`, both route files, `permissions/page.tsx`, `package.json`) for `privateKey/seedPhrase/mnemonic/rawSigner/sessionToken/AWS_SECRET/AWS_ACCESS_KEY/console.log/console.error`:
- All `privateKey/rawSigner/sessionToken/~console` hits in the verifier are deny-list ASSERTIONS (checks verify the API, UI, and audit trail NEVER expose those names) and the harness PASS/FAIL printer — same pattern as X.42–X.46 verifiers; no values printed
- `service.ts` `privateKey` hits are the pre-existing X.44/X.45 in-memory custody seal/unseal internals (unchanged this phase)
- `api.ts` responses and audit inputs carry ids/status only; session views expose no signer, ciphertext, wrapped key/AAD, KMS key id, or internal secret ids

## Exact Limitations

- Real PostgreSQL round trip still BLOCKED (P1001); persistence exercised via the in-memory store implementing the exact SessionStore contract (labeled stand-in)
- `REAL ALTANA REVOKE: NOT PERFORMED` — no new live session manufactured per directive; real SDK revoke path verified offline via the fake adapter and previously proven live in X.46
- `REAL KMS: NOT CONFIGURED` — test KMS only (X.44)
- X.46 residual stands: unreachable testnet KeyStore key from the first aborted X.46 run (tx `0xb6890…b258`), bounded to `approve(operator,1)` 1 raw unit, testnet-only, disclosed in the X.46 report

## Summary

```
X.47 STATUS: PASS (authenticated permissions + revoke, offline-verified 63/63)

AUTHENTICATED VIEW:            PASS (401 / safe public view / no-store)
OWNERSHIP ISOLATION:           PASS (server identity authoritative; no existence oracle)
REVOKE API:                    PASS (CSRF+origin guards; action-only body; idempotent; reconcile-first; 502-safe retry)
REVOKE PREFLIGHT (16 checks):  PASS (read-only; abort-before-broadcast; DENIED audit)
REAL SDK REVOKE PATH:          PASS offline (X.45 revokeActiveSession wrapped; live-proven in X.46)
REAL ALTANA REVOKE:            NOT PERFORMED (directive: no new session manufactured)
NEW BLOCKCHAIN TX:             NONE
CLIENT TAMPERING:              PASS (ignored body fields; server-side selection)
SECRET SURFACE:                PASS (no key/KMS/DB internals in view, audit, or errors)
POSTGRES:                      BLOCKED (P1001 / validate P1012 env gap / generate PASS)
REAL KMS:                      NOT CONFIGURED
MAINNET / AGENT 1816 / JOB 515: NOT TOUCHED
COMMIT:                        NO
PUSH:                          NO
```