# Main Track Activation — X.63 Homepage Production Deployment

**Scope:** deploy the already-completed, locally-verified X.62 homepage fix to the
EXISTING Vercel production project `bnb-agent-marketplace-web`. No code changes
were made in this milestone. No commits, no pushes, no blockchain transactions.

## Result: DEPLOYED — all items PASS (one expected 404 documented)

Deployment: `bnb-agent-marketplace-5ppik83mq-solo-25cb.vercel.app`
- deployment id `dpl_Abw5op6Wi1mqhG6gNL83UAQKvGiU`
- target **production**, status **READY**
- aliased to `https://bnb-agent-marketplace-web.vercel.app/` (Vercel reported
  "Aliased" to the production domain)

## Checklist

| # | Item | Result |
|---|------|--------|
| 1 | Working tree contains the X.62 homepage changes | **PASS** — `git status` shows `M apps/web/app/(home)/page.tsx` plus the X.62 home components modified and `D apps/web/components/home/skeleton-agent-card.tsx`; `git diff` confirms `force-dynamic` / `getMarketplaceAgents` / `getBscCategoryDiscovery` / `Suspense fallback={null}` present. No deployment of an old commit: deploy command ran from the current working tree. |
| 2 | Existing Vercel project confirmed | **PASS** — `.vercel/project.json` = `projectName "bnb-agent-marketplace-web"`, `orgId team_87sELDtq8WMlh52qkmDNmEAV`, `projectId prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`. |
| 3 | Authenticated against the existing project | **PASS** — `vercel whoami` → `wyka0` (Vercel CLI 59.1.3 via `pnpm dlx`); no new project created. |
| 4 | Deployed the CURRENT local code (X.62) | **PASS** — `vercel deploy --prod --yes` from repo root; new homepage chunk `static/chunks/app/(home)/page-c70ca085e7e9efa9.js` proves the fresh X.62 build is live (old build used `page-180dc7abe250dc2a.js`). |
| 5 | X.61 clean-build configuration preserved | **PASS** — `vercel.json` unchanged and honored: `installCommand pnpm install --frozen-lockfile`, buildCommand `env -u PRISMA_QUERY_ENGINE_LIBRARY sh -c 'pnpm --dir ../../prisma exec prisma generate && rm -rf .next && pnpm build'`, framework nextjs, outputDirectory `.next`. No stale `.next` cache (build wipes it remotely every time); Prisma engine config untouched; outputFileTracingIncludes intact (build log: "Build Completed in /vercel/output"). |
| 6 | No Neon / AWS/KMS / Altana / mainnet / Agent 1816 / Job 515 / blockchain changes | **PASS** — zero code or config writes this milestone. |
| 7 | No blockchain transactions | **PASS** — no tx logic invoked; deployment creates no transactions. |
| 8 | No commit / push | **PASS** — nothing committed or pushed; only `vercel deploy` was executed. |
| 9 | Production URL reachable | **PASS** — `https://bnb-agent-marketplace-web.vercel.app/` → HTTP 200 (176,321 bytes). |
| 10 | Homepage specifics | **PASS** — see evidence below. |
| 11 | Obsolete strings absent from production HTML | **PASS** — none of the four required strings found, plus four extras verified absent (see table below). |
| 12 | Route regression matrix | **PASS** (one expected 404 documented) — see table below. |
| 13 | /marketplace live registry data | **PASS** — "Live from the 8004scan registry (page 1, newest first)… 423,066 agents indexed", 24 real `AgentCard`s rendered, no obsolete strings. |
| 14 | Production smoke/regression checks | **PASS** — see below. |
| 15 | Deployment failure handling | N/A — deployment succeeded on the first attempt. |

## Evidence

### Homepage `/` (HTTP 200, 176,321 bytes)
- Seven live sections render server-side: "Four specialized tracks", "Newest
  marketplace listings", "Featured Agents", "Marketplace snapshot", "Compare
  agents side by side", "Ecosystem statistics", and the GlobalSearch caption
  "Searches the live ERC-8004 agent registry — results open on the
  Marketplace." (the search form itself submits to `/marketplace?q=<query>`).
- Real 8004scan data rendered:
  - Marketplace snapshot: **Agents in registry 423,066** (API total),
    **Live listings shown 24**, **Verified agents 0** (registry `is_verified`
    on page 1 — honest zero), **Last indexed 8/16/2026**.
  - Ecosystem statistics: **423,066** registered agents, **94** BSC category
    matches (bounded keyword discovery sum), **4** supported categories,
    **6** networks on page 1 — all derived, none fabricated.
  - Featured agents: **6** real `AgentCard`s ("View Details" ×6, "Hire/Soon"
    ×6) with 19 `/agents/…` detail route references.
  - Recent listings: newest-first rows of real registry records.
  - Category tracks: live "N matched" chips render from the discovery buckets
    (94 total across tracks, matching the Ecosystem statistic).
- No infinite-spinner condition: RSC stream is complete — `template id="B:0"`
  = 1 and `$RC("B:0","S:0")` swap = 1 (the synchronous swap reveals the page;
  identical healthy structure to `/marketplace`). The `app/loading.tsx` spinner
  remains the shared root fallback for all dynamic routes and is resolved by
  the swap — it cannot persist.

### Obsolete-string scan (production HTML of `/`)
| String | Present? |
|---|---|
| "Loading live agents from registry" | absent |
| "Waiting for registry sync" | absent |
| "once integration ships" | absent |
| "Synced from 8004scan once live" | absent |
| "awaiting registry sync" | absent |
| "will appear here as the live feed" | absent |
| "ready for future 8004scan integration" | absent |

### Route regression matrix (production)
| Route | HTTP | Notes |
|---|---|---|
| `/` | 200 | X.62 homepage |
| `/marketplace` | 200 | live registry (423,066 indexed, 24 cards) |
| `/categories/rebalancing` | 200 | "Rebalancing Agents" page |
| `/categories/grid-trading` | 200 | "Grid Trading Agents" page |
| `/categories/yield` | 200 | "Yield Optimization Agents" page (the four-track route set uses `/categories/yield`) |
| `/categories/yield-optimisation` | 404 | **Expected** — this slug does not exist in the app's route set (`app/(app)/categories/yield` is the canonical route); not a regression |
| `/categories/health-factor` | 200 | "Health Factor Monitoring Agents" page |
| `/login` | 200 | unchanged shell |

### Smoke checks
- `GET /api/auth/me` → 200 `{"ok":true,"data":null}` (unauthenticated-safe,
  unchanged).
- `POST /api/auth/nonce` from bare curl → 403 "Request rejected." — the X.43
  browser-context guards (origin/fetch-metadata/CSRF) rejecting a non-browser
  caller; expected behavior, not a regression (a full SIWE browser flow with
  the real headers was already verified in X.61).
- `/marketplace` carries no obsolete strings; AgentCard rows = 24 (the full
  fetched page).

## Failure classification

Not applicable — the deployment succeeded on the first attempt; no
authentication, configuration, build, Prisma, environment, runtime, routing, or
hydration failures were encountered.

## Notes

- The only 404 observed (`/categories/yield-optimisation`) is the documented
  route-name difference; the actual four-track route is `/categories/yield`.
- The X.50 check-24 stale assertion noted in X.62 remains untouched (out of
  scope; `next.config.mjs` unchanged).
- STOP: this milestone ends here. No Profile / Settings / Dashboard /
  Hire/Activation / AWS-KMS / Main Track expansion work was started.