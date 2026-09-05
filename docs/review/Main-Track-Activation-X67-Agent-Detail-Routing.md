# Main Track Activation — X.67 Agent Detail Routing Fix

**Scope:** repair the pre-existing production navigation defect found in X.66 — agent detail
and hire routes rejected every real registry identity because the dynamic slug arrives
percent-encoded in this Next 15.5 build. Fix ONLY at the route boundary; no other work.

## ROUTE FIX: PASS

**Root cause chain (verified):**
1. `lib/eight004scan/card.ts` `agentHrefFromId` (and six other producers —
   `agent-detail-view.tsx`, `hire-activation-view.tsx`, `hire-review-panel.tsx`,
   `category-dashboard.tsx`, `leaderboards-view.tsx`) build detail URLs with
   `encodeURIComponent(slug)` → `/agents/2741%3A0x…%3A9893`.
2. This Next 15.5.23 App Router build delivers the dynamic segment to the route
   STILL ENCODED (proven in X.66 via RSC payloads: only the `%3A` form present).
3. `isAgentIdSlug` (regex `^\d+:0x[0-9a-fA-F]{40}:\d+$`) and `isValidSlug` therefore
   rejected every identity slug and every producer's link returned not-found.

**Fix applied (decode exactly once at the route boundary):**
- `lib/agent-slug.ts`: added pure `decodeSlugParam(raw)` — single `decodeURIComponent`
  with malformed-escape rejection (`null`). Idempotent for every valid slug (registry
  identities and name slugs never contain `%`); `%2F`-traversal, `%zz`, and double-encoded
  `%253A` inputs are rejected (never double-decoded).
- `app/(app)/agents/[slug]/page.tsx`: decodes once in `generateMetadata` and once in the
  page, then validates the DECODED slug; identity lookups use the decoded key.
  Well-formed identity that the registry does not know → thrown `notFound()` in
  `generateMetadata` (pre-stream) → genuine 404 fallback content; non-not-found registry
  failures (missing-key / rate-limited / network) stay honest pages.
- `app/(app)/agents/[slug]/hire/page.tsx`: same decode-once; unknown/unresolvable identity
  keeps its existing notFound behavior (moved to `generateMetadata` for pre-stream 404).
- `middleware.ts`: edge shape guard for `/agents/<slug>` and `/agents/<slug>/hire` —
  any decoded segment failing both slug grammars gets a true 404 BEFORE the router
  (this build optimistically commits 200 for dynamic routes, so a page-level notFound
  alone streams the not-found content without a literal 404 status).
- The registry identity model, exact key-equality lookup (`pickAgentBySlug`), Compare and
  Hire link producers, and canonical slug grammar are UNCHANGED. Unknown agents never
  resolve to anything; validation is not weakened.

## LOCAL BUILD: PASS
- `pnpm typecheck` PASS · `pnpm lint` PASS · `pnpm build` PASS (15.5.23, 22 routes;
  `/agents/[slug]` and `/agents/[slug]/hire` remain dynamic, middleware 35 kB).

## LOCAL TESTS: PASS (inside `next start` production server, port 3104)

| Case | Result |
|---|---|
| real agent, encoded slug `%3A` | 200, rendered identity `8453:0x8004a1…:63854` (decoded) |
| real agent, raw slug | 200, identical rendering |
| name slug `momentum-rebalancer` | 200 neutral page (preserved) |
| malformed `%zz` | 400 (Next URL parse) |
| double-encoded `%253A` | 404 (edge guard, no double decode) |
| path traversal `a%2Fb` (+`/hire`) | 404 (edge guard) |
| uppercase/extra segment slugs | 404 (edge guard) |
| `/agents` listing, home | 200 (guards do not touch them) |
| no secrets in any 404 body | PASS (empty bodies) |

Verifiers (final code state): marketplace 83/83 · discovery 59/59 · compare 10/10 ·
hire 23/23 · hire-API 14/14 · session 25/25 · session-API 72/72 ·
X.49 25/25 · X.53 21/21 · X.55 22/22. X.50 34 checks: the single pre-existing stale
check-24 (`@prisma/client` server-external assertion, superseded by X.61) remains the
only failure — untouched, unchanged. No assertion weakened.

## DEPLOYMENT: PASS
- Deployed via CLI to the EXISTING project `solo-25cb/bnb-agent-marketplace-web` —
  `bnb-agent-marketplace-6tru3habt-solo-25cb` (READY, production alias
  `https://bnb-agent-marketplace-web.vercel.app` serves it; verified via headers).
- Build config untouched (X.61/X.66: `apps/web` root, `prisma generate && rm -rf .next
  && pnpm build`). No infra, Neon, or Vercel config changes. `.env.local` artifacts the
  CLI suggests were removed without reading (none materialized).

## AGENT DETAIL: PASS
- REAL identity from production marketplace RSC (`2741:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:9893`):
  - `/agents/2741%3A0x…%3A9893` → **200, title "Moody Defender Agent | Agent Studio Marketplace"**
    (was not-found before X.67).
  - raw form → 200, same agent, no cross-agent lookup (identity key rendered identically).
  - Page shows real registry fields only; honest `Unavailable` state with the classifier
    reason (chain 2741 is not the BNB-testnet-97 activation chain).
- Unknown identity `1:0xBeef…:999999` → Next's genuine not-found page
  (`NEXT_HTTP_ERROR_FALLBACK;404` payload, `robots noindex`). Note: this build streams
  dynamic-route responses with a committed 200 status, so the not-found CONTENT is served
  with 200 — identical platform constraint observed pre-fix (X.66); literal 404 statuses
  are delivered at the edge for malformed shapes.

## COMPARE: PASS
- Detail page's Compare action uses the SAME exact registry identity:
  `/compare?compare=2741:0x8004a1…:9893` → 200 and renders the same single real agent
  ("Moody Defender Agent") — identity round-trip detail → compare verified.

## HIRE: PASS
- `/agents/2741%3A0x…%3A9893/hire` → 200, "Review Agent Activation"; RSC resolved the
  REAL agent (`name: "Moody Defender Agent", agentId: 2741:0x8004a1…:9893, x402Supported,
  verification: unverified`); breadcrumb Back link intact; honest activation state:
  "Requested scope — No permission request, agent is not activatable" + chain-reason
  banner. Unknown identity hire → not-found page.

## AUTH: PASS
- Unauth POST `/api/activation/hire` (browser-like headers, no cookies) → safe 403
  `request-rejected`; `/api/auth/nonce` GET → 405; `/api/auth/me` → 200 `{"data":null}`;
  `/login` → 200. Same-origin/CSRF/ownership guards unchanged (23/23 + 14/14 +
  72/72 verifiers).

## PERMISSIONS: PASS
- `/permissions` → 200 safe view; no custody/key material anywhere.

## ACTIVATION: PASS (honest unavailable — nothing fabricated)
- No new activation; production custody still not configured — `/api/altana/session` →
  honest 503 "Altana session support is not configured on this deployment." No ACTIVE
  session created, no fake ACTIVE state; unavailable agents render Unavailable with the
  registry reason.

## SECURITY: PASS
- HSTS `max-age=63072000; includeSubDomains`, CSP with `'strict-dynamic'` + per-request
  nonce (verified unique across two requests), nosniff, `X-Frame-Options: DENY`,
  strict-origin-when-cross-origin referrer — all present on the detail route.
- Edge 404s are empty bodies; error paths leak nothing (400/403/405/503 all safe).
- Leak-scan (DATABASE_URL / AKIA / PRIVATE KEY / 8004SCAN key / secrets) across all
  fetched production HTML, RSC payloads, and a JS chunk: **0 hits**.

## REGRESSION: PASS (no regression from X.66)
- `/` 200 · `/marketplace` 200 · `/compare` 200 · `/login` 200 · `/permissions` 200 ·
  `/categories/{rebalancing,grid-trading,yield,health-factor}` 200 · `/categories` 200 ·
  `/leaderboards` 200 · `/agents` 200 · `/dashboard` 200 · `/settings` 200 ·
  `/profile` 200 · `/.well-known/agent-registration.json` 200 ·
  real-agent hire route 200.

## PRODUCTION SMOKE TEST

| Hop | Result |
|---|---|
| HOME | PASS |
| MARKETPLACE | PASS — 24 live cards, Unavailable + reasons |
| REAL AGENT | PASS — identity extracted from production RSC |
| AGENT DETAIL (encoded slug) | PASS — 200, real name, exact identity, no cross-lookup |
| COMPARE ↓ | PASS — same exact identity renders |
| HIRE | PASS — real agent review state, honest non-activatable |
| AUTH | PASS — 403/405/200-safe boundaries |
| PERMISSIONS | PASS — safe view |
| HONEST ACTIVATION/UNAVAILABLE | PASS — 503 custody-unconfigured, no fabrication |

One documented platform nuance (not a code defect): this Next 15.5.23 build streams
dynamic routes with an optimistic 200 status, so registry-unknown identities serve the
real not-found page content under 200; malformed shapes (traversal, double-encoding,
uppercase, extra segments, `%25` traps) receive literal 4xx at the edge.

**AWS/KMS: NOT TOUCHED · MAINNET: NOT TOUCHED · AGENT 1816: NOT TOUCHED ·
JOB 515: NOT TOUCHED · BLOCKCHAIN TRANSACTIONS: NONE · COMMIT: NO · PUSH: NO**

Stop after X.67 — no X.68 work started.