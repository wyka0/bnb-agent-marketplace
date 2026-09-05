# Sprint 2G — Leaderboards Data Integration

## Phase 1: Integration Discovery Report

**Status: 🛑 BLOCKED — no live data source exists in the repository.**
**Decision: STOP before implementation. Do not fabricate an 8004scan / ERC-8004 API.**

**Date:** 2026-08-08
**Scope of this document:** discovery only. No source files were modified. The frozen
Leaderboards UI (`apps/web/app/(app)/leaderboards/page.tsx`) and all frozen sprints
(2B/2C/2D/2E, `packages/ui`) were read but **not touched**.

---

## 1. Executive summary

The repository is in a **pre-data "foundation" phase**. Every data-access layer that
would feed the Leaderboards page is present only as an **interface / contract stub**
with an explicit "not implemented yet" marker. There is:

- **No 8004scan client** (no base URL, no endpoints, no schema, no SDK).
- **No ERC-8004 registry client** (no RPC/indexer wiring, no contract ABI).
- **No API route handlers** in the web app (`app/**/route.ts` → none).
- **No server actions** (`"use server"` → none) and **no `fetch()` calls** in `apps/web`.
- **No database models** (`prisma/schema.prisma` has zero models by design).
- **No agent ranking / reputation / risk / activity data fields** in any shared type.

The current Leaderboards UI already reflects this truthfully: it renders the honest
`loading` (registry-pending) state with skeleton rows + `WaitingHint` and never invents
data. **There is nothing to connect it to yet.**

Per the Sprint 2G STOP condition, the correct action is to **report the blocker** rather
than guess an endpoint or schema. Concrete unblock requirements are in §11.

---

## 2. Existing data sources

| Source                     | Present?          | Evidence                                                                                                                                                              |
| -------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8004scan API               | ❌ No             | No reference anywhere in source (only doc/comment mentions in UI copy + UX blueprint). No base URL, key, or endpoint.                                                 |
| ERC-8004 registry client   | ❌ No             | No RPC provider, ABI, contract address, or indexer client. "ERC-8004" appears only in **UI copy strings** and **design-token comments**, never as a client.           |
| BNB Agent Studio adapter   | ⚠️ Interface only | `packages/integrations/src/studio/index.ts` defines `StudioAdapter` but exports `STUDIO_ADAPTER_NOT_IMPLEMENTED = "BNB Agent Studio adapter is not implemented yet."` |
| Internal platform API      | ⚠️ Placeholder    | `NEXT_PUBLIC_API_URL` defaults to `http://localhost:4000` (no server running; not an 8004scan URL).                                                                   |
| Database (Prisma/Postgres) | ⚠️ Empty schema   | `prisma/schema.prisma` — "no models are defined yet, by design."                                                                                                      |
| Worker (`apps/worker`)     | ⚠️ No fetchers    | No registry polling / ingestion found.                                                                                                                                |

---

## 3. Existing API clients

### `packages/data-api` — generic typed HTTP client (endpoint-less)

- `createApiClient({ baseUrl, fetchFn?, timeoutMs? })` → `{ get, post, put, patch, delete }`.
- Response envelope: `ApiEnvelope<T> = { ok, data?, error? }`.
- Typed errors: `ApiClientError` + `ApiErrorPayload` with codes
  `BAD_REQUEST | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | CONFLICT | RATE_LIMITED | UPSTREAM_ERROR | INTERNAL_ERROR | STALE_DATA`.
- **Reusable for the eventual integration** (it's exactly the fetch/error foundation to build on), but it declares **zero business endpoints**. Source comments confirm:
  - `types.ts`: _"No business endpoints are declared here yet."_
  - `index.ts`: _"No business endpoints yet; this is the foundation on which the catalog/hire/monitoring APIs will be built."_
  - `client.ts`: _"Factory for a typed HTTP client bound to one base URL. Endpoint-less for now."_

**Verdict:** reuse `@bnb-marketplace/data-api` when a real endpoint exists. Do **not**
create a second HTTP client.

---

## 4. Relevant files (inventory)

| File                                                             | Role                                                       | State                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/leaderboards/page.tsx`                       | Leaderboards UI (Sprint 2F)                                | Complete; UI-only; `viewState = "loading"` hardcoded. **Frozen — do not redesign.**    |
| `apps/web/app/(app)/marketplace/page.tsx`                        | Marketplace                                                | UI-only; renders skeletons + `WaitingHint`; **no data fetching**.                      |
| `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`         | Agent Details                                              | UI-only; every value renders `—` / pending; **no data fetching**. Nav target for rows. |
| `apps/web/components/breadcrumbs.tsx`                            | App-local breadcrumbs                                      | Reusable.                                                                              |
| `packages/data-api/src/{client,types,errors}.ts`                 | Typed HTTP client + envelope + errors                      | Reusable foundation; endpoint-less.                                                    |
| `packages/config/src/env.ts`                                     | Zod env schema                                             | No registry/8004scan vars.                                                             |
| `packages/config/src/constants.ts`                               | `AGENT_CATEGORIES`, `SUPPORTED_CHAINS`, `NAV_ITEMS`        | Reusable enums.                                                                        |
| `packages/config/src/types.ts`                                   | `Agent`, `Publisher`, `Paginated<T>`, `OperationStatus<T>` | Identity types only (no ranking fields).                                               |
| `packages/integrations/src/studio/index.ts`                      | `StudioAdapter` (agent registry contract)                  | Interface-only; not implemented.                                                       |
| `packages/integrations/src/{altana,termix,pancakeswap}/index.ts` | Provider contracts                                         | Interface-only; not implemented.                                                       |
| `prisma/schema.prisma`                                           | DB schema                                                  | Zero models.                                                                           |

---

## 5. Available agent fields (shared `Agent` type — `packages/config/src/types.ts`)

```
Agent {
  slug       string
  name       string
  tagline    string
  category   AgentCategory   // "rebalancing" | "grid-trading" | "yield" | "health-factor"
  chains     ChainId[]       // "bsc" | "opbnb"
  partner?   PartnerId       // "altana" | "termix" | "pancakeswap"
  iconUrl?   string
  publisher  Publisher
  status     "draft" | "published" | "archived"
  createdAt  string
  updatedAt  string          // ← the only field usable for the "freshness" tie-break
}
```

`StudioAgentStatus` (integration contract) adds: `id, description, publisherId` — still
**no ranking/quality fields**.

---

## 6. Field availability for the Leaderboard model

| Leaderboard field       | Available today?             | Where it would come from (per blueprint) | Status                                             |
| ----------------------- | ---------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `id` / `slug`           | ✅ (`Agent.slug`)            | Studio/registry                          | Present in type; no instances                      |
| `name`                  | ✅ (`Agent.name`)            | Studio/registry                          | Present in type; no instances                      |
| `category`              | ✅ (`Agent.category`)        | Studio/registry                          | Present in type; no instances                      |
| `protocols`             | ⚠️ partial (`Agent.partner`) | 8004scan / registry                      | Only single `partner`, not a protocol list         |
| `updatedAt` / freshness | ✅ (`Agent.updatedAt`)       | Registry sync time                       | Present in type; no instances                      |
| `rank`                  | ❌                           | Derived (ordinal)                        | Cannot compute — no rows                           |
| `registryScore`         | ❌                           | ERC-8004 registry verifier/status        | **No source**                                      |
| `reputation`            | ❌                           | 8004scan reputation engine               | **No source**                                      |
| `successRate`           | ❌                           | Agent self-report / registry             | **No source**                                      |
| `activity`              | ❌                           | 8004scan activity index                  | **No source**                                      |
| `verification`          | ❌                           | ERC-8004 registry `verification` state   | **No source** (UI has the _token_, not the _data_) |
| `risk`                  | ❌                           | Registry risk field                      | **No source**                                      |
| `source` (provenance)   | ❌                           | per-metric attribution                   | **No source**                                      |

Registry-specific fields (`verification`, `risk`, `registryScore`, sync time) and
reputation/activity fields have **design tokens in `packages/ui`** (`RegistryBadge`,
`VerificationBadge`, `RiskBadge`, `ReputationBadge`, tokens in `marketplace/tokens.ts`)
— i.e. the **render vocabulary exists**, but the **data does not**.

---

## 7. Environment variables

Defined in `packages/config/src/env.ts` (Zod):

| Var                   | Default                 | Relevant to 8004scan?                      |
| --------------------- | ----------------------- | ------------------------------------------ |
| `NODE_ENV`            | `development`           | no                                         |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | no                                         |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | placeholder internal API, **not 8004scan** |
| `NEXT_PUBLIC_WS_URL`  | `ws://localhost:4000`   | no                                         |
| `DATABASE_URL`        | local Postgres          | no                                         |
| `REDIS_URL`           | local Redis             | no                                         |
| `LOG_LEVEL`, `OTEL_*` | —                       | no                                         |

**Missing (required to unblock):** an 8004scan / ERC-8004 base URL, any API key/secret,
and (if keyed) a **server-side-only** variable name convention. Only
`prisma/.env.example` exists (DB only). No `.env` with registry config anywhere.

Feature flag present: `feature.leaderboards: true`, `feature.realtime: false`
(`packages/config/src/feature-flags.ts`).

---

## 8. Metric mapping — ⚠️ UX contract mismatch to resolve BEFORE any code

Blueprint **§9** defines exactly **6** ranking metrics:

| Blueprint key              | Meaning                          | Source                  |
| -------------------------- | -------------------------------- | ----------------------- |
| `registry-score` (default) | Composite registry trust ranking | ERC-8004 registry       |
| `reputation`               | Reviews/ratings aggregate        | 8004scan reputation     |
| `success-rate`             | % runs reported successful       | Agent/registry          |
| `activity`                 | Recent on-chain usage/trend      | 8004scan activity index |
| `verification`             | Verification tier                | ERC-8004 registry       |
| `risk`                     | Risk level (low ranks high)      | Registry risk field     |

The **current Sprint 2F UI** (`METRIC_OPTIONS`) ships **7** options:

`registry-score`, `reputation`, `activity-7d`, `volume-30d`, `win-rate`,
`verification-level`, `freshness`.

**Mismatch (flagged, not silently changed — Step 4):**

| UI option            | Blueprint status                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `registry-score`     | ✅ matches                                                                               |
| `reputation`         | ✅ matches                                                                               |
| `activity-7d`        | ≈ blueprint `activity` (label drift: "(7d)" vs generic)                                  |
| `verification-level` | ≈ blueprint `verification` (label drift)                                                 |
| `volume-30d`         | ❌ **not in blueprint §9**                                                               |
| `win-rate`           | ❌ **not in blueprint** — blueprint calls this `success-rate`                            |
| `freshness`          | ❌ **not a blueprint metric** — freshness is a **column** (§11 #8), not a ranking metric |
| _(missing)_ `risk`   | ❌ blueprint metric **absent** from UI selector                                          |

Also note the page **subtitle** currently reads _"…volume, win rate and freshness,"_
echoing the non-blueprint terms.

**These `volume-30d` / `win-rate` / `freshness` terms are NOT existing project
terminology** — they do not appear in `packages/config`, the domain `Agent` type, or any
data contract. They appear to be an **implementation drift introduced in the Sprint 2F UI
copy**, not a sanctioned data field.

➡️ **Required decision before implementation (UX change request):** either
(a) correct the UI selector to the blueprint's 6 metrics (`success-rate` not `win-rate`;
drop `volume-30d`; add `risk`; move `freshness` to column-only), **or**
(b) amend the frozen blueprint §9 to add Volume/Win-Rate/Freshness as sanctioned metrics.
Because Sprint 2F is frozen and §9/§10 is a documented **freeze item** (blueprint §18),
I will **not** change either the UI or the blueprint without explicit approval.

---

## 9. Proposed integration architecture (for when a source exists — NOT implemented now)

Smallest-footprint design that reuses existing infrastructure:

```
ERC-8004 / 8004scan  ──►  server-only adapter            ──►  normalize()          ──►  Leaderboards page
(real endpoint + key)     packages/integrations/studio         → LeaderboardAgent[]      (existing Sprint 2F UI)
                          (implement the existing               (ordinal ranking per      viewState ∈
                           StudioAdapter contract) +            §10 tie-break cascade)     loading/ready/empty/
                          @bnb-marketplace/data-api                                        offline/no-data/
                          createApiClient(baseUrl)                                         no-metric/error
```

Principles:

1. **Server-side fetch only** (App Router server component or `route.ts`), so any API key
   stays off the client. Pass normalized, safe data to the existing client UI.
2. **Reuse `@bnb-marketplace/data-api`** `createApiClient` + `ApiClientError` (map
   `RATE_LIMITED`/`UPSTREAM_ERROR`/timeout → the UI's `offline` / `error` states).
3. **Reuse the existing `StudioAdapter` contract** in `packages/integrations` rather than
   inventing a new client shape.
4. **Normalized model** with all-nullable quality fields (see §10). Missing → `null` →
   UI renders `—` / `Pending` (never `0`, never fabricated).
5. **Ordinal ranking** computed from the §10 cascade
   (`verification → risk → reputation → activity → updatedAt`); all-null rows sink to the
   bottom with dense-rank ties. If the source provides a legitimate `registry-score`,
   preserve it as source data (do not overwrite with a synthetic number).
6. **Wire the existing `viewState`** in the frozen page (no redesign) — flip
   `"loading"` → `"ready" | "empty" | "offline" | "no-data" | "no-metric" | "error"`
   based on the adapter result.

---

## 10. Proposed normalized data contract (draft — implement only after unblock)

Reuse `Agent` / `AgentCategory` / `ChainId` from `@bnb-marketplace/config`; add a
leaderboard-specific view type (no duplication of identity fields):

```ts
type LeaderboardAgent = {
  // identity (reuse @bnb-marketplace/config Agent)
  slug: string;
  name: string;
  category: AgentCategory;
  protocols: string[] | null; // from partner/registry; null if unknown
  // ranking (all nullable — missing stays —/Pending, never 0)
  rank: number | null; // ordinal, computed; null while pending
  registryScore: number | null; // ONLY if source provides a real value
  reputation: ReputationLevel | null; // reuse ui token union
  successRate: number | null; // 0..1; null → "—"
  activity: ActivityLevel | null;
  verification: VerificationState | null;
  risk: RiskLevel | null;
  freshness: { syncedAt: string | null; state: RegistryState };
  source: Record<string, string>; // per-metric provenance for the banner
};
```

Missing-data rule (enforced): `null` → `—`; `null` + pending source → `Pending` /
`Waiting`. **Never** substitute `0`, `0%`, estimates, or placeholder agents.

---

## 11. Blockers (explicit) — what is required to proceed to implementation

1. **8004scan / ERC-8004 endpoint** — a real base URL (indexer HTTP API or RPC + contract
   address/ABI). None exists in the repo.
2. **Response schema** — the JSON/records shape for: agent list, `verification`, `risk`,
   `reputation`, `activity`, `registry-score`, and last-sync time. None documented in-repo.
3. **Auth** — whether a key is required and its **server-only** env var name
   (e.g. `EIGHT004SCAN_API_KEY`). None defined.
4. **Metric contract decision (§8)** — resolve the `volume-30d` / `win-rate` / `freshness`
   vs blueprint `success-rate` / `risk` mismatch via UX sign-off before touching the
   selector or blueprint.
5. **Env wiring** — add the endpoint/key to `packages/config/src/env.ts` (Zod) once names
   are known.

Until items 1–3 are supplied, **any endpoint or schema would be guessed** — which the
Sprint 2G brief explicitly forbids. Therefore implementation is **halted here**.

---

## 12. What was NOT done (and why)

- ❌ No integration code written — no live source to integrate.
- ❌ No changes to the frozen Leaderboards UI, `packages/ui`, or Sprints 2B/2C/2D/2E.
- ❌ No invented endpoints, schemas, or fake agents/rankings.
- ❌ No metric relabeling (mismatch reported for decision instead).
- ✅ Confirmed the current UI already renders honest pending/loading states, so there is
  **no data-quality regression** while blocked.

---

## 13. Recommended next actions (owner input required)

1. Provide the 8004scan/ERC-8004 **endpoint + schema + auth** (or point to the doc that has them).
2. Approve the **metric contract** (correct UI to 6 blueprint metrics, or amend §9).
3. Then Sprint 2G Phase 2 can implement §9's architecture: `data-api` client → `StudioAdapter`
   impl → `normalize()` → wire the existing `viewState`, followed by
   `pnpm lint && pnpm typecheck && pnpm build` and the §"VALIDATION" test matrix.
