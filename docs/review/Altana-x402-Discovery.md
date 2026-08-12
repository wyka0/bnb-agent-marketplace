# Altana x402 — Phase 1 Discovery

**Scope:** Determine how BNB Agent Marketplace should integrate **x402** (HTTP 402 payment protocol) with Altana. This is a **discovery-only** deliverable: no implementation, no code/env/package changes, no credentials are added in this phase. All findings trace to official sources (`docs.altana.network`, `github.com/altananetwork/altana-sdk`) and the installed `@altananetwork/sdk@0.7.0` implementation.

**Type:** Altana x402 — Phase 1 (Discovery). Follow-up: Phase 2 (scoped implementation) is **not** started here.

---

## 1. Official sources (verified)

| Source                                                                                  | What it establishes                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs.altana.network/sdk/x402`                                                          | Buyer side: `fetchWithX402`, rails `permit2-exact` + `exact`/EIP-3009, one-time provisioning (`approveTokenForPermit2` + `approveSignatureChecker`), B402 wire compatibility, browser/CORS limitation, ERC-1271 envelope.                                                                                                                                                                       |
| `docs.altana.network/sdk/x402-server`                                                   | Seller side: `@altananetwork/x402-server` `createX402Merchant` + `merchant.guard(req)`, settlement mechanics (recipient bound into signature), Studio buyer compatibility rules, envelope dialects.                                                                                                                                                                                             |
| `docs.altana.network/use-cases/6-agent-pays-api-x402`                                   | Full walkthrough: scoped `grantSession` → provision Permit2 rail → `fetchWithX402`; chain 56 BNB USDC `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`.                                                                                                                                                                                                                                             |
| `docs.altana.network/sdk/bnb-testnet` + `docs.altana.network/concepts/networks/testnet` | Chain 97 is Altana's full-stack testnet: keystore `0x6b8361C29d05D498b1a12B54A37310f94171E94A`, relay `https://testnet-relay.altana.network`, RPC `https://bsc-testnet-rpc.publicnode.com`, faucet `https://testnet.bnbchain.org/faucet-smart`, Explorer `testnet.altana.network`. No `$U`/USDT testnet address is published on these pages (seller-side prices are shown for mainnet 56 only). |
| Installed `@altananetwork/sdk@0.7.0` `dist/x402.{js,d.ts}`                              | Ground truth for the wire: constants, payload shape, dispatch, network map, option selection — inspected directly (not paraphrased).                                                                                                                                                                                                                                                            |
| `docs/altana` prior reviews                                                             | `Altana-Integration-Discovery.md` §1.5/§1.6 (buyer/seller x402), §1.8 (skills `x402-payments` entry), Phase 3A/4 reports (x402 intentionally excluded from the Phase-4 skill registry).                                                                                                                                                                                                         |

No third-party tutorials were used.

---

## 2. Repo inspection (x402 footprint today)

- **No x402 application code exists.** Four scoped searches (`docs/review`, `packages/integrations/src`, `apps/web`, `packages/config`) found x402 only as:
  - `apps/web/lib/eight004scan/types.ts:35` — `x402_supported: boolean` (raw 8004scan API field; frozen UI code).
  - `apps/web/components/home/ecosystem-partners.tsx:18` — marketing copy "x402 payments for hiring agents" (frozen homepage, no logic).
  - `packages/integrations/src/altana/skills.ts` — 8004scan input mirror field `x402Supported?: boolean`; x402 execution explicitly excluded from `ALTANA_CERTIFIED_SKILLS`.
  - `packages/integrations/src/altana/skills.verify.ts:105` — `x402-payments` rejected as out-of-scope; `:226` — `x402Supported: true` fixture.
  - Prose in `Altana-Integration-Discovery.md` §1.5/§1.6 and Phase 3A/4 reports ("NO x402").
- **`@altananetwork/x402-server` is not installed** — only `@altananetwork/sdk@0.7.0` exists in the pnpm store. The seller-side package is a documented option, not a dependency.
- **`packages/config/src/env.ts` has no x402/payment env vars.** Nothing to change this phase.

Conclusion: x402 is greenfield here. The adapter pattern (`altana/xxx.ts` + `xxx.verify.ts` + index re-export + `altana:xxx:verify` script) from Phase 3A (ERC-8183) and Phase 4 (skills) is the established container for any future implementation.

---

## 3. Protocol flow (from SDK + docs)

1. Client calls a paid endpoint; server answers **HTTP 402** with a body listing payment requirements (`accepts[]`, plus top-level `x402Version` and `resource`).
2. `fetchWithX402(session, url, init?, { chainId?, preferRail? })` parses the options, picks a payable one via `selectX402Requirement` (filters payable → prefers requested `chainId` → prefers the reliable rail **permit2-exact**), and signs it with the session key (`signX402Payment`).
3. The signature is a **98-byte ERC-1271 smart-account signature** (Altana nested signing `signOrderTypedData`), not an EOA signature. It's base64 → `X-PAYMENT` header (duplicated under `PAYMENT-SIGNATURE` for b402 merchants) and the request is retried.
4. A **facilitator** submits the authorization on-chain; settlement is instant. The recipient (`payTo`) is **bound into the buyer's signature**, so a compromised facilitator key cannot redirect funds. Nonces burn on-chain → no replay.
5. Non-402 responses pass through unchanged; a paid 200 is returned as-is.

### Rails

- **permit2-exact** (reliable): any token approved to Permit2; checker = `PERMIT2_ADDRESS` (`0x000000000022D473030F116dDEE9F6B43aC78BA3`, canonical on every chain). Signature type `PermitWitnessTransferFrom` with a `Witness(address to, uint256 validAfter)` (B402); settled via `Permit2.permitWitnessTransferFrom`. If the session is checker-restricted, the settling contract (x402ExactPermit2Proxy) verifies `isValidSignature`.
- **exact / EIP-3009** (standard wire): `TransferWithAuthorization`; checker = the token contract. Only works with tokens whose EIP-3009 is ERC-1271-aware (Circle FiatTokenV2_2, e.g. Base/Ethereum USDC; **not BNB's native USDT/USDC in general**). Settled via `token.transferWithAuthorization(bytes)`.

### Wire mapping (`networkToChainId`)

CAIP-2 `eip155:N` → `N`; legacy: `bsc`/`binance`/`bnb`→56, `base`→8453, `ethereum`/`mainnet`→1, `bsc-testnet`/`bnb-testnet`→**97**. Real B402 sends `scheme:"exact"`, `network:"eip155:56"`, `x402Version:2`, and the rail in `extra.assetTransferMethod` (`"eip3009" | "permit2-exact"`); the legacy sample used `scheme:"permit2"` + `extra.spender`. The SDK accepts both and echoes the challenge verbatim (`accepted`), stripping only transport-only fields (`x402Version`, `resource`, `mimeType`).

### Seller-side (`@altananetwork/x402-server`, not yet installed)

`createX402Merchant({ chainId, payTo, price, minPrice, maxPrice, rails, facilitator, rpcUrl, chain })`; `merchant.guard(req)` returns `{ response, receipt }` — `response` is the 402/ok decision, `receipt` carries the settlement tx hash. Runs behind `Bun.serve` (the package is Bun-oriented; the SDK MCP is also Bun-only, see §7). Rails are declared per token; Studio-compatible sellers must cap `maxTimeoutSeconds ≤ 480` (default 300) because Studio's signer refuses windows over 600s and backdates `validAfter` by 120s.

---

## 4. Marketplace use cases (A–G matrix)

| ID    | Use case                                                                                                                    | Rail / side                                       | SDK surface                                                                                                      | Feasible now?                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **A** | **Agent pays external x402-gated APIs** (inference, price/data feeds, tools paid per request)                               | Buyer, any token → Permit2                        | `fetchWithX402` server-side after one-time `approveTokenForPermit2` + `approveSignatureChecker(PERMIT2_ADDRESS)` | ✅ (needs a funded session-wallet + a live 402 endpoint)                                           |
| **B** | **Marketplace as merchant**: charge per-call for marketplace-owned capabilities (registry lookups, job dispatch, analytics) | Seller (`x402-server` merchant)                   | `createX402Merchant` + `guard`                                                                                   | ⚠️ (needs `@altananetwork/x402-server` + facilitator EOA + a `payTo` smart account; mainnet-first) |
| **C** | **Agent-to-agent micro-payments**: one agent pays another's capability for a single call                                    | Buyer + Seller, permit2-exact                     | `fetchWithX402` ↔ `createX402Merchant`                                                                           | ⚠️ (both sides; same prerequisites as A+B)                                                         |
| **D** | **Usage-based metering / pay-per-call API gateway** over the marketplace's bundled data endpoints                           | Seller, eip3009 ($U) to be Studio-payable         | `rails: [{ rail:"eip3009", token: U_TOKEN[56] }]`                                                                | ⚠️ (mainnet $U; testnet $U address undocumented in fetched pages)                                  |
| **E** | **Monetize marketplace data/AI surfaces** (paid search, PnL insights, on-chain intel)                                       | Seller, permit2-exact over USDT-BSC               | merchant with `token: USDT_BSC`                                                                                  | ⚠️ (mainnet 56)                                                                                    |
| **F** | **Standing allowance**: session-capped daily spend so an agent auto-pays until allowance exhausts                           | Buyer provisioning + `grantSession` `spend` limit | scoped `grantSession` + checker approval                                                                         | ✅                                                                                                 |
| **G** | **BNB Agent Studio interoperability** (`bag x402 trust` → `bag x402 buy`; $U via eip3009 only)                              | Seller, https, `payTo` smart account              | `createX402Merchant` Studio-compliant                                                                            | ⚠️ (prod https + $U rail + mainnet)                                                                |

**Smallest genuine use case:** **(A) + (F)** — an agent (the marketplace's own Altana session) pays per-call for a live x402 API with a daily `spend` cap. It exercises the entire buyer stack (provision → sign → header → retry → settlement) with no `x402-server` dependency and no seller infrastructure.

---

## 5. ERC-8183 relationship (A–E)

| #     | Question                              | Verdict (traceable)                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Same protocol?                        | **No — independent.** x402 is the per-request HTTP payment standard (settled by Permit2 or the token contract; no escrow, no job lifecycle, no dispute). ERC-8183 is job escrow (registry + schedule + escrow + settle/dispute/refund; `ERC8183_ADDRESSES` per chain). Disjoint contract sets: `PERMIT2_ADDRESS`/token vs `ERC8183_ADDRESSES`.                   |
| **B** | Shared infrastructure?                | **Yes — shared session/signing layer.** Both sign with Altana session keys validated on-chain via ERC-1271 `isValidSignature` over `signOrderTypedData`; both need `grantSession` and a one-time `approveSignatureChecker` (x402 checker = `PERMIT2_ADDRESS` or token; ERC-8183 checker = escrow). A wallet can hold both a hiring session and a paying session. |
| **C** | Complementary or overlapping?         | **Complementary.** ERC-8183 = hire an agent for a defined job (escrow, deliverable polling, dispute protection). x402 = pay per discrete call/capability. A marketplace job can draw on x402-paid external resources internally; x402 does not replace job escrow.                                                                                               |
| **D** | Erc8183 in `ALTANA_CERTIFIED_SKILLS`? | **Not an x402 question** — Phase 4 already kept `x402-payments` OUT of the registry as non-executable (skills.verify.ts:105). 8004scan's `x402_supported` boolean and the skill registry are separate surfaces; x402 is a _payment/transfer capability_, not a _skill_.                                                                                          |
| **E** | Final stance                          | **Implement as a peer capability adapter** (same shape as `erc8183.ts`), testnet-gated like ERC-8183; keep job-hire on ERC-8183 and per-call payment on x402. Do not merge the two surfaces.                                                                                                                                                                     |

---

## 6. Skill / registry relationship

- `x402-payments` exists in the official Altana skills registry but is **not a composable marketplace skill** in the Phase-4 sense: it is excluded from `ALTANA_CERTIFIED_SKILLS` (no executable `x402-payments` skill). x402 is a **transport/payment rail**, analogous to ERC-8183, not an agent competence.
- The Phase-4 registry property `executable:false` for all skills already prevents "skills" from implying payment; x402 would be a separate capability adapter, and skills.verify.ts keeps asserting `x402-payments` is rejected.
- No change to the skills adapter is required for x402.

---

## 7. Server / client boundary

- **Must run server-side.** Third-party x402 endpoints commonly omit `X-PAYMENT` from `Access-Control-Allow-Headers`, so a browser cannot POST the payment. Both the docs and the SDK flag this. → Any marketplace x402 flow belongs in a **Next.js route handler / worker** (`apps/web/app/api/...` or `apps/worker`), never in the client bundle.
- The **session key** (the payer's authority) must also live server-side (keystore / env-derived), consistent with the existing Phase-2 sessions posture. The frontend only triggers an endpoint that the server calls with `fetchWithX402`.
- **Seller side** (`@altananetwork/x402-server`) is `Bun.serve`-based (the same Bun-only constraint already documented for the Altana MCP). That is a deployment consideration for a future merchant service, not for this discovery phase.

---

## 8. Credentials (dev / testnet / prod)

| Tier                                     | What is needed                                                                                                                                                                                                                                                 | Status this phase                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Dev / testnet (97)**                   | A funded testnet admin wallet (tBNB faucet), the derived Altana smart account, a scoped session; **no token approval needed to _receive_** — buyer side needs `approveTokenForPermit2` + `approveSignatureChecker(PERMIT2_ADDRESS)` for the rail. No API keys. | Not created — discovery has no signing authority. Keystore `0x6b8361C...94A` exists from Phase 2 (info only). |
| **Mainnet (56)**                         | Same wallet/session provisioning + a token with a testable rail (BNB USDC `0x8AC76a5...580d` for permit2-exact; $U eip3009 for Studio).                                                                                                                        | Out of scope (testnet-first invariant).                                                                       |
| **Prod seller**                          | `payTo` smart account for earnings, a **facilitator EOA** (gas only, never holds funds — recipient is bound in the signature), `rpcUrl`, https.                                                                                                                | Requires `@altananetwork/x402-server` install + key custodian decision (Phase 3B-equivalent).                 |
| **The "Merchant-401"/`Market_API` path** | Not x402 — handled by the Market API payment flow (see `okx-dex-market`), distinct from this protocol.                                                                                                                                                         | Out of scope here.                                                                                            |

No credentials are added in this phase; the repo remains keyless/credential-free.

---

## 9. Network support

| Chain           | Id   | x402 support                                                                                                                                                                                                                                                                   | Evidence                                                       |
| --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| BNB Smart Chain | 56   | ✅ Buyer + Seller on docs (USDT_BSC, BNB USDC, `U_TOKEN[56]`; B402 real wire `eip155:56`)                                                                                                                                                                                      | `sdk/x402-server`, `sdk/x402`, use-case 6                      |
| BNB **Testnet** | 97   | ✅ **Buyer rail supported by the SDK network map** (`bsc-testnet`/`bnb-testnet`→97, CAIP-2 `eip155:97`); full Altana stack deployed (keystore/relay). **Seller token addresses ($U/USDT) for 97 are not published on the fetched pages** — a mainnet merchant example uses 56. | `dist/x402.js` `networkToChainId`; `concepts/networks/testnet` |
| Base            | 8453 | ✅ EIP-3009 (Circle USDC) documented for **exact** rail                                                                                                                                                                                                                        | `sdk/x402` (FiatTokenV2_2)                                     |
| Ethereum        | 1    | ✅ via CAIP-2/legacy map; exact rail tokens                                                                                                                                                                                                                                    | `dist/x402.js` map                                             |

→ The marketplace's testnet-first invariant is satisfiable for the **buyer rail on chain 97** (any Permit2-approved test token). A **seller demo on 97** would require test `$U`/USDT addresses that the fetched docs don't publish — a genuine block for use cases that need Studio-style `$U` settlement, resolved either by the repo's own `$U` presence on 97 (pending on-chain probe; Phase 2 discovery can confirm via the testnet registry/explorer) or by falling back to permit2-exact over a test token.

---

## 10. Security / threat model

- **Recipient binding:** `payTo` is inside the signed payload (Permit2 witness `Witness(to,validAfter)` / EIP-3009 `to`), so the facilitator can't redirect funds. Facilitator = gas payer only.
- **Replay:** nonces burn on-chain (Permit2 nonce / EIP-3009 `nonce` + `validBefore`), so a captured `X-PAYMENT` can't be replayed.
- **Signer scoping:** Altana sessions are time- and spend-bounded (`grantSession` `expiry`, `spend.limit`); the checker restriction means a leaked session key can only sign what the wallet's signature checker approves.
- **ERC-1271 verification:** smart-account signature, not EOA key; merchants/settler verify `isValidSignature`; invalid payments revert.
- **Transport:** decode of the payment envelope is done server-side; https required for sell in production; `maxTimeoutSeconds` windows bounded (≤480 recommended) to shrink replay/signature window.
- **Repo posture:** no new secrets, no `NEXT_PUBLIC_`, no env additions this phase; the keyless-scan boundary statement from prior reviews is preserved.

---

## 11. Architecture (recommended layering, illustrative)

```
[apps/web client]                  ─ only triggers side-effect-free endpoints (frozen UI)
        │
        ▼
[Next.js route / worker (server)]  ─ holds Altana session; calls external 402 APIs
        ├── packages/integrations/src/altana/x402.ts      adapter (buyer): fetchWithX402 wrapper,
        │                                                   network→chain guard (97), provision helpers
        ├── x402.verify.ts                                  QA harness: exit-code gate, offline-provable
        └── index.ts + package.json script (altana:x402:verify)

[future: merchant service]         ─ @altananetwork/x402-server (Bun) for sell-side,
                                     payTo + facilitator EOA + rails (permit2-exact / eip3009)
```

Same shape as `erc8183.ts` / `skills.ts`: no app-route changes, no env, testnet-gated, verify-green.

---

## 12. Product flow (buyer-focused, smallest slice)

1. Power-up: marketplace provisions an Altana session (scoped `spend`, expiry) for a funded testnet wallet — **admin action**, one-time.
2. One-time rail setup: `approveTokenForPermit2` + `approveSignatureChecker(PERMIT2_ADDRESS)` (permit2-exact) on chain 97.
3. Agent needs a paid resource → server route calls `fetchWithX402({ session, url, chainId: 97 })`.
4. On 402: sign → `X-PAYMENT`+`PAYMENT-SIGNATURE` → retry → 200 content streamed to the agent; settlement seen on BscScan testnet.
5. Allowance enforcement: repeated calls draw against the session `spend.limit`; UI/copy can reflect "agent paid via x402" without any change to frozen screens.

---

## 13. Hackathon value

- **Demo-gold:** watch an agent auto-pay a real 402 endpoint on chain 97, then receive the gated content — a live, on-chain, codeless-for-the-user flow. `txHash` from `merchant.guard` (seller) or explorer on paid requests (buyer) gives instant proof.
- **Use case B/E/C** become a "marketplace that sells and buys capability" storefront story: the same marketplace is consumer (A) _and_ merchant (E) on the same protocol.
- Differentiators: per-call micropayments, invisible to the end user, settlement verifiable on-chain, no accounts/wallets in the browser.

---

## 14. Recommended implementation phases (future, not started)

| Phase   | Scope                                                                                                                                                                | Gate                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **X.1** | Offline adapter skeleton `packages/integrations/src/altana/x402.ts` exposing `supportsX402Chain(chainId)`, network-map guard (97), typed options mirror; NO signing. | `altana:verify` + `altana:x402:verify` green        |
| **X.2** | Live buyer harness on chain 97 against a real 402 endpoint (or a repo-owned local merchant on test RPC); sign + header + retry, assert 200.                          | requires testnet wallet/session + a live 402 source |
| **X.3** | Delivery integration: server route/worker wrapper; spend-limit surfacing; audit trail of paid requests.                                                              | UI still frozen                                     |
| **X.4** | Seller evaluation: install `@altananetwork/x402-server`, decision on `payTo`/facilitator custody, exploratory merchant on 97 (subject to §9 seller-token caveat).    | Phase 3B-equivalent key decision                    |
| **X.5** | Prod rails (mainnet 56) only after testnet proof + token selections.                                                                                                 | mainnet policy final                                |

---

## 15. Blockers

1. **No testnet seller-token addresses published** for `$U`/USDT on chain 97 (fetched docs show mainnet 56 only) → use cases D/G that depend on `$U` eip3009 need an on-chain probe of the testnet registry/explorer in Phase X.2 (or the existing discovered testnet `$U` address from Phase 2/3A artifacts must be re-confirmed). Buyer-side (A/F) is **not** blocked.
2. **`@altananetwork/x402-server` is not installed** and is Bun-oriented — seller evaluation needs a separate workspace decision (isolated service, not the Next app).
3. **Facilitator EOA custody** unresolved for interactive sell-side; buyer-side needs newsigner decision (Phase 3A §"externally supplied testnet wallet/signer" Open Question still open).
4. **Live 402 endpoint for integration tests** not yet identified/standby — needed for the X.2 live-harness iteration.

---

## 16. Decision

- **Adopt x402 as a peer capability** (adapter-shaped, like ERC-8183), **buyer rail on BNB testnet (97)** first, **permit2-exact** preferred, **server-side only** (CORS), with Studio/competition value delivered via the clear A/F slice and the B/E/C merchant story later.
- Independence from ERC-8183 confirmed: separate protocols, shared session/ERC-1271 signing layer, complementary (hire vs per-call). No change to the Phase-4 skill registry; `x402-payments` stays out of `ALTANA_CERTIFIED_SKILLS`.
- No code, env, or package changes were made in this phase; repo remains green and keyless.

**X402 STATUS: READY FOR IMPLEMENTATION** (phase X.1 scaffold: offline, non-signing `x402.ts` adapter + `x402.verify.ts` harness on chain 97, following the `erc8183` Phase-3A container). Blockers in §15.1/§15.2 are scoped to sell-side and live-integration sub-phases, not to the scaffold.
