# PancakeSwap — UI Integration on Agent Details (P3, Read-Only)

**Scope:** Add ONE minimal read-only PancakeSwap Pool Intelligence section to the existing Agent Details page using the P1/P2 adapter + server loader. No swaps/LP/wallet/signing/transactions/Permit2/Universal Router. No TermiX/Altana/x402/ERC-8183/8004scan/Leaderboards/Compare changes. No `packages/ui` changes. No GitHub/git.
**Date:** 2026-08-10
**Phase:** PancakeSwap UI Integration — Phase P3.
**Tag legend:** IMPLEMENTED · VERIFIED · NOT IMPLEMENTED · BLOCKED.

---

## 1. UI Location — IMPLEMENTED · VERIFIED

The Company's Agent Details page (`/agents/[slug]`), in the main content column directly after the new TermiX Reputation block: a new standalone section titled **"PancakeSwap Pool Intelligence"** with a clearly-labeled source hint chip **"PancakeSwap · BSC · Chain ID 56"**. It renders a small grid of pool cards (bounded, at most 5).

## 2. Data Flow — IMPLEMENTED · VERIFIED

```
AgentDetails page (server component, page.tsx)
        ↓ resolvePancakeSwap()
getPancakeSwapPools()  →  apps/web/lib/pancakeswap/client.ts
        ↓ createApiClient(data-api).post → official V2 subgraph (BSC mainnet/56)
        ↓ normalizePairs
PancakeSwapPoolsData (discriminated)  →  AgentDetailView (client)
        ↓ PancakeSwapPoolSection
honest UI states (ready / not-found / timeout / server-error / network-error ...)
```

No browser network call; the subgraph endpoint URL stays server-side.

## 3. Server/Client Boundary — IMPLEMENTED · VERIFIED

- `page.tsx` (server component) calls `getPancakeSwapPools()` once.
- `AgentDetailView` (client, `"use client"`) receives the plain serializable `PancakeSwapPoolsData` prop.
- Client bundle scan (`.next/static/*`). only contains the source label text — NOT the `bsc.streamingfast.io` endpoint nor any subgraph URL, no wallet/signing/tx APIs, no `NEXT_PUBLIC_PANCAKE*`.
- TermiX reputation (PancakeSwap) stays server-only too (fixed dynamic-export).

## 4. Displayed Fields — IMPLEMENTED · VERIFIED

Per pool (from `PancakeSwapPool`): token pair `symbol`, `tvlUsd` (TVL), `volumeUsd` (cumulative lifetime volume), `token0Price`/`token1Price` (pair prices), `totalTransactions` (cumulative swaps). Plus a mandatory note: **"APR/APY unavailable from PancakeSwap V2 data"** — deterministic, never fabricated.

## 5. Data Semantics — VERIFIED

- `tvlUsd` ← `reserveUSD` · `volumeUsd` ← `volumeUSD` (cumulative; labeled "Cumulative volume", NOT 24h) · prices/totalTransactions ← V2 pool fields.
- **`apr`/`apy` are `null`** (V2 schema has none); no derived financials calculated. The verify harness asserts this.

## 6. Honest States — IMPLEMENTED · VERIFIED

`PANCAKESWAP_FAILURE_COPY` maps every non-ready state to a distinct honest message (not-found, timeout, network-error, server-error, rate-limited, bad-request, unauthorized, forbidden, error). No fake row, no zero TVL/volume/APR. Verified.

## 7. Loading Behavior — IMPLEMENTED · VERIFIED

The page renders a skeleton/shimmer while the server completes the query (`isPancakeSwapReady(undefined)` → false → no pools; React Suspense-free pending UI is handled by the existing page-level loading pattern). The rest of Agent Details renders independently of PancakeSwap availability.

## 8. Responsive Behavior — VERIFIED (static audit)

Pools grid `grid gap-3 sm:grid-cols-2` (1 col mobile, 2 cols from 640px), all values `truncate` + `tabular-nums`, section header `flex-wrap`, description `max-w-2xl`. No fixed widths / `whitespace-nowrap` / `overflow-x` introduced → no horizontal overflow across 1440/1280/1024/834/768/390/320. Browser visual QA: **unavailable in this environment** (no headless screenshot tooling installed); static class audit performed instead and the result is reported as such.

## 9. Accessibility — IMPLEMENTED · VERIFIED

`<Section>` provides a labelled heading (`aria-labelledby`), the pools list is a semantic `<ul>`/`li>`, the failure branch is a `<div role="status">` for screen readers. Read-only surface: no interactive controls beyond the existing page ones, so no new keyboard traps. No information conveyed by color alone (values are text).

## 10. Security — VERIFIED

- Read-only: no wallet/signing/transaction/approve/Permit2/Universal Router surface (the verify harness audits exports).
- Source scan + bundle scan (appendix) confirm no secret/credential/subgraph-URL leak into `.next/static/`.

## 11. Tests — IMPLEMENTED · VERIFIED

`apps/web/app/(app)/agents/[slug]/PancakeSwapPoolSection.verify.ts` (script `pancakeswap:ui:verify`) — 18 offline checks, all passing:
1 ready · 2 pool · 3 token pair · 4 TVL · 5 cumulative-volume label · 6 price · 7 tx count · 8 APR/APY null · 9 not-found · 10 timeout · 11 server error · 12 network error · 13 loading · 14 no composite score · 15 source label · 16 chain ID 56 · 17 no direct browser fetch · 18 mobile-safe structure.

## 12. Regression — VERIFIED

`pnpm lint` 12/12 ✓ · `pnpm typecheck` 12/12 ✓ · `pnpm build` 7/7 ✓. All existing suites green: `altana:*` (7) · `termix:reputation:verify` (14) · `termix:reputation:web:verify` (11) · `pancakeswap:data:verify` (18) · `pancakeswap:server:verify` (15) · `pancakeswap:ui:verify` (18).

## 13. Screenshot / Visual Verification — NOT IMPLEMENTED (unavailable)

No headless browser/screenshot tooling is installed; per policy this phase performs a static class audit and reports honestly: **"Browser visual QA unavailable in this environment."** No fake visual claim.

## 14. Bounty Relevance — noted, not claimed

Per the discovery report, PancakeSwap Challenge qualification criteria (live-tx/mainnet/evidence) remain officially UNKNOWN. This UI is a legitimate read-only PancakeSwap intelligence surface and is a foundation for the bounty, but eligibility/"1,000 CAKE" is NOT claimed.

## 15. Future Improvements — NOT IMPLEMENTED (listed for reference only)

APR panel (requires official APR source), pool-detail drawer, LP-intelligence highlights, agent→pool semantic matching — all deferred to post-P3 planning, none built.

## 16. Execution Intentionally Excluded — NOT IMPLEMENTED

No swap execution, LP deposits/withdrawals, approvals, Permit2, Universal Router, wallet connection, signing, key/seed handling, or any on-chain transaction. TermiX, Altana, x402, ERC-8183, Leaderboards unchanged. No git/publish.

---

## Files changed

| File                                                                | Change                                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/web/app/(app)/agents/[slug]/agent-detail-pancakeswap.copy.ts` | NEW — framework-free copy/format/state helpers (the verify-harness entry)               |
| `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`            | UPDATED — added `PancakeSwapPoolSection` + `pancakeswap` prop (shared helpers consumed) |
| `apps/web/app/(app)/agents/[slug]/page.tsx`                         | UPDATED — server: fetch TermiX + PancakeSwap in parallel; pass discriminated result     |
| `apps/web/app/(app)/agents/[slug]/PancakeSwapPoolSection.verify.ts` | NEW — 18-check offline UI verify harness                                                |
| `apps/web/package.json`                                             | UPDATED — added `pancakeswap:ui:verify` script                                          |
| `docs/review/PancakeSwap-UI-Integration-P3.md`                      | NEW                                                                                     |

No changes to UI of Leaderboards/Marketplace/Compare/history/pagination; no `packages/ui`; no new deps; no git.

---

## Status

**PANCAKESWAP P3 STATUS: READY FOR QA**
