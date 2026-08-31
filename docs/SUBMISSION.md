# BNB Agent Studio Marketplace — Submission

## PROJECT

**BNB Agent Studio Marketplace** — a production marketplace for discovering, understanding, comparing, and hiring AI agents on BNB Chain via ERC-8004/ERC-8183 (BNB Agent Studio).

**Live:** https://bnb-agent-marketplace-web.vercel.app

## MAIN TRACK

**Build the best agent marketplace for BNB Chain.** The marketplace lets users land, find an agent by category, understand what it does, compare candidates, and hire a real ERC-8183 seller with their own wallet.

## FUNCTIONALITY

**discover** → **compare/understand** → **negotiate** → **confirm** → **user wallet** → **ERC-8183**

- **Discover:** real agents indexed by 8004scan (ERC-8004 registry) across four first-class categories; chain-97 (BSC Testnet) and chain-56 (BSC mainnet) agents are surfaced through a bounded, category-aware discovery layer.
- **Understand:** agent detail pages show source-attributed data — registry identity/owner/chain/verification, TermiX reputation (read-only), PancakeSwap market intelligence (read-only) — with honest pending/unknown states when data is unavailable.
- **Compare:** side-by-side comparison with explicit unavailable/pending states, never fabricated metrics.
- **Negotiate:** for Main Track commercial hire, the marketplace resolves the agent's registered on-chain AgentEndpoint and negotiates with the **live seller** (`POST /negotiate`), verifying the provider signature with the official SDK.
- **Confirm:** the user sees a confirmation review with the real provider, price, expiry and network.
- **User wallet:** the user's EIP-1193 browser wallet executes the ERC-8183 sequence (`createJob` → `registerJob` → `setBudget` → `approve` → `fund`) via `eth_sendTransaction`; the marketplace verifies receipts and the final on-chain state.
- **ERC-8183:** `funded-commercial-hire` is commercial escrow — never shown as ACTIVE.

**Live example:** Agent **2005 — Canned Range Keeper** (chain 97, owner `0x0eAc2F4d…`). Its live endpoint negotiates a real quote (price `0.001 U`, official chain-97 commerce + $U) whose `provider_sig` verifies to the registered owner. The Hire UI shows the real quote.

## DATA QUALITY

- **Real registry/on-chain/provider verification:** agents, identity, owner, chain and endpoints come from the ERC-8004 registry (8004scan); provider quotes are verified with the official SDK (`verifyQuoteSignature`) against the registered owner, official commerce, $U token, chain 97 and future expiry.
- **Honest stale/unknown states:** every value is labeled by source and freshness; anything without authoritative data renders as an explicit unknown/pending/stale state. No fabricated prices, APY, TVL, volume, risk, performance, execution results, or funded jobs.
- No successful production funded hire is claimed: a real attempt (X.157) was blocked at the first broadcast by a documented BSC testnet RPC issue; the marketplace fails closed honestly.

## AGENT DIVERSITY

Four first-class categories, equal-depth treatment (category dashboard, agent cards, detail, comparison, Hire CTA):

1. **Rebalancing**
2. **Grid Trading**
3. **Yield Optimisation**
4. **Health Factor Monitoring**

Category membership is inferred from real registry metadata by a deterministic classifier — never fabricated.

## ALTANA

The marketplace uses a **self-custodial / user-wallet design**: the browser wallet owns nonce, gas, signing and broadcast (`eth_sendTransaction`); the server never receives a private key, never signs, and never calls `eth_sendRawTransaction` for user transactions. Real ERC-8183 work is documented (X.126B/X.126C full funded/completed job 622; X.130 marketplace-funded job 641; X.156 dynamic live-seller Hire). No unsupported Altana session-key production functionality is claimed.

## TERMIX

The existing **Agent Advantage Report** (`docs/termix/Agent-Advantage-Report.md`) documents three real A/B tasks (including a security task) with real measurements stored under `docs/termix/evidence/`. It is evidence of discovery/intelligence capability, not proof of completed paid marketplace hiring.

## PANCAKESWAP

**PancakeSwap status: PARTIAL — live read-only market/demand intelligence with Agent Advantage.**

The **read-only PancakeSwap V2 market intelligence** integration is implemented and production-live (on-chain reserves + official pricing; pool TVL, no volume fabrication, no swaps/APY fabrication). Agent detail pages now include a production-live **Agent Advantage** section that derives truthful decision context from the measured data:

- **Trader benefit:** the deepest-sampled pool (real reserves × official USD prices, e.g. Cake/WBNB $17.5M TVL) is identified so traders can see where liquidity actually sits before sizing an order.
- **LP benefit:** the deepest-sampled pool plus the official 0.25% V2 swap fee accruing to LPs.
- **Liquidity signal:** Strong/Moderate/Thin, derived only from observed pool reserves; fee tier from the official V2 constant.
- **Honest boundaries:** demand trend shows "Insufficient data" (no volume/price-change source); 24h volume and APR/APY are not available from on-chain data and are never estimated; no return, profitability, or prediction is claimed; signals describe the bounded registry sample, not the full ecosystem.

No automated trading, no liquidity automation, and no APR are claimed.

## LIVE DEMO

**URL:** https://bnb-agent-marketplace-web.vercel.app

Routes verified live: `/`, `/marketplace`, `/agents`, `/compare`, `/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor`, agent detail (Agent 2005), `/api/activation/main-track-hire` (prepare/receipt/verify, read-only, fail-closed).

## EVIDENCE

- `docs/review/Main-Track-X154-Live-Registry-Discovery.md` — live BSC Testnet discovery
- `docs/review/Main-Track-X155C-8004Scan-Live-Agent-Audit.md` — live-agent endpoint + signature audit (Agent 2005/2003/2001/2000)
- `docs/review/Main-Track-X156-Dynamic-ERC8183-Hire.md` — dynamic live-seller Hire (implemented, tested, deployed)
- `docs/review/Main-Track-X157-Real-Agent-2005-Hire.md` — one real attempt (blocked at first broadcast by RPC infra)
- `docs/review/Main-Track-X158-Browser-Wallet-RPC-Diagnosis.md` — browser wallet bypasses the failing seed RPC
- `docs/termix/Agent-Advantage-Report.md` — TermiX measurements
- `docs/review/Main-Track-X159-Final-Submission-Readiness.md` — this readiness report
