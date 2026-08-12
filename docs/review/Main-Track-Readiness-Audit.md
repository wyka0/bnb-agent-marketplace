# Main-Track Readiness Audit — BNB Chain "Build the Era" Hackathon

**Date:** 2026-08-11 · **Type:** Read-only audit (no code, no data, no env, no deploy, no git changes) · **Verdict:** `MAIN TRACK READINESS: NEEDS WORK`

---

## 1 · Purpose & Method

This audit scores the repository against the **admin main-track judging criteria** only. It is evidence-based: every conclusion carries a tag, and no requirement is inferred beyond what the official announcement states.

- Read the full `apps/web/app` route inventory (27 files) and every page/view component.
- Read the server data loaders (`lib/eight004scan/*`, `lib/pancakeswap/*`, `lib/termix/*`) and the integration adapters (`packages/integrations/src/{altana,termix,pancakeswap}/*`).
- Ran two bounded live observations (read-only HTTP): one GET to 8004scan, one GraphQL POST to NodeReal PancakeSwap.
- Checked deployment surface: Dockerfile, docker-compose.yml, `.github/workflows/ci.yml`, next.config, README (deployment/production sections), git state.
- **No files were modified. No secrets were printed. No build or test suite was executed.**

## 2 · Judging Criteria (Main Track) — admin source of truth

[ADMIN REQUIREMENT] Per "BUILD THE ERA: READ THIS FIRST", the main track is judged on:

1. **FUNCTIONALITY** — a complete end-to-end journey: _find → understand → activate_ an agent, with minimal friction.
2. **DATA QUALITY** — real-time, accurate, decide-able data (no placeholder/fabricated numbers).
3. **AGENT DIVERSITY** — four agent categories at **equal depth**: rebalancing, grid trading, yield optimisation, health-factor monitoring.
4. **PUBLIC ACCESSIBILITY** — the project must be publicly accessible during judging.
5. **Live agents on BSC** — agents must be live on the BNB Chain.

Partner bounty goals (TermiX Agent Advantage Report, Altana live onchain tx in explorer, PancakeSwap 1,000 CAKE challenge) are **separate** and are documented in §14 — they are not counted as main-track evidence here.

## 3 · Evidence Tags

- **[ADMIN REQUIREMENT]** — stated by the hackathon announcement.
- **[REPOSITORY FACT]** — verified in code at a cited path.
- **[LIVE OBSERVATION]** — verified by a live read-only call during this audit.
- **[INFERENCE]** — conclusion from repository facts, not directly stated.
- **[UNKNOWN]** — could not be verified within audit constraints.

## 4 · Repository & Environment Facts

- Monorepo at `C:\bnb-agent-marketplace`. Turborepo + pnpm workspaces. Next.js 15.5 (App Router, standalone output), React 19, Tailwind, Prisma (schema intentionally empty per README).
- **[REPOSITORY FACT]** Root `.env.local` (gitignored) sets `8004SCAN_API_KEY` (server-only) and `PANCAKESWAP_API_KEY` (URL form, server-only). `EIGHT004SCAN_BASE_URL` unset. `apps/web/.env.local` does **not** exist, so `next dev` sees no keys (Next loads env from `apps/web/`).
- **[REPOSITORY FACT]** Git repo initialized locally; nothing staged/committed/pushed; **no remote** (no GitHub/CI trigger; CI workflow would never run against a remote).
- **[REPOSITORY FACT]** No `route.ts` API routes exist anywhere under `apps/web/app` — all data flows through server components → server-only lib loaders → discriminated states → client views.
- **[REPOSITORY FACT]** README Status: "live foundation … Live registry data and any payment/execution flows require external keys" — README is honest about the current state.

## 5 · FUNCTIONALITY — Find → Understand → Activate

### 5.1 Find agents

- **[REPOSITORY FACT]** `/marketplace` (`apps/web/app/(app)/marketplace/page.tsx`): a complete client-side UI framework — toolbar, filters (local `useState` only), search input (not wired to any query), agent cards written as skeleton placeholders. **No data fetch whatsoever**; the page renders "Waiting for ERC-8004 Registry" skeletons.
- **[REPOSITORY FACT]** `/agents` (`apps/web/app/(app)/agents/page.tsx`): pure EmptyState — "No agents to show", "Agent listings arrive with the data layer in a future milestone."
- **[REPOSITORY FACT]** Search/facets never issue a request anywhere in the app.

### 5.2 Understand agents

- **[REPOSITORY FACT]** `/agents/[slug]` (`page.tsx`): `force-dynamic`; metadata from slug only; **no agent record lookup**; optional TermiX reputation fetched server-side **only** when explicit query params (`?tokenId=&chainId=&contract=`) identify an agent — otherwise the honest "not available" state.
- **[REPOSITORY FACT]** `agent-detail-view.tsx` (955 lines): a complete "Agent Details Framework" whose every live value renders Skeleton / "Pending" chip / em-dash. Blocks (Trust & Verification, Capabilities, Permissions, Performance, Pricing, Activity, Related) are all awaiting "ERC-8004 Registry sync".
- **[REPOSITORY FACT]** PancakeSwap Pool Intelligence block on the detail page: honest failure states; live call currently returns `server-error` (§13).

### 5.3 Activate agents

- **[REPOSITORY FACT]** `ACTIVATION MECHANISM NOT IMPLEMENTED`:
  - "Hire" button (desktop rail + mobile fixed bar, `agent-detail-view.tsx` lines 526–540, 940–950): `disabled`, title "Hire arrives with the live ERC-8004 Registry".
  - "Connect Wallet" (`components/top-nav.tsx` line 45, `components/home/home-nav.tsx`): `disabled`, "Wallet connection arrives in a future sprint".
  - `/login`: placeholder card — "Wallet authentication is implemented in the auth phase".
  - Altana x402 / ERC-8183 adapters exist as **execution-gated libraries** (see §12) but are referenced by **no page** (no wiring to UI, no session key, no signing).
- **[INFERENCE]** End-to-end journey status: **find ✗ · understand ◐ (framework, pending values only) · activate ✗**.

## 6 · DATA QUALITY — real-time, accurate, decide-able

- **[REPOSITORY FACT]** Strong honesty discipline: "—"/"Pending" everywhere instead of fake zeros; cumulative volume is labeled cumulative (never 24h); APR/APY never fabricated; a genuine API `0` is rendered verbatim (TermiX); no composite reputation.
- **[REPOSITORY FACT]** `/leaderboards` (`lib/eight004scan/leaderboard.ts` + `leaderboard-types.ts` + view): real normalized 8004scan data when the key is set; honest `missing-key / empty / offline / unauthorized` states otherwise; `force-dynamic` so it never runs at build.
- **[LIVE OBSERVATION]** Live probe (§13) confirms the leaderboard source is **live and accurate-capable**: GET returned `success=True`, 3 agents rendered (Toppa 94, Clawdia 93.87, Agentic Eye 93.73), total indexed agents = **404,853**.
- **[LIVE OBSERVATION]** PancakeSwap live call returns HTTP 500 from the NodeReal free source (every body, incl. `{ __typename }` and `{}`); premium tier returns HTTP 405; bogus key returns 401. The app maps this honestly to "PancakeSwap data is temporarily unavailable".
- **[INFERENCE]** Data quality: **real where wired (Leaderboards only)**, honest-pending everywhere else, **not decide-able** (no agent can be assessed from the marketplace today: no agent rows, no pricing, no live performance).

## 7 · AGENT DIVERSITY — four categories, equal depth

| Category           | Page exists                   | Dedicated component           | Live agents | Real data           | Activation | Depth          |
| ------------------ | ----------------------------- | ----------------------------- | ----------- | ------------------- | ---------- | -------------- |
| Rebalancing        | ✅ `categories/rebalancing`   | ✅ shared `CategoryDashboard` | ✗           | ✗ (all metrics "—") | ✗          | Structure only |
| Grid trading       | ✅ `categories/grid-trading`  | ✅ shared                     | ✗           | ✗ ("—")             | ✗          | Structure only |
| Yield optimisation | ✅ `categories/yield`         | ✅ shared                     | ✗           | ✗ ("—")             | ✗          | Structure only |
| Health-factor      | ✅ `categories/health-factor` | ✅ shared                     | ✗           | ✗ ("—")             | ✗          | Structure only |

- **[REPOSITORY FACT]** `components/category-dashboard.tsx`: one shared component — 4 static category cards + 4 metric tiles hardcoded to "—" + search input that does nothing + EmptyState "…agents coming soon / …populated when the catalog data layer ships".
- **[REPOSITORY FACT]** Leaderboards facet lists the 4 categories; 8004scan does not classify category (view renders honest "—").
- **[INFERENCE]** Four equal **empty** dashboards = equal depth of UI, zero depth of content. Criterion **FAIL** as judged.

## 8 · PUBLIC ACCESSIBILITY

- **[REPOSITORY FACT]** Dockerfile (Next standalone, non-root, port 3000) and docker-compose (Postgres 16 + Redis 7, local dev) exist; CI workflow exists (lint/typecheck/build/format).
- **[REPOSITORY FACT]** README documents **no production URL, no domain, no hosting platform**; only `localhost:3000` dev instructions.
- **[REPOSITORY FACT]** No Vercel/Netlify/CF Pages config; no git remote; nothing committed.
- **[INFERENCE]** Currently **LOCAL ONLY — not publicly accessible**. Deploy primitives exist (container + CI + keyless-safe app) but no deployment has been performed.

## 9 · LIVE BSC AGENTS

- **[REPOSITORY FACT]** The app surfaces **zero agents** today (marketplace skeletons, agents EmptyState, dashboards empty).
- **[LIVE OBSERVATION]** The 8004scan index (live, external, mainnet, `isTestnet=false`) holds 404,853 registered ERC-8004 agents — real agents exist on-chain, but none are wired into find/understand/activate flows.
- **[REPOSITORY FACT]** TermiX lookups are BSC **testnet** (chain 97) only; ERC-8183 is testnet-only by adapter contract; PancakeSwap pools are BSC mainnet (chain 56) read-only but source-blocked.
- **[INFERENCE]** Criterion **FAIL** for "agents live on BSC **in this marketplace**" (external agents exist; nothing listed, nothing activatable).

## 10 · ACTIVATION MECHANISM

**`ACTIVATION MECHANISM NOT IMPLEMENTED`** (declared, not invented, not implemented):

- No wallet connection anywhere in the app (top-nav + home-nav buttons disabled; `/login` placeholder; no `viem`/wagmi/provider in any page).
- No hire/execute surface in the UI ("Hire" disabled in both desktop rail and mobile bar).
- Adapter libraries exist (`altana/x402.ts`, `altana/erc8183.ts`, `altana/marketplace.ts`) but are **not imported by any app file** and their execution paths deliberately throw/报告 `not-implemented` / `pending` (no transaction is ever submitted).
- No session keys, no spend caps, no payment rail reachable from the UI.

## 11 · Page-by-Page Evidence

| Route                   | File                                        | State                                                                                                                                    |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (home)              | `app/(home)/page.tsx` + `components/home/*` | Marketing copy; hero claims "discover, compare, hire"; recent-activity empty; Connect Wallet disabled                                    |
| `/marketplace`          | `app/(app)/marketplace/page.tsx`            | UI-only framework; statuses `["Live","Paused","Updating","Coming Soon"]`; skeleton cards; "Waiting for ERC-8004 Registry"; no data calls |
| `/agents`               | `app/(app)/agents/page.tsx`                 | EmptyState "No agents to show"                                                                                                           |
| `/agents/[slug]`        | `page.tsx` + `agent-detail-view.tsx`        | Detail framework; all values pending; Hire disabled; TermiX + PancakeSwap blocks honest; "Waiting for ERC-8004 Registry" (line 736)      |
| `/compare`              | `compare-view.tsx`                          | Slots UI + comparison matrix of Pending/— values; "Add Agent" disabled ("Available with registry sync")                                  |
| `/leaderboards`         | `page.tsx` + `leaderboards-view.tsx`        | **Only live-data page** (no key → honest unavailable; key set → real 8004scan rows)                                                      |
| `/categories` + 4 pages | `categories/*` + `category-dashboard.tsx`   | Equal empty dashboards ("—" metrics, coming-soon EmptyState)                                                                             |
| `/dashboard`            | `dashboard/page.tsx`                        | Hardcoded `0 active agents`, `0.00 BNB` stats + empty state (honest, but not data-driven)                                                |
| `/login`                | `login/page.tsx`                            | Placeholder ("auth phase")                                                                                                               |
| `/profile`, `/settings` | `profile/page.tsx`, `settings/page.tsx`     | Placeholder shells                                                                                                                       |

## 12 · Data Layer Classification

| Data layer                                   | Classification                                                | Evidence                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 8004scan (Leaderboards)                      | **LIVE-CAPABLE, key configured**                              | `lib/eight004scan/client.ts`, `leaderboard.ts`; live probe OK (§13); key present in root `.env.local`                           |
| 8004scan (Marketplace/detail/categories)     | **NOT WIRED**                                                 | No import of the client outside leaderboards; marketplace/detail do not fetch                                                   |
| TermiX AACP                                  | **LIVE-CAPABLE (read-only), identity-gated**                  | `lib/termix/reputation.ts` mirrors verified adapter; chain 97 only; requires `?tokenId&chainId&contract`                        |
| PancakeSwap pools                            | **BLOCKED (source HTTP 500)**                                 | `lib/pancakeswap/client.ts`; `resolvePancakeSwapEndpoint` supports raw key or URL form; live probe see §13                      |
| Altana x402 / ERC-8183 / marketplace service | **EXECUTION-GATED (not wired, explicitly `not-implemented`)** | `packages/integrations/src/altana/*`: signing boundary always throws "no transaction was submitted"; testnet-only; no UI import |

## 13 · Live Observations (read-only, this audit)

1. **8004scan GET /agents** (`page=1&limit=3&isTestnet=false&sortBy=total_score&sortOrder=desc`, `X-API-Key` from `.env.local`): **HTTP 200, `success=True`**, `data` length 3 (Toppa / Clawdia / Agentic Eye), `meta.pagination.total = 404853`. → the leaderboards loader would render `state:"ready"` with real rows.
2. **NodeReal PancakeSwap GraphQL POST** (all bodies incl. `{ __typename }` and `{}`): **HTTP 500** with the real key (§4/§13 of `PancakeSwap-Live-Source-Implementation-P4.md`: `PANCAKESWAP P4 STATUS: FAILED — SOURCE/SCHEMA ERROR`); premium path POST → 405; bogus key → 401; GET variants → 404. → source-side failure, **external blocker**, app handles it honestly.
3. **Dev-server smoke test** (prior task, `pnpm dev`): Next 15.5.23 served `http://localhost:3000`; pages render the pending states described; stopped afterwards (port 3000 free, no repo processes).

## 14 · Partner Bounties (separate from main track)

- **[ADMIN REQUIREMENT]** TermiX Bounty — Agent Advantage Report: adapter + UI block exist; **live-capable only via explicit agent identity query params** on the detail page; needs a resolvable registered identity to demo.
- **[ADMIN REQUIREMENT]** Altana Bounty — live onchain tx in Altana explorer (testnet counts): adapters exist (x402 + ERC-8183 testnet verifiers per `Altana-X4A-Testnet-E2E.md`), but **no live transaction has been submitted and none can be from the app** (execution boundary).
- **[ADMIN REQUIREMENT]** PancakeSwap Bounty — the 1,000 CAKE challenge: pool-intelligence block exists but **never returns `ready`** (source 500) — unavailable for demo, pending source/credential fix.
- **[LIVE OBSERVATION]** 8004scan is not an administered bounty but the platform's registry index; live and healthy (404,853 agents).

## 15 · Risks & External Blockers

1. **NodeReal PancakeSwap free tier** returns HTTP 500 server-side on every request (external; premium path 405). Fix options: alternate source/endpoint, premium credential, or an indexer fallback — all require implementation (out of audit scope).
2. **TermiX identity mapping**: reputation is per-agent-NFT; a slug-only route has no deterministic mapping — demo needs the `?tokenId&chainId&contract` path with a real testnet identity.
3. **No deployment**: local-only; no remote, no domain, no hosting config; CI exists but cannot run until a remote exists.
4. **`apps/web/.env.local` absent**: `next dev` picks up no keys; any local demo of live leaderboards needs the key in the app env (or env injection at deploy time).
5. **README/announcement exposure**: hero copy says "discover, compare, hire" — the UI cannot do those today; the README status section is accurate, the home hero is marketing copy.

## 16 · Gap Priorities — recommended next phase (ranked)

1. **Wire live agents into the catalog** — reuse the proven 8004scan client + normalization for `/marketplace` and `/agents/[slug]` (find + understand). Highest value; pattern already exists in the repo (leaderboards precedent).
2. **Activation** — wallet connect + a hire surface; the x402/ERC-8183 adapters already define the intended boundary; implement signing/execution per the adapters' contract (requires the deliberate removal of the "no transaction" boundary), then wire to the disabled Hire button.
3. **Category depth** — per-category data from the registry (or clearly-labeled demo agents) so all four categories show real rows.
4. **Public deployment** — container + CI exist; add hosting (e.g. Vercel/CF) + app-level env secrets + a production URL; commit + push so CI runs.
5. **PancakeSwap source** — resolve the external 500 (alternate endpoint/credential) so the Pool Intelligence block can render `ready` (also unblocks the bounty demo).

## 17 · VERDICT — Main-Track Readiness

```
FUNCTIONALITY        FAIL   (find ✗ / understand ◐ pending-only / activate ✗)
DATA QUALITY         PARTIAL(real only on Leaderboards; honest everywhere; not decide-able)
AGENT DIVERSITY      FAIL   (4 equal empty dashboards)
LIVE BSC AGENTS      FAIL   (0 surfaced; 404,853 exist externally on 8004scan)
PUBLIC ACCESSIBILITY FAIL   (local-only; no remote, no URL, no deployment)
ACTIVATION           NOT IMPLEMENTED
```

> `MAIN TRACK READINESS: NEEDS WORK`

The repository is a complete, honest **UI + integration framework**: every screen exists, every integration adapter is designed and boundary-tested, and the only live-data page (Leaderboards) is verified working against a real registry today. But measured against the admin's five judging criteria, the demo journey (find→understand→activate), category depth, live BSC agents, and public accessibility are all missing. #1 gap to close next: **wire the catalog (marketplace + agent detail) to the live 8004scan registry** using the existing in-repo pattern, then add activation and deploy publicly.

---

_Audit only — no files, data, credentials, deployments, or git operations were modified during this audit. Evidence files referenced: `docs/review/Pre-Publication-Safety-Check.md` (PRE-PUBLICATION: READY), `docs/review/PancakeSwap-Live-Source-Implementation-P4.md` (source 500), `docs/review/Altana-X4A-Testnet-E2E.md`, `docs/review/Public-Repository-Readiness-Audit.md`._
