# X.48 Security + Production Audit

- **Date:** 2026-08-15
- **Layer:** Read-only security and production-readiness audit of the marketplace prior to X.49 infrastructure provisioning
- **Base (historical evidence):** X.41–X.47 milestone reports, each re-verified against the current source tree
- **Scope:** Full repo audit per X.48 charter. AUDIT ONLY: no blockchain transactions, no session create/grant/revoke, no infrastructure provisioning, no secret exposure, no dependency upgrades, no commit/push.

## Executive Verdict

```
X.48 STATUS: PASS WITH FINDINGS

No CRITICAL findings. The auth (X.42/X.43), custody (X.44), Altana session
(X.45–X.47) stack is coherent, server-bounded, and internally consistent
with its milestone reports — all major claims re-verified against source.
Four HIGH findings require attention before/alongside X.49 production
deployment (security headers, global rate limiting, dependency
vulnerabilities, spend-cap concurrency race). PostgreSQL live verification
remains BLOCKED (P1001); REAL KMS remains NOT CONFIGURED.
```

## Milestones Audited

| Milestone | Verdict vs current source |
|---|---|
| X.41 PostgreSQL/Prisma foundation | CONFIRMED — schema, migration SQL (FK semantics, chain-97 CHECK constraints, spend-cap CHECK, revokedAt-consistency CHECK, partial unique index), server-only Prisma client (with one marker gap, L-1), env plumbing all present. `prisma migrate status` BLOCKED P1001 (unchanged). |
| X.42 SIWE authentication | CONFIRMED — 24-check verifier green; nonce/attempt/SIWE mechanics, EOA-only recovery, ownership rules, rate limits all match code. |
| X.43 trusted session hardening | CONFIRMED — 41-check verifier green; rotation, cookie policy single source, constant-time CSRF, DB-id redaction all match. `absoluteExpiresAt` mechanism is dormant (equal to `expiresAt`; documented fixed-expiry policy). |
| X.44 KMS custody | CONFIRMED — 44-check verifier green; AES-256-GCM envelope, fresh DEK/nonce, AAD binding, fail-closed taxonomy, test-provider-in-production double guard, rotation failure preservation all match. REAL KMS: NOT CONFIGURED (test KMS only). |
| X.45 persistent Altana session | CONFIRMED — 25-check verifier green; state machine, KeyStore-authority reconciliation, restart reconstruction, policy gating, spend accounting all match. Two nuances found (M-1 lifetime-not-daily app accounting; I-13 value-cap semantics). |
| X.46 live Altana E2E | CONFIRMED as historical evidence (live chain-97 tx inventory in the X.46 report). Not re-executed (X.48 boundary: no transactions). |
| X.47 authenticated permissions + revoke | CONFIRMED — 63-check API verifier green; ownership isolation, CSRF/origin guards, 16-check revoke preflight, reconcile-first semantics, safe public view all match. |

## Critical Findings

None.

## High Findings

### H-1 — No global security response headers
`apps/web/next.config.mjs` defines no `headers()` at all — no CSP, HSTS, X-Content-Type-Options, X-Frame-Options / frame-ancestors, Referrer-Policy, or Permissions-Policy anywhere. The app deliberately ships a JavaScript-readable CSRF cookie (`__Host-bnb_csrf`, double-submit pattern), so the primary XSS mitigation is the mere absence of XSS sinks. With a JS-readable CSRF token, a single XSS would allow reading the CSRF cookie and forging authenticated mutations (logout/revoke) and authenticated reads. Defense-in-depth is currently zero at the HTTP layer.
Evidence: `apps/web/next.config.mjs` (no headers config); `lib/auth/cookie-policy.ts:26-28` (CSRF cookie intentionally readable).

### H-2 — Missing rate limiting on all sensitive endpoints beyond nonce issuance
The only rate limit in the codebase is on `POST /api/auth/nonce` (10/wallet/10 min + 1,000 global/10 min, DB-window based; `lib/auth/service.ts:40-50`). None of the following are limited:
- `GET /api/altana/session` — every call performs live KeyStore RPC reads + DB round trips;
- `POST /api/altana/session/revoke` — each retried unconfirmed revoke re-broadcasts a relay transaction (gas-consuming for the service wallet; idempotent on-chain but economically real);
- `POST /api/activation/hire` — unauthenticated; 1 outbound 8004scan fetch per request;
- `POST /api/activation/aave-preview` — unauthenticated; ×4 outbound HTTP amplification per request (manifest + initialize + tools/list + tools/call);
- `POST /api/agents/bnb-testnet-risk/service` — unauthenticated public RPC balance oracle.
Auth is not a throttle: an authenticated client can DoS the BNB testnet RPC, the database pool, and the 8004scan/Aave upstream quotas.
Evidence: `app/api/altana/session/route.ts`, `app/api/altana/session/revoke/route.ts`, `app/api/activation/hire/route.ts`, `app/api/activation/aave-preview/route.ts`, `app/api/agents/bnb-testnet-risk/service/route.ts`.

### H-3 — Known vulnerabilities in the runtime dependency tree
`pnpm audit` (lockfile v9, run 2026-08-15, no upgrades performed per X.48 boundary): **5 vulnerabilities — 3 high, 2 moderate**, all transitive under `next@15.5.23`:
- `sharp@0.34.5` (via next) — patched in `>=0.35.0`; sharp is used by Next.js image optimization at runtime, so crafted image input is a runtime vector;
- `postcss@8.4.31` (via next) — 4 advisories (GHSA-qx2v-qp2m-jg93 and three more; patched in 8.5.10 / 8.5.12 / 8.5.18 / 8.5.23 range, incl. incomplete source-map fix allowing attacker-controlled `.map` reads when `from` is unset). Build-time surface primarily.
Resolution requires a Next.js upgrade (or pnpm resolution overrides) — intentionally NOT performed during the audit.
Evidence: `pnpm audit` output; `apps/web > next@15.5.23 > {sharp,postcss}`.

### H-4 — Spend-cap check-then-act race in `executeAllowedOperation` (flagged per charter)
The cap check and accounting are not atomic: `executeAllowedOperation` reads the record snapshot, checks `spentRaw + 1 <= spendLimitRaw` in memory, broadcasts, then writes `spentRaw = snapshot + 1` unconditionally — no database transaction, no conditional update, no row lock (`apps/web/lib/altana-session/service.ts:383-430`). Two truly concurrent executions can both read `spentRaw=0`, both pass the cap check, and both broadcast; the second write is a lost update. Impact is bounded: the only permitted operation is `approve(self, 1)`, which is idempotent in on-chain effect (an absolute allowance of 1), the pre-execution `allowance` read serializes subsequent calls, and no HTTP route exposes execution today. Nevertheless, per the X.48 charter ("If two requests can execute simultaneously and bypass the cap, flag it HIGH"), the in-app invariant "≤ cap executions" is race-vulnerable.
Fix direction (X.49): conditional `UPDATE ... WHERE publicMetadata->>'spentRaw' = :snapshot` or a serializable transaction around check+execute+account; or move the cap guard fully to the on-chain KeyStore spending-limit semantics.

## Medium Findings

### M-1 — "Per-day" spend cap is lifetime in application logic
The X.36/X.45/X.46 policy is documented as "1 raw unit/day". Application-side accounting (`publicMetadata.spentRaw` + `lastSpentAt`) writes `lastSpentAt` on every successful execution but **never reads it anywhere** — there is no daily window, no reset, and no timezone logic in app code. Consequently the app-side cap is lifetime (after one execution the app permanently denies further executions for the session). The true "day" semantics exist only in the on-chain KeyStore session permission object (SDK-enforced). Reports that imply app-side daily reset are false.
Evidence: `lib/altana-session/service.ts:425-430` (write only); grep `lastSpentAt` → single write site, zero reads.

### M-2 — CI does not run the test suite or security gates
`.github/workflows/ci.yml` jobs: install, lint, typecheck, build, format-check only. **No `pnpm test` job** (the X.42–X.47 verifier chain runs only manually), no `pnpm audit` job, no prisma migrate status/deploy step, no secret/leak scan step. Regressions in the 197 offline security checks can merge undetected. (prisma generate IS run in typecheck/build jobs.)

### M-3 — Supply chain: CI installs run postinstall scripts without an allowlist
CI uses `pnpm install --frozen-lockfile` without `--ignore-scripts`, and the workspace defines no `onlyBuiltDependencies` / `ignoredBuiltDependencies` in `pnpm-lock.yaml`, so dependency lifecycle/postinstall scripts execute in CI. The Dockerfile correctly uses `--ignore-scripts`; CI does not match it.

### M-4 — Single-live-session enforcement is DB-only and lives outside the schema
The partial unique index `AltanaSession_one_live_per_wallet_idx` (single live session per wallet for PENDING/ACTIVE/REVOKING) exists **only in raw migration SQL** (`prisma/migrations/202608150001…/migration.sql:177-179`), not representable in `schema.prisma`. Consequences: (a) `prisma db push` would silently drop it; (b) there is no application-level duplicate-creation check before insert (`createAltanaSession` never calls `loadLatestForWallet` first); (c) a concurrent duplicate create propagates Prisma `P2002` raw from outside the service's try/catch (untyped for callers). No duplicate ACTIVE row is ever insertable, but the enforcement layer is fragile.

## Low Findings

- **L-1** — `prisma/src/client.ts` does NOT `import "server-only"`; browser safety of the Prisma client relies solely on the `"browser": { "./dist/client.js": false }` map in `prisma/package.json`. X.41's "server-only" claim is satisfied only by packaging, not by the marker. Defense-in-depth gap.
- **L-2** — `readJson` (`lib/auth/request.ts:43-50`) buffers the full request body via `request.text()` *before* re-measuring against the 8 KiB cap; a chunked request without `Content-Length` passes the header gate and is fully buffered before rejection (memory-DoS surface; mitigated by upstream/proxy limits in production).
- **L-3** — `/api/activation/hire` and `/api/activation/aave-preview` enforce body size via `Content-Length` header only, then `request.json()` without re-measure (chunked bodies bypass). Contrast: `bnb-testnet-risk` and auth `readJson` do re-measure.
- **L-4** — Nonce-issuance rate-limit rejections are not audited (`SIWE_NONCE_RATE_LIMITED` does not exist; the limit throws before any audit write), weakening abuse forensics (X.42 explicitly deferred this; still absent).
- **L-5** — `aave-preview` fully buffers the upstream response before applying the 1 MB length cap (bounded by the 8 s timeout, but adversarial upstream/MITM can push >1 MB through memory once).
- **L-6** — `AUTH_CANONICAL_ORIGIN` accepts any origin (including `http://` and foreign hosts) with only shape validation; a misconfiguration silently rebinds SIWE domain/URI/Origin checks. Chain stays pinned 97. Operational risk, not a code defect.
- **L-7** — 8004scan client validates the response envelope (`success===true && Array.isArray(data)`) but normalizes individual records without per-field schema validation (weaker than the TermiX/PancakeSwap modules).
- **L-8** — `seal()` in `lib/custody/aead.ts:16-19` accepts an optional nonce parameter ("tests only"): a future caller could inject a deterministic nonce. No production caller supplies one.
- **L-9** — `createSessionService()` rebuilds the SDK client, viem public client, KMS provider, adapter, and in-memory admin signer on every Altana route request (functionally safe; wasteful, and enlarges per-request setup cost / in-memory key residency).

## Informational Findings

- **I-1** — Reverse mismatch (DB-REVOKED + KeyStore still active) is blocked correctly but NOT audited (the service header comment implies "reported"); one-directional reconciliation (KeyStore authoritative downward) is by design and verified.
- **I-2** — `GET /api/altana/session` has write side effects (expiry transition, KeyStore reconciliation, audits). Directed toward blocked/revoked only for the caller's own session; documented.
- **I-3** — `absoluteExpiresAt` is written equal to `expiresAt` (dual-expiry mechanism dormant; documented fixed-expiry policy).
- **I-4** — `findActiveSession` does not filter the `AuthSession` row by `chainId`; it hardcodes 97 in the returned identity (convention-safe; all sessions created with 97 and DB CHECK enforces it).
- **I-5** — Decrypt-side AAD is re-derived with the stored `aadVersion` and `aadMetadataMatches` does not compare versions; cryptographic failure still fail-closed (no exploit).
- **I-6** — Soft destroy retains ciphertext until out-of-band purge (documented X.44 design); destroyed records cannot decrypt.
- **I-7** — `@altananetwork/sdk` is not in `serverExternalPackages` (bundled into the server bundle); no defect observed.
- **I-8** — Client component `marketplace-view.tsx` imports pure helper exports from the server-labeled 8004scan catalog module → server-labeled code lands in the browser bundle; env key is read at call time inside functions never invoked client-side, so no secret is inlined (verified: browser bundle contains zero `process.env` reads and no env values — see I-12).
- **I-9** — `.well-known/agent-registration.json` HTTPS gate reads `request.url` protocol with no `X-Forwarded-Proto` handling (breaks behind scheme-stripping proxies; dev-locked by design); `no-store` on a well-known doc is conservative.
- **I-10** — x7-*.mjs dev scripts read the populated root `.env.local` (git-ignored) and send `8004SCAN_API_KEY` to the 8004scan API; dev-only, not shipped.
- **I-11** — `docker-compose.yml` dev services use trivial credentials (`postgres/postgres`) — local development only.
- **I-12** — One production `.next` browser chunk contains the literal string `8004SCAN_API_KEY` from a documentation comment in the bundled eight004scan code. No env VALUE and no `process.env` reference ships to the browser (per-pattern artifact scan).
- **I-13** — `assertAltanaSessionPolicyCall` bounds native `call.value` against the token spend cap rather than `nativeFeeLimitWei`; harmless — constructed calls always carry `value: 0n` server-side, and the real native fee cap is enforced by the on-chain session permission.
- **I-14** — No Next.js `middleware.ts`; all security checks are per-route-handler (every audited route that requires auth/CSRF enforces it; enumeration complete in Verification Results).
- **I-15** — `POST /api/activation/hire` sets `no-store` only on the success path (error branches omit Cache-Control); `POST /api/activation/aave-preview` route body is not wrapped in its own try/catch (the lib self-catches, but a surprise throw yields a bare Next 500).
- **I-16** — `ALTANA_NETWORK` env accepts `"bnb"` (mainnet) and `createAltanaClient`/`validateAltanaConfiguration` (integrations) permit it; this is a dead surface for the web Altana-session layer (adapter constructor refuses non-97), but an explicit refusal at the web entry would harden it.

## Authentication

**PASS.** Re-verified against source (file refs in findings):
- SIWE construction fully server-controlled except the wallet address (viem-validated): canonical domain/URI from `AUTH_CANONICAL_ORIGIN`, fixed statement, version `"1"`, chain 97, server clock times. Nonce: `randomBytes(16)` (128-bit), stored as SHA-256 hash only, 5-minute expiry, unique, single-use via atomic conditional `updateMany` inside `prisma.$transaction` (concurrent replay consumes 0 rows). Raw message digest bound (`sha256(message) === messageDigest`). All field checks (domain/URI/version/chain/nonce-hash/issuedAt/expirationTime/digest/address) run before signature recovery.
- Signature: viem `recoverMessageAddress` EOA-only; ERC-1271 deliberately unsupported (documented X.42 limitation — no contract-wallet login).
- Wallet normalization: viem `getAddress` + lowercase for all persisted comparisons.
- Session: 256-bit base64url token; only `tokenHash`/`csrfTokenHash` (SHA-256) persisted; same-TX rotation revoking all prior live sessions of the user (count audited); queries require `expiresAt > now` AND `absoluteExpiresAt > now` AND `revokedAt NULL` AND active wallet/user; `lastUsedAt` throttled 5 min and never extends expiry.
- Cookies: `__Host-` prefix, HttpOnly (session + attempt), Secure, SameSite=Lax, Path=/, no Domain — single source `cookie-policy.ts`, never weakened for dev/test. Consequence: HTTP login locally cannot set cookies (documented, intentional).
- CSRF: double-submit `x-csrf-token` vs cookie, compared SHA-256 + `timingSafeEqual` (constant-time); logout revocation additionally bound to stored `csrfTokenHash`.
- Request guards (`hasSafeMutationRequest`): POST-only + exact Origin + canonical `request.url` origin + exact `application/json` + `sec-fetch-site ∈ {null, same-origin, same-site}` + 8 KiB header and post-read caps (post-read cap has the L-2 buffering nuance).
- Identity is always derived from the server session cookie; no browser-supplied userId is ever trusted. No token in any URL or JSON response (all four auth routes verified). `/me` returns `PublicSessionInfo` only (no DB ids).
- Gaps → findings: L-2, L-4, L-6, H-1, H-2.

## Authorization

**PASS.** Ownership isolation verified across every Altana/auth/sensitive route:
- User A cannot read User B's session: GET with foreign/no session returns `{session:null}` indistinguishable from no-session (no existence oracle) — X.47 checks 9–11.
- User A cannot revoke User B's session: wrong-user revoke → 404, zero broadcasts — X.47 check 29; identity from `getAuthenticatedUser()` only.
- User A cannot execute/modify through User B's session: execution/create are not HTTP-reachable (scripts + verifiers only); permission rows are written exclusively from server policy; client-supplied `permissions/target/selector/spendCapRaw/sessionId` in bodies are ignored (X.47 checks 41–45).
- Custody: every operation re-loads the `AltanaSession` and rejects `userId` mismatch (`OwnershipError`, DENIED audit); production owner comes only from the authenticated identity.
- `store.loadById`/`updateSession` accept raw ids without an ownership filter, but no route passes a browser-controlled id across that boundary unvalidated (api.ts enforces ownership first; internal callers use server-resolved ids). IDOR/BOLA search across all 10 route files: none found.

## Altana Session

**PASS** (with H-4 and M-1 findings).
States (actual): DB enum `PENDING | ACTIVE | EXPIRED | REVOKING | REVOKED | FAILED`; in-memory two-phase create distinguishes `creating` vs `grantSubmitted`, both mapping to DB `PENDING`. No `RECONCILIATION_REQUIRED` state exists in code (not invented). Transitions verified: `creating → grantSubmitted → active` (each phase persisted before the next broadcast); any create error → `failed` (+ secret destroyed best-effort); `active → expired | revoking → revoked` (terminal). Execution denied from every non-active state (5 explicit branches) — verified in service code and both verifiers. No revoked/failed → active path exists anywhere (exhaustive `updateSession` call-site review). Duplicate create: DB partial unique index only (M-4). Duplicate revoke: already-revoked idempotent (no broadcast); REVOKING retry re-reads KeyStore then re-broadcasts; unconfirmed revoke stays REVOKING with 502 "safe to retry"; external revocation reconciles KeyStore→REVOKED without broadcast (both load-time and revoke-API paths).
Policy constants (current source match X.46 exactly): target/spend token `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`, signature `approve(address,uint256)`, spend `1n` raw, approval `1n`, native fee cap `10_000_000_000_000_000n` wei, expiry 3600 s. Zero client influence on target/selector/amount/cap/expiry/chain. No broadening anywhere.

## Spend Caps

**PASS (findings H-4, M-1).** End-to-end trace: BigInt-only arithmetic (`spentRaw + ALTANA_SESSION_APPROVAL_RAW <= spendLimitRaw`), no float anywhere; accounting persists only after confirmed receipt + exact `Approval` event observed + KeyStore still active; failed/unconfirmed txs never touch accounting; `skipped-existing` when on-chain allowance already ≥ 1; native relay-fee cap enforced by the on-chain session permission (app-side value guard noted in I-13). Cap exhaustion → pre-broadcast denial (X.45 check 15). Cap reset: NONE in app logic (M-1). Race: H-4. Timezone independence: N/A because no window logic exists (M-1).

## Revoke / Idempotency

Covered in Altana Session + API sections. Additional replay audit: SIWE nonce single-use is transactional (A4 above); auth-session replay requires the 256-bit token; logout is idempotent (204 + cookie clear even unauthenticated); revoke replay returns `already-revoked` without broadcast; unconfirmed-revoke retry broadcasts one `revokeSession` per attempt (gas-visible but KeyStore-idempotent; H-2 throttle missing). No idempotency-key mechanism exists for Altana revoke — the KeyStore's own idempotence + REVOKING state machine substitute for it (adequate for testnet; consider an idempotency token if relay cost matters in production).

## Custody

**PASS.** Re-verified: AES-256-GCM (`aes-256-gcm`, 32 B key / 12 B nonce / 16 B tag, lengths enforced both directions, tag set before plaintext, auth failure returns nothing); fresh 32-byte DEK per record; AAD canonical `aadVersion=1 / secretType / userId / sessionId / chainId=97`, bound into the tag + mirrored in `aadMetadata` (Json) with strict re-parse and service-layer re-check BEFORE KMS unwrap; 13-class typed fail-closed error taxonomy incl. `ownership-mismatch`, `record-malformed`, `aad-mismatch`, `secret-destroyed`; KMS config fail-closed on missing/partial config; `ALTANA_KMS_PROVIDER=test` rejected in production twice (resolver + TestKmsProvider constructor, both via `NODE_ENV==="production"`); AWS provider uses region-only client + default credential chain (no credentials in source; least-privilege `Encrypt/Decrypt/DescribeKey` documented); rotation = decrypt → fresh encrypt → single-row replace last, failure leaves old material intact; destroy = soft `destroyedAt` (still cannot decrypt; I-6). Ownership enforced at service layer on every op (single-layer by design — persistence has no ownership filter). REAL KMS: **NOT CONFIGURED** (unchanged; no AWS key provisioned during X.48). Minor: L-8, I-5, I-6.

## Database

**PASS for schema design; LIVE VERIFICATION BLOCKED.**
Schema vs X.41 claims: CONFIRMED. Unique constraints: `Wallet (chainId,address)`, `SiweChallenge.nonceHash` + `attemptHash`, `AuthSession.tokenHash`, `AltanaSession.sessionIdentifier` + `(chainId,keyId)` + `(chainId,publicKey)`, `EncryptedSecret.sessionId` (1:1), partial `one_live_per_wallet_idx` (M-4 caveat). FK semantics: `Restrict` for Wallet/SiweChallenge→Wallet, AuthSession→User/Wallet, AltanaSession→User/Wallet, SessionPermission/EncryptedSecret→AltanaSession; `SetNull` only for AuditEvent parents. CHECK constraints: `chainId = 97` on Wallet/SiweChallenge/AuthSession/AltanaSession; `spendCapRaw IS NULL OR >= 0`; REVOKED ⇒ non-null `revokedAt`. Session tokens/nonce/attempt stored as SHA-256 hashes only — no plaintext private keys, signers, bearer tokens, or secret columns anywhere (`EncryptedSecret` holds ciphertext envelope + KMS metadata only). Indexes cover active-session lookup, challenge expiry sweep, audit timelines, spend-period lookups. No destructive migration content. Migration is the single reviewed X.41 migration; no follow-up migrations (schema unchanged since X.41).
Race-prone updates: M-4 (duplicate create) and H-4 (spend accounting) are the only state-update races identified.
Gate: `pnpm prisma validate` → **BLOCKED P1012** ("Environment variable not found: DIRECT_DATABASE_URL" — env gap in this audit shell, same root-cause class as P1001; schema content itself reviewed). `pnpm prisma generate` → PASS. `prisma migrate status` → **BLOCKED P1001** (no database server). `db push` never run.

## API

**PASS (findings H-2, L-2, L-3, L-5).** All 10 route files enumerated and tested against the checklist:

| Route | Auth | Authz/CSRF/Origin | Size | Cache | Errors |
|---|---|---|---|---|---|
| POST /api/auth/nonce | — (login entry) | full guard; rate limited → 429 | 8 KiB (L-2) | no-store | safe, no-stack |
| POST /api/auth/verify | attempt-cookie bound | full guard; atomic challenge consume | 8 KiB (L-2) | no-store | 401 / safe 503 |
| GET /api/auth/me | session | server identity only | n/a | no-store | 200 null / 503 |
| POST /api/auth/logout | optional | guard + constant-time CSRF | n/a | no-store | idempotent 204 |
| GET /api/altana/session | session (401) | ownership-bound selector (no oracle) | n/a | no-store | P1001→503, else generic 500 |
| POST /api/altana/session/revoke | session (401/403/404) | guard + constant-time CSRF + 16-check gate | action-only body | no-store | safe per-gate 409 messages |
| POST /api/activation/hire | none (preview-only) | none needed (stateless, no writes, no creds in response) | header-only (L-3) | no-store on success only (I-14) | typed 400/404/502 |
| POST /api/activation/aave-preview | none | fixed upstream constant; strict allowlist | header-only (L-3); response buffered before 1 MB cap (L-5) | no-store | typed states |
| POST /api/agents/bnb-testnet-risk/service | none (public oracle) | strict wallet/chain validation; re-measured 1 KiB body | strongest in repo | no-store | 503 unavailable |
| GET /.well-known/agent-registration.json | public | HTTPS gate (I-9); payload contains zero addresses/keys | static | no-store | 503 on http |

HTTP methods enforced (no PUT/DELETE/PATCH anywhere). 401/403/404/409/429/502/503 all exercised by verifiers or by construction; 429 exists only on nonce issuance. No stack traces, Prisma internals, SDK internals, or secrets in any response (X.47 checks 46–49). Rate limiting: H-2.

## Frontend

**PASS.** Login flow: EIP-1193 `eth_requestAccounts` / `eth_chainId` / `wallet_switchEthereumChain(0x61)` / `personal_sign` of the server-provided SIWE message only — no `sendTransaction`/`signTransaction`/EIP-712 anywhere in browser code; no private keys touched; no localStorage/sessionStorage; only the public wallet address rendered. Permissions page (client component): fetches with default same-origin credentials + `cache:no-store`; renders only the public view fields; revoke button gated by disabled states + explicit confirm dialog scoping testnet/Agent-1816/Job-515 non-involvement; revoke POST carries CSRF header read from the non-httpOnly cookie (design); no `dangerouslySetInnerHTML`; tx links pinned to `testnet.bscscan.com` with server-supplied hashes. Loading/error/unauthorized states safe (401 → sign-in prompt). Loading-state race on revoke (busy flag) prevents double-click double-broadcast at UI level.

## External Integrations

- **AWS KMS** — server-only via `@aws-sdk/client-kms` (serverExternalPackages); config fail-closed; no credentials in source; NOT CONFIGURED.
- **Altana BNB Testnet RPC** — SDK default testnet RPC (+ `ALTANA_RPC_URL` override); chain 97 re-checked live before every sensitive op.
- **HeyAnon Aave MCP** (`https://erc8004.heyanon.ai/mcp/aave`) — fixed constant, no user-controlled URL, no credentials, read-only tools only, 8 s timeout, 1 MB response cap; signing path explicitly `"signing-not-enabled"` (no SSRF surface).
- **TermiX AACP** — public read-only GETs, chain pinned 97, per-field response validation, numeric agentId regex + encodeURIComponent.
- No MAX_UINT approvals anywhere in the repo (grep-verified; all approvals exact-amount).

## 8004scan

**PASS** (L-7). API key is server-only (`8004SCAN_API_KEY`, never `NEXT_PUBLIC_*`; env schema documents the ban); base URL is compile/env constant `https://8004scan.io/api/v1/public` (operator override possible, request-controlled never); user input reaches only encoded query params or shape-validated slugs; no SSRF; 429 handled as honest `rate-limited` state without retry; errors sanitized; envelope validated; audit-safe (no key in any log/response). Browser-bundle artifact scan: zero env values, zero `process.env` reads (I-12).

## PancakeSwap / Terminal

- **PancakeSwap** — **PARTIAL**: read-only pool data (NodeReal GraphQL, chain-56 data tag, server-side key `PANCAKESWAP_API_KEY`, URL validated against the NodeReal base, one bounded retry, per-row numeric guards, key/host stripped from errors) is IMPLEMENTED; swap/LP/execution adapter is an explicit **PLACEHOLDER** (`PCS_ADAPTER_NOT_IMPLEMENTED`). No approvals, no router calls, no slippage code — nothing to abuse yet.
- **Terminal** — **NOT PRESENT** (no trading-terminal code anywhere; `termix` is the TermiX AACP reputation API, not a DEX terminal).

## ERC-8183 Separation

**PASS.** The web Altana-session surface contains zero references to Job 515, Agent 1816, settlement, or funding except: (a) explicit *negative* guard checks (gate checks 11/12 in `service.ts:625-626`; API gate messages; UI copy stating non-involvement) and (b) one doc comment declaring no agentId coupling (`adapter.ts:7`). Policy payment-token resolution uses `getErc8183Addresses(97).paymentToken` (SDK address table, read-only constant resolution; naming coupling only — no job/funding semantics). ERC-8183 hire/funding/x402 code lives exclusively in `packages/integrations` runner/review scripts with its own chain-97 guards and explicit 56 refusal; no Web route invokes it. The two tracks share the address-table utility and nothing executable. No dangerous cross-track coupling found.

## Mainnet Safety

**PASS (multi-layer).** No mainnet transaction path exists from the web app:
1. `lib/altana-session/adapter.ts` constructor throws unless SDK `BNB_TESTNET.chainId === 97` and client default chain is 97; every SDK call passes `chainId: 97`; execution re-reads the live RPC `eth_chainId` before broadcast;
2. DB CHECK constraints `chainId = 97` on all chain-bearing tables;
3. 16-check revoke preflight asserts `policy.chainId === 97 && adapter.chainId === 97` and rejects `"chainId":56` in serialized policy;
4. `AUTH_CHAIN_ID = 97` pins SIWE sessions.
Mainnet (56) appears only in: read-only data tagging (PancakeSwap pools, 8004scan discovery filter, Aave-by-HeyAnon identity constant), the reference token registry in integrations, config-validation negatives, and `docs/TIS.md`. Residual surface: `ALTANA_NETWORK` env accepts `"bnb"`, and `createAltanaClient`/`validateAltanaConfiguration` accept it — dead surface for the web session layer (the adapter rejects it), but an explicit server-side refusal at the web entry would harden this (I-16). Production switch to 56 would require changing code or address tables, not merely an env flip, for the session path.

## CI / Supply Chain

- Lockfile: present and authoritative (pnpm 9 / lockfile v9); CI and Docker both use `--frozen-lockfile`; Docker adds `--ignore-scripts` (CI does not — M-3); `.npmrc` sets strict-workspace flags; no custom install scripts in repo package.json files (root `prepare: husky` only).
- CI jobs: install, lint, typecheck (+prisma generate), build (+prisma generate), format:check — no secrets referenced; no secrets printed. Missing: test job (M-2), audit job, migrate step, leak scan.
- Dockerfile: multi-stage `node:20-alpine`, frozen + ignore-scripts install, non-root runner user, standalone output, no secrets baked in.
- Husky pre-commit runs lint-staged only (no secret scan hook — noted for X.49).
- Findings: M-2, M-3.

## Dependency Audit

`pnpm audit` (2026-08-15, read-only; no upgrades performed): **5 vulnerabilities — 3 high, 2 moderate** (see H-3), all transitive under `next@15.5.23` (`sharp@0.34.5`, `postcss@8.4.31`). No advisories in first-party workspace packages, viem 2.x, siwe 3, @aws-sdk/client-kms, or Prisma 6.19.3 at audit time. Pinning is otherwise conservative and explicit.

## Threat Model

| # | Threat | Impact | Current mitigation | Remaining risk |
|---|---|---|---|---|
| 1 | Stolen authenticated cookie | Full session use (view/revoke; not sign) | HttpOnly+Secure+`__Host-`+SameSite=Lax; hash-only lookup; rotation on re-login; logout revocation; server identity derived | `__Host-` mitigates cookie theft via network (Secure) and host injection; stolen-cookie TTL ≤ 7 days until rotation/logout; no CSRF needed for GET views |
| 2 | Compromised browser (XSS) | Attacker holds session; CSRF token readable | HttpOnly session token; server-side ownership; 16-check preflight for revoke; sensitive ops need CSRF header | JS-readable CSRF cookie + no CSP/HSTS (H-1) → XSS ⇒ forged revoke/read; harden headers |
| 3 | Malicious authenticated user | DoS via revoke retries / view RPC reads | 16-check preflight; idempotent revoke; ownership scoping | No rate limits (H-2); testnet gas drain per retry |
| 4 | Cross-user IDOR | Read/revoke another user's session | Server identity authoritative; foreign id indistinguishable from none; 404 revoke | None found (X.47 checks 9–11, 29) |
| 5 | Replayed SIWE | Session hijack | Nonce single-use in `$transaction`; digest binding; 5-min expiry; attempt-cookie binding | None found |
| 6 | Leaked session signer (Altana) | On-chain approve(self,1) of $U; native-fee drain ≤ cap | Envelope ciphertext only in DB; AAD-bound; KMS-wrapped DEK; KeyStore policy caps calldata+value; revoke destroys key | Admin testnet key in-process memory; H-4 race bounded by idempotent 1-unit approve |
| 7 | Compromised app server | Read DB ciphertext + call KMS | Envelope encryption (attacker needs KMS too, or the running process memory); secrets never in logs | Ambient cloud credentials in-process; standard cloud blast radius |
| 8 | Compromised KMS | Unwrap DEKs → decrypt signers | Least-privilege kms:Encrypt/Decrypt on one key ARN; AAD context binding limits scope; revoke path independent of KMS | Full signer decryption for any undestroyed secret; rotation + immediate revoke required |
| 9 | Database compromise | Hash theft, ciphertext theft, audit tamper | Hash-only tokens/nonce; ciphertext envelope; no plaintext secret columns; FK Restrict prevents silent purge | No column/row-level encryption; attacker with write access could forge audit rows |
| 10 | Malicious external API (8004scan/TermiX/Aave MCP/NodeReal) | UI injection / quota burn / bad data | Fixed endpoints; typed results; validation; timeouts; no eval of upstream | 8004scan records lightly validated (L-7); unauthenticated amplification (H-2) |
| 11 | Mainnet misconfiguration | Real-money broadcast | 4-layer chain-97 pinning (adapter ctor, DB CHECK, 16-gate, live chain read) | `ALTANA_NETWORK="bnb"` accepted by lower config layer (dead surface for sessions; I-16) |
| 12 | Malicious token/router input | Arbitrary approve/swap | Not possible: target+selector+amount fixed server-side; no HTTP surface for create/execute; no MAX_UINT approvals anywhere | None until a swap feature exists |
| 13 | Concurrent execution race | Cap bypass (double broadcast) | Pre-execution allowance read serializes follow-ups; idempotent on-chain effect | H-4 — no atomic check-then-act |
| 14 | Compromised Altana admin key | KeyStore registrations/operations under the service wallet | Server-side env only; chain 97 pinned; KeyStore policy caps session-key capability; testnet only | Testnet service wallet funds at risk of drain; no key rotation automation |

## Test Coverage

Mapped to existing suites (all green at audit):

| Area | Coverage |
|---|---|
| AUTH | X.42 verifier 24 + X.43 hardening verifier 41 (offline) |
| SESSION / STATE MACHINE | X.45 verifier 25 (create/reload/execute/revoke/reconcile/crash-left) |
| OWNERSHIP | X.45 (#20 cross-user) + X.47 (#9–11, 29, 38) |
| CUSTODY | X.44 verifier 44 (envelope, KMS fail-closed, rotation, restart, production guards) |
| PERMISSIONS | X.36/X.45 checks 3, 8–11 + X.47 checks 41–44 |
| SPEND CAP | X.45 #14–15 (persist + exhaustion) — **no concurrency race test (H-4 gap)** |
| REVOKE / RECONCILIATION | X.45 #22–23 + X.47 #25–28, 33, 53–56 |
| API | X.47 API verifier 63 (auth/CSRF/ownership/idempotency/gates/tampering/errors/audit/UI) |
| UI | X.47 source-level checks 57–61 (no runtime browser tests) |
| CHAIN SAFETY | Adapter constructor guards + 16-gate checks 1/9/13 + DB CHECK (DB-side untestable while P1001) |
Key untested paths: live PostgreSQL persistence (all DB constraints/transactions), live AWS KMS, true OS-process restart, concurrent spend-cap race, browser runtime UI tests, revoke-retry over a real relay, rate-limit enforcement beyond nonce.

## Verification Results

| Gate | Result |
|---|---|
| `pnpm prisma validate` | **BLOCKED — P1012** (`Environment variable not found: DIRECT_DATABASE_URL`, Prisma CLI 6.19.3) — audit-shell env gap; schema content reviewed, unchanged since X.41 |
| `pnpm prisma generate` | PASS (no DB required) |
| `prisma migrate status` | **BLOCKED — P1001** (no database server) — POSTGRES LIVE VERIFICATION: BLOCKED (P1001) |
| `db push` | NOT RUN (prohibited) |
| `pnpm typecheck` | PASS (exit 0) |
| `pnpm lint` | PASS (exit 0) |
| `pnpm build` | PASS (Next.js production build; standalone output) |
| `pnpm test` | PASS (exit 0) — X.42 24 + X.43 41 + X.44 44 + X.45 25 + X.47 API 63 = 197 checks; in-suite real-PostgreSQL case correctly reports BLOCKED P1001 |
| X.42–X.47 verifiers (all) | PASS via `pnpm test` |
| `session.live.verify.ts` | NOT RUN by design — would broadcast real chain-97 transactions (out of X.48 scope) |
| `pnpm audit` | 5 advisories (3 high, 2 moderate) — H-3 |
| Browser bundle secret scan | PASS — zero env values, zero `process.env` reads; one env *name* string from a doc comment only (I-12) |
| Leak scan (privateKey/seedPhrase/mnemonic/rawSigner/sessionToken/AWS_SECRET/AWS_ACCESS_KEY/console) | PASS for production modules — console hits only in offline verify/probe runner scripts; privateKey hits only in X.44/X.45 in-memory custody internals and deny-list assertions |

## Remaining Production Blockers

1. **PostgreSQL live verification** — every schema constraint/transactional guarantee is offline-verified only (P1001). X.49 must provision and run `prisma migrate deploy` + the full HTTP lifecycle against a real chain-97-visible database.
2. **REAL KMS: NOT CONFIGURED** — no customer-managed AWS KMS key/region provisioned; custody runs on the test adapter only. X.49 provisioning task (out-of-band; app consumes `AWS_REGION` + `ALTANA_KMS_KEY_ID` + `ALTANA_KMS_PROVIDER=aws`; test provider is double-guarded in production).
3. **H-1 security headers** — trivial proxy/Vercel-level config; must exist before public deployment.
4. **H-2 rate limiting** — required before production exposure; decide DB-window vs Redis (a `REDIS_URL` exists in config but is unused by app code today).
5. **H-3 dependency vulnerabilities** — needs a Next.js upgrade decision (not performed here).
6. **H-4 / M-1** — atomic spend accounting + decide whether app-side daily reset is ever needed (on-chain KeyStore already enforces the day period).
7. **M-2 / M-3 CI gaps** — add a `pnpm test` job, `pnpm audit` job, and install-script allowlisting (`--ignore-scripts` parity with Docker) before X.49.

## Recommended X.49 Work

1. Provision production PostgreSQL (chain-97 `DATABASE_URL` + `DIRECT_DATABASE_URL`), run `prisma validate/migrate deploy`, re-run the full live test chain; clear the P1001 blocker.
2. Provision the customer-managed AWS KMS key out-of-band with least-privilege IAM; flip `ALTANA_KMS_PROVIDER=aws`; run a real encrypt→restart→decrypt round trip.
3. Add security headers via `next.config.mjs` `headers()` (CSP, HSTS, XCTO, XFO/frame-ancestors, Referrer-Policy) + verify cookie/CSRF behavior under CSP.
4. Implement rate limiting on the 5 flagged endpoints (DB-window or Redis; audit the rejections).
5. Decide and execute the Next.js upgrade for the 5 audit advisories (or pnpm overrides with security review).
6. Make spend accounting atomic (conditional update or serializable txn); optionally add an app-side daily reset keyed on `lastSpentAt` if product wants app-enforced daily semantics.
7. CI: add `pnpm test`, `pnpm audit`, `--ignore-scripts`/`onlyBuiltDependencies` parity, and a pre-commit secret-scan hook.
8. Harden: add `import "server-only"` to `prisma/src/client.ts`; close the `AUTH_CANONICAL_ORIGIN` misconfig surface (scheme/host allowlist); consider an idempotency token for revoke broadcasts if relay gas matters.

---

## Final Summary

```
X.48 STATUS: PASS WITH FINDINGS

CRITICAL: 0
HIGH:     4
MEDIUM:   4
LOW:      9
INFO:     16

AUTH:                PASS
AUTHORIZATION:       PASS
ALTANA SESSION:      PASS
CUSTODY:             PASS
SPEND CAP:           PASS (findings H-4 race + M-1 lifetime accounting)
API:                 PASS
FRONTEND:            PASS
8004SCAN:            PASS
PANCAKESWAP:         PARTIAL (read-only data implemented; swap/LP placeholder)
TERMINAL:            NOT PRESENT
ERC-8183 ISOLATION:  PASS
MAINNET SAFETY:      PASS
POSTGRES LIVE:       BLOCKED (P1001; prisma validate P1012 env gap; generate PASS)
REAL KMS:            NOT CONFIGURED
TESTS:               PASS (197 checks; exit 0)
BUILD:               PASS

MAINNET:               NOT TOUCHED
AGENT 1816:            NOT TOUCHED
JOB 515:               NOT TOUCHED
BLOCKCHAIN TRANSACTIONS: NONE
COMMIT:                NO
PUSH:                  NO
```
