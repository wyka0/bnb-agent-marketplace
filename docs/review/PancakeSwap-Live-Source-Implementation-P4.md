# PancakeSwap Live Source Implementation — P4 (NodeReal MegaNode Migration)

- Phase: P4 — Live Data Source Migration
- Scope: read-only PancakeSwap pool intelligence (BSC, chain 56) — swap the dead StreamingFast V2 subgraph for the live official NodeReal MegaNode GraphQL source
- Companion docs: `PancakeSwap-Live-Source-Reverification.md` (discovery, decision: API KEY REQUIRED), `PancakeSwap-ReadOnly-Implementation-P1.md`, `PancakeSwap-Server-Integration-P2.md`, `PancakeSwap-UI-Integration-P3.md`, `Final-QA-Report.md`
- Date: 2026-08-11

---

## 1. Objective

Migrate every live-data read path of the PancakeSwap Pool Intelligence feature from the decommissioned public subgraph (`bsc.streamingfast.io`, 404) to the official NodeReal MegaNode PancakeSwap GraphQL API — without changing the UI contract, the normalized pool model, or the security posture (server-only key, no credential leakage).

## 2. Status Summary

| Item                                                                | Status                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| Old endpoint removed from all source                                | IMPLEMENTED                                              |
| NodeReal endpoint constants + builder (Free/Premium)                | IMPLEMENTED                                              |
| Server-only `PANCAKESWAP_API_KEY` (never `NEXT_PUBLIC_*`)           | IMPLEMENTED                                              |
| Key-in-URL-path auth, never logged, always redacted                 | IMPLEMENTED                                              |
| BETA `orderBy` fallback (`trackedReserveBNB` + client-side ranking) | IMPLEMENTED                                              |
| Offline fixture verifies (integrations + web server + UI)           | VERIFIED                                                 |
| One separate live smoke test harness                                | IMPLEMENTED (run: FAILED — source HTTP 500, key valid)   |
| Live NodeReal read                                                  | FAILED — SOURCE/SCHEMA ERROR (HTTP 500 on every request) |
| `.next/static` security scan                                        | VERIFIED (CLEAN, 53 files)                               |
| Lint / typecheck / build                                            | VERIFIED (12/12, 12/12, all packages)                    |
| Regression suites (Altana ×7, TermiX ×2)                            | VERIFIED (9/9 PASS)                                      |
| UI changes / contract changes                                       | NOT IMPLEMENTED (none required)                          |

Final status line: `PANCAKESWAP P4 STATUS: FAILED — SOURCE/SCHEMA ERROR`

## 3. Old Source (Dead Endpoint)

- Previous constant: `PANCAKESWAP_V2_SUBGRAPH_URL` → `https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2`.
- Re-verification probe (discovery phase): the endpoint returns HTTP 404 — the public StreamingFast subgraph is decommissioned.
- The constant and every reference are removed from all source (integrations `types.ts` / `client.ts` / `index.ts` / `data.verify.ts`, web `client.ts` / `server.verify.ts`). The only remaining mention is a historical comment in `types.ts` documenting that the old source is decommissioned; `docs/review/PancakeSwap-Live-Source-Reverification.md` keeps the probe evidence.
- grep for `PANCAKESWAP_V2_SUBGRAPH_URL` in `*.ts/tsx/js/mjs`: 0 source matches.

## 4. New Source Selection

- Source: NodeReal MegaNode PancakeSwap GraphQL API (official, per NodeReal docs, `POST https://open-platform.nodereal.io/{API-KEY}/{product}/graphql/`).
- Default product: **Free** — `pancakeswap-free` (Free tier, ~200 queries/day per NodeReal docs).
- Optional product: **Premium** — `pancakeswap` (20k queries/day) — engaged only via an explicit `tier: "premium"` option; the loader never auto-switches tiers.
- Constants (canonical in `packages/integrations/src/pancakeswap/types.ts`, mirrored in `apps/web/lib/pancakeswap/client.ts`):
  - `PANCAKESWAP_NODEREAL_BASE_URL = "https://open-platform.nodereal.io"`
  - `PANCAKESWAP_NODEREAL_FREE_PATH = "pancakeswap-free"`
  - `PANCAKESWAP_NODEREAL_PREMIUM_PATH = "pancakeswap"`
  - `PANCAKESWAP_NODEREAL_GRAPHQL_PATH = "graphql"`
  - `buildPancakeSwapEndpoint(apiKey, tier)` → `${base}/${key}/${product}/graphql/` (trailing slash, as published).
- Discovery probes recorded in the re-verification doc: no key → 404; bogus key → 401 (auth is keyed by path).

## 5. Authentication & Key Handling

- Env var: `PANCAKESWAP_API_KEY` — SERVER-ONLY. The `NEXT_PUBLIC_PANCAKESWAP_API_KEY` name is banned and asserted never to exist (both verifies check presence-only).
- The key is a URL **path segment** (NodeReal-documented form). It is passed to the loader as `options.apiKey` and inserted by `buildPancakeSwapEndpoint`; it is NEVER placed in an Authorization header (fixtures assert no Authorization header is ever set and never logged).
- The authenticated URL is built only inside the server loader and is never returned, logged, or embedded in any error message. `sanitizeMessage()` redacts the key value AND `open-platform.nodereal.io` from GraphQL/source messages (`[REDACTED]` / `[REDACTED-URL]`); verify checks assert neither the fixture key nor the base URL can appear in any result or message.
- Env presence scan (Process/User/Machine, no values printed): `PANCAKESWAP_API_KEY` is NOT currently configured on this machine → the live probe reports BLOCKED and makes zero requests (no fabricated key, ever).
- `.env.example` gains only `PANCAKESWAP_API_KEY=` (empty). No real value exists in source, docs, tests, or Git.

## 6. Live Verification Result

- `PANCAKESWAP_API_KEY` is configured in `apps/web/.env.local` in URL-form (`https://open-platform.nodereal.io/{key}/pancakeswap-free/graphql`). The loader now accepts both documented forms (raw key or full keyed URL) via `resolvePancakeSwapEndpoint` — the key/URL was injected into the harness env without ever being printed.
- Command: `pnpm --filter @bnb-marketplace/web pancakeswap:live:verify` (harness `apps/web/lib/pancakeswap/live.verify.ts`, one bounded read-only request, limit 1).
- Result: `LIVE NODE REAL TEST — server-error` — the source answered **HTTP 500 with an empty body**; the loader honestly mapped it to `server-error` (no fabricated data, no URL/key exposed).
- Diagnosis (status-only probes; nothing sensitive printed):
  - Bogus key on `/pancakeswap-free/graphql/` → 401 (auth gate works and distinguishes unknown keys).
  - The configured valid key on `/pancakeswap-free/graphql/` → 500 for EVERY request body, including `{ __typename }` and `{}`, via two independent clients (undici in the harness and PowerShell HTTP).
  - Premium `/pancakeswap/graphql/` POST → 405; GET variants → 404.
- Conclusion: the key authenticates, but the NodeReal PancakeSwap Free GraphQL backend currently fails server-side for every request — either a NodeReal-side fault or a Free-tier quota/exhaustion condition. This is a SOURCE failure, not a code or schema issue (the loader's BETA `orderBy` contract matches the published schema, §8); per the P4 rule, NO code is changed to compensate.
- Follow-up: re-run `pancakeswap:live:verify` later; if the source recovers, the status promotes to LIVE VERIFIED with no code change.

## 7. Endpoint Format & Request Shape

- Method: `POST` one JSON body (single request per load).
- URL: `https://open-platform.nodereal.io/{PANCAKESWAP_API_KEY}/pancakeswap-free/graphql/` (Free default).
- Body: GraphQL envelope with `PAIRS_QUERY` variables `{ first, orderBy, orderDir }`; `first` clamped to 1..100 (default 10); `orderBy` mapped through `ORDER_VAR` / `ORDER_BY` whitelist provided by the caller (`volumeUSD`, `reserveUSD`, `totalTransactions`, `trackedReserveBNB`).
- Timeout: 10s via `AbortController` (`options.timeoutMs` on the integrations loader).
- Request batching: one POST per load; the BETA retry path makes at most ONE additional bounded POST (see §8).

## 8. Schema & Normalization Contract

- Expected GraphQL `data.pairs[]` rows carry the V2-compatible fields: `id` (pair address), `token0`/`token1` ({id, symbol, name}), `reserveUSD`, `volumeUSD`, `token0Price`, `token1Price`, `totalTransactions`.
- Normalization (unchanged from P1/P2, in `pools.ts`): `normalizePair`/`normalizePairs`/`isValidRawPair` produce the preserved contract — `poolId`, `token0`/`token1` (address/symbol/name), `symbol` (e.g. `WBNB/CAKE`), `tvlUsd` (from `reserveUSD`), `volumeUsd` (from `volumeUSD`, labeled CUMULATIVE, never "24h"), `token0Price`, `token1Price`, `totalTransactions`.
- APR/APY: remain `null` (V2 schema has no APY field; the UI shows the honest "not provided" note). Never fabricated.
- Missing/malformed fields: rows are dropped, never coerced to 0; a payload with zero parseable rows errors honestly instead of producing an empty/fabricated success.
- **BETA `orderBy` limitation (honest handling):** NodeReal's advertised enum only documents `orderBy: [trackedReserveBNB]`. The loaders therefore treat any source-side rejection of the requested sort as a **BETA fallback**: exactly one bounded retry with `orderBy: "trackedReserveBNB"`, `orderDir: "desc"`, cap `min(1000, max(first × 4, 50))`, then an honest client-side re-rank on the requested key (`volumeUsd`, `tvlUsd`, or `totalTransactions`) and slice to `first`. Over-`first` requests therefore return ≤ first rows ranked by the requested key rather than mislabeled data or an error. Working `orderBy` (as downstream schemas may support) is validated by the same retry logic (first attempt succeeds → no second request).
- Result envelope: `{ ok: true, data }` / discriminated failure (integrations); `{ state, pools, source, chainId, retrievedAt }` / discriminated error states (web loader).

## 9. Error Handling Matrix

| Condition                                     | Mapping                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| Missing/empty `PANCAKESWAP_API_KEY`           | `unauthorized` — "PANCAKESWAP_API_KEY is not configured", zero network calls |
| Key containing `/`                            | `unauthorized` — "invalid API key format"                                    |
| HTTP 401                                      | `unauthorized`                                                               |
| HTTP 403                                      | `forbidden`                                                                  |
| HTTP 404                                      | `not-found` (source path wrong or key rejected upstream)                     |
| HTTP 429                                      | `rate-limited`                                                               |
| HTTP 5xx                                      | `server-error`                                                               |
| Network throw / abort / timeout               | `network-error` / `timeout`                                                  |
| GraphQL `errors[]` (non-orderBy)              | `error` / `server-error`, sanitized message                                  |
| GraphQL `errors[]` matching orderBy rejection | BETA fallback (§8)                                                           |
| `data.pairs` missing / not array              | `error` / `server-error` — "unexpected response shape (no pairs)"            |
| `pairs` empty                                 | `not-found`                                                                  |
| All rows unparseable                          | `error` — "no pools could be parsed" (no fabricated zeros)                   |

All messages sanitized by `sanitizeMessage` (key + NodeReal base URL redacted).

## 10. Code Changes

| File                                                                        | Change                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/integrations/src/pancakeswap/types.ts`                            | NodeReal constants + `PancakeSwapTier` + `buildPancakeSwapEndpoint`; old URL constant removed; `apiKey`/`tier` options                                                                                                                                                    |
| `packages/integrations/src/pancakeswap/client.ts`                           | Keyed POST loader via `postQuery`; BETA fallback; `sanitizeMessage`/`isUnsupportedOrderBy`; no Authorization header; URL never logged                                                                                                                                     |
| `packages/integrations/src/pancakeswap/index.ts`                            | Barrel exports updated (builder + tier; old URL export removed)                                                                                                                                                                                                           |
| `packages/integrations/src/pancakeswap/pools.ts`                            | UNCHANGED (normalization contract intact)                                                                                                                                                                                                                                 |
| `packages/integrations/src/pancakeswap/data.verify.ts`                      | P4 offline fixture suite (see §11)                                                                                                                                                                                                                                        |
| `apps/web/lib/pancakeswap/client.ts`                                        | Mirrored NodeReal constants/builder, `resolvePancakeSwapEndpoint` (accepts raw key OR full keyed URL — the configured `.env.local` form), `postPairQuery` via `@bnb-marketplace/data-api` client, key from `process.env.PANCAKESWAP_API_KEY`, BETA fallback, sanitization |
| `apps/web/lib/pancakeswap/server.verify.ts`                                 | P4 offline fixture suite (see §11)                                                                                                                                                                                                                                        |
| `apps/web/lib/pancakeswap/live.verify.ts`                                   | NEW — the one separate live smoke harness (BLOCKED without key)                                                                                                                                                                                                           |
| `apps/web/package.json`                                                     | `pancakeswap:live:verify` script (position restored, BOM removed)                                                                                                                                                                                                         |
| `.env.example` (root)                                                       | `PANCAKESWAP_API_KEY=` added (empty)                                                                                                                                                                                                                                      |
| UI (`PancakeSwapPoolSection.verify.ts`, `agent-detail-pancakeswap.copy.ts`) | UNCHANGED — UI contract untouched                                                                                                                                                                                                                                         |

## 11. Tests & Fixtures

All deterministic OFFLINE FIXTURE tests with labeled test keys (`PCS-TEST-FIXTURE-KEY-0000`), stub `fetch` recording URLs/bodies and asserting no Authorization header:

- `pancakeswap:data:verify` (integrations, `node dist/pancakeswap/data.verify.js`) — 18 check groups incl.: builder URL equality (free + premium), missing-key → unauthorized with zero calls, endpoint URL assertion with the fixture key in the path, result JSON never contains key/base URL, BETA fallback end-to-end (3-row fixture, 2 calls, re-rank + slice), redaction of GraphQL leaks, 401/403/429/5xx/404/network/timeout mappings, no-fabrication rules, presence-only env checks incl. `NEXT_PUBLIC_PANCAKESWAP_API_KEY` ban.
- `pancakeswap:server:verify` (web) — same coverage for the web loader; 11 check groups; `run()` returns `{data, urls}` so every path asserts the exact Free endpoint URL and zero-call guarantee.
- `pancakeswap:ui:verify` — unchanged UI contract (18 checks; ready/error states, "Cumulative Volume", APR/APY not fabricated, chain 56, source label).
- `pancakeswap:live:verify` — the ONLY live harness: exactly one bounded read; prints BLOCKED and exits 0 when no key; never prints the URL/key.

Result: 3 offline suites PASSED; live suite BLOCKED-intentionally (no key configured).

## 12. Security Scan Results

Post-build scan of `apps/web/.next/static` (53 files, 1,486,858 bytes) for `PANCAKESWAP_API_KEY`, `NEXT_PUBLIC_PANCAKESWAP_API_KEY`, `PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, `MNEMONIC`, `SEED_PHRASE`, `NEXT_PUBLIC_PANCAKE`, `open-platform.nodereal.io`, `pancakeswap-free/graphql`, `/pancakeswap/graphql`, `Authorization`, `Bearer`:

- Result: `SECURITY SCAN CLEAN — no key/URL/credential material in .next/static`.
- Expected: the keyed endpoint is constructed only in server components/server loaders; nothing client-visible references the keyed URL or any credential name.

## 13. Regression Results

- `pnpm lint` — 12/12 tasks PASS (web lint re-ran clean after the migration).
- `pnpm typecheck` — 12/12 tasks PASS (one TS2339 fixed in the BETA fallback pairs narrowing).
- `pnpm build` — all packages PASS, web `next build` green (18 routes; fixed a package.json BOM introduced during script wiring).
- PancakeSwap: `data:verify` PASS, `server:verify` PASS, `ui:verify` PASS, `live:verify` BLOCKED (expected).
- Altana: `altana:verify` PASS, `altana:erc8183:verify` PASS, `altana:skills:verify` PASS, `altana:x402:verify` PASS, `altana:x402:testnet:verify` PASS (16 checks), `altana:x402:marketplace:verify` PASS (10 checks).
- TermiX: `termix:reputation:verify` PASS, `termix:reputation:web:verify` PASS.
- No unrelated fixes were made; no regressions observed.

## 14. Deployment & Operations Notes

- Provision `PANCAKESWAP_API_KEY` in the server environment (Vercel/self-host) — server-side only; never ship it in the repo or client bundles.
- Free product (`pancakeswap-free`) is the default; ~200 queries/day per NodeReal Free-tier documentation. The UI loads at most one bounded pool list per page render with `cache: "no-store"`, so per-page cost is 1 query (plus at most 1 more only on a BETA orderBy rejection). For high-traffic deployments, set `tier: "premium"` to use the 20k/day product — the loader supports it without code changes.
- The BETA fallback keeps requests bounded: worst case 2 POSTs per load, second capped at ≤ 1000 rows.
- The key is configured (URL-form or raw — both accepted). Re-run `pnpm --filter @bnb-marketplace/web pancakeswap:live:verify` to promote the status from FAILED to LIVE VERIFIED once the source returns non-5xx (no code change required).

## 15. Honesty Constraints

- No fabricated live data: every fixture is labeled TEST; live reads never ran without a real key and no fake key was ever used.
- No bounty/qualification claims: this doc claims no CAKE/qualified status and no live on-chain transaction.
- Errors surface honestly (unauthorized / rate-limited / server-error / not-found / etc.), mirrored for both integrations and web paths.

## 16. Future Work / Follow-ups

- Re-run the live smoke test when NodeReal's Free backend recovers (currently HTTP 500 on every request, see §6); update §6 and the final status line accordingly.
- Monitor NodeReal schema releases: if `Pair_orderBy` expands beyond `trackedReserveBNB`, the BETA fallback path can be simplified (first attempt already succeeds; no code change needed for correctness).
- Re-run the `.next/static` scan after any future build to keep the no-credential guarantee.

## 17. Final Status

```
PANCAKESWAP P4 STATUS: FAILED — SOURCE/SCHEMA ERROR
```

(Key valid and authenticating; NodeReal Free GraphQL backend returned HTTP 500 on every live request — source-side fault or Free-tier quota condition. Code, offline suites, security scan, and regressions all VERIFIED; re-run `pancakeswap:live:verify` when the source recovers.)
