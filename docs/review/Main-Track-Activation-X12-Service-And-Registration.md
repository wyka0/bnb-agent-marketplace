# Main Track Activation X.12: Service and Registration

**Date:** 2026-08-13
**Result:** BLOCKED at mandatory pre-implementation gates
**Transactions:** None

## X.12 Status

```text
X.12 STATUS:
SERVICE: BLOCKED
SERVICE ENDPOINT: BLOCKED
PROVIDER EOA: BLOCKED
METADATA: BLOCKED
PRICE: BLOCKED
REGISTRY: VERIFIED
REGISTRATION ABI: BLOCKED
REGISTRATION PREVIEW: BLOCKED
ERC-8183 INTEGRATION: BLOCKED
X.4B: BLOCKED
X.4C: BLOCKED

REGISTRATION TRANSACTION:
NOT BROADCAST

JOB:
NOT CREATED

PAYMENT:
NOT PERFORMED

SIGNING:
NOT PERFORMED

BROADCAST:
NOT PERFORMED

MAINNET:
NOT TOUCHED

GIT:
NOT COMMITTED
NOT PUSHED
```

## Exact Blocker

No approved server-only raw-`$U` service price is configured, and the repository
contains no authoritative ABI proven compatible with the deployed chain-97
Identity Registry; assigning a price or encoding registration calldata would
therefore fabricate required inputs.

## 1. Price Gate

X.11 established the legitimate price architecture:

```text
explicit operator configuration or signed provider quote
  -> exact AgentActivationCapability amount
  -> exact ERC-8183 budget
  -> setBudget / approve / fund
```

X.12 searched repository source, environment templates, documentation, and the
ignored local environment for an approved production service-price setting.
None of these candidate variables is configured:

- `ALTANA_SERVICE_PRICE_USD_RAW`;
- `ALTANA_SERVICE_PRICE_U_RAW`;
- `ALTANA_SERVICE_PRICE_RAW`;
- `SERVICE_PRICE_USD_RAW`.

The SDK sample amount, test fixtures, and historical job `1` budget are not a
price for this service and were not reused. No default value was introduced.

```text
PRICE CONFIGURATION REQUIRED
```

## 2. Registry ABI Gate

Verified deployment facts carried forward from X.11:

- chain: BNB Smart Chain Testnet `97`;
- Identity Registry:
  `0x8004A818BFB912233c491871b3d84c89A494BD9e`;
- deployed registry bytecode: present;
- address matches `@altananetwork/sdk@0.7.0` and repository configuration.

The repository contains no registry ABI, Solidity interface, registration
adapter, deployment artifact, or package export for ERC-8004 registration. The
installed Altana SDK exports only the registry address for this purpose; it does
not export `register`, `setAgentURI`, or agent-wallet operations.

The current Draft ERC-8004 specification documents overloads such as
`register(string)` and `register(string, MetadataEntry[])`, but X.11 already
classified compatibility of that draft ABI with the deployed chain-97 registry
as unverified. Specification text alone is not sufficient to encode a real
registration transaction for an independently deployed contract.

No ABI was invented, no selector was guessed, no simulation was sent, and no
registration preview was produced.

## 3. Provider Gate

The provider architecture remains evidence-backed:

- ERC-8183 accepts an address as provider;
- chain-97 job `1` demonstrates an EOA provider with no bytecode;
- no seller contract is required.

However, X.12 did not derive or expose the configured signer address because the
price and registry ABI gates had already failed. Consequently the intended
operator-controlled provider EOA was not independently cross-checked against the
registration owner/agent-wallet model in this phase.

## 4. Why Service Code Was Not Added

The requested endpoint and registration document are intended to become the
public capability of a registrable agent. X.12 explicitly requires stopping if
the price or official registration input is missing. Adding only a local endpoint
would not satisfy the complete evidence-backed registration path and would create
new code after a mandatory stop condition.

Therefore X.12 did not add:

- `/api/agents/bnb-testnet-risk/service`;
- an ERC-8004 registration document;
- capability-resolution data;
- registration calldata;
- an X.12 verification suite;
- client or server secret-handling code.

Existing X.6/X.4B/X.4C behavior remains unchanged and honestly blocked for the
unregistered provider.

## 5. Security Incident

During the pre-implementation audit, a direct read of the ignored `.env.local`
file rendered configured testnet credential values in the tool transcript. The
values are not repeated in this report and were not used for signing, address
derivation, RPC writes, or any transaction.

Both affected credentials must be treated as exposed and rotated before any
future signing or facilitator milestone:

- the configured BNB-testnet operator private key;
- the configured facilitator private key.

The ignored file remains unmodified. No credential was copied into source,
metadata, an API response, browser code, logs produced by application code, or
Git.

## 6. Verification and Tests

No implementation was permitted after the mandatory gates failed. Accordingly:

- no X.12 implementation tests were added;
- no build/typecheck/lint regression was necessary for application code;
- no existing suite was weakened or deleted;
- no live service or registration claim is made.

## 7. Required Inputs to Resume

1. The operator must explicitly approve and configure the actual service price
   as a positive raw 18-decimal `$U` amount under a server-only variable.
2. Obtain the authoritative ABI/source for the exact deployed chain-97 Identity
   Registry, then verify its bytecode/interface and registration overload through
   read-only calls or simulation.
3. Rotate the two exposed testnet credentials and retain them only in ignored or
   secret-manager configuration.
4. Independently derive only the replacement public operator/provider and
   facilitator addresses before implementation.

Only after those inputs exist may a later milestone implement the deterministic
service, stable registration document, unsigned registration preview, and
post-registration capability integration.

## Stop

No endpoint, metadata, price, registration calldata, job action, payment,
approval, signing, broadcast, settlement, deployment, mainnet interaction,
commit, or push was performed.
