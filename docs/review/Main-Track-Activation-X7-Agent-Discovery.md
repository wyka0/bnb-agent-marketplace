# Main Track Activation X.7: Real BSC Agent Discovery

**Date:** 2026-08-12
**Mode:** READ-ONLY discovery and endpoint inspection
**Scope:** 8004scan, BNB Agent ecosystem resources, official endpoints, A2A,
MCP, x402, ERC-8183, and partner/hackathon resources

## X.7 STATUS

```text
ACTIVATABLE AGENT:   NOT FOUND
CANDIDATES CHECKED:  15 candidate groups (including 4 exact chain-97 agents)
BEST CANDIDATE:      Aave powered by HeyAnon
ACTION INTERFACE:    MCP (real endpoint; action schemas only, no safe action quote)
CHAIN:               BSC mainnet 56
REAL ACTION SHAPE:   NOT FOUND for a safely inspectable live activation request
TESTNET COMPATIBILITY: NO for the strongest candidates; YES only at infrastructure
                        level for the separate chain-97 testnet registrations
X.4C COMPATIBILITY:  UNKNOWN for the strongest MCP candidate; NO for all candidates
                     whose action or payment fields are absent
```

**EXACT BLOCKER:** No legitimate BNB agent currently exposes a public, verified,
chain-97-compatible activation response containing real amount, recipient,
destination, and calldata/action parameters that can feed X.4B/X.4C without an
execution-class request or fabricated values.

**NEXT ACTION:** Obtain a verified chain-97 seller deployment or explicit user
consent for one bounded, non-mutating action-builder probe against the strongest
candidate, then independently validate the returned unsigned action before any
signing decision.

No signing, broadcast, payment, settlement, transfer, approval, execution,
fixture-job reuse, deployment, commit, or push occurred.

## 1. Discovery Method

Every candidate was required to have a legitimate source and was checked against
the following gates:

1. Exact agent identity and registry identity.
2. Chain ID and testnet/mainnet status.
3. Public endpoint or authoritative project interface.
4. Whether the endpoint exposes an actual action rather than only identity,
   reputation, historical activity, or tool documentation.
5. Whether amount, recipient, destination, calldata, or equivalent action
   parameters are available without execution.
6. Whether x402 or ERC-8183 is actually present for the candidate, rather than
   merely mentioned by an ecosystem or SDK page.
7. Whether the resulting data is sufficient for the existing X.4B review and
   X.4C consent digest.

The public 8004scan OpenAPI was also checked. Its documented agent schema exposes
identity, owner, description, protocol labels, and reputation fields, but does not
promise action, pricing, recipient, destination, or calldata fields. Detailed
records can contain service metadata, so each relevant detail endpoint was checked
separately.

## 2. Candidate Summary

| Candidate                     | Exact identity                                         |                    Chain | Endpoint/interface                                  | Classification                  |
| ----------------------------- | ------------------------------------------------------ | -----------------------: | --------------------------------------------------- | ------------------------------- |
| LiqShield                     | `97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1807`   |           BSC testnet 97 | `https://mandate-bnb-agent.vercel.app/api/health`   | `NOT_ACTIVATABLE`               |
| YieldRoute                    | `97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1806`   |           BSC testnet 97 | Same shared health endpoint                         | `NOT_ACTIVATABLE`               |
| GridPilot                     | `97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1805`   |           BSC testnet 97 | Same shared health endpoint                         | `NOT_ACTIVATABLE`               |
| RangeGuard                    | `97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1804`   |           BSC testnet 97 | Same shared health endpoint                         | `NOT_ACTIVATABLE`               |
| Aave powered by HeyAnon       | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381`  |           BSC mainnet 56 | MCP `https://erc8004.heyanon.ai/mcp/aave`           | `NOT_ACTIVATABLE` for this flow |
| Jarvis / Singularry           | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:117823` |           BSC mainnet 56 | A2A card + MCP `https://app.singularry.org/api/mcp` | `DISCOVERY_ONLY`                |
| EZCTO Deployer Agent          | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:137`    |           BSC mainnet 56 | MCP `https://mcp.ezcto.fun/`                        | `NOT_ACTIVATABLE`               |
| Q402 Agent by Quack AI        | `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:264136` |           BSC mainnet 56 | MCP info + Q402 relay metadata                      | `DISCOVERY_ONLY`                |
| BNB Mission Control           | ERC-8004 agent `133085`                                |           BSC mainnet 56 | Dashboard + advertised API                          | `NOT_ACTIVATABLE`               |
| Gridora                       | ERC-8004 agent `140004`                                |           BSC mainnet 56 | Public verifier and source repository               | `NOT_ACTIVATABLE`               |
| Neural Alpha by ClipX         | Exact ERC-8004 ID not established                      |              BSC claimed | Dashboard/source/local runtime                      | `UNKNOWN`                       |
| Genesis                       | Exact ERC-8004 ID not established                      |              BSC claimed | Dashboard/source/local runtime                      | `UNKNOWN`                       |
| Other BSC 8004scan records    | Examples: `Cipher-LeapBeta.agent` token `264635`       |           BSC mainnet 56 | Registry/discovery metadata                         | `DISCOVERY_ONLY`                |
| BNB Agent Studio seller model | No specific seller identity found                      |  Mainnet/testnet tooling | ERC-8004 + ERC-8183 + x402 deployment model         | `DISCOVERY_ONLY`                |
| Altana SDK / skills           | Infrastructure, no individual agent identity           | BSC 56 and documented 97 | SDK, MCP, ERC-8183, x402 seller primitives          | `DISCOVERY_ONLY`                |

## 3. Chain-97 Candidates

The live 8004scan query returned four testnet agents:

```text
97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1807 | LiqShield
97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1806 | YieldRoute
97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1805 | GridPilot
97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1804 | RangeGuard
```

All four records reported:

- `chain_id: 97`;
- registry `0x8004a818bfb912233c491871b3d84c89a494bd9e`;
- protocol `Web`;
- `x402_supported: true`;
- `is_verified: false`;
- `is_active: true`;
- identical service endpoint:
  `https://mandate-bnb-agent.vercel.app/api/health`;
- no A2A endpoint, MCP endpoint, or agent URL;
- endpoint verification false and no endpoint verification timestamp.

The off-chain metadata for LiqShield was decoded read-only:

```json
{
  "name": "LiqShield",
  "description": "Health Factor Monitoring agent for bounded MANDATE jobs on BNB Chain.",
  "services": [
    {
      "name": "web",
      "endpoint": "https://mandate-bnb-agent.vercel.app/api/health",
      "version": "1.0.0",
      "capabilities": ["health", "shadow-mode", "bounded-mandates"]
    }
  ],
  "registrations": [],
  "supportedTrust": ["reputation", "crypto-economic"]
}
```

The endpoint returned:

```json
{
  "ok": true,
  "network": "bsc-testnet",
  "live": false,
  "sdk": "bnbagent",
  "standards": ["ERC-8004", "ERC-8183"],
  "operatorAddress": null
}
```

This is a health/status response, not a quote or action response. It exposes no:

- amount or price;
- pay-to or recipient;
- destination contract;
- calldata;
- provider/evaluator/job parameters;
- task-specific resource URL;
- x402 challenge;
- ERC-8183 job or negotiation data.

The `standards` field confirms ecosystem compatibility only. It does not prove an
ERC-8183 seller is deployed or that x402 terms exist. `live:false` and
`operatorAddress:null` are decisive blockers.

**Classification for all four:** `NOT_ACTIVATABLE`.

## 4. Aave powered by HeyAnon

**Exact identity:**
`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381`
**Owner:** `0xda977767452c5dd021624511f14df67b6c9c2c1b`
**Endpoint:** `https://erc8004.heyanon.ai/mcp/aave`
**Interface:** MCP `2025-06-18`

The manifest is real and exposes 22 Aave V3 tools. Nine action-producing tools
have schemas requiring parameters such as:

- `chainName`;
- `assetAddress`;
- `amount`;
- `userAddress`;
- interest-rate mode or other action parameters.

Their documented output is an unsigned transaction shape:

```text
transactions[].chainId
transactions[].transaction.target
transactions[].transaction.data
transactions[].transaction.value
```

The manifest does not provide a dedicated `quote`, `preview`, `dryRun`, or
`buildTransaction` tool, and it has no read-only/destructive annotations. A
financial action tool call would therefore be an execution-class request even if
the expected response is unsigned transaction material. It was not called.

The safe read-only probe used `getAaveV3SupportedChains`; it confirmed BSC mainnet
support, but not chain-97 support or a financial action. The manifest contains no
x402 or ERC-8183 fields. Existing project evidence says x402 _may_ be required at
the `tools/call` execution layer, but no challenge terms were obtained.

**Classification:** `NOT_ACTIVATABLE` for the current X.7 objective.

Reasons:

1. It is BSC mainnet only in the verified agent identity.
2. The actual action shape requires a tool call that was not authorized under this
   read-only milestone.
3. The static manifest has schemas and action output shape, but no concrete amount,
   recipient, destination, calldata, or x402 terms for a marketplace hire.
4. The action is Aave protocol execution, not an ERC-8183 hire/activation offer.

## 5. Jarvis / Singularry

**Exact identity:**
`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:117823`
**Owner/wallet:** `0x88dda819068eaae0230155f43ffcef70318537ab`
**A2A card:** `https://app.singularry.org/agents/20/agent-card.json`
**MCP:** `https://app.singularry.org/api/mcp`

The A2A card is live and lists skills including DCA, USDD yield vault,
momentum, HRP portfolio, funding-rate arbitrage, and concentrated-liquidity LP.
The MCP manifest is also live and exposes five read-only tools:

- `list_active_agents`;
- `get_agent_portfolio`;
- `get_agent_strategies`;
- `get_agent_pnl`;
- `get_recent_decisions`.

The MCP server explicitly describes itself as read-only discovery and portfolio
monitoring. It exposes no action-producing tool, amount, recipient, destination,
calldata, x402 challenge, or ERC-8183 job interface.

**Classification:** `DISCOVERY_ONLY`.

## 6. EZCTO Deployer Agent

**Exact identity:**
`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:137`
**MCP:** `https://mcp.ezcto.fun/`
**A2A card advertised by 8004scan:** `https://api.ezcto.fun/.well-known/agent-card.json`

The public MCP manifest exposes:

- `generate_website`;
- `generate_visual_asset`;
- `deploy_static`.

The service is a website generation/deployment tool. It exposes no BSC financial
activation, no x402 terms, no ERC-8183 fields, and no blockchain transaction
shape. The A2A card was reported unhealthy/404 by 8004scan.

**Classification:** `NOT_ACTIVATABLE`.

## 7. Q402 Agent by Quack AI

**Exact identity:**
`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:264136`
**MCP info:** `https://q402.quackai.ai/api/mcp/info`
**Relay info:** `https://q402.quackai.ai/api/relay/info`

The MCP info manifest is live and advertises payment, bridge, yield, staking,
escrow, and trigger tools. It includes action names such as `q402_pay`,
`q402_yield_deposit`, `q402_escrow_create`, and `q402_bridge_send`.

However:

- transport is advertised as stdio/npm rather than a validated public MCP action
  endpoint;
- the manifest gives tool descriptions but no concrete request values;
- action tools would mutate funds or create payment/escrow state;
- the agent is chain 56, not chain 97;
- no ERC-8183 hire interface was found;
- no safe x402 challenge for a marketplace action was obtained.

The relay metadata returned only a facilitator address:
`0xfc77FF29178B7286A8bA703D7a70895CA74fF466`.
That does not establish a candidate-specific price, recipient, destination, or
calldata.

**Classification:** `DISCOVERY_ONLY` for this read-only milestone and
`UNSUPPORTED_CHAIN` for the current chain-97 hire flow.

## 8. BNB Mission Control

**Agent identity:** ERC-8004 agent `133085`
**Participant:** `0xE8A30d24BbA030D3e8a844bD1c4F6e1374EA6215`
**Dashboard:** `https://bnb-mission-control-two.vercel.app`
**Advertised API:** `https://bnb-mission-control-api.onrender.com`

The project has historical ERC-8183 evidence and claims jobs `25741` and `26506`
on BSC mainnet. The advertised read-only `/api/health` and `/api/pillars`
endpoints both returned HTTP 503 during this discovery.

Historical job IDs cannot be reused as new activation inputs. No current amount,
recipient, destination, calldata, evaluator, expiry, or x402 challenge was
available from a live service response.

**Classification:** `NOT_ACTIVATABLE`.

## 9. Gridora, Neural Alpha, and Genesis

### Gridora

- ERC-8004 agent `140004`;
- wallet `0x7053676258ef5bFB9b27FCF42092F13fB37B9989`;
- BSC mainnet 56;
- public verifier `https://gridora.vercel.app`;
- `/.well-known/agent-card.json` returned 404.

The verifier exposes historical PnL/trade evidence, not a public activation route.
**Classification:** `NOT_ACTIVATABLE`.

### Neural Alpha by ClipX

- Wallet `0x8ec6aB4e0F4383ECB01f870FC70CB351a12C43aF`;
- BSC trading project;
- no exact ERC-8004 identity or public action endpoint established.

Local runtime/source evidence is not enough to classify it as activatable.
**Classification:** `UNKNOWN`.

### Genesis

- BSC trading project using local agent/runtime tooling;
- no exact ERC-8004 identity or public action endpoint established;
- no explicit chain-97 activation evidence.

**Classification:** `UNKNOWN`.

## 10. Ecosystem Resources

### 8004scan / ERC-8004

8004scan is valid discovery infrastructure. A registry record proves identity and
possibly service metadata, not an activation capability. The current public API
schema contains no mandatory amount, recipient, destination, calldata, or quote
fields. Individual detail metadata must be validated separately.

**Classification:** `DISCOVERY_ONLY`.

### BNB Agent Studio

BNB Agent Studio documents a seller architecture combining ERC-8004, ERC-8183, and
x402. Its testnet campaign supports BSC chain 97 at the infrastructure level, but
no specific deployed seller endpoint with real terms was found.

**Classification:** `DISCOVERY_ONLY`.

### ERC-8183

ERC-8183 supplies the job/escrow protocol and the existing project builders can
construct a five-call hire batch on chain 97. It does not identify a provider,
budget, evaluator, expiry, or task-specific calldata for an individual agent.

**Classification:** `DISCOVERY_ONLY`.

### x402

x402 can expose amount, token, chain, payTo, resource, expiry, and facilitator
terms in a 402 challenge. No candidate-specific BSC testnet challenge was safely
obtained. Protocol availability alone does not make an agent activatable.

**Classification:** `DISCOVERY_ONLY`.

### Altana SDK and skills

Altana documents BSC mainnet and testnet SDK support, ERC-8183 builders, x402
seller infrastructure, MCP, and BNB skills. These are compatible primitives, not a
specific deployed agent with a real quote/action endpoint.

**Classification:** `DISCOVERY_ONLY`.

## 11. X.4B/X.4C Compatibility Matrix

| Candidate                                 | Amount                 | Recipient/payTo                        | Destination                               | Calldata/action params        | Chain 97 | x402                             | ERC-8183          | X.4C    |
| ----------------------------------------- | ---------------------- | -------------------------------------- | ----------------------------------------- | ----------------------------- | -------- | -------------------------------- | ----------------- | ------- |
| LiqShield/YieldRoute/GridPilot/RangeGuard | No                     | No                                     | No                                        | No                            | Yes      | Flag only                        | Metadata only     | No      |
| Aave powered by HeyAnon                   | Schema input only      | User address input, not merchant payTo | Only after unexecuted action-builder call | Schema/output shape only      | No       | Unknown/may apply                | No                | Unknown |
| Jarvis                                    | No                     | No                                     | No                                        | No action tool                | No       | No evidence                      | No                | No      |
| EZCTO                                     | No                     | No                                     | No                                        | Non-blockchain website tools  | No       | No                               | No                | No      |
| Q402                                      | Tool descriptions only | Unknown                                | Unknown                                   | Mutating tools, no safe draft | No       | Q402-specific                    | No                | No      |
| Mission Control                           | Historical only        | Historical only                        | Historical only                           | Historical jobs only          | No       | Historical/other-chain ambiguity | Historical only   | No      |
| Gridora                                   | Historical only        | Historical wallet only                 | Historical only                           | Historical trades only        | No       | No live terms                    | No current seller | No      |
| Neural Alpha / Genesis                    | Unknown                | Unknown                                | Unknown                                   | Local runtime only            | Unknown  | Unknown                          | Unknown           | Unknown |

No row reaches `ACTIVATABLE`.

## 12. Evidence and Reproduction Sources

Project/live sources:

- `apps/web/x7-testnet.mjs`
- `apps/web/x7-detail.mjs`
- `apps/web/x7-mandate.mjs`
- `apps/web/lib/eight004scan/client.ts`
- `docs/review/Main-Track-Provisioning-P11.md`
- `docs/review/Main-Track-Activation-P12.md`
- `docs/review/Main-Track-Activation-X6-Hire-Endpoint.md`

Public endpoints checked:

- `https://8004scan.io/api/v1/public/docs/openapi.json`
- `https://8004scan.io/api/v1/public/agents?isTestnet=true&limit=100`
- `https://8004scan.io/api/v1/public/agents/97/1807`
- `https://mandate-bnb-agent.vercel.app/api/health`
- `https://mandate-bnb-agent.vercel.app/`
- `https://erc8004.heyanon.ai/mcp/aave`
- `https://app.singularry.org/agents/20/agent-card.json`
- `https://app.singularry.org/api/mcp`
- `https://mcp.ezcto.fun/`
- `https://q402.quackai.ai/api/mcp/info`
- `https://q402.quackai.ai/api/relay/info`
- `https://bnb-mission-control-api.onrender.com/api/health`
- `https://bnb-mission-control-api.onrender.com/api/pillars`
- `https://gridora.vercel.app/.well-known/agent-card.json`

## 13. Safety Stop

The discovery phase stopped after read-only registry, metadata, health, manifest,
A2A card, and MCP information requests. No `tools/call` was sent to a financial
or mutating service. No x402 payment challenge was retried. No ERC-8183 mutating
method was called. No historical job, fixture agent, fixture amount, fixture
calldata, or existing transaction was reused.

```text
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
TRANSFER: NOT PERFORMED
APPROVAL: NOT PERFORMED
DEPLOYMENT: NOT PERFORMED
```
