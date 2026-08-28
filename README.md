# BNB Agent Studio Marketplace

A production marketplace for discovering, understanding, comparing, and safely activating AI agents on BNB Chain.

Discover agents by category, inspect source-attributed data, compare candidates side by side, and review activation requirements without fabricated execution claims.

**Live:** https://bnb-agent-marketplace-web.vercel.app

**Release:** `850454da8f49f48285c31b8322215e55d37967a0` (working tree; final submission)

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

Review whether an agent is currently eligible for activation. For Main Track commercial hire (Model B), the flow is **implemented and live**: the marketplace dynamically negotiates with real discovered ERC-8183 sellers (e.g. **Agent 2005 — Canned Range Keeper**), verifies the provider signature, and builds a browser-wallet Hire plan from the real quote. A real funded hire was attempted but the first transaction is currently blocked by a documented BSC testnet RPC broadcast issue (see X.157/X.158); no successful production funded hire is claimed.

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

The marketplace includes ERC-8004 / ERC-8183 / BNB Agent Studio integration: real registry discovery (8004scan), on-chain agent identity + endpoints, live seller negotiation, provider-signature verification (official SDK), and a browser-wallet ERC-8183 commercial hire path.

**Live discovered seller example — Agent 2005 "Canned Range Keeper"** (chain 97, owner `0x0eAc2F4d…`): its registered endpoint `https://range-keeper.103-195-188-198.sslip.io/erc8183` is reachable; `POST /negotiate` returns a fresh quote (price `0.001 U`, official commerce + $U, chain 97) whose `provider_sig` verifies with the official SDK to the registered owner. The marketplace Hire UI surfaces it with the real quote (provider, price, expiry, network). Agent 1906 (our own seller) has a **dead endpoint** and is not claimed as live.

The current production release does not claim a successfully completed funded production hire: a real attempt (X.157) was blocked at the first broadcast by a documented BSC testnet RPC issue (X.148-class), and the project fails closed honestly rather than fabricating success.

### Main Track Hire (Model B — browser-wallet commercial hire)

The Main Track Hire path (`model-b-v2-commercial-agreement`) is a real, deployed ERC-8183 commercial hire flow:

- USER → Marketplace → **live discovered seller** (e.g. Agent 2005) → live `/negotiate` quote → official provider-signature verification → explicit confirmation → user's EIP-1193 wallet → ERC-8183 sequence (`createJob` → `registerJob` → `setBudget` → `approve` → `fund`) → marketplace-owned receipt verification → independent on-chain verification → `funded-commercial-hire`.
- The browser wallet owns nonce, gas, signing and submission (`eth_sendTransaction`); the marketplace never receives a private key, never signs, and never calls `eth_sendRawTransaction` for user transactions.
- FUNDED is commercial escrow — it is never shown as ACTIVE/RUNNING/EXECUTING/COMPLETED.
- Every transaction target is checked against the pinned chain-97 ERC-8183 addresses (policy `0xd6a42175…`); historical job IDs are never reused; the provider, price, expiry and terms come from the live quote (never hardcoded).
- The server route (`/api/activation/main-track-hire`) exposes `prepare` / `receipt` / `verify` as read-only; the user's browser wallet is the only signer/broadcaster.

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

### Main Track Hire

Dynamic live-seller Hire is implemented and deployed (Model B). A real funded hire attempt (X.157) was blocked at the first broadcast by a documented BSC testnet RPC issue; no successful funded hire is claimed.

## Release

Production release (working tree):

`850454da8f49f48285c31b8322215e55d37967a0`

Live:

https://bnb-agent-marketplace-web.vercel.app

## Recommended Judge Flow

1. Open the live marketplace.
2. Browse the four categories (Rebalancing, Grid Trading, Yield Optimisation, Health Factor Monitoring).
3. Open an agent — e.g. **Agent 2005 — Canned Range Keeper** (chain 97).
4. Inspect source-attributed information (registry, TermiX, PancakeSwap).
5. Compare agents.
6. Review the activation state.
7. Click **Hire** — see the dynamically negotiated quote (provider, price, expiry, network) and the confirmation review; connect your wallet to see the transaction boundary. Observe that the flow fails closed honestly (no fabricated ACTIVE).

## Testing

- `pnpm --filter @bnb-marketplace/web typecheck` / `lint` / `build`
- `pnpm --filter @bnb-marketplace/integrations typecheck` / `lint` / `build`
- Main Track Hire harness: `pnpm --dir apps/web run activation:main-track-user-hire:verify`
- Main Track wiring: `pnpm --dir apps/web run activation:main-track:verify`
- Security: `pnpm --dir apps/web run security:x49:verify`
- Discovery: `pnpm --dir apps/web run marketplace:verify` and `discovery:verify`
- ERC-8183: `pnpm --dir packages/integrations exec node dist/altana/erc8183.verify.js`
- These are all read-only/no-transaction harnesses.

## License

Proprietary. All rights reserved. See `LICENSE`.
