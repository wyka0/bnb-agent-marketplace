# X.150 Production Seller Endpoint + Final Judge Readiness

**Mode:** READ-ONLY audit. **ZERO blockchain transactions, zero wallet signing, zero new jobs/wallets, zero AWS/KMS, zero production secrets, zero commit/push/deploy.** No seller keystore copied into the repository or production.

**Git boundary:** `HEAD` = `origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` (unchanged). No `.env`/keystore/wallet/password/credential staged.

---

## 1. Seller endpoint status

`services/v2-seller/seller.ts` is a standalone Node HTTP server (routes: `GET /health`, `GET /.well-known/agent-card.json`, `POST /negotiate`, `GET /job/:id/response`; everything else → 404). It signs with the isolated local Keystore V3 (seller `0xB0f7681668f916eEd97dA066D31aA295D34727c0`).

**Not durable.** It currently runs only from the development machine behind ephemeral `*.trycloudflare.com` tunnels. No durable host is available in this environment.

Options evaluated (read-only):

- **A — Existing deployed seller service:** none exists.
- **B — Vercel-compatible seller route/service:** would require the seller private key on the Vercel deployment → **forbidden** by the X.150 wallet rule ("DO NOT put the seller private key into Vercel"). Not viable for the signing path.
- **C — Existing marketplace deployment hosting:** same key-on-Vercel conflict → not viable.
- **D — Durable VPS/service:** the cleanest supported option (seller keystore stays local to the service, marketplace only reads its HTTPS endpoints) — **none is available in the current environment**, and the mandate forbids faking one.
- **E — Cloudflare tunnel:** ephemeral trycloudflare is not durable; a fixed-hostname tunnel still requires a persistent machine, which is the rejected "developer laptop" dependency.

**Verdict:** the seller service is deployment-ready (minimal routes, ERC-8004 `AgentEndpoint`-based resolution, local keystore) but requires a durable host (option D) before production Hire can go live. This is the single primary blocker.

## 2. Agent 1906 endpoint status

On-chain `tokenURI` (chain-97 registry `0x8004A818…`, id 1906, wallet == owner == seller) decodes to a valid EIP-8004 agent card whose A2A service endpoint is:

```
https://flux-management-helps-attended.trycloudflare.com/.well-known/agent-card.json
```

That is an **expired ephemeral tunnel URL** — Agent 1906 currently points at a dead endpoint. It must be updated to the durable endpoint once the seller is hosted. Per the mandate, **no registration/update transaction was submitted in X.150**; the exact required transaction is documented in §15.

## 3. Negotiation status

`POST /negotiate` (SDK `NegotiationHandler`) validates taskDescription/terms/chain/price/expiry and returns `{accepted, price, chain_id, verifying_contract, negotiation_hash, provider_sig}`. The code path was **proven live** (X.125/X.130 — Jobs 622 and 641 negotiated with the seller). It is currently unreachable only because the tunnel is dead; once the seller is hosted durably it works unchanged.

## 4. Provider signature verification

`verifyQuoteSignature` (official SDK) verified the seller's `provider_sig` in the successful historical negotiations (X.125/X.130): signer == seller `0xB0f768…`, chain 97, price exactly 1 U, official chain-97 commerce, expiry enforced. The marketplace-side verification (`prepareMainTrackUserHire`) requires exactly these invariants and never fabricates a signature.

## 5. ERC-8004 Agent Card

The on-chain card is valid JSON (data URI), structurally a correct EIP-8004 registration-v1 card with one A2A service endpoint. The endpoint URL is the only stale field (expired tunnel). No agent-card/protocol change is needed — only the URL.

## 6. Marketplace Hire status

X.149 production browser-wallet Model B flow is complete and tested: `model-b-v2-commercial-agreement`; user EIP-1193 wallet → `eth_sendTransaction` → marketplace-owned receipt verification → independent on-chain verification → `funded-commercial-hire` (active: false). Route `/api/activation/main-track-hire` actions `prepare`/`receipt`/`verify` are read-only, no server custody, no private key, no AWS, fail-closed. Model A / X.76 is untouched and NOT a mandatory gate (no `resource`/`executionCapability` requirement added).

## 7. Four-category audit (equal depth)

All four categories exist with equal-depth `CategoryDashboard` configs (honest decision signals, risks, `executionMode: analysis-only`, verification gaps):

| Category                 | Route                       | visible      | discoverable | cards          | detail | compare | Hire CTA |
| ------------------------ | --------------------------- | ------------ | ------------ | -------------- | ------ | ------- | -------- |
| Rebalancing              | `/categories/rebalancing`   | ✓ (200 live) | ✓            | registry cards | ✓      | ✓       | ✓        |
| Grid Trading             | `/categories/grid-trading`  | ✓ (200 live) | ✓            | registry cards | ✓      | ✓       | ✓        |
| Yield Optimisation       | `/categories/yield`         | ✓ (200 live) | ✓            | registry cards | ✓      | ✓       | ✓        |
| Health Factor Monitoring | `/categories/health-factor` | ✓ (200 live) | ✓            | registry cards | ✓      | ✓       | ✓        |

## 8. Data-quality audit

Every agent card/detail value is sourced and labeled: registry fields are **VERIFIED/LIVE** from ERC-8004 (`verification`, `registryScore`, `owner`, chain, token id); TermiX AACP reputation and PancakeSwap pools are read-only market data with explicit source labels and honest unavailable states; everything without an authoritative source renders as **UNKNOWN/pending** (em-dash/Pending chip). No field is fabricated or presented as live when it is not. The marketplace gives a judge the real, sourced signals needed to choose.

## 9. Security audit

- **Headers verified LIVE** on the production deployment (`https://bnb-agent-marketplace-web.vercel.app`): `Content-Security-Policy` (with nonce, `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` — all present and correct.
- **Seller service routes** fail closed: only `/health`, `/.well-known/agent-card.json`, `POST /negotiate`, `/job/:id/response` (numeric-id, storage-scoped); everything else 404. No directory traversal, no arbitrary file reads, no arbitrary proxy, no generic RPC forwarding, no arbitrary transaction endpoint, no environment/keystore/wallet-password/private-key disclosure.
- No server-held buyer wallet, no `eth_sendRawTransaction` for user transactions, no unvalidated transaction targets (pinned chain-97 allowlist), no unsafe redirects.

## 10. Judge-flow audit (read-only, no broadcast)

Landing (`/`) → Marketplace (`/marketplace`) → browse each category → open an agent → understand (registry description/capabilities) → review real data (registry + TermiX + PancakeSwap, all sourced) → **Hire CTA** → confirmation review (Agent/Seller/Price/Token/Chain/what-will-happen/wallet/expiry/cancellation) → connect wallet → exact 5-step ERC-8183 sequence with per-step receipt verification → fail-closed success/failure behavior (never ACTIVE). All page routes return **200 live**; the Hire route + UI are in the working tree (see §13 — the deployed build predates them).

## 11. README audit

Aligned with actual behavior: Live production release; Four First-Class Agent Categories; Discover/Understand/Compare/Review Activation; fail-closed activation; no fake ACTIVE; PancakeSwap read-only disclosure; TermiX honest disclosure; Recommended Judge Flow. No claim of guaranteed hiring, completed marketplace transactions, live monitoring, production execution, or ACTIVE sessions that is not independently true.

## 12. Build / test results (all green)

Web: typecheck PASS · lint PASS · `next build` PASS. Integrations: typecheck PASS · lint PASS · build PASS. Prettier clean.
Suites: activation (33) · hire (23/23) · hire-api (14) · capability-source · main-track-hire (X.130) · main-track-user-wallet (X.139/X.134/X.137/X.142/X.144/X.146) · main-track-v2 (X.131) · main-track-user-hire (X.149) · hire-adapter (X.127) · ERC-8183 — all pass.

## 13. Git status

`HEAD`/`origin/main` unchanged `850454da…`; no commit/push/deploy. Working tree carries the X.127–X.150 evidence + X.131/X.149 production Hire code. **Note:** the live Vercel deployment is stale relative to the working tree — it serves all page routes with correct headers but does **not** yet expose `/api/activation/main-track-hire` (returns 404) or the new Hire UI, because X.131–X.150 intentionally did not deploy. A fresh authorized deployment is required to surface them.

## 14. Exact remaining blockers

1. **Durable seller endpoint (primary):** no durable host (option D) is available in this environment; the seller service currently depends on a temporary tunnel. Must be deployed on a persistent HTTPS host before production Hire can complete a live funded job.
2. **Agent 1906 endpoint update:** the registered card still points at an expired `trycloudflare.com` URL; it must be re-pointed at the durable endpoint (one `registerAgent` transaction, documented, not submitted here).
3. **Stale production deployment:** the live Vercel build predates the X.131/X.149 Hire route + UI; a fresh authorized deployment is needed to expose them.
4. **X.148-class broadcast infrastructure behavior (E):** viem-canonical fresh `createJob` was rejected at `eth_sendRawTransaction` by PublicNode and the current SDK seed node while a near-identical tx mined previously — unresolved RPC infrastructure behavior, outside judge-readiness, gating a live funded hire.

None of these are code/UX/honesty/safety gaps; all are deployment/infrastructure gates that are reported, not hidden.

## 15. Exact submission recommendation

- **To reach submission readiness for a LIVE funded hire:** (1) host the existing seller service on a durable HTTPS host (VPS/VM) with its local Keystore V3 — no key in the repo or on Vercel; (2) update Agent 1906's endpoint via a single `ERC8004Agent.registerAgent(agentUri)` with `AgentEndpoint.a2a("<durable-url>", { capabilities: ["erc8183-negotiate"] })` (chain-97, one transaction, seller `0xB0f768…`, not executed in X.150); (3) deploy the current working tree to Vercel (separately authorized) so `/api/activation/main-track-hire` (prepare/receipt/verify) and the Hire UI go live.
- **Judge experience today (read-only):** fully navigable and honest — discovery, category depth, sourced agent data, comparison, and the Hire confirmation/error UX are all present; no fake ACTIVE, no fabricated data, fail-closed at every step.

## Classification

**B — SELLER ENDPOINT DEPLOYMENT REQUIRED.**

The marketplace is judge-ready for discovery/understand/compare/Hire-UI and the production Hire architecture (X.149) is complete, honest, tested, and fail-closed. The single remaining gate for a **live funded hire** is the durable deployment of the seller endpoint (plus re-pointing Agent 1906's registered endpoint and a fresh marketplace deployment), and the X.148-class broadcast infrastructure behavior. No blocker is hidden; nothing was broadcast, committed, pushed, or deployed in X.150. **STOP.**
