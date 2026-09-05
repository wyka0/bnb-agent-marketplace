# MAIN TRACK P10 — Aave Agent Activation Feasibility

Date: 2026-08-11 · Mode: FEASIBILITY/DESIGN ONLY (no implementation) · Reader: BNB Chain admin

## 1. Objective

Determine the REAL activation path for the strongest health-factor candidate
identified in P9 — **Aave powered by HeyAnon** (BSC, chain 56, `agent_id`
`56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381`) — and answer whether
the main-track journey (find → understand → activate → agent performs action →
user receives result) is representable as a safe, evidenced activation flow.
Nothing was implemented, connected, signed, or transacted.

Tagging legend: `LIVE DATA` (queried the live 8004scan API) · `OFFICIAL
SOURCE` (HeyAnon docs / x402 spec / Aave address book) · `REPOSITORY FACT`
(verified from repo code) · `INFERENCE` (reasoned from evidence) · `UNKNOWN`.

## 2. Aave Agent Identity

- `agent_id` `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381` — exact
  round-trip re-verified for P10. `LIVE DATA`
- chain 56 (BSC mainnet, `chain_type` evm, `is_testnet` false), token_id
  45381, registry contract `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`,
  owner `0xda977767452c5dd021624511f14df67b6c9c2c1b`, unverified, 0 feedback.
- `health_score` 100; `total_score` 30.45; created 2026-03-18, updated
  2026-08-10 (recently refreshed). `cross_chain_versions` null. `LIVE DATA`

## 3. Live Registry Evidence (full record, every field)

No endpoint URL, no MCP server URL, no service metadata, no documentation URL,
no capabilities/agent-card fields exist anywhere on the record — the schema
has none. Fields material to activation: `LIVE DATA`

- `supported_protocols`: **["MCP", "Web"]** (no A2A)
- `x402_supported`: **true**
- `description`: _"Safe execution layer for Aave lending. Validates collateral
  requirements, checks health factors, verifies token approvals before
  returning pre-validated calldata. Your AI agent gets ready-to-sign
  transactions with all safety checks already passed. Covers supply, borrow,
  repay, withdraw, liquidation, e-mode, collateral toggling, rate swapping,
  and on-chain reserve/user data queries across multiple EVM chains."_
- `image_url`: an IPFS asset (pinata gateway) — artwork only, no endpoint.

The registry identifies the agent and declares its interfaces; it does NOT
reveal how to call it. `LIVE DATA` + `INFERENCE`

## 4. Official Documentation Evidence

- **HeyAnon docs — Aave V3 module** (`docs.heyanon.ai`): supply/borrow/repay/
  withdraw operations, health-factor monitoring, liquidation thresholds,
  user analytics (positions, debts, collateral ratios, health factor,
  E-Mode), reserve data; supported networks explicitly include **BSC**.
  `OFFICIAL SOURCE`
- **HeyAnon prompt guide**: `@aaveV3 deposit/withdraw/borrow/repay [amount]
[asset] [collateral]`, `@aaveV3 check health factor`; networks: Ethereum,
  Base, BNB, Arbitrum. `OFFICIAL SOURCE`
- **HeyAnon MCP Tools** (`launchpad.heyanon.ai/mcp`): _"The execution
  substrate. Six strictly-defined, security-audited tools… No hallucination
  possible — only deterministic actions. All MCP tool calls are signed with
  your API key and verified before execution. **Transactions are simulated
  before broadcasting. Failed simulations return an error — no gas
  consumed.**"_ `OFFICIAL SOURCE`
- **Aave V3 on BNB** — official `aave-dao/aave-address-book`
  (`AaveV3BNB.sol`): Pool = `0x6807dc923806fE8Fd134338EABCA509979a7e0cB`,
  PoolAddressesProvider = `0xff75B6da14FfbbfD355Daf7a2731456b3562Ba6D`,
  listed assets CAKE, WBNB, BTCB, ETH, USDC, USDT, FDUSD, wstETH (+ gateways
  like WETH_GATEWAY). Governance proposal #6 activated the BNB v3 pool
  (3.0.2). `OFFICIAL SOURCE`
- **x402** (`docs.x402.org` + x402-foundation spec v2): open payment standard
  on HTTP `402`; server returns `PAYMENT-REQUIRED` (scheme, network, payTo,
  amount, asset); client signs an **EIP-3009** authorization
  (`transferWithAuthorization`) and retries with `PAYMENT-SIGNATURE`; a
  facilitator `/verify` + `/settle`. Pay-per-call for the resource (the agent
  request). `OFFICIAL SOURCE`

## 5. Activation Protocol (what "calldata → wallet tx" means)

Evidence-aligned answer to the 10 questions:

1. **What calldata?** Aave V3 Pool contract calls — supply, borrow, repay
   (`repayWithATokens`/with-collateral adapters possible), withdraw, set
   collateral usage, set E-Mode, swap rate mode, liquidationCall — plus ERC-20
   `approve` transactions where the operation needs an allowance
   (supply/repay typically). Exact bytes come from the agent; nothing is
   invented here. `OFFICIAL SOURCE` (Aave pool interface) + `INFERENCE`
2. **Who generates it?** The HeyAnon agent service (its MCP/Web interface):
   it validates, simulates, and returns "pre-validated, ready-to-sign"
   transactions (registry description + MCP "simulated before broadcasting").
   `LIVE DATA` + `OFFICIAL SOURCE`
3. **Which contract receives the tx?** Aave V3 **Pool proxy on BSC**,
   `0x6807dc923806fE8Fd134338EABCA509979a7e0cB` (chain 56); approvals target
   the ERC-20 underlyings (e.g. USDT `0x55d3…`); native-asset paths may route
   via the official WETH_GATEWAY. Recipient MUST be shown to and confirmable
   by the user. `OFFICIAL SOURCE`
4. **Which chain?** BSC mainnet, chainId 56 (record `chain_id` + HeyAnon docs
   list BSC). `LIVE DATA` + `OFFICIAL SOURCE`
5. **Token/value?** Operation-dependent: CAKE/WBNB/BTCB/ETH/USDC/USDT/FDUSD/
   wstETH on the BNB market; amount = user's request; gas in BNB. The x402
   service fee (if any) is separate. Exact values known only when calldata
   arrives — displayed to the user, never assumed. `OFFICIAL SOURCE` +
   `UNKNOWN` (per-tx values)
6. **User-authorized?** **YES.** The agent returns calldata; the USER signs
   and broadcasts from their own wallet. The agent never holds keys.
   `INFERENCE` (architectural: "ready-to-sign transactions" + signing is the
   user's role) — no key surface exists in the product. `REPOSITORY FACT`
7. **MCP call before calldata?** **YES per architecture.** Activation =
   agent request through the MCP (or Web) interface; the response IS the
   pre-validated calldata (+ optional analysis/position data). `OFFICIAL
SOURCE` (MCP = execution substrate) + `INFERENCE`
8. **x402 before execution?** x402 pays for the agent REQUEST (per-call
   service fee via 402 challenge → EIP-3009 signature → retry). It happens
   BEFORE the agent's calldata response, and is separate from the on-chain
   Aave transaction. Whether THIS agent's endpoint enforces payment is
   UNKNOWN (flag true ≠ price published). `OFFICIAL SOURCE` + `UNKNOWN`
9. **Result after execution?** On-chain: tx receipt + Aave events
   (Supply/Borrow/Repay/Withdraw/liquidation), confirmable independently via
   RPC/explorer; the agent may also return pre-execution analytics (position,
   health factor, reserve data). The exact post-execution payload schema is
   UNKNOWN. `INFERENCE` + `UNKNOWN`
10. **Safe as an activation flow?** **YES** — every stage maps to an
    evidenced component (Section 8 & 11); the flow is representable without
    inventing anything. `INFERENCE`

## 6. Wallet Requirement

**WALLET REQUIRED FOR SIGNING** — and therefore for contract execution and
any x402 payment:

- Aave calldata tx: user signs (EIP-712 / standard wallet approval) and
  broadcasts; requires BNB for gas. `INFERENCE`
- x402 (if enforced): EIP-3009 signed authorization — a signature, no gas —
  authorizing `transferWithAuthorization` to the seller/facilitator.
  `OFFICIAL SOURCE`
- Keys stay in the user's wallet; the application and server never touch them
  (future design contract, Section 9). `REPOSITORY FACT` (today: no wallet
  surface exists at all — login is "Wallet connect coming soon").

## 7. Transaction Requirements

| requirement                                                     | chain   | contract                           | type                                                                                                     | asset                                     | value                                              | user auth                           |
| --------------------------------------------------------------- | ------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| approve (ERC-20 allowance)                                      | 56      | underlying token (e.g. USDT/USDC)  | `approve(spender=PAYER? or Pool), amount`                                                                | CAKE/WBNB/BTCB/ETH/USDC/USDT/FDUSD/wstETH | user's amount + slippage headroom where applicable | sign per tx                         |
| pool call (supply/borrow/repay/withdraw/e-mode/collateral/rate) | 56      | Aave V3 Pool `0x6807…`             | `supply/borrow/repay/withdraw/setUseReserveAsCollateral/setUserEMode/swapBorrowRateMode/liquidationCall` | market assets                             | user's amount                                      | sign per tx                         |
| native-asset wrap/supply path                                   | 56      | WETH_GATEWAY (official)            | possible gateway call                                                                                    | BTCB/ETH wrapped flows                    | user's amount                                      | sign per tx                         |
| x402 service payment (if enforced)                              | UNKNOWN | UNKNOWN (payTo from 402 challenge) | EIP-3009 `transferWithAuthorization` authorization                                                       | typically USDC                            | service fee                                        | sign per tx (revealed by challenge) |

- Transfer by user: no direct ERC-20 `transfer` needed — Aave pulls funds
  (`transferFrom`) after approve when supplying. `OFFICIAL SOURCE`
- Permit: some operations support permit-style paths; whether this agent
  emits them is UNKNOWN.
- Swap: NOT described in this agent's scope (lending operations only;
  adapters like repay-with-collateral exist but their use here is UNKNOWN).
- Multiple transactions: yes, 1–2 typical (approve → pool call); exact
  sequence determined by the returned calldata — display the sequence, never
  hide steps. `INFERENCE`
- Anything unverifiable is marked UNKNOWN; no calldata is invented. The
  destination, chain, and value of EVERY tx must be displayed (Section 9).

## 8. x402 Relationship

P9 observed `x402_supported=true`. Assessment: **D — unknown whether
required**, with a documented leaning:

- x402 is the pay-per-call layer FOR THE AGENT REQUEST (402 → EIP-3009 →
  retry), evidenced by the official protocol spec. `OFFICIAL SOURCE`
- It is NOT the Aave transaction path: the pool call is user-signed and
  broadcast directly (gas in BNB); x402 ≠ required to execute Aave.
  `INFERENCE` + `OFFICIAL SOURCE`
- The registry publishes no pricing/network/payTo for this record, so
  whether the endpoint actually charges is UNKNOWN. If the service follows
  common deployment (per official examples it may be free-tier with paid
  tier or paid-only), charging would be revealed by the live 402 challenge —
  verifiable at design-time without paying by reading `PAYMENT-REQUIRED`.
  `UNKNOWN` + `INFERENCE`
- Conclusion: treat x402 as a service-fee possibility shown to the user
  before any signature; never assume it is required, never bypass it if
  charged.

## 9. MCP Relationship

`supported_protocols=["MCP","Web"]`. Assessment: **A + C — MCP is the
activation AND execution interface** (Web is the parallel interface of the
same service):

- HeyAnon MCP = "the execution substrate": deterministic, audited tools;
  calls signed with the user's API key; **transactions simulated before
  broadcasting** (failed simulation → error, no gas consumed). `OFFICIAL
SOURCE`
- The registry description ("ready-to-sign transactions", "pre-validated
  calldata") matches exactly this substrate behavior. `LIVE DATA` +
  `OFFICIAL SOURCE` alignment
- No MCP server URL is published in the registry → endpoint provisioning is
  required out-of-band (Section 17). `UNKNOWN`
- Nothing was executed; no MCP call was made. `REPOSITORY FACT`

## 10. A2A Relationship

**NOT SUPPORTED.** The record's `supported_protocols` = `["MCP","Web"]` —
A2A (agent-to-agent) is NOT declared for this agent (`LIVE DATA`). The
activation design must NOT rely on A2A for this candidate; if a future
category requires A2A agents (e.g. the A2A-only grid/rebalancing records from
P9), that is a SEPARATE client mechanism (A2A protocol), not this path. No
A2A support was added or assumed. `LIVE DATA` + `REPOSITORY FACT`

## 11. Proposed User Journey (actual, evidence-backed flow)

```
USER
 ↓ 1. find             Marketplace — P8 bucket (Health Factor, live counts)        [LIVE DATA]
 ↓ 2. understand       Agent Details — description, protocols MCP/Web, x402=true,  [LIVE DATA]
 │                      health_score 100, evidence excerpt ("checks health factors")
 ↓ 3. activate         Activate control (new phase; today none exists)             [REPOSITORY FACT]
 ↓ 4. agent request    Server route calls the agent's endpoint over MCP/Web        [UNKNOWN endpoint URL]
 │                      (x402: if server returns 402, show the exact fee,           [OFFICIAL SOURCE]
 │                      user signs EIP-3009 authorization, retry)
 ↓ 5. calldata         Agent returns PRE-VALIDATED calldata (simulated first;      [LIVE DATA + OFFICIAL SOURCE]
 │                      failed simulation → error, no gas)
 ↓ 6. review           Client displays: destination (Aave Pool 0x6807… or token    [OFFICIAL SOURCE]
 │                      approve target), chain (BSC 56), value, calldata hash;
 │                      user can REJECT
 ↓ 7. sign             USER's wallet signs locally (keys never leave device)       [INFERENCE/design]
 ↓ 8. broadcast        BSC transaction (chain 56, gas BNB) from the user's wallet  [INFERENCE/design]
 ↓ 9. confirmation     tx hash captured; confirmed independently (RPC/explorer)    [INFERENCE/design]
 ↓ 10. result          receipt + Aave events + optional agent analytics returned   [INFERENCE + UNKNOWN schema]
USER
```

Every stage is either evidenced or explicitly marked; no stage was executed.
`INFERENCE` stages are the standard wallet flow, representable without any
invented protocol.

## 12. Security Boundary (design contract, not implemented)

The future wallet flow MUST guarantee:

1. private keys never enter the application,
2. private keys never enter the server,
3. the user signs locally (in their wallet UI),
4. the transaction destination address is displayed,
5. the chain is displayed,
6. the value is displayed,
7. calldata is not silently altered (show a stable hash of what will be
   signed; nothing modifies bytes between display and sign),
8. the user can reject at any step,
9. the transaction hash is captured after submission,
10. confirmation is verified independently (RPC/explorer), not just claimed.

Design-only; the current product still has NO wallet surface, NO signer, and
NO broadcast path (`REPOSITORY FACT`).

## 13. Main-Track Fit

| ask              | verdict     | basis                                                                                                                                                                                                       |
| ---------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| find an agent    | **PASS**    | P8 BSC discovery surfaces it in Health Factor (live count, evidence excerpt). `LIVE DATA`                                                                                                                   |
| understand it    | **PASS**    | richest metadata of the four candidates + official docs for the capability. `LIVE DATA` + `OFFICIAL SOURCE`                                                                                                 |
| activate it      | **PARTIAL** | mechanism fully designed and evidenced, but the record's endpoint URL and x402 terms are UNKNOWN, no wallet exists, author unverified (0 feedback). `UNKNOWN` for endpoint; `REPOSITORY FACT` for no-wallet |
| minimal friction | **PARTIAL** | one agent request + 1–2 signatures is inherently low-friction, but requires wallet provisioning and possibly a service fee; exact friction UNKNOWN until the endpoint terms are known. `INFERENCE`          |

## 14. Other Category Compatibility

Same architecture only where evidence matches:

- **Yield Optimisation** — YES (pattern-level): HeyAnon-branded records share
  the MCP/Web + x402 shape (e.g. "Beefy powered by HeyAnon", Piefi, 0xinsig —
  all `x402_supported=true` per P7/P8 live data). A MCP-request →
  calldata → sign → broadcast path fits them identically. Requires per-record
  endpoint provisioning; `INFERENCE` (declared flags only).
- **Rebalancing** — UNKNOWN: the surfaced candidates declare A2A only (no
  MCP/Web, no x402); an A2A activation client would be a different mechanism.
- **Grid Trading** — UNKNOWN: TradePilot/DeFiBot are A2A-only; not
  compatible with this path without a separate A2A client.
- No mechanism was assumed for a category without matching evidence, and
  nothing was implemented. `LIVE DATA` + `REPOSITORY FACT`

## 15. Minimum Implementation Requirements (next phase, design only)

1. **Wallet connector (signer)** — EIP-1193-class connect; keys never enter
   app/server; sign + broadcast from the wallet (BNB gas on chain 56).
2. **Agent endpoint provisioning** — the registry does not publish the URL;
   a server-side config (env/registry) for the agent's MCP/Web endpoint must
   be supplied out-of-band (Section 17).
3. **Server-side agent request proxy** — bounded, server-only route that
   calls the agent; handles the x402 `402` challenge: parse
   `PAYMENT-REQUIRED`, surface the fee, obtain the user's EIP-3009 signature,
   retry with `PAYMENT-SIGNATURE`, never move funds itself.
4. **Client-side transaction review** — display destination/chain/value/
   calldata hash; explicit user accept; reject path.
5. **Transaction confirmation** — capture tx hash after broadcast; poll a
   public/BSC RPC or explorer for confirmation (independent verification).
6. **Result surface** — receipt + parsed Aave events + optional agent
   analytics; honest pending/failed states.
7. **Error states** — x402 declined, endpoint unreachable, simulation
   failure, signature rejected, tx reverted, confirmation timeout, quota/
   rate-limit (mirroring the marketplace's honest-state pattern).
8. **No secrets** — key usage stays server-side per module; nothing in HTML.

None installed or implemented now. `REPOSITORY FACT`

## 16. Risks

- **Endpoint unknown** — activation cannot be exercised until the agent's
  real MCP/Web URL is obtained; registry has none. `UNKNOWN`
- **Unverified author, 0 feedback** — no operational track record; record
  could be an impersonation of the HeyAnon brand (only the registry contract
  is canonical). `LIVE DATA` + `INFERENCE`
- **Untrusted calldata** — the agent controls calldata bytes; simulation is
  claimed by the service model but must not replace user review: display
  destination/chain/value/hash and allow rejection. `OFFICIAL SOURCE` +
  `INFERENCE`
- **x402 cost surprise** — fee/terms not published; design must surface the
  402 challenge BEFORE any signature or spend. `UNKNOWN` + `OFFICIAL SOURCE`
- **Approve chain** — ERC-20 approvals are themselves txs; a two-tx flow
  (approve → pool call) must be shown as such, never hidden. `INFERENCE`
- **Key custody** — the #1 design risk; mitigated only by the Section 12
  boundary (local signing, no key transport). `INFERENCE`
- **Third-party mirrors** — The Spawn lists identically-named HeyAnon agents
  on other chains with a CLI hire path; unrelated distribution, not our
  registry path — do not conflate. `OFFICIAL SOURCE` (third-party)

## 17. Blockers

1. **No service endpoint in the registry** — the concrete call target for
   "agent request" is UNKNOWN and must be provisioned (official HeyAnon
   channels / operator-supplied URL) before any implementation.
2. **No wallet surface in the product** — login is a stub ("Wallet connect
   coming soon"); the entire sign/broadcast layer is absent. `REPOSITORY FACT`
3. **x402 terms unverified** — whether the endpoint is paywalled (and its
   price/network/asset) is UNKNOWN.
4. **Production server key** — `8004SCAN_API_KEY` is not configured here;
   production requires the server-only key for the registry path. `REPOSITORY FACT`
5. **No operational proof** — unverified author, 0 feedback; liveness of the
   service cannot be confirmed without the endpoint.

## 18. Next Implementation Phase

1. Provision the agent endpoint (out-of-band; record in server config, not
   client code) and confirm the x402 terms via a READ-ONLY 402 probe
   (expecting a `PAYMENT-REQUIRED` header — no payment, no execution).
2. Build the wallet connector (local signing only) + server-side agent proxy
   with the client-side review step.
3. Build broadcast + independent confirmation polling + receipt/result
   surface with honest states.
4. Re-audit the agent (endpoint liveness, verification tier) before exposing
   activation to users; keep the "inferred category + evidence excerpt"
   labeling.

---

## FINAL STATUS

**MAIN TRACK P10 STATUS: ACTIVATION PATH PARTIALLY VERIFIED**

- Exact activation mechanism: **agent request (MCP or Web) → agent returns
  pre-validated Aave calldata (simulated first) → user reviews (destination
  Aave V3 Pool `0x6807dc923806fE8Fd134338EABCA509979a7e0cB` on BSC chain 56,
  chain, value, calldata hash) → user signs locally → user broadcasts → tx
  confirmed independently → receipt/events (+ optional agent analytics)**.
- Wallet requirement: **WALLET REQUIRED FOR SIGNING** (calldata tx with BNB
  gas; x402 payment, if enforced, is a signature-only EIP-3009 authorization).
- Transaction signing required: **YES** — user-author signed, never
  agent-initiated; calldata is never invented by us.
- x402 role: **service-layer pay-per-call for the agent REQUEST** (402 +
  EIP-3009) — NOT the Aave tx path; whether it is enforced for this record is
  UNKNOWN (no pricing published).
- MCP role: **activation + execution interface** (deterministic, simulated
  before broadcast); Web is the parallel interface. A2A is NOT supported by
  this agent (protocols MCP/Web only).
- Minimum next implementation: wallet connector (local signing) → provision
  agent endpoint (server-side) → server agent-request proxy with x402 402
  handling → client tx review (destination/chain/value/hash, reject) →
  broadcast → independent confirmation → receipt + error states.
- Biggest blocker: **the registry publishes no service endpoint** for the
  agent — the concrete call target is UNKNOWN and must be provisioned
  out-of-band; secondarily, the product has no wallet surface and the
  record's x402 terms and author track record are unverified.
- Judgement rationale: the mechanism is verified against official sources
  (HeyAnon docs, x402 spec, Aave address book) and matches the live registry
  description 1:1 — but the per-record endpoint, payment terms, and
  operational liveness cannot be fully verified from available data, so the
  path is PARTIALLY VERIFIED, not full.
