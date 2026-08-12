# Main Track Activation X.13: Proven Testnet Service

**Date:** 2026-08-13
**Mode:** Minimum evidence-backed implementation
**Network:** BNB Smart Chain Testnet, chain 97
**Writes:** None

## 1. Outcome

X.13 implemented the part of the provider architecture that can be proven from
the repository and installed SDK: a deterministic, repeatable, read-only
chain-97 wallet snapshot service and an explicitly inactive ERC-8004 metadata
preview.

It did not create or claim:

- an ERC-8004 identity;
- a registered provider;
- an approved service price;
- registration calldata;
- an ERC-8183 job action;
- x402 payment terms;
- an activatable marketplace listing.

`resolveAgentActivationCapability` remains unchanged and returns `null` for real
records without verified capability data. This prevents the new local service
from being represented as registered or hireable.

## 2. Implemented Service

Endpoint:

```text
POST /api/agents/bnb-testnet-risk/service
```

Input:

```json
{ "wallet": "0x...", "chainId": 97 }
```

`chainId` is optional, but when supplied it must equal `97`. Chain `56` and all
other values are rejected. The wallet must be a non-zero 40-hex EVM address.

The service performs exactly one read-only JSON-RPC call against the SDK's
`BNB_TESTNET.publicRpcUrl`:

```text
eth_getBalance(wallet, "latest")
```

Successful response:

```text
state
chainId = 97
wallet
nativeBalanceWei
```

RPC failures return `503` with an explicit unavailable state. No balance is
substituted or fabricated. Requests are capped at 1 KiB, responses are
`no-store`, and the service accepts no private key, arbitrary RPC URL, contract,
calldata, token, payment, or action parameter.

The name is deliberately **BNB Testnet Wallet Snapshot**, not “portfolio risk”:
the current evidence supports native-balance retrieval only. It does not support
token enumeration, portfolio valuation, liquidation risk, or recommendations.

## 3. Metadata Preview

Endpoint:

```text
GET /.well-known/agent-registration.json
```

The route requires an HTTPS request origin and otherwise returns a blocked
state. The generated registration-v1-shaped document includes only official
top-level fields used by Draft ERC-8004:

- `type`;
- `name`;
- `description`;
- one `web` service endpoint;
- `x402Support: false`;
- `active: false`;
- empty `supportedTrust`.

It intentionally contains no registration ID, registry entry, provider wallet,
price, x402 claim, image, transaction, or non-standard capability field. The
document remains inactive until an authoritative registration ABI, registered
identity, canonical public origin, provider identity, and real price are
verified.

## 4. Authoritative Evidence Reused

- SDK `BNB_TESTNET.chainId = 97` and public testnet RPC configuration.
- Verified chain-97 ERC-8183 contract set and `$U` remain unchanged.
- Existing X.6 capability classifier and hire pipeline remain the sole
  activation boundary.
- Existing X.4B and X.4C remain the required review/consent boundaries.
- Existing mainnet rejection remains unchanged.

No registry ABI or registration selector was introduced because the installed
SDK exports only the deployed registry address, not a proven registration
interface for that deployment.

## 5. Files

Added:

- `apps/web/lib/agents/bnb-testnet-risk/service.ts`
- `apps/web/lib/agents/bnb-testnet-risk/metadata.ts`
- `apps/web/lib/agents/bnb-testnet-risk/service.verify.ts`
- `apps/web/lib/agents/bnb-testnet-risk/service.live.verify.ts`
- `apps/web/app/api/agents/bnb-testnet-risk/service/route.ts`
- `apps/web/app/.well-known/agent-registration.json/route.ts`

Modified:

- `apps/web/package.json` (X.13 verification scripts only)

## 6. Status

```text
X.13 STATUS:
READ-ONLY SERVICE: IMPLEMENTED
SERVICE ENDPOINT: READY
CHAIN: 97 ONLY
LIVE RPC READ: VERIFIED
METADATA PREVIEW: READY / INACTIVE
PROVIDER EOA: NOT DERIVED OR CLAIMED
ERC-8004 IDENTITY: NOT REGISTERED
REGISTRATION ABI: BLOCKED — authoritative deployed ABI absent
REGISTRATION CALLDATA: NOT GENERATED
PRICE: BLOCKED — no approved real raw-$U value
CAPABILITY RESOLVER: HONESTLY BLOCKED
ERC-8183 ACTION: BLOCKED
X.4B REAL ACTION: BLOCKED
X.4C REAL CONSENT: BLOCKED

SIGNING: NOT PERFORMED
PAYMENT: NOT PERFORMED
BROADCAST: NOT PERFORMED
REGISTRATION: NOT PERFORMED
JOB CREATION: NOT PERFORMED
MAINNET: NOT TOUCHED
GIT COMMIT/PUSH: NOT PERFORMED
```

## 7. Exact Blocker

The service is real and read-only, but it cannot become an activatable agent
until an explicit operator-owned raw-`$U` price, canonical public HTTPS origin,
verified provider identity, and authoritative ABI for the deployed chain-97
ERC-8004 registry are supplied and independently verified.
