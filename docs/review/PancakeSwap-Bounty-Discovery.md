# PancakeSwap Bounty — Discovery Only

**Scope:** Read-only discovery. No application code, packages/ui, frozen sprints, Leaderboards, Agent Details, Altana, TermiX, x402, or ERC-8183 were modified. No packages installed, no wallet/signing code, no transactions, no credentials, no git/GitHub.
**Date:** 2026-08-10
**Tag legend:** **[OFFICIAL]** = verified against an official PancakeSwap / BNB Chain source fetched today · **[REPO]** = verified against the current repository · **[INFERENCE]** = reasoned conclusion from the above · **[UNKNOWN]** = not publicly documented / not found.

---

## 1. Executive Summary

The BNB Chain **"Smart Money Era: Build the Era"** hackathon (5 Aug – 9 Sep, 2026, $30,000 + partner bounties) lists **PancakeSwap** as a sponsor with a **PancakeSwap Challenge: 🏆 1,000 CAKE** `**[OFFICIAL]**`.

The challenge is **agent-shaped**, not library-shaped: it explicitly asks for **"an agent"** that delivers a "real benefit to PancakeSwap traders or liquidity providers," with examples of _smarter liquidity management, finding better yields, researching market movements to find demand where creating PancakeSwap pools could improve liquidity efficiency, or executing safe automated swaps using PancakeSwap products without ever putting user funds at risk_ `**[OFFICIAL]**`.

**Headline findings:**

- The challenge **does not** require a generic PancakeSwap SDK wrapper, and it **does not** explicitly mandate a live swap/LP transaction or a mainnet tx-hash (unlike the AltLayer/Altana bounty, which explicitly requires live on-chain txs) `**[OFFICIAL]**` + `**[INFERENCE]**`.
- The project's existing Altana certified skills include `pancakeswap-trading` and `pancakeswap-liquidity`, but they are **capability metadata only — non-executable, no wiring into the marketplace, no on-chain surface** `**[REPO]**`.
- A genuinely valuable, in-scope feature exists that the skills do NOT provide: **read-only PancakeSwap market/LP intelligence** (pool APR/liquidity/volume/price via the official **Subgraph** + **Price API**), surfaced through the agent-marketplace (e.g., as a "PancakeSwap yield/liquidity intelligence" capability tied to the `pancakeswap-liquidity` skill) `**[INFERENCE]**`.
- **Recommendation: Option B — a READ-ONLY PancakeSwap integration** (Option C/D execution is out of scope and unnecessary; Option E is premature). However, because the challenge criteria for what "real benefit" must look like are only loosely specified and no hard submission/format requirements are published, the correct single status is **BLOCKED — OFFICIAL REQUIREMENTS UNCLEAR on the exact qualification bar / evidence format**, with a clear, ready Phase plan once that is known.

---

## 2. Official Challenge Requirements

Source: `https://www.bnbchain.org/en/hackathons` → "The Smart Money Era: Build the Era" detail page (fetched today) `**[OFFICIAL]**`.

| #   | Question                                 | Answer                                                                                                                                                                                                                                    | Tag                                                           |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | What qualifies?                          | The **"PancakeSwap Challenge"** partner bounty.                                                                                                                                                                                           | **[OFFICIAL]**                                                |
| 2   | What is "real benefit"?                  | The exact text: _"best submission delivering a real benefit to PancakeSwap traders or liquidity providers."_ No quantitative bar (e.g., X swaps, Y TVL) is published.                                                                     | **[OFFICIAL]** + **[UNKNOWN]** (no hard metric)               |
| 3   | Target audience?                         | **Both** — "traders **or** liquidity providers".                                                                                                                                                                                          | **[OFFICIAL]**                                                |
| 4   | Expected functionality?                  | An **agent** that delivers benefit: smarter liquidity management, better yields, market-movement research for new/efficient PancakeSwap pools, or safe automated swaps.                                                                   | **[OFFICIAL]**                                                |
| 5   | Direct PancakeSwap integration required? | Not explicitly. It says "delivering a real benefit … using PancakeSwap products" as one example; "using another protocol" is not mentioned as allowed **or** forbidden.                                                                   | **[UNKNOWN]** (ambiguous)                                     |
| 6   | Via another protocol/partner enough?     | Not stated. The challenge is judged "independently by PancakeSwap"; whether routing through Altana counts is undocumented.                                                                                                                | **[UNKNOWN]**                                                 |
| 7   | Altana PancakeSwap skills sufficient?    | Skills are the _capability layer_; the challenge wants a _submission/agent delivering benefit_. Skills alone are metadata, not a delivered benefit.                                                                                       | **[REPO]** + **[INFERENCE]**                                  |
| 8   | Live on-chain activity required?         | **Not stated** for PancakeSwap. Contrast: AltLayer ("must show live onchain transactions in the Altana explorer"). PancakeSwap has no such explicit line.                                                                                 | **[OFFICIAL]** (absence) → the _requirement_ is **[UNKNOWN]** |
| 9   | Testnet acceptable?                      | Not stated either way. No "must be mainnet" or "must be testnet" clause for PancakeSwap.                                                                                                                                                  | **[UNKNOWN]**                                                 |
| 10  | Mainnet required?                        | No explicit mainnet requirement for PancakeSwap.                                                                                                                                                                                          | **[UNKNOWN]**                                                 |
| 11  | Live swaps required?                     | Only listed as a possible _example_ ("executing safe automated swaps … without ever putting user funds at risk"), not a mandate.                                                                                                          | **[OFFICIAL]** (example) / **[UNKNOWN]** (requirement)        |
| 12  | Liquidity tx required?                   | Not stated.                                                                                                                                                                                                                               | **[UNKNOWN]**                                                 |
| 13  | Read-only market data sufficient?        | Not stated explicitly; "researching market movements to find demand … improve liquidity efficiency" is data/intelligence work and is offered as a valid example — implying read-only CAN be in-scope, but nothing guarantees sufficiency. | **[OFFICIAL]** (example) + **[INFERENCE]**                    |
| 14  | Evidence to submit?                      | Not published for PancakeSwap. (Project submission is a form; report/demos are handled at the challenge level for other tracks.)                                                                                                          | **[UNKNOWN]**                                                 |
| 15  | Screenshots required?                    | Not stated.                                                                                                                                                                                                                               | **[UNKNOWN]**                                                 |
| 16  | Demo video required?                     | Not stated for PancakeSwap.                                                                                                                                                                                                               | **[UNKNOWN]**                                                 |
| 17  | Tx hash required?                        | Not stated.                                                                                                                                                                                                                               | **[UNKNOWN]**                                                 |
| 18  | Source code required?                    | Generic "Submit Project / Apply as Hacker" form links exist; no pancake-specific "link to repo" mandate published.                                                                                                                        | **[UNKNOWN]**                                                 |
| 19  | Wallet address required?                 | Only Altana's bounty says "include your wallet address(es)". PancakeSwap does not.                                                                                                                                                        | **[OFFICIAL]** (negative for Pancake)                         |
| 20  | Technology restrictions?                 | None published for PancakeSwap.                                                                                                                                                                                                           | **[UNKNOWN]**                                                 |

**Bottom line:** the challenge is documented at a _goal_ level, not a _checklist_ level. Many concrete submission mechanics are **[UNKNOWN]**.

---

## 3. Official PancakeSwap Developer Surface

Sources: `developer.pancakeswap.finance` (Overview, APIs/Subgraph, SDKs, Smart Router, Price API) `**[OFFICIAL]**`.

| Name                                                                 | Purpose                                                               | URL                                                                                 | Read/Write                                                                                       | Chains                                | Auth                                                | Tx required?        | Recommended use here                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------- | ------------------- | ----------------------------------------- |
| **Subgraph (GraphQL)** — `pancake-subgraph`                          | V2/V3/StableSwap/Infinity pool price, volume, liquidity, APR-ish data | `github.com/pancakeswap/pancake-subgraph`; NodeReal/BSC + TheGraph for ETH/ARB/etc. | **Read**                                                                                         | BSC + ETH/ARB/zkSync/Linea/Base/opBNB | TheGraph API key may apply; NodeReal gateway public | **No**              | **Read-only pool/LP/market intelligence** |
| **Price API / `@pancakeswap/price-api-sdk`**                         | USD + native token prices per chain                                   | `developer.pancakeswap.finance/sdks/price-api-sdk`                                  | **Read**                                                                                         | BSC + others                          | None for public API                                 | **No**              | Token price data (needs package)          |
| **Smart Router / `@pancakeswap/smart-router`**                       | Best-route finder across V2/V3/Infinity + build calldata              | `developer.pancakeswap.finance/sdks/smart-router`                                   | Quote = **read** (on-chain quote via public viem client); swap = **write** (needs wallet/signer) | BSC + others                          | None to quote; wallet to execute                    | Yes for _execution_ | Quote routing (execution deferred)        |
| **Universal Router / `@pancakeswap/universal-router-sdk`**           | Build swap calldata for the deployed Universal Router                 | `contracts/universal-router/addresses`                                              | **Write**                                                                                        | BSC + others                          | Wallet + Permit2                                    | **Yes**             | Execution only — out of scope             |
| **Permit2 / `@pancakeswap/permit2-sdk`**                             | Allowance + signature-transfer helpers                                | `sdks/permit2-sdk`                                                                  | **Write** (approval + signature)                                                                 | BSC + others                          | Wallet                                              | **Yes**             | Execution only — out of scope             |
| **v3-sdk / v2-sdk / infinity-sdk / swap-sdk-core / chains / tokens** | Pool math, position mgmt, primitives                                  | `sdks/overview`                                                                     | mostly read/compute; position mgmt = write                                                       | multi                                 | none to compute                                     | for write only      | compute/typing only                       |
| **PCSX / `@pancakeswap/pcsx-sdk`**                                   | Dutch order (PancakeSwap X) trades                                    | `sdks/pcsx-sdk`                                                                     | Write                                                                                            | BSC + others                          | Wallet                                              | **Yes**             | Out of scope                              |

**Key:** there IS a real **read-only data surface** (Subgraph + Price API) usable without any wallet or signing. Quoting (Smart Router) is read-only but needs an on-chain provider + `@pancakeswap/*` packages (install). `**[OFFICIAL]**`

---

## 4. Existing Repository Capabilities — **[REPO]**

PancakeSwap appears in the repo **only** as **Altana certified-skills metadata** — there is **no execution, no wiring, no PancakeSwap data or API anywhere**:

- `packages/integrations/src/altana/skills.ts:35-36` lists `"pancakeswap-trading"` and `"pancakeswap-liquidity"` in `ALTANA_SKILL_IDS`.
- Their registry entries (`ALTANA_CERTIFIED_SKILLS` lines 86–100) are descriptions _"Swap tokens through PancakeSwap routes."_ and _"Provide and manage liquidity in PancakeSwap pools."_ with **`executable: false`** (the Phase-4 boundary: `assertAltanaSkillsNonExecutable` always throws).
- No PancakeSwap subgraph/price/router usage, no `@pancakeswap/*` dependency, no PancakeSwap data on any page (Leaderboards/Agent Details are 8004scan/TermiX only). `grep` finds PancakeSwap only in `skills.ts` and review docs.

**They are: metadata only · non-executable · read/write-capable-by-name-only · NOT wired into the marketplace.** They must not be changed.

---

## 5. Altana PancakeSwap Skill Overlap

**"What would a direct PancakeSwap integration add that the existing Altana skills do not?"** — **a concrete, real answer exists.**

The skills are **static capability labels** ("this agent trades on PancakeSwap" / "… provides liquidity"). A direct integration would add the thing the skills cannot carry:

1. **Live market/pool data** — real APR / TVL / 24h volume / token prices for PancakeSwap pools (Subgraph + Price API). The skills supply **zero data**.
2. **Ranking & comparison** — which pool/route is best right now (data-driven), which no static label can express.
3. **Actionable evidence** for the bounty: a judge can see a concrete LP-intelligence/trader-intelligence agent with _real numbers_, not a placeholder.

So **a read-only PancakeSwap intelligence surface is NOT a duplicate** of the skills — it's a genuinely missing capability that the skills only _name_. (A swap/LP _execution_ surface WOULD duplicate what skills claim, and is out of scope.) **[REPO]** + **[INFERENCE]**

---

## 6. Trader Use Cases (hypotheses — none assumed to qualify)

| Candidate                                           | User      | Problem                               | PancakeSwap data required             | Integration                                       | Live tx?   | Why it benefits traders                   | Evidence needed           |
| --------------------------------------------------- | --------- | ------------------------------------- | ------------------------------------- | ------------------------------------------------- | ---------- | ----------------------------------------- | ------------------------- |
| **Token/pair price lookup**                         | trader    | "what's the price?"                   | Price API (USD/native per chain)      | Read-only (pkg)                                   | No         | Faster, accurate pricing                  | live numbers + screenshot |
| **Best-route / slippage / quote**                   | trader    | "best execution?"                     | Smart Router (V2/V3/Infinity quote)   | Quote (read) — needs packages + on-chain provider | No (quote) | Lower slippage, better route              | quote output demo         |
| **Pool/liquidity depth + side**                     | trader    | "can my trade fill w/o moving price?" | Subgraph (liq, vol, depth)            | Read-only                                         | No         | Avoid thin pools / high impact            | pool analytics UI         |
| **Market-movement → new-pool-opportunity research** | trader/LP | "where is demand unmet?"              | Subgraph (vol/liq trends) + Price API | Read-only                                         | No         | Front-run liquidity gaps / pair discovery | report + data             |

**Strongest trader-side fit:** _price/quote + liquidity-depth intelligence_ (read-only). **[INFERENCE]**

---

## 7. LP Use Cases (hypotheses — none assumed to qualify)

| Candidate                                       | User | Problem                             | Data                      | Integration | Live tx? | Why it benefits LPs   | Evidence               |
| ----------------------------------------------- | ---- | ----------------------------------- | ------------------------- | ----------- | -------- | --------------------- | ---------------------- |
| **APR/APY + fee + volume/liquidity comparison** | LP   | "which pool earns most per risk?"   | Subgraph (fees, vol, TVL) | Read-only   | No       | Better pool selection | ranked table + numbers |
| **Impermanent-loss / volatility risk view**     | LP   | "will IL eat my fees?"              | Subgraph price history    | Read-only   | No       | Avoid losing pools    | IL estimate demo       |
| **LP opportunity discovery**                    | LP   | "where's under-provisioned demand?" | Subgraph (vol vs TVL)     | Read-only   | No       | Higher fee capture    | report + data          |

**Strongest LP-side fit per official example ("finding better yields", "smarter liquidity management", "researching … create pools to improve efficiency"):** an **LP yield/liquidity intelligence** surface (APR/fees/TVL/volume ranking + opportunity flags). **[OFFICIAL]** (examples) + **[INFERENCE]**

---

## 8. Read-only vs Execution

| Option                                                  | Complexity | Security risk                                | Wallet               | Tx         | Testnet avail                                                        | Mainnet      | Bounty relevance (read as delivery of "real benefit")                             | Evidence strength  |
| ------------------------------------------------------- | ---------- | -------------------------------------------- | -------------------- | ---------- | -------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- | ------------------ |
| **A. Read-only data/intelligence** (Subgraph/Price API) | Low        | **None** (no keys)                           | None                 | **No**     | Subgraph BSC mainnet; BSC **testnet** subgraph support **[UNKNOWN]** | Not required | **High** — matches "better yields / smarter liquidity / market research" examples | Live data + report |
| **B. Quote/routing** (Smart Router quote only)          | Med        | Low                                          | None (public client) | No (quote) | needs packages + on-chain quote on BSC testnet **[UNKNOWN]**         | Not required | Med (shows best route)                                                            | quote demo         |
| **C. Swap execution**                                   | High       | **High** (Permit2, approvals, slippage, MEV) | Yes                  | **Yes**    | testnet router/pools support **[UNKNOWN]**                           | ambiguous    | Med (one example)                                                                 | tx-hash            |
| **D. LP execution**                                     | High       | **High** (IL, approvals, position mgmt)      | Yes                  | **Yes**    | **[UNKNOWN]**                                                        | ambiguous    | Med                                                                               | tx-hash            |
| **E. Agent-powered PancakeSwap strategy**               | Very High  | **Very High**                                | Yes                  | **Yes**    | **[UNKNOWN]**                                                        | ambiguous    | Med                                                                               | report + tx        |

**Nothing here is implemented.** **[INFERENCE]** for the comparative weights.

---

## 9. Live Transaction Requirements — **[UNKNOWN]**

From the official PancakeSwap Challenge text, **no** explicit requirement for a real swap, LP deposit/withdrawal, a transaction hash, a testnet tx, or a mainnet tx is published. Contrast with the Altana-partner bounty, which _explicitly_ says "must show live onchain transactions … (testnet counts, mainnet is stronger)" `**[OFFICIAL]**`.

Per the directive: **do not infer "live transaction required" just because execution is possible.** → **PancakeSwap live-tx requirement: UNKNOWN.**

---

## 10. Testnet Support — **[UNKNOWN]-ish**

- The **BSC Testnet** (chain 97) exists with a public RPC and a `bscTestnet` chain in `viem/chains`, and the project already uses it (x402/TermiX). But **official PancakeSwap testnet support** (subgraph on BSC testnet, deployed V2/V3/SmartRouter/Infinity contracts + pools/tokens on 97) is **not documented on the fetched developer pages**, which list **mainnet** chains for the subgraph/price coverage. → **PancakeSwap-on-BSC-Testnet support: UNKNOWN** `**[OFFICIAL]**` (absence of testnet entries).
- No wallets created/funded; no transactions submitted.

---

## 11. Security

- **Read-only (Option A):** uses only public read APIs.**No** private key, wallet connect, Permit2, approval, Universal Router call, slippage, MEV exposure, or spending limit is involved. Confirmed achievable with **no wallet/signing capability**. **[INFERENCE]** from official surfaces.
- **Quote (Option B):** still no signing (public read via viem), but pulls `@pancakeswap/*` packages (install) and an on-chain provider.
- **Execution (C/D/E):** introduces Permit2 signatures, token approvals, the Universal Router, slippage/MEV, arbitrary input, and mainnet funds — **security risk high** and out of scope. **[OFFICIAL]** (router/permit2 surfaces) + **[INFERENCE]**.

No implementation performed.

---

## 12. Architecture Fit

Current (conceptual) sources of truth in this marketplace:

```
8004scan → agent identity/trust · Altana → skills/execution infra ·
TermiX → agent reputation/AACP · x402 → payments · ERC-8183 → jobs/escrow
```

**PancakeSwap should sit as a read-only market/trading/liquidity _intelligence_ layer**, following the **exact same proven pattern** already used for 8004scan (server-only client in `apps/web/lib/*` + normalized types + frozen client view). It would feed:

- the **Agent Details / capabilities** view (as an additional, clearly-labeled data source — like TermiX), and/or
- a dedicated **"PancakeSwap Intelligence"** read-only module behind the `pancakeswap-trading` / `pancakeswap-liquidity` skills.

This is consistent with the existing architecture; it does **not** replace or duplicate 8004scan/Altana/TermiX. **[REPO]** (existing pattern) + **[INFERENCE]**.

---

## 13. Product Placement

| Area                            | Value         | Notes                                                                                                                                                                       |
| ------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace                     | Medium        | could add a "PancakeSwap yield" filter surfacing skill-bearing agents                                                                                                       |
| **Agent Details**               | **High**      | a clearly-separated read-only "PancakeSwap market / LP intelligence" section (mirroring the just-added TermiX Reputation pattern) — **smallest genuinely-valuable surface** |
| Agent capabilities              | Medium        | link the `pancakeswap-*` skills to real data                                                                                                                                |
| Dedicated PancakeSwap dashboard | Higher effort | out of scope for a first slice                                                                                                                                              |
| Trader / LP dashboard           | Higher effort | out of scope                                                                                                                                                                |

**Recommendation:** the **smallest sufficient surface is the Agent Details read-only intelligence section** (same slot as TermiX Reputation). **[INFERENCE]**. No UI built.

---

## 14. Hackathon Strategy (no arbitrary numeric scores)

| Track                                    | Required implementation                      | External deps             | Credentials                     | Wallet             | Live tx         | Technical complexity | Security risk | Judging relevance | Evidence strength |
| ---------------------------------------- | -------------------------------------------- | ------------------------- | ------------------------------- | ------------------ | --------------- | -------------------- | ------------- | ----------------- | ----------------- |
| **Main**                                 | the agent marketplace itself (already built) | 8004scan key (gated)      | 8004scan key                    | —                  | no              | med                  | low           | core              | strong            |
| **Altana** (altana.skills/x402/ERC-8183) | already built                                | wallet for execution      | —                               | yes (for exec)     | track-dependent | med                  | med           | high              | strong            |
| **TermiX** (AACP)                        | read-only reputation just added              | public TermiX API         | none (read)                     | no                 | no              | low                  | low           | high              | strong            |
| **PancakeSwap**                          | "an agent that benefits traders/LPs"         | Subgraph/Price API (read) | none (read); TheGraph key maybe | **no (read-only)** | **UNKNOWN**     | low-med              | low (read)    | high              | med-strong        |

PancakeSwap is **low-risk / high-relevance** if read-only, but its exact qualification bar is **[UNKNOWN]**.

---

## 15. Recommended Implementation

**Option B — BUILD READ-ONLY PANCAKESWAP INTEGRATION**, as the smallest genuinely-valuable surface: a server-only, read-only **`pancakeswap` intelligence adapter** (pool/token/APR/liquid/volume data) that (1) feeds Agent Details as a clearly-labeled, separate Section (the TermiX Reputation precedent), and (2) is linked semantically to the existing `pancakeswap-trading` / `pancakeswap-liquidity` skills. **NOT a generic SDK wrapper.** **[INFERENCE]**

Because the challenge's _exact_ bar/evidence requirements are not published (**[UNKNOWN]**), implementation should **not start** until that is resolved — hence the SINGLE status below.

---

## 16. Evidence Required — **[UNKNOWN]**

No published PancakeSwap-specific evidence (screenshot, video, tx-hash, repo link, wallet) requirements were found. The hackathon uses a generic "Submit Project / Apply as Hacker" form. Concrete evidence mechanics are **[UNKNOWN]**. A read-only implementation would naturally produce: live numbers in the UI, a source-clearly-labeled report, and (if later exercised) a tx-hash only if/when the challenge is confirmed to require one.

---

## 17. Risks

- **Criteria-uncertainty risk (HIGH):** "real benefit" is a goal, not a checklist; sufficiency of read-only data is not guaranteed **[UNKNOWN]**.
- **Testnet-support risk (MED):** PancakeSwap subgraph/contract coverage on BSC **testnet** is undocumented; live PancakeSwap data may effectively be mainnet-only **[UNKNOWN]**. The project's testnet-first invariant may force a mainnet-read-only or a clearly-labeled choice.
- **Package-install risk (LOW):** Smart Router / Price API need `@pancakeswap/*` installs (out of scope here).
- **Duplication risk (LOW, mitigated):** read-only intelligence does NOT duplicate skills (skills carry no data); execution WOULD.

---

## 18. What NOT to Build

- Do **NOT** build a generic `@pancakeswap/*` SDK wrapper (the challenge rewards benefit-to-traders/LPs, not boilerplate) — **[INFERENCE]**.
- Do **NOT** implement **swap/LP execution**, Permit2 approvals, or Universal Router calls in this phase (out of scope + high security risk) — **[OFFICIAL]** (execution surfaces) + scope.
- Do **NOT** add PancakeSwap to Leaderboards / dashboard / main UI in this phase.
- Do **NOT** install packages, add wallets/signing, submit transactions, add credentials, or touch git/GitHub.

---

## 19. Final Decision

**BLOCKED — OFFICIAL REQUIREMENTS UNCLEAR**, leaning **Option B (read-only build)** once clarified.

Reason: the challenge's _goal_ (real benefit to PancakeSwap traders/LPs) is official and clear, but the _qualification bar, target (read-only vs execution), testnet/mainnet, and evidence/format_ requirements are **[UNKNOWN]** from official sources — and a live-transaction requirement must not be assumed. There IS a genuinely valuable, non-duplicative, low-risk read-only candidate (PancakeSwap pool/LP/trader intelligence) that fits the official examples. Implementation is deferred to a future phase once the criteria are confirmed.

---

## Appendices

**Authoritative sources checked:** `www.bnbchain.org/en/hackathons` (Smart Money Era detail), `developer.pancakeswap.finance` (Overview, APIs/Subgraph, SDKs overview, Smart Router, Price API SDK).
**Existing repo overlap:** `pancakeswap-trading` + `pancakeswap-liquidity` skills (metadata-only, `executable: false`, not wired).
**Live transactions required:** **UNKNOWN** (not stated for PancakeSwap; explicitly _not_ required by the published text).
**Next implementation phase:** **Phase P1** — a read-only, server-only PancakeSwap data adapter (Subgraph/Price API) behind a verify harness, once criteria are confirmed.

No code, no packages, no UI, no transactions, no wallets, no credentials, no git. Discovery only.
