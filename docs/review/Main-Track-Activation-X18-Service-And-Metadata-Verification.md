# Main Track Activation X.18: Service And Metadata Verification

**Date:** 2026-08-13
**Mode:** Read-only deployed-service prerequisite verification
**Network:** BNB Smart Chain Testnet, chain 97
**Transaction execution:** None

## Outcome

X.18 is **BLOCKED** because no real public HTTPS deployment origin was supplied
or configured. The value in the milestone request,
`<PASTE THE ACTUAL DEPLOYED HTTPS ORIGIN HERE>`, is a literal placeholder and
fails URL validation. It was not used for an HTTP request.

The ignored server configuration was checked by name and validation state only.
No value exists under `PUBLIC_HTTPS_ORIGIN`, `NEXT_PUBLIC_APP_URL`, `APP_URL`,
`PUBLIC_APP_URL`, or `VERCEL_URL`. X.18 therefore cannot verify a deployed X.13
service or canonical metadata document and must not generate registration
arguments or calldata.

X.13 application behavior remains unchanged.

## Public HTTPS Origin

Required form:

```text
https://<real-public-host>
```

The origin must be explicitly supplied, use HTTPS, contain no path, credentials,
query, or fragment, and must not be localhost, loopback, a private IP, or a
placeholder. No candidate meeting those requirements is configured.

```text
PUBLIC_HTTPS_ORIGIN: ABSENT
REQUEST VALUE: PLACEHOLDER / REJECTED
HTTP REQUEST: NOT SENT
```

## X.13 Service Evidence

The local X.13 implementation remains the verified read-only chain-97 wallet
snapshot service at:

```text
POST /api/agents/bnb-testnet-risk/service
```

Without a real public origin, X.18 cannot form or request the deployed endpoint.
Consequently it did not claim reachability, content type, chain rejection,
arbitrary-RPC rejection, deterministic deployed behavior, or deployed secret
isolation. Those local behaviors remain covered by the existing X.13 tests, but
local tests are not evidence of a public deployment.

## Metadata Evidence

The required canonical URI would be:

```text
<PUBLIC_HTTPS_ORIGIN>/.well-known/agent-registration.json
```

Because the origin is missing, no metadata request was sent. X.18 cannot verify
deployed JSON, content type, service endpoint origin, deterministic response,
provider/price fields, or public secret isolation.

The local X.13 metadata remains intentionally inactive and honest:

- `active:false`;
- `x402Support:false`;
- no registration ID;
- no agent ID;
- no provider, price, or unsupported capability claim.

No local metadata field was changed.

## Price Evidence

Presence-only validation confirms that `ALTANA_SERVICE_PRICE_RAW_U` exists in
ignored server configuration and remains a positive decimal integer. Per the
operator's approved configuration, it represents exactly `1 U` for the verified
18-decimal chain-97 token. The raw environment string is not reproduced.

```text
PRICE CONFIGURATION: PASS
TOKEN: U
DECIMALS: 18
PRICE: 1 U
RAW PRICE: CONFIGURED / REDACTED
```

## Provider Evidence

A fresh read-only RPC check returned:

```text
Chain: 97
Provider: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
Provider bytecode: 0x
Classification: EOA
```

No private key was derived or displayed in X.18.

## Registry Evidence

A fresh read-only RPC check confirmed non-empty bytecode at:

```text
Registry: 0x8004A818BFB912233c491871b3d84c89A494BD9e
Chain: 97
Bytecode: PRESENT
Implementation: 0x7274e874ca62410a93bd8bf61c69d8045e399c02
ABI source: Sourcify exact creation/runtime match
```

No contract function was called in a state-changing mode.

## Registration Inputs

Verified public inputs currently available:

- chain ID `97`;
- provider EOA `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`;
- registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`;
- implementation `0x7274e874ca62410a93bd8bf61c69d8045e399c02`;
- Sourcify-verified `register(string agentURI)` ABI;
- approved service price `1 U` in server-only raw units.

Missing authoritative input:

- real, reachable canonical public HTTPS metadata URI.

Registration arguments and calldata are therefore blocked. No URL was guessed
and no local/placeholder URL was encoded.

## X.18 Status

```text
X.18 STATUS:
PUBLIC HTTPS ORIGIN: FAIL
X.13 SERVICE: FAIL (public deployment unavailable for verification)
METADATA: FAIL (canonical deployed document unavailable)
PROVIDER EOA: PASS
REGISTRY: PASS
CANONICAL METADATA URI: FAIL
PRICE CONFIGURATION: PASS
REGISTRATION INPUTS: BLOCKED
REGISTRATION CALLDATA: NOT GENERATED
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
ERC-8004 REGISTRATION: NOT PERFORMED
ERC-8183 JOB: NOT CREATED
PAYMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

## Exact Blocker

`PUBLIC_HTTPS_ORIGIN` must be replaced with the actual deployed HTTPS origin.
The supplied placeholder is not a URL, and no real origin is present in server
or deployment configuration. Until that origin exists and both deployed
endpoints are reachable, metadata and registration inputs cannot be verified.

## Next Legitimate Milestone

Supply the actual public HTTPS origin. A read-only continuation can then request
the deployed service and metadata endpoints, verify their response contracts,
and prepare deterministic registration arguments. It must still stop before
calldata signing, registration, or broadcast.
