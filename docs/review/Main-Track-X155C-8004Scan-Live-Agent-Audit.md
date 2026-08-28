# X.155C 8004scan Live-Agent Endpoint Audit

**Mode:** READ-ONLY. **STOPPED all hosting work.** ZERO blockchain transactions, zero AgentEndpoint updates, zero new wallets, zero seller deployment, zero AWS/KMS, zero ERC-8183 jobs, zero broadcasts.

**Git boundary:** `HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` (unchanged).

---

## Headline finding

**The marketplace can hire existing live BNB Agent Studio / ERC-8183 sellers directly — NO seller hosting is required.** 8004scan already lists multiple chain-97 agents whose on-chain agent cards point to **live HTTPS seller services** that run a real ERC-8183 `/negotiate` flow, and every provider signature **verifies** with the official SDK to the agent's registered owner. Our own seller (Agent 1906) is dead, but it is not needed to demonstrate a real hire.

## PART 1 — Real agents discovered (read-only, chain 97 / BSC Testnet)

| Agent | Name                          | Owner (signer)    | Registered AgentEndpoint                                |
| ----- | ----------------------------- | ----------------- | ------------------------------------------------------- |
| 2005  | Canned Range Keeper           | `0x0eac2f4d…ad5a` | `https://range-keeper.103-195-188-198.sslip.io/erc8183` |
| 2003  | Canned Health Guard           | `0xd885bd3e…1d7`  | `https://health-guard.103-195-188-198.sslip.io/erc8183` |
| 2001  | AgentCensus Yield Scanner     | `0xd7c8e494…949`  | `https://agentcensus.xyz/erc8183y`                      |
| 2000  | AgentCensus Rebalance Planner | `0xc08cef73…256`  | `https://agentcensus.xyz/erc8183r`                      |

Registry: chain 97 `0x8004A818…` (official). All four are indexed by 8004scan and resolve through the marketplace after X.154.

## PART 2 — Endpoint health (read-only GET)

- 2005 `/health` → 200 `{ok:true, origin:"CANNED_REFERENCE", network:"bsc-testnet", chainId:97, endpointAlive:true}`.
- 2003 `/health` → 200 (same canned reference, chain 97, endpointAlive).
- 2001 `/health` → 200 `{status:"ok", service:"ERC-8183 Agent"}`.
- 2000 `/health` → 200 `{status:"ok", service:"ERC-8183 Agent"}`.
- `/.well-known/agent-card.json` → 404 on the canned endpoints (the registered card IS the on-chain agent card; the live services expose `/health` + `/negotiate` at the registered prefix).

## PART 3 — ERC-8183 compatibility (verified via the official SDK)

`POST /negotiate` on all four returns `accepted:true`, `chain_id:97`, `verifying_contract:0xa206c0517…` (official chain-97 commerce), `currency:0xc70B8741…` (official $U), `negotiation_hash`, and `provider_sig`. `verifyQuoteSignature` (official SDK, read-only) for each:

| Agent | valid | method | signer            | == owner | price (U)      |
| ----- | ----- | ------ | ----------------- | -------- | -------------- |
| 2005  | true  | eip191 | `0x0eAc2F4d…AD5a` | ✓        | `0.001` (1e15) |
| 2003  | true  | eip191 | `0xD885bd3E…F1D7` | ✓        | `0.001` (1e15) |
| 2001  | true  | eip191 | `0xd7c8e494…949`  | ✓        | `0`            |
| 2000  | true  | eip191 | `0xc08CEf73…256`  | ✓        | `0`            |

These are genuine ERC-8183 sellers: a signed quote that recovers to the agent's registered owner against the official chain-97 commerce + $U token.

## PART 4 — Agent 1906 status

Agent 1906 (chain 97, owner `0xB0f7681668f916eEd97dA066D31aA295D34727c0`) — our seller:

- Registered endpoint: `https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json` (expired tunnel).
- **Endpoint reachable? NO — DNS does not resolve** (`The remote name could not be resolved`).
- Agent Card / `/negotiate`: **unreachable** (no host).
- ERC-8183-compatible? The service code is (proven in X.125/X.130), but it is **not live** — its endpoint is dead.
- Registration not updated (per mandate).

## PART 5 — Marketplace strategy

**A / D — existing live agents can be hired directly; no seller hosting required.**

- The marketplace (after X.154) already discovers these agents, and their detail pages already render the Hire CTA (owner present → chain-97 `MainTrackHireView`).
- The one remaining wiring step is that the marketplace's `prepareUserHire` must (a) resolve the agent's **on-chain AgentEndpoint** (from its registered card) and negotiate with it, (b) use the **agent's owner as the provider**, and (c) use the **seller's real quoted price** (e.g., 0.001 U for the canned sellers, 0 for the AgentCensus sellers) instead of the currently hardcoded seller `0xB0f768…` + 1 U. That is a small, self-contained change to the discovery/negotiation wiring — not a hosting deployment.
- **C (our seller must be hosted) is NOT required** for a judgeable real-hire demonstration.

## PART 6 — Rubric

- "users need to find agents, understand what they do, and hire them in a few clicks" → satisfied for these live agents: discoverable by category (grid/rebalance/yield/health), detail pages with sourced metadata, Hire CTA present.
- "full journey works end to end: land, find an agent by category, understand what it does, activate it" → achievable end-to-end by wiring the marketplace to one of the live sellers (recommended: the canned reference sellers, which expose a deterministic negotiate/quote/providerSig flow). No VPS requirement is invented.

## PART 7 — Recommended fastest submission path

1. Keep the marketplace as-is (discovery already live).
2. Wire `prepareUserHire` to negotiate with the selected agent's **on-chain AgentEndpoint** (Agent 2005 "Canned Range Keeper" is the cleanest: live, signed, owner-verified, deterministic reference) and accept the real quoted price + provider (owner address) — no server custody, browser wallet unchanged.
3. This delivers a real, verifiable end-to-end Hire without any VPS/seller hosting.
4. Agent 1906 and its expired endpoint become optional future cleanup (re-point only if our own seller is ever hosted), not a blocker.

## Hard stop

ZERO blockchain transactions, ZERO AgentEndpoint updates, ZERO new wallets, ZERO seller deployment, ZERO AWS/KMS. All endpoint checks above were read-only HTTP/`eth_call`/signature-verification calls. Nothing was broadcast, committed, or pushed.

## Classification

**No seller hosting required — the marketplace can hire an existing live ERC-8183 seller (Agent 2005/2003/2001/2000) directly.** Agent 1906's endpoint is dead but is NOT a submission blocker; the fastest judgeable real-hire path is to wire the marketplace's `prepareUserHire` to an existing live agent's registered endpoint and real price, which is a small code change in a subsequent authorized milestone. **STOP.**
