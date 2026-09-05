# Main Track Activation X.15: Provider Resolution

**Date:** 2026-08-13
**Mode:** Read-only provider and implementation investigation
**Network:** BNB Smart Chain Testnet, chain 97
**Writes:** None

## 1. Scope

X.15 continued from completed X.14. It did not restart earlier milestones,
replace the X.13 service, or modify X.13 production files. The milestone
investigated the EIP-1967 implementation, repeated the ADMIN slot validation,
checked public provider evidence, and inspected price configuration without
signing, broadcasting, registration, payment, settlement, job creation, or
mainnet access.

## 2. Implementation Evidence

The registry implementation pointer previously read from chain 97 is:

```text
Registry:       0x8004A818BFB912233c491871b3d84c89A494BD9e
Implementation: 0x7274e874ca62410a93bd8bf61c69d8045e399c02
Chain:          97
```

The implementation address has non-empty bytecode on the authorized RPC.
Sourcify's verified contract API returned an exact match for the implementation:

```text
Source: https://sourcify.dev/server/v2/contract/97/0x7274e874ca62410a93bd8bf61c69d8045e399c02?fields=all
Chain: 97
Address: 0x7274e874CA62410a93Bd8bf61c69d8045E399c02
Match: exact_match
Creation match: exact_match
Runtime match: exact_match
Verified at: 2026-01-30T07:25:36Z
Compiler: solc 0.8.24+commit.e11b9ed9
Contract: IdentityRegistryUpgradeable
```

The verified record's proxy resolution reports `isProxy: false` for the
implementation address itself. This is consistent with the registry being a
proxy whose implementation slot points to this verified implementation; it is
not evidence that the registry proxy's ADMIN slot is resolved.

The verified ABI explicitly contains these registration and identity methods:

```text
register() -> uint256 agentId
register(string agentURI) -> uint256 agentId
register(string agentURI, tuple[] metadata) -> uint256 agentId
setAgentURI(uint256 agentId, string newURI)
setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)
getAgentWallet(uint256 agentId) -> address
getMetadata(uint256 agentId, string metadataKey) -> bytes
setMetadata(uint256 agentId, string metadataKey, bytes metadataValue)
tokenURI(uint256 tokenId) -> string
ownerOf(uint256 tokenId) -> address
balanceOf(address owner) -> uint256
supportsInterface(bytes4 interfaceId) -> bool
```

The `tuple[]` metadata components in the verified ABI are explicitly
`metadataKey: string` and `metadataValue: bytes`. This ABI is authoritative for
the exact chain-97 implementation address. It is not copied from the draft
EIP.

The ABI finding resolves the prior X.14 ABI blocker, but it does not by itself
prove that a specific operator owns an identity, provide a provider EOA, set a
price, or authorize a registration transaction.

## 3. ADMIN Slot Probe

The required value was validated before any RPC request:

```text
0xb53127684a568b3173ae13b9f8a6016e01912000000000000000000000000000000
total length: 69
hex length after 0x: 67
validation: INVALID_SLOT
RPC request: NOT SENT
```

This is an input/instrumentation failure only. The slot was not queried and no
proxy-admin conclusion is drawn from it. The implementation slot remains
verified from X.14 and is nonzero. Therefore the registry appears to be an
EIP-1967 implementation-pointer proxy, while the ADMIN slot is `UNKNOWN` in
this milestone.

## 4. Provider EOA Evidence

The only concrete public provider address available in the existing X.13 live
verification is the provider recorded by pre-existing chain-97 ERC-8183 job 1:

```text
0xD8c45dA4e4036f4946132B18fc7568096CB7535f
```

Read-only `eth_getCode` returned `0x` for that address, so it is an EOA on chain 97. This proves that the ERC-8183 kernel accepts an EOA provider. It does not
prove that this address is the current operator-controlled provider for the X.13
service, nor does it bind the address to a future ERC-8004 identity.

No public operator address is configured in the process environment. The
repository's `.env.example` contains empty placeholders for operator,
facilitator, and pay-to addresses. The audit did not print, copy, or derive a
private key. Consequently the operator-controlled provider EOA remains
unverified.

## 5. Price Evidence

No server-only raw-`$U` price is configured in the process environment. The
repository contains no operator-approved value for the service. Historical job
budgets and SDK examples are not service-price evidence and were not reused.

```text
PRICE: OPERATOR INPUT REQUIRED
```

No default or placeholder price was created.

## 6. Registration Decision

The implementation ABI and implementation relationship are now authoritative
enough for a later read-only builder, but the required provider and price gates
are still missing. X.15 therefore does not build registration calldata or a
registration preview. X.13 remains unchanged, including `active:false` and
`x402Support:false` metadata.

Minimum inputs for the next legitimate milestone:

1. Configure or otherwise independently verify the public operator/provider EOA and confirm it is a nonzero chain-97 EOA.
2. Provide an explicit positive server-only raw-`$U` service price.
3. Repeat the ADMIN probe with a genuinely 66-character slot value. The value supplied in this milestone must not be reused because local validation rejected it.
4. Then build only an unsigned deterministic preview using the Sourcify ABI, canonical HTTPS metadata URI, verified provider EOA, and operator-approved price. No transaction execution is implied.

## 7. X.15 Status

```text
X.15 STATUS:
IMPLEMENTATION: VERIFIED (IdentityRegistryUpgradeable; exact Sourcify match)
REGISTRY: 0x8004A818BFB912233c491871b3d84c89A494BD9e
CHAIN: BNB Smart Chain Testnet, chainId 97
BYTECODE: PRESENT at registry and implementation
EIP-1967: YES (implementation pointer present; admin unresolved)
ADMIN SLOT: INVALID_SLOT (supplied value length 69; RPC request not sent)
ERC-165: supportsInterface(0xffffffff)=false; supportsInterface(0x01ffc9a7)=true
AUTHORITATIVE ABI: FOUND for implementation 0x7274e874ca62410a93bd8bf61c69d8045e399c02
ABI SOURCE: Sourcify exact match, chain 97, IdentityRegistryUpgradeable, verified 2026-01-30
PROVIDER EOA: UNVERIFIED (job-1 EOA is public evidence only, not operator identity)
PROVIDER BYTECODE: 0x for job-1 public provider 0xD8c45dA4e4036f4946132B18fc7568096CB7535f
PRICE: OPERATOR INPUT REQUIRED
REGISTRATION PREVIEW: BLOCKED
X.4B: BLOCKED
X.4C: BLOCKED
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
REGISTRATION: NOT PERFORMED
JOB: NOT CREATED
PAYMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
GIT: NOT COMMITTED
GIT: NOT PUSHED
```

## Exact Blocker

The ABI blocker is resolved, but registration preview remains blocked because
the operator-controlled provider EOA and explicit server-only raw-`$U` price are
not verified. The ADMIN slot is also unresolved because the supplied slot value
failed local validation and was correctly not sent.
