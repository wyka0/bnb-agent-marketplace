# Main Track Activation X.20: Unsigned Registration Preview

**Date:** 2026-08-13
**Mode:** Read-only / unsigned-only registration preview generation
**Network:** BNB Smart Chain Testnet, chain 97
**Transaction execution:** None

## Outcome

X.20 **GENERATED** the deterministic unsigned ERC-8004 registration preview for
the canonical deployment. All verified prerequisites from X.19 are present, the
authoritative `register(string agentURI)` ABI is resolved, and the encoded
calldata round-trips back to the exact canonical metadata URI. No signature was
requested, nothing was signed or broadcast, and no on-chain state was created.

X.13 service behavior and the production metadata document are unchanged.

## Verified Inputs Used

All inputs are operator-supplied or verified by earlier milestones (X.16, X.18,
X.19). No value was read from or derived from a private key; no environment
secrets are exposed anywhere in this milestone.

```text
CHAIN: BNB Smart Chain Testnet, chainId 97
REGISTRY: 0x8004A818BFB912233c491871b3d84c89A494BD9e
IMPLEMENTATION: 0x7274e874ca62410a93bd8bf61c69d8045e399c02
ABI: Sourcify exact creation/runtime match; register(string agentURI)
PROVIDER EOA: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
PROVIDER BYTECODE: 0x (EOA confirmed)
PUBLIC HTTPS ORIGIN: https://bnb-agent-marketplace-web.vercel.app
CANONICAL METADATA URI: https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
SERVICE ENDPOINT: https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service
PRICE: operator-approved 1 U (18 decimals) in server-only raw units
TOKEN: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 (United Stables / U / 18)
```

## Deterministic Unsigned Preview

Built exclusively by the existing fail-closed pure builder
(`packages/integrations/src/altana/registration-preview.ts`,
`buildUnsignedRegistrationPreview`), which pins chain 97, the verified registry
and implementation, the verified `register(string agentURI)` ABI, the canonical
metadata/service path pair, the `$U` token, the server-only price source, and
unsigned mode with zero value. The encoded calldata is generated for `register`
with a single `string agentURI` argument and contains only public values.

```text
chainId: 97
registry: 0x8004A818BFB912233c491871b3d84c89A494BD9e
implementation: 0x7274e874CA62410a93Bd8bf61c69d8045E399c02
from (provider EOA): 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
functionName: register
agentURI: https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
token: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565
value: 0
mode: unsigned-preview
priceSource: ALTANA_SERVICE_PRICE_RAW_U (server-only, redacted)
```

Selector check: the calldata begins with the `register(string)` 4-byte selector
`0xf2c298be`.

## Unsigned Calldata And Hash

```text
calldata: 0xf2c298be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000005068747470733a2f2f626e622d6167656e742d6d61726b6574706c6163652d7765622e76657263656c2e6170702f2e77656c6c2d6b6e6f776e2f6167656e742d726567697374726174696f6e2e6a736f6e00000000000000000000000000000000
calldataHash: 0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4
```

Both are deterministic and publicly reproducible; they are not secrets.

## Calldata Decode Check

The generated calldata was decoded with `decodeFunctionData` against the
verified `register(string agentURI)` ABI:

```text
decoded functionName: register
decoded agentURI: https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
round-trip equality: EXACT
```

## Focused Tests And Gates

New focused canonical verify added
(`packages/integrations/src/altana/registration-preview.canonical.verify.ts`,
wired as `altana:x20:verify`). It asserts the ready preview under the real
canonical inputs, selector correctness, decode round-trip, calldata hash
validity, deterministic re-encoding, unsigned/zero-value semantics, and absence
of secret material. It reads no environment.

```text
X.20 canonical registration preview verify: 17/17 PASS
X.16 registration preview verify: 19/19 PASS
Typecheck: PASS (12/12)
Lint: PASS (12/12)
Build: PASS (7/7)
```

## X.20 Status

```text
X.20 STATUS:
REGISTRY: VERIFIED (0x8004A818BFB912233c491871b3d84c89A494BD9e)
ABI: VERIFIED (register(string agentURI), Sourcify exact match)
PROVIDER EOA: VERIFIED (0x299Ce4113abF88F4997737184aa8A7a3D58AC15C)
METADATA URI: VERIFIED (https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json)
REGISTRATION FUNCTION: register(string)
UNSIGNED CALLDATA: GENERATED
CALldata DECODE CHECK: PASS
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
ERC-8004 REGISTRATION: NOT PERFORMED
AGENT ID: NOT ASSIGNED
ERC-8183 JOB: NOT CREATED
PAYMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

## Files Changed

- `packages/integrations/src/altana/registration-preview.canonical.verify.ts`:
  new focused X.20 canonical verify (deterministic encoding, decode round-trip,
  calldata hash, no-secret assertion).
- `packages/integrations/package.json`: added `altana:x20:verify` script.
- `docs/review/Main-Track-Activation-X20-Unsigned-Registration-Preview.md`: this
  report.

No production application code, X.13 service, or metadata was changed. Changes
are not committed or pushed.

## Next Legitimate Milestone

X.21 (or the operator-directed continuation): present this unsigned preview for
explicit operator approval, then — only upon approval, as separate steps —
(a) render the signing details against the verified provider EOA, (b) sign the
calldata offline, (c) broadcast the ERC-8004 `register(string)` transaction to
the verified registry on chain 97, and (d) from the registration receipt, derive
the assigned `agentId`. Each step remains gated and out of scope for X.20, which
stops here awaiting approval.