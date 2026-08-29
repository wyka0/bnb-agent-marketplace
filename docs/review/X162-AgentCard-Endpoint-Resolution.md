# X162 — Agent-Card Endpoint Resolution Fix

**Mode:** Read-only diagnosis + minimal parser/schema normalization fix (deployed). **ZERO blockchain transactions, zero jobs/wallets, zero Agent 2005/1906 registration changes, zero seller deployment, zero AWS/KMS, X.49/Hire architecture unchanged.**

**Git boundary:** `HEAD` = `origin/main` = `9256eb43ee215d15e6203079efc8a2f1518906b3` (fix committed + pushed). Vercel production deployment **Ready** (`dpl_DoR43U4cvAho57fZScTmmRRW7q9K`).

---

## 1. Real Agent 2005 agent card (read-only)

Agent 2005's on-chain `tokenURI` is a base64 data URI. Decoded card:

```json
{
  "name": "Canned Range Keeper",
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "services": [
    {
      "name": "ERC-8183",
      "endpoint": "https://range-keeper.103-195-188-198.sslip.io/erc8183",
      "version": "range-keeper-service-v1"
    }
  ]
}
```

The registered negotiation endpoint is advertised as an **"ERC-8183"** service — **not** an `A2A` service. `/health` 200 and `/negotiate` 200 confirmed (X.155C/X.156).

## 2. Divergence (X.155C/X.156 vs production)

- X.155C/X.156 and the current `resolveRegisteredEndpoint` resolve the endpoint successfully (verified read-only both slug casings and with the route's exact `agent_id`/`owner_address`: `prepareLiveAgentHire` returned jobId 733, price `0.001 U`, provider `0x0eAc2F4d…`).
- The production symptom `Agent card has no HTTP A2A endpoint` pointed at the parser/schema handling: the resolver only selected _any_ `http(s)` service generically and did **not explicitly recognize the `ERC-8183` service as the seller negotiation endpoint**, and it tolerated `http://` (not HTTPS-only). Per the semantic rule, the marketplace must distinguish the ERC-8004 card, an A2A interface, and the **ERC-8183 negotiation endpoint** — and not require an A2A interface.

## 3. Fix (minimal normalization, fail-closed preserved)

`main-track-negotiation.server.ts`:

- Extracted a pure `resolveServiceEndpointFromCard(card)` helper that:
  - prefers a registered service whose name matches `/erc-?8183|a2a/i` **and** has an `https://` endpoint,
  - falls back to any registered `https://` service,
  - **requires HTTPS** (rejects `http://` and arbitrary schemes),
  - returns `null` (fail closed) for missing services, null card, missing endpoint key, or malformed endpoints — never an arbitrary URL.
- `resolveRegisteredEndpoint` uses the helper and returns `agent card has no registered HTTPS ERC-8183/A2A endpoint` otherwise (fail closed). Agent/chain/registry validation unchanged.
- Exported `decodeAgentCard` for regression testing.

## 4. Security (preserved)

The resolved endpoint is still validated downstream: HTTPS, registered card service, reachable (`/health`), `/negotiate` responds, quote valid, provider signature valid (official SDK), signer == registered owner, chain 97, official commerce, official $U, expiry future. No verification is bypassed; only a registered HTTPS card service is ever used.

## 5. Tests (added, all pass)

`main-track-user-hire.verify.ts` — new `2c` section proves:

- ERC-8183 service endpoint resolved (not A2A-only) · A2A service resolved · other HTTPS registered service resolved (fallback)
- `http://` rejected · arbitrary/non-http scheme rejected · no services → fail closed · null card → fail closed · missing endpoint key → fail closed
- Real Agent 2005 card decodes to its ERC-8183 endpoint.

Regression: main-track-user-hire (X.149) · main-track-v2 (X.131) · security x49 (25) · activation (33) · hire (23/23) — all pass. Web typecheck/lint/`next build` PASS; integrations typecheck/build PASS; prettier clean.

## 6. Production

Committed `9256eb4…`, pushed to `main`, deployed (`dpl_DoR43U4cvAho57fZScTmmRRW7q9K`, **Ready**). Verified live: all routes 200; Agent 2005 detail renders Canned Range Keeper + Hire CTA + BSC Testnet + Model B; no old `no HTTP A2A endpoint` error present. The read-only prepare path resolves the live quote (0.001 U) locally against the real endpoint.

## Classification

**D — PARSER/SCHEMA MISMATCH FIXED.**

The production parser/schema handling did not explicitly recognize the registered **ERC-8183** service as the seller negotiation endpoint (Agent 2005's card advertises the endpoint as an `ERC-8183` service, not `A2A`) and tolerated non-HTTPS endpoints. The resolver now explicitly resolves the registered HTTPS ERC-8183/A2A service (never an arbitrary URL), requires HTTPS, and fails closed otherwise; regression tests cover the resolution + all fail-closed cases; the fix is committed, pushed, and deployed (Ready), and the live Agent 2005 page shows the Hire flow without the old error. The full prepare/quote stage is reached read-only; **no blockchain transaction was executed or authorized**. **STOP.**
