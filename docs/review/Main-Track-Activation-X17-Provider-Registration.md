# Main Track Activation X.17: Provider Registration

**Date:** 2026-08-13
**Mode:** Read-only configuration and provider-path audit
**Network:** BNB Smart Chain Testnet, chain 97
**Transaction execution:** None

## Status

**BLOCKED at the operator price and public HTTPS deployment gates.**

X.17 audited the completed X.16 state and current ignored server
configuration. The operator/provider EOA remains verified, but the required
operator-owned raw-`$U` service price and canonical public HTTPS origin are not
configured. X.17 therefore stops before metadata publication, registration
calldata, signing, broadcast, 8004scan discovery, activation, ERC-8183 job
construction, X.4B review, or X.4C consent.

No X.13 file or activation behavior was changed.

## Done

### What Was Verified

- Chain remains BNB Smart Chain Testnet, chain ID `97`.
- ERC-8004 registry remains
  `0x8004A818BFB912233c491871b3d84c89A494BD9e`.
- Verified implementation remains
  `0x7274e874ca62410a93bd8bf61c69d8045e399c02`.
- Sourcify exact creation/runtime match remains the authoritative ABI source.
- The configured operator key is present but was not displayed or copied.
- The previously derived public provider remains
  `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`.
- `ALTANA_PAYTO` is publicly configured as the same nonzero provider address.
- Provider bytecode remains `0x` from the X.16 chain-97 read, establishing an
  EOA.
- The verified chain-97 `$U` token remains
  `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`.
- X.13 service and metadata remain read-only, chain-97-only,
  `active:false`, and `x402Support:false`.
- X.16's pure builder still pins `register(string agentURI)` from the verified
  ABI and fails closed without a positive price or canonical HTTPS origin.
- The activation capability resolver still returns `null`; it does not
  manufacture `ACTIVATABLE`.
- The hire pipeline still requires an explicit real capability before calling
  `prepareErc8183Hire`, review construction, and consent pinning.
- 8004scan integration remains public/keyless-safe; no API key is configured.

### Current Configuration Audit

Only names, presence states, and public addresses were inspected. No private
key, API key, or environment-file contents are reproduced.

```text
ALTANA_SERVICE_PRICE_RAW_U: ABSENT
ALTANA_OPERATOR_ADDRESS: ABSENT
ALTANA_FACILITATOR_ADDRESS: ABSENT
ALTANA_PAYTO: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
NEXT_PUBLIC_APP_URL: ABSENT
APP_URL: ABSENT
PUBLIC_APP_URL: ABSENT
VERCEL_URL: ABSENT
8004SCAN_API_KEY: ABSENT
ALTANA_TESTNET_PRIVATE_KEY: PRESENT / REDACTED
```

The facilitator private credential was not read or reported. Its existence is
not a substitute for the required public facilitator address.

## Blocked

### Price Evidence

```text
PRICE: BLOCKED
EXACT VALUE REQUIRED: ALTANA_SERVICE_PRICE_RAW_U
```

The required value is an explicit positive base-10 integer in raw `$U` units,
owned by server configuration. No default, historical budget, SDK example,
floating-point conversion, or guessed price may substitute for it.

### Metadata Evidence

No real canonical public HTTPS origin is configured. Consequently there is no
authoritative URL at which X.17 can verify:

- `/.well-known/agent-registration.json` reachability;
- HTTPS and content type;
- deterministic response bytes/JSON;
- the real public X.13 service endpoint;
- absence of private data at the deployed endpoint.

X.13's local metadata builder remains legitimate but intentionally inactive.
It is not evidence of a public deployment.

### Registration Evidence

The ABI and provider are verified, but the required `agentURI` is not. No
unsigned real registration calldata was generated. No registration transaction
was signed or broadcast. No receipt, event, token ID, or agent ID exists from
this milestone.

### 8004scan Evidence

No registration has occurred, so no 8004scan agent record can be claimed.
Public API support exists in the repository; `8004SCAN_API_KEY` is absent and
authenticated verification was not attempted. Public discovery was not used to
invent a record for an unregistered agent.

### ERC-8183 Evidence

The chain-97 Commerce, Router, Policy, Registry, and `$U` integration remain
verified from prior milestones. X.17 did not construct a hire action because:

- no registered/discoverable agent identity exists;
- no real service price exists;
- no real actionable capability exists;
- no current public facilitator address is configured;
- no real job ID or expiry was derived for an action.

No `createJob`, `registerJob`, `setBudget`, `approve`, `fund`, `hire`, or
settlement call was made.

### X.4B Evidence

The immutable review implementation remains verified by prior tests, but no
real X.17 action exists to review. No fixture values were promoted into a live
review.

```text
X.4B: BLOCKED UNTIL REAL REGISTERED PROVIDER AND ACTION EXIST
```

### X.4C Evidence

Consent pinning and mutation rejection remain implemented and verified, but no
real X.17 review exists to pin.

```text
X.4C: BLOCKED UNTIL REAL X.4B REVIEW EXISTS
```

## Not Performed

```text
METADATA DEPLOYMENT VERIFICATION: NOT PERFORMED
REGISTRATION PREVIEW: NOT GENERATED
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
ERC-8004 REGISTRATION: NOT PERFORMED
ERC-8004 AGENT ID: NOT ASSIGNED
8004SCAN REGISTRATION VERIFICATION: NOT PERFORMED
MARKETPLACE ACTIVATION: NOT PERFORMED
ERC-8183 JOB: NOT CREATED
TOKEN APPROVAL: NOT PERFORMED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
GIT: NOT COMMITTED / NOT PUSHED
```

## What Was Implemented

No code was added or changed in X.17. X.16 already supplies the correct
fail-closed price parser and deterministic unsigned-preview builder. Changing
activation, metadata, discovery, or hire code without the missing real inputs
would weaken the existing honesty boundaries.

## Test Results

No code changed in X.17, so the full suite was not rerun unnecessarily. The
current relevant baseline remains the completed X.16 result:

```text
X.16 focused verification: 19/19 PASS
X.13 verification: 12/12 PASS
X.13 live verification: READY
Hire verification: 23/23 PASS
Marketplace verification: 83/83 PASS
Marketplace live verification: 14/14 PASS
X.4B review verification: 16/16 PASS
X.4C consent verification: 11/11 PASS
Typecheck: PASS
Lint: PASS
Build: PASS
```

## Exact Remaining Blocker

Two authoritative operator/deployment inputs are missing:

1. A positive raw-`$U` decimal integer in server-only
   `ALTANA_SERVICE_PRICE_RAW_U`.
2. The actual public HTTPS deployment origin serving the X.13 application.

For later hire-review readiness, a public nonzero checksum
`ALTANA_FACILITATOR_ADDRESS` distinct from provider/pay-to and operator will
also be required. It is not needed to encode ERC-8004 registration, but it is
required before a real X.4B hire review.

## Next Legitimate Milestone

The operator supplies the exact raw-`$U` price and real public HTTPS origin.
The next unsigned/read-only continuation must then:

1. fetch and verify the deployed metadata and service endpoints;
2. rebuild and publish the sanitized deterministic `register(string)` preview;
3. stop for explicit registration approval before any signing or broadcast.
