# TermiX AACP — UI Integration (Agent Details, Read-Only Reputation)

**Scope:** Surface the already-verified TermiX AACP read-only reputation on the existing Agent Details page. No TermiX job execution, no wallet signing, no private keys, no hiring/staking/settlement. No changes to x402 / ERC-8183 / Altana / 8004scan behavior / Leaderboards / `packages/ui`. No composite score. No package install. No git init/commit/push.
**Date:** 2026-08-10
**Phase:** TermiX AACP UI Integration — Phase 2.
**Tag legend:** IMPLEMENTED · VERIFIED · NOT IMPLEMENTED.

---

## 1. UI Integration Overview — IMPLEMENTED · VERIFIED

A new **"TermiX Reputation"** section was added to the Agent Details main column (`/agents/[slug]`), directly below **Performance**. It renders an additional, independent on-chain reputation signal from TermiX AACP (BSC Testnet, chain 97), visually and semantically separate from the 8004scan registry signal. All values come from a server-side read of the verified TermiX adapter contract; the browser never calls the TermiX backend. When no deterministic ERC-8004→AACP identity mapping exists (the default for a slug-only route), an honest "unavailable for this identity" state renders.

---

## 2. Data Flow — IMPLEMENTED · VERIFIED

```
Agent Details request  (/agents/[slug]?tokenId=&chainId=97&contract=0x2393…)
        ↓  (server component: page.tsx; force-dynamic, revalidate 0)
resolveTermix(searchParams)  — reads OPTIONAL identity query params
        ↓
getTermixReputationForAgent({ tokenId, chainId, contractAddress })   [server-only lib]
        ↓  mapErc8004ToTermixAgentId → deterministic only for MockAgentNFT @ 97
GET https://termix-backend.dev.termix.click/api/v1/reputation/:agentId  (public, server-side)
        ↓  normalize (honest, no fabrication)
TermixReputationResult (serializable)  →  <AgentDetailView termix={…} />  (client)
        ↓
"TermiX Reputation" section renders AVAILABLE | NOT_FOUND | UNSUPPORTED | NETWORK_ERROR
```

- No identity params → `unsupported` returned WITHOUT any network call.
- A TermiX failure never breaks the page: the rest of Agent Details renders regardless (the result is an independent prop; the fetch is wrapped and degrades to a discriminated reason).

---

## 3. Identity Mapping — IMPLEMENTED · VERIFIED

- Deterministic **only** when the ERC-8004 NFT is the TermiX `MockAgentNFT` (`0x23932e45071ba6Ef687331F429b79C09C34D5eb0`) on **chain 97**, where `tokenId === agentId`.
- Any other chain/contract, or a non-uint256 token id → **`unsupported`** (never guessed).
- A wallet address is **never** used as an agentId; `isValidAgentId` accepts uint256 strings only (verified: `0x…` rejected).
- The 8004scan registry score is **never** copied into the TermiX score; the two are separate.
- Because the frozen Agent Details route is slug-only (no registry identity yet), identity is supplied via **optional explicit query params** (`?tokenId=&chainId=&contract=`). With none, the honest `unsupported` state shows. This keeps the frozen UI otherwise untouched and avoids guessing.

---

## 4. Server/Client Boundary — IMPLEMENTED · VERIFIED

- `apps/web/lib/termix/reputation.ts` is **server-only** (imported solely by the server component `page.tsx`). It reuses the shared `@bnb-marketplace/data-api` HTTP client — the **exact precedent** of `apps/web/lib/eight004scan/client.ts`. (`@bnb-marketplace/integrations` is not linked into `apps/web`; importing it would require a package install, which is out of scope. This app-layer client mirrors the verified adapter 1:1 — same constants, mapping rule, normalization, and discriminated states. Canonical logic remains `packages/integrations/src/termix/*`, covered by `termix:reputation:verify`.)
- The client component `agent-detail-view.tsx` imports only the **type** (`import type { TermixReputationResult }`), which is erased at compile time — no server code or backend URL enters the browser bundle.
- `page.tsx` sets `export const dynamic = "force-dynamic"` + `revalidate = 0` so the lookup NEVER runs during `next build` (mirrors `/leaderboards`). `/agents/[slug]` is now `ƒ` (server-rendered on demand); all other routes unchanged.
- **Verified:** no `termix-backend` / `termix.click` / `/api/v1/reputation` string appears in `.next/static` client chunks (only visible UI labels do).

---

## 5. TermiX States — IMPLEMENTED · VERIFIED

| State             | Trigger                                      | UI                                                                                 |
| ----------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| **AVAILABLE**     | `ok:true`                                    | Score `/100` + stat grid + anomalies + optional evaluator metrics + retrieved time |
| **NOT_FOUND**     | 404                                          | "TermiX reputation data is not available for this agent."                          |
| **UNSUPPORTED**   | no identity / non-MockAgentNFT / wrong chain | "TermiX reputation is unavailable for this agent identity."                        |
| **NETWORK_ERROR** | fetch throw / timeout / 5xx / 429            | "TermiX reputation is temporarily unavailable."                                    |
| (LOADING)         | server-rendered                              | Content arrives with the server response; existing route-level loading applies     |

- **Missing data is NEVER shown as `0`.** A genuine API `score: 0` is preserved verbatim (verified); absence is always a discriminated reason.

---

## 6. Displayed Fields — IMPLEMENTED

Only fields the API actually returns:

- **TermiX Reputation Score** (0–100), `agentId`, `chainId`
- **Completed jobs, Total jobs, On-time jobs, Approved jobs, Dispute wins, Anomaly flags**
- **Decoded anomalies** (chips) when `anomalyFlags > 0`
- **Evaluator metrics** (overturns / borderline / avg-dev-from-LLM / pass-rate) — only when the API returns them
- **Retrieved** time (from `retrievedAt`, via `Intl.DateTimeFormat`)
  No labels are invented for unknown fields.

---

## 7. 8004scan Separation — IMPLEMENTED · VERIFIED

- The existing 8004scan "Reputation" trust row (source: "8004scan reputation & reviews") is **unchanged**.
- The TermiX block is a **distinct** section with its own source label chip ("TermiX AACP · Read-only on-chain reputation") and its own score, in a separate card.
- **No composite/combined score** is computed or shown; verified in the harness (no `composite`/`combined`/`registryScore`/`merged` field on the normalized record). No "Combined Reputation" anywhere.
- TermiX is not used to rank the agent.

---

## 8. Security — VERIFIED

- **Read-only**: only `GET /api/v1/reputation/:agentId` (public per authentication.md). Only header sent is `Accept: application/json`; **no** `Authorization`/`Bearer`.
- No wallet, signer, private key, transaction, staking, hiring, or settlement API in the TermiX web lib.
- No `NEXT_PUBLIC_TERMIX*` variable is defined; the only occurrence is the verify harness's forbidden-name denylist.
- **Client bundle scan:** `termix-backend` / `termix.click` / `/api/v1/reputation` absent from `.next/static`. Only user-visible labels ship to the browser.
- Grep of `apps/web/lib/termix/*.ts` for secret/wallet/sign patterns returns only boundary comments and the denylist — no real secrets or write APIs.

---

## 9. Responsive Verification — VERIFIED (static class audit)

No browser/screenshot tooling is available in this environment and installing is out of scope, so responsiveness was verified by auditing the introduced Tailwind classes across 1440 / 1280 / 1024 / 834 / 768 / 390 / 320:

- Stat grid `grid-cols-2 sm:grid-cols-3`; evaluator metrics `grid-cols-2 sm:grid-cols-4` — 2 columns at 320, no overflow.
- Score row `flex flex-wrap justify-between` and anomaly chips `flex flex-wrap` — wrap on narrow widths.
- Section header `flex flex-wrap` — the source-label chip wraps below the title on mobile.
- Section lives in the `min-w-0` main column; `tabular-nums` for numeric alignment.
- **No fixed widths, no `whitespace-nowrap`, no `overflow-x`** were introduced → no horizontal overflow at any breakpoint. Unrelated responsive behavior is untouched.

---

## 10. Tests — IMPLEMENTED · VERIFIED

`apps/web/lib/termix/reputation.verify.ts` (script `termix:reputation:web:verify`, offline injected `fetch`, labeled TEST FIXTURE / NOT LIVE TERMIX DATA) — 11 checks, all green:
1 config (chain 97/https/no-mainnet) · 2 available (read-only GET + parse + normalize) · 3 not-found (no score 0) · 4 unsupported (no network call) · 5 network failure + timeout → network-error · 6 malformed/missing score → error · **7 no composite reputation** · **8 genuine score 0 preserved** · 9 anomaly decode · 10 agentId validity (wallet address rejected) · 11 no secret exposure.

The canonical adapter tests (`termix:reputation:verify`, 14 checks) remain green and cover the same logic at the package layer.

---

## 11. Regression Results — VERIFIED

- `pnpm lint` — 12/12 ✓ · `pnpm typecheck` — 12/12 ✓ · `pnpm build` — 7/7 ✓ (18 routes; `/agents/[slug]` now `ƒ` dynamic — the intended, minimal effect of the per-request server fetch; all other routes unchanged).
- `altana:verify` ✓ · `altana:erc8183:verify` ✓ · `altana:skills:verify` ✓ · `altana:x402:verify` ✓ · `altana:x402:testnet:verify` (16) ✓ · `altana:x402:marketplace:verify` (10) ✓ · `termix:reputation:verify` (14) ✓ · `termix:reputation:web:verify` (11) ✓.
- No change to Leaderboard metrics; 8004scan / Altana / x402 / ERC-8183 behavior unchanged.

---

## 12. Future TermiX Job Execution Boundary — NOT IMPLEMENTED (intentionally deferred)

TermiX job creation/funding/execution/evaluation/settlement/disputes remain out of scope. No "Hire via TermiX" button, no fake button, no AACP hiring connection, no transactions. The deferred-execution interface stays a documented `NOT_IMPLEMENTED` placeholder in `packages/integrations/src/termix/index.ts` (`TERMIX_ADAPTER_NOT_IMPLEMENTED`). **TermiX job execution intentionally deferred.**

---

## Files Changed

| File                                                     | Change                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/lib/termix/reputation.ts`                      | NEW — server-only read-only TermiX client (reuses `@bnb-marketplace/data-api`; mirrors the verified adapter: constants, identity mapping, normalization, discriminated states) |
| `apps/web/lib/termix/reputation.verify.ts`               | NEW — 11-check offline web verify harness (fixtures, no live calls)                                                                                                            |
| `apps/web/app/(app)/agents/[slug]/page.tsx`              | UPDATED — server: `force-dynamic`; read optional `?tokenId/&chainId/&contract`; server-side TermiX fetch; pass `termix` prop                                                   |
| `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` | UPDATED — accept optional `termix` prop; add separate "TermiX Reputation" section + states (no composite; 8004scan row untouched)                                              |
| `apps/web/package.json`                                  | UPDATED — added `termix:reputation:web:verify` script                                                                                                                          |
| `apps/web/tsconfig.json`                                 | UPDATED — exclude `**/*.verify.ts` (standalone node script uses `.ts` import specifiers)                                                                                       |

No changes to `packages/ui`, 8004scan, Altana, x402, ERC-8183, Leaderboards, or any other route. No package install. No git operations.

---

## Status

**TERMIX AACP UI STATUS: READY FOR VERIFICATION.**
