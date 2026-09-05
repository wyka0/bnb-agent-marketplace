# X160 — Production Hire Availability Diagnosis

**Mode:** Read-only diagnosis + a single code/config fix (deployed). **ZERO blockchain transactions, zero jobs, zero wallets, zero Agent 2005 registration change, zero seller deployment, zero AWS/KMS, no Hire architecture change.**

**Git boundary:** `HEAD` = `origin/main` = `2af713b84015aa4c3cf184452182f655754b8d34` (fix committed + pushed; new Vercel production deployment `dpl_9SmhaZzgUKk1cf3YRoQFSfjHFTH4` — **Ready**).

---

## Live production findings

Verified on the live alias (`https://bnb-agent-marketplace-web.vercel.app`):

1. **Agent 2005 detail** — renders "Canned Range Keeper", owner `0x0eAc2F4d…`, BSC Testnet, and an **active "Hire"** CTA with a **"BSC Testnet"** badge (available styling). No "Unavailable" on the detail Hire card.
2. **Marketplace agent cards** — every card rendered a **disabled "Unavailable"** button (the reported symptom). Root cause below.
3. `/api/activation/main-track-hire` — live (405-on-GET; POST actions `prepare`/`receipt`/`verify`).
4. **prepare** — fails closed without an authenticated session (`request-rejected`); the route requires SIWE wallet auth + CSRF (expected for a wallet-driven hire).
5. AgentEndpoint resolution, `/negotiate`, quote verification, provider-signature verification, chain 97, official commerce, $U token, quote expiry — all already proven working in the detail-path dynamic flow (X.156) and remain unchanged.

## Root cause

`apps/web/lib/eight004scan/card.ts` `toAgentCardData` derived `hireable` **only** from `classifyAgentActivation(...).state === "ACTIVATABLE"` — the Model-A/X.76 capability gate, which is never true for real agents (fail-closed capability source). So every marketplace/home **agent card** showed the disabled `Unavailable` button, even for the chain-97 hireable Agent 2005 whose detail page Hire flow is available. This was **option E/F-class: a production-facing code/config defect causing an expected-looking fail-closed state on the cards** — not a deployment/endpoint/env issue (the detail flow was always available; the cards simply never reflected Main Track Hire availability).

## Fix (single defect, deployed)

- `toAgentCardData` now treats a **chain-97 agent with a registered owner as Main Track Hireable**: `hireable = activation.state === "ACTIVATABLE" || (chainId === 97 && ownerAddress present)`, with `hireLabel = "Hire"` for the Main Track path (Model A keeps "Activate"), and an honest `hireUnavailableReason` ("Main Track Hire requires a chain-97 agent with a registered owner") otherwise. Model A semantics unchanged.
- `AgentCardData.hireLabel?` added; both card components (`agent-card-detailed.tsx`, `agent-card-standard.tsx`) render the active button with `hireLabel ?? "Activate"` and keep the disabled `Unavailable` state for genuinely non-hireable agents.
- Test added: chain-97 agent with owner → `hireable === true` + `hireLabel === "Hire"`; chain-56 agent remains `hireable === false`.

## Verification

- `marketplace:verify` — **86 checks passed, 0 failed** (incl. the new hireable assertions).
- Web typecheck / lint / `next build` PASS; `activation:main-track-user-hire` (X.149), `activation:main-track` (X.131), `activation` (33), `security x49` (25) all PASS; prettier clean.
- Deployed to the existing Vercel project (`dpl_9SmhaZzgUKk1cf3YRoQFSfjHFTH4`, Ready). Live: Agent 2005 detail Hire still available; the marketplace page now carries active "Hire" buttons for hireable cards (client-rendered), while non-hireable agents keep the honest disabled "Unavailable" state.

## Exact operator action remaining (if any)

None for availability. Note: **executing** a Hire still requires an authenticated browser wallet session (SIWE login) and then a real EIP-1193 wallet to broadcast the ERC-8183 sequence; that is a separate, explicitly-authorized execution step, not an availability issue.

## Classification

**B — PRODUCTION CONFIGURATION ISSUE FIXED.**

The reported "Hire Unavailable" was a production code/config defect: the marketplace agent cards derived `hireable` only from the Model-A capability gate (never true), so hireable chain-97 agents (Agent 2005) showed a disabled "Unavailable" button despite their detail-page Hire flow being live. The defect is fixed (cards reflect Main Track Hire availability with an active "Hire" label; non-hireable agents keep the honest unavailable state), tested, committed, pushed, and deployed to Vercel (Ready). Zero blockchain transactions. **STOP.**
