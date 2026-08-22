# BNB Agent Studio Marketplace

A production marketplace for discovering, understanding, comparing, and safely activating AI agents on BNB Chain.

Discover agents by category, inspect source-attributed data, compare candidates side by side, and review activation requirements without fabricated execution claims.

**Live:** https://bnb-agent-marketplace-web.vercel.app

**Release:** `46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`

Status: Live production release. The marketplace is production-deployed and provides discovery, agent details, comparison, category navigation, trust/provenance information, and an honest fail-closed activation boundary.

---

## Four First-Class Agent Categories

### Rebalancing

Manages LP ranges and resets positions automatically.

### Grid Trading

Places and manages automated grid orders.

### Yield Optimisation

Routes liquidity toward available yield opportunities.

### Health Factor Monitoring

Helps protect lending positions from liquidation risk.

Each category has a dedicated dashboard, leaderboards, and discovery. Agents are surfaced by category through real registry data and BSC discovery without claiming execution where authoritative evidence is unavailable.

## Marketplace Experience

### Discover

Browse agents across all four required categories with search, facets, and category dashboards.

### Understand

Inspect agent identity, source attribution, available evidence, and relevant marketplace information on dedicated agent pages.

### Compare

Compare agents side by side with explicit unavailable/pending states instead of fabricated metrics.

### Review Activation

Review whether an agent is currently eligible for activation. The UI shows the exact requirements and the honest boundary — successful production hiring is not currently available.

## Trust & Data Quality

The marketplace does not fabricate:

- price
- APY
- TVL
- volume
- risk
- performance
- execution status
- funded jobs
- sessions
- transactions
- execution capabilities

When authoritative data is unavailable, the UI explicitly shows pending/unavailable states.

- Identity provenance via 8004scan / ERC-8004 where available (server-side, keyless-safe, `8004SCAN_API_KEY` / `E8004SCAN_API_KEY` never exposed to the browser).
- Server-side integration boundaries for all external providers.
- Fail-closed activation: no agent is shown as ACTIVE without authoritative evidence.
- Source attribution on every data surface (registry, market intelligence, reputation).

Registry data is surfaced when credentials/configuration are available; otherwise honest pending/offline states are shown — no values are invented.

## Activation & Safety

Real activation is intentionally fail-closed.

The marketplace does not represent an agent as ACTIVE unless the required authoritative execution and authorization evidence exists.

Current production activation is unavailable because the required authoritative execution-capability and custody prerequisites are not provisioned.

The marketplace therefore does NOT simulate:

- ACTIVE sessions
- funded ERC-8183 jobs
- provider execution capability
- transactions
- execution results

This is a deliberate trust boundary, not a simulated demo state.

## BNB Agent Studio / ERC-8183

The marketplace contains ERC-8183 / BNB Agent Studio integration boundaries for agent commerce and verification (wallet, x402, ERC-8183 adapters via `@altananetwork/sdk`).

The current production release does not claim successful live marketplace execution where authoritative provider capability or custody prerequisites are unavailable. No completed real paid hire is claimed.

## PancakeSwap Market Intelligence

The marketplace includes real BSC mainnet PancakeSwap V2 read-only market intelligence.

It uses on-chain reserve data and official pricing information to derive market intelligence such as pool TVL.

- Chain: BSC mainnet / Chain ID 56
- Read-only
- No wallet signing
- No swaps
- No liquidity transactions
- APR/APY are not fabricated
- Unavailable volume is shown as unavailable

No automated trading or LP management is claimed.

## TermiX Evidence

The repository includes an Agent Advantage experiment covering three real A/B tasks, including a security task.

The experiment measures marketplace discovery/intelligence against a baseline.

It does NOT claim that those tasks were completed through a real paid marketplace hire. Production marketplace Hire remains fail-closed. The existing report is evidence of discovery capability, not proof of completed marketplace hiring.

## Security

Verified production protections:

- CSP with nonce / `strict-dynamic`
- HSTS (`max-age=63072000; includeSubDomains`)
- `X-Content-Type-Options: nosniff`
- Frame denial (`X-Frame-Options: DENY`, `frame-ancestors 'none'`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, geolocation, microphone, payment, usb disabled)
- Server-side credential handling (no `NEXT_PUBLIC_` secrets)
- Fail-closed activation (no bypass, no fabricated sessions)

## Architecture

The monorepo separates the Next.js application from reusable workspace packages and integration adapters.

- `apps/web` — Next.js 15 marketplace (App Router)
- `packages/ui` — design-system components
- `packages/config` — env validation, constants, feature flags, types
- `packages/data-api` — typed HTTP client, envelope, error handling
- `packages/integrations` — adapter implementations (altana, termix, pancakeswap, studio)
- `prisma` — PostgreSQL schema and generated client
- `docs` — architecture, PRD, and review evidence

```mermaid
flowchart TB
  Web[apps/web · Next.js 15] --> UI[packages/ui]
  Web --> Data[packages/data-api]
  Web --> Cfg[packages/config]
  Web --> Tele[packages/telemetry]
  Worker[apps/worker] --> Integ[packages/integrations]
  Worker --> Data
  Worker --> Cfg
  Worker --> Tele
  Data --> Cfg
  Integ --> Cfg
  Prisma[prisma · PostgreSQL] --> Cfg
```

## Folder Structure

```
bnb-agent-marketplace/
├─ apps/
│  ├─ web/                    # Next.js 15 marketplace (App Router)
│  │  └─ app/
│  │     ├─ (app)/            # app-shell route group (nav/sidebar/footer)
│  │     │  ├─ dashboard/
│  │     │  ├─ marketplace/
│  │     │  ├─ agents/[slug]/
│  │     │  ├─ categories/{rebalancing,grid-trading,yield,health-factor}/
│  │     │  ├─ compare/
│  │     │  ├─ leaderboards/
│  │     │  ├─ settings/
│  │     │  ├─ profile/
│  │     │  └─ login/
│  │     ├─ layout.tsx page.tsx loading.tsx error.tsx not-found.tsx
│  │     └─ globals.css       # design tokens (Tailwind HSL vars)
│  └─ worker/                 # background workloads
├─ packages/
│  ├─ ui/                     # design-system components
│  ├─ config/                 # env validation, constants, feature flags, types
│  ├─ telemetry/              # logger, OTel placeholder, performance monitor
│  ├─ data-api/               # typed HTTP client, envelope, error handling
│  └─ integrations/           # adapter implementations + verify harnesses
│     ├─ altana/  termix/  pancakeswap/  studio/
├─ prisma/                    # Prisma schema (PostgreSQL)
├─ docs/                      # architecture, PRD, review evidence
├─ tests/                     # test suites
├─ .github/workflows/ci.yml   # install / lint / typecheck / build / format
└─ (Dockerfile, docker-compose.yml, eslint, prettier, husky…)
```

## Prerequisites

| Tool    | Version    | Notes                                |
| ------- | ---------- | ------------------------------------ |
| Node.js | >= 20      | 24.x verified                        |
| pnpm    | 9.15.9     | `npm i -g pnpm@9.15.9` if missing    |
| Docker  | any recent | only needed for local Postgres/Redis |

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Postgres + Redis)
docker compose up -d

# 3. Generate the Prisma client
pnpm prisma:generate

# 4. Start the web app in dev mode
pnpm dev
# → web: http://localhost:3000
```

> The worker app also runs via `pnpm --filter @bnb-marketplace/worker dev`.
> No `.env` file is required; see `packages/config/src/env.ts` for defaults.

## Environment

Copy the example environment file to a local (gitignored) env file:

```bash
cp .env.example .env.local
```

No variables are required to run the scaffold. For live ERC-8004 registry data, add your 8004scan API key:

```env
8004SCAN_API_KEY=
```

The key is read **server-side only** and is never shipped to the browser. Without a key, registry-dependent surfaces render honest pending/offline states.

## Development Commands

| Command                | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `pnpm dev`             | Run all apps in watch mode (Turborepo)    |
| `pnpm build`           | Build all workspace packages + apps       |
| `pnpm lint`            | ESLint across the monorepo                |
| `pnpm typecheck`       | TypeScript type-check across the monorepo |
| `pnpm format`          | Prettier write across the monorepo        |
| `pnpm format:check`    | Prettier check (used in CI)               |
| `pnpm check`           | lint + typecheck + build in one shot      |
| `pnpm prisma:generate` | Generate Prisma client                    |
| `pnpm prisma:migrate`  | Run `prisma migrate dev`                  |
| `pnpm clean`           | Remove build artifacts + node_modules     |

### Scoped commands

```bash
pnpm --filter @bnb-marketplace/web dev
pnpm --filter @bnb-marketplace/ui build
pnpm --filter @bnb-marketplace/worker dev
```

## Docker

- `docker compose up -d` — starts **PostgreSQL 16** and **Redis 7** for local development.
- `docker build -t bnbsm-web .` — builds the Next.js app image (standalone output, non-root user).
- Docker is **not required** for building or running the code; only for the local datastores.

## CI/CD

`.github/workflows/ci.yml` runs on push to `main` and on PRs:

1. **install** — pnpm frozen-lockfile install
2. **lint** — `pnpm lint`
3. **typecheck** — `pnpm typecheck` (with `prisma generate` first)
4. **build** — `pnpm build`
5. **format** — `pnpm format:check`

## Current Product Status

### Production

Live on Vercel.

### Discovery

Complete.

### Agent Details

Complete.

### Comparison

Complete.

### Four Category Experience

Complete.

### Trust / Data Provenance

Complete.

### PancakeSwap Intelligence

Read-only production capability.

### TermiX Evidence

Evidence package available with explicit limitations.

### Real Activation

Fail-closed pending authoritative execution-capability and custody prerequisites.

## Release

Production release:

`46fcdc6a0ddbb520619c2e0c86ab0de4ab0366ed`

Live:

https://bnb-agent-marketplace-web.vercel.app

## Recommended Judge Flow

1. Open the live marketplace.
2. Browse the four categories.
3. Open an agent.
4. Inspect source-attributed information.
5. Compare agents.
6. Review the activation state.
7. Observe that unsupported activation is explicitly unavailable rather than simulated.

## License

Proprietary. All rights reserved. See `LICENSE`.
