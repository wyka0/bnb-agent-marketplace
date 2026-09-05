# Main Track Activation — X.66 Production Deployment + Search/Compare/Hire Verification

**Scope:** deploy the current local code (X.64 search/compare + X.65 hire/activation UI) to the
existing `bnb-agent-marketplace-web` project, then verify X.64/X.65 behavior, auth, activation
honesty, security, and regression in production. No new feature development.

## DEPLOYMENT: PASS (2 deploys; second is live)

- Project: existing `solo-25cb/bnb-agent-marketplace-web` (root dir `apps/web`, Node 24.x,
  build command includes `prisma generate && rm -rf .next && pnpm build`). No new project created.
- Deploy 1 (current source, but built against a stale prebuilt UI package):
  `bnb-agent-marketplace-olsoulk6p-solo-25cb.vercel.app` —
  **DISCOVERED** marketplace/homepage cards still showed the old disabled `Hire · Soon`
  button (`title="Hire arrives with live registry integration"`) while all other X.64/X.65
  surfaces (routes, APIs, page copy) were current.
- Root cause (diagnosed before changing anything): `@bnb-marketplace/ui` ships a prebuilt
  `dist/`; Vercel's build command (`pnpm build`, no turbo step) imports it, and the CLI
  deployment included the stale `packages/ui/dist` (built 17 Aug 01:19, pre-X.64/X.65).
  The agent-card UI changes lived in `packages/ui/src` and never entered the bundle.
- Fix: rebuilt `packages/ui` from current source (`pnpm --dir packages/ui build`; fresh
  dist confirmed `Activate`/`Unavailable` markup), reran typecheck/lint/build, redeployed.
- Deploy 2 (live): `bnb-agent-marketplace-jkwc9hf7u-solo-25cb.vercel.app`
  (`dpl_` via CLI), aliased to `https://bnb-agent-marketplace-web.vercel.app`. READY.
- Verified current code artifacts on the alias: `/agents/[slug]/hire` route exists;
  `/api/activation/hire` safe-responses; marketplace cards show honest `Unavailable`.

## HOMEPAGE: PASS

- `/` → 200, complete render (180 KB), no skeleton/spinner, no placeholder agents.
- Real 8004scan data: "Agents in registry 421,653", 24 live listings, "Verified agents 0",
  BSC category matches 4 of 4 tracks, Marketplace snapshot, newest listings, Featured Agents,
  search entry ("Searches the live ERC-8004 agent registry" + links to /marketplace),
  Compare entry ("Open Compare"), category information, "All systems operational".
- Obsolete homepage placeholders absent: no "once integration ships", no
  "Loading live agents from registry", no "Waiting for registry sync", no
  "Synced from 8004scan once live".
- No `Hire Soon` anywhere; 6 featured/newest homepage cards show `Unavailable`.
- Note (pre-existing, cosmetic-only): footer brand block statically prints
  "Registry sync pending" (`components/home/home-footer.tsx:74`) even when data is synced;
  unchanged in X.64/X.65/X.66 — flagged, not in scope to edit.

## SEARCH: PASS

- `/marketplace?q=yield` → 200; results DIFFER from default page (17 of 24 cards changed),
  real registry names only ("Yield Allocator", "Zyfai Rebalancer Agent for 0x…").
- Server-side: SSR HTML contains the filtered set (not all 24) — `page.tsx` passes
  `q → getMarketplaceAgents({ limit: 24, page: 1, query })` →
  upstream `search` param — verified live.
- Empty query (`?q=`) → identical to default page. No-result query
  (`?q=zzzzzznomatchxyz`) → 0 cards + honest "No agents match" + Clear search.
- Query survives refresh: identical result-set hash across two requests.
- No fabricated results; exact full agent-id search (`?q=8453:0x8004a1…:63854`) returns
  exactly 1 real card.
- No API credentials in any page HTML or client JS (0 hits for
  `8004SCAN`/`dk_live`/`bearer …` across every fetched page + JS chunk).

## COMPARE: PASS (except detail navigation, below)

- `/compare` → 200. Empty state renders honest slots.
- `?compare=` with 1, 2, 3 EXACT registry identities → server-resolved real rows SSR
  ("1 / 3 selected", resolved names, Description, Protocols, Chain, Verification).
- Duplicate collapse: `?compare=A,A,B` → 2 slots (no dup rows).
- Cap at 3: 4-identity URL → 3 slots (X.64 lib behavior; server + verifier).
- Remove / Clear comparison controls present and server-rendered.
- Marketplace Compare controls: per-card checkbox + `Compare` button wired
  (`Compare N/3` when selected, disabled at 0).
- Real fields only; unavailable fields explicitly unavailable ("Not classified by 8004scan",
  "Not provided by 8004scan"); no invented reputation/APY/health/performance.
- Agent detail → Compare: present in view code, but unreachable in production because
  detail pages do not resolve (see BLOCKED below).

## HIRE UI: PARTIAL

- Marketplace cards: 24/24 show disabled `Unavailable` with the real classifier reason, e.g.
  `title="Chain 8453 is not the supported activation chain (BNB testnet, 97); mainnet is
  never used for activation."` — no `Hire Soon`, no `Soon`, no fake `Activate` (0 occurrences:
  no current record is ACTIVATABLE).
- Exact registry identity preserved through review/consent pipeline (verifier-guaranteed;
  server always re-resolves by exact identity — browser-supplied identity is never trusted).
- `/agents/[slug]/hire` route exists and returns 200, but every real identity currently
  lands on the honest not-found state (see BLOCKED).

## AUTH: PASS (boundaries verified live)

- `/api/auth/me` unauthenticated → 200 `{"ok":true,"data":null}`.
- `/api/activation/hire` POST without valid session/cookies → 403 safe
  `request-rejected` (mutation guard) — no data, no stack.
- `/api/auth/nonce` GET → 405; POST without browser headers → 403; with same-origin
  headers → proceeds to `400 "Wallet address is required."` (SIWE flow works).
- Same-origin / Sec-Fetch-Site / JSON guards, ownership, identity rate limiting,
  and CSRF behavior covered by the 23/23 + 14/14 + 72/72 verifier batteries.

## PERMISSIONS: PASS

- `/permissions` → 200 safe view; no custody/KMS/key material anywhere in page or payloads.

## ACTIVATION: PARTIAL (honest unavailable — no fabrication)

- Production has no custody configuration: `/api/altana/session` → 503
  "Altana session support is not configured on this deployment."
- No genuine activation is possible without violating the architecture, and no ACTIVE
  record was created. Activate buttons are not shown anywhere — every real card is
  `Unavailable` with reason. This is the intended honest state, not a failure.
- No fake ACTIVE, no fabricated price/capability/amount/session.

## SESSIONS: PARTIAL (no runtime session; verified by evidence)

- No real session can be created (custody not configured) — therefore no live retrieve/
  execute. Existing verified evidence stands: session verifier 25/25 (real test custody:
  create/restart/ownership/revoke/execution) and session API verifier 72/72
  (auth, ownership, CSRF, safe view, no secrets, idempotent revoke, post-revoke denial,
  persistence/custody error mapping).

## REVOKE: PASS (evidence-based)

- No real session exists → no new revocation performed. Verified revoke evidence reused:
  72/72 API checks (revoke → REVOKED, idempotent second revoke, ownership 404, no duplicate
  broadcast, execution refused after revoke, safe responses). State: NO new activation
  performed in X.66, so no new revoke could be performed.

## RATE LIMIT: PASS

- Identity-scoped `activation.hire` limit (10/60s) in the deployed code; limiter hits
  render safe responses; auth nonce limiter also present. Live boundary checks returned
  safe 4xx (403/400/405), and the 8004scan discovery surface honestly showed a
  rate-limited bucket state ("Registry rate limit reached") after heavy probing.

## SECURITY: PASS

- HTTPS enforced; HSTS `max-age=63072000; includeSubDomains`.
- CSP with per-request nonce verified: two consecutive requests carry different
  `script-src 'nonce-…' 'strict-dynamic'` nonces; `frame-ancestors 'none'`,
  `upgrade-insecure-requests`.
- Referrer-Policy strict-origin-when-cross-origin, X-Content-Type-Options nosniff,
  X-Frame-Options DENY.
- No stack traces on any probed error path (403/405/400/503 all JSON safe messages).
- No DATABASE_URL / AWS / KMS / private-key / custody / API-key material in any page
  HTML, RSC payload, or client JS chunk (pattern scan clean).

## MARKETPLACE: PASS

- `/marketplace` → 200, live cards with honest unavailable state, server search,
  compare controls, registry statistics ("Live from the 8004scan registry (page 1,
  newest first). 421,653 agents indexed."), no fake rows.

## CATEGORIES: PASS

- All 4 routes 200: `/categories/rebalancing` (real data: 31 hits / 40 screened),
  `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor`
  (honest rate-limited/empty states when upstream 429s), plus `/categories` index 200.
- Honest degraded states verified under real rate limiting — no fabricated numbers.

## BUILD: PASS

- Sequential typecheck + lint + build pass locally; Vercel build (prisma generate +
  clean `rm -rf .next` + `pnpm build`) completed with the corrected UI package;
  26 routes compiled; `/agents/[slug]/hire` dynamic route present.

## TESTS: PARTIAL (pre-existing limitation only)

- Verifiers all green: marketplace 83/83, discovery 59/59, compare 10/10,
  hire 23/23, hire-API 14/14, session 25/25, session-API 72/72.
- `pnpm test` keeps only the pre-existing stale X.50 check-24 (`@prisma/client`
  external-package assertion, superseded by X.61) — unchanged, not weakened.
- Live authenticated UI could not be exercised end-to-end: no wallet session, no custody,
  no DB access from this environment by design.

## PRODUCTION SMOKE TEST (journey)

| Hop | Result |
|---|---|
| HOME | PASS — live registry stats, featured agents, search + compare entries, no spinner |
| SEARCH | PASS — server-side, real results, refresh-stable, honest empty/no-result states |
| MARKETPLACE | PASS — 24 live cards, Unavailable + classifier reasons, compare controls |
| AGENT DETAILS | BLOCKED — every real identity renders not-found (see below) |
| COMPARE | PASS — exact ids, dedupe, cap 3, remove/clear, real fields only |
| HIRE | PARTIAL — card states honest; review page unreachable for real agents (see below) |
| AUTH | PASS — safe 403/400/405 boundaries, SIWE nonce flow alive |
| PERMISSIONS | PASS — safe view only |
| ACTIVATION | PARTIAL/BLOCKED — custody not configured; honest 503; nothing fabricated |
| SESSION | PARTIAL — no session creatable; verified offline evidence reused |
| REVOKE | PASS — evidence-based; no new activation/revoke performed |

## BLOCKED — pre-existing detail navigation (root cause diagnosed, NOT introduced by X.66)

- Every real marketplace/compare agent card links to `/agents/<agent_id>` where the id is
  percent-encoded by `agentHrefFromId` (`encodeURIComponent`). In this Next 15.5 build the
  dynamic-segment param arrives STILL ENCODED (`8453%3A0x8004a1…%3A63854`), proven via the
  RSC payload (only the `%3A` form present), so `isAgentIdSlug` (which requires raw
  `^\d+:0x…:\d+$`) rejects it and the page calls `notFound()` → "Agent not found".
- Identical behavior reproduced on the local production build (same code path).
- Compare works only because query params decode correctly; search by the full raw id
  returns the agent (1 card), confirming upstream can match `chainId:contract:tokenId`.
- Impact: marketplace → Details and Details → Compare navigation are dead in production
  (and locally) for ALL real records; `/agents/[slug]/hire` inherits the same undecoded
  slug and shows its honest not-found state.
- Recommended fix (X.67, out of scope here): decode once at the route boundary or make
  `agentHrefFromId`/`isAgentIdSlug` agree (e.g. route-level `decodeURIComponent` before
  validation), then re-verify marketplace → details → compare → hire end-to-end.
- Secondary pre-existing cosmetic issue: static "Registry sync pending" footer label.

## X.66 STATUS SUMMARY

- DEPLOYMENT: PASS (corrected deploy live; stale UI-dist root cause fixed)
- HOMEPAGE: PASS | SEARCH: PASS | COMPARE: PASS | HIRE UI: PARTIAL
- AUTH: PASS | PERMISSIONS: PASS | ACTIVATION: PARTIAL (honest unavailable)
- SESSIONS: PARTIAL | REVOKE: PASS (evidence) | RATE LIMIT: PASS | SECURITY: PASS
- MARKETPLACE: PASS | CATEGORIES: PASS | BUILD: PASS | TESTS: PARTIAL
- PRODUCTION SMOKE: PASS/PARTIAL/BLOCKED as above
- **AWS/KMS: NOT TOUCHED · MAINNET: NOT TOUCHED · AGENT 1816: NOT TOUCHED ·
  JOB 515: NOT TOUCHED · BLOCKCHAIN TRANSACTIONS: NONE · COMMIT: NO · PUSH: NO**

Stop after X.66 — no X.67 work started.