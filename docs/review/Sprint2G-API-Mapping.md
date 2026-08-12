# Sprint 2G — 8004scan API Mapping

**Status:** ✅ Keyless-safe integration architecture complete.
**Gates (with NO API key configured):** `pnpm lint` 12/12 · `pnpm typecheck` 12/12 · `pnpm build` 7/7.
**Runtime (no key):** `/leaderboards` → 200, renders the honest "Waiting for ERC-8004 Registry" state, **no secret in HTML**, no crash.

This document records the **actual** 8004scan API used and exactly how its real
fields map to the internal `LeaderboardAgent`. No fields are invented.

---

## 1. Endpoint used

|          |                                                                              |
| -------- | ---------------------------------------------------------------------------- |
| Base URL | `https://8004scan.io/api/v1/public` (override: `EIGHT004SCAN_BASE_URL`)      |
| Endpoint | `GET /agents` — "List and filter agents with pagination"                     |
| Docs     | https://8004scan.io/developers · OpenAPI: `/api/v1/public/docs/openapi.json` |
| Client   | `apps/web/lib/eight004scan/client.ts` → `listAgents(params)` (server-only)   |

**Query params actually sent** (all documented in the OpenAPI spec):
`page`, `limit` (1–100), `chainId?`, `ownerAddress?`, `search?`, `protocol?`
(`MCP|A2A|OASF|Web|Email`), `sortBy` (`created_at|stars|name|token_id|total_score`),
`sortOrder` (`asc|desc`), `isTestnet?`.
The loader requests `sortBy=total_score&sortOrder=desc&isTestnet=false&limit=20`.

No other endpoints are called in this sprint (search / by-id / accounts / stats /
feedbacks / chains exist but are out of scope for `GET /agents`).

---

## 2. Actual response schema (verified against a live call)

Envelope (all endpoints):

```json
{ "success": true, "data": [ Agent, … ], "meta": { … } }
{ "success": false, "error": { "code", "message", "details?" }, "meta": { … } }
```

`meta.pagination`: `{ "page": 1, "limit": 20, "total": 714397, "hasMore": true }`.

**Agent fields actually returned** (transcribed verbatim into
`apps/web/lib/eight004scan/types.ts` — `Scan8004Agent`):

| Field                  | Type            | Notes (from live data)                             |
| ---------------------- | --------------- | -------------------------------------------------- |
| `id`                   | string (uuid)   | 8004scan record id                                 |
| `agent_id`             | string          | `"<chainId>:<contract>:<tokenId>"`                 |
| `token_id`             | string          | on-chain token id                                  |
| `chain_id`             | number          | 1, 56, 196, 103, …                                 |
| `chain_type`           | string          | `"evm"` / `"solana"`                               |
| `contract_address`     | string          | registry contract                                  |
| `is_testnet`           | boolean         |                                                    |
| `owner_id`             | string \| null  |                                                    |
| `owner_address`        | string \| null  |                                                    |
| `owner_ens`            | string \| null  |                                                    |
| `owner_username`       | string \| null  |                                                    |
| `owner_avatar_url`     | string \| null  |                                                    |
| `owner_publisher_tier` | string \| null  |                                                    |
| `owner_certified_name` | string \| null  |                                                    |
| `name`                 | string \| null  | API already backfills `"Agent #<id>"` when unnamed |
| `description`          | string \| null  |                                                    |
| `image_url`            | string \| null  |                                                    |
| `is_verified`          | boolean         | **only trust signal exposed**                      |
| `star_count`           | number          |                                                    |
| `supported_protocols`  | string[]        | e.g. `["Web"]`, `[]`                               |
| `x402_supported`       | boolean         |                                                    |
| `total_score`          | number          | numeric score (observed 0, 12, …)                  |
| `rank`                 | number \| null  | **null in all observed rows**                      |
| `network_rank`         | number \| null  | **null in all observed rows**                      |
| `health_score`         | number \| null  | **null in all observed rows**                      |
| `total_feedbacks`      | number          |                                                    |
| `average_score`        | number          |                                                    |
| `cross_chain_versions` | unknown \| null |                                                    |
| `created_at`           | string (ISO)    |                                                    |
| `updated_at`           | string (ISO)    | used for freshness                                 |

---

## 3. Fields mapped to `LeaderboardAgent`

`apps/web/lib/eight004scan/normalize.ts` → `normalizeAgent()`.
Internal model: `apps/web/lib/eight004scan/leaderboard-types.ts`.

| LeaderboardAgent | Source field          | Transform                                                     |
| ---------------- | --------------------- | ------------------------------------------------------------- |
| `id`             | `id`                  | passthrough                                                   |
| `agentId`        | `agent_id`            | passthrough                                                   |
| `tokenId`        | `token_id`            | passthrough                                                   |
| `slug`           | `agent_id`            | route key for `/agents/[slug]` (only stable real id)          |
| `name`           | `name`                | fallback `"Agent #<token_id>"` when blank (API does this too) |
| `chainId`        | `chain_id`            | passthrough                                                   |
| `chainType`      | `chain_type`          | passthrough                                                   |
| `isTestnet`      | `is_testnet`          | passthrough                                                   |
| `protocols`      | `supported_protocols` | passthrough (array; may be empty)                             |
| `verification`   | `is_verified`         | `true → "verified"`, `false → "unverified"`                   |
| `registryScore`  | `total_score`         | finite-number or `null` (never 0-as-missing)                  |
| `sourceRank`     | `rank`                | finite-number or `null`                                       |
| `networkRank`    | `network_rank`        | finite-number or `null`                                       |
| `averageScore`   | `average_score`       | finite-number or `null`                                       |
| `totalFeedbacks` | `total_feedbacks`     | finite-number or `null`                                       |
| `starCount`      | `star_count`          | finite-number or `null`                                       |
| `updatedAt`      | `updated_at`          | passthrough (ISO) → freshness label                           |
| `createdAt`      | `created_at`          | passthrough                                                   |
| `ownerAddress`   | `owner_address`       | passthrough                                                   |
| `imageUrl`       | `image_url`           | passthrough                                                   |
| `source`         | —                     | constant `"8004scan"` (provenance)                            |

**Display ordinal (rank column):** since the API's own `rank` is `null` upstream,
the table shows a **positional ordinal** (1, 2, 3…) reflecting the API's returned
order (server-sorted by `total_score desc`). This is a position, **not** a
fabricated 0–100 score, consistent with the frozen blueprint §10.

---

## 4. Unsupported fields → `null` (never fabricated)

The blueprint/UI reference these, but **8004scan does not provide them**, so they
are hard-typed `null` and render as `—` in the existing UI:

| LeaderboardAgent field               | Why null                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `category` (`AgentCategory \| null`) | 8004scan has no product-category taxonomy (rebalancing/grid/yield/health-factor)                  |
| `risk` (`null`)                      | No risk field in the API                                                                          |
| `reputationLevel` (`null`)           | API exposes raw `average_score`/`total_feedbacks`, **not** a qualitative level (excellent/good/…) |
| `activity` (`null`)                  | No activity-level/trend field                                                                     |
| `successRate` (`null`)               | No success-rate field                                                                             |

Also **not surfaced as ranking metrics** (no source): `volume`, `win-rate`,
`freshness-as-metric` — these Sprint 2F selector labels remain visible (design is
frozen), but they have no 8004scan backing and therefore rank on the real
`total_score` order with unsupported cells shown as `—`. (This selector-vs-source
mismatch was already logged in `Sprint2G-Integration-Discovery.md §8` and awaits a
UX decision; **no labels were changed** in this sprint.)

---

## 5. Authentication requirement

- **Header:** `X-API-Key: <key>` (documented; optional).
- **Env var (server-only):** `8004SCAN_API_KEY`.
  - Read via `process.env["8004SCAN_API_KEY"]` in `client.ts` (`get8004ScanApiKey()`).
  - **Never** prefixed `NEXT_PUBLIC_`; **never** read in a client component.
  - The client + loader are imported **only** by the server component
    (`app/(app)/leaderboards/page.tsx`); the client view imports **types only**
    from `leaderboard-types.ts` (erased at compile time).
- **Anonymous tier** works without a key (10 req/min, 100/day) — but by product
  decision we do **not** call the API until a key is configured (see §6).
- Verified: the rendered HTML contains neither `8004SCAN_API_KEY` nor `X-API-Key`.

---

## 6. Missing-key behavior (keyless-safe)

`apps/web/lib/eight004scan/leaderboard.ts` → `getLeaderboard()`:

```
if (!has8004ScanApiKey())  →  { state: "missing-key", agents: [] }   // NO network call
```

- No key → **no fetch**, returns `missing-key`. The UI maps this to the exact
  Sprint 2F **"Waiting for ERC-8004 Registry"** skeleton/unavailable state.
- `getLeaderboard()` **never throws** — every path resolves to an honest state.
- The route is `export const dynamic = "force-dynamic"` + `revalidate = 0`, so it
  **never fetches during `next build`** — CI needs no secret, no network. Confirmed:
  `/leaderboards` builds as `ƒ` (dynamic), not `○` (static).
- Repo hygiene: root `.gitignore` already excludes `.env`, `.env.*`, `.env*.local`
  (keeps `!.env.example`); added `.env.example` containing only `8004SCAN_API_KEY=`.

---

## 7. Error handling

`client.ts` maps HTTP/envelope failures → a normalized `reason`; the loader maps
that → a `LeaderboardDataState`; the view maps that → an existing UI state.

| Condition                                 | HTTP    | `reason`                  | `LeaderboardDataState` | UI (existing 2F component)                             |
| ----------------------------------------- | ------- | ------------------------- | ---------------------- | ------------------------------------------------------ |
| No API key                                | —       | —                         | `missing-key`          | Skeleton + "Waiting for ERC-8004 Registry"             |
| Success, rows                             | 200     | —                         | `ready`                | Real `<Table>` rows / mobile cards                     |
| Success, 0 rows                           | 200     | —                         | `empty`                | `NoAgents` (or `NoSearchResults` if a query is active) |
| Unauthorized                              | 401/403 | `unauthorized`            | `unauthorized`         | `RegistryOffline` + Retry                              |
| Rate limited                              | 429     | `rate-limited`            | `rate-limited`         | `RegistryOffline` + Retry                              |
| Bad request / not found                   | 400/404 | `bad-request`/`not-found` | `error`                | `RegistryOffline` + Retry                              |
| Network / timeout / 5xx / `success:false` | —       | `error`                   | `offline`              | `RegistryOffline` + Retry                              |

Notes:

- Request timeout is 8s (`AbortController` via the shared `data-api` client).
- `cache: "no-store"` — no caching of registry responses.
- The 8004scan envelope (`{success,data,meta}`) is parsed explicitly using
  `forceLiterally: true` so the generic `data-api` envelope (`{ok,data,error}`) is
  bypassed; the 8004scan `success:false` shape is handled without leaking details.

---

## 8. Pagination behavior

- Request: `?page=<n>&limit=<1..100>` (documented).
- Response echo: `meta.pagination = { page, limit, total, hasMore }` — passed
  through to `LeaderboardData.pagination` (real values, or `null` when unavailable).
- The frozen 2F UI ships a single-page `Pagination` control (design frozen); this
  sprint does **not** change that control. Wiring multi-page navigation is a
  follow-up (the real `total`/`hasMore` are already available to enable it).

---

## 9. Files added / changed

**Added (server-only integration + shared types):**

- `apps/web/lib/eight004scan/types.ts` — raw API response types (verbatim).
- `apps/web/lib/eight004scan/client.ts` — typed `GET /agents` client (reuses `@bnb-marketplace/data-api`).
- `apps/web/lib/eight004scan/normalize.ts` — `normalizeAgent()` (unsupported → null).
- `apps/web/lib/eight004scan/leaderboard-types.ts` — `LeaderboardAgent` / `LeaderboardData` (client-safe).
- `apps/web/lib/eight004scan/leaderboard.ts` — `getLeaderboard()` loader (keyless-safe).
- `apps/web/app/(app)/leaderboards/leaderboards-view.tsx` — Sprint 2F UI (design unchanged) + data wiring.
- `.env.example` — `8004SCAN_API_KEY=` only.

**Changed:**

- `apps/web/app/(app)/leaderboards/page.tsx` — now a server component (`force-dynamic`) that loads data and renders `LeaderboardsView`.
- `packages/config/src/env.ts` — added optional `8004SCAN_API_KEY` + `EIGHT004SCAN_BASE_URL` (documentation/validation only; both optional).

**Untouched (frozen):** `packages/ui`, Sprints 2B/2C/2D/2E, the Leaderboards
layout/design/columns/labels/copy, and all metric labels.

---

## 10. Honesty guarantees

- **0 fake agents** — only real `GET /agents` rows are rendered.
- **0 fake ranking numbers** — ordinal positions only; no synthetic composite score.
- **0 fake reputation/risk/activity** — those are `null` → `—`.
- **0 exposed secrets** — key is server-only; absent from client bundle + HTML.
- **0 build-time network** — `force-dynamic`; keyless build/lint/typecheck all green.
