# Main Track Activation — X.43 Trusted AuthSession Hardening

- **Date:** 2026-08-15
- **Layer:** Authentication / Session security (`apps/web/lib/auth/`, `app/api/auth/*`)
- **Base:** X.42 (SIWE login, PASS) — this report covers the AuthSession hardening built on top.
- **Scope:** Fixation protection, rotation, revocation, cookie/session policy, authorization boundary, constant-time CSRF, payload redaction. No KMS, no Altana sessions, no chain activity, no commit/push.

## X.42 Audit Findings (before this work)

| # | Finding | X.43 Resolution |
|---|---------|-----------------|
| A1 | Fresh token per login, but no rotation policy — old sessions stayed valid forever | Rotation: a new login for the same user revokes all prior live sessions (count audited) |
| A2 | No documented concurrent-session policy | Single active session per user, last login wins; other users unaffected |
| A3 | Logout CSRF compared with non-constant-time `!==` | `constantTimeEqual` (SHA-256 + `timingSafeEqual`) |
| A4 | Cookie options repeated/hardcoded in every route | Shared `cookie-policy.ts` is the single source of truth |
| A5 | Request helper never validated canonical URL/Host | `isCanonicalRequestOrigin` (parses `request.url`) + POST-only gate |
| A6 | Some 403/204 responses lacked `Cache-Control: no-store` | All error responses and the 204 logout carry `no-store` |
| A7 | `/me` and verify exposed DB UUIDs (userId/walletId/sessionId) | `PublicSessionInfo` — only wallet address, chainId, expiry |
| A8 | No resource-authorization helper | `walletBelongsToUser(identity, walletId)` in `session-core.ts` |
| A9 | No cleanup policy documented | Documented below (query-level filters; ops-level job later, no schema change) |
| A10 | No restart-safe integration test (P1001) | Offline 41-check matrix + `prisma validate/generate`; live integration BLOCKED |

## Implementation Changes

| File | Change |
|------|--------|
| `lib/auth/crypto.ts` | Added `constantTimeEqual` (hash-then-`timingSafeEqual`) |
| `lib/auth/cookie-policy.ts` | NEW — `sessionCookiePolicy`, `csrfCookiePolicy`, `attemptCookiePolicy`, `clearSessionCookies`; single definition of `__Host-` attributes (HttpOnly/Secure/SameSite=Lax/Path=/, no Domain) |
| `lib/auth/request.ts` | Added `isPostRequest`, `isCanonicalRequestOrigin`; `hasSafeMutationRequest` now also requires POST + canonical `request.url` origin |
| `lib/auth/types.ts` | Added `PublicSessionInfo`; `CompleteAuthenticationResult` carries `previousSessionsRevoked` |
| `lib/auth/prisma-store.server.ts` | `completeAuthentication` revokes all prior live sessions of the user (excluding the new session) inside the same transaction; `P2034` serialization conflict treated as `ownership-conflict` |
| `lib/auth/service.ts` | Surfaces `previousSessionsRevoked`; success audit records the revoked count |
| `lib/auth/session-core.ts` | Added `toPublicSessionInfo`, `walletBelongsToUser` |
| `app/api/auth/nonce/route.ts` | Uses `attemptCookiePolicy` |
| `app/api/auth/verify/route.ts` | Uses session/CSRF/attempt policies; returns `PublicSessionInfo` (no DB UUIDs) |
| `app/api/auth/logout/route.ts` | Constant-time CSRF compare; `no-store` on 403/204; clears all three cookies via policy; idempotent |
| `app/api/auth/me/route.ts` | Returns `PublicSessionInfo` instead of full identity |
| `lib/auth/auth.hardening.verify.ts` | NEW — 41-check offline X.43 verifier |
| `apps/web/package.json` | `test` runs X.42 + X.43 verifiers |

## Policy Documentation

- **Token:** 256-bit random (`randomBytes(32)` base64url); only SHA-256 hashes are stored/queried (`tokenHash`, `csrfTokenHash`); raw tokens exist only in-memory and in `__Host-` cookies.
- **Cookie:** `__Host-` prefix (Secure + Path=/ + no Domain required by browsers); session + attempt HttpOnly; CSRF cookie readable (JS needs it for the logout header); SameSite=Lax; Secure never weakened for tests/local.
- **Expiry:** `AUTH_SESSION_TTL_SECONDS` (default 604800 s, hard range 900–2592000) → fixed `expiresAt`; queries require `expiresAt > now` AND `absoluteExpiresAt > now`; `lastUsedAt` throttled to 5 min and never extends an expired session nor bypasses `revokedAt` (verified).
- **Rotation:** new login mints a fresh session token and revokes every other live session of the same user in the same transaction; revoked count written to audit (`SIWE_AUTH_SUCCESS.previousSessionsRevoked`).
- **Concurrency:** single active session per user (last login wins); sessions of other users untouched; each login's token is unique.
- **Authorization:** identity always derived server-side from the session (never client-supplied); `walletBelongsToUser` enforces resource ownership; ownership conflict at wallet level rejected with nonce preserved (X.42 behavior unchanged).
- **CSRF:** persisted `csrfTokenHash` + `__Host-bnb_csrf` cookie + `X-CSRF-Token` header, compared constant-time; Origin, canonical request URL, Fetch-Metadata, JSON content-type, POST-only, and ≤8 KB body (header + actual-read) guards.
- **Index/cleanup:** no new indexes/permissions, no schema change. Cleanup is query-level today (`revokedAt: null`, `expiresAt > now` filters); a future scheduled purge of expired/revoked `AuthSession`/`AuthChallenge` rows is an ops task, not a migration.

## Gate Results

| Gate | Result |
|------|--------|
| `prisma validate` (6.19.3) | PASS — schema valid |
| `prisma generate` (6.19.3) | PASS — client regenerated, no engine build errors |
| `prisma migrate status` | **BLOCKED — P1001: can't reach `localhost:5432`** (no local Postgres/Docker) |
| typecheck (`tsc --noEmit`) | PASS (exit 0) |
| lint (`eslint .`) | PASS (exit 0; 2 unused-import errors introduced then fixed) |
| build (`next build`) | PASS (exit 0; `/api/auth/{nonce,verify,logout,me}` all compiled, 160 B each, dynamic) |
| test | PASS — X.42 24 checks + X.43 41 checks (rotation×6, concurrency×1, expiry×2, throttle×1, revocation×3, redaction×2, ownership×2, cookie×8, constant-time×2, canonical×2, request×11, SIWE-intact×1) |

Security scans: no `privateKey/seedPhrase/mnemonic` in app code (only ephemeral in-memory test fixtures), no `NEXT_PUBLIC_*`, no `console.*` in app code, no `localStorage`/`sessionStorage`, no raw session tokens persisted, no bearer-token auth.

## Summary

```
X.43 STATUS: PASS

SIWE UNCHANGED................. PASS (X.42 24-check suite re-run, flow intact)
AUTH SESSION................... PASS (hash-only tokens, __Host- cookie policy, expiry, throttle)
SESSION ROTATION............... PASS (new login revokes prior sessions, count audited)
REVOCATION..................... PASS (paired token+CSRF, constant-time, idempotent logout)
AUTHORIZATION.................. PASS (server-side ownership, walletBelongsToUser, DB-id redaction)
POSTGRES INTEGRATION........... BLOCKED (P1001 localhost:5432 unreachable; validate/generate PASS)
KMS/ALTANA SESSION............. NOT STARTED (out of scope by design)
BLOCKCHAIN..................... NO TRANSACTIONS (nothing broadcast)
MAINNET/AGENT 1816/JOB 515..... NOT TOUCHED
```

Working tree intentionally left dirty/uncommitted; no push; no X.44 work started.
