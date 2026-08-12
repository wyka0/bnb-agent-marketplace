# Main Track Activation X.14: Provider Registration Audit

**Date:** 2026-08-13
**Mode:** Read-only registry and artifact audit
**Network:** BNB Smart Chain Testnet, chain 97
**Writes:** None

## 1. Scope

X.14 continued from the prior malformed `eth_getStorageAt` probe. The audit did
not restart X.1-X.13 and did not modify X.13 production code. It attempted to
prove the deployed chain-97 ERC-8004 Identity Registry registration interface
using only read-only RPC evidence, installed SDK/repository artifacts, verified
deployment facts, and the official sources already recorded by the project.

No ABI was inferred from Draft ERC-8004 text and no registration calldata was
generated.

## 2. Registry and RPC

```text
CHAIN: 97 (BNB Smart Chain Testnet)
RPC: https://bsc-testnet-rpc.publicnode.com
REGISTRY: 0x8004A818BFB912233c491871b3d84c89A494BD9e
```

The sequential basic probe returned:

| Read                                                      | Result                                                               | Evidence interpretation                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `eth_chainId`                                             | `0x61`                                                               | Expected chain 97                                                                                          |
| `eth_getCode(registry, latest)`                           | Non-empty runtime bytecode                                           | Registry address has deployed code                                                                         |
| `eth_getStorageAt(registry, implementation slot, latest)` | `0x0000000000000000000000007274e874ca62410a93bd8bf61c69d8045e399c02` | Nonzero implementation pointer; public implementation address `0x7274e874ca62410a93bd8bf61c69d8045e399c02` |
| `eth_getStorageAt(registry, admin slot, latest)`          | Not sent                                                             | Supplied ADMIN value failed local slot validation                                                          |

The implementation slot was validated before sending:

```text
0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
total length: 66
hex length after 0x: 64
validation: PASS
```

The ADMIN value supplied for this run was validated before sending and rejected:

```text
0xb53127684a568b3173ae13b9f8a6016e01912000000000000000000000000000000
total length: 69
hex length after 0x: 67
validation: INVALID_SLOT
RPC request: NOT SENT
```

This is a probe-input classification, not evidence that the registry or RPC is
broken. The previous `-32602 InvalidParams / JsonStorageKey` was likewise a
malformed-slot probe failure. No alternate RPC retry was needed because the
corrected implementation read succeeded and the ADMIN request was rejected
locally before transport.

Because the implementation slot contains a nonzero address, the registry
appears to use an EIP-1967 implementation pointer. The ADMIN slot was not
determined in this run, so no admin address is claimed.

## 3. Standard Read-Only Interface Evidence

These selectors were probed only after chain ID and bytecode succeeded. They are
deployment/interface evidence and do not prove ERC-8004 registration
compatibility.

| Probe                           | Result                                       |
| ------------------------------- | -------------------------------------------- |
| `supportsInterface(0xffffffff)` | `false`                                      |
| `supportsInterface(0x01ffc9a7)` | `true`                                       |
| `owner()`                       | `0x1611e27be13feb93242bf57914872ea63f9e64dc` |
| `name()`                        | `AgentIdentity`                              |
| `symbol()`                      | `AGENT`                                      |
| `totalSupply()`                 | Reverted with RPC execution error            |

The ERC-165 result confirms ERC-165 support. The ERC-721-style name and symbol
responses identify standard token-like interface behavior. None of these reads
establishes the presence, selector, arguments, return values, authorization
rules, or metadata schema of an ERC-8004 registration method.

## 4. Authoritative ABI Search

The following sources were inspected:

- Installed workspace packages and SDK references.
- Repository `apps`, `packages`, and review artifacts.
- The verified chain-97 registry address in the Altana integration checks.
- Official BNB Chain ERC-8004 documentation URL already recorded in X.14.
- Official BNB Agent SDK repository URL already recorded in X.14.
- Etherscan API V2 contract-ABI URL already recorded in X.14.

The installed SDK and repository expose the chain-97 registry address but do not
contain an authoritative IdentityRegistry ABI, Solidity interface, deployment
artifact, registration adapter, or package export for registration. Searches for
`IdentityRegistry`, `setAgentURI`, `setAgentWallet`, `getAgentWallet`,
`MetadataEntry`, and registration functions found no matching ABI or artifact.

The official BNB Chain documentation URL and BNB Agent SDK repository returned
HTTP 404. The Etherscan V2 ABI request returned HTTP 400 without the required
explorer API authentication. These outcomes do not prove that the deployment
lacks an ABI; they mean this audit did not obtain an authoritative ABI from
those sources.

Draft ERC-8004 signatures remain unverified for this deployment. They were not
used to calculate selectors or encode calldata.

## 5. Decision

The deployed registry is proven to exist on chain 97 and appears to expose an
EIP-1967 implementation pointer. Standard ERC-165/ownership/token-like reads
also succeeded. The actual ERC-8004 registration interface is not proven.

Registration therefore remains blocked. X.13 remains unchanged and its
metadata remains inactive (`active:false`, `x402Support:false`). No provider EOA
or raw `$U` price is claimed. A historical job provider and an implementation
slot address are not a registered provider identity.

Minimum operator action to resume:

1. Supply an authoritative ABI or verified source/artifact for the exact chain-97 registry address, including the registration function and relevant metadata types.
2. If the registry is proxied, provide authoritative ABI/source evidence for the implementation address and verify it matches the registry deployment.
3. Supply an explicit server-only positive raw-`$U` service price.
4. Independently derive and verify the public provider EOA, without exposing or reusing the previously exposed testnet credentials.

Only after those inputs are available may a later milestone build an unsigned,
read-only registration preview. This X.14 audit stops before registration,
signing, broadcasting, payment, or job creation.

## 6. X.14 Status

```text
X.14 STATUS:
CHAIN: BNB Smart Chain Testnet, chainId 97
REGISTRY: 0x8004A818BFB912233c491871b3d84c89A494BD9e
BYTECODE: PRESENT (eth_getCode returned non-empty bytecode)
EIP-1967: YES (nonzero implementation slot; ADMIN slot unresolved)
IMPLEMENTATION SLOT: 0x0000000000000000000000007274e874ca62410a93bd8bf61c69d8045e399c02
ADMIN SLOT: INVALID_SLOT (supplied value length 69; RPC request not sent)
ERC-165: supportsInterface(0xffffffff)=false; supportsInterface(0x01ffc9a7)=true
ERC-173: owner() returned 0x1611e27be13feb93242bf57914872ea63f9e64dc
ERC-721 VIEWS: name=AgentIdentity; symbol=AGENT; totalSupply=reverted
AUTHORITATIVE ERC-8004 ABI: BLOCKED
REGISTRATION PREVIEW: BLOCKED
PRICE: BLOCKED (no explicit server-only raw-$U price)
X.4B: BLOCKED
X.4C: BLOCKED
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
REGISTRATION: NOT PERFORMED
JOB: NOT CREATED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
GIT: NOT COMMITTED
GIT: NOT PUSHED
```
