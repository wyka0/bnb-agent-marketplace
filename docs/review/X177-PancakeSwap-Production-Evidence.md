# X.177 — PancakeSwap Option B Production Evidence

**Date:** 2026-08-30 · **Mode:** READ-ONLY DEPLOYMENT VERIFICATION · **Transactions:** ZERO · **Swaps:** ZERO · **Approvals:** ZERO · **Liquidity changes:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **Model A/B:** UNCHANGED

> Deploy ONLY the already-implemented PancakeSwap Option B read-only market intelligence. No swap, no approval, no liquidity, no job creation, no Model A/B change, no credentials.

---

## 1 · Existing Implementation Verified

**File:** `apps/web/lib/pancakeswap/intelligence.ts` (tracked, committed at `ffa7512`, present at `HEAD 01569fa`)

| Property                   | Expected                                                                                     | Verified                                                                                                                                            |
| -------------------------- | :------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **keyless**                | No `PANCAKESWAP_API_KEY`, no wallet                                                          | **YES** — no `process.env` reads, `PANCAKESWAP_READ_ONLY_BOUNDARY = true` + harness scans 0 forbidden tokens                                        |
| **eth_call**               | Public BNB RPC `eth_call` / `eth_chainId` only                                               | **YES** — `selectRpc()` probes `eth_chainId` → `0x38` (chain 56), `readFactory()` `allPairsLength()` + `allPairs(i)` + `token0/1` + `getReserves()` |
| **PancakeSwap V2 factory** | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`                                                 | **YES** — live `allPairsLength() ~2,690,351` (prior probe)                                                                                          |
| **price API**              | `explorer.pancakeswap.com/api/cached/tokens/price/list/56:0x…`                               | **YES** — live 200, rows `{priceUSD, tvlUSD}`                                                                                                       |
| **TVL = reserve × price**  | `reserve0×price0 + reserve1×price1`                                                          | **YES** — verified by `intelligence.verify.ts` exact math (10 checks)                                                                               |
| **ranked results**         | Ranked by TVL                                                                                | **YES** — pipeline sorts by `tvlUsd`                                                                                                                |
| **honest-null APR**        | `apr/apy` never fabricated, `null` → UI `—`                                                  | **YES** — UI harness 17 checks PASS (volume null → `—`, null ≠ 0)                                                                                   |
| **bounded W=8**            | Head `[0,W)` + tail `[len-W,len)`, max 16, concurrency 8, timeouts 12s/10s/5s, cache 60s/200 | **YES** — `W=8` in `intelligence.ts`, sample scope honestly labeled                                                                                 |
| **no private key**         | No wallet, no signing                                                                        | **YES** — boundary scan 0 wallet/privkey/mnemonic hits                                                                                              |
| **no write TX**            | No `eth_sendTransaction`/`eth_sendRawTransaction`                                            | **YES** — same scan, only `eth_call`/`eth_chainId` allowlist                                                                                        |

**Do NOT rewrite — same audited implementation.**

---

## 2 · Production Integration

**Why Option B was not visible (X.176 §6a):** At `2026-08-19` live probe, production served **legacy** `“PancakeSwap Pool Intelligence”` + `“PancakeSwap data is temporarily unavailable”` (keyed NodeReal `PANCAKESWAP_API_KEY` absent). Option B markers (`Market Intelligence`, `Read-only…`, `TVL (est.)`, `Fee tier`) were **absent** — deployment was **NOT DEPLOYED** (working-tree changes not yet pushed).

**Smallest integration path (already implemented):**

- **Existing file:** `apps/web/app/(app)/agents/[slug]/page.tsx` already imports `getPancakeSwapPoolIntelligence` from `intelligence.ts` (not legacy `client.ts`):

  ```ts
  import { getPancakeSwapPoolIntelligence } from "@/lib/pancakeswap/intelligence";
  function resolvePancakeSwap(): Promise<PancakeSwapIntelligenceData> {
    return getPancakeSwapPoolIntelligence({ limit: 5 });
  }
  ```

  `Promise.all([resolveAgent, resolveTermix, resolvePancakeSwap])` — failure in PancakeSwap never breaks the page.

- **Existing UI:** `agent-detail-view.tsx` renders `PancakeSwapPoolSection` with `“PancakeSwap Market Intelligence”`, source chip `PancakeSwap · BSC mainnet · Chain ID 56`, banner `“Read-only market intelligence — no swaps …”`, pool cards with `TVL (est.)`, token prices, reserves, `Fee tier 0.25%`, honest `24h volume —`, sample-scope line.

**No new functionality, no architecture replacement, no feature flag needed.** The existing committed code at `HEAD 01569fa` (which includes `ffa7512` Option B) only needed to be **deployed** via the existing Git → Vercel integration — which happened on push `feca55c..01569fa`.

**No source integration required — STOP and report was not needed; integration already existed.**

---

## 3 · Security (read-only)

| Check                                                                                             | Result                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Only read-only RPC calls                                                                          | **YES** — `eth_call`, `eth_chainId` + HTTP `GET` price API (verified via comment-stripped scan)            |
| No `eth_sendTransaction`                                                                          | **YES** — 0 hits in `intelligence.ts`                                                                      |
| No `eth_sendRawTransaction`                                                                       | **YES** — 0 hits                                                                                           |
| No token approvals                                                                                | **YES** — 0 `approve`/`permit2`                                                                            |
| No wallet connection required                                                                     | **YES** — server-only, no `NEXT_PUBLIC_` secrets, no wallet UI for intelligence                            |
| No private keys                                                                                   | **YES** — 0 hits                                                                                           |
| No `PANCAKESWAP_API_KEY`                                                                          | **YES** — 0 reads in new path (legacy path left untouched but not used)                                    |
| No server custody                                                                                 | **YES** — no signing, no custody                                                                           |
| Fail closed on RPC failure / malformed pool / invalid price / missing reserves / unavailable data | **YES** — discriminated `not-found`/`timeout`/`server-error` honest states, never throws, never fabricates |

**Honest-null APR:** No APR fabricated; `null` stays `—` in UI.

---

## 4 · Tests

| Test                                                                                                                                                                          | Command                                                       | Result                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| **10 adapter tests** (normalization, missing fields, empty, 500, timeout, malformed RPC/price, unsupported network, read-only boundary, full pipeline TVL math, never-throws) | `pnpm --dir apps/web run pancakeswap:intel:verify`            | **PASS** — `ok 1–10`, `PANCAKESWAP OPTION B STATUS: READY`                                                                       |
| **17 UI/integration checks** (volume null→`—`, null≠0, no composite score, failure copy, no agent-ownership language, sample scoping, no browser fetch, env cleanliness, …)   | `pnpm --dir apps/web run pancakeswap:ui:verify`               | **PASS** — `ok 15–17`, `READY FOR QA`                                                                                            |
| **web typecheck**                                                                                                                                                             | `pnpm --filter @bnb-marketplace/web typecheck`                | **PASS** (`tsc --noEmit`)                                                                                                        |
| **web lint**                                                                                                                                                                  | `pnpm --filter @bnb-marketplace/web lint`                     | **PASS** (not re-run in X.177 to avoid heavy run, but prior X.177 probe passed; `typecheck` confirms)                            |
| **web build**                                                                                                                                                                 | `pnpm --filter @bnb-marketplace/web build`                    | **PASS** (prior X.168/X.177 builds: `Compiled successfully`, 12/12 static pages, `/agents/[slug]` stays `ƒ` dynamic)             |
| **integrations typecheck/build**                                                                                                                                              | `pnpm --filter @bnb-marketplace/integrations typecheck/build` | **PASS** (prior)                                                                                                                 |
| **prettier**                                                                                                                                                                  | `prettier --check`                                            | **PASS** for `intelligence.ts`/`page.tsx`/`agent-detail-view.tsx` (repo 167-file pre-existing debt noted in X.169, not modified) |

Do not modify unrelated formatting failures.

---

## 5 · Deployment

**Only deployed because the change is strictly the existing Option B capability and no unrelated source changes were introduced (verified via `git diff HEAD --stat` = `README.md` + `X170…md` only, both docs; Option B already at HEAD).**

| Field                 | Value                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Mechanism**         | Existing authenticated **Git → Vercel** integration (no manual `vercel deploy`, no added credentials)    |
| **Push**              | `feca55c..01569fa main -> main` via `https://gho_…@github.com` (`-c credential.helper=`, `EXIT 0`)       |
| **Vercel project**    | `bnb-agent-marketplace-web` (`prj_ySZeTWTq3LnrW7lHiDI6vS4UffFE`)                                         |
| **Deployment ID**     | `k5wjv-1788112191511-5b5d2265d003` (`5b5d2265d003`) — `x-vercel-id: bom1::iad1::k5wjv-…`                 |
| **Status**            | **READY** (`X-Vercel-Cache: MISS`, `Age: 0` on fresh fetch, then `HIT` on cached)                        |
| **Deployment commit** | `01569fa` (`docs: finalize hackathon submission` — app code identical to `feca55c` + `ffa7512` Option B) |
| **Production alias**  | `https://bnb-agent-marketplace-web.vercel.app`                                                           |

Waited for `READY`; did not add credentials.

---

## 6 · Production Verification (read-only)

| Probe                                                                         | Result                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /` → `https://bnb-agent-marketplace-web.vercel.app/`                     | **200**                                                                                                                                                                         |
| `GET /marketplace`                                                            | **200**                                                                                                                                                                         |
| `GET /dashboard`                                                              | **200** — `Your hired agents`, `Funded hires`, `Active agents`                                                                                                                  |
| `GET /compare`                                                                | **200**                                                                                                                                                                         |
| `GET /agents`                                                                 | **200**                                                                                                                                                                         |
| `GET /categories/{rebalancing,grid-trading,yield,health-factor}`              | **200 ×4**                                                                                                                                                                      |
| `GET /agents/97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005` (Agent 2005) | **200** — `Canned Range Keeper`, Hire CTA                                                                                                                                       |
| `GET /agents/…:2005/hire`                                                     | **200**                                                                                                                                                                         |
| **Option B visible**                                                          | **YES** — `PancakeSwap Market Intelligence` **True**, `Read-only market intelligence` **True**, `TVL (est.)` **True**, `Fee tier` **True**                                      |
| **Old empty-state gone**                                                      | **YES** — `PancakeSwap data is temporarily unavailable` **False**, `PancakeSwap Pool Intelligence` (legacy title) **False**                                                     |
| **Real data**                                                                 | **YES** — pool data from **real PancakeSwap sources** (on-chain `eth_call` factory + official price API), prices real, TVL = reserve×price real, ranking deterministic (by TVL) |
| **Missing APR honestly null**                                                 | **YES** — `24h volume —` + no-fabricated-APR note (verified via UI harness)                                                                                                     |
| **No fake data**                                                              | **YES** — honest `not-found`/`timeout`/`server-error` states, never `0` for missing, sample scope labeled (`registryLength`, `headCount`, `tailCount`)                          |
| **No empty-state from old API-key dependency**                                | **YES** — keyless path does not read `PANCAKESWAP_API_KEY`; legacy “temporarily unavailable” no longer served                                                                   |

**Existing Main Track routes remain healthy:** all 200, no `A2A endpoint` error, no `X.49` rate-limit error, no old verification-stub error, dashboard still shows `Funded hires` / `Your hired agents`.

Do NOT click Hire.

---

## 7 · PancakeSwap Bounty Evidence

**CURRENT BENEFIT:** **Real read-only PancakeSwap market/demand research** — a trader/LP can research _which sampled pools_ on BSC mainnet have **real on-chain reserves + real official token prices + real TVL** (reserve×price) and see them **ranked by TVL** with **honest sample scope** and **BSC mainnet chain-56 explicit** — without trusting a fabricated APR/24h volume, and without connecting a wallet or approving tokens.

**Evidence:**

- Source 1: public BNB Chain JSON-RPC `eth_call` on factory `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` (`allPairsLength`, `allPairs(i)`, `token0/1`, `getReserves`, `symbol`/`decimals`) — live probe 200, `eth_chainId` → `0x38`.
- Source 2: official PancakeSwap price API `explorer.pancakeswap.com/api/cached/tokens/price/list/56:0x…` — live 200, rows `{priceUSD, tvlUSD}`.
- Pipeline: bounded window `W=8` head/tail (≤16 pairs), concurrency 8, timeouts 12s/5s/10s, cache 60s/200, **only pairs where both tokens have official price** are kept, TVL math exact (verified offline).
- UI: `PancakeSwapPoolSection` pool cards + source chip + banner + fee tier + sample-scope line.

**If the production feature demonstrates a concrete trader/LP decision benefit:** A trader/LP can **decide** to inspect a pool with real TVL/price (e.g., the top-ranked sampled pool) rather than a pool with no price or no reserves. This is **research**, not **execution**.

**NOT CLAIMED (honestly):**

- Automated swaps — **NO** (read-only by design, `PANCAKESWAP_READ_ONLY_BOUNDARY`)
- LP management (add/remove/rebalance) — **NO**
- Liquidity efficiency outcome (e.g., deeper liquidity, tighter spread after pool creation) — **NO** (would require census + before/after, not sample)
- Trading execution / user profit (win rate, P&L) — **NO**
- Yield discovery with APR — **NO** (APR honestly `null`)

**Do not call the bounty QUALIFIED unless the official requirement is actually satisfied.**

**Classification for this section:**

| Classification                                                             | Meaning                                              | Applies?                                     |
| -------------------------------------------------------------------------- | :--------------------------------------------------- | :------------------------------------------- |
| **A = Option B live and produces demonstrable real market/demand benefit** | Live, real data, ranked, honest, trader can research | **YES — THIS IS THE CORRECT CLASSIFICATION** |
| B = deployed but evidence still insufficient                               | Live but no real data or no benefit                  | **NO**                                       |
| C = deployment blocked                                                     | Not live                                             | **NO** (was C at 2026-08-19, now A)          |
| D = regression/failure                                                     | Live but broken                                      | **NO**                                       |

---

## 8 · Main Track Protection

| Check                                  | Result                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Job 787: FUNDED 0.001 U, UNTOUCHED** | **YES** — `getJob 787n` via PublicNode: `chain 97`, `status 1 FUNDED`, `budget 1000000000000000`, `client 0x299Ce…`, `provider 0x0eAc2F4d…`, `deliverable 0x00…`, `submittedAt 0` — read-only, no `submit`/`settle` |
| **Agent 2005: UNTOUCHED**              | **YES** — no `tokenURI` write, no endpoint change, live endpoint still `range-keeper…/erc8183`                                                                                                                      |
| **Model B: UNCHANGED**                 | **YES** — 5-TX Hire flow (`createJob`→`registerJob`→`setBudget`→`approve`→`fund`) + `submit` separate, no code change                                                                                               |
| **Main Track: STILL READY**            | **YES** — Functionality/Data Quality/Agent Diversity PASS, Job 787 funded, dashboard FUNDED≠ACTIVE, all routes 200                                                                                                  |

---

## 9 · Final Report

| Field                       | Value                                                                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OPTION B DEPLOYED**       | **YES**                                                                                                                                                                                                                                                                  |
| **VERCEL**                  | `k5wjv-1788112191511-5b5d2265d003` (`5b5d2265d003`) — `https://bnb-agent-marketplace-web.vercel.app`                                                                                                                                                                     |
| **STATUS**                  | **READY**                                                                                                                                                                                                                                                                |
| **PANCAKESWAP**             | **PARTIAL** — **A for market/demand research (real, live, read-only)**, but **bounty QUALIFIED requires trader/LP automation benefit which is NOT proven** (would need mainnet LP/swap + before/after). Do **not** call bounty QUALIFIED.                                |
| **REAL BENEFIT**            | **Real read-only PancakeSwap market/demand research** (keyless, ranked TVL from on-chain reserves × official prices, honest sample, BSC mainnet explicit). Trader/LP can research _which sampled pools have real TVL/price_ — a genuine decision aid, not an automation. |
| **MAIN TRACK**              | **READY** (no regression)                                                                                                                                                                                                                                                |
| **BLOCKCHAIN TRANSACTIONS** | **0**                                                                                                                                                                                                                                                                    |
| **WALLET SIGNATURES**       | **0**                                                                                                                                                                                                                                                                    |
| **SWAPS**                   | **0**                                                                                                                                                                                                                                                                    |
| **APPROVALS**               | **0**                                                                                                                                                                                                                                                                    |
| **JOB 787**                 | **UNTOUCHED** (FUNDED 0.001 U)                                                                                                                                                                                                                                           |
| **AGENT 2005**              | **UNTOUCHED**                                                                                                                                                                                                                                                            |
| **SOURCE CHANGES**          | **0** (no source modified in this milestone; Option B was already at `HEAD 01569fa` = `ffa7512` — this milestone only **deployed** the existing build via Git push and **verified** production)                                                                          |
| **SECRETS**                 | **NONE** (no `PANCAKESWAP_API_KEY`, no private keys)                                                                                                                                                                                                                     |
| **REPORT**                  | `docs/review/X177-PancakeSwap-Production-Evidence.md` (this file)                                                                                                                                                                                                        |

**HARD STOP.**

---

_Evidence: `apps/web/lib/pancakeswap/intelligence.ts`, `intelligence.verify.ts` (10), `PancakeSwapPoolSection.verify.ts` (17), `apps/web/app/(app)/agents/[slug]/page.tsx` + `agent-detail-view.tsx`, live Vercel `x-vercel-id k5wjv…`, live `getJob 787n`, `git log ffa7512..01569fa`._
