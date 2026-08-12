# BNB Agent Studio Marketplace

## Product Requirements Document (PRD) v1.0

**Author:** Principal Software Architect / Product Lead
**Status:** Draft for review → Blueprint for development
**Scope:** Production-ready AI Agent Marketplace for BNB Chain (Agent Studio Hackathon)
**Primary Goal:** Maximize judging score across **Functionality**, **Data Quality**, and **Agent Diversity**.

---

# Table of Contents

- **Part I — Product**
  - 1. Executive Summary
  - 2. Product Vision
  - 3. User Personas
  - 4. User Journey
- **Part II — Requirements**
  - 5. Functional Requirements
  - 6. Non-functional Requirements
  - 7. Feature Prioritization (MoSCoW)
- **Part III — System Design**
  - 8. Complete Page List
  - 9. Complete Component Hierarchy
  - 10. Navigation Flow
  - 11. Dashboard Layout
- **Part IV — Data & APIs**
  - 12. Database Design
  - 13. Entity Relationship Diagram (ERD)
  - 14. API Design
- **Part V — Engineering**
  - 15. Folder Structure
  - 16. Technology Stack
  - 17. Authentication Strategy
  - 18. Wallet Integration Strategy
  - 19. Live Data Strategy
  - 20. Performance Monitoring Strategy
  - 21. Security Architecture
  - 22. Permission Model
  - 23. Error Handling Strategy
  - 24. Logging Strategy
- **Part VI — Delivery**
  - 25. Deployment Architecture
  - 26. CI/CD Pipeline
  - 27. Environment Variables
  - 28. Third-party Integrations
- **Part VII — Product Craft**
  - 29. UI Design System
  - 30. Typography
  - 31. Color Palette
  - 32. Icon System
  - 33. Responsive Strategy
  - 34. Accessibility Requirements
  - 35. SEO Strategy
  - 36. Performance Optimization Strategy
- **Part VIII — Governance**
  - 37. Risk Assessment
  - 38. Future Scalability
  - 39. Development Milestones
  - 40. Suggested GitHub Project Structure

---

# PART I — PRODUCT

## 1. Executive Summary

BNB Agent Studio Marketplace is a **discovery, hiring, configuration, and monitoring platform** for AI agents running on BNB Chain. It moves beyond being a "list of agents" to become the **operational control plane** for agentic finance on BNB.

The product addresses a concrete market gap: users can deploy AI agents (rebalancers, grid traders, yield optimizers, health monitors) but have no unified place to **discover, compare costly assets, risk-sandbox their access, and monitor live performance**. This marketplace standardizes that lifecycle.

**Judge-facing value proposition (3 pillars):**

| Pillar              | What we ship                                                                         | What it scores                        |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| **Functionality**   | Full lifecycle: discover → compare → configure permissions → hire → monitor → manage | Complete, working end-to-end flows    |
| **Data Quality**    | Live on-chain + performance + reputation data with strong schemas                    | Trustworthy, real-time, accurate data |
| **Agent Diversity** | 4 mandatory categories, partner tracks, and multi-venue support                      | Broad, credible catalog               |

Our differentiation vs. a generic agent index: **on-chain permission primitives (ALTANA Agent Wallet / Session Keys), live cross-market performance data (TERMIX reports), and yield intelligence (PancakeSwap LP/APR)** embedded as first-class product features—not bolt-ons.

---

## 2. Product Vision

**Tagline:** _"The operating system for AI agents on BNB Chain."_

**Vision Statement:** To become the default, open-source-aligned marketplace where teams discover, credential, permission, and monitor AI agents—debating by trust, live performance data, and safety by construction (least-privilege, revocable access).

**Design Principles:**

1. **Trust before hype** — every agent carries verifiable code/audit status, permission surface, and live PnL.
2. **Least privilege by default** — no agent ever gets unlimited wallet access; spend caps and expiry are mandatory at hire time.
3. **Data is the moat** — consistency, freshness, and provenance of market/perf data define quality.
4. **Progressive disclosure** — browse freely, depth on demand; onboarding a hire is a wizarded, safe flow.
5. **Fn we measure it** — every screen maps to one of the three judging criteria; no dead ends.

---

## 3. User Personas

### P1 — The Retail Trader / "Degen degen"

- **Goal:** Automate and improve their BNB/USDT/ETH positions without being a developer.
- **Needs:** clear search/filter, plain-language capability explanations, one-click safe setup, transparent fees.
- **Fear:** runaway agent draining wallet → needs visible spend caps, revocation, and trial mode.

### P2 — The Power User / Quant Hobbyist

- **Goal:** Optimize yield across many chains/stables; compare strategies and swap.
- **Needs:** grid/rebalance/top metrics, backtest idea, session keys, portfolio-level dashboard.
- **Fear:** comparing apples-to-oranges → needs **TERMIX-style** human-vs-agent and time/cost/quality comparisons.

### P3 — The Manager / Product Owner (internal + hackathon judge)

- **Goal:** understand the breadth/depth/quality of the catalog at a glance.
- **Needs:** category dashboards, rankings, featured agents, health checks.

### P4 — The Agent Publisher / Builder

- **Goal:** list agents and grow adoption.
- **Needs:** submission flow, metadata schema, verification badges, analytics.

> **Why вовечеcard winner** — P1/P2 demonstrate full functionality; P3 powers "Agent Diversity & Data Quality" scoring; P4 generates supply.

---

## 4. User Journey

### Primary Journey: Discover → Hire → Configure → Monitor

```
1. DISCOVER
   Home → Category Dashboard → Filter/Search → Compare 2-4 agents → View agent detail
2. CONFIGURE (Permissions, at hire-time — the differentiator)
   Select custody mode → Set spend cap → Set expiry → Review revocation controls
3. HIRE
   Connect wallet → Deploy (create Agent Wallet session) → Fee authorization
4. MONITOR
   My Agents dashboard → Live PnL, health factor, allocations → Alerts/notifications
5. MANAGE
   Revoke / rotate keys / top up / edit caps / pause / terminate
```

### Supporting Journeys

- **Comparison Journey:** Search → multi-select → side-by-side capability + live-data table.
- **Onboarding Journey (no agent):** wallet connect → empty states → guided category introductions.
- **Builder Journey:** submit → validate metadata → publish → track installs/PNL shown.

---

# II — Requirements

## 5. Functional Requirements

### 5.1 Core Marketplace (FR-1xx)

| ID     | Requirement                                                                            | Category                     |
| ------ | -------------------------------------------------------------------------------------- | ---------------------------- |
| FR-101 | Search agents by name, tag, category, description, token, chain                        | Functionality                |
| FR-102 | Faceted filters: category, partner, chain, risk tier, audit, profitability range       | Functionality                |
| FR-103 | Sort: popularity, APY/APR, PnL, worst-case, newest, rating                             | Functionality                |
| FR-104 | Side-by-side comparison table (>=2 agents)                                             | Functionality / Data Quality |
| FR-105 | Agent detail page: capability, spec, permission blueprint, live metrics, cost, reviews | All                          |
| FR-106 | Categorone dashboards per 4 categories with independent metrics                        | All                          |
| FR-107 | Featured agent carousels ("Staff Picks", "Trending", "Best APY")                       | Functionality                |
| FR-108 | Goal-based "wizard" that recommends an agent (intro journey)                           | Functionality                |

### 5.2 Category Directory (FR-2xx) — all four equal priority

| Category               | Specific metrics                                     | Dashboards                      |
| ---------------------- | ---------------------------------------------------- | ------------------------------- |
| **Rebalancing**        | Rebalance frequency, drift tolerance, fee efficiency | Historical drift, cost saved    |
| **Grid Trading**       | Grid span, #levels, utilization, P&L/day             | Grid performance, filled levels |
| **Yield Optimization** | Realized/factory APY, compounding freq               | APY history, vault health       |
| **Health Factor**      | HF now, liquidation distance, alerts                 | HF trend, collateral coverage   |

Each category page exposes: dedicated page, dedicated metrics, search, filters, rankings, featured agents, and a category dashboard (required).

### 5.3 Hire & Permissions (FR-3xx) — ALT partner

- FR-301 Connect/create Agent Wallet.
- FR-302 Create a Session Key with **spend cap (Σ + per-period)**, **expiry**, and **revocation**. Required fields at hire.
- FR-303 Enforce that hiring is not possible without a valid session configuration (caps/expiry).
- FR-304 Persist authorization record; allow list/revoke/extend.
- FR-305 Support on-chain permission verification (via ALTNAT agent wallet) and store off-chain display mirrors.

### 5.4 Performance & Comparison (FR-4xx) — TERMLEX style

- **FR-401** Capture a "Agent Advantage Report": agent vs human benchmark on activity/time/cost/output.
- **FR-402** Benchmark maps: agent performance summary, human baseline scenario.
- **FR-403** Cost display transparency (deploy, gas, agent fee, spread).
- **FR-404** Time-to-task tracking and success/quality deltas.

### 5.5 LP & Yield (FR-5xx) — PancakeSwap integration

- **FR-501** LP optimization browser: pool APR ranking, sorted, filter by stable/volatile chain (BNB/BSC focus).
- **FR-502** Pool analytics: TVL, APR, volume, IL snapshot, depth.
- **FR-503** Yield suggestions ticking: "Deposit X in place on PancakeSwap" → seeded config.

### 5.6 Notifications & Monitoring (FR-6xx)

- FR-601 Realtime alert: HF threshold breach, spend-cap approach, PnL drawdown triggers.
- FR-602 Webhook + in-app notification inbox.

### 5.7 Admin & Data Quality (FR-7xx)

- FR-701 Agent listing metadata validation (required fields, uniqueness, logo, badges).
- FR-702 Badge/verification workflow (Audited, Verified Dev, Audited strategy).
- FR-703 Data freshness SLA enforcement + staleness indicators.

---

## 6. Non-functional Requirements

| Quality            | Requirement                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Performance**    | Lighthouse ≥90 mobile/desktop; First Contentful Paint <1.2s; API p95 <150ms READ; streaming-safe SSR for catalog     |
| **Availability**   | Target 99.9% marketplace uptime; graceful degradation when wallet RPC slow                                           |
| **Scalability**    | Stateless API; can serve 10k+ agents and 100k+ monthly users; cache-first reads                                      |
| **Security**       | Least-privilege sessions, signed/verified wallet signatures, audit all permission ops; zero server-held private keys |
| **Data Freshness** | Market/prices via websocket-ish cache ≤5s; on-chain balances ≤30s; agent perf ≤60s                                   |
| **Reliability**    | Retry + backoff on RPC; circuit breakers on third-party feed; consistent reads via single-writer pattern             |
| **Extensibility**  | Plugin registry for new Agent categories; partner track decoupled via adapters (DApp connectors)                     |
| **Accessibility**  | WCAG 2.1 AA; keyboard-navigable; contrast-safe tokens; reduced-motion support                                        |
| **Observability**  | Distributed traces, metrics, error sampling to Grafana/OTel; structured logs                                         |

---

## 7. Feature Prioritization (MoSCoW)

### Must Have (MVP — full happy-path)

- Global search / facets / sort / compare / detail.
- 4 category directories, each with its own dashboard + metrics.
- Hire flow with Session Key spend caps + expiry + revocation.
- Agent Wallet integration (agent login, session creation, key management).
- Live PnL / HF / APY dashboards and monitoring dashboard.
- TERMLEX-style Agent Advantage Report for at least 2 flagship agents.
- PancakeSwap LP APR ranking + pool analytics + yield suggestion.
- Reputation (ratings, review count) and leaderboards.
- Auth (web credential/tier) + wallet connect.

### Should Have

- Data Quality Center an admin (badge verification, metadata validation, staleness).
- Notifications (in-app) + email alert HF/drawdown.
- Backtest/strategy teaser without execution.
- Analytics for builders (optional semi-metrics).
- Multi-chain mimic (BNB mainnet + testnet view).

### Nice to Have

- Strategy playground / paper trading sandbox.
- Referral/community voting & "community curated" lists.
- Dark-mode polish + theme personalization.
- Agent quality risk-model scoring (fund/normalized).
- PWA install mode.

> **Optimization discipline:** No feature ships unless it pulls Functionality, Data Quality, or Diversity metric. (Justified per row ✓.)

---

# PART III — SYSTEM DESIGN

## 8. Complete Page List

**Public / Discovery**

- `/` Home (hero + featured + category rail + top rankings skew + trust bar)
- `/agents` Catalog (global, facets, sort)
- `/agents/:slug` Agent Detail (capability, live stats, cost, reviews, permissions)
- `/agents/:slug/compare` Compare view (multi-select)
- `/categories/rebalancing` Category directory + dashboard
- `/categories/grid-trading` Category directory + dashboard
- `/categories/yield` Category directory + dashboard
- `/categories/health-factor` Category directory + dashboard
- `/leaders` Leaderboards (rankings per category & global)
- `/lp/LP(` LP Opportunity optimizers (PancakeSwap pools/APR ranking)
- `/report/:id` Agent Advantage Report (TERMIX style)

**App / Private**

- `/dashboard` My Agents (hired list, status)
- `/dashboard/:agentId` Agent monitor (live PnL, positions, HF, risk)
- `/dashboard/permissions` My permission / session keys
- `/notifications` Alerts & events to watch
- `/account` Profile, wallet, settings
- `/builder` (optional) Publisher panel

**Standalone**

- `/onboarding` First-run / persona
- `/compare` standalone compare (no feature side panel)

**System / UX**

- `/login` Connect wallet
- `/403` `/404` `/500` `/maintenance` error states

---

## 9. Complete Component Hierarchy (Headless view)

```
<Layout>
 ├─ <AppShell>
 │   ├─ <TopNav> (Logo, Search, CategoryMenu, Notifications, Account)
 │   ├─ <Sidebar> (collapsible: market/filters modes)
 │   └─ <Footer> (trust links, status)
 ├─ Pages
 └─ GlobalOverlays: <ToastProvider>, <ModalProvider>, <CommandPalette>

Shared primitives (headless package):
 <Button>, <Card>, <Badge/BadgeGroup>, <Input/Select/Combobox>, <Tabs>,
 <DataTable>, <Skeleton>, <EmptyState>, <ErrorBoundaryCard>, <Avatar>,
 <StatTicker>, <Sparkline>, <DonutStatus>, <Chips/FilterChips>, <Pagination>

Discovery domain:
 <SearchBar>, <FacetedFilter>, <SortSelector>, <ResultGrid>, <CompareStrip>,
 <AgentCardCompact/Extended>, <FeaturedCarousel>, <LeaderboardTable>

Agent detail:
 <Header/cover>, <CapabilityMap>, <PermissionsPanel>, <LiveMetricsStrip>,
 <MetricsTable>, <CostBreakdown>, <ReviewsPanel>, <DQBadgesRow>, <HireCTA>

Category system:
 <CategoryHero>, <CategoryMetricsGrid>, <FeaturedForCategory>, <RankingTable>

Performance/Compare:
 <AgentAdvantageReport>, <MetricCompareRow>, <TimeCostQualityBars>, <BaselinePlot>

Partner (Pancake):
 <PoolRankTable>, <PoolCard>, <YieldSuggestion>, <LPChartStrip>

Monitor:
 <DashboardHeader>, <PositionCard>, <RiskGauge>, <PermissionChip>,
 <AlertFeed>, <LiveChart>
```

---

## 10. Navigation Flow

- **Global top nav** = always visible: Logo → Search → Menu (Categories, Leaderboards, Yield/lp) → Notifications → Account.
- **Breadcrumbs** on all interior pages.
- **Primary flows:**
  - Discover: `/` → category → catalog → filters → detail → compare
  - Hire: detail → `Configure & Permission` (caps/expiry) → wallet connect/gstatus → success → `/dashboard/:id`
  - Monitor: `/dashboard` → live agent → alert panel → **revoke** (returns to marketplace)
- **Fallback:** Any `404` → suggestions; command palette (`⌘K`) glob for agents/categories.

---

## 11. Dashboard Layout (initially for `/dashboard`)

```
┌────────────── TopNav (nav + account) ──────────────┐
├────────────────────────────────────────────────────┤
│  Overview header: "Your Agents" · Total Value ·  │
│  total PnL · # active · ⚠ pending   [Actions]      │
├──────────┬─────────────────────────────────────────┤
│  Sidebar │  Agent grid (cards) / split             │
│ (nav)    │  + "Connected source / First 30 days"   │
│          ├─────────────────────────────────────────┤
│  Quick    │  Per-agent: Live PnL · HF · risk ·     │
│  alerts   │  permissions status · next action      │
│  KPIs     ├─────────────────────────────────────────┤
│  │        │  Alert feed (threshold breaches)        │
├──────────┴─────────────────────────────────────────┤
│  Footer                                              │
└─────────────────────────────────────────────────────┘
```

Each hire maps to a row card that deep-links to `/dashboard/:agentId` with dedicated monitoring (`LiveMetricsStrip`, `RiskGauge`, `PositionCard`, `PermissionCerts`).

---

# PART IV — DATA & APIs

## 12. Database Design

**DB:** PostgreSQL (relational, strong refs, JSONB for flexible metrics) + Redis (cache/session/rate-limit) + optional ClickHouse/time-series for performance snapshots.

**Core tables:**

- `users` (id, email_hashed?, role, created)
- `wallets` (id, user_id, address, chain, provider, is_default)
- `agent_versions` (id, slug, name, category, description, icon, chain, tags jsonb, risk_tier, audit_status, price_model jsonb, metadata schema, publisher_id, created/active)
- `agent_listings` (snapshot/deprecation wrapper over versions for marketplace or promote) — or reuse `agent_versions`
- `sessions` (id, user_id, agent_listing_id, wallet_id, status, spend_cap total, per_period_cap, expiry, created, revoked_at)
- `permissions` (id, session_id, scope, allowance, period_cap, expiry, revoked_at, on_chain_tx_hash)
- `deployments` (id, session_id, chain, contract/account address, status, last_synced_at)
- `positions` (id, user_id, agent_id, protocol, token, qty, value, avg_entry, unrealized/pnl)
- `performance_snapshot` (id, deployment_id, ts, pnl, value, apy, health_factor, position_count)
- `ratings_reviews` (id, agent_id, user_id, rating, text, ts, whose_deployment_id)
- `category_metrics` (computed/dashboard row per category)
- `lp_pools` (id, dex, pool, symbol, apy, apr, tvl, vol_24, chain, ts)
- `advantage_reports` (per the report, human vs agent, time/cost/quality)
- `notifications` (id, user_id, type, payload jsonb, read_at)
- `alerts` (id, deployment_id, type, threshold, triggered_at, ack)
- `jobs`/`sync_state` (for pipeline freshness)
- `audit_log` (id, user_id, action, entity, data jsonb, ip, ts)

**Index strategy:** (category), (category, sort_key), (wallet_id, active), (deployment_id, ts DESC), (agent_id snapshot), (slug) unique.

---

## 13. Entity Relationship Diagram (ERD)

```
Users 1──< Wallets 1──< Sessions 1──< Permissions
   │                      │
   │                      └──< Deployments 1──< PerformanceSnapshot
   │                                      │        │
   │                                      │        └──< Positions
   │                                      └──< Alerts
   └── ha AgentListings (agent_versions)
                  │
                  ├──> Category (rebalanceall/grid/yield/health)
                  ├──< Ratings/Reviews (via user)
                  ├──< AdvantageReport
                  └──< LP pools (global/yield domain)
```

Relationships:

- One user → many wallets.
- One wallet → many agent sessions.
- One session → many deployable permissions (spend cap, expiry, revocation each represent a permission row).
- One deployment → many performance snapshots and positions.
- One agent listing → many sessions/deployments; also → reviews and advantage reports.
- Marketplace browsing operates at `agent_listings`; ownership/monitoring at `sessions/deployments`.

---

## 14. API Design

REST/JSON (v1) with typed responses + OpenAPI (request body coherent, ids consistent). GraphQL optional later.

### Auth & Wallet

- `POST /auth/connect` — verify wallet sig (EIP-191/EIP-1271) → JWT.
- `POST /auth/session` — create Agent Wallet session.
- `GET /sessions` | `GETS /sessions/:id` | `POST /sessions/:id/revoke` | `POST /sessions/:id/extend`.

### Catalog

- `GET /agents?category=&chain=&risk=&audit=&sort=&page=` (faceted; supports `compare` via ids).
- `GET /agents/:slug` (detail, capabilities, metrics).
- `GET /agents?ids=a,b,c` → compare payload.
- `GET /categories` + `GET /categories/:id` (dashboard summary).

### Performance/Prices

- `GET /agents/:id/performance?range=` (PnL series).
- `GET /positions/:deploymentId` (live positions/hf).

### Pancake LP

- `GET /lp/pools?chain=&sort=apr&pool_type=` ranking.
- `GET /lp/pools/:id` analytics.
- `GET /lp/yield-suggestions?balance=`.

### TERMIX reports

- `GET /agents/:id/advantage-report` (time/cost/quality vs baseline).

### Notifications

- `GET /notifications` | `POST /notifications/:id/read`.

**Rate limits:** per-auth-token; Redis. **Idempotency:** POST hire/revoke keyed by `X-Idempotency-Key`.
**Live:** WebSocket `GET wss://api/stream?agentIds=` pushes snapshot deltas to abs-forward dashboards.

---

# PART V — ENGINEERING

## 15. Folder Structure

```
/agents-marketplace
 ├─ apps/
 │   ├─ web/                 # Next.js (App Router) marketplace UI
 │   └─ worker/              # Bune/Node: pipelines, DB cron, notifications
 ├─ packages/
 │   ├─ ui/                  # headless design system (primitives + tokens)
 │   ├─ data-access/         # repository + typed queries (shared with API)
 │   ├─ integrations/
 │   │   ├─ alana/           # Agent Wallet / Session Keys
 │   │   ├─ termx/           # Advantage reports
 │   │   └─ pancakes/        # LP / yield provider
 │   ├─ contract/ /nethermind?  # on-chain constants/abi + BNBChain RPC helpers
 │   ├─ i18n/                # English + regional
 │   ├─ config/              # env/env, schema end-to-end types
 │   └─ telemetry/           # OpenTelemetry, logs
 ├─ services/ (event bus/etc)
 ├─ prisma/ or drizzle schema
 ├─ tests/
 ├─ .github/workflows/
 ├─ k8s/, docker-compose
 └─ docs/ (this PRD + ADRs)
```

---

## 16. Technology Stack

| Layer         | Choice                                                                | Why (fits criteria)                 |
| ------------- | --------------------------------------------------------------------- | ----------------------------------- |
| Frontend      | Next.js (App Router) + TypeScript + Tailwind + shadcn-style headless  | SSR for SEO/data quality, stable DX |
| Client data   | TanStack Query + SWR for live tickers                                 | cached, fresh, stale-time           |
| Backend       | Node.js (Fastify or NestJS) + services                                | API + partners adapters             |
| DB            | PostgreSQL (primary), Redis cache/index                               | strong refs + hot reads             |
| ORM/Migration | Prisma or Drizzle                                                     | type-safe, auditable migration      |
| Chain         | BNB/opBNB + **ALTnAN Agent Wallet SDK**, Session Keys                 | wallet auth/delegated actions       |
| Live data     | WebSocket/SSE + Redis pub/sub                                         | real-time monitoring, freshness     |
| Observability | OpenTelemetry → Prometheus / Grafana / Sentry                         | performance strategy                |
| CI/CD         | GitHub Actions → Docker, K8s (or managed), CDN (Vercel or Cloudflare) | blitz delivery                      |
| Testing       | Vitest, Playwright, Cypress E2E                                       | data-integrity evidence             |

---

## 17. Authentication Strategy

- **Primary:** "Sign-In with Ethereum (BSC)" (SIWE/EIP-4361) via wallet; EIP-712 signature verification server-side.
- **Session:** short-lived JWT (access 15min) + rotating refresh token (HTTP-only; low reuse risk). Session-bound to wallet.
- **Roles:** `anonymous` → `user` (verified wallet) → `admin/mod` (marketplace governance). Optional builder role.
- **No password backdoors.** Account revoking wallet binding != erasing session on-chain, controlled.

Trade-off: wallet-only is standard for Web3 DT; we keep server session tokens so the monitoring dashboard works while offline from RPC noise.

---

## 18. Wallet Integration Strategy

Uses **ALTANA Agent Wallet** for delegated custody (recommended path):

- **Deploy:** Create/attach an Agent Wallet per deployment.
- **Session Keys:** Each contract capability = a **Session Key** with:
  - spend caps (absolute + per-period),
  - expiry (block/timestamp or duration),
  - revocation (remove / sign-off dead).
- **Balance/custody:** user wallet stays as custody; agent wallet is opt-in capability only; user retains full audit and revoke at any time.
- **On-chain binding:** permission updates are encoded, emitted, and surfaced (`on_chain_hash`) into `permissions`/`audit_logs`.

**Non-wallet / view-only:** users can browse/catalog without connecting. Wallet required only at false cost-deploy (scoped).

---

## 19. Live Data Strategy

- **Ticker pipeline (worker):** scheduled + event-driven pulls from BNBChain RPC via node balances, provider/LP pools, mid-price.
- **Cache cadence:** WebSocket updates → Redis (short TTL) → UI streams. Redis pub/sub for multi-instance.
- **Model of freshness per entity:**
  - token/pool price: ≤5s
  - user position + HF: ≤30s (warm cache, on-change write)
  - agent `snapshot`: ≤60s (batch, off critical path)
- **Staleness policy:** every card exposes a "last updated" delta; server drops stale rows or marks yet scored; UI renders `stale` chip (honest data quality).
- Falls back to batch/cat on RPC latency via exponential backoff; no blocking of read paths.

---

## 20. Performance Monitoring Strategy

Two lenses:

1. **Product performance (data):** each agent dashboard tracks live KPIs normalized for risk (roi, apr, hf, drawdown), stored in snapshots; enable "live vs 30d" and per-category benchmarks.
2. **Platform performance (SLO):**
   - Real transform: P95 web vitals in analytics;
   - APM: OpenTelemetry instrumentation, spans per API call;
   - Alerts on threshold: P95/99 latency, error rate >1%, cache-miss rate, contract event latency;
   - Budget dashboards: Datadog/Grafana per team.

---

## 21. Security Architecture

- **Zero secrets on client**; all wallet ops via signed capabilities (never raw key from local).
- **Wallet isolation:** agent private key never ducted to backend; hardware/Hashicorp Vault for server secrets; secret rotation pipeline.
- **Signature verification:** EIP-712 replay protection, nonce, chainId binding.
- **Permission dispatch:** spend calculation server-side; enforce per-session caps at the SDK level + display store always.
- **App-level:** CORS/CSRF, strict CTS CSP, OWASP API top10, JWT refresh rotation, iat/exp, SSRF guards on inbound webhook ingestion, allowlist of external (LP/pair/price) endpoints with striped URL safety.
- **Data:** sensitive at rest encrypted (PGP); RBAC on admin endpoints; PII minimal (only wallet/social).
- **Supply chain:** renovate, lock files, SSN-LC staging, signed deps, pinned images.

---

## 22. Permission Model

Used at hire + runtime; enforced by **Agent Wallet Session Key + server view**.

```
AgentDeploy (user) needs ≥ {spend_cap_total, spend_cap_period, expiry} => creates session
Permission row fields: capability (trade/lp/agent), amount cap, period cap, timestamps
Runtime: delegate locally → server envelope verifies each op is inside caps.
Revocation is instant: revoke(rev) off-chain + on-chain kill; triggers alert + wallet.
```

- **Default deny** — no wildcard capabilities.
- **Ownership hierarchy:** User → Wallet → Session(agent) → ops under permitted capabilities.
- **User can always:** list, isolate, extend, revoke; irreversible ops require explicit confirm + re-verify.
- On revoke, deployment moves unit to `terminated` and user is alerted; no agent can re-execute.

---

## 23. Error Handling Strategy

- **Uniform envelope:** `{ ok, data?, error: { code, message, fields? } }`; typed error codes (CATALOG_FILTER_INVALID, SESSION_EXPIRED, WALLET_DETACHED, DATA_STALE, RPC_TIMEOUT...).
- **Client:** TanStack Query @ error boundaries per route; optimistic updates for toggle/action with rollback; toast + inline field errors.
- **Retries/backoff:** idempotent `POST /revoke` (keyed), RPC client timeout + circuit breaker; SAGAS-style compensation for 2-step hire/revoke.
- **SGD on read:** stale snapshot fallback, not hard fail.
- **Global:** 404, 429 (rate), 500 pages with "try again / reload", capture to Sentry with context.

---

## 24. Logging Strategy

- **Structured JSON logs (`Logfmt`:** app/service, `trace_id`, `user_id`(hashed), event, fields).
- **Audit trail (immutable):** every permission change, hire, revoke, cap edit → `audit_logs` + backend event. Served to mobile "activity timeline."
- **Levels:** debug (dev) / info (flow) / warn (staleness, retry) / error (Sentry + alert).
- **Aggregation:** Loki → Grafana; traces to Tempo/OTLP; metrics to Prometheus. Correlation `request_id` across services.
- **Sensitive data discipline:** log borders; no private keys, no session values, no wallet keys.

---

# PART VI — DELIVERY

## 25. Deployment Architecture

```
Internet ─► CDN (Vercel/Cloudflare) ─► Next.js web (edge SSG/SSR) ─► API gateway
                                                                  │
    ┌─────────────────────────────────────────────────────────────┤
  BNB Chain (ws/wss)                                            Services
      agent wallet SDK ─► session/permissions             /api (Fastify/Node)
      RPC/theta for prices                                 ├─ catalog
      Pancake LP provider                                  ├─ sessions/permissions
      TERMIX report source                                 ├─ lp provider
                                                           ├─ metrics/stream
                                                           ├─ auth
--------------------------------------------------------------------
  PostgreSQL (primary)   Redis (cache/queue)   Time-series?   Blog/storage
   (workers: ticker, snapshots, notifications, report, audit)
```

- **Deploy targets:** two envs (prod + staging). Same schema.
- **Static/SSG** for SEO pages (home, categories, listing%) — done from mirrored data; dynamic parts hydrate.
- **Edge functions** for real-time alerts/SSE fan-out when the infra allows.

---

## 26. CI/CD Pipeline (GitHub Actions)

**Workflow:**

1. `.github/workflows/ci.yml` on PR: `lint` → `type-check` → `test` (unit) → `build` → e2e (Playwright on preview) → contract gate.
2. `.github/workflows/cd.yml` on main: version + migrate DB (drizzle/prisma) → deploy API/worker → revalidate static page cache → smoke test.
3. Post-deploy: **telemetry** → health check on `/healthz` → rollback vs re-run.

**Badges:** CI green gate on PR to main; SSO approvals for migrations and worker deploy; container image via pre-built cache; DB migration backward-compatible; zero-downtime replicas + canary.

---

## 27. Environment Variables

| Group             | Vars                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Auth              | `AUTH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `NEXT_PUBLIC_APP_URL`                                      |
| DB                | `DATABASE_URL`, `SHADOW_DATABASE_URL` (migrate), `REDIS_URL`                                                   |
| Wallet/Chain      | `NEXT_PUBLIC_BNB_RPC_URL`, `WALLET_CLIENT_ID`, `WALLET_API_SECRET`, `AGENT_ACCOUNT_FACT` (per env), `CHAIN_ID` |
| Feed integrations | `SERVICE_*` for TERMIX, Pancake endpoint + cache TTLs, symbols                                                 |
| Observability     | `OTEL_DOMAIN=`, `SENTRY_DSN`, `GRAFANA_*`                                                                      |
| Security          | `CAP_MIN_*`, `API rate enable`, `WEBHOOK_AUTH_TOKEN`, `BASE_URL`                                               |

- All are injected at deploy, never committed; a `.env.example` committed documents them.

---

## 28. Third-party Integrations

| Integration                   | Purpose                                               | Interface               |
| ----------------------------- | ----------------------------------------------------- | ----------------------- |
| **ALTANA AgentWallet**        | Custody, session keys, spend caps, expiry, revocation | SDK + on-chain operator |
| **TERMIX**                    | Agent Advantage Report; human vs agent comparisons    | REST/RPC + captured     |
| **PancakeSwap**               | LP pools APR, yield, analytics                        | SDK / RPC / indexer     |
| BNB Chain RPC + on-chain data | balances, HF, PnL                                     | RPC + websocket         |
| Price/TV observers            | fresh price metrics                                   | feed-agnostic adapter   |
| **Sentry**                    | Error tracking                                        | SDK                     |
| OTel → Grafana                | observability                                         | protocol                |
| (optional) Etherscan          | tx tracing                                            | API                     |

All adapters live in `packages/integrations/*` and are abstracted so providers can be swapped without changing UI.

---

# PART VII — PRODUCT CRAFT

## 29. UI Design System

Built with **headless React primitives + Tailwind tokens** (shadcn/Radix on top of open-source).

- Single source of truth tokens: spacing, radius, shadow, elevation, motion.
- **Cards** reuse: AgentCard, MetricCard, PoolCard, PositionCard — consistent hierarchy.
- **Layout:** CSS tokens + `container` well; **component-driven** pages (no bespoke CSS drift).
- **Dark mode** built at token level (not piggybacked `dark:` flags everywhere).
- Design documented via **Storybook** stories per component (covered by AGDQ—also validates a11y).

---

## 30. Typography

- **Out base:** Inter (UI) system/fallback Roboto; numeric of uses **tabular numerals** since PnL/metric density.
- Optional display type: **Space Grotesk** for headings/hero (financial-tech feel), used sparingly.
- Scale: `10/12/14/16/20/24/30/36/48` px (rem); line-height 1.5 body, 1.1 headings; max 65-75ch for narrative text.
- Numeric: tabular, monospace-in-digits for tables to keep alignment in APRs/HP.

---

## 31. Color Palettes (BNB-remix)

- **Brand (BNB gold):** `#F0B90B` (primary/action), `#FFE48A` tint.
- **Base (dark, fintech):** `#0E1220` (bg-base), `#1A2133` (surface), `#232B40` (raised).
- **Text:** `#F5F7FA` (primary), `#A3AABC` (muted), `#6B7include` (faint).
- **Status/Semantic:** green `#2AB573` (profit/health), red `#F6465D` (loss/hf risk), amber `#F0B90B` (warning), info blue `#3B82F6`.
- **Contrast:** each pair ≥ AA (≥4.5:1 body). Dark by default = base brand; light theme optional toggle.
  Token vars: `--bg`, `--surface`, `--text-*`, `--danger`, `--success`, `--warning`, `--info`, `--accent`.

---

## 32. Icon System

- **One set:** Lucide-style, stroke-based, 24×24 grid, `1.5px` stroke.
- Icons as React components; tree-shaken; **semantic only** — always paired with text label (never color-as-meaning).
- Use: categories (rebalance ⇄, grid ▦, yield ▲, health ♥), warning, check, revoke, key, etc.
- No decorative-Duplicate; icons never replace copy for a11y.

---

## 33. Responsive Strategy

| Breakpoint        | Behavior                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| `base` (mobile)   | single column; deck stacking; bottom filter drawer; simplified metrics |
| `≥768` (tablet)   | 2-across cards; category filter rail inside                            |
| `≥1024` (desktop) | 3-across + persistent sidebar filters; data tables for compare/pools   |
| `≥1280`           | wide centered container; advanced detail layouts                       |

- Tables/ranges: pivot to cards on mobile; live charts keep time-cone.
- Tap target ≥44px; sticky action bars (Hire) on mobile.

---

## 34. Accessibility Requirements

- **WCAG 2.1 AA** full; Lighthouse/axe in CI.
- Full keyboard navigation; focus-visible ring (never removed);
- Screen-reader: each metric with aria-label? metric tables with `role="table"`; cards with aria for live data regions (`aria-live` ticker).
- Color not the only signal (icon+badge+text for profit/loss).
- Reduced motion: `prefers-reduced-motion` disable tick changes; no auto-flicker charts.
- Landmarks (`header`, `nav`, `main`, `footer`), correct heading order `h1-h6`; skip links; alt/aria names.
- Contrast ≥4.5:1 for all tokens; focus states distinct.

---

## 35. SEO Strategy

- **SSG/SSR retrieval pages:** `/`, `/marketplace`, 4×category pages, `/leaders`, `/lp` for index/crawlers; meta tags + OpenGraph/Twitter cards.
- JSON-LD structured data: `ItemList` (agents), `AggregateRating`, `BreadcrumbList`.
- Canonical URLs; `sitemap.xml`; clean slugs; `robots.txt`.
- Fast index: leading first-paint; server-rendered meta titles/descriptions include target data (category, metric).
- Internal linking: categories ↔ leaderboard ↔ agent detail; since search-first, LCP affected.
- Analytics: privacy-considerate (light Plausible / GA4 No-Cookie) to respect users.

---

## 36. Performance Optimization Strategy (Web)

- Code split routes; lazy advanced panels; image `next/image` (AVIF via CDN).
- **Data:** TanStack Query caching (staleWhileRevalidate), Redis for hot reads; pre-render static lists; stream live data via SSE incremental rather than constant re-fetch.
- Fonts: `next/font` var via self-host cri； font-display: swap, tabular.
- Client bundle budget (<220KB gzip vendor); `@next`gttrue`.
- Asset: `sharp` responsive; no layout CLS via fixed aspect charts/cards; skeleton skeletons.
- Bench in CI: Lighthouse/WebVitals in GH Actions gate.

---

# PART VIII — GOVERNANCE

## 37. Risk Assessment & Mitigation

| Risk                                       | Likelihood | Impact   | Mitigation                                                                                                                           |
| ------------------------------------------ | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Wallet SDK/undocumented                    | Med        | High     | Wrap adapter behind contract; fallback hash-based testing; use mainnet but switch easily.                                            |
| Live data stale from RPC throttling        | Med        | Med      | Websocket+Redis TTL; staleness chip; circuit breaker + retry.                                                                        |
| On-chain permission bug → funds at risk    | Low-High   | Critical | Server-side cap accounting; default-deny; revocation is instantaneous; testing + sim with caps; never real funds on mainnet default. |
| 4 categories equally deep in time          | Med        | Med      | Template the category; reuse metric layer; fill data w/ curated seed helpers.                                                        |
| Partner (ALT/TERMIX/CAKE) API scope limits | Med        | Med      | Adapter-isolate; mock/interim mock data; degrade gracefully.                                                                         |
| Key/seat leakage                           | Low        | High     | No secrets on client; secret mgmt; audit; rotation.                                                                                  |
| Judging needs a live demo sync             | Med        | High     | Seed demo dataset; ensure E2E happy-path in demo accounts + screenshots/videos. Regardless production DB is for all.                 |
| Time (hackathon) scope creep               | High       | Med      | Strict MoSCoW; build later. Job-scope cuts = Nice-to-have gone first.                                                                |

---

## 38. Future Scalability

- **Multi-chain:** abstract chain adapter (BNB native first) → additional EVM + non-EVM SDKs.
- **Multi-pledge session types:** ERC-4337/ERC–7702 delegated Account, modular building blocks (AA SDK).
- **Agent registry standard:** align with Agent Studio registry schemas; allow plugin registry.
- **Analytics/ reputation engine:** normalized risk-adj APY, aggregation reputation, on-chain provenance of reports.
- **Realtime multiplayer:** stronger WS fan-out (Redis streams) + horizontal scheduling worker pools.
- **BigEval marketplace endpoints:** Billing/ERC-20 fees, token streaming; on-chain credit.
- **Globalization:** i18n (EN/ZH) ready from day one (token sets + routing).
- **On-chain identity + reputation (EAS attestations)** for verified badges.

Always: architecture meant to accept new category/partner types by adding adapters + category config, no core rewrite.

---

## 39. Development Milestones (sprint-based)

**🚩 Phase 0 — Foundation (H1)**

- Repo setup, CI, style tokens, design system v1, adapters skeleton, DB schema, auth.

**🚩 Phase 1 — Catalog & Discovery (H2)**

- Search/facet/sort/compare, category pages ×4, leaderboards, static seeds, SEO.

**🚩 Phase 2 — Wallet & Permissions (H3)**

- Wallet connect, ALT session keys (cap/expiry/revocation), hire flow, permission UI.

**🚩 Phase 3 — Brokerage/Monitor (H4)**

- Live dashboards, PnL/HF, alerts/notifications, `/dashboard/:id`.

**🚩 Phase 4 — Partners & Depth (H5)**

- TERMIX advantage report; Pancake LP ranking+yield; category data depth; data-quality badges.

**🚩 Phase 5 — Polish & Stress (H6)**

- a11y/audit, perf/CI gates, e2e mass data, error/empty states, demo seeds, final docs.

Each phase ships a **judge-visible** slice of functionality so any checkpoint wins points independently.

---

## 40. Suggested GitHub Project Structure

```
bnb-agent-marketplace/
├─ README.md                 # market-driven positioning + quickstart
├─ docs/                     # PRD, ADR/xxxx, diagrams, runbook
│   ├─ ADR-001-agent-registry.md
│   └─ architecture.drawio.png / mermaid
├─ apps/
│   ├─ web/                  # Next.js marketplace
│   └─ worker/               # pipelines (tick, snapshots, alerts)
├─ packages/
│   ├─ ui/                   # design tokens + primitives (Storybook)
│   ├─ data-api/             # types, hdl, openapi
│   ├─ integrations/
│   │   ├─ altana/
│   │   ├─ termx/
│   │   └─ pancakes/
│   ├─ chains/constants
│   ├─ config/ env/ts
│   └─ telemetry/
├─ prisma/ or drizzle/
├─ infra/
│   ├─ docker-compose.yml
│   ├─ k8s/
│   └─ tf/ perhaps
├─ scripts/
│   ├─ seed/
│   └─ bench/
├─ tests/
├─ .github/workflows/ (ci, cd)
├─ .env.example
└─ LICENSE
```

Branch strategy: `main` (protected) + `main`feature branches; PR review gates + CI; conventional commits; semantic releases.

---

# Appendix A — Directory of Mermaid diagram sources

The ERD and Deployment Architecture correspond to the models above; a Mermaid-format ERD and system diagram are included in the repo `docs/architecture/` for live-editing and judge presentation.

---

_This document is the living blueprint. Any divergence from a stated requirement should be recorded as an ADR in `docs/ADR-*`. All development traces back to one of F, DQ, or AD to justify scope._
