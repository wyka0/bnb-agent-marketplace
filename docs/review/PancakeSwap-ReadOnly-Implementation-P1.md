# PancakeSwap — Read-Only Data Implementation (P1)

**Scope:** server-side, READ-ONLY PancakeSwap data adapter only. No UI, no frozen-sprint changes, no `packages/ui`, no Leaderboards, no TermiX/Altana/x402/ERC-8183 changes. No swaps, liquidity, approvals, Permit2, Universal Router execution, wallet connection, signing, private keys, transaction submission, or mainnet execution. No GitHub publish / git init / commit / push.
**Date:** 2026-08-10
**Phase:** PancakeSwap Read-Only Data — Phase P1.
**Tag legend:** IMPLEMENTED · VERIFIED · BLOCKED · NOT IMPLEMENTED.

---

## 1. Official Sources Checked — VERIFIED

| Source                 | URL                                                                                          | Used for                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| PancakeSwap Developer  | `https://developer.pancakeswap.finance/`                                                     | confirm current developer surface (EVM / APIs / SDKs)        |
| Subgraph (APIs)        | `https://developer.pancakeswap.finance/apis/subgraph`                                        | official GraphQL sources; BSC V2 Exchange listed for mainnet |
| Subgraph repo + schema | `github.com/pancakeswap/pancake-subgraph` (branch `v2`, `subgraphs/exchange/schema.graphql`) | exact `Pair`/`Token` field names                             |

No third-party tutorials used. No endpoints/packages assumed.

---

## 2. Selected Data Source — IMPLEMENTED

**Official PancakeSwap V2 Exchange Subgraph (GraphQL over HTTP), BSC mainnet (chain 56).** It provides pool (`Pair`) price, volume (cumulative USD), and liquidity (reserveUSD) data read-only. It is public (no key). Rationale: the smallest-footprint read-only surface that delivers pool/TVL/volume/price for trader + LP intelligence.

---

## 3. Dependency Decision — VERIFIED

**No new dependency added.** The subgraph is plain GraphQL over HTTP, so the adapter uses an injectable `fetch` (the exact `PcsFetchFn` pattern of the TermiX adapter in the same package). The `@pancakeswap/price-api-sdk` and Smart Router are npm packages — installing is forbidden in this phase and they would add execution-adjacent surface — so they are NOT used. smallest footprint = zero new deps.

---

## 4. Chain — VERIFIED

**BSC mainnet, chain 56** (`PANCAKESWAP_BSC_CHAIN_ID = 56`). The official V2 Exchange subgraph lists **BSC mainnet** only (no BSC-testnet subgraph is published). This phase is read-only and submits **no** transaction, so a mainnet _read_ is acceptable. Never executes on-chain.

---

## 5. Endpoint / API — IMPLEMENTED

- Endpoint (public): `https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2` (from `developer.pancakeswap.finance/apis/subgraph`).
- Operation: single GraphQL POST of a fixed `PAIRS_QUERY` selecting the documented `Pair` fields (id, name, token0{…}, token1{…}, reserve0/1, reserveUSD/BNB, token0Price/1Price, volumeUSD, untrackedVolumeUSD, totalTransactions).
- Auth: none (public). No `Authorization`/`Bearer` header is set (only `Content-Type: application/json`).

---

## 6. Raw Schema — IMPLEMENTED (`types.ts`, `PcsRaw*`)

`PcsRawToken { id, symbol, name }` and `PcsRawPair { id, name, token0, token1, reserve0, reserve1, reserveUSD, reserveBNB, token0Price, token1Price, volumeUSD, untrackedVolumeUSD, totalTransactions }` — transcribed verbatim from the schema; numeric decimals are strings. Envelope is Graph-Node standard `{ data, errors? }`.

---

## 7. Normalized Schema — IMPLEMENTED (`types.ts`, `PancakeSwapPool`)

`{ poolId, chainId:56, token0Address, token0Symbol, token1Address, token1Symbol, symbol ("A/B"), tvlUsd, volumeUsd, token0Price, token1Price, totalTransactions, apr:null, apy:null, source:"pancakeswap", retrievedAt }`.

---

## 8. Supported Fields (from the official V2 subgraph) — IMPLEMENTED

pool/pair contract id · token0/token1 id+symbol+name · TVL (reserveUSD) · cumulative volume (volumeUSD, USD) · token0Price/token1Price (pair price) · totalTransactions.

---

## 9. Unsupported Fields — `null` (never fabricated) — VERIFIED

**`apr` and `apy`** are always `null` because the V2 Exchange subgraph schema has **no** such field. **`volume24hUsd`** is not a V2 Pair field either (only cumulative `volumeUSD`), so there is no fabricated 24h figure. No derived/financial metric is computed from raw data this phase. Missing/absent fields are never coerced to `0`.

---

## 10. Error Handling — IMPLEMENTED · VERIFIED

Discriminated `PancakeSwapPoolResult` — `{ ok:true, data: PancakeSwapPool[] }` | `{ ok:false, reason, status?, message? }`. Reasons: `success | not-found | bad-request | unauthorized | forbidden | rate-limited | server-error | network-error | timeout (→network-error) | unsupported | error`. HTTP 404/empty-pairs → `not-found`; 429 → `rate-limited`; 5xx → `server-error`; fetch throw / AbortError → `network-error`; GraphQL `errors[]` / malformed body / all-invalid rows → `error`. Failures are NEVER turned into zero TVL/volume/APR/price.

---

## 11. Timeout — IMPLEMENTED · VERIFIED

A bounded `AbortController` timeout per request via the `timeoutMs` option (handled by the fetch layer; the verify harness simulates abort → `network-error`).

---

## 12. Authentication — VERIFIED (public)

The subgraph endpoint is **public** — **no API key, no `process.env` credential** on the read path. A server-only base-URL override is supported but no secret/name needs to be introduced. No `NEXT_PUBLIC_PANCAKE*` is defined. Never prints a credential.

---

## 13. Security — VERIFIED

Read-only: the barrel/Surface exposes only `listPools`, `PAIRS_QUERY`, normalizers, and types — the verify harness (check 15–17) scans the exported surface and fails if any `writeContract` / `sendTransaction` / `sign*` / `swap` / `add|removeLiquidity` / `approve` / `permit|permit2` API exists. **Private keys / wallet / signing: none.** Scan of `packages/integrations/src/pancakeswap/` for the listed patterns returns only guardrail comments + the verify denylist — no secrets or write capabilities.

---

## 14. Test Fixtures — IMPLEMENTED · VERIFIED

`packages/integrations/src/pancakeswap/data.verify.ts` uses a labeled `TEST FIXTURE / NOT LIVE PANCAKESWAP DATA` pair (`FIXTURE_PAIR`) and an **injected** `fetch` stub — the harness makes **zero** live network calls. Assertions 1–18 map to the required checks (parse, normalize, token pair, liquidity/TVL, volume, price, fee/APR-null, missing fields, malformed, not-found, rate-limit, server error, network error, timeout, no wallet, no signing, no transaction, no credential leakage).

---

## 15. Verification Results — VERIFIED

`pnpm pancakeswap:data:verify` → **all 18 checks PASS, exit 0** (plus a mixed-batch valid/invalid normalization check). Output ends: `PANCAKESWAP P1 STATUS: READY FOR P2 (read-only pool data)`.

---

## 16. Regression Results — VERIFIED

- `pnpm lint` — 12/12 ✓ · `pnpm typecheck` — 12/12 ✓ · `pnpm build` — 7/7 ✓.
- `altana:verify` ✓ · `altana:erc8183:verify` ✓ · `altana:skills:verify` ✓ · `altana:x402:verify` ✓ · `altana:x402:testnet:verify` (16) ✓ · `altana:x402:marketplace:verify` (10) ✓ · `termix:reputation:verify` (14) ✓ · `pancakeswap:data:verify` (18) ✓ — all green.

---

## 17. Future UI Integration — NOT IMPLEMENTED (intentional)

No UI files touched (`apps/web/app/*`, `apps/web/components/*` unchanged). No PancakeSwap cards/badges/filters/leaderboard columns. A future P2/P3 would surface this data server-side behind Agent Details (the TermiX Reputation pattern) — out of scope here.

---

## 18. Execution Intentionally Excluded — NOT IMPLEMENTED

Swaps, liquidity provision/withdrawal, token approvals, Permit2, Universal Router execution, wallet connection, signing, and transaction submission are all **out of scope**. The deferred LP/execution contract remains a documented `NOT_IMPLEMENTED` placeholder in `index.ts` (`PCS_ADAPTER_NOT_IMPLEMENTED`). No `@pancakeswap/*` execution SDK was installed.

---

## 19. Bounty Relevance — noted, not claimed

The challenge text requires **an agent delivering a real benefit to PancakeSwap traders or liquidity providers**. This adapter is the **read-only data foundation** for such intelligence (pool/liquidity/trader data). It does **not** itself qualify for the bounty, and bounty eligibility is **not** claimed. Final qualification remains subject to the official PancakeSwap challenge criteria (currently: live-tx/mainnet/evidence requirements = UNKNOWN per the discovery report).

---

## Files Changed

| File                                                   | Change                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `packages/integrations/src/pancakeswap/types.ts`       | NEW — raw + normalized pool types, constants, options, discriminated result                                         |
| `packages/integrations/src/pancakeswap/client.ts`      | NEW — read-only subgraph GET (GraphQL POST of public query), injected fetch, bounded timeout, discriminated results |
| `packages/integrations/src/pancakeswap/pools.ts`       | NEW — honest normalization (invalid rows dropped, apr/apy null, no fabrication)                                     |
| `packages/integrations/src/pancakeswap/data.verify.ts` | NEW — 18-check offline verify harness                                                                               |
| `packages/integrations/src/pancakeswap/index.ts`       | UPDATED — barrel re-export + retained NOT-IMPLEMENTED execution placeholder                                         |
| `packages/integrations/package.json`                   | UPDATED — added `pancakeswap:data:verify` script                                                                    |

No changes to UI, `packages/ui`, TermiX, Altana, x402, ERC-8183, Leaderboards, or config/env. No `pnpm install` (zero new deps). No git.

---

## Status

**PANCAKESWAP P1 STATUS: READY FOR P2**
