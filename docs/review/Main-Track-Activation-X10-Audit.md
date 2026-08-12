# Main Track Activation X.10: Existing Infrastructure Audit

**Date:** 2026-08-12
**Phase:** 1 only; written before X.10 implementation
**Safety:** read-only repository, SDK export, and environment-presence audit

## 1. Audit Result

The repository has a verified chain-97 **client/job action builder**, x402
requirement/review infrastructure, and an immutable consent boundary. It does
not contain a seller contract, seller deployment artifact, seller registration
adapter, or an implemented paid service executor.

The installed `@altananetwork/sdk@0.7.0` exposes ERC-8183 client operations
(`buildHireCalls`, `hireErc8183Agent`, job reads, settlement) but no seller
deployment or ERC-8004 agent-registration operation. The ERC-8183 provider is
an address supplied when the client creates a job; the existing architecture
does not establish that a separate seller contract is required or deployable.

Implementation must not begin until the missing seller identity/registration
contract and real price source are established. Treating a locally declared
object or API route as a deployed ERC-8004 agent would be fabricated success.

## 2. Verified Chain-97 Infrastructure

The SDK `erc8183Addresses(97)` table and repository guards agree on this one
contract set:

| Component          | Verified chain-97 address                    |
| ------------------ | -------------------------------------------- |
| AgenticCommerce    | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| Router             | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` |
| Policy             | `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6` |
| ERC-8004 registry  | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Payment token `$U` | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` |

- Network preset: SDK `BNB_TESTNET`, chain ID `97`.
- `$U`: United Stables, 18 decimals, EIP-3009 rail.
- Mainnet chain `56` is rejected by both ERC-8183 and x402 guards.
- The adapter obtains addresses from the installed SDK table; it does not
  duplicate the table for transaction construction.

## 3. ERC-8183 Contracts and Lifecycle

Existing adapter:
`packages/integrations/src/altana/erc8183.ts`.

Implemented, testnet-gated surfaces:

- `getErc8183Addresses` and `resolveErc8183Config`;
- `prepareErc8183Hire`;
- `getErc8183Job`;
- deliverable parsing/read;
- settlement-state derivation;
- refund-call construction.

`prepareErc8183Hire(BNB_TESTNET, input)` validates and builds the SDK's five
ordered calls:

1. `createJob` on Commerce;
2. `registerJob` on Router;
3. `setBudget` on Commerce;
4. `$U.approve` to Commerce;
5. `fund` on Commerce.

Its required real inputs are provider address, description, positive raw `$U`
budget, future expiry, and predicted `jobCounter() + 1`. The current adapter has
no `jobCounter` reader and no race-safe live submission loop. Signing and
submission are intentionally absent and always stop at
`assertErc8183SigningBoundary`.

The SDK also exports `hireErc8183Agent` and `settleErc8183Job`, but the project
does not wire either into application code. Those are client/job lifecycle
operations, not evidence of a seller deployment primitive.

## 4. Existing Seller and Service Abstractions

Existing service abstraction:
`packages/integrations/src/altana/marketplace.ts`.

- `createAltanaMarketplaceService` resolves identity and derives a payment
  requirement from a validated `MerchantConfig`.
- `describe` can return a real configured x402 requirement.
- `requestService` validates network and delegates payment verification.
- Its execution state is deliberately always `not-implemented`/`pending`.
- `ALTANA_MARKETPLACE_EXECUTION_BOUNDARY` explicitly says no agent run,
  ERC-8183 job, or skill execution was started.

The only concrete marketplace agents and prices elsewhere are clearly marked
test fixtures in `marketplace.testnet.ts`; they are prohibited for X.10.

There is no existing deterministic portfolio-risk service implementation, no
production seller metadata store, no service-price environment variable, and
no service endpoint for an operator-owned agent.

## 5. x402 Infrastructure

Existing x402 components provide:

- chain-97-only network validation;
- verified `$U` EIP-3009 merchant configuration validation;
- payment requirement normalization;
- server-side payment-verifier dependency;
- explicit facilitator/signing boundaries;
- fixture and mainnet rejection.

Secure environment presence at audit time:

| Requirement                                       | Presence                        |
| ------------------------------------------------- | ------------------------------- |
| testnet signer (`ALTANA_TESTNET_PRIVATE_KEY`)     | present                         |
| merchant recipient (`ALTANA_PAYTO`)               | present                         |
| facilitator credential (`FACILITATOR_KEY`)        | present                         |
| public facilitator (`ALTANA_FACILITATOR_ADDRESS`) | missing                         |
| public operator (`ALTANA_OPERATOR_ADDRESS`)       | missing                         |
| RPC override (`ALTANA_RPC_URL`)                   | missing; SDK public RPC applies |

No credential value was printed, persisted, or exposed. Presence does not prove
key validity, address ownership, pairwise distinctness, chain, gas, or token
balance; those require separate read-only validation.

No x402 payment is required to build an ERC-8183 hire review, and X.10 must not
perform a service payment.

## 6. X.6 Activation Pipeline

Existing server path:

```text
POST /api/activation/hire
  -> exact identity from live 8004scan GET /agents
  -> resolveAgentActivationCapability
  -> classifyAgentActivation
  -> createAltanaMarketplaceService.describe/requestService
  -> prepareErc8183Hire
  -> canonical five-call binding
  -> buildX402LiveReview
  -> pinX402Consent
```

Important constraints:

- `resolveAgentActivationCapability` currently always returns `null`.
- The route accepts only an exact agent identity returned by 8004scan.
- An X.10 seller cannot become activatable merely by adding a local capability
  constant; its real registry identity must first exist and resolve.
- `AgentActivationCapability` requires real amount, expiry, predicted job ID,
  and resource URL.
- `buildHireReviewFromCapability` derives provider from the registry record's
  `owner_address`.
- The current route requires three pairwise-distinct public addresses:
  payTo, facilitator, and operator.
- The marketplace payment guard only rejects; payment verification and service
  execution are intentionally unreachable.

## 7. X.4B and X.4C

`buildX402LiveReview` enforces:

- chain `97`;
- verified `$U`;
- positive exact amount;
- configured, non-fixture payTo;
- destination in the verified ERC-8183 allowlist;
- non-fixture calldata;
- positive job ID;
- pairwise-distinct payTo/facilitator/operator.

The reviewed ERC-8183 hire calldata is a canonical binding of the real SDK
`Call[]`; it is not itself single-contract executable calldata. Every decoded
call is separately allowlisted before review.

`pinX402Consent` binds chain, token, amount, payTo, destination, and calldata.
`verifyX402Consent` invalidates consent when those values change. Neither signs
nor broadcasts.

## 8. Deployment Surface Audit

Repository search found:

- no Solidity source;
- no Foundry/Hardhat deployment project;
- no seller bytecode or constructor arguments;
- no seller ABI;
- no seller deployment script;
- no ERC-8004 registration adapter;
- no documented transaction for registering agent metadata;
- no configured real service price.

Installed SDK exports include client creation, x402 signing, ERC-8183 hire/read/
settle, and the address table. They do **not** include a seller deployment or
agent-registration function.

Therefore “deploy the minimum seller component” is not yet a defined operation.
The verified ERC-8183 contracts should be reused, but they do not by themselves
create a discoverable marketplace agent identity.

## 9. Audit Decision

Implementation is gated on all of the following independently verified inputs:

1. the authoritative ERC-8004 registry ABI and exact chain-97 registration
   method, or an already registered operator-owned identity;
2. the seller model: provider EOA versus a required seller contract, with exact
   source/ABI/constructor if a contract is required;
3. an explicitly configured real service price in raw `$U` units;
4. an implemented deterministic service contract and public service endpoint;
5. a live read of `jobCounter()` for action construction;
6. valid public operator/facilitator addresses derived from configured testnet
   credentials and satisfying the current distinctness rule;
7. chain-97 RPC, bytecode, signer gas, and payTo checks.

Until items 1-3 are established, writing implementation code would require
inventing identity, deployment behavior, or price, which X.10 explicitly
forbids.

```text
PHASE 1 AUDIT: COMPLETE
IMPLEMENTATION AUTHORIZED BY EVIDENCE: NO
EXACT PRE-IMPLEMENTATION BLOCKER: The repository and installed SDK contain no
authoritative seller/agent registration or deployment mechanism, and no real
service price is configured, so a deployable discoverable seller cannot yet be
built without inventing required identity, contract, or pricing inputs.
```
