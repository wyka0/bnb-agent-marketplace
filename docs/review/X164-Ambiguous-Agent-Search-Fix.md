# X164 — Ambiguous Agent-ID Search Fix

**Mode:** Read-only diagnosis + a minimal, registry-driven search relevance/normalization fix (deployed). **ZERO blockchain transactions, zero jobs/wallets, zero Agent 2005/1906 registration changes, zero endpoint-verification bypass, zero AWS/KMS, Hire/Model A/B semantics unchanged, no fabricated agents or registry data.**

**Git boundary:** `HEAD` = `origin/main` = `175bde1616ed11f0b5c19dcc523249cdb627b4b7` (fix committed + pushed). Vercel production deployment **Ready** (`dpl_6tfA5TFGssq16eXoL1J8U2bybvv3`).

---

## 1. Diagnosis (read-only)

The marketplace search is **client-side** over the fetched page (`applyMarketplaceFilters` / `scoreAgentMatch`, formerly `matchesSearch`). X.163 added token-id matching so `"Agent 2005"` finds the agent whose `tokenId === 2005`, but it **ignored chain and treated the token id as globally unique**:

- X.163 `matchesSearch` matched any record whose `tokenId` equaled a numeric query token, on **any** chain. So a `chain 56` record with token `2005` (e.g. `Glyph #2005`, `56:0xCfFacE0003:2005`) matched `"Agent 2005"` exactly the same as the `chain 97` live seller (`Canned Range Keeper`, `97:0x8004…:2005`). That is the reported "Agent 2005 → returns unrelated agents" collapse — a chain-aware-identity violation.
- A bare numeric token was also implicitly "unique", contradicting the requirement that token ids are not globally unique.

No records were hardcoded; the marketplace stayed registry-driven. The upstream 8004scan returns chain-97 Agent 2005 (`Canned Range Keeper`) and the production list includes it (verified live: `Canned Range Keeper` present, 24 active Hire cards).

## 2. Root cause

`matchesSearch` was a **boolean** matcher with a chain-agnostic token-id branch. It could not rank results, could not express "exact name/slug beats a coincidental token match," and could not represent "ambiguous token → show all, do not pick one."

## 3. Fix (minimal, registry-driven, no fabrication)

Replaced boolean matching with deterministic **relevance scoring** in `apps/web/lib/eight004scan/marketplace.ts`:

```
scoreAgentMatch(agent, query, ctx):
  P1 exact normalized agent name            → 1000
  P2 exact normalized slug (route key)      → 950
  P3 exact full registry identifier         → 950
  P4 token-id match (only when the query is an explicit reference
     "Agent <n>" / "token <n>" / "chain:reg:token", or a bare single
     numeric token):
       - referenced + unambiguous in result set        → 600 + chainBoost
       - referenced but ambiguous (multiple share id)  → 200 + chainBoost
       - bare numeric (NOT globally unique)            → 150 + chainBoost
     chainBoost = 25 when chainId === MARKETPLACE_LIVE_CHAIN (97)
     otherwise (a multi-word name query that merely contains a number)
       → fall through to text relevance, never collapse onto a same-token record
  P5 all query tokens present (AND)         → 300   (multi-word stays AND-only)
  P6 single query token present (text)      → 50    (restricted to single token)
```

`applyMarketplaceFilters` now computes per-set token-id counts (uniqueness), filters by score > 0, and — when a query is present — **sorts by score (desc), tie-break by name**. So:

- `"Canned Range Keeper"` → exact name (1000) → first.
- `"Agent 2005"` → both chain-97 (live) and chain-56 (`Glyph #2005`) token-2005 records match, but the chain-97 live seller ranks first (explicit + chain boost); neither is arbitrarily selected — both are returned, deterministically ordered. The chain-56 record is **not** collapsed onto `97:…:2005`.
- `"#2005"` → matches only the literally-named `Glyph #2005` record (text), not the live agent.
- `"2005"` (bare) → both token-2005 records returned (not globally unique), live seller ranked first.
- Multi-word name queries stay AND-only (no any-token over-match — the X.163 regression is preserved).

`MARKETPLACE_LIVE_CHAIN = 97` is the platform's live-seller chain constant (not an agent hardcode). No agent, name, or registry record is hardcoded.

## 4. Four categories

Unchanged (X.154). Rebalancing / Grid Trading / Yield Optimisation / Health Factor discovery + category pages remain live and equal-depth.

## 5. Search behavior (regression, non-hardcoded)

Verified by added unit tests over fixtures `CANNED_RANGE_KEEPER` (97:…:2005) and `GLYPH_2005` (56:…:2005):

- `"Canned Range Keeper"` → exact name first.
- exact slug `97:0x8004…:2005` → exact record.
- `"Agent 2005"` → both token-2005 records returned (no single arbitrary pick), chain-97 live seller ranked first.
- `"#2005"` → the literally-named record deterministically (not the live agent).
- bare `"2005"` → not globally unique, both returned, live seller first.
- case-insensitive name; partial name (`"Range Keeper"`); all-token AND (`"Canned Range Keeper 2005"` → single named record); chain-97 identity preserved (97 vs 56 not collapsed).

## 6. Tests (all pass)

`marketplace:verify` (104, incl. the new X.164 semantics) · `discovery` (60) · `main-track-user-hire` (X.149) · `main-track-v2` (X.131) · `main-track-user-wallet` (X.139) · `activation` (33) · `hire` (23/23) · `hire-api` (14) · `capability-source` · `security x49` (25) · `security x55` (22) · ERC-8183. Web `typecheck` / `lint` / `next build` PASS; integrations `typecheck` / `build` PASS; prettier clean. One deploy-time type error (`tokens[0]` under `length === 1` narrowing) was fixed and re-verified before deploy.

## 7. Production

Committed `175bde1…`, pushed to `main`, deployed (`dpl_6tfA5TFGssq16eXoL1J8U2bybvv3`, Ready). Verified live: all routes 200; `/marketplace` renders chain-97 agents + active Hire cards with `Canned Range Keeper` present; Agent 2005 detail renders the Hire flow. The client-side search now ranks `Canned Range Keeper` first for `"Agent 2005"` and never collapses `97:…:2005` with a chain-56 `#2005` record (proven by unit test); no final blockchain transaction was executed or authorized.

## 8. Hire safety

Search is purely a discovery filter; it never sets the Hire identity. The Hire flow still resolves the selected agent → exact registry identity → registered endpoint → live `/negotiate` → verified provider → verified quote (X.156). No search result substitutes or fabricates a provider.

## Classification

**D — PAGINATION/FILTER/NORMALIZATION DEFECT FIXED.**

The X.163 token-id search was chain-agnostic and treated token ids as globally unique, so `"Agent 2005"` collapsed a chain-56 `#2005` record onto the chain-97 live seller. The fix replaces boolean matching with deterministic, chain-aware relevance scoring (exact name/slug/id rank top; token-id match is explicit/bare-gated and never globally unique; ambiguous token ids return all matches ordered by relevance, live chain boosted, no arbitrary single selection). The marketplace stays fully registry-driven (no agent hardcoded). All suites green; deployed and production-verified; zero blockchain transactions. **STOP.**
