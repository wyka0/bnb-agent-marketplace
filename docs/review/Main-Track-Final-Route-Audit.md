# MAIN TRACK FINAL ROUTE AUDIT

**Date:** 2026-08-13
**Scope:** Read-only main-track and partner-track audit
**Repository:** `C:\bnb-agent-marketplace`
**Integrity boundary:** No signing, broadcast, settlement, payment, registration, job creation, approval, transfer, deployment, commit, or push.

```text
DISCOVERY:          READY for bounded 8004scan metadata discovery; authenticated enrichment unavailable
CATEGORY DEPTH:     PARTIAL; real metadata counts 30 / 2 / 60 / 2, but operational depth is not established
ACTIVATABLE AGENT:  NONE FOUND
ACTIVATION:         PIPELINE READY; no real compatible capability source
PATH C:             REQUIRED
ALTANA:             OFFLINE/READ-ONLY READY; live partner transaction not demonstrated
TERMIX:             READ-ONLY REPUTATION READY; Agent Advantage execution report not produced
PANCAKESWAP:        READ-ONLY adapter present; live NodeReal source returns HTTP 500
PUBLIC DEPLOYMENT:  NOT VERIFIED; current evidence remains local-only
```

## 1. Executive Summary

The strongest existing BSC agents do not satisfy the complete
`find -> understand -> activate` journey:

- 8004scan provides real BSC mainnet identities and category-description
  evidence, but no guaranteed price, quote, action, destination, calldata, or
  hire interface.
- The four known chain-97 candidates expose only a shared health endpoint with
  `live:false` and `operatorAddress:null`.
- Aave powered by HeyAnon has a live, read-only MCP discovery surface and BSC
  support, but its identity is chain 56 and its action tools are state-changing
  without a dry-run/preview/build-only guarantee.
- Existing Altana ERC-8183/x402 and X.4B/X.4C infrastructure is prepared for a
  real capability, but no existing candidate supplies one.

The correct route is therefore **PATH C: a legitimate operator-owned provider
identity/service**, not because it is easier, but because every existing
candidate failed the chain, action, pricing, or safety gates. This audit does
not authorize implementation, registration, deployment, signing, or payment.

## 2. Current Main Track Status

| Requirement                         | Status                  | Evidence                                                                                             |
| ----------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Land                                | Partial                 | UI framework exists; public deployment not verified                                                  |
| Discover                            | Ready, bounded          | Live 8004scan discovery and category classifiers work                                                |
| Find by category                    | Partial                 | Real metadata-derived category buckets work; marketplace catalog wiring is incomplete                |
| Understand agent                    | Partial                 | Descriptions, protocol labels, ownership/reputation fields exist; operational capability is shallow  |
| Activate/hire                       | Blocked for real agents | X.6 review pipeline is implemented, but `resolveAgentActivationCapability` has no real source        |
| Four-category diversity             | Partial/uneven          | Rebalancing 30, Grid 2, Yield 60 bounded, Health 2; counts do not establish equal operational depth  |
| Live BSC agents in this marketplace | Blocked                 | External records exist, but no compatible activatable agent is surfaced through the complete journey |
| Public accessibility                | Not verified            | Existing readiness audit records local-only status and no verified public URL                        |

Existing verification results from this audit:

- `discovery:verify`: 59 passed.
- `discovery:live:verify`: 12 passed; current bounded chain-56 results are
  30/2/60/2.
- `marketplace:live:verify`: 14 passed; anonymous tier, no API key.
- `activation:verify`: 33 passed.
- `activation:live:verify`: safe Aave MCP read-only flow passed; no payment,
  signing, or transaction.
- `activation:hire:verify`: 23/23 passed; fixtures only, no signing/broadcast.
- `pnpm typecheck`: 12/12 successful.
- `pnpm lint`: 12/12 successful.

## 3. Authenticated 8004scan Findings

### Authentication status

The official OpenAPI document was read from:
`https://8004scan.io/api/v1/public/docs/openapi.json`.

It documents optional `X-API-Key` authentication and the following read-only
surfaces:

- `GET /agents` with page, limit, chain ID, owner, search, protocol, sort, and
  testnet filters;
- `GET /agents/{chainId}/{tokenId}`;
- `GET /agents/search` semantic/keyword search;
- `GET /accounts/{address}/agents`;
- `GET /feedbacks` with chain/token/score filters;
- `GET /stats`;
- `GET /chains`.

The repository environment audit found `8004SCAN_API_KEY` absent. Therefore an
authenticated enrichment pass was **not available** in this audit. No API key,
header, bearer token, or secret was printed.

```text
AUTHENTICATED 8004SCAN: NOT AVAILABLE — 8004SCAN_API_KEY missing
ANONYMOUS 8004SCAN: LIVE READ-ONLY DATA AVAILABLE
```

### Schema findings

The documented agent schema includes identity, token, chain, name, description,
owner, supported protocols, score, stars, feedback count, and timestamps. It
does not document mandatory fields for:

- service price;
- ERC-8183 budget;
- payTo/recipient;
- destination contract;
- calldata;
- quote endpoint;
- hire endpoint;
- action simulation;
- job/payment state.

The repository’s `Scan8004Agent` type is consistent with this limitation. It
contains `agent_id`, `token_id`, chain, registry, owner, metadata, protocols,
x402 flag, scores, feedback count, and timestamps, but no actionable payment or
transaction fields.

### Search variants and current result

The existing bounded discovery implementation issued category keyword searches
against BSC mainnet chain `56`, including phrase families equivalent to:

- portfolio/automated/LP rebalancing;
- grid/DCA/grid orders;
- yield optimization/farming/APR/liquidity;
- health factor/health monitoring/liquidation/lending risk.

Current live bounded results:

| Category                 | Hits | Retrieved | Matched |
| ------------------------ | ---: | --------: | ------: |
| Rebalancing              |   39 |        39 |      30 |
| Grid Trading             |    6 |         6 |       2 |
| Yield Optimisation       |  127 |       100 |      60 |
| Health Factor Monitoring |   13 |        13 |       2 |

Yield is capped at the first 100 records. These are metadata-derived matches,
not proof of live service execution.

## 4. Best BSC Agents

| Agent                    | Chain | Exact agent ID                                         | Owner/wallet                                                 | Service/interface                                         | Price                  | Action interface                 | Active/feedback                               | Feasibility                                        |
| ------------------------ | ----: | ------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------- | ---------------------- | -------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| TradePilot.agent         |    56 | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:177310` | Registry owner field available; provider action not verified | Description says DCA/grid/rebalancing; A2A declared       | MISSING — NOT VERIFIED | MISSING — NOT VERIFIED           | Unverified; 0 feedback in prior exact audit   | Unsupported chain / discovery-only                 |
| DeFiBot.agent            |    56 | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:172801` | Owner field available; wallet/action not verified            | Grid/DCA/yield description; A2A declared                  | MISSING — NOT VERIFIED | MISSING — NOT VERIFIED           | Unverified; 0 feedback                        | Unsupported chain / discovery-only                 |
| DeFiMatrix.agent         |    56 | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:171927` | Owner field available; wallet/action not verified            | Rebalancing/yield description                             | MISSING — NOT VERIFIED | MISSING — NOT VERIFIED           | Unverified; 0 feedback                        | Unsupported chain / discovery-only                 |
| Beefy powered by HeyAnon |    56 | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45422`  | Owner field available; wallet/action not verified            | MCP/Web and x402 declaration; yield description           | MISSING — NOT VERIFIED | MISSING — NOT VERIFIED           | Prior health score 100; unverified/0 feedback | Unsupported chain; safe activation not established |
| Aave powered by HeyAnon  |    56 | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381`  | Owner field available; wallet/action not verified            | Live MCP manifest; BSC support; health-factor description | MISSING — NOT VERIFIED | Action tools are execution-class | Prior health score 100; unverified/0 feedback | Safe read-only preview only; not activatable       |
| RiskOracle.agent         |    56 | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:179543` | Owner field available; wallet/action not verified            | Loan-health/liquidation description; A2A declared         | MISSING — NOT VERIFIED | MISSING — NOT VERIFIED           | Unverified; 0 feedback                        | Unsupported chain / discovery-only                 |

Classification rules remain strict:

- chain 56 -> `NOT_ACTIVATABLE / unsupported-chain`;
- chain 97 without complete capability -> `CAPABILITY_UNKNOWN`;
- only a complete real capability can become `ACTIVATABLE`.

No candidate meets the `ACTIVATABLE` classification.

## 5. Four-Category Coverage

| Category                 |                    Live BSC candidates | High-confidence candidates | Activatable candidates | Data quality                                   | Activation quality | Gap                                                                   |
| ------------------------ | -------------------------------------: | -------------------------- | ---------------------: | ---------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| Rebalancing              |                    30 metadata matches | TradePilot, DeFiMatrix     |                      0 | Real descriptions; no verified service terms   | 0                  | No live quote/action/provider interface                               |
| Grid Trading             |                     2 metadata matches | DeFiBot, TradePilot        |                      0 | Real descriptions; thin category count         | 0                  | Only two matches and no activation source                             |
| Yield Optimisation       | 60 within bounded 100-record retrieval | Beefy, DeFiMatrix, Gelato  |                      0 | Highest count; bounded and description-derived | 0                  | Many generic/overlapping descriptions; no price/action proof          |
| Health Factor Monitoring |                     2 metadata matches | Aave, RiskOracle           |                      0 | Real descriptions; thin category count         | 0                  | Aave is mainnet and execution-class; RiskOracle endpoint not verified |

The correct conclusion is not to pad Grid or Health with fake agents. Category
depth is structurally uneven, especially in Grid and Health. The next catalog
milestone should expose real evidence excerpts and explicit unavailable states,
not equalize counts artificially.

## 6. Existing-Agent Activation Feasibility

### Aave by HeyAnon

Safe read-only evidence is strong:

- MCP manifest, initialize, tools/list, and safe supported-chain probe work;
- BSC mainnet support is confirmed;
- no payment was required for the safe probe.

Activation remains blocked:

- identity is chain 56, while the project’s activation path is chain 97;
- financial action tools are state-changing by semantics;
- no explicit `dryRun`, `preview`, `simulate`, or `buildOnly` guarantee;
- no candidate-specific price, payTo, destination, calldata, or x402 terms;
- no ERC-8183 hire interface.

Classification: `SAFE READ-ONLY PREVIEW`, not `ACTIVATABLE`.

### Chain-97 registrations

LiqShield, YieldRoute, GridPilot, and RangeGuard share:

`https://mandate-bnb-agent.vercel.app/api/health`

The endpoint reports `network: bsc-testnet`, `live: false`, and
`operatorAddress: null`, with no quote, price, provider, job, payment, or
calldata fields.

Classification: `NOT_ACTIVATABLE`.

### Other existing agents

Jarvis/Singularry is read-only discovery/portfolio monitoring. EZCTO provides
website tools, not BSC activation. Q402 advertises mutating tools but is chain
56 and has no safe candidate-specific quote/action. BNB Mission Control and
Gridora do not currently expose a verified live activation path.

No existing BSC agent can be integrated into the current X.4B/X.4C hire flow
without unsupported assumptions or an execution-class call.

## 7. BNB Agent Studio Agent Findings

Official Altana/BNB documentation establishes infrastructure and seller
patterns, not a specific currently activatable marketplace agent.

What is verified:

- BNB testnet chain 97 has the ERC-8183 stack and `$U` infrastructure;
- Agent Studio/Altana supports ERC-8183 buyer-side hiring and x402 seller-side
  HTTP services;
- an ERC-8183 provider is an address and can be an EOA;
- x402 seller pricing is operator-configured in `MerchantConfig`;
- no specific chain-97 Studio seller with live quote/action metadata was found.

The repository’s Studio adapter is interface-only and explicitly
`STUDIO_ADAPTER_NOT_IMPLEMENTED`. No Studio publish/list/get implementation
exists. No deployment, registration, or Studio seller transaction was performed.

Conclusion: Studio resources validate the architecture but do not supply an
existing activation target for this submission.

## 8. Path C Necessity Decision

```text
PATH A: existing BSC agent integrates directly       NO
PATH B: existing chain-97 seller integrates          NO
PATH C: legitimate operator-owned provider/service    REQUIRED
PATH D: no possible route                            NOT SELECTED
```

**PATH C = REQUIRED**, justified by evidence:

1. Existing category leaders are chain 56 and therefore incompatible with the
   current chain-97 activation/review path.
2. Existing chain-97 records are inactive health-only endpoints.
3. 8004scan does not provide price, quote, action, destination, or calldata.
4. Aave’s live action tools cannot be safely called under the read-only rule.
5. No existing agent provides a complete real input set for X.4B/X.4C.

This does not authorize Path C implementation. It establishes only that an
operator-owned provider/service is necessary if the main track must include a
real activation target.

## 9. Altana Partner Track Status

### Existing implementation

- chain-97 x402 and ERC-8183 adapters exist;
- chain guards reject mainnet;
- `prepareErc8183Hire` constructs the verified five-call batch;
- X.4B review and X.4C consent are implemented;
- session-key execution, wallet UI, and live transaction submission are not
  wired into the marketplace;
- no live Altana explorer transaction has been demonstrated.

### Future testnet checklist

Do not execute during this audit. A later authorized milestone must verify:

1. operator wallet and provider identity;
2. server-only facilitator/payTo configuration;
3. session-key registration in Keystore;
4. call allowlist containing only required contracts;
5. spend cap and expiry;
6. visible permission review;
7. revoke path and read-only verification;
8. chain-97 gas and `$U` balances;
9. one explicit X.4B review;
10. one explicit X.4C consent;
11. only then, one testnet transaction and independent explorer/receipt
    verification.

No transaction was executed here.

## 10. TermiX Agent Advantage Plan

TermiX integration is read-only reputation only. Do not build a TermiX
execution integration. No results are claimed until tasks are actually run.

| Task                          | Agent/interface                                                  | Without-agent method                                                      | With-agent method                                                                            | Measurements                                                         | Artifact                                                   |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Trading research/readiness    | Aave HeyAnon safe MCP surface                                    | Manually inspect documented BSC/Aave support and produce a risk checklist | Run only the verified read-only supported-chain probe; compare completeness and elapsed time | Wall-clock time; $0 vs $0; checklist completeness and reviewer score | Input, raw read-only response, manual report, agent report |
| Security/action safety review | Aave HeyAnon plus local activation safety boundary               | Manually inspect endpoint/tool manifest and classify mutation risk        | Run the existing manifest/tools-list/safe-probe path and produce an action-safety report     | Time; $0 vs $0; false-positive/false-negative review                 | Manifest snapshot, probe result, safety matrix             |
| Agent operational readiness   | Chain-97 Mandate health endpoint, only if identity remains valid | Manually inspect endpoint and record service health                       | Call health endpoint and compare structured evidence extraction                              | Time; $0 vs $0; field accuracy and honesty of `live:false` handling  | Health response, manual notes, structured report           |

These are report tasks, not TermiX jobs. A genuine trading/security execution
comparison requires a real active chain-97 agent, TermiX identity, service
terms, and later explicit authorization. Until then, the artifact must state
that no job, trade, payment, or remediation was performed.

## 11. PancakeSwap Challenge Status

Existing integration is server-only, read-only BSC mainnet pool intelligence.
It exposes pool identity, reserves, TVL/price fields when available, cumulative
volume, and transaction counts. It does not swap, approve, sign, or move funds.

Current blocker:

- configured NodeReal Free endpoint returns HTTP 500 even for `{ __typename }`;
- no GraphQL data or errors are returned;
- the pool query is not sent after the minimal source failure;
- no live pool values are available;
- historical fallback sources are dead or unverified;
- fixtures are not live data.

The strongest user benefit is a truthful liquidity/market-context panel for
traders or LP researchers. It must remain separate from agent reputation and
must not fabricate APR/APY, 24-hour volume, TVL, or pool rows.

## 12. Production Readiness

### Positive controls

- server-only API-key conventions;
- no client-side wallet/private-key path in the current activation flow;
- chain-97 and `$U` guards;
- fixture calldata/address rejection;
- exact identity matching;
- honest missing/offline/unsupported states;
- no automatic signing, broadcast, payment, or settlement.

### Findings before any live activation

High priority:

- X.4C consent canonicalization currently binds chain, token, amount, payTo,
  destination, and calldata, but not every displayed security-relevant field
  such as job ID, facilitator, operator, and action label.
- Production environment validation has development-style defaults and does not
  uniformly fail closed for all runtime configuration.

Medium priority:

- hire body-size protection relies on `Content-Length` and can be bypassed by
  chunked/no-length requests;
- public hire route has no visible authentication, rate limiting, or request
  coalescing;
- server successful outcome uses `reviewJson` while the client panel expects
  `review`, so the review UI contract needs an end-to-end test/fix before live
  use;
- raw internal error messages are returned to callers;
- facilitator/operator/payTo addresses are syntactically checked but not fully
  verified against deployment authorization and chain state.

Low priority:

- fixtures are colocated with application verification code;
- generated output is not consistently present in the workspace;
- CI has no dedicated secret scan, SAST, dependency audit, or post-build bundle
  scan.

The audit did not print or include secret values. `8004SCAN_API_KEY` was absent;
the secure environment presence check found operator/facilitator-related
configuration, but values were not read into the report.

## 13. Remaining Blockers

1. No existing BSC agent supplies a compatible complete activation capability.
2. No active chain-97 seller endpoint with real price/quote/action data exists.
3. Marketplace catalog/detail/category routes are not all wired to live registry
   data at equal operational depth.
4. Real service price and provider identity for Path C are not established.
5. ERC-8004 registration ABI/registration procedure for a future operator agent
   remains unverified in the repository.
6. Review UI/server response contract needs alignment before any live activation.
7. Consent digest should bind all security-relevant reviewed fields.
8. Altana partner requires a separately authorized testnet transaction demo.
9. TermiX requires real task artifacts and a resolvable AACP identity.
10. PancakeSwap live source remains externally blocked by NodeReal HTTP 500.
11. Public deployment URL and deployment verification are not established.

## 14. Exact Next Milestone

**X.13 — Prepare, do not register: implement the read-only operator service and
resolve the live activation safety gates.**

The milestone should be explicitly bounded to:

1. fix the X.4B/X.4C review response contract and bind all security-relevant
   consent fields;
2. define an approved server-only raw-`$U` price without silently choosing a
   value;
3. implement the deterministic read-only portfolio-risk endpoint;
4. create canonical ERC-8004 metadata without broadcasting registration;
5. obtain and verify the deployed chain-97 registry ABI;
6. wire the service capability into the existing resolver only when all real
   fields are present;
7. add endpoint/metadata/price/fixture/secret-isolation tests;
8. leave registration, hire, payment, signing, and broadcast disabled.

Do not begin a live transaction milestone until this preparation passes review.

## 15. Final Recommendation

```text
OPTION C:
PATH C PROVIDER — JUSTIFIED
```

The decision is based on the absence of any existing BSC agent that can satisfy
all of: real compatible chain, live endpoint, legitimate activation mechanism,
real price/quote, safe action shape, and X.4B/X.4C inputs. Existing agents remain
valuable for discovery and comparison, especially Aave for safe read-only MCP
inspection, but none is a legitimate activation target for the current flow.

Path C must mean a real operator-owned provider/service with transparent
metadata and explicit pricing, not a fake agent, fixture, guessed calldata, or
synthetic success response. No Path C implementation was performed in this
audit.

```text
No signing.
No payment.
No broadcast.
No settlement.
No registration.
No job creation.
No deployment.
No mainnet transaction.
No Git commit or push.
```
