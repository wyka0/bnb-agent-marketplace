# PancakeSwap Live Source Re-verification

> Phase: discovery-only re-verification of the live PancakeSwap BSC V2 pool-data source after Final QA
> (`docs/review/Final-QA-Report.md`) recorded the configured subgraph endpoint returning HTTP 404.
> Display framework: [TXCD](Final-QA-Report.md).
> **STRICT: no code, no keys, no package installs, no git — investigation and report only.**

---

## 1. Executive Summary

- The currently configured source — `https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2`
  (P1 canonical constant in `packages/integrations/src/pancakeswap/types.ts`) — is **decommissioned**
  (LIVE TEST: HTTP 404; also absent from today's official PancakeSwap developer docs).
- The current official BSC V2 source (OFFICIAL SOURCE: developer.pancakeswap.finance → APIs → Subgraph,
  updated 2026-05-05) is the **NodeReal MegaNode "PancakeSwap GraphQL"** marketplace package, which
  **requires a NodeReal API key**. No documented public/keyless official BSC V2 endpoint remains.
- The MegaNode BETA schema covers **every field** the current `PAIRS_QUERY` / `PcsRawPair` contract needs
  (id, name, token0/token1 {id,symbol,name}, reserve0/1, reserveUSD, reserveBNB, token0Price, token1Price,
  volumeUSD, untrackedVolumeUSD, totalTransactions) → **existing UI continues to work without change**,
  with one query-level adaptation (BETA `orderBy` restriction, see §11).
- **Final decision: `PANCAKESWAP SOURCE: API KEY REQUIRED`.**

---

## 2. Current (P1/P2/P3) Source Under Review

REPOSITORY FACT — the implementation today:

| Location                                                                | Contents                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/integrations/src/pancakeswap/types.ts` (lines 16–22)          | `PANCAKESWAP_BSC_CHAIN_ID = 56`; `PANCAKESWAP_V2_SUBGRAPH_URL = "https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2"`                                                                                                                                                                                                 |
| `packages/integrations/src/pancakeswap/client.ts` (lines 41–59, 71–135) | `PAIRS_QUERY` (pairs, ordered by variable `orderBy` ∈ {volumeUSD, reserveUSD, totalTransactions}, one of `ORDER_VAR`); read-only POST via injected `PcsFetchFn`; **no Authorization header** (comment: "the subgraph query endpoint is PUBLIC — no API key"); never throws; discriminated results `{ok:false, reason, status/message}` |
| `apps/web/lib/pancakeswap/client.ts` (lines ~30–31)                     | P2 server-only mirror of the same URL + loader, same failure policy                                                                                                                                                                                                                                                                    |

REPOSITORY FACT — prior provenance claims: P1 doc described the streamingfast URL as the "official V2 Exchange
subgraph" — that claim was based on the then-current official docs and is now stale (see §3).

---

## 3. Old Endpoint Verification (streamingfast)

LIVE TEST (this phase and Final QA):

- `POST https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2` → **HTTP 404**
- `POST https://bsc.streamingfast.io/` → HTTP 200 (host is alive; the subgraph path is gone)
- Not listed anywhere on the current official subgraph documentation page (OFFICIAL SOURCE).

Conclusion: the streamingfast-hosted V2 subgraph was **decommissioned**. No config change was made this
phase (STRICT); the app degrades honestly at runtime (verified in Final QA: server 404 → `not-found`/`server-error`
failure copy, no crash, no fabricated zeros).

---

## 4. Current Official PancakeSwap Sources

OFFICIAL SOURCE — `developer.pancakeswap.finance/apis/subgraph` (fetched this phase, updated 2026-05-05):

- **Exchange V2 (BSC mainnet)** → linked directly to NodeReal MegaNode marketplace:
  `https://nodereal.io/meganode/api-marketplace/pancakeswap-graphql`
- Exchange V3 → The Graph Explorer subgraph links (Ethereum, Arbitrum, zkSync Era, Linea; not BSC-V2 scope)
- Code reference: `github.com/pancakeswap/pancake-subgraph`

Candidate registry with classification:

| Candidate                                                                     | Classification                                                                                    | Status                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2`                 | was OFFICIAL PANCAKESWAP (hosted)                                                                 | **DEAD** (404, LIVE TEST)                                                                                                                                    |
| `api.pancakeswap.info/api/v2/pairs` (legacy REST)                             | OFFICIAL PANCAKESWAP (legacy)                                                                     | **DEAD** (HTTP 500, LIVE TEST)                                                                                                                               |
| `info.pancakeswap.finance` (legacy analytics site)                            | OFFICIAL PANCAKESWAP (legacy)                                                                     | **DEAD** (no response, LIVE TEST)                                                                                                                            |
| NodeReal MegaNode PancakeSwap GraphQL (Free/Premium)                          | **OFFICIAL PARTNER** (linked as THE V2 source by official docs)                                   | **ALIVE, key required** (401/404 without valid key, LIVE TEST)                                                                                               |
| The Graph Network gateway (`gateway.thegraph.com/api/{key}/subgraphs/id/...`) | THIRD-PARTY (PancakeSwap docs link Explorer pages for V3 chains only; BSC V2 is not pushed there) | Gated — gateway requires API key (LIVE TEST: `"auth error: malformed API key"` without a real key); hosted service dead (DNS error via `error.thegraph.com`) |
| official `@pancakeswap/price-api-sdk` (Price API)                             | OFFICIAL PANCAKESWAP SDK                                                                          | NOT A FIT: npm package (install forbidden), token prices only — no pool `reserveUSD`/`volumeUSD`/`totalTransactions`                                         |

---

## 5. Recommended Source

**NodeReal MegaNode — "PancakeSwap GraphQL".** Classification: **OFFICIAL PARTNER** (PancakeSwap's own
developer docs point to this marketplace package as the Exchange V2 source for BSC; NodeReal is the
infrastructure provider that now hosts the pancake-subgraph index).

Two marketplace tiers (OFFICIAL SOURCE — NodeReal docs):

- **PancakeSwap GraphQL v2 (Free)** — up to **200 queries/day**
- **PancakeSwap GraphQL v2 (Premium)** — up to **20,000 queries/day**

Current app usage = one small `pairs` query per page render (limit 10–100) → the **Free** tier suffices
for normal use; Premium is available if traffic grows.

---

## 6. Exact Endpoint

OFFICIAL SOURCE — NodeReal reference doc (`docs.nodereal.io/reference/pancakeswap-graphql-api`):

```
POST https://open-platform.nodereal.io/{API-KEY}/pancakeswap/graphql/
```

- Method: `POST`, body: GraphQL `{ query, variables }` (same Graph Node envelope `{ data }` as today)
- `{API-KEY}` is a literal path segment replaced by the key obtained from a MegaNode BSC app
- Trailing slash after `graphql` as shown in the doc

LIVE TEST (this phase):

- `POST https://open-platform.nodereal.io/pancakeswap/graphql` (no key) → **HTTP 404**
- `POST https://open-platform.nodereal.io/invalid-key/pancakeswap/graphql` (bogus key) → **HTTP 401**
  → endpoint is real on the host and enforces key auth (path-segment).

---

## 7. Authentication

- Mechanism: **API key embedded in the URL path segment** (documented form) — no bearer header is
  documented for this endpoint.
- Obtaining the key (OFFICIAL SOURCE): create a MegaNode account → create a **BSC** app → copy the API key
  (`https://docs.nodereal.io/reference/find-api-key-endpoint`).
- Missing key → 404; invalid key → 401 (LIVE TEST). Treat both as configuration errors; the existing
  failure mapping already handles 401 (`unauthorized`) and 404 (`not-found`).

---

## 8. API Key Requirement

**REQUIRED.** There is no public (keyless) official BSC V2 pool-data endpoint verifiable today.

- Rate limits: 200 queries/day (Free), 20,000/day (Premium) per account.
- Conceptual env var: `PANCAKESWAP_API_KEY` (suggested name — NodeReal does not prescribe an env name;
  pick at implementation time). Must live **server-only**; never `NEXT_PUBLIC_PANCAKE*`; never in the
  client bundle or repo.
- `process.env` must NOT be read in `packages/integrations` at import time (node-environment coupling
  avoided in P1) — pass the key into the client from the server loader (`apps/web/lib/pancakeswap/client.ts`).

---

## 9. BSC Chain Support

- **Yes — BNB Smart Chain (BSC) mainnet**, chain id 56, matching `PANCAKESWAP_BSC_CHAIN_ID = 56`
  (OFFICIAL SOURCE: doc states data is PancakeSwap v2 on BNB Chain). No chain mapping change needed.

---

## 10. Schema Comparison (current contract ↔ MegaNode)

OFFICIAL SOURCE (NodeReal reference schema) vs REPOSITORY FACT (`PcsRawPair`/`PAIRS_QUERY`):

| Current contract field                           | MegaNode field                                                          | Compatible   |
| ------------------------------------------------ | ----------------------------------------------------------------------- | ------------ |
| `pair.id` → `poolId`                             | `Pair.id`                                                               | ✅           |
| `pair.name` → `symbol`                           | `Pair.name`                                                             | ✅           |
| `token0 {id, symbol, name}`                      | `Pair.token0` (Token has `id, name, symbol, decimals, derivedUSD, ...`) | ✅           |
| `token1 {id, symbol, name}`                      | `Pair.token1`                                                           | ✅           |
| `reserve0` / `reserve1`                          | `Pair.reserve0` / `reserve1`                                            | ✅           |
| `reserveUSD` → `tvlUsd`                          | `Pair.reserveUSD`                                                       | ✅           |
| `reserveBNB` (selected, unused downstream)       | `Pair.reserveBNB`                                                       | ✅           |
| `token0Price` / `token1Price`                    | `Pair.token0Price` / `token1Price`                                      | ✅           |
| `volumeUSD` → `volumeUsd` (cumulative)           | `Pair.volumeUSD`                                                        | ✅           |
| `untrackedVolumeUSD`                             | `Pair.untrackedVolumeUSD`                                               | ✅           |
| `totalTransactions`                              | `Pair.totalTransactions`                                                | ✅           |
| `apr` / `apy` (by design `null`)                 | no such fields on Pair/Token — V2 has no APY concept                    | ✅ no change |
| queries: `pairs(first, orderBy, orderDirection)` | `pairs(first: 1–1000, skip: 0–2000, orderBy, orderDirection, where)`    | ⚠️ see note  |
| filters for by-id lookups                        | `where: { id: ID, id_in: [ID!] }`                                       | ✅           |

⚠️ **BETA limitation (OFFICIAL SOURCE):** MegaNode currently advertises `Pair_orderBy: [trackedReserveBNB]`
only. The current client sends `orderBy: volumeUSD | reserveUSD | totalTransactions`, which may be rejected
(400). Implementation workaround (future phase): fetch with `orderBy: trackedReserveBNB, orderDirection: desc,
first: 100`, then rank client-side by the requested key (pool TVL/volume/txns are all present per row). No
UI change needed — the ranking happens inside the existing server loader.

---

## 11. Existing UI Compatibility

- **No change to `PancakeSwapPool` normalized shape and no UI change** — every displayed field
  (pool symbol, token0/token1 symbol+name, TVL, cumulative volume, prices, tx count) maps 1:1 (§10).
- `PairDayData.dailyVolumeUSD`/`dailyTxns` exist for a possible future "24h volume" (not a current UI
  field; the current `volumeUsd` is cumulative honest volumeUSD — unchanged, never rebranded as 24h).
- APR/APY stays absent; failure copy "PancakeSwap data is temporarily unavailable." remains truthful
  (Final QA verified the graceful path).

---

## 12. Live Read-Only Test

Live tests performed this phase (all read-only, keyless — a key is NOT available under STRICT):

| Probe                                                                              | Result                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2` POST                 | 404                                                    |
| `bsc.streamingfast.io/` POST                                                       | 200                                                    |
| `api.pancakeswap.info/api/v2/pairs` GET                                            | 500                                                    |
| `info.pancakeswap.finance` GET                                                     | no response                                            |
| `open-platform.nodereal.io/pancakeswap/graphql` POST (no key)                      | 404                                                    |
| `open-platform.nodereal.io/invalid-key/pancakeswap/graphql` POST                   | 401                                                    |
| `opbnb-mainnet-graph.nodereal.io/subgraphs/name/pancakeswap/exchange-v2`           | 404 (legacy free host gone)                            |
| `graph-api.meganode.xyz/pancakeswap` / `graph-api.nodereal.io/pancakeswap/graphql` | no response                                            |
| `gateway.thegraph.com/api/1/subgraphs/id/{id}`                                     | "auth error: malformed API key" (gateway requires key) |

**Live data test: BLOCKED — API KEY REQUIRED.** No authenticated request was made (STRICT: no keys).
Keyed verification must happen in the implementation phase once the operator supplies a key.

---

## 13. Security

- Key transport: URL path segment on HTTPS to NodeReal — acceptable; but the key must be masked in any
  logged URL/error (current client never logs URLs — it returns status/failure enums only — keep it that way).
- Server-only secret: `PANCAKESWAP_API_KEY` (conceptual), loaded in `apps/web` server loader; the
  `packages/integrations` client stays injectable (key passed as an input, no `process.env` at import
  time).
- Post-implementation checks (to re-run, future phase): grep `.next/static` bundle and rendered HTML for
  the key and for `NEXT_PUBLIC_PANCAKE*`; confirm no key in `docs/`, README, `.env.example` (placeholder only).
- No signature/wallet surface changes — this is still a read-only datasource.

---

## 14. Replacement Plan (future phase — NOT executed now)

1. Operator obtains a NodeReal key (MegaNode → BSC app) and exports `PANCAKESWAP_API_KEY` locally.
2. `packages/integrations/src/pancakeswap/types.ts`: replace URL with template
   `https://open-platform.nodereal.io/${PANCAKESWAP_API_KEY}/pancakeswap/graphql` (or interpolate in client).
3. `packages/integrations/src/pancakeswap/client.ts`: accept `apiKey` in `ListPoolsOptions`; keep the
   no-throw failure policy; adapt query to BETA rule (§10) — `trackedReserveBNB` ordering + client-side
   ranking by requested key; cap `first` ≤ 1000 / `skip` ≤ 2000.
4. `apps/web/lib/pancakeswap/client.ts`: read the server-only env var; pass key; do NOT prefix `NEXT_PUBLIC_`.
5. `.env.example`: add commented placeholder `# PANCAKESWAP_API_KEY=` (no real value).
6. Verify: `pnpm pancakeswap:data:verify`, `pnpm pancakeswap:server:verify`, `pnpm pancakeswap:ui:verify`,
   live route smoke, bundle grep for the key; update P1 doc provenance claims.

---

## 15. Risks

- **BETA schema**: `orderBy`/filter set may change — mitigate with the client-side ranking design and a
  schema sanity check in the verify harness.
- **Free tier 200 queries/day** could be exhausted by heavy scraping — mitigate: keep `first` small
  (10–100), consider caching; upgrade path to Premium (20k/day) exists.
- **Key in URL path**: visible in NodeReal-side logs and any debugger — acceptable for standard API-key
  usage; never log the URL in app code.
- **Third-party write-ups** (e.g., `github.com/api-evangelist/pancakeswap`) mention the V3 BSC subgraph ID
  `78EUqzJmEVJsAKvWghn7qotf9LVGqcTxJhT5z84ZmgJ` and header-based keys — UNKNOWN/unverified; NOT used as
  the basis for the recommendation (official NodeReal reference doc prevails).
- Endpoint/auth format could change — the reference doc is authoritative at time of writing (fetched this phase).

---

## 16. Final Decision

`PANCAKESWAP SOURCE: API KEY REQUIRED`

(Rationale: the only current official BSC V2 source — NodeReal MegaNode PancakeSwap GraphQL, linked from
developer.pancakeswap.finance — is verified live but gated behind a NodeReal API key; no documented
keyless official endpoint remains. Existing UI contract is fully compatible; the streamingfast endpoint
in `types.ts`/web client is decommissioned and must be replaced in a separate implementation phase.)
