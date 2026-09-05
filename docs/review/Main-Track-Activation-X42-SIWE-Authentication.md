# Main Track Activation - X.42 SIWE Authentication

## Status

| Capability | Status |
| --- | --- |
| SIWE | PASS (offline deterministic verification) |
| Authenticated user | PASS (implementation and offline store verification) |
| Auth session | PASS (implementation and offline store verification) |
| Live PostgreSQL-backed authentication | BLOCKED locally: PostgreSQL is unavailable (`prisma migrate status` returns P1001 for `localhost:5432`) |
| Altana session | NOT STARTED |
| KMS | NOT STARTED |
| Blockchain transactions | NONE |
| Mainnet | NOT TOUCHED |

X.42 implements marketplace wallet authentication only. It does not create a key, import/store a key, create an Altana session, call `grantSession`, execute/revoke a blockchain session, construct/broadcast a blockchain transaction, or modify Agent 1816 / ERC-8183 Job 515.

## Architecture

- `POST /api/auth/nonce` accepts a wallet address, normalizes it with `viem`, and server-constructs the exact EIP-4361 message.
- `POST /api/auth/verify` consumes only the attempt-cookie-bound, unexpired, unconsumed challenge after SIWE validation and EOA signature recovery.
- `GET /api/auth/me` obtains identity exclusively through the HTTP-only database session cookie.
- `POST /api/auth/logout` verifies a session-bound CSRF token, revokes the opaque session server-side, clears cookies, and is idempotent.
- `apps/web/lib/auth/prisma-store.server.ts` is the production-only Prisma adapter. Cookie/session handling is separate in `session.server.ts`; browser code cannot import Prisma.
- `apps/web/lib/auth/auth.verify.ts` covers the core with a disposable in-memory store and runtime-generated test accounts. No private key or signature fixture is committed.

The marketplace auth session is intentionally separate from Altana session custody and authority.

## Nonce and SIWE Flow

1. The client requests accounts through EIP-1193 and switches to BNB Testnet (`0x61`) when required.
2. It calls `POST /api/auth/nonce` with the selected address.
3. The server creates a 128-bit random nonce (`crypto.randomBytes(16)`), a 256-bit opaque attempt token, and a five-minute challenge.
4. The server persists only SHA-256 hashes of nonce/attempt/message. Challenge fields bind normalized lowercase address, chain `97`, canonical domain, canonical URI, issued time, and expiration.
5. The attempt token is set only in `__Host-siwe_attempt` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, five minutes). The response returns the exact message and public expiry, not a nonce or token.
6. The wallet signs only that exact SIWE message with `personal_sign`; no transaction RPC is available in the UI.
7. Verify parses the message with maintained `siwe` 3.0.0, compares all server-stored/canonical fields, requires version `1`, validates chain `97`, verifies time bounds and exact message digest, then recovers the EOA signer with `viem` 2.55.11.
8. The recovered signer must equal both the SIWE message address and persisted challenge address after normalization.
9. A Prisma transaction atomically consumes a still-live challenge, creates/fetches the wallet owner, and creates an opaque `AuthSession`. A concurrent replay can consume once only.

Contract-wallet (ERC-1271) authentication is deliberately not supported in X.42. It requires an explicit testnet RPC verification policy and tests before enabling.

## Ownership Rules

- Wallet addresses are normalized to lowercase before every persisted comparison.
- `(chainId, address)` remains unique in X.41; all X.42 rows use chain `97`.
- A first valid SIWE proof creates `User` and `Wallet`, setting `verifiedAt`.
- An active existing wallet keeps its existing `userId`; it is never reassigned from client input.
- A deleted/revoked wallet or deleted owning user produces `WALLET_OWNERSHIP_CONFLICT`; the nonce is preserved rather than burned prematurely.
- Ownership conflict is safely audited with no signature, token, or secret material.

## Session and Cookies

- Session token: random 256-bit `base64url` token. PostgreSQL stores only `SHA-256(token)` in `AuthSession.tokenHash`.
- Authentication session duration: `AUTH_SESSION_TTL_SECONDS`, server-only, default `604800` seconds (7 days), bounded to 15 minutes through 30 days. X.42 uses fixed expiry; no rolling/rotation behavior is added.
- `AuthSession` persists `createdAt`, `lastUsedAt`, `expiresAt`, `absoluteExpiresAt`, and `revokedAt` from the X.41 model.
- `__Host-bnb_session`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`, expiry equal to session expiry.
- `__Host-bnb_csrf`: random token with only its SHA-256 hash persisted. It is readable by same-origin browser JavaScript solely to send `X-CSRF-Token` for logout; it is also `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`.
- `getAuthenticatedUser()` is server-only. It hashes the cookie value, finds a chain-97 active/unexpired/unrevoked session, confirms active wallet and user, and throttles `lastUsedAt` updates to once per five minutes. It never returns a raw token.

`__Host-` requires HTTPS. Local browser login therefore needs HTTPS (or a browser-compatible secure-cookie development setup); this is intentional rather than weakening the production cookie contract.

## Request Security and Rate Limiting

- Every mutating auth endpoint is POST-only, requires `application/json`, validates exact `Origin` against server-only `AUTH_CANONICAL_ORIGIN`, rejects cross-origin Fetch Metadata when present, and caps request bodies at 8 KiB.
- Clients cannot choose SIWE domain, URI, nonce, timestamps, or chain. `AUTH_CANONICAL_ORIGIN` must be a bare origin; SIWE URI is `${origin}/login`.
- Logout additionally requires the browser CSRF value and matches its hash to the bound `AuthSession.csrfTokenHash` during revocation.
- PostgreSQL-backed issuance limits challenges to 10 per normalized wallet per 10 minutes and 1,000 globally per 10 minutes. No Redis dependency was introduced. X.43 should add IP-aware distributed limiting and operational alerting.

## Audit Events

- `SIWE_NONCE_CREATED` / `SUCCESS`
- `SIWE_AUTH_SUCCESS` / `SUCCESS`
- `SIWE_AUTH_FAILURE` / `FAILURE`
- `WALLET_OWNERSHIP_CONFLICT` / `DENIED`
- `AUTH_LOGOUT` / `SUCCESS` or `DENIED`

Audit data contains only normalized wallet identity, chain, public identifiers, and safe reason/boolean metadata. It never includes private keys, seed phrases, bearer/session tokens, SIWE signatures, credentials, or KMS data.

## Frontend

- Replaced `/login` placeholder with a connected-wallet SIWE flow.
- Replaced disabled Connect Wallet placeholders in top/home navigation with auth controls showing connected address, auth state, and logout.
- The browser wallet surface only invokes `eth_requestAccounts`, `eth_chainId`, optional `wallet_switchEthereumChain` to BNB Testnet, and `personal_sign` for the SIWE message. It does not invoke `sendTransaction`, `eth_sendTransaction`, `signTransaction`, or contract/session methods.
- Login does not expose or create an Altana session.

## Dependencies

Added explicitly to `apps/web` (not relying on transitive packages):

- `siwe` `3.0.0` for maintained EIP-4361 parsing/message construction.
- `viem` `2.55.11` for address normalization and EOA signature recovery.
- `@bnb-marketplace/prisma` workspace dependency for the server-only adapter.
- `server-only` `0.0.1` for explicit server module boundaries.

`pnpm-lock.yaml` was updated. No unrelated packages were upgraded.

## Tests and Verification

| Command | Result |
| --- | --- |
| `pnpm prisma:generate` | PASS - Prisma Client 6.19.3 generated |
| `pnpm --dir prisma exec prisma validate` | PASS |
| `pnpm typecheck` | PASS - 14/14 Turbo tasks |
| `pnpm lint` | PASS - 14/14 Turbo tasks |
| `pnpm build` | PASS - 8/8 Turbo tasks |
| `pnpm test` | PASS - 8/8 Turbo tasks |
| X.42 offline auth verifier | PASS - 24 checks |
| Existing Altana session verifier | PASS - 10/10 checks |
| `prisma migrate status` / live database auth | BLOCKED - P1001, local PostgreSQL unavailable |

The X.42 verifier covers nonce persistence/entropy/expiry, canonical message construction, wrong domain/URI/chain/nonce, expired challenge, invalid signature, signer mismatch, successful authentication, ownership creation/conflict, one-time nonce use, token hashing/no raw token audit persistence, authenticated-user lookup, last-used timestamp, expired/revoked sessions, logout, and idempotent logout.

Build warnings remain pre-existing: the Altana SDK/`ox` dynamic dependency warning and Next ESLint plugin detection warning. The initial Prisma engine warning caused by eager route inspection was eliminated by lazy server imports; the final build has no Prisma engine error.

## Security Review

Final auth-diff searches found:

- No persisted `privateKey`, `seedPhrase`, `mnemonic`, raw secret, plaintext token, production credential, hardcoded signature, or `NEXT_PUBLIC_` auth secret.
- `privateKeyToAccount` exists only in the offline verifier with `generatePrivateKey()` at runtime; it does not read/store/print a key.
- No browser Prisma imports; production Prisma use is behind `server-only` modules and lazy server imports.
- No transaction sending, arbitrary transaction signing, broadcasts, KMS, Altana session creation, or mainnet configuration was added.

## Remaining X.43 Requirements

1. Verify `prisma migrate deploy` and the full HTTP nonce/verify/logout lifecycle against an ephemeral PostgreSQL service in CI or a controlled local environment.
2. Add distributed IP-aware rate limiting, monitoring, abuse thresholds, and challenge cleanup/reaper operations.
3. Define/test ERC-1271 policy if contract wallet sign-in is a product requirement.
4. Add protected-route adoption using `getAuthenticatedUser()`; existing unrelated routes are intentionally not changed by X.42.
5. Consider session rotation and sensitive ownership-change flows after explicit product/security review.

No commit and no push were performed. Stop at X.42.
