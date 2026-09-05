# Main Track Activation — X.70: Production PancakeSwap Configuration & Main-Track Data Verification

**Session:** X.70 — close the X.69 production PancakeSwap configuration gap; verify the four Main Track category data surfaces against the existing production deployment.
**Status:** PASS WITH FINDINGS (one BLOCKED gate — the PancakeSwap production credential — plus four PARTIAL categories unchanged for the right reasons).
**Prior:** X.69 (PASS), X.68 (PASS), X.54/X.55 (category depth baselines).
**Deployment:** existing only — `bnb-agent-marketplace-web` (solo-25cb), alias `https://bnb-agent-marketplace-web.vercel.app`, currently serving the X.69 deployment `bnb-agent-marketplace-j25bhenpt-solo-25cb` (dpl_GDDogDS1WKRM1GE8v5mWP35mb8SF, READY).
**Repository:** `C:\bnb-agent-marketplace` (monorepo; `apps/web` Next.js 15.5.23 App Router).

---

## 1. Baseline State Recorded (STEP 0 — before any modification)

- `docs/review/Main-Track-Activation-X69-Main-Track-Depth.md` — X.69 delivered real reserve fields, per-category recommendations, verification-gap copy, and a 38-check depth verifier; all four categories documented PARTIAL (execution/gaps) with Depth PASS.
- `apps/web/lib/pancakeswap/client.ts` — server-only read-only BSC V2 subgraph loader; reads exactly one env var: `PANCAKESWAP_API_KEY` (const `PANCAKESWAP_API_KEY_ENV`, line 315); if unset/empty returns `state: "unauthorized"` with reason `unauthorized` and message `"PANCAKESWAP_API_KEY is not configured"` — never a substitute value, never a zero.
- `apps/web/lib/categories/market-context.ts` — shared X.54/X.69 builder; ready-state recommendation strings exist per category; unavailable/empty branches return honest fallback recommendations.
- `apps/web/components/category-dashboard.tsx` — shared dashboard: evidence strip (matched / Verification status / x402 payment support / Protocols claimed), capability breakdown (Analysis / Recommendation / Execution), recommendation card, verification-gap card, per-agent Registry health.
- Verification scripts — all offline/pure; x50 verifier still contains the known stale check-24.

**No source file was modified during X.70.** This session is configuration-check + verification only.

## 2. STEP 1 — PancakeSwap Production Configuration

`vercel env ls` on the existing project `solo-25cb/bnb-agent-marketplace-web` shows the Production environment contains only: `PRISMA_QUERY_ENGINE_LIBRARY`, `DATABASE_URL`, `E8004SCAN_API_KEY`, `AUTH_CANONICAL_ORIGIN`, `RATE_LIMIT_BACKEND` (all Sensitive, Production).

The loader's required variable is not present. Per the X.70 instruction, the configuration step stops here and is reported exactly:

```
PANCAKESWAP_API_KEY: BLOCKED — missing production credential
```

- No key was invented; no value printed.
- No unrelated Vercel variables were modified (`vercel env ls` read-only).
- No fixture/live data was presented as production evidence of pool depth (see §4 — ready-path evidence is explicitly labelled fixture/local).
- No new Vercel project created.

## 3. STEP 2 — Deployment Currency

- `vercel inspect bnb-agent-marketplace-web.vercel.app` → the alias resolves to `bnb-agent-marketplace-j25bhenpt-solo-25cb` (dpl_GDDogDS1WKRM1GE8v5mWP35mb8SF), target production, status **Ready**, created in X.69.
- X.69 code IS the current production deployment → per instructions, no redeploy performed.

## 4. STEP 3 — PancakeSwap Live Data (per category, production HTML payloads)

All four pages were fetched from production and parsed from the RSC payload (escaped-flight forms).

| Item | Rebalancing | Grid Trading | Yield Optimisation | Health Factor |
|---|---|---|---|---|
| Matched agent count (REAL PRODUCTION — 8004scan read) | 31 | 4 | 58 | 4 |
| Verified count (REAL PRODUCTION) | 0 of 31 | 0 of 4 | 0 of 58 | 0 of 4 |
| x402 payment support (REAL PRODUCTION) | 4 of 31 | 2 of 4 | 5 of 58 | 2 of 4 |
| Protocols claimed card (REAL PRODUCTION) | present | present | present | present |
| PancakeSwap availability state | **unavailable** — honest state rendered: "Live PancakeSwap pool data is unavailable right now, so market context is not shown. No substitute values are displayed." (cause: missing `PANCAKESWAP_API_KEY`, loader returns `unauthorized`) | same | same | same |
| Reserve depth / reserve0 / reserve1 | **not shown** (upstream block unavailable on prod; ready-path fields exist in code and are proven by fixture verifier only) | same | same | not applicable (health factor draws no DEX context by design) |
| Swap totals / current price | **not shown** (same cause) | same | same | n/a |
| Recommendation (REAL PRODUCTION) | honest fallback: "Live market data is unavailable, so no data-derived recommendation can be given right now. Re-check later or verify the pair on the protocol directly before acting." | same | same | same |
| Verification-gap card (REAL PRODUCTION) | present, names exact missing sources (Execution cost / Grid range / APR-APY / Lending position respectively) | present | present | present |
| Registry health per agent (REAL PRODUCTION) | renders "Unavailable" where the registry exposes no value | same | same | same |

Evidence-type labels (required by STEP 9):
- **REAL PRODUCTION EVIDENCE:** matched/verified/x402 counts, protocols card, registry health, recommendation fallback text, all static depth copy, all API states below.
- **FIXTURE/LOCAL EVIDENCE (not production):** ready-state depth signals (reserves, turnover, reference price, per-category ready recommendations) — proven only by the offline X.54 depth verifier (38 checks, fixtures) and local `next start` runs. NOT claimed as production behaviour.
- **UNAVAILABLE UPSTREAM DATA:** all live pool-derived numbers on production today — by design they render an honest unavailable state, never substitutes.
- **MISSING CREDENTIAL:** the single cause of the above (`PANCAKESWAP_API_KEY` absent from Production env).
- **REMAINING EXECUTION/CUSTODY GAPS:** unchanged — no swap/session signing, no custody config, no execution bridge for any category (see STEP 8).

## 5. STEP 4 — Category UI (production)

`/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor` — all render **200** with:

- Evidence strip populated honestly from the real registry read (matched 31/4/58/4; verified 0 of N — genuine registry status; x402 2–5 of N).
- Capability breakdown distinct: Analysis = "Available now", Recommendation = "Available now", Execution = "Not available" with the exact copy "This marketplace performs no transactions for this category. Execution would require a scoped, revocable Altana session permission you review and approve."
- Verification gaps card visible on all four pages.
- Registry health rendered (honest "Unavailable" where upstream is null).
- No "coming soon" anywhere on the four pages (case-insensitive scan).
- No fake execution capability presented (Execution cell is "Not available"; hire API rejects).

## 6. STEP 5 — Marketplace Regression (production)

| Route | Result |
|---|---|
| `/marketplace` | 200 (365 KB payload; real agent cards) |
| `/marketplace?q=yield` | 200 (search path live) |
| `/compare` | 200 |
| `/agents/2741:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:9893` | 200 (X.67 detail routing intact) |
| same + `/hire` | 200 — honest: "No activation is claimed until the server returns a persisted active session."; no literal ACTIVE anywhere; custody-unavailable copy present |
| `/profile`, `/settings`, `/permissions`, `/dashboard`, `/login` | 200 (X.68 surfaces intact) |

APIs: `POST /api/activation/hire` → `{"ok":false,"error":{"code":"request-rejected"}}` (no ACTIVE possible); `POST /api/activation/aave-preview` → `{"state":"unsupported","reason":"wrong-agent"}`; `GET /api/altana/session` → honest "Altana session support is not configured on this deployment."; `GET /api/auth/me` → `{"ok":true,"data":null}`.

No X.64–X.69 regression observed.

## 7. STEP 6 — Security (production)

- Headers on category pages: CSP `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'`; HSTS `max-age=63072000; includeSubDomains`; `X-Content-Type-Options: nosniff`; `X-Frame-Options: DENY`; `Referrer-Policy: strict-origin-when-cross-origin` — PASS.
- Auth boundaries: `/api/auth/nonce` GET → 405; `/api/altana/session/revoke` GET → 405; session endpoint honest 200-with-error (not configured).
- Secret scan of 17 downloaded production payloads (home, marketplace, search, compare, agent detail, hire, all four categories, profile, settings, permissions, dashboard, login): zero hits for `DATABASE_URL=`, `postgres://`, `prisma://`, `PANCAKESWAP_API_KEY=`, `E8004SCAN_API_KEY=`, `RATE_LIMIT_BACKEND=`, `AUTH_CANONICAL_ORIGIN=`, AWS key patterns, JWTs, PEM blocks, or keyed NodeReal URLs. The only `sk-` matches are the word "risk-adjusted" (false positives).
- No internal credentials exposed in HTML/RSC; the Flight payloads contain no env names paired with values.

## 8. STEP 7 — Tests

Gates: `pnpm typecheck` PASS · `pnpm lint` PASS · `pnpm build` PASS (only pre-existing ox `tempo` dynamic-dependency warning; first invocation attempt hit a shell pipe timeout — rerun with redirected log exited 0).

| Verifier | Result |
|---|---|
| marketplace | 83/83 PASS |
| discovery | 59/59 PASS |
| compare | 10/10 PASS |
| activation:hire | 23/23 PASS (SIGNING/BROADCAST/PAYMENT explicitly NOT PERFORMED) |
| activation:hire-api | 14/14 PASS |
| altana:session | 25/25 PASS |
| altana:session:api | 72/72 PASS |
| security:x49 | 25/25 PASS |
| categories:x53 | 21/21 PASS |
| x54 depth (extended X.69) | 38/38 PASS |
| security:x55 | 22/22 PASS |
| security:x50 | 34 checks, **1 failure — check 24 ("standalone output and server-external packages remain configured")**, the known pre-existing stale assertion superseded in X.61 by the serverless Vercel build. **Explicitly identified, NOT silently modified.** |

## 9. STEP 8 — Final Classification

| Gate | Status | Evidence basis |
|---|---|---|
| PANCAKESWAP PRODUCTION | **BLOCKED** | `PANCAKESWAP_API_KEY: BLOCKED — missing production credential` (env ls; loader returns unauthorized; nothing invented) |
| REBALANCING | **PARTIAL** | Real registry evidence on prod (31 matched); live depth unavailable on prod (missing credential); ready-state depth is fixture/local evidence only; execution unavailable |
| GRID TRADING | **PARTIAL** | Real registry evidence (4 matched); no range/backtest anywhere; no execution |
| YIELD OPTIMIZATION | **PARTIAL** | Real registry evidence (58 matched); APR/APY never fabricated — unavailable by source design and additionally blocked on prod by the missing credential |
| HEALTH FACTOR | **PARTIAL** | Real registry evidence (4 matched); no lending-position source on prod or in the codebase; all signals null; no health factor invented |
| MARKETPLACE | **PASS** | 200, real agent cards, verifier 83/83 |
| SEARCH | **PASS** | `?q=yield` 200, discovery verifier 59/59 |
| COMPARE | **PASS** | 200, compare verifier 10/10 |
| HIRE | **PASS** | Honest rejected/unconfigured states only; no ACTIVE; verifiers 23/23 + 14/14 |
| AUTH | **PASS** | `/api/auth/me` data null, nonce/revoke GET 405, session not-configured honest |
| SECURITY | **PASS** | Headers + zero secret exposure across all payloads |
| BUILD | **PASS** | typecheck/lint/production build green |
| TESTS | **PASS** | all verifiers green except the explicitly identified stale x50 check-24 (unchanged) |
| DEPLOYMENT | **PASS** | X.69 deployment current on the existing project, READY, no redeploy performed |

### Boundaries

- AWS/KMS: NOT TOUCHED
- ALTANA CUSTODY: NOT TOUCHED
- TERMiX: NOT TOUCHED
- MAINNET: NOT TOUCHED
- AGENT 1816: NOT TOUCHED
- JOB 515: NOT TOUCHED
- BLOCKCHAIN TRANSACTIONS: NONE
- COMMIT: NO
- PUSH: NO
- Vercel environment: read-only (`env ls`, `inspect`); nothing added, removed or changed.
- New Vercel project: NONE.

## 10. STEP 9 — Honest Reading

- The four Main Track strategies are **NOT executable** because of this session; their analysis/data layer renders honestly and their depth is proven offline, but production live depth currently depends on one missing credential, and execution/custody remains out of scope by design.
- Restoring live production depth is a non-code operation: add `PANCAKESWAP_API_KEY` (Sensitive → Production) to `solo-25cb/bnb-agent-marketplace-web` and redeploy the existing project. Until that credential exists, production correctly displays the honest unavailable state.
- The production deployment is unchanged by X.70 (verification-only session).

**STOPPING AFTER X.70 — X.71 NOT STARTED.**