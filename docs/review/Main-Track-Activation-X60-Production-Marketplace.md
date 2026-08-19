# X.60 — Production Marketplace Deployment Audit

Status: **COMPLETE (MIXED PASS / PARTIAL / BLOCKED — no redeploy, no new project)**
Date: 2026-08-16

## Scope

Verify the existing production deployment `https://bnb-agent-marketplace-web.vercel.app/`
against the 16-item checklist WITHOUT creating a new project, WITHOUT redeploying
unnecessarily, and reporting PASS / PARTIAL / BLOCKED per dependency with exact
evidence. No credentials were printed; no env values were asserted from memory.

## Access capability (determines several statuses)

| Check | Result |
|---|---|
| `vercel` CLI on PATH | Absent |
| `npx vercel --version` | 59.1.3 (works; npm emits `Unknown project config "shamefully-hoist"` warnings from repo `.npmrc`, harmless) |
| `npx vercel whoami` | No output → **not authenticated** |
| `VERCEL_TOKEN` env | Absent |
| `%APPDATA%\com.vercel.cli\auth.json` | Absent |

**Exact blocker for every env inspection item below:** no Vercel account token /
CLI auth is available to this agent. Platform-owner action is required to inspect or
change production env vars. All network probes below were performed against the live
deployment with `curl.exe` (Invoke-WebRequest drops cookies; irrelevant here but kept
consistent).

## Checklist results

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | `8004SCAN_API_KEY` present in Vercel prod env (server-only, NOT `NEXT_PUBLIC_*`) | **BLOCKED** (inspection) — runtime evidence says missing | `vercel whoami` unauthenticated. However the deployed `/marketplace` page SERVER-RENDERS `data.state === "missing-key"` → "The 8004scan API key is missing on the server. Add 8004SCAN_API_KEY (server-only) to load live agents; nothing is simulated meanwhile." (message identical to `apps/web/app/(app)/marketplace/marketplace-view.tsx:733`). This state is produced during SSR in the serverless function, so the key is neither present nor reachable at runtime by the deployed function. No fabricated data shown instead. |
| 2 | Neon `DATABASE_URL` configured | **BLOCKED** (inspection) — not observable on this snapshot | No env access. Deployed snapshot contains no DB-touching routes (see #6), so no runtime DB path exists on prod to observe. Local X.59 verified real Neon end-to-end. |
| 3 | `DIRECT_DATABASE_URL` not required at runtime | PASS (design; unaffected by deploy) | `prisma/schema.prisma` uses `url = env("DATABASE_URL")`; `directUrl` is migration/CLI-only (required by `prisma migrate` on Neon, not by the runtime client). X.59 demonstrated runtime works from pooled URL only. |
| 4 | `RATE_LIMIT_BACKEND=prisma` at runtime | **BLOCKED** on prod; PASS locally on real Neon (X.59) | Rate limiter lives in auth routes, which are absent from the deployed snapshot (#6 → all 404). X.59 proved the env switch selects the Prisma provider and persists counts across provider instances in real `neondb`. |
| 5 | `AUTH_CANONICAL_ORIGIN` == `https://bnb-agent-marketplace-web.vercel.app` | **BLOCKED** (inspection) | No Vercel auth. Local default remains `http://localhost:3000`; the deployed build predates auth entirely (see #6), so no runtime behavior to confirm. |
| 6 | SIWE / auth / session behavior on prod | **BLOCKED** — routes not deployed in current snapshot | `/api/auth/me`, `/api/auth/nonce`, `/api/auth/logout`, `/api/auth/verify`, `/api/altana/session`, `/api/altana/session/revoke` → **404** (exist in current source; added 08-15). Deployed build predates them. Connect Wallet button renders honest `Coming Soon` chip. |
| 7 | `/marketplace` shows real agents | PARTIAL — honest unavailable state, zero fabrication | Page 200 (70.1 KB), server-rendered "missing-key" banner (see #1), registry badge "Waiting", no agent cards, no invented APY/evidence/excerpts. The deployed snapshot is an 08-13-era build of `marketplace-view.tsx`. |
| 8 | 4 category pages (`/categories`, `/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor`) | PASS (pages live, content-honest) | All 200 (≈33 KB each). Content is the OLD descriptive copy (e.g. "Discover agents that automatically correct portfolio drift...") — generic marketing text, no hardcoded APY (`APY` absent), no fabricated numbers (`\d+.\d*%` absent), no fake evidence. Not the X.53 evidence-backed discovery UI (that needs the 8004scan key + newer build). |
| 9 | PancakeSwap | N/A | `/pancakeswap`, `/drop`, `/api/drop` → Vercel 404 (9.3 KB not-found page). No such routes exist in current repo either (`glob **/{drop,pancakeswap,pcs}/**` → none). |
| 10 | Security headers: CSP + nonce, HSTS, X-Frame-Options | PARTIAL | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` present — this is Vercel's platform default. **No `Content-Security-Policy` header** → deployed build's middleware predates the CSP-with-nonce implementation (current `middleware.ts` dated 08-15, not in snapshot). |
| 11 | Production smoke test | PASS | `/` 200, `/marketplace` 200, all 4 category pages 200; `/api/activation/aave-preview`, `/api/activation/hire`, `/api/agents/bnb-testnet-risk/service` → 405 on GET (registered, method-guarded — correct). No 5xx on any probed surface. |
| 12 | No invented data | PASS | Missing-key + waiting states are rendered server-side and honest; no simulated agents/APY/evidence anywhere observed. |
| 13 | No AWS/KMS | PASS | Altana custody routes not deployed; nothing custody-related reachable; no KMS config touched (consistent with X.58.1 policy). |
| 14 | No mainnet / Agent 1816 / Job 515 / chain transactions | PASS | No chain-facing routes executed; nothing mainnet-related probed or deployed. |
| 15 | Report written | PASS | This document. |
| 16 | No commit / push | PASS | Working tree untouched. |

## Root finding

The live deployment is a **stale snapshot (≈08-13)**: it contains the 08-13 marketplace
UI and old descriptive category pages, but none of the 08-15 work (auth/SIWE routes,
altana session, rate limiting, CSP middleware). It therefore cannot exercise any of
the DB, auth, or rate-limit surfaces, and its marketplace honestly reports that the
8004scan key is missing at runtime. Because no Vercel auth is available, it cannot be
determined whether `8004SCAN_API_KEY` was ever set in the project env; the deployed
function reports it absent, and that is the only observable truth.

## Required remediation (platform owner)

1. In Vercel dashboard → project → Settings → Environment Variables, ensure for **Production**:
   - `8004SCAN_API_KEY` = real key (server-only; do NOT prefix `NEXT_PUBLIC_`)
   - `DATABASE_URL` = pooled Neon URL (verified working in X.59)
   - `RATE_LIMIT_BACKEND=prisma`
   - `AUTH_CANONICAL_ORIGIN=https://bnb-agent-marketplace-web.vercel.app`
2. Redeploy **current main** (`vercel --prod`) with CLI auth. Current main contains:
   auth/SIWE routes, altana session (still 503 "not configured" until KMS is intentionally
   provisioned), Prisma rate limiting, CSP-with-nonce middleware, the X.53 evidence-backed
   category discovery, and the X.59 DB wiring. After redeploy, X.60 items 1, 2, 4, 5, 6, 7, 8, 10
   become fully verifiable and X.60 should be re-run as X.61.
3. Do NOT set KMS env vars until the custody milestone is explicitly scheduled.

## Verification notes

- All probes used `curl.exe` against `https://bnb-agent-marketplace-web.vercel.app`.
- No credentials were printed; env presence was inferred strictly from runtime behavior.
- No project was created; nothing was redeployed; nothing was committed or pushed.
