# MAIN TRACK P8 — BSC Category-Aware Discovery

Date: 2026-08-11 · Mode: IMPLEMENTATION (bounded live discovery) · Reader: BNB Chain admin

## 1. Admin requirement

The live marketplace must surface agents covering four categories with equal
depth: **Rebalancing · Grid Trading · Yield Optimisation · Health Factor
Monitoring**. P7 (audit) proved the surfaced page had **0/0/0/0** category
coverage while real chain-56 records existed in the registry. P8 implements
live, bounded, category-aware discovery so the marketplace can actually show
those real BSC agents per category — without fabricating data.

Tagging legend: `LIVE TEST` (queried the live API) · `REPOSITORY FACT`
(verified from repo code) · `INFERENCE` (reasoned from live fields) ·
`UNKNOWN` · `TEST FIXTURE` (deterministic stand-in records in the harness).

## 2. Scope & constraints of this phase

- BSC only (`chainId=56`, `isTestnet=false`); no other chain mixed in. `REPOSITORY FACT`
- No fabrication: no fake registry records, no invented metrics, category is
  NEVER presented as an 8004scan field. `REPOSITORY FACT`
- Bounded retrieval: at most **4 requests per page load** (one per category
  keyword), single page each (`limit ≤ 100`); the 404,853-agent registry is
  never enumerated. `REPOSITORY FACT` (`service.ts`)
- No wallet/hire/activation/transactions/payments; no Altana/TermiX/
  PancakeSwap/x402/ERC-8183 changes; no execution SDKs; no credentials in
  HTML/static/logs; no `NEXT_PUBLIC_8004SCAN_API_KEY`; no client-side 8004scan
  requests. `REPOSITORY FACT`
- Marketplace design preserved: same toolbar, filters, cards, URL state; only
  the data source of the Category facet changed. `REPOSITORY FACT`
- Empty-category copy verbatim: "No verified BSC agents found for this
  category." — never a placeholder row. `REPOSITORY FACT`

## 3. What shipped

New bounded discovery layer under `apps/web/lib/eight004scan/discovery/`:

- `classifier.ts` — deterministic phrase table (the single transparency
  surface): every rule is a documented case-insensitive phrase plus optional
  context guard (bare "grid" needs trading context; "health factor" fires only
  on lending/loan/collateral/debt phrases — medical/site-health never match).
  Description evidence always wins; a name-only match counts ONLY when no
  description exists. An agent may match multiple categories. `TEST FIXTURE`
- `service.ts` — one bounded `GET /agents` per category keyword using the
  officially supported server-side filters (`chainId=56`, `isTestnet=false`,
  `search=<keyword>`), then PURE `assembleBscDiscovery` shaping: identity
  dedup, per-bucket classification, honest per-bucket states, and auditable
  counts (`matched ≤ retrieved ≤ hits`). Key handling mirrors the marketplace
  loader (`8004SCAN_API_KEY` server-only; honest "missing-key" state). `REPOSITORY FACT`
- Marketplace page now loads both surfaces in parallel (`page.tsx`): the
  existing newest-24 list AND the discovery snapshot (≤ 4 extra bounded
  requests). `REPOSITORY FACT`

## 4. Retrieval design (bounded, honest)

- Keyword queries: `rebalanc` / `grid` / `yield` / `health` (the P7-verified
  keywords) with `chainId=56` + `isTestnet=false` (`REPOSITORY FACT` +
  `LIVE TEST`).
- The API's own `meta.pagination.total` is reported as `hits`; the records
  actually fetched are `retrieved` (yield's 127 hits are capped at the 100-row
  page — reported honestly); the classified subset is `matched`. `LIVE TEST`
- A failed keyword query degrades only its own bucket; the rest still render
  (partial availability, verified by fixture). `TEST FIXTURE`
- Every surfaced record carries `DiscoveryMatchEvidence`: `source:
"8004scan metadata"`, `evidence: "description" | "name"`, and the REAL
  excerpt that matched — never a fabricated reason. `REPOSITORY FACT`

## 5. Classification honesty rules

- No category is assigned when no phrase matches → agent is simply absent from
  all buckets (uncategorized by evidence, not by label). `REPOSITORY FACT`
- Ambiguous cases verified by fixture: "Health monitoring dashboards for
  clinics" and "energy grid maintenance" match NOTHING (`TEST FIXTURE`, cases
  8); "yield optimization and portfolio rebalancing" matches BOTH buckets
  (case 9) — agents are never forced into one category.
- Name-only evidence is allowed only when the description is empty (case 10);
  a name never overrides a real, non-matching description. `TEST FIXTURE`
- Deterministic: classifying the same record twice yields byte-identical
  evidence (asserted in both harnesses). `TEST FIXTURE` + `LIVE TEST`

## 6. Live results (one bounded pass, 2026-08-11, live API)

| category                 | hits | retrieved     | matched | state |
| ------------------------ | ---- | ------------- | ------- | ----- |
| Rebalancing              | 38   | 38            | **29**  | ready |
| Grid Trading             | 6    | 6             | **2**   | ready |
| Yield Optimisation       | 127  | 100 (bounded) | **60**  | ready |
| Health Factor Monitoring | 13   | 13            | **2**   | ready |

`LIVE TEST` — real records, real evidence excerpts, e.g.:

- Rebalancing: `56:…:177310` TradePilot.agent ("…DCA, grid, and rebalancing
  strategies"), `56:…:171927` DeFiMatrix.agent ("portfolio rebalancing").
- Grid Trading: TradePilot.agent, `56:…:172801` DeFiBot.agent ("Automate grid
  trading, DCA, and yield compounding…").
- Yield Optimisation: `56:…:190411` LiquidityCore.agent (auto-compounding),
  `56:…:185769` Gelato.agent (yield harvesting), prover.agent, plus the
  yielder/Beefy/Gelato/Syenite/Piefi/0xinsig set from P7.
- Health Factor: `56:…:45381` **Aave powered by HeyAnon** ("validates
  collateral requirements, checks health factors…", MCP/Web, x402=true) and
  `56:…:179543` RiskOracle.agent ("Monitor your DeFi loan health…").

## 7. Category-by-category detail

- **Rebalancing — PASS (live)**: 29 matched on chain 56 (more than P7's ~23
  estimate; the phrase table accepts verified evidence like "liquidity pool
  rebalancing" and DCA/rebalancing strategy text). `LIVE TEST`
- **Grid Trading — PASS (thin)**: 2 matched, exactly the P7 pair (TradePilot,
  DeFiBot); the other 4 of 6 keyword hits are grid-noise (blocked by the
  context guard). `LIVE TEST`
- **Yield Optimisation — PASS (deep)**: 60 matched within the first
  100 keyword rows (hits 127 — full set beyond the bounded page is `UNKNOWN`,
  consistent with the design: we only ever claim what we fetched).
- **Health Factor Monitoring — PARTIAL (thinnest)**: 2 matched; still no
  dedicated health-factor _monitor_ on BNB Chain — Aave-by-HeyAnon is an
  execution layer with health checks. Standard was NOT lowered to inflate the
  count; the medical/site-health noise (11 of 13 hits) was rejected. `LIVE TEST`

## 8. Verification surface

`discovery:verify` (fixture harness, 59 checks, 0 failed) covers the 12
named REQUIRED cases: 1 exact BSC match · 2 non-BSC rejection · 3 rebalancing
· 4 grid · 5 yield · 6 health-factor · 7 unrelated · 8 ambiguous · 9
multiple-category · 10 missing description · 11 duplicate agent (dedup) · 12
evidence preservation — plus assembly, partial-failure and label-mapping
checks, all on labeled `TEST FIXTURE` stand-in records. `TEST FIXTURE`

`discovery:live:verify` (12 checks, 0 failed) — ONE bounded live pass (4
keyword requests, chain 56), asserting: BSC-only records, auditable counts,
real-record identities, evidence excerpts are real substrings of metadata,
and reclassification is byte-identical. Exit 0 even on honest failure states
(offline/error/rate-limited are verified states, not data presence). `LIVE TEST`

## 9. Regression results

- `pnpm typecheck` — clean. `pnpm lint` — clean. `pnpm build` (turbo) — 7/7
  tasks green; `/marketplace` remains dynamic (ƒ) and compiles. `REPOSITORY FACT`
- `marketplace:verify` 83/83 · `marketplace:live:verify` 14/14 ·
  `termix:reputation:web:verify` 11/11 · `pancakeswap:server:verify` and
  `pancakeswap:ui:verify` green (live pancakeswap BLOCKED without its key —
  pre-existing normal state, unrelated to P8). `REPOSITORY FACT`

## 10. Marketplace UI integration

- Category facet now shows live matched counts per category (real numbers
  from the bounded discovery snapshot; failed buckets show no count).
  `REPOSITORY FACT`
- Selecting one or more categories surfaces the union of the real BSC bucket
  records (deduped by registry identity), cards unchanged. Other facets
  (verification, protocols, query, sort) still apply on top. `REPOSITORY FACT`
- Zero-match bucket renders the exact required copy "No verified BSC agents
  found for this category." plus a Clear-filters action — never a fabricated
  row. `REPOSITORY FACT`
- Honest framing everywhere: "Categories are inferred from 8004scan metadata
  (never classified by the registry); each match is backed by its evidence
  excerpt." `REPOSITORY FACT`
- Without `8004SCAN_API_KEY` the page shows the same honest missing-key states
  as before (this dev box has no key; production keyed path is unchanged).
  `REPOSITORY FACT`

## 11. Remaining gaps

- **DIVERSITY STILL INCOMPLETE**: live matched counts are 29 / 2 / 60 / 2 —
  yield-heavy, health-factor and grid thin; equal depth is NOT achieved (same
  imbalance P7 reported; P8 makes it visible and real instead of hidden).
  `LIVE TEST`
- All matched candidates are unverified with 0 feedback (scores 12.0–30.45)
  — no operational track record; `is_verified` remains false for the key
  four. `LIVE TEST`
- No agent is hireable/payments-enabled anywhere in the product (`hireable`
  always false); discovery is read-only curation, not activation. `REPOSITORY FACT`
- Yield's 27 remaining keyword hits beyond the bounded 100-row page are
  `UNKNOWN` (by design we claim only what we fetched).

## 12. Security review

- `8004SCAN_API_KEY` read server-side only; no `NEXT_PUBLIC_` key; discovery
  runs in the server component (`page.tsx`); the client view receives only the
  shaped snapshot. `REPOSITORY FACT`
- No credentials printed by either harness (live harness prints only registry
  records and evidence excerpts). `REPOSITORY FACT` + `LIVE TEST`
- No new env vars introduced; no new outbound hosts (same verified
  `listAgents` surface). `REPOSITORY FACT`

## 13. Data limitations

Same as P7 plus the new ones: classification is an INFERENCE from name +
description (no capability fields exist) → matching proves the metadata
describes the capability, never that the agent functions; keyword `hits`
over-count (only classified `matched` is ever surfaced); bounded single-page
per keyword; description may be template/boilerplate. `LIVE TEST` + `INFERENCE`

## 14. Non-goals respected (execution cut)

No activation, no payments, no wallet actions, no Altana/TermiX/PancakeSwap/
x402/ERC-8183 changes, no execution SDK, no publish/commit/push, no
fabricated data, no redesign of cards/layout. `REPOSITORY FACT`

## 15. Recommended next action

1. Set `8004SCAN_API_KEY` in production (server-only) so the discovery
   snapshot loads; until then the page honestly reports missing-key.
2. To reach EQUAL depth: curate toward grid trading and — above all — health
   factor monitoring (the thinnest; only an execution-layer health check
   exists on BSC). Options: registry curation/tagging with verified evidence,
   or the admin commissioning/completing real BSC agents in those slots.
3. When the admin authorizes activation, re-audit hireable-capable records;
   discovery stays read-only until then.

## 16. Summary verdicts

- Discovery engine: **CATEGORY DISCOVERY READY** — live, bounded, evidence-
  keeping; 59 fixture + 12 live checks green; lint/typecheck/build green.
- Diversity: **DIVERSITY STILL INCOMPLETE** — 29 / 2 / 60 / 2 live matches;
  yield-heavy, health-factor and grid thin; nothing surfaced without the
  production key; nothing verified.
- Status: **BLOCKED** — on production key provisioning (server-only) and on
  real BNB Chain agents for the thin categories before the admin's equal-depth
  requirement can be met.

---

Final: CATEGORY DISCOVERY READY | DIVERSITY STILL INCOMPLETE | BLOCKED
(live matched: Rebalancing 29 · Grid Trading 2 · Yield Optimisation 60 ·
Health Factor Monitoring 2; surfaced page requires the server-only key).
