# X.123 Real Testnet Seller Endpoint

**Mode:** Read-only preflight. No seller endpoint was exposed, no tunnel was created, no registration, job, funding, transaction, marketplace change, commit, push, or deployment was performed.

## Seller Preflight

- Seller address: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Address match: **PASS**
- Wallet source: encrypted Keystore V3, password-only reload — **PASS**
- `PRIVATE_KEY`: absent — **PASS**
- `WALLET_PASSWORD`: present — value not printed
- `NETWORK`: `bsc-testnet` — **PASS**
- Chain: `97` — **PASS**
- Keystore exists: **PASS**

## Local Seller Service

The isolated scaffold exists at `services/v2-seller/seller.ts` and contains:

- `loadEnv()` before environment access
- `EVMWalletProvider`
- `NETWORK=bsc-testnet` guard
- `NegotiationHandler`
- provider-signing path
- `POST /negotiate`
- `fundedJobWatcher`

The repository does not declare `@bnbagent/sdk` as a workspace dependency, so the scaffold cannot be launched directly from the repository’s normal package context without using the separately staged SDK environment. No dependency was installed or added during X.123.

## Local Negotiation

- Local seller start: **BLOCKED** by isolated SDK/runtime availability in the repository context.
- `GET /health`: **NOT RUN**
- Local `POST /negotiate`: **NOT RUN**
- `providerSig`: **NOT RUN**
- `verifyQuoteSignature`: **NOT RUN**

No quote or signature was fabricated.

## HTTPS Tunnel

`cloudflared` availability check:

```text
CLOUDFLARED_MISSING
```

No temporary HTTPS endpoint was created. No substitute public tunnel or permanent server was used.

**PUBLIC HTTPS: BLOCKED**

## ERC-8004 Metadata

The official SDK requires at least one HTTP/HTTPS `AgentEndpoint` for `ERC8004Agent.generateAgentUri()`. No endpoint exists, so metadata readiness cannot be completed without inventing a URL.

- ERC-8004 endpoint metadata: **BLOCKED**
- Registration: not attempted

## Security

No public endpoint was exposed, so there was no new attack surface. The marketplace, `.env.local`, Keystore V3, filesystem, buyer services, and production APIs were not exposed.

## Final Classification

- SELLER SERVICE: **BLOCKED**
- LOCAL `/negotiate`: **BLOCKED**
- PUBLIC HTTPS: **BLOCKED**
- `providerSig`: **BLOCKED**
- `verifyQuoteSignature`: **BLOCKED**
- ERC-8004 endpoint metadata: **BLOCKED**
- cloudflared: **BLOCKED / NOT INSTALLED**

## Exact Next Prerequisites

1. Install or otherwise provision the approved `cloudflared` executable locally, or explicitly authorize another isolated HTTPS tunnel method.
2. Make the official `@bnbagent/sdk@0.5.1` available to the isolated seller runtime without modifying marketplace production dependencies.
3. Set a local `ERC8183_AGENT_URL` only after the real tunnel URL exists.
4. Start the seller, verify local `/negotiate`, expose only the seller port, verify public `/negotiate`, and then proceed to ERC-8004 registration in a later authorized milestone.

No registration, ERC-8183 publish, buyer action, transaction, production change, commit, push, or deployment occurred.
