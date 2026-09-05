# MAIN TRACK P11 — Endpoint Provisioning + Read-Only x402 Probe

Date: 2026-08-11 · Mode: READ-ONLY PROBING (no payment, no signing, no tool execution) · Reader: BNB Chain admin

## 1. Objective

Resolve the P10 blocker "no service endpoint in the registry" by locating the
REAL callable endpoint for **Aave powered by HeyAnon** (`bsc:45381`, registry
`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) and probing it read-only: liveness,
MCP handshake, tool surface, and any x402 payment challenge — without paying,
signing, or executing anything.

Tagging legend: `LIVE DATA` (live API/probe response) · `OFFICIAL SOURCE`
(official docs) · `REPOSITORY FACT` · `INFERENCE` · `UNKNOWN`.

## 2. How the Endpoint Was Found

- The 8004scan public API (raw ERC-8004 registry data) has NO service
  endpoints on the record — confirmed again in P10. The registry contract
  `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` is also the ERC-8004 Identity
  Registry used by **The Spawn** (`OFFICIAL SOURCE` — thespawn.io/learn/erc-8004).
- The Spawn's machine API exposes agent records WITH service entries:
  `https://thespawn.io/api/v1/agents/bsc/45381` returned the full record
  (`LIVE DATA`): name "Aave powered by HeyAnon", chain 56 `/bsc/`, quality
  tier B, quality score 63.4 (Spawn's own scoring — independent of
  8004scan's health_score 100), and the service entry:
  - **MCP** — `endpoint: https://erc8004.heyanon.ai/mcp/aave`, version
    `2025-06-18`, capabilities `["tools"]`, with the full tool list.
  - web — `https://heyanon.ai`; plus twitter/telegram/discord socials.
- **The P10 blocker is RESOLVED: the agent's real MCP endpoint is
  `https://erc8004.heyanon.ai/mcp/aave`.**
- Note: `thespawn.io/api/v1/agents/{chain_slug}/{agent_id}` is a read-only
  public GET; no key used. `LIVE DATA`

## 3. Probe Results (`lib/eight004scan/discovery/p11-probe.ts`, bounded, read-only)

| probe                                            | result           | evidence                                                                                                                                                                                                                    |
| ------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `https://erc8004.heyanon.ai/mcp/aave`        | **200** JSON     | full server manifest: `protocolVersion 2025-06-18`, capabilities `tools` only, server `heyanon-erc8004-aave` v1.0.0, `agentGuidance.skillUrl = /mcp/skill.md`, plus inline tool schemas. NO 402.                            |
| POST MCP `initialize`                            | **201**          | proper JSON-RPC result `{protocolVersion, capabilities, serverInfo}`. NO 402.                                                                                                                                               |
| POST MCP `tools/list`                            | **201**          | full 22-tool schema set. E.g. `borrow` requires `chainName` (enum incl. `bsc`), `assetAddress`, `amount`, `interestRateMode`, `userAddress`; output = typed action batch (pending local signing). NO 402.                   |
| GET `https://erc8004.heyanon.ai/mcp` (directory) | **200** JSON     | project directory: `aave` (this agent) + aster, balancer, binance, beefy, convex, beets, wagmi, wagmi-gmi, wagmi-multipool, venus, yearn, hyperliquid, v3pools, meteoraAmmV2/… (15+). Same server `heyanon-erc8004` v1.0.0. |
| GET `https://erc8004.heyanon.ai/mcp/skill.md`    | **200** markdown | official agent guide (Section 4).                                                                                                                                                                                           |
| GET `https://heyanon.ai`                         | **200** html     | live Next.js landing page (web surface).                                                                                                                                                                                    |

All requests were unauthenticated (no `Authorization`, no API key, no payment
header); `redirect: manual`; 15s timeouts. **Nothing was paid, signed, or
executed; no `tools/call` was ever sent.**

## 4. Official Agent Guide (skill.md) — Interface Contract

`OFFICIAL SOURCE` (served by the agent's own server):

- **Endpoint model**: `/mcp` = directory endpoint (lists projects); `/mcp/:prefix`
  = per-project endpoint (lists + calls tools). Root discovery tools:
  `project_<prefix>` and `get_tools_schema`.
- **Pricing**: _"`tools/call` on `/mcp/:prefix` **may require x402 payment**."_
  Discovery is free (proven by our probes); execution may be paid.
- **Signing actions in responses**:
  - `apiRequestActions`: `toSign` is typed data to sign with the USER's
    wallet; after signing, replace the placeholder `body.signature`
    `{ r: '', s: '', v: 0 }` before sending (i.e. the server-orchestrated
    request proceeds only after user authorization).
  - `cexApiRequestActions`: payload to sign / HMAC with the user's API secret
    (not applicable to Aave).
  - **Action arrays are order-dependent**; later actions may depend on
    earlier ones — the receipt of signed actions drives the next step.
- This matches the registry description exactly ("pre-validated calldata /
  ready-to-sign transactions"): the agent returns TO-SIGN structured actions;
  the USER signs; execution proceeds server-side. `LIVE DATA` + `OFFICIAL SOURCE`

## 5. x402 Evidence

- Registry (`8004scan`): `x402_supported: true`. `LIVE DATA`
- Spawn record: NO x402 service entry; MCP service entry only. `LIVE DATA`
- skill.md: `tools/call` **may** require x402 payment — i.e. x402 sits at the
  EXECUTION layer, not discovery (consistent with docs.x402.org HTTP-402
  model: unpaid protected call → 402 challenge → signed EIP-3009 retry).
  `OFFICIAL SOURCE` + `INFERENCE`
- **Actual payment terms (scheme/network/asset/amount/payTo) are UNKNOWN**:
  obtaining the live 402 challenge requires sending a `tools/call` request
  — an execution-class act excluded by this milestone's no-execution
  contract. The 402-denied response itself performs no work and spends
  nothing, but it still requires explicit user consent per milestone rules.
- Conclusion: x402 = pay-per-call fee for the agent's compute on a
  `tools/call`, not a fee for the Aave pool transaction (which remains a
  user-signed, user-broadcast on-chain tx per P10). `INFERENCE`

## 6. MCP Interface Facts (evidence-backed)

- Protocol `2025-06-18` (Streamable HTTP), capabilities = tools only
  (no prompts/resources). `LIVE DATA`
- 22 Aave V3 tools (per Spawn record + live schema echo): supply, borrow,
  repay, repayWithATokens, withdraw, liquidationCall, setEModeCategory,
  setUsageAsCollateral, swapBorrowRateMode, getReserve…, getUserReserves…,
  getUserHealthIndicators, getMaximumBorrowsAmount, getAaveV3SupportedChains,
  getUserActiveLoans, getUserBorrowingPower, getUserCollateral,
  getReserveAssociatedTokens, getReservesList, getUserWalletBalancesForLendingPool,
  batchBalanceOf, errorCodeToText. `LIVE DATA`
- `borrow` inputSchema example: `chainName` (enum incl. `bsc`), `assetAddress`,
  `amount` (human-readable decimal), `interestRateMode` (Variable default),
  `userAddress` — ALL required. `LIVE DATA`
- The chain enum includes `bsc` → chain 56 supported at runtime. `LIVE DATA`
- Directory lists OTHER projects (beefy, venus, yearn, balancer, convex,
  hyperliquid…) on the same server — pattern evidence for Yield Optimisation
  category agents by the same publisher. `LIVE DATA`

## 7. Activation Flow (updated with real endpoint, still design-only)

1. find/understand — P8 discovery + details (unchanged).
2. activate — server route calls `https://erc8004.heyanon.ai/mcp/aave`
   (MCP initialize → tools/list → tools/call, e.g. `supply`/`borrow` with
   chain `bsc` + user address + amount). `LIVE DATA`
3. execution gate — server answers 402 with x402 terms if paid (terms shown
   to user; user consents; EIP-3009 signature obtained) — terms UNKNOWN until
   a consented probe (Section 5). `OFFICIAL SOURCE` + `UNKNOWN`
4. signature round-trip — response carries `apiRequestActions[].toSign`;
   user signs locally (typed data) in their wallet; signature replaces the
   placeholder; request re-sent; action array executed in order. `OFFICIAL SOURCE`
5. result — executed action receipts / final response returned to user;
   on-chain confirmation independently verifiable. `INFERENCE`
6. Security boundary unchanged from P10 §12 (local signing, display
   destination/chain/value/hash, reject, capture tx hash, independent
   confirmation). `REPOSITORY FACT`

## 8. Main-Track Fit

- find | understand: **PASS** (P8/P9 + Spawn profile now adds quality tier B
  / score 63.4 and social links). `LIVE DATA`
- activate: **UPGRADED to FEASIBLE** — concrete endpoint, live server,
  standard MCP handshake, documented signature round-trip; remaining unknowns
  are x402 terms and the exact calldata/typed-data shape of a specific
  operation. `LIVE DATA` + `UNKNOWN`
- minimal friction: two-round-trip flow (tools/call → sign → resend) + any
  x402 fee; friction assessed as moderate; no wallet exists yet in the
  product (unchanged). `INFERENCE` + `REPOSITORY FACT`

## 9. Other Category Compatibility

- **Yield Optimisation (beefy/yearn/venus/convex) | Rebalancing | Grid**
  candidates: hey anon-hosted projects on the SAME directory server
  (`/mcp/beefy`, `/mcp/yearn`, `/mcp/venus`, …) share interface + likely x402
  model — one integration pattern covers several HeyAnon-branded agents.
  `LIVE DATA` + `INFERENCE`. A2A-only records (TradePilot/DeFiBot/RiskOracle)
  remain out of scope of this pattern. `REPOSITORY FACT`

## 10. Risks

- Publisher liveness: endpoint live today; availability is not contractual
  (server could change/rate-limit). `INFERENCE`
- x402 fee unknown → design must surface the 402 challenge before any
  signature/spend; do not assume zero or fixed. `UNKNOWN`
- Untrusted tool output: the server returns to-sign actions; user review
  before signing is mandatory (destination/chain/value/hash visible). `INFERENCE`
- Author still unverified (0 feedback); Spawn tier B is metadata/liveness
  scoring, not operational endorsement. `LIVE DATA`
- `get_tools_schema` / `project_<prefix>` root tools unused in our probe —
  documents exist but were not exercised (execution class). `INFERENCE`

## 11. Blockers

1. Real endpoint now RESOLVED (this milestone) — no longer a blocker.
2. x402 payment terms — UNKNOWN until a user-consented `tools/call` probe
   (requests would be denied with 402; nothing executes, nothing is paid).
3. No wallet/signer surface in the product yet (next milestone).
4. Calldata/typed-data shape of a real operation unverified without an
   execution-class request (consent-gated).
5. `8004SCAN_API_KEY` still not configured for server-side keyed paths
   (anonymous tier sufficient for this audit). `REPOSITORY FACT`

## 12. Next Steps (consent-gated, nothing performed here)

1. Single consented `tools/call` of a NO-OP query tool (`getAaveV3SupportedChains`
   or `getReservesList` for bsc) to capture the live x402 402 challenge
   (scheme/network/asset/amount/payTo) — denied-if-paid, no signature, no spend.
2. Then P12: wallet connector + server-side MCP proxy + signature round-trip
   - client review UI per P10 §15.

---

## FINAL STATUS

**MAIN TRACK P11 STATUS: ENDPOINT RESOLVED | X402 TERMS UNKNOWN**

- Real activation endpoint found and LIVE: **MCP `https://erc8004.heyanon.ai/mcp/aave`**
  (protocol 2025-06-18, server `heyanon-erc8004-aave` v1.0.0), via the
  public Spawn API record `thespawn.io/api/v1/agents/bsc/45381`; web surface
  `https://heyanon.ai` also live.
- Probe outcome: GET/manifest **200**, initialize **201**, tools/list **201**
  (22 Aave V3 tools, `bsc` in the chain enum), directory **200**, skill.md
  **200** — **discovery is free and healthy; NO 402 was returned for any
  discovery request.**
- x402: registered flag true; official guide states `tools/call` MAY require
  x402 payment (execution layer); the live challenge terms (amount/asset/
  network/payTo) are **UNKNOWN** — obtaining them requires a user-consented
  execution-class probe, which this read-only milestone did not perform.
- Signing model (official): responses carry `apiRequestActions[].toSign`
  typed data; USER signs locally; signature replaces `{r:'',s:'',v:0}`
  placeholder; ordered action array drives the flow — matching the record's
  "ready-to-sign transactions" description.
- Main-track blocker lifted: endpoint provisioning is solved; remaining
  blockers are x402 terms, the wallet surface, and real-operation shape
  (all consent-gated, all outside this read-only milestone).
- Nothing was paid, nothing signed, no tool executed, no code imported into
  production paths (probe tool is one-shot, unimported, typecheck-clean).
