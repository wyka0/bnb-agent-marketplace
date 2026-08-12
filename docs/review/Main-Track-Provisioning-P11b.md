# MAIN TRACK P11b — Single Read-Only Execution-Class Probe

Date: 2026-08-11

## 1. Endpoint

`https://erc8004.heyanon.ai/mcp/aave`

## 2. Tool Called

Exactly one MCP request was sent:

- method: `tools/call`
- name: `getAaveV3SupportedChains`
- arguments: `{}`

No second tool was called and no retry was attempted.

## 3. Probe Purpose

Determine whether this read-only execution-class MCP call requires x402 and,
if so, capture the live public payment terms without paying or signing.

## 4. Response Status

- HTTP status: **201 Created**
- MCP: JSON-RPC success result, request id `1`
- content type: `application/json; charset=utf-8`
- sanitized response length: 1,136 bytes
- payment/authentication headers returned: none

## 5. x402 Required

**NO for this probe.**

The server returned the tool result directly. It did not return HTTP 402, a
payment challenge, `PAYMENT-REQUIRED`, `WWW-Authenticate`, or payment terms.
This proves only that `getAaveV3SupportedChains` did not require x402 for this
request. It does not prove that other tools are free.

## 6. Payment Terms

None returned. Therefore no payment protocol, network, token, amount,
recipient, facilitator, expiry, payment header, signature requirement, or
paid-resource URL was supplied by this response.

## 7. Signing Requirements

None returned. The result contained no signing request, signature placeholder,
wallet instruction, authorization payload, or typed data.

## 8. apiRequestActions Structure

- `apiRequestActions`: absent
- `toSign`: absent

The result shape was:

```text
result
├── content[]
│   ├── type: "text"
│   └── text: serialized result
└── structuredContent
    ├── project: "aave"
    ├── operation: "getAaveV3SupportedChains"
    └── data[]: { chainId, chainName }
```

The returned read-only data listed 11 supported Aave V3 chains: Ethereum,
Arbitrum, Avalanche, Optimism, Polygon, Metis, Base, BSC (chain 56), Scroll,
Gnosis, and Plasma.

## 9. Security Result

Safety constraints were satisfied:

- one request only;
- exact requested tool only;
- no automatic retry;
- no authorization, credentials, cookies, payment payload, private data, or
  secret token sent;
- no returned action followed;
- no wallet connected;
- no private key provided;
- no payment or signature attempted.

The audit script is one-shot and has no retry, payment, signing, wallet, or
returned-action execution path.

## 10. Whether Any Payment Occurred

**NO.** No payment was requested or sent.

## 11. Whether Any Signature Occurred

**NO.** No signing request was returned and nothing was signed.

## 12. Whether Any Transaction Occurred

**NO.** The tool returned static protocol support data. No calldata,
transaction request, broadcast, receipt, or transaction hash appeared.

## 13. P12 Prerequisites

1. Treat x402 as tool-specific or operation-specific, not globally required:
   this query was free, while the official server guide says other
   `tools/call` operations may require x402.
2. Implement explicit HTTP 402 handling without assuming a challenge will be
   returned for every call.
3. Add a local wallet signing boundary only for responses that actually
   contain `apiRequestActions` / `toSign`; never request a signature for this
   result shape.
4. Keep transaction review and signing separate from read-only query results.
5. Do not infer paid-operation terms from this free query. Amount, token,
   network, payTo, facilitator, timeout, and required payment headers remain
   unknown for tools that are actually payment-gated.

## FINAL STATUS

P11b STATUS:
NO X402 REQUIRED FOR PROBE
