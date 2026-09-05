# X.49 Security Remediation

- **Date:** 2026-08-15
- **Scope:** Code/security hardening only. No infrastructure provisioning, credentials, live sessions, transactions, mainnet, Agent 1816, Job 515, commit, or push.
- **Baseline:** `Main-Track-Activation-X48-Security-Production-Audit.md`

## X.48 Baseline

```text
0 CRITICAL
4 HIGH
4 MEDIUM
9 LOW
16 INFO
```

## HIGH Findings

### H-1 Missing production security headers — FIXED

- **Root cause:** no middleware/headers policy in Next 15.
- **Fix:** `apps/web/middleware.ts` + pure `lib/security/headers.ts` policy.
- **Headers:** nonce-based production CSP, HSTS (production HTTPS only), `nosniff`, strict referrer policy, Permissions-Policy, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`.
- **CSP:** `default-src 'self'`; nonce + strict-dynamic scripts; self/nonced styles; self-only connect; no `unsafe-eval` or production `unsafe-inline`; no third-party script origin. Next/font is self-hosted and all external API calls are server-side.
- **Development:** CSP and HSTS are omitted for HTTP localhost; other safe headers remain.
- **Tests:** X.49 checks 1-4; production build includes Middleware.

### H-2 Missing general rate limiting — FIXED WITH DEPLOYMENT BACKEND RESIDUAL

- **Root cause:** only SIWE nonce issuance had a DB-window limit.
- **Fix:** provider abstraction, fixed-window policies, per-route gate, fail-closed provider behavior, in-memory dev provider, authoritative PostgreSQL provider and migration (`RateLimitBucket`). Redis is a documented future slot and cannot be selected without failing safe.
- **Protected routes:** nonce, verify, logout, me, Altana view, Altana revoke, hire preview, Aave preview, BNB-testnet risk oracle.
- **Backend now:** memory is the honest default and is per-instance only. `RATE_LIMIT_BACKEND=prisma` activates the cross-instance provider after X.49 migration deployment. Redis remains unprovisioned.
- **Tests:** threshold, isolation, reset, provider failure, policy coverage (X.49 checks 5-9).
- **Residual:** distributed enforcement is not claimed until PostgreSQL is live or Redis is provisioned. Status is `PARTIAL` operationally, but the code finding is remediated.

## Rate Limiting

| Endpoint | Limit | Scope / reason |
|---|---:|---|
| POST `/api/auth/nonce` | 12 / 10 min | normalized wallet; original DB 10/wallet + global 1000 remains authoritative |
| POST `/api/auth/verify` | 120 / min | global pre-auth CPU bound |
| POST `/api/auth/logout` | 30 / min | hashed session token |
| GET `/api/auth/me` | 120 / min | authenticated identity / anonymous bucket |
| GET `/api/altana/session` | 60 / min | authenticated user; each read performs KeyStore RPC |
| POST `/api/altana/session/revoke` | 10 / min | authenticated user; retries may relay |
| POST `/api/activation/hire` | 20 / min | global unauthenticated upstream call |
| POST `/api/activation/aave-preview` | 10 / min | global unauthenticated x4 amplification |
| POST `/api/agents/bnb-testnet-risk/service` | 30 / min | global RPC oracle |

### H-3 Five vulnerable transitive dependencies — FIXED

- **Before:** `next@15.5.23 → sharp@0.34.5`; `next@15.5.23 → postcss@8.4.31` (5 advisories: 3 HIGH, 2 MODERATE).
- **Fix:** scoped root `pnpm.overrides` — `sharp >=0.35.0 <0.36`, `postcss >=8.5.23 <9` — no broad Next upgrade.
- **Lockfile:** updated once; `pnpm install --frozen-lockfile` then passes.
- **After:** `pnpm audit` = **No known vulnerabilities found**.
- **Regression:** typecheck/lint/build/test all pass.

## Dependency Remediation

| Package | Before | Required fixed | After policy | Status |
|---|---:|---:|---:|---|
| sharp | 0.34.5 | >=0.35.0 | >=0.35.0 <0.36 | FIXED |
| postcss | 8.4.31 | >=8.5.23 (covers all 4) | >=8.5.23 <9 | FIXED |

Remaining advisories: **0**.

### H-4 Non-atomic spend-cap check/execute/update — FIXED

- **Root cause:** request-local read/compare followed by broadcast and unconditional metadata write.
- **Fix:** `SessionStore.tryReserveSpend` + `settleReservation` authoritative contract.
- **Memory double:** synchronous check-and-reserve critical section (offline proof).
- **Prisma store:** interactive transaction + `SELECT ... FOR UPDATE`, re-reads confirmed/pending usage inside the row lock, commits pending reservation before broadcast.
- **Fail closed:** reservation store failure returns `reservation-unavailable`; no broadcast.
- **Lifecycle:** RESERVED → CONFIRMED (move pending into confirmed) / RELEASED (pre-broadcast failure only) / HELD (broadcast ambiguous; never returned blindly; UTC-window reset bounds it).
- **Concurrency:** ten simultaneous reservations against cap 1 → exactly 1 granted, 9 rejected before any possible broadcast.

## Spend-Cap Concurrency Model

```text
cap = 1

request A -> atomic reservation 1 -> allowed -> external execution
request B -> row lock sees confirmed + pending = 1 -> rejected before broadcast

confirmed receipt + exact Approval event -> pending 1 -> confirmed 1
pre-broadcast exception                -> pending 1 -> released 0
unconfirmed/post-broadcast ambiguity   -> pending remains held; never blindly released
```

Daily semantics are now explicit and UTC/timezone-independent: stale `spentWindow` buckets contribute zero to the next UTC day.

## MEDIUM Findings

| Finding | Fix | Test | Status |
|---|---|---|---|
| M-1 app cap was lifetime, not daily | `spentWindow` UTC bucket + reset in atomic reservation | X.49 check 16 | FIXED |
| M-2 CI did not run tests/audit | CI `test` + strict production-dependency `audit` jobs | workflow source + frozen install | FIXED |
| M-3 CI lifecycle scripts unallowlisted | root `pnpm.onlyBuiltDependencies` (`@prisma/client`, engines, esbuild, sharp) | frozen install | FIXED |
| M-4 duplicate-session enforcement DB-only | app-level live-session precheck + typed insert failure; DB partial unique remains authoritative | existing lifecycle + X.49 source | FIXED |

## LOW Findings

| Finding | Status | Resolution |
|---|---|---|
| L-1 Prisma client lacked server-only marker | FIXED | `import "server-only"`; package dependency added |
| L-2 auth body buffered before cap | FIXED | streaming `readBodyWithLimit`, aborts immediately over cap |
| L-3 hire/Aave relied on Content-Length | FIXED | shared actual-byte streaming cap |
| L-4 nonce limit denials unaudited | FIXED | best-effort `SIWE_NONCE_RATE_LIMITED` DENIED audit |
| L-5 Aave upstream buffered before 1 MB cap | FIXED | streaming response cap |
| L-6 canonical origin accepted unsafe production HTTP | FIXED | http(s) only, no credentials, HTTPS mandatory in production |
| L-7 8004scan record validation is lighter than other clients | DEFERRED | display-only React text rendering; no eval/HTML sink; address in X.50 client hardening |
| L-8 AEAD seal accepted injectable nonce | FIXED | nonce generated internally on every seal; argument removed |
| L-9 Altana service rebuilt clients per request | FIXED | stable module-level process-env service cache; explicit env overrides isolated |

## INFO Findings

Useful items were converted into comments, verifier source checks, env templates, the `RATE_LIMIT_BACKEND` production switch, explicit `ALTANA_NETWORK=bnb` refusal, no-store error branches, and X.50 prerequisites. No unrelated marketplace/PancakeSwap/Terminal work was introduced.

## Security Headers

Exact production headers:

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<request nonce>' 'strict-dynamic';
  style-src 'self' 'nonce-<request nonce>';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self';
  worker-src 'self' blob:;
  manifest-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests; (HTTPS only)
Strict-Transport-Security: max-age=63072000; includeSubDomains (HTTPS production only)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
```

## Regression Results

| Milestone | Result |
|---|---|
| X.42 | PASS (24) |
| X.43 | PASS (41) |
| X.44 | PASS (44) |
| X.45 | PASS (25/25) |
| X.46 | PASS by offline lifecycle regression; live verifier NOT RUN (would transact) |
| X.47 | PASS (63/63) |
| X.49 | PASS (25/25) |

Total offline checks: **222 PASS**.

## Verification Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm audit`: PASS — no known vulnerabilities
- `pnpm prisma validate`: PASS (placeholder local URLs supplied; no connection attempted)
- `pnpm prisma generate`: PASS
- `prisma migrate status`: **BLOCKED P1001** (PostgreSQL unavailable)
- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm build`: PASS (exit 0; middleware included; known `ox` dynamic-dependency and Windows Prisma engine lookup warnings remain)
- `pnpm test`: PASS — 222 checks
- Leak scan: PASS (expected verifier console/deny-list strings only)
- Mainnet/Agent 1816/Job 515: NOT TOUCHED
- Blockchain transactions: NONE

## Remaining Risks

1. **Distributed rate limiter backend:** code/migration exist, but `RATE_LIMIT_BACKEND=prisma` cannot be live-verified until PostgreSQL is provisioned. Memory is per-instance only. Redis remains unimplemented/unprovisioned.
2. **PostgreSQL:** P1001; X.49 migration not deployed. Atomic Prisma reservation and counter semantics are code/type reviewed + memory-contract tested, not live-DB tested.
3. **Real KMS:** NOT CONFIGURED.
4. **L-7:** 8004scan per-record validation remains lighter; envelope validation and React escaping mitigate.
5. **Build warning:** Next build exits 0 but Windows page-data collection logs Prisma query-engine lookup errors; must be resolved/validated in deployment image.
6. **CSP runtime:** policy/build verified offline; wallet-extension/browser CSP smoke test remains for deployed HTTPS QA.

## X.50 Prerequisites

1. Provision PostgreSQL, deploy X.41 + X.49 migrations, set `RATE_LIMIT_BACKEND=prisma`, then test distributed counters + row-locked reservations against 10 truly parallel DB clients.
2. Resolve Prisma standalone engine packaging warning in the deployment image.
3. Provision real AWS KMS out-of-band and run real custody restart round trip.
4. Browser/HTTPS smoke: CSP nonce propagation, wallet connect, SIWE, permissions page, revoke confirmation (read-only/revoke only under explicit operator approval).
5. Harden 8004scan per-record schema validation.

## Final Status

```text
X.49 STATUS: PASS WITH FINDINGS

HIGH FINDINGS:   0
MEDIUM FINDINGS: 0
LOW FINDINGS:    3 (distributed limiter live backend; 8004scan row schema; Prisma build warning)

SECURITY HEADERS: PASS
RATE LIMITING:    PARTIAL (policies/providers/wiring PASS; distributed backend not live)
DEPENDENCIES:     PASS
ATOMIC SPEND CAP: PASS (contract + Prisma row-lock implementation; live DB blocked)
CONCURRENCY TEST: PASS (1 granted / 9 rejected)
CHAIN 97 SAFETY:  PASS
SECRET LEAK SCAN: PASS

X.42 REGRESSION: PASS
X.43 REGRESSION: PASS
X.44 REGRESSION: PASS
X.45 REGRESSION: PASS
X.46 REGRESSION: PASS (offline; live not re-run)
X.47 REGRESSION: PASS

POSTGRES LIVE: BLOCKED (P1001)
REAL KMS:      NOT CONFIGURED

BLOCKCHAIN TRANSACTIONS: NONE
MAINNET: NOT TOUCHED
AGENT 1816: NOT TOUCHED
JOB 515: NOT TOUCHED
COMMIT: NO
PUSH: NO
```
