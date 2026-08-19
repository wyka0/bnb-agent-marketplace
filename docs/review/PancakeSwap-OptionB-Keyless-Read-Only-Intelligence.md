# PancakeSwap Option B — Keyless Read-Only Market Intelligence (Agent Details)

**Scope:** Replace the honest-but-empty PancakeSwap block on Agent Details with REAL READ-ONLY PancakeSwap V2 intelligence using official **public, keyless** sources: the public BNB Chain JSON-RPC (`eth_call` reads against the official PancakeSwap V2 factory) + the official PancakeSwap token-price API (`explorer.pancakeswap.com`). Server-only, non-custodial, non-executing: no API key, no wallet, no signing, no approval, no swap, no transaction. Options B constraints honoured: real data for known values, `null` (never `0`) for unknown, BSC mainnet (chain 56) explicit, bounded timeouts/response/caching, honest empty states, focused offline tests, `typecheck` + `lint` + `build` clean, review report under `docs/review/`. Production (Vercel) verification **NOT performed — not authorized** in this pass. No commit/push. No X.49–X.71 changes; no X.72/X.73; no AWS/KMS; no wallet signing; no fabricated or mock data anywhere in production code (fixtures exist only in `*.verify.ts` harnesses, labeled TEST FIXTURE).

**Date:** 2026-08-19
**Phase:** PancakeSwap Track — Option B implementation (post-audit activation).
**Tag legend:** IMPLEMENTED · VERIFIED · NOT IMPLEMENTED.

---

## 1. Official-Source Verification — IMPLEMENTED · VERIFIED (live probes)

Every candidate official source was probed before implementation; the two keyless survivors are the only sources used:

| Source | Key required? | Probe result |
| --- | --- | --- |
| `developer.pancakeswap.finance/apis/subgraph` (NodeReal / MegaNode GraphQL) | **Yes** (`PANCAKESWAP_API_KEY`) | Documented as keyed; powers the legacy `lib/pancakeswap/client.ts` |
| TheGraph gateway (subgraph `pancakeswap/exchange-v2`) | **Yes** | 401-style auth error without a key ("auth error: malformed API key") |
| `api.pancakeswap.info` (legacy) | No | HTTP 500 — dead |
| `bsc.streamingfast.io` (official V2 subgraph) | No | 404 |
| `bsc-dataseed1.bnbchain.org` / `bsc-dataseed.binance.org` (+ 2,3) — **public BNB Chain JSON-RPC** | **No** | HTTP 200; `eth_chainId` → `0x38` (BSC mainnet). Documented as an allowed public endpoint in the official `pancakeswap/pancakeswap-ai` plugin skill |
| `explorer.pancakeswap.com/api/cached/tokens/price/list/…` — **official PancakeSwap price API** | **No** | HTTP 200; real keyless rows `{ priceUSD, tvlUSD, timestamp, chainId }` (probed with `56:0x0E09FABB73BD3ADE0A17ECC321FD13A19E81CE82`); same endpoint family used by the official `@pancakeswap/price-api-sdk` |
| `router-api.pancakeswap.com` | No | DNS failure — not used |

On-chain probing (authorized during source verification): factory `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` is live (`allPairsLength()` ≈ 2,690,350→2,690,351 during this session); `allPairs(0)` = `0x804678fa97d91b974ec2af3c843270886528a9e6` (CAKE/BUSD, via token0/token1 + `symbol()` reads). `getPair()` **reverts** on both public RPCs, and CREATE2 derivation of pair addresses did not match (`derived ≠ actual`) — so pool discovery uses the **registry head/tail window via `allPairs(i)`**, honestly labeled in the sample scope.

---

## 2. Architecture — IMPLEMENTED · VERIFIED

```
Agent Details request  (/agents/[slug]; force-dynamic, revalidate 0)
        ↓  (server component page.tsx)
resolvePancakeSwap() → getPancakeSwapPoolIntelligence({ limit: 5 })   [server-only lib]
        ↓
① selectRpc(): probe eth_chainId on public RPCs → chain-56 sanity (never mixes networks; 60s TTL cache)
        ↓
② readFactory(): allPairsLength() + bounded window indices (head [0,W) + tail [len-W,len), W=8 max 16)
        ↓
③ allPairs(i) → pair addresses (bounded worker pool, concurrency 8)
        ↓
④ token0()/token1() per pair
        ↓
⑤ ONE bounded GET  explorer.pancakeswap.com/api/cached/tokens/price/list/56:0x…,56:0x…
        ↓
⑥ keep only pairs whose BOTH tokens carry a real official price (absent = "no price", never 0)
        ↓
⑦ getReserves() + symbol()/decimals() per surviving token
        ↓
⑧ normalize → TVL(USD) = reserve0×price0 + reserve1×price1 → rank by TVL → display cap
        ↓
PancakeSwapIntelligenceData (discriminated: ready | not-found | timeout | server-error | …) → client section
```

- **Never throws** — every path resolves to a discriminated honest state; every HTTP call bounded (RPC 12 s, chainId probe 5 s, price API 10 s) with `AbortController`; in-memory TTL cache (60 s, capped at 200 entries) protects the public endpoints.
- **Honest sample scope** — the `sample` field states exactly what was read (`registryLength`, `headCount`, `tailCount`), and the UI prints it verbatim; the section is called "Market Intelligence", never "top pools".
- The legacy keyed loader (`lib/pancakeswap/client.ts`) is **left untouched** (its keyed NodeReal path and existing verify harnesses remain); the page no longer imports it. No `PANCAKESWAP_API_KEY` is read anywhere in the new path.

## 3. UI Integration — IMPLEMENTED · VERIFIED

- `agent-detail-view.tsx` — new `PancakeSwapPoolSection` renders **"PancakeSwap Market Intelligence"**: source chip `PancakeSwap · BSC mainnet · Chain ID 56`, mandatory banner **"Read-only market intelligence — no swaps or liquidity transactions are executed by this marketplace."**, pool cards with TVL (est.), honest **24h volume "—"** (+ on-chain note), both token USD prices, reserves in human units, fee tier `0.25%`, and the no-fabricated-APR note. Sample-scope line under the cards. Non-ready states → honest copy (e.g. not-found → "No pool data available."), zero fake rows.
- `page.tsx` — server-side `resolvePancakeSwap()` swapped to the keyless adapter; still resolves in `Promise.all` with agent + TermiX; a PancakeSwap failure never breaks the page.

## 4. Read-Only Boundary — IMPLEMENTED · VERIFIED

`PANCAKESWAP_READ_ONLY_BOUNDARY = true` plus the documented boundary block: no wallet/privkey/mnemonic/signing/approval/permit2/swap/addLiquidity/removeLiquidity/tx builder/no nonce; network surface is exactly *HTTP GET* (price API) + *JSON-RPC `eth_call` / `eth_chainId`*. The verify harness statically asserts (executable-code scan, comments stripped): zero forbidden tokens, RPC method allowlist `{eth_call, eth_chainId}`, no `process.env` reads.

## 5. Verification — IMPLEMENTED · VERIFIED (all green)

| Check | Command | Result |
| --- | --- | --- |
| Adapter harness (10 scenarios: normalization, missing fields, empty pool, HTTP 500, timeout, malformed RPC + malformed price body, unsupported network, read-only boundary, full pipeline success with exact TVL math, never-throws edges + credential absence) | `npm run pancakeswap:intel:verify` | PASS (ok 1–10) |
| UI harness (copy/model honesty: volume null → "—", null ≠ 0, no composite score, failure copy, no agent-ownership language, sample scoping, no browser fetch, env cleanliness, …) | `npm run pancakeswap:ui:verify` | PASS (ok 1–17) |
| TypeScript | `npm run typecheck` | PASS |
| ESLint | `npm run lint` | PASS |
| Production build | `npm run build` | PASS (`/agents/[slug]` stays `ƒ` dynamic; warnings are pre-existing ox/viem/altana SDK issues, unrelated) |

- The `server-only` import guard is neutralized **only inside the verify scripts** via the repo's established data-URL loader shim (see `docs/termix/REPRODUCIBILITY.md` §6); application code keeps the guard.
- **Bug catch during harness dev (documented):** the official price API keys rows `"56:0x…"` — the parser now normalizes to the bare lowercase address for pipeline lookups, verified by the offline fixtures and by a real live probe earlier in the session.

## 6. Production (Vercel) Verification — NOT IMPLEMENTED (not authorized)

Deployed-environment verification of the adapter was **not** performed: the task gates production verification behind authorization, which was not granted in this pass. The pre-existing prod env facts remain: Vercel prod is live, `PANCAKESWAP_API_KEY` is ABSENT in prod — the new keyless adapter is therefore the only functional path there. `next build` completing with the real code is the closest sanctioned signal. Recommended follow-up: one authorized live smoke test (`getPancakeSwapPoolIntelligence` against real endpoints) and a page screenshot check on the deployed `/agents/[slug]`.

### 6a. Live verification (2026-08-19, authorized pass) — PRODUCTION = NOT DEPLOYED

Live probes against `https://bnb-agent-marketplace-web.vercel.app/`:

- Production is live: `GET /` → HTTP 200, `X-Vercel-Id: bom1::iad1::ns2d9-1787124704731-189c23b7bea5`, `X-Vercel-Cache: MISS`, `Server: Vercel`. (No Vercel CLI/token in this environment; deployment identity is evidenced by served content.)
- Deployed Agent Detail (`/agents/1%3A0x8004a169fb4a3325136eb29fa0ceb6d2e539a432%3A12267`, a live registry identity listed on the deployed Leaderboards page) still renders the **legacy** section: `"PancakeSwap Pool Intelligence"` present; `"PancakeSwap data is temporarily unavailable"` present (the keyed NodeReal path failing with the honest empty state, exactly as in the audit).
- **All Option B markers ABSENT in prod**: `"PancakeSwap Market Intelligence"`, `"Read-only market intelligence"` disclaimer, `"TVL (est.)"`, `"Fee tier"`, chain-56 source chip. No `"Coming soon"` anywhere.
- No PancakeSwap execution surface on the deployed page: no swap / Add Liquidity / Remove Liquidity / transaction markers. The single `"Connect Wallet"` match is the pre-existing sitewide header auth control (SIWE login, per X.61), not a PancakeSwap mutation.
- Conclusion: **the Option B build is NOT deployed** (uncommitted working-tree changes were never deployed; deployment from the un-staged tree is out of scope and not authorized). Per the verification instructions, verification stops here with `PRODUCTION = NOT DEPLOYED`; no deployment was attempted.
- typecheck/lint/build were last run green on the Option B source state (this session) and no source changed since; per instruction #8 they were not re-run for the deployed (different) build.

## 7. Known/Declared Limitations (honest)

- **Sample, not census:** millions of registered pairs; only head+tail windows are read (labeled in UI). Not a "top pools" claim.
- **No 24h volume / APR/APY** from on-chain data → honest `null` + explicit notes. Never fabricated.
- **Per-pair price staleness:** price row timestamps pass through untransformed (`priceTimestamp` = latest of the two tokens).
- **Registry-window discovery** (getPair reverts on public RPCs) means some high-TVL pairs outside the windows are not seen; ranking is among the sampled, officially-priced pairs only.

## 8. Files (all verified/committed-to-working-tree only; nothing pushed)

- `apps/web/lib/pancakeswap/intelligence.ts` — new keyless read-only adapter (constants, types, helpers, pipeline, read-only boundary).
- `apps/web/lib/pancakeswap/intelligence.verify.ts` — new offline adapter harness (fixtures; fetch stubbed).
- `apps/web/app/(app)/agents/[slug]/agent-detail-pancakeswap.copy.ts` — rewritten framework-free display copy/formatters for the market-intelligence model.
- `apps/web/app/(app)/agents/[slug]/PancakeSwapPoolSection.verify.ts` — updated UI harness.
- `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`, `…/page.tsx` — section + server wiring.
- `apps/web/package.json` — `pancakeswap:intel:verify` (+ server-only shim on intel/ui verify scripts).

## 9. Final Classification

```
PANCAKESWAP OPTION B: PASS                      (implementation + offline verification; PRODUCTION = NOT DEPLOYED)
  - keyless official sources ......... VERIFIED (live probes documented above)
  - read-only boundary ............... VERIFIED (static scan + harness)
  - real data / null-not-0 ........... VERIFIED (offline fixtures + live probe values)
  - BSC mainnet explicit ............. VERIFIED (chain-56 sanity probe on every RPC)
  - bounded timeouts/cache/cap ....... VERIFIED (12s/10s/5s, 60s TTL, window ≤16, cap 8)
  - honest empty states .............. VERIFIED
  - offline tests .................... VERIFIED (10 adapter + 17 UI checks)
  - typecheck/lint/build ............. VERIFIED (all PASS)
  - production (Vercel) .............. NOT DEPLOYED (live probe 2026-08-19: legacy
                                    "PancakeSwap Pool Intelligence" section served;
                                    all Option B markers absent; legacy keyed path
                                    failing honestly in prod — PANCAKESWAP_API_KEY
                                    absent, per X.61 env inventory)
  - report ........................... docs/review/PancakeSwap-OptionB-Keyless-Read-Only-Intelligence.md
  - X.49–X.71 untouched, no X.72/X.73, no AWS/KMS, no wallet/signing, no commit/push ... CONFIRMED
```