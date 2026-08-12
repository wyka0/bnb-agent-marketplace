# PancakeSwap — Server Integration (P2, Read-Only)

**Scope:** Connect the verified P1 read-only PancakeSwap adapter to the server application layer. **No UI changed.** No `packages/ui`, no frozen sprints, no Leaderboards, no TermiX/Altana/x402/ERC-8183 changes. No swaps/liquidity/wallet/signing/keys/transactions/Permit2/Universal Router. No GitHub/git.
**Date:** 2026-08-10
**Phase:** PancakeSwap Server Integration — Phase P2.
**Tag legend:** IMPLEMENTED · VERIFIED · NOT IMPLEMENTED · BLOCKED.

---

## 1. Server architecture — IMPLEMENTED · VERIFIED

The app is **page-driven**: data is fetched in **server components** which call a **server-only lib** and hand a discriminated result to a frozen client view — the exact precedent of `apps/web/lib/eight004scan/loader` → `leaderboard page.tsx`. **There are no `route.ts` API routes in `apps/web`.** Following that convention, P2 adds a server-only lib, not an API route.

## 2. Data flow — IMPLEMENTED · VERIFIED

```
server component (apps/web/app/.../page.tsx)
        ↓
getPancakeSwapPools()  →  apps/web/lib/pancakeswap/client.ts  (server-only)
        ↓
createApiClient(@bnb-marketplace/data-api).post  →  official V2 subgraph
        ↓
normalizePairs  →  PancakeSwapPoolsData (discriminated)
        ↓
frozen client view renders the honest state (PAtomic component; NOT touched)
```

## 3. Server boundary — IMPLEMENTED · VERIFIED

A **server-only lib** — `apps/web/lib/pancakeswap/client.ts`. It is imported only by server code; the browser never imports it, so the subgraph URL stays server-side. This mirrors the existing `eight004scan/client.ts` convention exactly (same data-api reuse, same discriminated result, same "never throws" policy).

## 4. Route/loader decision — VERIFIED

**Server lib + server component** (not an API route). Rationale: the repo has NO API routes; introducing `route.ts` would be over-architecting and diverge from the existing 8004scan pattern. The page stays the server boundary.

## 5. Response contract — IMPLEMENTED · VERIFIED

```
ready:   { state:"ready", pools:PancakeSwapPool[], source:"pancakeswap", chainId:56, retrievedAt }
failure: { state: Exclude<...>, pools:[], source, chainId, retrievedAt, reason, message? }
```

Never an error-surfaced empty-success; never a fabricated numeric value.

## 6. Data semantics — VERIFIED

- `tvlUsd` ← subgraph `reserveUSD`.
- `volumeUsd` ← subgraph `volumeUSD`, **cumulative lifetime volume — NOT 24h**. Renamed NOTHING; kept honest.
- `token0Price`/`token1Price` ← schema pool prices.
- `totalTransactions` ← cumulative swaps.
- **`apr`/`apy` are `null`** — the V2 schema does NOT provide them; never computed. Verified by harness checks.
- No composite score, no derived financial metric.

## 7. Error states — IMPLEMENTED · VERIFIED

`ready` | `not-found` (empty pairs or HTTP 404) | `timeout` (AbortError) | `network-error` (fetch throw) | `server-error` (HTTP 5xx, GraphQL errors, malformed payload, no-parseable-rows) | `rate-limited` (HTTP 429) | plus honest `bad-request`/`unauthorized`/`forbidden`/`error` fallbacks. A PancakeSwap failure never breaks the marketplace page.

## 8. Cache / revalidation — IMPLEMENTED · VERIFIED

- `cache: "no-store"` is used at request time; the page stays dynamic (`force-dynamic` eligible), consistent with the leaderboard convention. Data is fetched fresh per request with zero build-time calls.

## 9. Security — VERIFIED

- Read-only GraphQL POST; **no** wallet, signing, transaction, approvals, Permit2, or Universal Router surface exists in the barrel (`audit` in the harness).
- Source scan of `apps/web/lib/pancakeswap/*.ts` for forbidden patterns (`PRIVATE_KEY`/`Authorization`/`Bearer`/Permit2/…) returns only boundary comments + the harness denylist.
- Client bundle scan (`.next/static/*`) contains **no** sub-graph URL, no `exchange-v2`, no API key, no `NEXT_PUBLIC_PANCAKE`.
- No `process.env` credential is read/printed on the read path (public subgraph).

## 10. Test strategy — IMPLEMENTED · VERIFIED

`apps/web/lib/pancakeswap/server.verify.ts`, driven by an injected offline `fetch` stub returning labeled **TEST FIXTURE / NOT LIVE PANCAKESWAP DATA** bodies — never calls the live subgraph. 15 checks: config, parse+normalize, source/chainId/retrievedAt, multiple pools, malformed-drop, not-found, network-error, timeout, server-error, rate-limited, GraphQL-error mapping, HTTP 404/429 mapping, no-wallet/signing export-surface audit, no-credential-exposure.

## 11. Verification results — VERIFIED

`pnpm --filter @bnb-marketplace/web pancakeswap:server:verify` → all checks pass, exit 0.

## 12. Regression results — VERIFIED

`pnpm lint` 12/12 ✓ · `pnpm typecheck` 12/12 ✓ · `pnpm build` 7/7 ✓. All existing suites green: `altana:verify`, `altana:erc8183:verify`, `altana:skills:verify`, `altana:x402:verify`, `altana:x402:testnet:verify` (16), `altana:x402:marketplace:verify` (10), `termix:reputation:verify` (14), `pancakeswap:data:verify` (18), **new** `pancakeswap:server:verify` (15).

## 13. P3 UI requirements — NOT IMPLEMENTED (future)

A frozen client view that renders the discriminated state — likely the TermiX-Agent-Details precedent (clearly-separated "PancakeSwap" data card), rendering the honest state. No cards/badges/filters/columns added this phase. Exact P3 scope: define which page consumes `getPancakeSwapPools()` and build ONLY that client render.

## 14. Execution intentionally excluded — NOT IMPLEMENTED

No swaps, liquidity, wallet connection, signing, keys, Permit2, Universal Router, mainnet TESTNET/testnet execution, or execution SDK installed. `packages/integrations/src/pancakeswap/index.ts` retains the documented `PCS_ADAPTER_NOT_IMPLEMENTED` placeholder.

## 15. Bounty qualification not claimed

Per the discovery report, the exact PancakeSwap Challenge criteria (live-tx/mainnet/evidence) remain officially UNKNOWN. This phase only establishes a server-side read-only data foundation. No eligibility or "1,000 CAKE" is claimed.

---

## Files changed

| File                                               | Change                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/web/lib/pancakeswap/client.ts`               | NEW — server-only GraphQL loader + types/normalization (mirrors the P1 integration) |
| `apps/web/lib/pancakeswap/server.verify.ts`        | NEW — 15-check offline verify harness (fixtures, no live calls)                     |
| `apps/web/package.json`                            | UPDATED — added `pancakeswap:server:verify` script                                  |
| `docs/review/PancakeSwap-Server-Integration-P2.md` | NEW                                                                                 |

No changes to UI, `packages/ui`, TermiX, Altana, x402, ERC-8183, Leaderboards, or config/env. No package install. No git.

---

## Status

**PANCAKESWAP P2 STATUS: READY FOR P3**
