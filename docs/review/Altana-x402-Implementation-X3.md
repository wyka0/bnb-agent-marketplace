# Altana x402 - Phase X.3 Implementation (Marketplace Service Integration)

**Phase:** X.3 - a clean server-side marketplace payment/service boundary that resolves agent identity, derives an x402 payment requirement from configured/verified sell-side config only, and normalizes payment + execution states. No Hire activation, no payment UI, no live payment, no agent/skill/job execution.
**Status:** COMPLETE - `ALTANA X402 X.3 STATUS: READY FOR X.4`
**Date:** 2026-08-10
**Builds on:** X.1 (buyer adapter + seller boundary), X.2 (keyless in-process merchant + failure harness).
**Validated against:** `@altananetwork/x402-server@0.2.0` (`HandleResult`, `MerchantConfig`, `PaymentReceipt`), `@altananetwork/sdk@0.7.0` (`encodeXPaymentHeader`, `X402PaymentPayload`), viem `2.55.11`, `@bnb-marketplace/config` `Agent` type.
**Tag legend:** IMPLEMENTED = shipped in this phase - VERIFIED = proven by an offline/regression check - BLOCKED = intentionally not done, with reason - NOT IMPLEMENTED = out of X.3 scope.

---

## 1. Marketplace Service Architecture [IMPLEMENTED, VERIFIED]

The marketplace service is a thin, server-side orchestration layer over the existing rail adapters. It never merges them:

```
                 MARKETPLACE SERVICE
                         |
          +--------------+--------------+
          v              v              v
       8004scan        x402         ERC-8183
       identity       payment       job/escrow
      (resolveAgent)  (verifier)    (independent)
          |              |              |
          +--------------+--------------+
                         v
                  Altana Agent  (execution NOT implemented in X.3)
```

- `x402` = payment rail (reused via an injected `MarketplacePaymentVerifier`, never re-implemented).
- `ERC-8183` = job/escrow rail (untouched; never called from the service).
- `8004scan`/config = registry/identity (reached only through an injected `MarketplaceAgentResolver`).
- Altana skills = capabilities/execution (untouched; never executed).

The service answers exactly the six mandated questions: WHAT service (agent slug identity) - WHO agent (resolved `MarketplaceAgent`) - WHAT cost (`MarketplacePaymentRequirement`) - WHAT rail (eip3009/$U on chain 97) - WAS payment verified (`MarketplacePaymentStatus`) - WHAT result (explicit `not-implemented` execution boundary).

Entry point: `createAltanaMarketplaceService(options)` returning `{ providerName, describe, requestService }`.

---

## 2. Files Changed [IMPLEMENTED]

| File                                                      | Change                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/integrations/src/altana/marketplace.ts`         | Core marketplace service abstraction (types, requirement builder, verdict normalizer, service factory, error classes). Pre-existing; reviewed and kept.                                                                                                                |
| `packages/integrations/src/altana/marketplace.testnet.ts` | Deterministic TEST FIXTURE service + fixture agent registry + keyless verifier wiring. **Fixed:** `merchant: null` now selects the genuinely-unconfigured state (previously `undefined` collapsed to the default config, so the `unconfigured` state was unreachable). |
| `packages/integrations/src/altana/marketplace.verify.ts`  | 10-check verification harness. **Fixed:** check 9 passed `amount` as a `string` to a `PaymentReceipt` requiring `bigint` (`BigInt(requirement.amount)`); check 2 now constructs the unconfigured service with `merchant: null`.                                        |
| `packages/integrations/src/altana/index.ts`               | Already re-exports `./marketplace.js` (public surface); testnet fixture + verify runner remain runner-only (not exported).                                                                                                                                             |
| `packages/integrations/package.json`                      | Already registers `altana:x402:marketplace:verify`.                                                                                                                                                                                                                    |
| `docs/review/Altana-x402-Implementation-X3.md`            | This document (new).                                                                                                                                                                                                                                                   |

No UI files, no `erc8183.ts`, no `skills.ts`, no `client.ts`, no config/env files were modified.

---

## 3. Agent Identity Boundary [IMPLEMENTED, VERIFIED]

`MarketplaceAgent` is `Pick<Agent, "slug" | "name" | "category" | "chains" | "partner" | "updatedAt">` - the exact existing identity fields, nothing invented. Lookup is delegated to an injected `MarketplaceAgentResolver = (slug) => MarketplaceAgent | undefined`, so live registries (8004scan/config) stay outside this package.

- Unknown slug -> `AltanaMarketplaceAgentNotFoundError` (typed not-found; never a fabricated agent). VERIFIED by check 1.
- Fixture agents are explicitly labeled `TEST FIXTURE / NOT LIVE MARKETPLACE DATA` in their `name`. VERIFIED by check 1.

---

## 4. x402 Boundary [IMPLEMENTED, VERIFIED]

The service performs NO challenge generation, NO 402 parsing, NO signature verification, NO Permit2 logic, NO facilitator/settlement logic. It reuses the existing adapter two ways:

1. **Requirement** - `buildMarketplacePaymentRequirement(merchant)` runs the existing `validateX402MerchantConfig` gate, then reads only fields present in the validated `MerchantConfig` (rail token/symbol, `payTo`, `price`, `resource`, `maxTimeoutSeconds`). Network is pinned through the existing `ALTANA_X402_*` constants. No token address, facilitator URL, merchant address, price, or network is invented (section 4 of the spec).
2. **Verification** - an injected `MarketplacePaymentVerifier` performs the real server-side check. The fixture wiring (`createMarketplaceTestnetVerifier`) drives the X.2 keyless merchant's `requirePayment` and maps the official `HandleResult` via `marketplaceVerdictFromX402Handle`.

```
MarketplaceService -> MarketplacePaymentVerifier -> X.2 keyless merchant.requirePayment -> official x402 SDK
```

VERIFIED by checks 3, 4, 9.

---

## 5. Payment States [IMPLEMENTED, VERIFIED]

`MarketplacePaymentStatus` union: `unconfigured | payment-required | payment-pending | payment-verified | payment-rejected | payment-expired | payment-invalid | service-complete | service-failed`.

Honesty rules encoded:

- `payment-verified` is reachable ONLY through a verifier `{ ok: true }` verdict (real server-side crypto). VERIFIED by check 5.
- Missing sell-side config -> `unconfigured` with an explicit "nothing substituted" reason. VERIFIED by check 2.
- Configured merchant -> `payment-required` requirement. VERIFIED by check 3.
- Forged/undecodable header -> `payment-rejected`/`payment-invalid`, never verified. VERIFIED by check 4.
- Wrong-chain header -> `payment-invalid`. VERIFIED by check 8.
- `marketplaceVerdictFromX402Handle` classifies the official reason strings (`invalid X-PAYMENT` -> invalid, `wrong chain` -> wrong-chain, `validBefore`/`validAfter` -> expired, else rejected).

---

## 6. Service Execution Boundary [IMPLEMENTED, VERIFIED]

The service does NOT run agents. Every `describe`/`requestService` response carries `service: { status: "not-implemented", detail: ALTANA_MARKETPLACE_EXECUTION_BOUNDARY }`. No fabricated agent result, no fabricated transaction hash (the serialized response is asserted free of `serviceResult` / `txHash`). VERIFIED by check 6.

```
payment verified -> [service execution boundary: not-implemented] -> (future) agent execution
```

---

## 7. ERC-8183 Relationship [NOT IMPLEMENTED - by design]

`erc8183.ts` is untouched. The marketplace service never calls `hireErc8183Agent`, `settle`, `dispute`, or `claim/refund`. The x402 payment rail and the ERC-8183 job/escrow rail remain independent surfaces; their future composition is a later phase.

---

## 8. Skills Relationship [NOT IMPLEMENTED - by design]

`skills.ts` is untouched. No skill (Aave, Venus, PancakeSwap, Lista, Token Radar, Copy Trade) is executed. The request type could carry a capability identifier as metadata, but the service never executes it, and unknown skill IDs remain rejected by the existing skills registry (unchanged).

---

## 9. Server / Client Boundary [IMPLEMENTED, VERIFIED]

- Verification is server-side only (the injected verifier runs in the service).
- Client claims (`paid`, `paymentVerified`, `transactionHash`) exist in `MarketplaceServiceRequest.clientClaims` solely to prove they are IGNORED - they never influence status. VERIFIED by check 7 (a forged header embedding `paid:true`/`paymentVerified:true`/`transactionHash` is still rejected; a server `ok` verdict wins even when client claims say `false`).
- No `NEXT_PUBLIC_X402_*`, `NEXT_PUBLIC_FACILITATOR_*`, or `NEXT_PUBLIC_PRIVATE_KEY`. No `process.env` reads in the service modules. No browser-only imports (viem type imports only).

---

## 10. API / Route Decision [IMPLEMENTED]

Decision: **server-only module**, no HTTP route/handler/server action created. The marketplace service is a headless, injectable module (`createAltanaMarketplaceService`) that the future Hire flow can call server-side. No public endpoint was created merely to exist (section 12 of the spec). If a route becomes necessary in a later phase it will be minimal and server-only.

---

## 11. Security Validation [VERIFIED]

Scanned `marketplace.ts`, `marketplace.testnet.ts`, `marketplace.verify.ts` for: `PRIVATE_KEY`, `PRIVATEKEY`, `MNEMONIC`, `SEED_PHRASE`, `WALLET_PRIVATE_KEY`, `ALTANA_PRIVATE_KEY`, `X402_PRIVATE_KEY`, `FACILITATOR_KEY`, `FACILITATOR_SECRET`, `X402_API_KEY`, `8004SCAN_API_KEY`, `NEXT_PUBLIC_X402`, `NEXT_PUBLIC_8004SCAN`, `Bearer`, `Authorization`.

Findings (all benign):

- `marketplace.ts:239` - the word "authorization" in a doc comment ("X-PAYMENT authorization header").
- `marketplace.testnet.ts` - clean.
- `marketplace.verify.ts` - the EIP-3009 protocol `authorization` object field; and a hardcoded list `["PRIVATE_KEY", "FACILITATOR_KEY", ...]` used only to ASSERT those env vars are UNSET.

No secret values, no hardcoded keys, no `NEXT_PUBLIC_*`, no `process.env` reads in the service. Payment verification is server-side; client claims ignored; wrong chain rejected; malformed payment rejected; no payment bypass exists. VERIFIED.

---

## 12. Tests [VERIFIED]

Runner `altana:x402:marketplace:verify` (`node dist/altana/marketplace.verify.js`), 10 offline checks, all green:

1. unknown slug -> typed not-found; identity reused from registry (no fabrication)
2. missing sell-side config -> configuration-blocked (`unconfigured`), no substituted values
3. requirement generated from configured/verified values only (chain 97/eip3009/$U/payTo/price/resource)
4. forged/invalid X-PAYMENT -> rejected (never `payment-verified`)
5. server-side verified verdict -> `payment-verified` (live signature still BLOCKED - no signer)
6. execution boundary = `not-implemented`; no fabricated result / tx hash
7. `paid`/`paymentVerified`/`transactionHash` claims ignored - only the server verifier decides
8. mainnet refused (network error) + wrong-chain header -> `payment-invalid`; no cross-chain payment
9. offline reuse of the keyless x402 gate (forged rejected; genuine receipt normalizes)
10. no env credentials read, printed, or persisted by the verify path

Regression (all green): `pnpm lint`, `pnpm typecheck`, `pnpm build` (web build unchanged, 18 routes), then `altana:verify`, `altana:erc8183:verify`, `altana:skills:verify`, `altana:x402:verify`, `altana:x402:testnet:verify` (16 checks), `altana:x402:marketplace:verify` (10 checks).

---

## 13. Live-Payment Status [BLOCKED]

No live x402 payment was submitted. No private key was requested or generated. No funded wallet was used. Reaching a genuine `payment-verified` from a real signed authorization still requires an externally supplied funded BNB Testnet wallet - the same X.2 blocker, which remains acceptable for X.3. The service's acceptance state machine is proven deterministically with a clearly-labeled TEST FIXTURE verified verdict; the keyless x402 gate rejects every forged fixture.

---

## 14. Remaining X.4 Requirements [NOT IMPLEMENTED]

X.4 (delivery integration) would require, and X.3 deliberately does not do:

1. An operator-supplied facilitator EOA (gas-only settler, env `FACILITATOR_KEY`) and a real `payTo` account.
2. An externally supplied funded BNB Testnet signer/session to produce a genuine signed authorization (unblocks live `payment-verified`).
3. A minimal server-only route/handler or worker wrapper that invokes `createAltanaMarketplaceService` (only if the Hire flow needs HTTP transport).
4. The x402 <-> ERC-8183 composition (payment verified -> job funded) - keeping the two rails independent at the module level.
5. Actual agent execution wiring behind the `not-implemented` boundary (still gated by frozen-UI and no-live-payment constraints until explicitly unfrozen).

---

## Constraints Honored

Frozen UI untouched (`agents/`, `marketplace/`, `compare/`, `leaderboards/`); Hire not activated; no payment UI; no payment submitted; ERC-8183 and skills independent and unexecuted; no mainnet; no credentials added; no git init/commit/push. X.3 is an integration foundation only - no product claims that users can hire agents, that payments are live, or that agents execute paid services.
