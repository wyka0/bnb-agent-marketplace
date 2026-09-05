# Main Track Activation X.21: Registration Transaction Review

**Date:** 2026-08-13
**Mode:** Read-only / unsigned registration transaction review
**Network:** BNB Smart Chain Testnet, chain 97
**Transaction execution:** None

## Outcome

X.21 **REVIEWED** the deterministic unsigned ERC-8004 `register(string agentURI)`
transaction that targets the verified registry on chain 97, using only the X.20
calldata (hash must-match) and a read-only chain-97 snapshot. No signature was
requested, nothing was signed or broadcast, and no on-chain state was created.

The transaction fields that are authoritatively determinable are reported and
verified. The network-derived fields (nonce, gas limit, fees) were captured as a
read-only live snapshot and are explicitly marked to be re-derived at submission
time; none were guessed or fabricated. X.13 service behavior and production
metadata are unchanged.

## Review Method

A new focused review script
(`packages/integrations/src/altana/registration-transaction.review.verify.ts`,
wired as `altana:x21:review`):

1. Rebuilds the canonical unsigned preview with the exact X.20 verified inputs
   (registry, implementation, provider EOA, canonical metadata URI, `$U` token,
   server-only price, verified ABI).
2. Asserts deterministically: target = verified registry, chainId = 97, calldata
   hash = the X.20 constant, calldata decodes to the exact canonical metadata
   URI, provider EOA matches, unsigned mode, no secret material.
3. Takes a read-only snapshot of chain 97 via the repository-authorized Altana
   public RPC URL using a viem public client (read methods only — no account, no
   signer, no write transport): chainId, block height, signer nonce (pending),
   `eth_estimateGas`, fee market, and gas price.

## Deterministic Assertions

```text
PASS to (registry) is verified registry
PASS chainId is exactly 97
PASS calldata hash matches X.20
PASS calldata decodes to canonical agent URI
PASS from (provider EOA) verified
PASS preview is unsigned (no signature material)
PASS no secret material present in this review
X.21 deterministic assertions: 7/7 PASS
```

## Unsigned Transaction Review

The reviewed transaction is the X.20 unsigned submission envelope (pre-signature
preview). No `from`-signed envelope was constructed.

```text
to:          0x8004A818BFB912233c491871b3d84c89A494BD9e  (verified registry)
chainId:     97  (BNB Smart Chain Testnet)
from:        0x299Ce4113abF88F4997737184aa8A7a3D58AC15C  (signer / provider EOA)
functionName: register
agentURI:    https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
data:        0xf2c298be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000005068747470733a2f2f626e622d6167656e742d6d61726b6574706c6163652d7765622e76657263656c2e6170702f2e77656c6c2d6b6e6f776e2f6167656e742d726567697374726174696f6e2e6a736f6e00000000000000000000000000000000
dataHash:    0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4
value:       0 (0x0)
type:        eip1559 (chain 97 supports EIP-1559; final selection at submission)
accessList:  []
```

## Read-Only Chain-97 Snapshot

```text
chainId:                  97 (0x61)  — matches expected
blockNumber (snapshot):   124742759
nonce (pending):          1
gasLimit estimate:        203581   — eth_estimateGas
maxPriorityFeePerGas:     100000000  — snapshot
gasPrice (market):        100000000  — snapshot
```

Snapshot method: one or more plain viem public-client RPC reads against the
repository-authorized Altana `publicRpcUrl`. No signer, no private key, no write.

## Fields Not Determinable At Review Time (NOT guessed)

Per fail-closed policy, the following are NOT authoritatively fixed here; they
are network/signer-dependent and MUST be re-derived at submission time before
any signing step is permitted:

```text
nonce:                      NOT FINAL — pending snapshot was 1; re-read eth_getTransactionCount immediately before signing
gasLimit:                   NOT FINAL — eth_estimateGas returned 203581; re-estimate at submission
maxPriorityFeePerGas:       NOT FINAL — RPC snapshot only
maxFeePerGas:               NOT FINAL — must be >= gasPrice market snapshot (100000000) at submission
type & accessList:          NOT FINAL — selected at submission from chain-97 fee market
```

No value in the transaction is guessed: any parameter that could not be
authoritatively established is explicitly listed as NOT DETERMINABLE at review
time and left for the operator-gated submission step.

## Focused Tests And Gates

```text
X.21 registration transaction review verify: 7/7 PASS (+ live chain-97 snapshot)
X.20 canonical registration preview verify: 17/17 PASS
X.16 registration preview verify: 19/19 PASS
Typecheck: PASS (12/12)
Lint: PASS (12/12)
Build: PASS (7/7)
```

## X.21 Status

```text
X.21 STATUS:
TO: VERIFIED (0x8004A818BFB912233c491871b3d84c89A494BD9e, registry)
CHAIN ID: VERIFIED (97, live-snapshot confirmed)
FROM: VERIFIED (0x299Ce4113abF88F4997737184aa8A7a3D58AC15C, provider EOA)
CALLDATA: VERIFIED (hash matches X.20 exactly)
CALLDATA DECODE CHECK: PASS
VALUE: VERIFIED (0)
NONCE: NOT DETERMINABLE AT REVIEW TIME (pending snapshot 1; re-derive at submission)
GAS LIMIT: NOT DETERMINABLE AT REVIEW TIME (estimate 203581; re-derive at submission)
GAS PRICE / FEES: NOT DETERMINABLE AT REVIEW TIME (snapshot only; set at submission)
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
ERC-8004 REGISTRATION: NOT PERFORMED
AGENT ID: NOT ASSIGNED
ERC-8183 JOB: NOT CREATED
PAYMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
TRANSACTION REVIEW: PASS
```

## Files Changed

- `packages/integrations/src/altana/registration-transaction.review.verify.ts`:
  new focused X.21 review (deterministic transaction assertions + read-only
  chain-97 snapshot; no signer, no write path).
- `packages/integrations/package.json`: added `altana:x21:review` script.
- `docs/review/Main-Track-Activation-X21-Registration-Transaction-Review.md`:
  this report.

No production application code, X.13 service, or metadata was changed. Changes
are not committed or pushed.

## Next Legitimate Milestone (operator-gated)

X.22 (or the operator-directed continuation): present the X.20 unsigned preview
and this X.21 review for explicit operator approval, then — only upon explicit
approval, as separate steps — (a) re-derive the live nonce, gas limit, and fee
fields, (b) sign the calldata offline with the verified provider EOA outside
this review path, (c) broadcast the ERC-8004 `register(string)` transaction to
the verified registry on chain 97, and (d) from the registration receipt, derive
the assigned `agentId`. Each step remains gated and out of scope for X.21, which
stops here awaiting operator approval.