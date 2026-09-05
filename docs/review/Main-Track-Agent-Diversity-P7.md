# MAIN TRACK P7 — Live Agent Diversity Audit

Date: 2026-08-11 · Mode: AUDIT ONLY (no code changes) · Reader: BNB Chain admin

## 1. Admin requirement

The BNB Chain admin requires agent diversity: the live marketplace should
surface agents covering four categories with **equal depth**:

1. Rebalancing
2. Grid Trading
3. Yield Optimisation
4. Health Factor Monitoring

This audit answers: do the LIVE 8004scan agents currently surfaced by the
marketplace satisfy these categories, and are they balanced?

Tagging legend: `LIVE TEST` (queried the live API) · `REPOSITORY FACT`
(verified from repo code) · `INFERENCE` (reasoned from live fields) · `UNKNOWN`.

## 2. Live agents inspected

- Surfaced set (what the marketplace shows): `GET /agents?page=1&limit=24&isTestnet=false&sortBy=created_at&sortOrder=desc` — the marketplace's own query (`REPOSITORY FACT` from `getMarketplaceAgents`) — 24 newest records, all global (no chain filter), all BNB Chain (56) in the sampled window. `LIVE TEST`
- Window set: newest 100 (`LIVE TEST`)
- Registry keyword/category searches (bounded, read-only) with and without `chainId=56`: `Zyfai` (2,347), `rebalanc` (2,478), `grid` (481), `health` (403), `yield` (3,293) registry-wide; 0 / 38 / 6 / 13 / 127 on chain 56. `LIVE TEST`
- Registry total: **404,853** agents (`isTestnet=false`). `LIVE TEST`
- Raw record schema inspected: NO `category`, `capabilities`, `skills`, or
  service-metadata fields exist on live records — keys are exactly the typed
  `Scan8004Agent` fields. `LIVE TEST` + `REPOSITORY FACT`
- Full descriptions fetched for the key BNB Chain candidates (TradePilot.agent,
  DeFiBot.agent, RiskOracle.agent, Aave powered by HeyAnon). `LIVE TEST`

## 3. Agent-by-agent classification (relevant chain-56 records)

Only records with explicit description-level evidence are classified. Name-only
matches are NEVER classified as matches.

| agent_id (chain 56) | name                                                                                                                                                                                                                                                                                                                                                                                                                                          | source evidence (description)                                                                                                                                                          | protocols           | classification                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| 56:…:177310         | TradePilot.agent                                                                                                                                                                                                                                                                                                                                                                                                                              | "Automated crypto trading bot with DCA, grid, and rebalancing strategies."                                                                                                             | A2A                 | Rebalancing + Grid Trading (desc)                           |
| 56:…:172801         | DeFiBot.agent                                                                                                                                                                                                                                                                                                                                                                                                                                 | "Automate grid trading, DCA, and yield compounding across major DEXs…"                                                                                                                 | A2A                 | Grid Trading + Yield (desc)                                 |
| 56:…:179543         | RiskOracle.agent                                                                                                                                                                                                                                                                                                                                                                                                                              | "Monitor your DeFi loan health, predict liquidation risks, and auto-adjust positions."                                                                                                 | A2A                 | Health Factor Monitoring (partial, loan-health)             |
| 56:…:45381          | Aave powered by HeyAnon                                                                                                                                                                                                                                                                                                                                                                                                                       | "Safe execution layer for Aave lending. Validates collateral requirements, **checks health factors**, verifies token approvals… supply, borrow, repay, withdraw, liquidation, e-mode…" | MCP, Web, x402=true | Health Factor Monitoring (explicit "checks health factors") |
| 56:… (17 records)   | NovaHub_…, OmegaMind_…, FluxAgent_…, DeltaNode_…, FluxLink_…, PhotonHub_…, OmegaPrime_…, OmegaCore_…, HelixCore_…, NexusAgent_…, HelixHub_…, QuantumHub_…, FusionHub_…, BetaHub_…, GammaX_…, LambdaAI_… + 1                                                                                                                                                                                                                                   | "Risk management AI for DeFi protocols and automated rebalancing…" (shared description)                                                                                                | —                   | Rebalancing (desc, template)                                |
| 56:… (4 records)    | babycaisubagent100_…, 66_…, 8_…, 9_…                                                                                                                                                                                                                                                                                                                                                                                                          | "Automated portfolio rebalancing"                                                                                                                                                      | —                   | Rebalancing (desc)                                          |
| 56:…                | DeFiMatrix.agent                                                                                                                                                                                                                                                                                                                                                                                                                              | "Get personalized yield strategies and portfolio rebalancing…"                                                                                                                         | A2A                 | Rebalancing + Yield (desc)                                  |
| 56:… (~30+)         | defi_yield_optimizer.agent, DeFi-Yield-Optimizer.agent, Yield-Farmer / -GOO / -X, roboclaw, BORT Yield Weaver (×9 in sample), BetaSentinel_…, OmegaSentinel_…, NexusSentinel_…, CyberOracle_…, GammaSeeker_…, IonProtocol_…, CyberBot_…, PhotonMind_…, FluxBot_…, OmegaBot_…, DeltaMind_…, AxiomMind_…, KineticHunter_…, CyberScout_…, EpochSeeker_…, FusionGuardian_… etc. + Beefy powered by HeyAnon, Gelato.agent, Syenite, Piefi, 0xinsig | Explicit yield-farm / yield-optimizer / yield-aggregator descriptions                                                                                                                  | mixed               | Yield Optimisation (desc)                                   |

Discarded as noise despite keyword hits (`INFERENCE`, keyword-only):

- TermiX boilerplate ("…on Termix Platform", A2A) — ~50 of newest 100 — no capability fields. `LIVE TEST`
- EvoEvo templates ("focused on sports", "creative challenger") — ~20 of newest 100.
- "Grid-Sun-7777.agent" — name contains "Grid" but description is Termix boilerplate → **not** classified as Grid Trading (name-only). `LIVE TEST`
- "Apex_VestMax / AtlasVestPro / QuarkVestica / Falcon_Pool / CosmoLendTrust / LendIO / MatrixEarnSafe / Aetheric / Vortex Grid / Solar Lattice…" — vesting/lending/pool-sounding names, boilerplate or unrelated descriptions → **not** classified (name-only). `LIVE TEST`
- "CMC.agent", "HodlAI Protocol", "Mehmedserj.agent | Hue", "DavidBeckham.agent", Ensoul accounts — keyword noise. `LIVE TEST`

## 4. Rebalancing

- Registry-level (chain 56): **represented — PASS** (`LIVE TEST`, desc evidence).
  At least 1 explicit (TradePilot.agent: "grid, and rebalancing strategies"),
  DeFiMatrix.agent ("portfolio rebalancing"), 17 shared-description
  "automated rebalancing" agents, 4 "Automated portfolio rebalancing".
  Exactly live matches with desc evidence: ~23.
- Surfaced (marketplace page 1, newest‑24): **FAIL — 0 agents** (`LIVE TEST`).
- Note: the flagship "Zyfai Rebalancer Agent" (2,347 records) exists on chains
  1 / 42161 / 8453 — **0 records on chain 56** (`LIVE TEST`, chainId=56 filter).
- Confidence: description-level only (no capability field exists); `INFERENCE`.
- Source field: `description` (+ `supported_protocols` for protocols).

## 5. Grid Trading

- Registry-level (chain 56): **represented — PASS (thin)** (`LIVE TEST`).
  2 explicit: TradePilot.agent ("grid, and rebalancing strategies"),
  DeFiBot.agent ("Automate grid trading, DCA…"). chainId=56 search total: 6
  (4 are keyword noise). Confidence: `INFERENCE` (desc only; none verified,
  scores 12.0/12.0, zero feedback).
- Surfaced: **FAIL — 0 agents** (`LIVE TEST`).
- Note: real SGT spot/perp grid bots (officially described) live on chain 176
  (Injective) — not BNB Chain. `LIVE TEST`

## 6. Yield Optimisation

- Registry-level (chain 56): **represented — PASS (deep)** (`LIVE TEST`).
  Explicit yield descriptions: defi_yield_optimizer.agent, DeFi-Yield-
  Optimizer.agent, Yield-Farmer/-GOO/-X ("rotates capital across BSC"),
  roboclaw ("yield farming, auto-comp"), ~30 "Multi-protocol yield
  aggregator" + "yield optimization" shared-description agents, BORT Yield
  Weaver class agents, Beefy powered by HeyAnon (x402=true), Gelato.agent,
  Syenite, Piefi (x402=true), 0xinsig (x402=true). chainId=56 keyword total: 127. Best-represented of the four. Confidence: `INFERENCE` (desc level).
- Surfaced: **FAIL — 0 agents** (`LIVE TEST`).

## 7. Health Factor Monitoring

- Registry-level (chain 56): **PARTIAL** (`LIVE TEST`).
  - Strongest: **Aave powered by HeyAnon** (56:…:45381) — description
    explicitly says "**checks health factors**" and covers Aave collateral,
    liquidation, e-mode; MCP+Web; x402=true; registry score 30.45 (highest of
    the four candidates). Reputation: unverified, 0 feedback. `LIVE TEST`
  - Partial: RiskOracle.agent (56:…:179543) — loan-health monitoring +
    liquidation-risk prediction, no safe-execution guarantee, A2A.
  - Explicit "Health Factor Calculator" / "Health Factor Tester" agents exist
    on chain 196 (X Layer, x402=true) — **NOT on BNB Chain**. `LIVE TEST`
  - No agent on chain 56 describes itself as a dedicated health-factor
    _monitor_; Aave-by-HeyAnon is an execution layer with health checks.
- Surfaced: **FAIL — 0 agents** (`LIVE TEST`).

## 8. Equal-depth assessment (all four categories, equal depth)

- Surfaced marketplace (the page a visitor sees): **zero agents in all four
  categories** — the newest-24 page is all empty/boilerplate records
  (Agent #264264 with no description, ~20 "…on Termix Platform" A2A records,
  2 EvoEvo sports prompts, 2 Ave.ai Trading Agents). `LIVE TEST`
- Registry-level chain-56 (desc evidence): Rebalancing ~23 · Grid Trading 2 ·
  Yield ~45+ · Health Factor 1 strong + 1 partial.

Verdict: **IMBALANCED** — and, at the surfaced level, all four are absent.
The four-way balance the admin requires does not exist today. `LIVE TEST` +
`INFERENCE`. No numerical "equal" definition was provided by the admin, so no
threshold is invented; the imbalance is evident from counts alone.

## 9. Marketplace UI assessment (read-only, no changes)

- Category filter facet exists with labels **"Rebalancing / Grid Trading /
  Yield Optimization / Health Factor"** (`marketplace-view.tsx:117`). Note
  label spelling: UI uses "Yield Optimization" (American) vs admin's "Yield
  Optimisation". `REPOSITORY FACT`
- Despite the labels, ANY category facet selection yields **deterministic zero
  matches** — normalized category is always `null` (8004scan does not classify;
  `normalize.ts`, `matchesFilters`). Verified by the P6 harness (83/83) and
  code. `REPOSITORY FACT`
- Cards: category line renders only when `agent.category` is present
  (`agent-card-compact.tsx:26`); live cards never have it → no category shown
  on any live card. `REPOSITORY FACT`
- Agent details: live records show an honest **"Uncategorized"** chip (8004scan
  does not classify); slug-only pages show "Pending Category". `REPOSITORY FACT`
- No chain filter exists in the marketplace — the surfaced set is the GLOBAL
  newest page, not BNB-Chain-scoped by design. `REPOSITORY FACT`
- Distinction honored: UI category labels ≠ live agent categories. Labels alone
  are not proof of live coverage — and in fact the labels currently match
  nothing. `REPOSITORY FACT`

## 10. Missing categories

All four at the **surfaced** level (page 1 = 24 newest): all four categories
are missing from what users actually see. At the registry level on BNB Chain:
Health Factor Monitoring is the weakest (1 explicit health-factor service,
Aave-by-HeyAnon, plus 1 partial loan-health monitor; zero dedicated HF
monitors on chain 56). `LIVE TEST` + `INFERENCE`

Depth data per category (chain-56 registry / surfaced page):

| metric                                        | Rebalancing                                                                 | Grid Trading | Yield Opt.                               | Health Factor       |
| --------------------------------------------- | --------------------------------------------------------------------------- | ------------ | ---------------------------------------- | ------------------- |
| live agents (desc evidence)                   | ~23 / 0                                                                     | 2 / 0        | ~45+ / 0                                 | 2 / 0               |
| with real descriptions                        | ~23 / n/a                                                                   | 2 / n/a      | ~45+ / n/a                               | 2 / n/a             |
| with capabilities                             | 0 (field absent)                                                            | 0            | 0                                        | 0                   |
| with registry identity                        | all                                                                         | all          | all                                      | all                 |
| with useful data (name+desc)                  | ~23                                                                         | 2            | ~45+                                     | 2                   |
| activation-capable (marketplace)              | 0 — activation not implemented; `hireable` always false (`REPOSITORY FACT`) | 0            | 0                                        | 0                   |
| x402_supported (declared, informational only) | 0                                                                           | 0            | several (Beefy, Piefi, 0xinsig, Syenite) | 1 (Aave by HeyAnon) |

## 11. Data limitations

- 8004scan records carry **no capability/category/skills/service metadata**;
  classification is limited to `name` + `description` + `supported_protocols`. `LIVE TEST`
- Search keyword counts are substring/fuzzy matches over name/description —
  they OVER-count; only description-level evidence was accepted for matches. `INFERENCE`
- Description evidence does not prove the agent functions as described or is
  deployable; `is_verified` is false for all four key candidates (TradePilot,
  DeFiBot, RiskOracle, Aave-by-HeyAnon) and feedback is 0 — no operational
  track record. `LIVE TEST`
- No activation exists anywhere in the marketplace (`hireable` always false) —
  no agent is hireable or payments-enabled through this product today. `REPOSITORY FACT`
- Registry-wide full enumeration (404,853) was not performed; counts are from
  bounded top-100 keyword windows + chain-filtered totals. `UNKNOWN` for
  anything beyond the sampled windows.

## 12. Recommended next action

1. Do NOT treat the current marketplace page as satisfying the admin's four
   categories — it surfaces zero of them today.
2. Next phase (implementation, out of scope here): make the marketplace query
   BNB-Chain-scoped AND category-relevant — e.g. surface the registry's real
   chain-56 category-eligible agents (TradePilot, DeFiBot, DeFiMatrix,
   RiskOracle, Aave powered by HeyAnon, the yield/rebalancing sets) rather
   than the raw newest-first page; and select/curate with equal depth across
   all four categories (targeting yield-heavy coverage away from, and
   health-factor coverage toward, balance).
3. Health Factor Monitoring is the single biggest gap: on BNB Chain it has one
   explicit health-factor service (Aave by HeyAnon) and one partial
   (RiskOracle), and nothing on the surfaced page.
4. If the admin requires guaranteed category coverage, a curation/registry
   layer (category tagging with verified evidence, not name-guessing) is
   required before the marketplace can present the four categories as live.

---

## Summary verdicts

- Rebalancing: registry PASS (thin) · surfaced FAIL
- Grid Trading: registry PASS (thin) · surfaced FAIL
- Yield Optimisation: registry PASS (deep) · surfaced FAIL
- Health Factor Monitoring: registry PARTIAL · surfaced FAIL
- Equal depth: **IMBALANCED** (yield ≫ rebalancing > grid ≈ health; surfaced: 0/0/0/0)
