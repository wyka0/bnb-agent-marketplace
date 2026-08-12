# Main-Track-Activation — X.5: Real-Action Trace Diagnostic

Phase: X.5 — trace the real activation action from marketplace through agent detail, hire,
payment requirement, ERC-8183/x402 action construction, to the X.4C review boundary, and
classify the blocker as precisely as the code allows.

Status: **TRACE COMPLETE — BLOCKER A (primary), mechanism B/D (documented).**
Report date: 2026-08-12 (chain-97 testnet; chain-56 registry read-only).

---

## 1. Objective and method

The X.4C boundary proved the review/consent layer is ready but found **no genuine pending
action**. X.5 answers: where, along the wired application path, does the real activation
action stop being generated? Method: static trace (grep + file reads, all call sites
enumerated), then read-only live validation (public 8004scan API, BSC testnet RPC reads),
then regression. No signing, broadcasting, settlement, payment, transfer, mainnet access,
or Git occurred.

## 2. Full trace (evidence per hop)

| Hop | Component                            | Result                                                                                        | Evidence                                                                                                                                                                                                                                                       |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Marketplace / agent feed             | REAL agents served from public 8004scan API                                                   | `apps/web/lib/eight004scan/client.ts:25` (`https://8004scan.io/api/v1/public`, keyless-safe); `marketplace:live:verify` 14/14: 5 agents normalized, chain-56 registry `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`, tokenIds 264554–264558                     |
| 2   | Card model                           | `hireable` always `false` by code contract                                                    | `apps/web/lib/eight004scan/card.ts:66` — "activation is NOT implemented yet — never claim hireable"; price/risk honestly absent (lines 12–14)                                                                                                                  |
| 3   | Agent detail                         | Disabled "Hire — Soon" button; price "pending ERC-8004 Registry integration"                  | `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx:519-549` (button `disabled`, `title="Hire arrives with the live ERC-8004 Registry"`, badges `coming-soon`)                                                                                             |
| 4   | Activate / hire endpoint             | **NONE exists** — sole API route is Aave V3 preview                                           | `glob app/api/**/route.ts` → only `app/api/activation/aave-preview/route.ts` (read-only preview via `lib/activation/aave.server.ts`); production build route table confirms no hire route                                                                      |
| 5   | Payment/action request               | Never generated for real agents                                                               | `packages/integrations/src/altana/marketplace.ts` `requestService` → `ALTANA_MARKETPLACE_EXECUTION_BOUNDARY` (not-implemented, no result fabrication); **zero production callers** of `createAltanaMarketplaceService` (grep: fixtures-only)                   |
| 6   | ERC-8183 action builder              | Exists but never called by application code                                                   | `prepareErc8183Hire` (5-call atomic batch: createJob/registerJob/setBudget/approve/fund) — callers are exactly 4 verify harnesses (`p14.testnet.verify.ts`, `x402.e2e.testnet.verify.ts`, `erc8183.verify.ts` harness, marketplace fixtures); nothing in apps/ |
| 7   | Real amount / destination / calldata | **ABSENT** — no pricing from 8004scan envelope, no real sell-side merchant config in app code | card.ts:12-14; merchant config only ever created in testnet fixtures; `x402.e2e` live path exits at review boundary                                                                                                                                            |
| 8   | X.4C review                          | READY and fixture-proofed                                                                     | `x402.consent.verify.ts` 11/11; live gate refuses fixtures/structural addresses, pins chain 97/$U/payTo/amount/destination/calldata                                                                                                                            |

The action stops at **hop 4** (no endpoint → no request → no job → no reviewable calldata).
Steps 5–7 have real, verified building blocks that no production path invokes.

## 3. Blocker classification

- **PRIMARY — A: No real agent action endpoint exists in the application.**
  `hireable:false` is a hard code contract (card.ts:66); the only agent action UI is a
  disabled button (agent-detail-view.tsx:534-547); the build serves exactly one
  activation endpoint, the Aave V3 preview, which is unrelated to hiring.
- **Mechanism — B/D: the endpoint layer that WOULD produce the action exists inside
  packages (marketplace `requestService`, `prepareErc8183Hire`) but is not wired:**
  zero production callers (hop 5/6), and no real sell-side merchant configuration for any
  registry agent (pricing deliberately withheld: card.ts:12-14).

The app is honest by design about this: it never claims a price, never claims hireability,
and its verify suites assert the absence of impersonation paths (P12 checks M, P13 checks
"no secret-key path / no signing implementation").

## 4. Read-only validation performed

- `marketplace:live:verify` — 14/14. Five real agents live: `Agent #264558`, `Agent #264557`,
  `Echo-Pro.agent` (264556), `Bond_Theta.agent` (264555), `AlphaBeta.agent` (264554), all
  chain 56 registry `0x8004a169...39a432`. Anonymous tier (no key) round-trip skipped.
- BSC testnet chain-97 set re-verified green (P14 readiness, ERC-8183 24 checks incl. job 1
  FUNDED/settlement none, X.1 nine-network rejection).
- Credential presence suites green (p14e 11/11, X.4A e2e 10 exit 0 at consent boundary).
- Balances unchanged since P14g: operator 0.068577 tBNB, facilitator 0.030000 tBNB (sufficient).

## 5. Real agent selection

Best real agent as of this trace: **Echo-Pro.agent** — chain-56 ERC-8004 registry tokenId
**264556** (registry `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`). It is the only named
(non-numeric) agent in the live feed. It has NO price, NO hire capability, NO action
endpoint — matching what the app correctly renders. No testnet-chain (97) agent exists in
the registry feed; job 1 on chain 97 is a historical harness fixture, not a real merchant.

## 6. Production modifications

**None made.** No endpoint was fabricated, no merchant config invented, no pricing
conjured, no boundary bypassed. The gap is a feature gap (hire endpoint + registry pricing

- wiring), not a defect in the verified layers.

## 7. Tests (all green, run 2026-08-12)

| Suite                                                             | Result                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| integrations `altana:verify` (P14)                                | PASS                                                      |
| integrations `altana:erc8183:verify`                              | PASS (24 checks)                                          |
| integrations `altana:x402:verify` (X.1)                           | PASS                                                      |
| integrations `altana:x402:testnet:verify` (X.2, clean env)        | 16/16                                                     |
| integrations `altana:x402:marketplace:verify` (X.3, clean env)    | 10/10                                                     |
| integrations `altana:x402:review:verify` (X.4B)                   | 16/16                                                     |
| integrations `altana:x402:consent:verify` (X.4C)                  | 11/11                                                     |
| integrations `altana:p14e:operator:verify` (credentials)          | 11/11                                                     |
| integrations `altana:x402:e2e:testnet:verify` (X.4A, credentials) | 10, exit 0, consent boundary                              |
| web `activation:verify` (P12)                                     | 33/33                                                     |
| web `activation:p13:verify`                                       | 20/20                                                     |
| web `marketplace:live:verify` (read-only)                         | 14/14                                                     |
| `pnpm typecheck` / `lint` / `build`                               | 12 / 12 / 7 clean (build route table shows no hire route) |

---

```
X.5 STATUS: TRACE COMPLETE. EXACT BLOCKER: no real agent action endpoint exists in the
application (hireable=false by code contract, no hire route, aave-preview is the only
activation API), and the action builders (prepareErc8183Hire, marketplace requestService)
have zero production callers. REAL ACTION: NOT FOUND (cannot be generated). REAL AGENTS:
5 live on chain-56 registry (Echo-Pro.agent 264556 et al.), none hireable, no pricing.
REAL REVIEW: READY. CONSENT: REQUIRED. SIGNING/BROADCAST/SETTLEMENT: NOT PERFORMED.
NEXT ACTION: build the hire endpoint — server route resolving a real 8004scan agent +
verified chain-97 sell-side config, invoking prepareErc8183Hire/requestService, feeding
buildX402LiveReview + pinX402Consent for operator consent (no invented pricing/amounts).
```
