# MAIN TRACK P9 — Real Agent Quality + Activation Feasibility

Date: 2026-08-11 · Mode: AUDIT ONLY (no implementation) · Reader: BNB Chain admin

## 1. Objective

P8 live discovery works but diversity is incomplete (29 / 2 / 60 / 2). Before
any wallet/activation work, P9 inspects the ACTUAL live BSC candidates in the
two weakest categories — **Grid Trading** and **Health Factor Monitoring** —
and determines which are genuinely usable for an end-to-end marketplace
journey: Marketplace → Agent Details → Understand capability → Activate →
Agent performs task → User receives result.

Tagging legend: `LIVE DATA` (queried the live API) · `REPOSITORY FACT`
(verified from repo code) · `INFERENCE` (reasoned from live fields) ·
`UNKNOWN`. Audit used ONLY the approved read-only surface (`listAgents`,
keyless-safe); no transactions, no paid services, no arbitrary endpoints, no
credentials printed, no env changed, no code imported by production.

## 2. P8 results (live)

| category                 | hits | retrieved     | matched |
| ------------------------ | ---- | ------------- | ------- |
| Rebalancing              | 38   | 38            | 29      |
| Grid Trading             | 6    | 6             | 2       |
| Yield Optimisation       | 127  | 100 (bounded) | 60      |
| Health Factor Monitoring | 13   | 13            | 2       |

`LIVE DATA` — re-run for P9 at audit time; identical to P8.

## 3. Grid Trading candidates (live, chain 56)

Locating by live registry identity inside the P8 discovery buckets (nothing
hardcoded in production code):

1. **TradePilot.agent** — `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:177310`
2. **DeFiBot.agent** — `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:172801`

The grid keyword window returned 6 hits; the other 4 were rejected by the
classifier's context guard (no trading context). `LIVE DATA`

## 4. Health Factor candidates (live, chain 56)

1. **Aave powered by HeyAnon** — `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381`
2. **RiskOracle.agent** — `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:179543`

The health keyword window returned 13 hits; the other 11 were medical/
site-health noise, rejected by design (the bar was NOT lowered). `LIVE DATA`

## 5. Identity verification (exact agent_id round-trip)

All four candidates were re-fetched via `search=<agent_id>&chainId=56` and
matched by EXACT key equality (the verified `pickAgentBySlug` path). `LIVE DATA`

| field                    | TradePilot.agent                           | DeFiBot.agent                              | Aave by HeyAnon                            | RiskOracle.agent                           |
| ------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| agent_id                 | 56:0x8004a1…:177310                        | 56:0x8004a1…:172801                        | 56:0x8004a1…:45381                         | 56:0x8004a1…:179543                        |
| chain_id / type          | 56 · evm · mainnet                         | 56 · evm · mainnet                         | 56 · evm · mainnet                         | 56 · evm · mainnet                         |
| token_id                 | 177310                                     | 172801                                     | 45381                                      | 179543                                     |
| contract_address         | 0x8004a169fb4a3325136eb29fa0ceb6d2e539a432 | same registry contract                     | same                                       | same                                       |
| owner_address            | 0x73e997044b0f4c50c9025a7d51caaf3d7fb686ef | 0x7c0e462721195a7cfeea4cb7d65ee6ffa142fde2 | 0xda977767452c5dd021624511f14df67b6c9c2c1b | 0xb0f7c483de74838b68939a246a5f4d05dcdb37b1 |
| certified name           | none returned                              | none                                       | none                                       | none                                       |
| is_verified              | false                                      | false                                      | false                                      | false                                      |
| supported_protocols      | A2A                                        | A2A                                        | **MCP, Web**                               | A2A                                        |
| x402_supported           | false                                      | false                                      | **true**                                   | false                                      |
| total_score              | 12.03                                      | 12.02                                      | **30.45**                                  | 12.02                                      |
| health_score             | null                                       | null                                       | **100**                                    | null                                       |
| average_score / feedback | 0 / 0                                      | 0 / 0                                      | 0 / 0                                      | 0 / 0                                      |
| created_at               | 2026-07-05                                 | 2026-07-04                                 | 2026-03-18                                 | 2026-07-05                                 |

No `capabilities`, `skills`, `service-metadata`, endpoint or agent-card
fields exist on any record — the registry schema has none (`Scan8004Agent`
type is exact). `LIVE DATA` + `REPOSITORY FACT`

## 6. Category evidence

- **TradePilot.agent** — description: _"Automated crypto trading bot with DCA,
  grid, and rebalancing strategies."_ — Grid evidence: the "DCA, grid"
  compound phrase. **CATEGORY EVIDENCE: STRONG** (describes the strategy
  explicitly; also matches Rebalancing). `LIVE DATA`
- **DeFiBot.agent** — description: _"Automate grid trading, DCA, and yield
  compounding across major DEXs while you sleep."_ — Grid evidence: explicit
  "grid trading". **CATEGORY EVIDENCE: STRONG** (also matches Yield).
  `LIVE DATA`
- **Aave powered by HeyAnon** — description: _"Safe execution layer for Aave
  lending. Validates collateral requirements, checks health factors, verifies
  token approvals before returning pre-validated calldata… Covers supply,
  borrow, repay, withdraw, liquidation, e-mode, collateral toggling, rate
  swapping…"_ — Health evidence: explicit "checks health factors".
  **CATEGORY EVIDENCE: STRONG** — but it is an execution layer WITH health
  checks, not a dedicated health-factor monitor (P7 nuance stands).
  `LIVE DATA` + `INFERENCE`
- **RiskOracle.agent** — description: _"Monitor your DeFi loan health, predict
  liquidation risks, and auto-adjust positions."_ — Health evidence: explicit
  "loan health" monitoring. **CATEGORY EVIDENCE: STRONG** (metadata-level).
  `LIVE DATA`

None of the four is promoted beyond metadata: matching is an INFERENCE from
the registry description — it proves the metadata describes the capability,
never that the agent functions. `INFERENCE`

## 7. Service availability

The registry exposes no endpoint/capability/service-metadata beyond
`supported_protocols` + `x402_supported` (declarations, not addresses); the
project has no approved read-only mechanism to probe an agent's service; no
arbitrary endpoint calls were permitted or made. `LIVE DATA` + `REPOSITORY FACT`

| candidate        | service state | basis                                                          |
| ---------------- | ------------- | -------------------------------------------------------------- |
| TradePilot.agent | **UNKNOWN**   | A2A declared; no endpoint/card; unverified, 0 feedback         |
| DeFiBot.agent    | **UNKNOWN**   | A2A declared; no endpoint/card; unverified, 0 feedback         |
| Aave by HeyAnon  | **UNKNOWN**   | MCP/Web+x402 declared; no endpoint URL; unverified, 0 feedback |
| RiskOracle.agent | **UNKNOWN**   | A2A declared; no endpoint/card; unverified, 0 feedback         |

No candidate is LIVE or AVAILABLE by any verifiable standard; none is
UNAVAILABLE either (no negative evidence) — honest state is UNKNOWN for all
four. `LIVE DATA` + `INFERENCE`

## 8. Activation feasibility

Mechanisms considered (declared, not implemented): A2A · MCP · HTTP/API ·
x402 · Altana ERC-8183 · wallet transaction.

- **TradePilot.agent / DeFiBot.agent / RiskOracle.agent** —
  **ACTIVATION PATH UNKNOWN**: only `supported_protocols: [A2A]` is declared.
  There is no agent card / endpoint / discovery metadata in the registry, no
  A2A client anywhere in the product (`REPOSITORY FACT` — A2A appears only as
  registry data), and the description carries no call contract. The A2A
  mechanism is identifiable in theory, but nothing proves a reachable,
  agreeing service exists. `LIVE DATA` + `REPOSITORY FACT`
- **Aave powered by HeyAnon** — **ACTIVATION PATH KNOWN (outline)**:
  MCP + Web surfaces, `x402_supported: true`, and its own description
  documents the deliverable: the agent returns pre-validated, ready-to-sign
  calldata that the user's wallet signs and broadcasts (supply/borrow/repay/
  withdraw/liquidation/e-mode…). Mechanism chain: call agent (MCP/Web) →
  calldata → wallet transaction → on-chain result. Execution details
  (endpoint URL, MCP schema) are **UNKNOWN**, and NOTHING in the product can
  execute any of this today (no wallet, no MCP client, no x402 payment
  path). `LIVE DATA` + `REPOSITORY FACT`
- Altana ERC-8183: no candidate shows any ERC-8183/Altana surface; not
  evidenced. `UNKNOWN`

Product-side facts for ALL candidates: `hireable` always false; login page is
"Wallet connect coming soon"; no ethers/viem/wagmi, no send/sign surface, no
x402 module, no A2A/MCP client in `apps/web`. `REPOSITORY FACT`

## 9. Main-track journey

**Strongest Grid candidate — DeFiBot.agent** (grid-first description;
TradePilot.agent equivalent):

| step                  | verdict     | evidence                                                                                                                                                                     |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace           | PASS        | surfaced in the Grid Trading bucket (P8 discovery) when the server key is configured; keyless local pass verified. `LIVE DATA`                                               |
| Agent Details         | PASS        | `/agents/56%3A0x…%3A172801` identity route; exact-agent_id lookup path is P6-verified (live without key returns no rows on this box; keyed in production). `REPOSITORY FACT` |
| Understand capability | **PARTIAL** | short single-line description + protocols + trust strip (unverified, 0 feedback); no capability/service metadata exists, so understanding is shallow. `LIVE DATA`            |
| Activate              | **FAIL**    | no activation implementation, no wallet, no A2A client, `hireable` false. `REPOSITORY FACT`                                                                                  |
| Agent performs task   | **UNKNOWN** | no mechanism exists to invoke; service never verified.                                                                                                                       |
| User receives result  | **FAIL**    | no result/delivery surface exists in the product. `REPOSITORY FACT`                                                                                                          |

**Strongest Health candidate — Aave powered by HeyAnon**:

| step                  | verdict     | evidence                                                                                                                                                                      |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace           | PASS        | Health Factor bucket (P8). `LIVE DATA`                                                                                                                                        |
| Agent Details         | PASS        | exact-agent_id route. `REPOSITORY FACT`                                                                                                                                       |
| Understand capability | **PASS**    | rich description (supply/borrow/repay/withdraw/liquidation/e-mode, safety checks), MCP/Web, x402=true, health_score 100 — the most complete metadata of the four. `LIVE DATA` |
| Activate              | **FAIL**    | activation path IS outlined (MCP/Web → calldata → wallet tx) but nothing implements it: no wallet, no MCP client, no x402 payment. `REPOSITORY FACT`                          |
| Agent performs task   | **UNKNOWN** | no endpoint, no operational proof (unverified, 0 feedback).                                                                                                                   |
| User receives result  | **FAIL**    | no delivery surface. `REPOSITORY FACT`                                                                                                                                        |

No journey step beyond "Understand capability" is achievable today for any
candidate. `REPOSITORY FACT`

## 10. Diversity quality (not count alone)

| metric                 | Grid Trading                                                                    | Health Factor Monitoring                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| live count (matched)   | 2                                                                               | 2                                                                                                                          |
| strong candidates      | 2 (TradePilot, DeFiBot)                                                         | 2 (Aave by HeyAnon strong; RiskOracle strong-thin)                                                                         |
| weak candidates        | 0 in bucket (4 keyword hits rejected by context guard)                          | 0 in bucket (11 medical/site-health hits rejected)                                                                         |
| usable service count   | 0 — UNKNOWN for both                                                            | 0 — UNKNOWN for both                                                                                                       |
| activation feasibility | UNKNOWN (A2A-only declarations)                                                 | Aave: outline KNOWN, execution UNKNOWN; RiskOracle: UNKNOWN                                                                |
| evidence quality       | STRONG metadata-level; category depth thin (2 records total in registry window) | STRONG metadata-level; but no dedicated health-factor monitor exists on BSC — the function lives inside an execution layer |

`LIVE DATA` + `INFERENCE`. Count equality (2 vs 2) does NOT imply usable
parity: every candidate is unverified with zero feedback, and service
liveness is unprovable for all. E.g. P7-covered record `56:…:45381` is the
highest score (30.45) but is an execution layer, not a monitor. `INFERENCE`

## 11. Production blocker

`8004SCAN_API_KEY`:

- **LOCAL LIVE TEST: working** — the anonymous tier serves the P8/P9
  verification passes (discovery live verify 12/12; P9 audit round-trips
  4/4 exact). `LIVE DATA`
- **PRODUCTION: requires the server-only key** — `getBscCategoryDiscovery`
  and `getMarketplaceAgents` return the honest "missing-key" state without it;
  the keyed path (e.g. detail-route lookups) is designed to run in production
  only. `REPOSITORY FACT`
- The key was not inspected, printed, added to source, or modified in any
  environment. `REPOSITORY FACT`

## 12. Recommended next phase

**Recommendation: B — curate only high-confidence candidates** (single
choice). Evidence: the registry simply is thin in these categories (6 grid
hits / 13 health hits chain-56; classifier already rejects 4 of 6 / 11 of 13
as noise), so C (expand discovery) and D (improve matching) cannot add genuine
agents that do not exist; E (new data source) has no evidence here; artificial
balancing is forbidden. Therefore surface the 2 high-confidence grid agents
and the 2 health agents — with inference labeling and evidence excerpts (as
P8 does) — and treat the need for NEW REAL BSC agents in these two categories
(Grid: +, Health Factor: dedicated monitor) as an ecosystem/curation task
before any wallet work.

Then, for activation (a separate phase, not implemented here):

1. Resolve endpoint/service discovery (registry offers none today) — first
   confirm each strong candidate's reachable service (A2A card / MCP URL).
2. Build wallet connect + signing (login is a stub) — required for Aave by
   HeyAnon's ready-to-sign calldata flow and for any x402 payment.
3. Implement activation for the curated pair only: DeFiBot.agent (grid) and
   Aave powered by HeyAnon (health) — A2A client + MCP/x402 path.
4. Re-audit liveness and results delivery before promising the full journey.

---

## FINAL STATUS

**MAIN TRACK P9 STATUS: ACTIVATION FEASIBILITY UNCLEAR**

- Strongest Grid Trading candidate: **DeFiBot.agent**
  (`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:172801` — "Automate grid
  trading, DCA, and yield compounding…"; TradePilot.agent equivalent).
- Strongest Health Factor candidate: **Aave powered by HeyAnon**
  (`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381` — explicit
  "checks health factors", MCP/Web + x402, health_score 100).
- Activation mechanism, if known: **Aave by HeyAnon only — outline known**
  (MCP/Web call → pre-validated calldata → user wallet signs + broadcasts;
  x402 payment declared). The three A2A-only agents: path UNKNOWN (no
  endpoint/card evidence).
- Biggest blocker: **the product has zero activation surface** — no wallet
  (stub login), no A2A/MCP client, no x402 path, `hireable` always false —
  AND service liveness is UNKNOWN for every candidate (no endpoints, all
  unverified authors, 0 feedback).
- Recommended next phase: curate the 4 high-confidence candidates (choice B),
  then a wallet+activation phase for the strongest pair (DeFiBot.agent grid,
  Aave by HeyAnon health) starting with endpoint/service discovery.
