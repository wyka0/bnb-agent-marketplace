# Main Track Activation X.11: Official Provider / Seller Architecture

**Date:** 2026-08-13
**Mode:** Read-only architecture determination
**Transactions:** None

## 1. Executive Conclusion

The official provider architecture is now sufficiently established to reject
the X.10 assumption that a new seller contract may be required.

**Minimum supported path: D — ERC-8004 identity plus an ERC-8183 provider EOA.**

- **SDK EVIDENCE:** ERC-8183 accepts `provider: Address`; the SDK contains no
  seller contract deployment requirement or seller constructor.
- **CONTRACT EVIDENCE:** Existing chain-97 job `1` is `FUNDED` and names
  `0xD8c45dA4e4036f4946132B18fc7568096CB7535f` as provider. A read-only
  `eth_getCode` returned no bytecode for that address. The deployed kernel
  therefore demonstrably accepts an EOA provider.
- **OFFICIAL DOCUMENTATION:** ERC-8004 provides the discoverable identity as an
  ERC-721 token whose `agentURI` resolves to a registration file containing
  name, description, service endpoints, active state, and registrations.
- **REPOSITORY EVIDENCE:** The marketplace Hire route requires an exact identity
  returned by 8004scan. A provider EOA alone would be hireable by ERC-8183 but
  would not satisfy this project's `find -> understand -> activate` path.

A new seller contract is not required. ERC-8004 registration is not required by
ERC-8183 itself; it is required for this marketplace's current 8004scan-backed
discovery model. The repository and
installed SDK have no registration adapter. The official ERC-8004 specification
defines registration methods, but compatibility of the deployed chain-97
registry with that draft ABI has not yet been independently verified.

Implementation is still blocked because no production service exists and no
real service price has been chosen or configured.

## 2. SDK Evidence

Installed package: `@altananetwork/sdk@0.7.0`.

### Public Locations

| API/evidence                              | Actual installed location                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ERC-8183 public types                     | `node_modules/.pnpm/@altananetwork+sdk@0.7.0_.../node_modules/@altananetwork/sdk/dist/erc8183.d.ts` |
| ERC-8183 implementation and embedded ABIs | `node_modules/.pnpm/@altananetwork+sdk@0.7.0_.../node_modules/@altananetwork/sdk/dist/erc8183.js`   |
| Package exports                           | `node_modules/.pnpm/@altananetwork+sdk@0.7.0_.../node_modules/@altananetwork/sdk/dist/index.d.ts`   |
| Package usage guide                       | `node_modules/.pnpm/@altananetwork+sdk@0.7.0_.../node_modules/@altananetwork/sdk/README.md`         |

### `buildHireCalls`

**SDK EVIDENCE** (`erc8183.d.ts:57-77`, `erc8183.js:91-103`):

```text
addresses   Erc8183Addresses
jobId       predicted jobCounter() + 1
provider    Address
description task text or anchored signed quote, <=4096 bytes
budget      raw $U units, 18 decimals
expiredAt   absolute unix seconds
```

It creates exactly five calls:

1. `AgenticCommerce.createJob(provider, router, expiredAt, description, router)`;
2. `EvaluatorRouter.registerJob(jobId, policy)`;
3. `AgenticCommerce.setBudget(jobId, budget, 0x)`;
4. `$U.approve(commerce, budget)`;
5. `AgenticCommerce.fund(jobId, budget, 0x)`.

The job ID is predicted because the later calls need it. The SDK states that a
concurrent job causes the atomic batch to revert harmlessly; callers must read
the counter again and retry.

### `hireErc8183Agent`

**SDK EVIDENCE** (`erc8183.d.ts:90-116`, `erc8183.js:164-198`):

```text
provider          Address
task              string
budget            bigint, raw $U
deadlineSeconds   optional; default 1800 beyond dispute window
```

The SDK reads `policy.disputeWindow()` and `commerce.jobCounter()`, computes the
expiry, builds the five calls, and executes them through an Altana wallet or
session. It then reads the job and verifies that `job.client` equals the buyer
wallet. The result contains job ID, provider, budget, and expiry.

This is buyer/client functionality. It does not create or configure the seller.

### Job Identity and Roles

**SDK EVIDENCE** (`erc8183.d.ts:41-55`):

```text
id, client, provider, evaluator, description, budget, expiredAt,
status, hook, submittedAt, deliverable
```

- `client` is assigned by Commerce from the caller creating the job.
- `provider` is the seller address supplied by the buyer.
- `evaluator` and `hook` are the verified Router in the SDK hire flow.
- `deliverable` is zero until submission and later carries a hash.
- The SDK has no ERC-8004 agent ID, token ID, service metadata, or provider
  registration field in the job.

### Settlement

**SDK EVIDENCE** (`erc8183.d.ts:118-131`, `erc8183.js:199-217`):

- `approve` builds `Router.settle(jobId, 0x)` after the dispute window;
- `dispute` builds `Policy.dispute(jobId)` and is client-only inside the window;
- refund builds `Commerce.claimRefund(jobId)` after expiry.

The installed SDK provides no seller-side deliverable-submission API, no seller
registration API, and no ERC-8004 registration API. Its `registerSessionKey`
export concerns Altana wallet authorization, not agent identity.

### Official ERC-8183 Specification

**OFFICIAL DOCUMENTATION** (`https://eips.ethereum.org/EIPS/eip-8183`):

- `createJob(provider, evaluator, expiredAt, description, hook)` records
  `client = msg.sender`; the executing caller is therefore the client.
- `provider` is an address role. It may be supplied at creation or initially be
  zero and later be set by the client before funding.
- No provider code/interface check or provider registration is specified.
- `setBudget` is callable by the client or provider in the standard, allowing
  price proposal/negotiation before funding.
- `fund` is client-only, requires a non-zero provider and an exact
  `expectedBudget`, and escrows the contract's payment token.
- `submit` is provider-only and moves a funded job to Submitted.
- `complete`/`reject` are evaluator actions; completion pays the provider and
  rejection/expiry refunds the client.
- ERC-8004 integration is a recommended optional identity/reputation extension;
  ERC-8183 remains the independent payment/escrow layer.

The installed chain-97 implementation used by the SDK has a more specific
Router/Policy flow and embedded ABI. Those deployed interfaces, not a newer
draft reference implementation, remain authoritative for transaction building.

## 3. Repository Evidence

### ERC-8183 Adapter

`packages/integrations/src/altana/erc8183.ts` wraps the SDK address table,
construction, job reads, deliverable reads, settlement-state derivation, and
refund construction. It intentionally has no signer or submission path.

### Activation Pipeline

`apps/web/lib/activation/hire.server.ts` implements:

```text
exact 8004scan identity
  -> capability resolution
  -> x402 requirement
  -> prepareErc8183Hire
  -> X.4B immutable review
  -> X.4C pinned consent
```

The provider is taken from the registry record's `owner_address`. The route
does not accept an arbitrary provider EOA and therefore cannot activate an
unregistered local identity.

### 8004scan Model

`apps/web/lib/eight004scan/types.ts` exposes `agent_id`, `token_id`, chain,
registry contract address, owner address, metadata, protocols, and x402 support.
It has no service price, ERC-8183 budget, calldata, or action field.

`apps/web/lib/eight004scan/client.ts` is read-only and only calls the public
8004scan API. It has no registration or metadata update operation.

### Marketplace Service

`packages/integrations/src/altana/marketplace.ts` can derive a real x402
requirement from an explicit `MerchantConfig`, but service execution is
deliberately `not-implemented`. The only existing concrete service prices and
agents are labeled test fixtures and are prohibited for live use.

## 4. Contract Evidence

The installed SDK embeds the ABIs used by this project in `dist/erc8183.js`.
The repository contains no Solidity source or separate seller ABI.

### Verified Chain-97 Deployment

| Contract          | Address                                      | Read-only result                                   |
| ----------------- | -------------------------------------------- | -------------------------------------------------- |
| AgenticCommerce   | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` | bytecode present; `jobCounter = 484`               |
| EvaluatorRouter   | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` | bytecode present                                   |
| OptimisticPolicy  | `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6` | bytecode present; `disputeWindow = 86400` seconds  |
| ERC-8004 registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | bytecode present                                   |
| `$U`              | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` | bytecode present; equals Commerce `paymentToken()` |

All reads returned chain ID `97`. These values match the SDK table and the
existing project configuration.

### Live Provider Evidence

Read-only `Commerce.getJob(1)` returned:

```text
status:       1 / FUNDED
client:       0xe376F3E7Fb15B526152F0db6805F1002564cbC2B
provider:     0xD8c45dA4e4036f4946132B18fc7568096CB7535f
evaluator:    verified Router
hook:         verified Router
budget:       1000000000000000000 raw $U
submittedAt:  0
```

`eth_getCode(provider)` returned `0x`. This proves the deployed Commerce kernel
accepts an EOA as provider. It does not prove that every provider must be an EOA;
the ABI permits any address.

### Lifecycle Known and Unknown

- **Known:** client creates, registers, sets budget, approves `$U`, and funds.
- **Known:** Commerce escrows the configured budget in its verified `$U` token.
- **Known:** seller later submits a deliverable; Router/Policy govern the
  optimistic settlement/dispute window.
- **Unknown:** the exact deployed seller-side submission function and canonical
  manifest upload procedure. Neither repository nor SDK public ABI exposes it.

## 5. ERC-8004 Relationship

**OFFICIAL DOCUMENTATION:** Draft ERC-8004 defines discovery and trust, not
payments. Its Identity Registry is ERC-721 based. The token ID is the agent ID,
and `agentURI` resolves to the registration file.

The registration file contains:

- type, name, description, image;
- customizable services with names, endpoints, and optional versions;
- `x402Support` and `active`;
- registrations identifying namespace, chain, registry, and agent ID;
- optional supported trust models.

The official draft defines these identity registration methods:

```solidity
register(string agentURI, MetadataEntry[] metadata) returns (uint256 agentId)
register(string agentURI) returns (uint256 agentId)
register() returns (uint256 agentId)
setAgentURI(uint256 agentId, string newURI)
```

It also defines a separately verified agent wallet through `setAgentWallet` and
`getAgentWallet`.

**REPOSITORY EVIDENCE:** this project identifies an agent as
`{chainId}:{registryContract}:{tokenId}` and requires the identity to resolve
through 8004scan. Therefore ERC-8004 registration is required for this project's
complete discovery flow, even though ERC-8183 itself only requires the provider
address.

**UNKNOWN:** whether the deployed chain-97 registry implements exactly the
currently published Draft ERC-8004 registration ABI and what registration-file
hosting/indexing delay 8004scan requires. No state-changing registration call was
attempted.

Therefore the requirement is contextual:

```text
ERC-8183 PROTOCOL REQUIREMENT: NO
CURRENT MARKETPLACE DISCOVERY REQUIREMENT: YES
```

## 6. ERC-8183 Provider Model

The provider is an address recorded in the job, not a seller contract instance
created per service. The kernel has accepted a provider EOA in real chain-97
state. No provider pre-registration is visible in the SDK's job creation flow.

For this project, the legitimate provider should be an operator-controlled EOA
or agent wallet whose ownership can be tied to the ERC-8004 identity. Reusing
`owner_address` as provider matches the existing X.6 design. Whether the
ERC-8004 reserved `agentWallet` should be used instead must be settled when the
deployed registry ABI is verified.

```text
SELLER CONTRACT REQUIRED: NO
PROVIDER EOA POSSIBLE: YES
```

## 7. Service / Pricing Model

Two distinct payment models exist.

### ERC-8183

**SDK EVIDENCE:** `budget` is provided by the buyer to `hireErc8183Agent` and is
encoded into `setBudget`, `$U.approve`, and `fund`. Commerce stores the job
budget. The SDK provides no seller quote or advertised fixed-price lookup.

### x402

**OFFICIAL ALTANA DOCUMENTATION:** seller-side x402 places
`createX402Merchant` in front of an HTTP route. The merchant explicitly configures
`chainId`, `payTo`, `price`, rails, facilitator, RPC, and chain. Payment moves
directly to `payTo`; the facilitator pays gas and cannot redirect earnings.

**REPOSITORY EVIDENCE:** `MerchantConfig.price` is the source for the marketplace
x402 requirement. The X.6 path currently requires that price to come from a
verified `AgentActivationCapability`.

No official evidence states that ERC-8004 sets or enforces a price. ERC-8004
allows natural-language pricing in a description, but payments are explicitly
orthogonal and that text is not an authoritative quote.

```text
ACTUAL PRICE VALUE: NOT FOUND
PRICE/BUDGET ARCHITECTURE: FOUND
```

A real price must be deliberately set by the service operator in server-owned
configuration or supplied by a signed provider quote. The activation capability
must expose that exact amount, and the buyer must pass it unchanged as the
ERC-8183 `budget`/`expectedBudget`. It cannot be copied from the SDK example,
natural-language ERC-8004 metadata, or an existing unrelated job.

## 8. Required Registration / Deployment

Required:

1. implement a deterministic read-only service endpoint;
2. publish its real metadata at a stable HTTPS registration-file URL;
3. independently verify the chain-97 registry ABI;
4. register the agent through the official ERC-8004 method;
5. verify the resulting token ID, owner, agent URI, registration file, and
   8004scan indexing;
6. use the owner or verified agent wallet as ERC-8183 provider;
7. configure a deliberate raw-`$U` price;
8. read `jobCounter` and dispute window when building each action;
9. keep Hire stopped at X.4B/X.4C.

Minimum future state-changing operations, once separately approved, are:

1. one ERC-8004 registration transaction for discovery in this marketplace;
2. one client hire execution containing the five atomic SDK calls
   (`createJob`, `registerJob`, `setBudget`, `$U.approve`, `fund`) after X.4C;
3. one provider `submit` transaction after the deterministic service has
   produced its deliverable;
4. one evaluator/Router completion or later settlement transaction, or refund
   on failure/expiry.

Only item 1 is registration. No seller contract deployment is required. Items
2-4 belong to the later service/job lifecycle and are outside X.11/X.12. The
exact deployed seller-side `submit` ABI remains `UNKNOWN` because it is absent
from the installed SDK's public ABI.

Not required:

- a new seller contract;
- duplicate Commerce/Router/Policy/token contracts;
- a mainnet deployment;
- an x402 payment during action review.

## 9. Existing Configuration

| Input                        | State     | Evidence                                                   |
| ---------------------------- | --------- | ---------------------------------------------------------- |
| `CHAIN_97`                   | READY     | SDK, project guards, and live RPC all return 97            |
| `$U`                         | READY     | verified token and Commerce `paymentToken()` agree         |
| `ALTANA_TESTNET_PRIVATE_KEY` | PRESENT   | presence-only environment audit; value not read or printed |
| `ALTANA_PAYTO`               | PRESENT   | presence-only environment audit                            |
| `FACILITATOR_KEY`            | PRESENT   | presence-only environment audit                            |
| ERC-8183 contracts           | READY     | code and required reads verified on chain 97               |
| job counter read             | AVAILABLE | live `jobCounter()` returned 484 during X.11               |
| X.4B review                  | READY     | existing verified implementation                           |
| X.4C consent                 | READY     | existing pin/verify implementation                         |

## 10. Missing Configuration

| Input                                     | State                                  |
| ----------------------------------------- | -------------------------------------- |
| public operator address                   | MISSING (`ALTANA_OPERATOR_ADDRESS`)    |
| public facilitator address                | MISSING (`ALTANA_FACILITATOR_ADDRESS`) |
| operator-owned provider identity          | NOT YET ESTABLISHED                    |
| ERC-8004 agent identity/token ID          | MISSING                                |
| deployed registry ABI compatibility proof | MISSING                                |
| production service implementation         | MISSING                                |
| canonical service endpoint/origin         | MISSING                                |
| real registration metadata document       | MISSING                                |
| real raw-`$U` service price               | MISSING                                |
| seller deliverable-submission mechanism   | UNKNOWN                                |
| 8004scan indexing procedure/timing        | UNKNOWN                                |

No secret value was exposed while producing this checklist.

## 11. Minimum Legitimate Activation Path

**Chosen path: D — ERC-8004 identity plus an ERC-8183 provider EOA.**

```text
operator-controlled provider EOA
  -> deterministic HTTPS service endpoint
  -> ERC-8004 registration file
  -> official chain-97 Identity Registry registration
  -> 8004scan discovery and exact agent_id
  -> verified off-chain capability/price configuration
  -> Hire
  -> live jobCounter/dispute-window reads
  -> real SDK ERC-8183 hire calls
  -> X.4B immutable review
  -> X.4C consent
  -> STOP before signing/broadcast
```

Path B is sufficient for direct ERC-8183 hiring but not for this marketplace's
`find` requirement. Path C supplies identity but not the ERC-8183 provider and
action. Path A is unsupported because no seller contract is needed. Path D is
the smallest path that satisfies all three main-track stages.

## 12. Risks / Unknowns

- ERC-8004 is currently a Draft ERC; the chain-97 deployed registry may implement
  an earlier or extended ABI.
- The exact seller-side ERC-8183 submission method is absent from the installed
  SDK and public Altana buyer documentation.
- 8004scan may not index chain-97 registration immediately or may require a
  registration-file shape/version specific to its deployment.
- The X.6 provider currently comes from `owner_address`; official ERC-8004 also
  defines `agentWallet`, which may be the more precise provider/payout identity.
- An ERC-8183 budget is buyer-provided and is not proof of a provider's price.
- x402 and ERC-8183 are separate payment rails. The implementation must avoid
  charging both for one service request unless an explicit protocol design says
  so.
- A real service requires a seller-side delivery lifecycle; registering metadata
  without an implemented endpoint would be a false capability claim.

## 13. Recommended X.12 Implementation

**X.12 should be a bounded pre-registration implementation and ABI-verification
milestone:** implement the deterministic read-only service and its canonical
ERC-8004 registration document, require an explicit server-side raw-`$U` price,
derive only public operator/facilitator addresses, and verify the deployed
chain-97 registry's read and registration ABI through read-only calls/simulation.
Stop before sending the registration transaction.

Do not attempt ERC-8004 registration until the service, price, metadata, provider
address, deployed ABI, and 8004scan compatibility are all independently verified.

## X.11 Status

```text
X.11 STATUS:
OFFICIAL PROVIDER PATH: FOUND
PROVIDER EOA POSSIBLE: YES
SELLER CONTRACT REQUIRED: NO
ERC-8004 REGISTRATION REQUIRED: YES
ERC-8183 PROVIDER READY: NO
SERVICE METADATA PATH: FOUND
PRICE/BUDGET PATH: FOUND
REAL ACTION PATH: FOUND

EXACT BLOCKER:
The provider may be an EOA, but no implemented service, explicit operator-owned
price, verified deployed registration ABI, or registered ERC-8004 identity yet
exists to make it discoverable and honestly activatable.

X.12:
Implement one deterministic read-only service endpoint and its canonical ERC-8004
registration document, require an explicit server-only raw-$U price, and verify
the deployed chain-97 registration ABI without broadcasting a transaction.
```

No deployment, contract creation, registration, job creation, hire, payment,
settlement, transfer, approval, signing, broadcast, or mainnet interaction was
performed. No Git operation was performed.
