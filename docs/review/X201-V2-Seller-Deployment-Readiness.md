# X.201 — V2 Seller Deployment Readiness Audit

**Date:** 2026-08-30 · **Mode:** READ-ONLY AUDIT · **Transactions:** ZERO · **Signatures:** ZERO · **Jobs created:** ZERO · **Job 787:** UNTOUCHED · **Agent 2005/1906:** UNTOUCHED · **AgentEndpoint:** UNCHANGED · **Production seller:** UNCHANGED · **Credentials:** NONE EXPOSED · **Commit/Push/Deploy:** NONE

> Read-only audit of `services/v2-seller` (the repo's known-good ERC-8183 seller) and what is required to deploy it as a durable HTTPS seller compatible with Agent 2005 / TermiX. No deployment, no POST to the external seller, no on-chain change, no secrets introduced.

---

## Executive summary

The repository contains a **known-good, containerized ERC-8183 seller** (`services/v2-seller/seller.ts` + `Dockerfile`) that implements `POST /negotiate` with SDK-generated quotes and provider signatures — the exact route the external `sslip.io` host is missing (X.200: `POST /erc8183/negotiate` → 404). However, deployment for **Agent 2005 / TermiX is BLOCKED** for three independent reasons:

1. **No durable hosting infrastructure is provisioned** in this repository or environment (no VPS/VM/account/domain; only a Dockerfile — Vercel cannot run a persistent `node:http` server with a keystore volume).
2. **Provider identity mismatch:** the v2 seller signs with wallet `0xB0f768…` (Agent 1906's owner), but Agent 2005's registered owner/provider is `0x0eAc2F4d…`. The marketplace verifies `provider_sig` signer **must equal** the agent's owner (main-track-negotiation.server.ts:364-365) → a v2-seller signature would fail verification for Agent 2005.
3. **On-chain AgentEndpoint update required** to point any new durable URL at the affected agents → requires an **on-chain transaction** (authorization needed; not performed).

---

## Existing seller architecture

- **Entry point:** `services/v2-seller/seller.ts` — standalone Node ESM, plain `node:http` server, **listens on port 3000** (hardcoded `server.listen(3000)`).
- **Wallet:** `EVMWalletProvider` at `0xB0f7681668f916eEd97dA066D31aA295D34727c0` (Agent 1906's owner), keystore V3 loaded from SDK path (`~/.bnbagent`), password from `WALLET_PASSWORD`.
- **State:** mostly stateless HTTP; a `fundedJobWatcher` long-lived poller (30s) submits deliverables for funded jobs assigned to this provider (persistent process requirement).
- **Routes:**
  - `GET /health` → `{ status:"ok", chain:97, seller:<address> }`
  - `GET /.well-known/agent-card.json` → EIP-8004 card; A2A endpoint built from `ERC8183_AGENT_URL`
  - `POST /negotiate` → SDK `NegotiationHandler` result `.toDict()` (accepted quote envelope)
  - everything else → 404 (verified: no `/erc8183` subpath, no HEAD/OPTIONS)
- **Dockerfile:** node:20-alpine + pnpm + tsx; `ENV NETWORK=bsc-testnet`, `ERC8183_SERVICE_PRICE=1000000000000000000`; `VOLUME /root/.bnbagent`; `EXPOSE 3000`; CMD `node --import tsx seller.ts`.
- **Env requirements (README):** `NETWORK=bsc-testnet` (required), `WALLET_PASSWORD` (secret, required), `ERC8183_AGENT_URL` (durable HTTPS URL, required), `ERC8183_SERVICE_PRICE` (default 1 U). `PRIVATE_KEY` only for first-run keystore creation, absent afterwards.
- **Tests:** none in `services/v2-seller`; `package.json` only has `typecheck`. Proven live historically via X.125/X.130 (jobs 622/641) when tunnel-hosted.

---

## Route inventory

| Route | Method | Response | Notes |
|---|---|---|---|
| `/health` | GET | 200 `{status:"ok",chain:97,seller}` | served at root only (not `/erc8183/health`) |
| `/.well-known/agent-card.json` | GET | 200 card | endpoint = `ERC8183_AGENT_URL` |
| `/negotiate` | POST | 200 quote envelope | SDK `NegotiationHandler` |
| other | any | 404 | no `/erc8183` subpath |

**Important path detail:** the v2 seller serves `/negotiate` and `/health` at the **root**, not under a `/erc8183` subpath. The marketplace POSTs `{registeredEndpoint}/negotiate`. If the registered AgentEndpoint is `https://host` (root), the marketplace hits `https://host/negotiate` ✅; if it's `https://host/erc8183`, it hits `https://host/erc8183/negotiate` ❌ (404). The registered endpoint path must therefore point at the seller's **root**, or the seller must mount routes under `/erc8183`.

---

## Marketplace ↔ seller contract comparison

| Aspect | Marketplace (`main-track-negotiation.server.ts`) | Seller (`services/v2-seller/seller.ts`) | Compatible |
|---|---|---|---|
| Request method/path | `POST {endpoint}/negotiate` | `POST /negotiate` | ✅ (if endpoint = root) |
| Request body | `{ task_description, terms }` (snake_case, `HIRE_TASK_DESCRIPTION`/`HIRE_TERMS`) | `NegotiationHandler.negotiate(JSON.parse(body))` (SDK snake_case) | ✅ (X.156 verified) |
| Timeout | 15s (`AbortSignal.timeout`) | synchronous handler | ✅ (fast, local) |
| Response schema | `accepted === true`, `chain_id`, `verifying_contract`, `provider_sig`, `negotiation_hash` | SDK `.toDict()` (same fields) | ✅ (X.125/X.130/X.156 proven) |
| Provider identity | `provider_sig` signer must equal `agent.owner_address` (line 364-365) | signs with `0xB0f768…` | ❌ **for Agent 2005** (owner `0x0eAc…`); ✅ only for an agent owned by `0xB0f768…` (e.g., Agent 1906) |
| Chain enforcement | chain 97 pinned (route + commerce) | `NETWORK=bsc-testnet`, SDK chain 97 | ✅ |
| Commerce/token | commerce `0xa206…`, $U `0xc70B…` | SDK `AgenticCommerce` network table | ✅ |
| Expiry | `quote_expires_at` must be future | SDK sets expiry | ✅ |

**Incompatibility identified: provider wallet identity for Agent 2005.** Everything else is contract-compatible.

---

## ERC-8183 compatibility

The v2 seller produces the full required negotiation surface via the official SDK `NegotiationHandler`: `accepted`, `price`, `currency`, `chain_id` (97), `verifying_contract` (commerce), `negotiation_hash`, `provider_sig` (EIP-191, signer = seller wallet), `quote_expires_at`. It supports chain 97 / BSC Testnet natively. **Compatible with the marketplace verifier** for any agent whose registered owner equals the seller wallet `0xB0f768…`. **Not compatible with Agent 2005** (owner `0x0eAc…`).

---

## Agent 2005 compatibility

- Agent 2005: `97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005` — Canned Range Keeper.
- Owner/provider (on-chain, read-only): `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a`.
- Registered endpoint: `https://range-keeper.103-195-188-198.sslip.io/erc8183` (external, stale — no `/negotiate`).
- The v2 seller signs with `0xB0f768…` ≠ `0x0eAc…` → **cannot serve Agent 2005** without Agent 2005's owner private key (which is not available and must never be introduced). Serving an agent requires the seller wallet == that agent's registered owner.
- The v2 seller **can** serve an agent it owns (e.g., Agent 1906, owner `0xB0f768…`), but Agent 1906's on-chain AgentEndpoint is dead (trycloudflare tunnel) and would need re-pointing (on-chain tx).

---

## Deployment requirements

- **HTTPS:** required (marketplace resolves only HTTPS endpoints — `resolveServiceEndpointFromCard` requires `https://`).
- **Public URL:** required (`ERC8183_AGENT_URL`).
- **Persistent process:** required — `node:http` server + long-lived `fundedJobWatcher` (30s poll) + mounted keystore volume. **Vercel serverless is NOT suitable** (ephemeral, no persistent volume, no long-lived TCP listener). A VPS/VM or always-on container host (Render/Railway/Fly.io/Cloud Run/ECS) is required.
- **Port:** 3000 (EXPOSE 3000).
- **DNS:** a stable domain/HTTPS URL pointing to the host (no `sslip.io`).
- **CORS:** not required — the marketplace requests server-side (Vercel function → seller); no browser origin.
- **Cold-start risk:** only if the host sleeps (avoid sleep/scale-to-zero for a watcher-based seller).
- **Timeout risk:** marketplace 15s timeout; local negotiation is fast, so low risk on an always-on host.
- **Env:** `NETWORK=bsc-testnet`, `WALLET_PASSWORD` (secret), `ERC8183_AGENT_URL`, `ERC8183_SERVICE_PRICE`.
- **Keystore:** mounted volume at `/root/.bnbagent`, never baked into the image.

---

## Security findings

| Item | Status |
|---|---|
| Private key handling | `PRIVATE_KEY` only on first-run keystore creation; keystore V3 on mounted volume, never in image/source. **Good** |
| Provider signing | SDK `EVMWalletProvider` signs; no raw key in process after construction. **Good** |
| CORS | none set; not needed (server-to-server). **OK** |
| Request validation | `JSON.parse(body)` in try/catch → 400 `{error:"invalid negotiation request"}` on malformed JSON. **Good** |
| Oversized request handling | `for await (const chunk of req) body += chunk` with **no size cap** — potential memory DoS. **Finding (low)** — recommend a body-size limit |
| Replay protection / expiry | SDK `negotiation_hash` + `quote_expires_at`; marketplace enforces expiry. **Good** |
| Chain validation | `NETWORK=bsc-testnet` + SDK chain 97. **Good** |
| Arbitrary URL / SSRF | fixed routes only, no proxy, no URL forwarding. **Good** |
| Rate limiting | none — public testnet seller; acceptable, but note. **OK** |
| Error leakage | health returns only public fields; no stack/secret leakage. **Good** |

---

## On-chain endpoint implications

**ON-CHAIN ENDPOINT UPDATE REQUIRED — USER AUTHORIZATION NEEDED**

If a durable v2-seller host is deployed at a new URL, the affected agent's on-chain `AgentEndpoint` must be re-pointed to that URL (e.g., `https://<durable-host>` root so `{base}/negotiate` and `{base}/health` resolve), via an `ERC8004Agent.registerAgent` transaction (X.124 precedent ~622k gas). For **Agent 2005**, the re-point would additionally require the seller wallet to be Agent 2005's owner (`0x0eAc…`) — otherwise signature verification fails. **No transaction performed in X.201.**

---

## Recommended deployment architecture (not executed)

If authorized and hosting provisioned: run the existing `Dockerfile` on an always-on container host; mount the `0xB0f768…` keystore; set the 4 env vars; register/re-point the AgentEndpoint to the durable root URL (on-chain tx, operator). Serve **Agent 1906** (owned by `0xB0f768…`) for TermiX-type hires, **not Agent 2005** (owner mismatch).

---

## TermiX readiness

**BLOCKED.** TermiX Tasks 4-6 were planned around Agent 2005, which the repo's v2 seller cannot serve (owner/signer mismatch) and whose external seller is stale (no `/negotiate`). Options: (a) the external Agent 2005 owner fixes/redeploys their seller (out of this repo's control); or (b) a durable v2-seller host signs as an owned agent (Agent 1906) and that agent's AgentEndpoint is re-pointed on-chain (authorization + hosting required). TermiX remains **PARTIAL** until a negotiating, owner-matched seller is reachable.

---

## Final classification

**DEPLOYMENT BLOCKED** — no durable hosting provisioned in this repo/environment; provider-wallet identity of the v2 seller (`0xB0f768…`) does not match Agent 2005's owner (`0x0eAc…`); and an on-chain AgentEndpoint update would be required for any new durable URL (authorization needed).

1. **Seller implementation status:** Known-good, containerized (`seller.ts` + `Dockerfile`), implements `POST /negotiate`, `/health`, agent-card; requires persistent host + keystore volume.
2. **Marketplace compatibility:** Contract-compatible except **provider identity** (seller must equal the agent's owner).
3. **Agent 2005 compatibility:** **NO** (owner mismatch `0x0eAc…` vs seller `0xB0f768…`); the v2 seller can only serve an agent it owns (Agent 1906).
4. **Required env vars:** `NETWORK=bsc-testnet`, `WALLET_PASSWORD` (secret), `ERC8183_AGENT_URL`, `ERC8183_SERVICE_PRICE` (default 1 U).
5. **Required hosting:** always-on container host (VPS/VM/Render/Railway/Fly/Cloud Run); **not Vercel**; persistent process + mounted keystore volume.
6. **Required DNS/HTTPS:** stable HTTPS domain; AgentEndpoint must point at the seller **root** (so `{base}/negotiate` resolves); no `sslip.io`.
7. **AgentEndpoint update required:** **YES — on-chain, authorization needed** (for any new durable URL; and a different owner wallet for Agent 2005).
8. **Exact next action:** operator provisions a durable HTTPS host + keystore for an owned seller wallet, deploys the `Dockerfile`, then performs an authorized on-chain `registerAgent` re-point of that agent's AgentEndpoint; then re-run the authenticated prepare to confirm `POST /negotiate` 200.
9. **TermiX readiness:** **BLOCKED** (no owner-matched, negotiating seller reachable).

---

## Safety audit

```
Transactions: 0
Signatures: 0
Jobs created: 0
Job 787: UNTOUCHED
Agent 2005: UNTOUCHED
Agent 1906: UNTOUCHED
AgentEndpoint: UNCHANGED
Production seller: UNCHANGED (no POST; external host untouched)
Credentials: NONE EXPOSED
Commit: NONE
Push: NONE
Deploy: NONE
HARD STOP
```
