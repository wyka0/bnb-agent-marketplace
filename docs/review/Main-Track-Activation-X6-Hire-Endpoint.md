# Main Track Activation — X.6: Real Marketplace Hire/Activation Endpoint

**Date:** 2026-08-12
**Preceding:** `Main-Track-Activation-X5-Real-Action-Diagnostic.md` (blocker A: no real agent action endpoint existed; NEXT ACTION: build the hire/activation endpoint).

---

## X.6 STATUS

```
HIRE ENDPOINT:          IMPLEMENTED  (POST /api/activation/hire; capability-derived hireable UI)
REAL AGENT RESOLUTION:  PASS         (exact identity match against live 8004scan registry rows)
REAL ACTION:            BLOCKED      (no real agent exposes an actionable endpoint today —
                                      chain 97 testnet-only activation; all 5 real agents are
                                      chain-56 mainnet; 8004scan contract carries no action/
                                      pricing metadata → capability resolver returns null)
REAL REVIEW:            READY        (ACTIVATABLE path fully verified headlessly: real $U,
                                      configured payTo, verified ERC-8183 allowlist, canonical
                                      calldata, pinned consent digest)
CONSENT:                REQUIRED     (explicit checkbox before any external signing step)
SIGNING:                NOT PERFORMED
BROADCAST:              NOT PERFORMED
PAYMENT:                NOT PERFORMED   (payment guard rejects; payment-verified unreachable)
```

No transaction was submitted, no funds moved, no mainnet code path, no production
environment reads of secrets, no deployment, no Git changes.

---

## 1. What X.6 built

### 1.1 Pure capability classifier — `apps/web/lib/activation/capability.ts`

- `ACTIVATION_CHAIN_ID = 97` (BNB testnet is the only activation chain).
- `RegistryAgentIdentity` — a strict subset of the real `GET /agents` record; the
  classifier never receives fields 8004scan does not return.
- `AgentActivationCapability { kind: "erc8183-hire"; amount; expiresAt; jobId; resourceUrl }`
  — every field mandatory and currency-valued; nothing has a default.
- `resolveAgentActivationCapability(record)` — the single extension point; returns
  `null` for every real record because the documented 8004scan contract exposes no
  action/pricing metadata. It fabricates nothing.
- `classifyAgentActivation(record[, capability])` →
  - `chainId !== 97` → `NOT_ACTIVATABLE / unsupported-chain`;
  - chain 97 + no capability → `CAPABILITY_UNKNOWN / no-actionable-capability`;
  - chain 97 + real capability → `ACTIVATABLE`.

### 1.2 Hire/activation pipeline — `apps/web/lib/activation/hire.server.ts` (server-only, plain-node runnable)

- **Identity resolution:** `parseHireRequest`, `isValidAgentIdentity`
  (`^\d+:0x[0-9a-fA-F]{40}:\d+$`), `findAgentByIdentity` (exact full-string match,
  no partial/neighbor matches), `fetchAgentRows` (bound `listAgents({limit:100})`).
- **Configuration:** `hireActivationConfigFromEnv` reads ONLY the three public
  addresses `ALTANA_PAYTO` / `ALTANA_FACILITATOR_ADDRESS` / `ALTANA_OPERATOR_ADDRESS`
  (presence-based). Every value must be a non-fixture address-shaped string and the
  three must be pairwise distinct. No secret is ever read.
- **Marketplace wiring (production call sites of the existing verified contracts):**
  `recordToMarketplaceAgent` (category comes exclusively from verified platform data;
  absent → typed not-found), `buildHireMerchantConfig` (chain 97, exact capability
  price, $U/eip3009 rail, validated with `validateX402MerchantConfig`),
  `hireMarketplaceQuote` → `createAltanaMarketplaceService` with the REAL merchant
  config and a payment guard that can only reject (`payment-verified` stays
  unreachable), `describe` + `requestService` execute the full
  identity → network → payment flow.
- **Live review build (the REAL action path):**
  `prepareErc8183Hire` (SDK `BNB_TESTNET`, real provider from `owner_address`, real
  description, exact budget, predicted `jobId`) → per-call allowlist gate against the
  verified chain-97 ERC-8183 contracts (commerce/router/policy/registry/paymentToken)
  → canonical calldata binding (`encodeErc8183HireCalldata`:
  `[to(20B lowercase)|dataLen(4B BE)|data]*` + `decodeErc8183HireCalldata`) →
  `buildX402LiveReview({ kind: "erc8183-hire", … })` (fixture calldata, fixture
  addresses and payTo mismatch all refused) → `pinX402Consent` (digest binds
  chain/token/amount/payTo/destination/calldata).
- `runHireActivation(record, { env, category?, capability? })` → discriminated
  `HireActivationOutcome`: classifier rejection | `ACTIVATABLE` blocked
  (`configuration` / `capability` / `review` stages with honest reasons) |
  `ACTIVATABLE` available `{ reviewJson, consent(PINNED), quote }`.

### 1.3 Endpoint — `apps/web/app/api/activation/hire/route.ts`

`POST` with body ≤ 4096 bytes → `400 bad-request` (parse / identity format) →
`502 data-source-unavailable` (registry fetch failure) → `404 agent-not-found`
(exact identity absent) → 200 with the honest outcome; always `Cache-Control:
no-store`, `force-dynamic`.

### 1.4 UI — capability-derived, never fabricated

- `apps/web/lib/eight004scan/card.ts`: `hireable` is now derived from
  `classifyAgentActivation({ chainId, isTestnet }).state === "ACTIVATABLE"` (the
  hard-coded `false` is gone).
- `apps/web/app/(app)/agents/[slug]/hire-review-panel.tsx` — client panel with three
  honest states: `Unavailable on this network` (NOT_ACTIVATABLE), `Activation
pending` (CAPABILITY_UNKNOWN), enabled `Hire` (ACTIVATABLE) → POSTs the endpoint →
  renders the immutable review (State/Chain/Network/Token/Amount/payTo/Destination/
  Action/Facilitator/Operator/calldata digest) + explicit consent checkbox with
  "Signing and broadcast are NOT performed by this app".
- `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx` renders the panel when the
  registry agent resolved; otherwise the disabled "Soon" fallback remains.
- `.env.example` gains `ALTANA_FACILITATOR_ADDRESS=` and `ALTANA_OPERATOR_ADDRESS=`
  placeholders.

### 1.5 Support changes

- `packages/integrations/src/altana/index.ts` re-exports `./x402.review.js` (the X.4B/
  X.4C review/consent surface was previously internal-only).
- `apps/web/package.json`: new workspace dep `@bnb-marketplace/integrations`
  (the integrations package's first production consumer), `@altananetwork/sdk@0.7.0`
  (same pinned version the verified e2e harness uses), script
  `activation:hire:verify`.

## 2. Verification — `apps/web/lib/activation/hire.verify.ts` (offline, TEST FIXTURES only)

```
X.6 hire endpoint verify: 23/23 checks passed
SIGNING: NOT PERFORMED   BROADCAST: NOT PERFORMED   PAYMENT: NOT PERFORMED
```

Coverage: exact identity resolution + neighbor/unknown rejection · identity format
boundary · mainnet (chain 56) NOT_ACTIVATABLE · chain-97-without-capability
CAPABILITY_UNKNOWN · ACTIVATABLE traversal · LIVE real action string
(`erc8183-hire (LIVE/REAL action, job 9000000000000000002)`) · fixture calldata
refused by endpoint AND by `buildX402LiveReview` ("fixture calldata") · chain-97
enforcement in the review builder · $U enforcement · payTo enforcement (missing
facilitator/operator block configuration; review payTo = configured payTo) ·
destination = verified commerce + every decoded batch target allowlisted · exact
amount preservation · canonical calldata round-trip + pinned keccak digest (0x…66) ·
consent digest verifies / single-unit amount change invalidates it · secret scan
(privateKey/secret/credential/mnemonic/FACILITATOR_KEY/API_KEY/ALTANA_TESTNET/
X-PAYMENT absent from responses) · no sign/broadcast/settle/transfer/execute exports;
only `createHirePaymentGuard` is pay-related and it always rejects · no txHash or
signature in the output.

## 3. Real-agent resolution (live, read-only)

The five live registry agents were resolved through the endpoint logic:

```
56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:264554 | AlphaBeta.agent        | NOT_ACTIVATABLE | unsupported-chain
56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:264555 | Bond_Theta.agent       | NOT_ACTIVATABLE | unsupported-chain
56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:264556 | Echo-Pro.agent         | NOT_ACTIVATABLE | unsupported-chain
56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:264557 | Phoenix_Wire-ify.agent | NOT_ACTIVATABLE | unsupported-chain
56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:264558 | Micro_Build-Trust.agent| NOT_ACTIVATABLE | unsupported-chain
```

All five classify honestly `NOT_ACTIVATABLE / unsupported-chain` — mainnet is never
used for activation, and no registry record exposes an actionable capability. The
endpoint therefore returns typed blocked outcomes for every real agent; the
ACTIVATABLE path is proven with clearly-labeled TEST FIXTURE data that the
production route can never serve (it resolves real 8004scan rows only).

## 4. Regression

| Suite                        | Result                                                               |
| ---------------------------- | -------------------------------------------------------------------- |
| integrations P14 (clean env) | 19 passed, 0 failed — transaction submitted: NONE, funds moved: NONE |
| ERC-8183                     | PASS                                                                 |
| X.2 (clean env)              | 16 checks passed                                                     |
| X.3 (clean env)              | 10 checks passed                                                     |
| X.4A e2e (credentials)       | 8 offline checks passed; live payment BLOCKED (expected, exit 0)     |
| X.4B review                  | 16/16                                                                |
| X.4C consent                 | 11/11                                                                |
| P14e operator (credentials)  | 11/11                                                                |
| web P12 activation           | 33 passed, 0 failed                                                  |
| web P13 review               | 20 passed, 0 failed                                                  |
| marketplace:verify           | 83 checks passed                                                     |
| marketplace:live:verify      | 14 checks passed (anonymous tier)                                    |
| discovery:verify             | 59 checks passed                                                     |
| typecheck                    | 12/12                                                                |
| lint                         | 12/12                                                                |
| build                        | 7/7                                                                  |

## 5. Next actions (for a subsequent phase)

1. A verified platform capability source must exist before any real agent can be
   ACTIVATABLE: plug it in at `resolveAgentActivationCapability` (single extension
   point) — real pricing/action metadata only, never fabricated.
2. When a chain-97 registry agent with real metadata appears, deploy the endpoint
   (configure three distinct public addresses in `ALTANA_PAYTO` /
   `ALTANA_FACILITATOR_ADDRESS` / `ALTANA_OPERATOR_ADDRESS`; note the current
   operator EOA equals payTo, which the distinctness check would reject).
3. Signing/broadcast remain out of scope by design: explicit consent is required
   first; this app stops after consent.
