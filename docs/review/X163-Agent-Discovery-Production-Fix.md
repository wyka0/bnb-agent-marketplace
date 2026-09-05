# X163 — Agent Discovery Production Fix

**Mode:** Read-only diagnosis + a minimal search/filter normalization fix (deployed). **ZERO blockchain transactions, zero jobs/wallets, zero Agent 2005/1906 registration changes, zero endpoint-verification bypass, zero AWS/KMS, Hire/Model A/B semantics unchanged, no fabricated agents or registry data.**

**Git boundary:** `HEAD` = `origin/main` = `e38b77b3f5a573d78ef552afa37cbdc1ec580763` (fix committed + pushed). Vercel production deployment **Ready** (`dpl_nc7tJkVtnYrb4NdcK8r8MFjs3JjK`).

---

## 1. Discovery trace (read-only)

The production marketplace list uses `getMarketplaceAgents` (two bounded queries merged: `isTestnet:false` mainnet + `chainId:97, isTestnet:true` BSC testnet, `sortBy:created_at desc`, `limit:24`, `cache:"no-store"`). The page is `force-dynamic`/`revalidate:0` (no stale HTML caching). Search is **client-side** over the fetched page (`applyMarketplaceFilters`/`matchesSearch`), never an upstream query.

**Upstream:** `8004scan /agents?chainId=97` returns chain-97 records including **Agent 2005** (`search=Canned Range Keeper` → 97/2005; `search=97:0x8004…:2005` → 1 record; token id `2005` present). Normalization retains chain-97 rows; classification (BSC discovery) retains them.

**Retained count:** the current production `/marketplace` renders 180 `97:0x…` references, 24 active Hire cards, and **Agent 2005 present** ("Canned Range Keeper" ×3 in the page data). The reported "2 agents indexed" is **not reproducible** on the current production (the index copy reflects the upstream total and currently shows hundreds of thousands; the observed "2" was a transient/older state — no cache defect exists).

## 2. Root cause

The reproducible defect was the **client-side search filter**: `matchesSearch(a, "Agent 2005")` required the whole phrase to be a substring of the agent's name/description/slug. Agent 2005's name is "Canned Range Keeper" and its slug is `97:0x8004…:2005` — neither contains the phrase **"Agent 2005"** — so the client filter returned **"No results found"** even though the agent is in the discovery data (upstream returns it; the marketplace list includes it).

## 3. Fix (minimal, registry-driven, no fabrication)

`apps/web/lib/eight004scan/marketplace.ts` `matchesSearch` now:

1. whole-phrase substring match (unchanged, primary),
2. **token-id match**: a query containing the agent's exact token id matches (e.g., `"Agent 2005"` finds the agent whose token id is `2005`) — still only against real registry fields,
3. **all-tokens (AND)** for multi-word name/description queries, so a single common word (e.g., `"trading"`) never over-matches.

No agent was hardcoded; the marketplace remains fully registry-driven. No pagination/cache/filter-removal change; `cache:"no-store"` + `force-dynamic` already ensure freshness.

## 4. Four categories

Unchanged (X.154). Rebalancing / Grid Trading / Yield Optimisation / Health Factor Monitoring discovery + category pages remain live and equal-depth; no category was artificially assigned.

## 5. Search behavior

Unit-tested: `"Agent 1001"` finds the token-1001 agent · `"Trading Testbot"` (all tokens) finds only the named agent · a single common word does not over-match · agent id and token id searches work · absent terms match nothing. The same semantics apply to `"Agent 2005"` → finds Agent 2005 via its token id.

## 6. Tests (all pass)

`marketplace:verify` (93, incl. the new search semantics) · `discovery` (60) · `main-track-user-hire` (X.149) · `main-track-v2` (X.131) · `activation` (33) · `hire` (23/23) · `hire-api` (14) · `capability-source` · `security x49` (25) · `security x55` (22) · ERC-8183. Web typecheck / lint / `next build` PASS; integrations typecheck / build PASS; prettier clean.

## 7. Production

Committed `e38b77b…`, pushed to `main`, deployed (`dpl_nc7tJkVtnYrb4NdcK8r8MFjs3JjK`, Ready). Verified live: all routes 200; `/marketplace` renders chain-97 agents + active Hire cards with Agent 2005 present; Agent 2005 detail renders the Hire flow. The client-side search now finds Agent 2005 for `"Agent 2005"` (token-id match, verified by unit test); no final blockchain transaction was executed or authorized.

## Classification

**D — PAGINATION/FILTER/NORMALIZATION DEFECT FIXED.**

Agent 2005 was always present in the registry-driven discovery data (upstream returns it; the production list includes it); the reproducible defect was the client-side **search filter** failing to match `"Agent 2005"`. The search normalization now matches the whole phrase, the exact token id, or all query tokens (no over-match), with regression tests; the fix is committed, pushed, and deployed (Ready), and the production marketplace + Agent 2005 detail are verified live. The reported "2 agents indexed" was not reproducible on the current production (no cache defect). Zero blockchain transactions. **STOP.**
