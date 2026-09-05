# Main Track Activation X.10: Seller Deployment

**Date:** 2026-08-12
**Result:** BLOCKED at the mandatory pre-implementation audit
**Network boundary:** BNB Smart Chain Testnet, chain 97 only

## X.10 STATUS

```text
X.10 STATUS:
SELLER: BLOCKED
CHAIN: 97
SELLER ADDRESS: NONE
SERVICE ENDPOINT: NONE
CAPABILITY METADATA: BLOCKED
REAL PRICE: BLOCKED
REAL ACTION: BLOCKED
X.4B REVIEW: BLOCKED
X.4C CONSENT: BLOCKED

DEPLOYMENT TX:
NONE

SIGNING:
NOT PERFORMED

SERVICE PAYMENT:
NOT PERFORMED

SETTLEMENT:
NOT PERFORMED

MAINNET:
NOT TOUCHED

GIT:
NOT COMMITTED
NOT PUSHED
```

## Exact Blocker

The repository and installed `@altananetwork/sdk@0.7.0` provide no
authoritative seller/agent registration or deployment ABI, bytecode,
constructor, or transaction builder, and no real service price is configured;
continuing would require inventing deployment behavior, agent identity, or
pricing.

## Phase Results

| Phase                            | Result         | Evidence                                                                                                         |
| -------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1. Existing infrastructure audit | COMPLETE       | `Main-Track-Activation-X10-Audit.md`                                                                             |
| 2. Seller design                 | BLOCKED        | No approved real raw-`$U` service price or authoritative identity-registration mechanism                         |
| 3. ERC-8183 seller               | BLOCKED        | ERC-8183 provider is an address in a client-created job; no separate seller deployment primitive was established |
| 4. Service endpoint              | NOT STARTED    | Would create a locally asserted agent before its legitimate discoverable identity exists                         |
| 5. X.6 integration               | NOT STARTED    | `resolveAgentActivationCapability` must not return a local capability for an unregistered/non-resolving agent    |
| 6. Real action                   | BLOCKED        | Real amount and predicted live `jobCounter() + 1` are unavailable                                                |
| 7. Testnet deployment            | BLOCKED        | No deployable artifact or registration transaction is defined                                                    |
| 8. Live read-only verification   | NOT APPLICABLE | No deployment exists to read back                                                                                |
| 9. X.10 tests/regression         | NOT RUN        | No implementation was permitted after the audit blocker                                                          |

## Reused Infrastructure Confirmed

The audit confirmed that a future implementation must reuse the existing
verified chain-97 set:

| Component         | Address                                      |
| ----------------- | -------------------------------------------- |
| Commerce          | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| Router            | `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` |
| Policy            | `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6` |
| ERC-8004 registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| `$U`              | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` |

The SDK `BNB_TESTNET` preset resolves chain `97`. The existing
`prepareErc8183Hire` builds the real SDK five-call client job batch, and X.4B/
X.4C can review and bind that batch once a legitimate registered seller and
real capability inputs exist. No duplicate payment or ERC-8183 infrastructure
was added.

## Environment Boundary

Presence-only checks found:

- a configured testnet signer under `ALTANA_TESTNET_PRIVATE_KEY`;
- a configured `ALTANA_PAYTO`;
- a configured `FACILITATOR_KEY`;
- no configured `ALTANA_FACILITATOR_ADDRESS`;
- no configured `ALTANA_OPERATOR_ADDRESS`;
- no configured service-price variable;
- no RPC override, so the SDK public chain-97 RPC would apply.

No secret value was printed, copied, written, returned, or placed in client
code. No account was derived because deployment was already blocked on missing
authoritative deployment/registration requirements and price.

## Why No Partial Implementation Was Added

A server endpoint and local metadata object would not prove a legitimate
discoverable ERC-8004 seller. The current Hire route accepts only exact
identities returned by live 8004scan data, and the capability resolver correctly
returns `null` when real action/pricing metadata is absent. Changing it before
registration would manufacture an activatable state.

Likewise, selecting an arbitrary `$U` amount would be a fake price. Building
calldata with a guessed job ID would violate the requirement that the ID come
from the real chain counter. Deploying an ad hoc contract without an approved
seller interface would not establish compatibility with the verified ERC-8183
kernel or registry.

## Required Inputs For A New Milestone

Deployment can resume only after approval supplies or establishes:

1. the authoritative chain-97 ERC-8004 registry ABI and exact agent registration
   transaction, or an existing operator-owned registered identity;
2. confirmation whether the ERC-8183 provider is the operator EOA or a required
   seller contract, including audited source/ABI/constructor if a contract is
   required;
3. an explicit real service price in raw 18-decimal `$U` units and its server-only
   configuration name;
4. the canonical public service URL/production origin;
5. public operator and facilitator addresses, derived and independently checked
   on chain 97, that satisfy the existing review policy;
6. a read-only `jobCounter()` ABI/read path for race-aware hire construction.

This is an evidence-driven stop, not a claimed deployment failure. No deployment
transaction was attempted.
