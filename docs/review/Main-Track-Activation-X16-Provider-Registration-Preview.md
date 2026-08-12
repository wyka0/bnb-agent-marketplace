# Main Track Activation X.16: Provider Registration Preview

**Date:** 2026-08-13
**Mode:** Read-only verification and unsigned-preview preparation
**Network:** BNB Smart Chain Testnet, chain 97
**Transaction execution:** None

## Outcome

X.16 verified the configured testnet operator's public EOA and the chain-97 `$U`
token. It also added a fail-closed, pure unsigned-preview builder using only the
Sourcify-verified `register(string)` ABI. No existing X.13 service or metadata
file was changed.

The real registration preview remains blocked because no operator-approved
positive raw-`$U` price and no canonical public HTTPS deployment origin are
configured. The builder can deterministically encode a preview only when those
inputs are supplied; it has no signer, broadcaster, RPC writer, or transaction
submission surface.

## Provider

The ignored server configuration contains a valid-shaped BNB-testnet operator
key. X.16 derived only its public checksum address internally. No key value was
printed, copied into source, metadata, or this report.

```text
Provider: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
Chain: 97
eth_getCode: 0x
Classification: VERIFIED EOA
```

No unrelated historical job provider was substituted.

## Price And Token

The server configuration has no positive service price under the new canonical
name `ALTANA_SERVICE_PRICE_RAW_U` or the previously audited candidate names.
X.16 added only an empty `.env.example` declaration. Parsing accepts positive
base-10 integers and rejects missing, zero, negative, decimal, and otherwise
invalid values. It does not assign a default.

The already verified chain-97 payment token was checked read-only:

```text
Address: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565
Bytecode: PRESENT
name(): United Stables
symbol(): U
decimals(): 18
```

No price conversion occurs. A configured raw value is retained as an exact
`bigint` and would later be passed unchanged to the ERC-8183 budget boundary.

## Metadata And Origin

The existing X.13 metadata remains unchanged and truthful:

- one implemented read-only service;
- `active:false`;
- `x402Support:false`;
- no price or provider claim;
- no ERC-8183 or autonomous-execution claim.

No `NEXT_PUBLIC_APP_URL`, `APP_URL`, `PUBLIC_APP_URL`, or `VERCEL_URL` public
HTTPS origin is configured. Therefore X.16 does not invent a metadata URI or
service endpoint and does not generate real registration calldata.

## Preview Layer

`packages/integrations/src/altana/registration-preview.ts` provides a pure,
fail-closed builder. It pins:

- chain `97`;
- registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`;
- implementation `0x7274e874ca62410a93bd8bf61c69d8045e399c02`;
- `$U` token `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`;
- price source `ALTANA_SERVICE_PRICE_RAW_U`;
- the Sourcify-verified `register(string agentURI)` overload;
- canonical metadata path `/.well-known/agent-registration.json`;
- canonical service path `/api/agents/bnb-testnet-risk/service`;
- inactive and non-x402 metadata claims;
- provider bytecode exactly `0x`;
- unsigned mode and transaction value `0`.

The `register(string)` overload is appropriate because the canonical X.13
registration document is represented by its HTTPS `agentURI`; no unverified
on-chain metadata entries are needed. The builder does not accept or store a
private key.

The real environment fails the price and origin gates, so arguments and calldata
are intentionally not emitted. Deterministic fixture tests prove that identical
verified inputs reproduce identical calldata without treating fixture calldata
as a real registration preview.

## ADMIN Diagnostic

The ADMIN string supplied to X.16 again has 67 hexadecimal characters after
`0x` and total length 69. It failed local validation and was not sent. This does
not affect the exact Sourcify ABI match or implementation-pointer evidence.

## X.16 Status

```text
X.16 STATUS:

PROVIDER EOA: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
PROVIDER BYTECODE: 0x
PROVIDER STATUS: VERIFIED

CHAIN: BNB Smart Chain Testnet, chainId 97
REGISTRY: 0x8004A818BFB912233c491871b3d84c89A494BD9e
IMPLEMENTATION: 0x7274e874ca62410a93bd8bf61c69d8045e399c02 (IdentityRegistryUpgradeable)

AUTHORITATIVE ABI: FOUND
ABI SOURCE: Sourcify exact creation/runtime match for chain-97 implementation

$U TOKEN: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 (bytecode present; United Stables / U / 18 decimals)
PRICE: OPERATOR INPUT REQUIRED
PRICE SOURCE: ALTANA_SERVICE_PRICE_RAW_U (server-only; absent; no default)

CANONICAL HTTPS ORIGIN: BLOCKED
METADATA URI: BLOCKED (no configured public HTTPS origin)
METADATA STATUS: X.13 INACTIVE METADATA UNCHANGED; CANONICAL PUBLIC URI BLOCKED

REGISTRATION FUNCTION: register(string agentURI), verified ABI overload
REGISTRATION ARGUMENTS: BLOCKED (canonical metadata URI unavailable)
REGISTRATION CALLDATA: BLOCKED / NOT GENERATED
REGISTRATION PREVIEW: BLOCKED

ERC-8004 REGISTRATION: NOT EXECUTED
ERC-8004 AGENT ID: NOT ASSIGNED
8004SCAN: NOT YET VERIFIED

X.4B: BLOCKED UNTIL REAL REGISTERED PROVIDER EXISTS
X.4C: BLOCKED UNTIL REAL ACTION EXISTS

SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
REGISTRATION: NOT PERFORMED
JOB: NOT CREATED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
GIT: NOT COMMITTED / NOT PUSHED

TEST RESULTS: X.16 19/19 PASS; X.13 12/12 PASS; X.13 live READY; hire 23/23 PASS; marketplace 83/83 PASS; marketplace live 14/14 PASS; X.4B 16/16 PASS; X.4C 11/11 PASS; typecheck PASS; lint PASS; build PASS
```

## Exact Blocker

The configured provider EOA is verified, but X.16 cannot produce a legitimate
registration preview until the operator supplies both:

1. a positive raw-`$U` integer in server-only `ALTANA_SERVICE_PRICE_RAW_U`;
2. the actual publicly accessible canonical HTTPS deployment origin.

Neither value can be inferred from the ABI, token metadata, historical budgets,
SDK examples, localhost, or deployment conventions.

## Next Legitimate Milestone

The operator configures the real raw-`$U` price and public HTTPS origin. The next
read-only milestone then fetches the canonical metadata document, verifies that
its endpoint and claims match X.13, and emits the deterministic unsigned
`register(string)` preview. It must still stop before signing or broadcasting.
