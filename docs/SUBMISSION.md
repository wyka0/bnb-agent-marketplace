# BNB Agent Studio Marketplace — Submission

## PROJECT

**BNB Agent Studio Marketplace** — a production marketplace for discovering, understanding, comparing, and hiring AI agents on BNB Chain via ERC-8004/ERC-8183 (BNB Agent Studio), with a verified funded commercial hire on **both** BSC Testnet (97) and **BNB Mainnet (56)**.

**Live:** https://bnb-agent-marketplace-web.vercel.app

## MAIN TRACK

**Build the best agent marketplace for BNB Chain.** The marketplace lets users land, find an agent by category, understand what it does, compare candidates, and hire a real ERC-8183 seller with their own wallet — on the network they choose.

## FUNCTIONALITY

**discover** → **compare/understand** → **negotiate** → **confirm** → **user wallet** → **ERC-8183**

- **Discover:** real agents indexed by 8004scan (ERC-8004 registry) across four first-class categories; the catalog is **chain-aware** — Mainnet (56) and Testnet (97) are strictly scope-isolated server-side (no mixed-chain catalog; invalid scopes fail closed to Mainnet).
- **Understand:** agent detail pages show source-attributed data — registry identity/owner/chain/verification, TermiX reputation (read-only), PancakeSwap market intelligence (read-only) — with honest pending/unknown states when data is unavailable. Registry reads are bounded by a 4-second timeout with truthful degraded states during indexer outages.
- **Compare:** side-by-side comparison with explicit unavailable/pending states, never fabricated metrics.
- **Negotiate:** for Main Track commercial hire, the marketplace resolves the agent's registered on-chain AgentEndpoint and negotiates with the **live seller** (`POST /negotiate`), verifying the provider signature with the official SDK — cryptographically bound to the chain ID, verifying contract, and registered owner (no cross-chain substitution possible).
- **Confirm:** the user sees a confirmation review with the real provider, price, expiry and network.
- **User wallet:** the user's EIP-1193 browser wallet executes the ERC-8183 sequence (`createJob` → `registerJob` → `setBudget` → `approve` → `fund`) via `eth_sendTransaction`; the marketplace verifies receipts and the final on-chain state.
- **ERC-8183:** `funded-commercial-hire` is commercial escrow — never shown as ACTIVE.

**Verified live commercial sellers:**

- **Mainnet (chain 56):** Agent **#334760** — `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760`, endpoint `https://inbook-y1-plus.tail3e3640.ts.net:8443`, price **0.00001 $U** (1e13 wei).
- **Testnet (chain 97):** Agent **1906** — endpoint `https://inbook-y1-plus.tail3e3640.ts.net`, price 0.001 $U.

## DATA QUALITY

- **Real registry/on-chain/provider verification:** agents, identity, owner, chain and endpoints come from the ERC-8004 registry (8004scan); provider quotes are verified with the official SDK (`verifyQuoteSignature`) against the registered owner, official per-chain commerce, $U token, and future expiry.
- **Honest stale/unknown states:** every value is labeled by source and freshness; anything without authoritative data renders as an explicit unknown/pending/stale state. No fabricated prices, APY, TVL, volume, risk, performance, execution results, or funded jobs.
- **Verified funded hires exist on both chains:** Mainnet **Job 56715** (FUNDED, 0.00001 $U escrow, no settlement claimed) and Testnet **Jobs 920/921/922** (each a real funded marketplace hire, full lifecycle to COMPLETED).

## AGENT DIVERSITY

Four first-class categories, equal-depth treatment (category discovery, agent cards, detail, comparison, Hire CTA):

1. **Rebalancing**
2. **Grid Trading**
3. **Yield Optimisation**
4. **Health Factor Monitoring**

Category membership is inferred from real registry metadata by a deterministic classifier — never fabricated.

## ALTANA

**Not qualified / not claimed.** The marketplace uses a **self-custodial / user-wallet design**: the browser wallet owns nonce, gas, signing and broadcast (`eth_sendTransaction`); the server never receives a private key, never signs, and never calls `eth_sendRawTransaction` for user transactions. A browser-wallet ERC-8183 hire is not an Altana session-key transaction; no qualifying Altana session-key transaction, Keystore registration, scoped wallet session, or revoke flow is claimed.

## TERMIX

**One-minute summary:** "Three real funded marketplace hires were executed and compared against baseline work. Jobs 920/921/922 covered grid strategy, discovery, and security analysis. The measured hired-agent results totalled 69/75 versus 24/75 baseline, with actual outputs and negative findings preserved."

The **Agent Advantage Report** (`docs/termix/Agent-Advantage-Report.md`) documents three pre-registered A/B comparison tasks **plus three real funded Testnet marketplace hires of Agent 1906**:

- **Job 920** — grid-strategy report (trading/grid-strategy dimension; real funded hire, full lifecycle to COMPLETED; rubric 11/25 — honest but thin content, recorded as such)
- **Job 921** — discovery shortlist (discovery/research dimension; 21/25 — genuinely useful, fully sourced)
- **Job 922** — security verdict (**security-analysis dimension**: read-only contract wiring, census, and hygiene analysis; 23/25 — the strongest hired deliverable)

These were **actual funded marketplace hires** (0.001 $U escrow each, six transactions per hire, deliverables served by the escrowed seller wallet), not simulations. Timing and cost evidence is preserved per job (Task 05: 44 s; Task 06: 56 s; exact gas counts and tx hashes under `docs/termix/evidence/`). The measured baseline-vs-hired comparison (Arm B 69/75 vs Arm A 24/75) is preserved **with its negative findings**: no cost advantage, no reliable speed advantage, no blanket correctness advantage.

## PANCAKESWAP

**One-minute summary:** "The marketplace uses read-only PancakeSwap liquidity intelligence to give traders and LPs concrete liquidity/TVL context. It ranks bounded sampled pools, identifies observed liquidity depth, and provides decision context without signing swaps or fabricating APR/APY/volume data."

**PancakeSwap status: PARTIAL — live read-only market/demand intelligence with Agent Advantage.**

The **read-only PancakeSwap V2 market intelligence** integration is implemented and production-live (factory `eth_call` reserves + official pricing API; computed pool TVL, liquidity ranking, sampled deepest liquidity; no volume fabrication, no swaps/APY fabrication). Agent detail pages include a production-live **Agent Advantage** section that derives truthful decision context from the measured data:

- **Trader benefit:** the deepest-sampled pool (real reserves × official USD prices, e.g. Cake/WBNB $17.5M TVL) is identified so traders can see where liquidity actually sits before sizing an order.
- **LP benefit:** the deepest-sampled pool plus the official 0.25% V2 swap fee accruing to LPs.
- **Liquidity signal:** Strong/Moderate/Thin, derived only from observed pool reserves; fee tier from the official V2 constant.
- **Honest boundaries:** demand trend shows "Insufficient data" (no volume/price-change source); 24h volume and APR/APY are not available from on-chain data and are never estimated; no return, profitability, or prediction is claimed; signals describe the bounded registry sample, not the full ecosystem.

No wallet signing, no swaps, no liquidity transactions, no automated trading, and no APR are claimed.

## LIVE DEMO

**URL:** https://bnb-agent-marketplace-web.vercel.app

Routes verified live: `/`, `/marketplace` (chain-aware Mainnet/Testnet), `/agents`, `/compare`, `/categories/rebalancing`, `/categories/grid-trading`, `/categories/yield`, `/categories/health-factor`, agent detail pages (including Mainnet Agent #334760), `/api/activation/main-track-hire` (prepare/receipt/verify, read-only, fail-closed).

## EVIDENCE

**Mainnet (chain 56) — the current verified commercial path:**

- `docs/review/X238-Mainnet-ERC8004-Registration.md` — Agent #334760 registration (single authorized tx `0x59edb714…cdbd2`)
- `docs/review/X242-First-Mainnet-Hire.md` — Job 56715: the first real Mainnet hire, **FUNDED** (0.00001 $U escrow; createJob + registerJob `0x8c1c0c4c…` + setBudget `0x62353e25…` + approve `0xdb5de803…` + fund `0xc65fe0ab…`; no settlement claimed)
- `docs/review/X242-RECOVERY.md` — the client receipt-handling bug exposed by the first Mainnet broadcasts, root-caused and fixed
- `docs/review/X244-Registry-Latency-Diagnostic.md` + `X245-Registry-Latency-Fix.md` — registry-latency diagnostics and the 4s bounded-timeout fix
- `docs/review/X243-Network-Isolation.md` + `X246-Hireability-Fix.md` — chain-aware catalog isolation and hireability fixes

**Testnet (chain 97):**

- `docs/termix/Agent-Advantage-Report.md` — TermiX measurements + real hired Jobs 920/921/922
- `docs/termix/evidence/task-04…06/` — full lifecycle evidence (6 tx hashes per hire, deliverables, provenance)
- `docs/review/` — the complete milestone-by-milestone review record
