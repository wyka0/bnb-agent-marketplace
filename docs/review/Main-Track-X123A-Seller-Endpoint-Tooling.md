# X.123A Real Seller Endpoint Tooling

**Mode:** Isolated testnet seller tooling only. No ERC-8004 registration, ERC-8183 job, funding, buyer action, marketplace production change, commit, push, or deployment was performed.

## Results

- SDK runtime: **PASS**
- cloudflared: **PASS**
- Seller start: **PASS**
- Local `/negotiate`: **PASS**
- Provider signature: **PASS**
- Quote verification: **PASS**
- HTTPS tunnel: **PASS**
- Public `/negotiate`: **PASS**
- Exposure audit: **PASS**

## Seller / Runtime

- Seller address: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Chain: BSC Testnet / `97`
- Provider: `@bnbagent/sdk@0.5.1` `EVMWalletProvider`
- Wallet: password-only encrypted Keystore V3 reload
- `PRIVATE_KEY`: absent
- Seller process: isolated `services/v2-seller/seller.ts`
- Local port: `127.0.0.1:3000`
- Local `/health`: `200`, `{"status":"ok","chain":97}`

The isolated service was given its own `services/v2-seller/package.json` and `tsconfig.json` so it can resolve the official SDK independently of marketplace production packages. The seller imports `ERC8183Client`, `ERC8183JobOps`, `NegotiationHandler`, and `fundedJobWatcher` from the official `@bnbagent/sdk/erc8183` subpath, and `EVMWalletProvider`/`loadEnv` from the root SDK.

## Local Negotiation

The official `NegotiationRequest.toDict()` shape was posted to:

`http://127.0.0.1:3000/negotiate`

Result:

- HTTP `200`
- Accepted quote: `true`
- Price: `1000000000000000000` raw units (1 U)
- Chain: `97`
- Verifying contract: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`
- Quote expiry: future, 900-second SDK TTL
- `provider_sig`: present
- `negotiation_hash`: present
- Response contained no secret fields

The official SDK signer had to be passed explicitly to `NegotiationHandler.fromErc8183Client` as `walletProvider: wallet`; client construction alone does not automatically configure quote signing.

The malformed JSON path was also hardened in the isolated seller to return a safe `400` instead of terminating the service. This change is isolated to the seller and does not affect marketplace production.

## Provider Signature Verification

Using the official `verifyQuoteSignature` from `@bnbagent/sdk/erc8183`:

- Valid: `true`
- Method: `eip191`
- Signer: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Signer matches seller: `true`
- Chain binding: `97`
- Commerce binding: verified against the response’s official chain-97 commerce address
- Expiry: future

No transaction or buyer wallet was used.

## HTTPS Tunnel

`cloudflared` was provisioned locally as version `2026.8.2` from the official Windows release artifact. No Cloudflare account, named tunnel, or persistent credentials were created.

Actual quick-tunnel URL:

`https://nickel-pulse-spectacular-supplies.trycloudflare.com`

The tunnel forwards only to `http://127.0.0.1:3000`. The actual URL was added to local gitignored `.env.local` as `ERC8183_AGENT_URL`; no secret values were added.

## Public Negotiation

`POST https://nickel-pulse-spectacular-supplies.trycloudflare.com/negotiate` returned:

- HTTP `200`
- Accepted quote: `true`
- Provider signature: present
- Negotiation hash: present
- Chain: `97`
- Commerce contract: official chain-97 address
- Price: `1000000000000000000` raw units
- Future expiry: `true`
- Secret-field scan: no `PRIVATE_KEY`, `WALLET_PASSWORD`, `BEGIN`, `secret`, `mnemonic`, or `seed` fields

The same public response passed the official `verifyQuoteSignature` check with signer equal to the seller address.

## ERC-8004 Endpoint Metadata

The official SDK accepted the real tunnel URL through:

```ts
AgentEndpoint.a2a("https://nickel-pulse-spectacular-supplies.trycloudflare.com", {
  capabilities: ["erc8183-negotiate"],
});
```

It produced:

```text
name: A2A
endpoint: https://nickel-pulse-spectacular-supplies.trycloudflare.com/.well-known/agent-card.json
capabilities: erc8183-negotiate
```

No registration transaction was submitted. The endpoint metadata is ready for the next authorized ERC-8004 registration milestone.

## Exposure Audit

Public route results:

- `/health` → `200`
- `/negotiate` GET → `404` (POST-only)
- `/` → `404`
- `/.env.local` → `404`
- `/.env` → `404`
- `/package.json` → `404`
- `/services/v2-seller/seller.ts` → `404`
- `/.bnbagent/wallets/0xB0f...json` → `404`
- `/api/auth/me` → `404`
- `/marketplace` → `404`
- `/proxy/https://example.com` → `404`

The tunnel exposes only the isolated seller’s `/health` and POST `/negotiate` behavior. No filesystem, environment, keystore, marketplace, or arbitrary-proxy route is exposed.

## Seller Readiness

- Seller service: **PASS**
- Local `/negotiate`: **PASS**
- Public HTTPS: **PASS**
- Public `/negotiate`: **PASS**
- Provider signature: **PASS**
- Quote verification: **PASS**
- ERC-8004 endpoint metadata: **PASS**
- Chain: `97`
- ERC-8004 registration: **NOT PERFORMED**
- ERC-8183 publication/job/funding: **NOT PERFORMED**

## Next Step

Proceed only with the separately authorized ERC-8004 registration milestone using the real public endpoint. Do not create or fund an ERC-8183 buyer job in X.123A.
