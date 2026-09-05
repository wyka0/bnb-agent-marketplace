# X.156 Dynamic ERC-8183 Hire

**Mode:** Implement + test + deploy + read-only verification of a dynamic Hire flow that consumes a real discovered ERC-8004/ERC-8183 seller (Agent 2005). **ZERO blockchain transactions, zero createJob/registerJob/setBudget/approve/fund, zero Agent 1906 update, zero new wallets, zero AWS/KMS, no hardcoded seller/price.**

**Git boundary:** `HEAD` = `origin/main` = `850454da…` (unchanged; changes are uncommitted working-tree edits; no commit, no push).

---

## Candidate agent (verified live in X.155C)

- **Agent 2005 "Canned Range Keeper"** — chain 97, owner `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a`.
- Registered AgentEndpoint (on-chain card): `https://range-keeper.103-195-188-198.sslip.io/erc8183`.
- `/health` 200, `POST /negotiate` 200 (accepted), price `0.001 U` (1e15), official chain-97 commerce + $U token, `provider_sig` present.

## Part 1 — hardcoded seller/price removed

- `prepareMainTrackUserHire` is now **quote-driven**: it takes a live quote + canonical description + verified signer and binds provider, price, expiry and terms from the quote — no `0xB0f768…` and no hardcoded `1 U`.
- `MainTrackHireView` now displays the real quote price/provider/expiry (badge, confirmation review, confirm button, funded copy) instead of a hardcoded "1 U".
- The route no longer hardcodes a seller; it negotiates with the discovered agent.

## Part 2 — live negotiation (server-side, read-only)

New `apps/web/lib/activation/main-track-negotiation.server.ts`:

1. `resolveRegisteredEndpoint(agentId)` — reads the on-chain `tokenURI` card and extracts the registered HTTP A2A endpoint (official chain-97 registry only).
2. `negotiateSeller(endpoint)` — `POST /negotiate` (snake_case terms the sellers accept).
3. `verifyQuote` — official `verifyQuoteSignature` (SDK): requires valid, signer == registered owner, chain 97, official commerce, $U token, future expiry.
4. `readNextJobId` — reads `jobCounter()+1` (read-only).
5. `prepareLiveAgentHire` — orchestrates the above and builds the plan from the real quote. Fails closed at every step.

## Part 3 — dynamic ERC-8183 job construction

The job binds: client = connected user wallet (set at wallet time), provider = verified seller owner (from the live quote), price = quoted price, chain 97, official commerce + $U, description = canonical `buildJobDescription(quote)`. No historical job reused (history list `{622,641,646,648,649,650,651,652,653}` enforced).

## Part 4 — safety (kept)

Confirmation gate, wallet ownership gate (`eth_requestAccounts`/`eth_chainId`/`eth_sendTransaction`), chain gate, provider/price verification, expiry gate, target allowlist, calldata validation, per-step receipt verification, final on-chain verification, no rebroadcast, fail-closed. No server private key; no `eth_sendRawTransaction`.

## Part 5 — zero-transaction tests (mocked + live)

Harness (`main-track-user-hire.verify.ts`) now covers the dynamic path with injected ports: **Agent 2005 accepted; actual owner used; actual quote price used (0.001 U); wrong owner rejected; fabricated provider rejected; wrong commerce rejected; wrong token rejected; malformed price rejected; expired quote rejected; wrong chain rejected; endpoint unavailable rejected; negotiation unavailable rejected; historical job id rejected; Agent 1906's dead endpoint does not block dynamic hire.** All other existing checks pass.

**Live read-only proof (`x156-live-check.mjs`):** against the real Agent 2005, `prepareLiveAgentHire` resolved the endpoint, negotiated, verified the signature, and returned a plan with `provider = 0x0eAc2F4d…` (owner), `price = 0.001 U`, chain 97, official commerce/token, 5 allowlisted calls, fresh `jobId 723` (not historical), future expiry. No transaction.

## Part 6 — UI

Agent 2005's Hire card now shows the selected agent's real info: provider (verified owner), price (actual quote), BSC Testnet, expiry; the confirmation shows the exact amount the user will authorize. No "1 U" is shown for agents that quote another price.

## Part 7 — four categories

Unchanged (X.154): the discovered live agents remain distributed across the category discovery honestly (grid/rebalance/yield/health), driven by the registry classifier — no fabricated category membership.

## Part 8 — tests (all green)

`main-track-user-hire` (X.149/X.156) · `main-track-v2` (X.131) · `activation` (33) · `hire` (23/23) · `hire-api` (14) · `capability-source` · `security x49` (25) · `marketplace` (84) · `discovery` (60) · `main-track-user-wallet` (X.139) · `main-track-hire` (X.130) · `hire-adapter` (X.127) · ERC-8183. Web typecheck/lint/`next build` PASS; integrations typecheck/build PASS; prettier clean.

## Part 9 — production

Deployed to the existing Vercel project (`dpl_FACURDhty4j74nXbCqQbzo1zo3hP`, READY). Verified live: all page routes 200; **Agent 2005 detail renders "Canned Range Keeper", owner `0x0eac2f4d…`, BSC Testnet, and the Hire CTA**; `/api/activation/main-track-hire` `prepare` fails closed (`request-rejected`) without an authenticated session. The authenticated prepare (browser) uses the same `prepareLiveAgentHire` code path proven against the real seller in the live check. **No final transaction authorization was clicked.**

## Part 10 — remaining action for a REAL testnet Hire

1. Authenticated browser session on the production marketplace → Agent 2005 → Hire → real quote (0.001 U) → confirmation → connect wallet → `eth_sendTransaction` sequence → receipt verification → final on-chain verification → `funded-commercial-hire`. This is a separate, explicitly-authorized transactional milestone.
2. Agent 1906 remains optional future cleanup; it is no longer required for a real hire.

## Classification

**A — DYNAMIC LIVE-AGENT HIRE READY.**

The production Marketplace Hire flow now dynamically consumes a real discovered ERC-8183 seller (Agent 2005): its registered endpoint is resolved on-chain, negotiated with, the provider signature is verified with the official SDK to the registered owner, and the job plan binds the real provider/price/expiry/terms — no hardcoded seller or price. Implemented, fully tested (mocked + live read-only against the real seller), deployed to production, and verified read-only. The only remaining step is an explicitly-authorized real browser-wallet Hire transaction. **STOP** (no transaction, no Agent 1906 update, no commit/push).
