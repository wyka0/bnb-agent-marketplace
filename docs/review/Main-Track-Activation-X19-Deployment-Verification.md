# Main Track Activation X.19: Deployment Verification (Vercel Production)

**Date:** 2026-08-13
**Mode:** Read-only deployed-service verification
**Network:** BNB Smart Chain Testnet, chain 97
**Transaction execution:** None

## Outcome

X.19 **PASSES**. The real public canonical HTTPS origin is now live and
reachable. The deployed root, canonical metadata document, and X.13 service
endpoint were all verified read-only over HTTPS against the production origin.
No code changed, no transaction was sent, and nothing was signed or broadcast.

X.13 application behavior remains unchanged.

## PUBLIC HTTPS ORIGIN

```text
https://bnb-agent-marketplace-web.vercel.app
```

Explicitly supplied, HTTPS, host-only (no path/credentials/query/fragment), and
reachable. This is the production Vercel origin for the `@bnb-marketplace/web`
application.

## ROOT STATUS

```text
GET https://bnb-agent-marketplace-web.vercel.app/
HTTP 200
```

## METADATA STATUS

```text
GET https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
HTTP 200
Content-Type: application/json
Valid JSON: yes
```

Returned document:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "BNB Testnet Wallet Snapshot",
  "description": "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.",
  "services": [
    {
      "name": "web",
      "endpoint": "https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service",
      "version": "1"
    }
  ],
  "x402Support": false,
  "active": false,
  "supportedTrust": []
}
```

The document remains intentionally honest and inactive (`active:false`,
`x402Support:false`, no agent ID, no unsupported capability claim). Its
`services[0].endpoint` matches the canonical service URI exactly.

## SERVICE STATUS

```text
POST https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service
Content-Type: application/json
Body: {"wallet":"0x0000000000000000000000000000000000000001"}
HTTP 200
```

Structured ready response:

```json
{
  "state": "ready",
  "chainId": 97,
  "wallet": "0x0000000000000000000000000000000000000001",
  "nativeBalanceWei": "32357242462067832979"
}
```

Error contract probe (malformed wallet) returned a structured 4xx, not a raw
unexpected 5xx:

```text
POST {"wallet":"0x123"}
HTTP 400
{"ok":false,"reason":"invalid-wallet"}
```

The service is dynamically served (`force-dynamic`, `no-store`); no stale
cache artifact was observed.

## CANONICAL METADATA URI

```text
https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
```

Resolves to the canonical origin path served by the deployed app. The metadata
`serviceEndpoint` is canonical:

```text
https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service
```

## PROVIDER EOA STATUS

Carried from the X.18 read-only RPC evidence (unmodified; no new chain
interaction was required for endpoint verification):

```text
Provider: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
Provider bytecode: 0x
Classification: EOA
```

No private key was derived, read, or displayed.

## PRICE STATUS

Carried from the X.18 configuration evidence (unmodified):

```text
PRICE CONFIGURATION: PASS
TOKEN: U
DECIMALS: 18
PRICE: 1 U
RAW PRICE: CONFIGURED / REDACTED (server-only ALTANA_SERVICE_PRICE_RAW_U)
```

## REGISTRATION INPUTS STATUS

Verified public inputs available as of X.19:

- chain ID `97`;
- provider EOA `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`;
- registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`;
- implementation `0x7274e874ca62410a93bd8bf61c69d8045e399c02`;
- Sourcify-verified `register(string agentURI)` ABI;
- approved service price `1 U` in server-only raw units;
- canonical public HTTPS metadata URI `https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json`;
- canonical public HTTPS service endpoint `https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service`.

The canonical-origin consistency required for registration is satisfied: the
deployed metadata URI and service endpoint both live at the same canonical
origin at the exact paths the preview validation enforces.

## X.19 Status

```text
X.19 STATUS:
PUBLIC HTTPS ORIGIN: PASS
ROOT STATUS: PASS
METADATA STATUS: PASS
SERVICE STATUS: PASS
CANONICAL METADATA URI: PASS
PROVIDER EOA STATUS: PASS
PRICE STATUS: PASS
REGISTRATION INPUTS STATUS: READY (all required inputs present)
REGISTRATION CALLDATA: NOT GENERATED
SIGNING: NOT PERFORMED
BROADCAST: NOT PERFORMED
ERC-8004 REGISTRATION: NOT PERFORMED
ERC-8183 JOB: NOT CREATED
PAYMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

## Next Legitimate Milestone

The deployed canonical service and metadata are verified and consistent. The
next legitimate milestone is the ERC-8004 registration step (X.17 continuation):
build the deterministic unsigned registration preview
(`register(string agentURI)` against the verified registry/implementation on
chain 97, using the canonical metadata URI and the approved `1 U` server-only
price), present the unsigned preview for review, sign the calldata with the
verified provider EOA, and broadcast the registration transaction — each as a
separate explicit operator-approved step. Signing, broadcast, registration, and
any ERC-8183 job creation remain out of scope for X.19 and were not performed.