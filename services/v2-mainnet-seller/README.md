# BNB Agent Studio v2 Mainnet Seller — READINESS DESIGN (X.233)

**Status: PREPARATION ONLY.** Nothing here is deployed, registered, transacted,
or enabled. The Testnet seller (`services/v2-seller/`) is untouched and remains
the only live seller. Mainnet hiring is DISABLED by default
(`MAINNET_HIRE_ENABLED` absent ⇒ disabled).

## Part A — Current (Testnet) seller audit (evidence, X.219/X.220/X.233)

`services/v2-seller/seller.ts` is testnet-only at every layer:

| #   | Assumption                          | Evidence                                                                                                          |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | `NETWORK` must equal `bsc-testnet`  | `seller.ts:16-18` hard throw; `Dockerfile` `ENV NETWORK=bsc-testnet`                                              |
| 2   | SDK network preset `"bsc-testnet"`  | `seller.ts:52,60` (`ERC8183JobOps`, `ERC8183Client`); helper pins `createSellerNetworkConfig()` → `"bsc-testnet"` |
| 3   | chainId 97 surfaced                 | `/health` returns `chainId: 97`; agent-card `chainId: 97`                                                         |
| 4   | ERC-8004 registry = testnet         | SDK bsc-testnet preset → `0x8004A818…BD9e`                                                                        |
| 5   | Commerce/Router/Policy/$U = testnet | SDK testnet table: Commerce `0xa206…B0DE`, Router `0xD7d3…6F25`, Policy `0xd6a4…1cEA`, $U `0xc70B…5565`           |
| 6   | RPC = testnet                       | SDK preset + `RPC_URL_BSC_TESTNET` override → PublicNode testnet                                                  |
| 7   | Endpoint                            | `ERC8183_AGENT_URL` (currently Tailscale funnel root); marketplace calls `{root}/negotiate`                       |
| 8   | Negotiation                         | `NegotiationHandler`, marketplace-shaped terms, `qualityStandards` required                                       |
| 9   | provider_sig                        | EIP-712 via keystore wallet; marketplace verifies signer == registry owner                                        |
| 10  | Fulfillment                         | `fundedJobWatcher` → `submitResult` + local `.agent-data`                                                         |
| 11  | Settlement                          | on-chain dispute window → auto-complete; buyer `claimRefund` after expiry                                         |
| 12  | Agent 1906                          | strictly chain-97 (`97:0x8004A818…:1906`); CANNOT serve Mainnet                                                   |

Conclusion: the v2-seller cannot serve Mainnet even in principle without a
separate chain-56 process. **`HIRED_CHAIN_ID` stays 97.**

## Part B — Mainnet seller requirements (chain-56)

1. Mainnet owner wallet (keystore-held; key NEVER in source/image)
2. Mainnet ERC-8004 agent identity (token on registry `0x8004A169…a432`)
3. agent owner == seller signer (hard gate G2)
4. Mainnet registry = chain-56 registry above
5. Reachable HTTPS seller endpoint (root URL, no path suffix)
6. `GET /health` → `{status, chainId: 56, seller}`
7. `POST /negotiate` → signed quote (`negotiation_hash`, `provider_sig`)
8. `provider_sig` recovers to the registered owner
9. `chain_id: 56` in every quote
10. `verifying_contract` = `0xEa4DAa31…EBA6`
11. `/job/{id}/response` deliverable endpoint
12. `fundedJobWatcher` over the Mainnet Commerce
13. settlement/refund via Mainnet dispute window (`604800s`, read live)
14. `https://bsc-rpc.publicnode.com` (verified reachable, X.218/X.233)
15. Mainnet $U `0xcE2443…666666` pricing/allowance handling
16. process watchdog + `/health` monitoring

None of these exist yet — this directory only _describes_ them.

## Part E — Implementation design (clone, never share)

```
services/
  v2-seller/            Testnet seller (chain 97) — UNTOUCHED, live
  v2-mainnet-seller/    Mainnet seller (chain 56) — THIS DIR, preparation only
```

Anti-contamination rules (enforced by code review + the readiness harness):

- Separate image: the mainnet Dockerfile pins `NETWORK=bnb-mainnet` and must
  refuse any other value at startup (same pattern as the testnet gate).
- Separate keystore volume (`/root/.bnbagent-mainnet`, different host path);
  separate agent-data directory.
- Separate agent: a NEW Mainnet ERC-8004 registration (on-chain, user
  authorized) — Agent 1906 is chain-97 and can never be reused.
- Shared code only through version-pinned packages (`@bnbagent/sdk`,
  `@altananetwork/sdk`, viem); chain selection must flow through the
  `mainnet-config.ts` table in this directory, never through shared mutable
  config. Nothing in `packages/*` or `apps/*` is modified by this design.
- A mainnet process must never read/write: chain-97 RPC, testnet registry,
  testnet Commerce/Router/Policy/$U, Agent 1906, or testnet jobs — and the
  testnet seller must never read/write the mainnet equivalents. The readiness
  harness asserts both tables are disjoint.

## Part F — Chain-aware hire config (status, unchanged by this milestone)

- Chain 97: fully resolvable today (`USER_HIRE_CHAIN_ID=97`,
  `HIRED_CHAIN_ID=97`, `assertErc8183TestnetChainOnly`,
  `ALTANA_NETWORK` default `bnb-testnet`, pinned testnet table).
- Chain 56: resolvable ONLY via `mainnet-config.ts` in this directory (data
  only — no execution path consumes it). `Mainnet ERC-8183 is not wired`
  remains the app-wide truth until a future authorized milestone.
- Buyer wallet stack is chain-agnostic EIP-1193; the _application_ pins chain
  97 (`USER_HIRE_CHAIN_ID`, quote gate, X.224 switch to `0x61`, auth SIWE on
  97). Mainnet stays behind `MAINNET_HIRE_ENABLED=false`.

## Part G — Hard gates (all must pass before ANY mainnet transaction)

- G1 agent identity exists (Mainnet ERC-8004 registration for the seller's agent)
- G2 agent owner == seller signer (EIP-712 recovery on a live quote)
- G3 seller endpoint reachable (`GET /health` = 200)
- G4 seller reports chain 56
- G5 provider_sig recovers to owner
- G6 negotiation Commerce == `0xEa4DAa31…EBA6`
- G7 negotiation chain == 56
- G8 buyer wallet chain == 56
- G9 buyer holds sufficient Mainnet $U
- G10 buyer holds sufficient BNB gas
- G11 `MAINNET_HIRE_ENABLED=true` explicitly set

If ANY gate fails: NO TRANSACTION. (Current state: G1–G11 all fail/pending —
the readiness harness asserts exactly this.)

## Part K — Minimum safe path to first Mainnet hire (not executed)

1. User provisions a durable mainnet host (separate from the testnet seller host).
2. User funds a fresh mainnet owner wallet (new keystore; BNB for gas).
3. **ON-CHAIN, USER-AUTHORIZED:** register the Mainnet ERC-8004 agent from the
   owner wallet; set its AgentEndpoint to the mainnet seller root.
4. Deploy `v2-mainnet-seller` (clone of v2-seller wired to `mainnet-config.ts`)
   with `MAINNET_HIRE_ENABLED=true`, keystore mounted, URL set; verify
   `/health` + a live negotiated quote recovering to the owner.
5. Buyer preflight on mainnet (chain 56, real $U balance + allowance path,
   BNB gas), then a single authorized hire; verify receipt → fulfillment →
   settlement exactly as on testnet.
6. Only then consider enabling any in-app Mainnet hire UI (separate milestone).

## Safety

Transactions: 0 · Signatures: 0 · No deployment · No registration ·
Keystore untouched · Agent 1906 untouched · Testnet seller untouched ·
`HIRED_CHAIN_ID` stays 97 · No secrets in this directory.
