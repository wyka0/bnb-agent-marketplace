# Main Track Activation X.22: Registration Transaction Approval Review

**Date:** 2026-08-13
**Mode:** Read-only / final ERC-8004 registration transaction review (approval)
**Network:** BNB Smart Chain Testnet, chain 97
**Transaction execution:** None

## Outcome

X.22 **REVIEWED and APPROVED FOR OPERATOR SUBMISSION** the deterministic unsigned
ERC-8004 `register(string agentURI)` transaction that targets the verified
registry on chain 97. This is the final review: it re-verified every
authoritatively determinable field and took a **fresh** read-only chain-97
snapshot, including on-chain bytecode reads that were not part of X.21.

No signature was requested, nothing was signed or broadcast, and no on-chain
state was created. The reviewed transaction can only target chain 97 (pinned by
the pure preview builder and re-confirmed by a live `eth_chainId` read) and only
the verified registry (pinned by the builder, whose proxy implementation slot
was re-confirmed on-chain). X.13 service behavior and production metadata are
unchanged.

## Review Method

A new focused review script
(`packages/integrations/src/altana/registration-approval.review.verify.ts`,
wired as `altana:x22:review`):

1. Rebuilds the canonical unsigned preview with the exact X.20 verified inputs
   (registry, implementation, provider EOA, canonical metadata URI, `$U` token,
   server-only price, verified ABI).
2. Asserts deterministically: target = verified registry, chainId = 97, calldata
   hash = the X.20 constant, calldata decodes to the exact canonical metadata
   URI, provider EOA matches, transaction value = 0, unsigned mode, no secret
   material.
3. Takes a **fresh** read-only chain-97 snapshot via the repository-authorized
   Altana public RPC URL using a viem public client (read methods only — no
   account, no signer, no write transport): `eth_chainId`, registry
   `eth_getCode` (deployed contract) + EIP-1967 implementation storage slot,
   provider `eth_getCode` (empty ⇒ EOA), provider balance, provider nonce
   (pending), `eth_estimateGas`, fee market, and gas price.

## Deterministic Assertions

```text
PASS to (registry) is verified registry
PASS preview chainId is exactly 97
PASS calldata hash matches X.20
PASS calldata decodes to canonical agent URI
PASS from (provider EOA) verified
PASS transaction value is 0
PASS preview is unsigned (no signature material)
PASS no secret material present in this review
X.22 registration approval review: 16/16 checks PASS
```

## Fresh Read-Only Chain-97 Verification

```text
PASS live chainId is exactly 97
PASS registry has deployed bytecode on chain 97
PASS registry proxy implementation slot matches verified implementation
PASS provider EOA bytecode is empty (0x) — EOA confirmed
PASS provider balance read (read-only)
PASS provider nonce read (read-only)
PASS gas estimate read (read-only)
PASS fee information read (read-only)
```

### Snapshot Values (fresh, block 124867323)

```text
chainId:                  97 (0x61)  — matches expected
blockNumber (snapshot):   124867323
registry bytecode:        130 bytes deployed on chain 97
registry implementation:  0x7274e874CA62410a93Bd8bf61c69d8045E399c02  — EIP-1967 slot matches verified implementation
provider EOA bytecode:    0x (node returned null)  — EOA confirmed
provider balance:         38556136256838739 wei (~0.0386 BNB)  — read-only snapshot
provider nonce (pending): 1
gasLimit estimate:        203581   — eth_estimateGas
maxPriorityFeePerGas:     100000000  — snapshot
gasPrice (market):        100000000  — snapshot
```

## Unsigned Transaction Review

The reviewed transaction is the X.20 unsigned submission envelope (pre-signature
preview). No `from`-signed envelope was constructed.

```text
to:          0x8004A818BFB912233c491871b3d84c89A494BD9e  (verified registry)
chainId:     97  (BNB Smart Chain Testnet)  — live-confirmed
from:        0x299Ce4113abF88F4997737184aa8A7a3D58AC15C  (signer / provider EOA)  — EOA confirmed on-chain
functionName: register
agentURI:    https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
data:        0xf2c298be0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000005068747470733a2f2f626e622d6167656e742d6d61726b6574706c6163652d7765622e76657263656c2e6170702f2e77656c6c2d6b6e6f776e2f6167656e742d726567697374726174696f6e2e6a736f6e00000000000000000000000000000000
dataHash:    0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4  — matches X.20
value:       0 (0x0)
type:        eip1559 (chain 97 supports EIP-1559; final selection at submission)
accessList:  []
signedTx:    ABSENT (no envelope constructed)
```

## Target Constraint Confirmation

The transaction **can only target**:

- **Chain:** 97 — pinned by `ERC8004_CHAIN_ID` inside the pure preview builder
  (a different chain id is a blocked preview) **and** independently confirmed by
  a live `eth_chainId` read in this review.
- **Contract:** `0x8004A818BFB912233c491871b3d84c89A494BD9e` — pinned by
  `ERC8004_REGISTRY` (a different target is a blocked preview) **and** confirmed
  on-chain to be a deployed contract (130 bytes) whose EIP-1967 implementation
  slot equals the verified implementation `0x7274e874CA62410a93Bd8bf61c69d8045E399c02`.

No calldata, value, or target other than the verified chain-97 + registry pair
can be produced by this review path.

## Fields Not Final At Review Time (re-derived at submission)

Per fail-closed policy, the following are network/signer-dependent and MUST be
re-read immediately before any signing step is permitted:

```text
nonce:                      NOT FINAL — pending snapshot was 1; re-read eth_getTransactionCount before signing
gasLimit:                   NOT FINAL — eth_estimateGas returned 203581; re-estimate at submission
maxPriorityFeePerGas:       NOT FINAL — RPC snapshot only
maxFeePerGas:               NOT FINAL — must be >= gasPrice market snapshot (100000000) at submission
type & accessList:          NOT FINAL — selected at submission from chain-97 fee market
```

No value in the transaction is guessed: any parameter that could not be
authoritatively established is explicitly listed as NOT FINAL and left for the
operator-gated submission step.

## Focused Tests And Gates

```text
X.22 registration approval review verify: 16/16 PASS (+ fresh live chain-97 snapshot)
X.21 registration transaction review verify: 7/7 PASS (+ live chain-97 snapshot)
X.20 canonical registration preview verify: 17/17 PASS
X.16 registration preview verify: 19/19 PASS
Typecheck: PASS
Lint: PASS (re-run below as final gate)
Build: PASS
```

## X.22 Status

```text
X.22 STATUS:
TRANSACTION REVIEW: PASS
CHAIN: VERIFIED (97 — BNB Smart Chain Testnet; live eth_chainId = 0x61)
REGISTRY: VERIFIED (0x8004A818BFB912233c491871b3d84c89A494BD9e — deployed contract, EIP-1967 impl slot matches verified implementation)
PROVIDER EOA: VERIFIED (0x299Ce4113abF88F4997737184aa8A7a3D58AC15C)
PROVIDER CLASSIFICATION: EOA (on-chain eth_getCode = 0x)
METADATA URI: VERIFIED (https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json)
FUNCTION: VERIFIED (register(string))
CALLDATA HASH: VERIFIED (0x00d53c8e13940e3a2e8361495fe9b3a6fcceab0ffd625f2beb200e102f5f81a4 — matches X.20)
NONCE: NOT FINAL (pending snapshot 1; re-derive at submission)
GAS ESTIMATE: NOT FINAL (eth_estimateGas 203581; re-derive at submission)
FEE INFORMATION: NOT FINAL (maxPriorityFeePerGas 100000000, gasPrice 100000000 — snapshots; set at submission)
VALUE: VERIFIED (0)
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
ERC-8004 REGISTRATION: NOT PERFORMED
AGENT ID: NOT ASSIGNED
ERC-8183 JOB: NOT CREATED
PAYMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

## Verdict

**READY** — the transaction is approved for operator-gated submission, pending
re-derivation of the live nonce / gas / fee fields at submission time. X.22 stops
here: no signing, no broadcast, no registration was performed.

## Files Changed

- `packages/integrations/src/altana/registration-approval.review.verify.ts`:
  new focused X.22 approval review (deterministic transaction assertions +
  fresh read-only chain-97 verification including bytecode reads; no signer, no
  write path).
- `packages/integrations/package.json`: added `altana:x22:review` script.
- `docs/review/Main-Track-Activation-X22-Registration-Approval.md`: this report.

No production application code, X.13 service, or metadata was changed. Changes
are not committed or pushed.

## Next Legitimate Milestone (operator-gated)

Only upon explicit operator approval, as separate steps: (a) re-derive the live
nonce, gas limit, and fee fields, (b) sign the calldata offline with the
verified provider EOA outside this review path, (c) broadcast the ERC-8004
`register(string)` transaction to the verified registry on chain 97, and (d) from
the registration receipt, derive the assigned `agentId`. Each step remains gated
and out of scope for X.22, which stops here awaiting operator approval.
