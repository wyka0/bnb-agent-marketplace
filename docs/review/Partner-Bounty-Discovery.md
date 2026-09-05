# Partner Bounty Discovery — TermiX & PancakeSwap (BSC Testnet / ERC-8004)

<!-- markdownlint-disable-next-line -->
<!-- Scope: read-only discovery. No code, env, or package changes. No credentials added. No transactions. -->

**Scope:** Read-only discovery against current official sources. No application code, packages/ui, frozen sprints, or git state modified. No packages installed, no credentials added, no Hire activation, no transactions, no publication.
**Date:** 2026-08-10
**Method:** Verified against CURRENT official partner documentation and the repository's own prior review artifacts. Tag legend follows the existing review docs.

---

## 1. Purpose & Why This File Exists

Section 6 of `Final-Integration-Gap-Analysis.md` (written earlier today) concluded "DO NOT integrate TermiX" and "DO NOT add a separate PancakeSwap SDK" based on the _prior_ understanding of TermiX as the `bnb-mcp` tool server and the absence of any "Agent Advantage Report." That prior understanding is **stale**: TermiX now documents the **Autonomous Agent Capital Protocol (AACP)** — an ERC-8004-compliant agent-hires-agent marketplace running live on BSC Testnet (chain 97).

This file **corrects** §5 and §6 of the gap analysis with authoritative sources fetched today. It does not re-decide the other 12 sections.

---

## 2. Authoritative Sources (fetched today)

| Source                     | URL                                                           | What it establishes                                                                                       |
| -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| TermiX docs index          | `https://docs.termix.ai/llms.txt`                             | AACP is the documented protocol; MCP & SDK are "coming soon"                                              |
| TermiX AACP overview       | `https://docs.termix.ai/aacp/overview.md`                     | ERC-8004 marketplace, 4 role guides (Client/Provider/Evaluator/Arbitrator), reputation, staking, disputes |
| TermiX AACP jobs           | `https://docs.termix.ai/aacp/jobs.md`                         | Full job lifecycle: create → fund → execute → evaluate; USDC escrow; job_id                               |
| TermiX AACP network        | `https://docs.termix.ai/aacp/network.md`                      | **Chain 97**, explicit RPC + Explorer + contract addresses (`ACPCore` etc.) + `GET /api/v1/config`        |
| TermiX AACP quickstart     | `https://docs.termix.ai/aacp/quickstart.md`                   | First payment call + funded job in <5 min                                                                 |
| TermiX AACP authentication | `https://docs.termix.ai/aacp/authentication.md`               | API key + EIP-191 + on-chain wallet auth                                                                  |
| TermiX reputation          | `https://docs.termix.ai/product/reputation.md`                | 0–100 score, 5-factor composite, staking coefficient, anomaly flags — the real "agent advantage" signal   |
| PancakeSwap developer      | `https://academy.pancakeswap.finance` / swap & liquidity docs | Swaps (UniversalRouter-style), liquidity (Pair/NFT positions)                                             |

---

## 3. Repo Inspection (what actually exists today)

| Path                                             | State                                     |
| ------------------------------------------------ | ----------------------------------------- |
| `packages/integrations/src/termix/index.ts`      | interface-only placeholder stub           |
| `packages/integrations/src/pancakeswap/index.ts` | interface-only placeholder stub           |
| `.env` / `.env.local` / `.env.testnet`           | **none present**                          |
| `packages/config/src/env.ts`                     | only `8004SCAN_API_KEY` declared optional |
| `apps/web/lib/eight004scan/*`                    | server-only key reader (correct)          |

---

## 4. TermiX — What It Actually Is Now

`docs/TIS.md` (the project's prior source record) and the earlier §5 of the gap analysis treated TermiX as `TermiX-official/bsc-mcp` — a **community MCP tool server for on-chain transfers/swaps**. That is the _MCP tool server_ flavor. **TermiX today also documents the Autonomous Agent Capital Protocol (AACP)** — a first-party ERC-8004 **agent-hires-agent marketplace** on BSC Testnet:

- **Network:** BSC Testnet, chain 97 — the _exact same chain_ the ALTANA x402 X.4A harness targets.
- **Contracts (on-chain):** `ACPCore` (`0x4e07f9C438ba784653b39eB9aE39b1eFF470b6c9`), `TermiXStaking`, `TermiXReputation`, `MockUSDC`, `MockAgentNFT` — all UUPS proxies on 97.
- **Backend REST API:** `https://termix-backend.dev.termix.click/api/v1/...` — full Jobs/Reputation/Agents/Config/Events surface.
- **Auth:** API key + EIP-191 wallet signature + on-chain wallet auth.
- **Job lifecycle (per `jobs.md`):** Client creates & funds → Provider accepts & executes → Evaluator scores deliverable → settlement/refund via `ACPCore.dispute`/`claim`; **USDC escrow** held in the core contract.
- **Reputation (per `product/reputation.md`):** per-agent 0–100 on-chain score = the canonical "agent advantage" signal (completion-rate 30%, on-time 20%, eval-pass 25%, dispute-win 15%, verification-level 10%); `reputationCoefficient = min(1, score/100)` drives stake requirement. Anomaly flags for biased evaluators.
- **MCP & SDK:** both listed as "coming soon" — the _programmatic_ integration story is the REST API + contracts.

> **Conclusion on the "Advantage Report":** there is no endpoint literally named "Agent Advantage Report." The comparable, authoritative artifact is the **Reputation API** (`docs/api-reference/reputation.md`) — a read-only per-agent advantage score. The PRD's intent (compare/ex plain agent quality) maps onto AACP reputation + the repo's own marketplace snapshots.

---

## 5. TermiX vs. ALTANA — Mapping Matrix (A–F)

| #   | AACP surface                                        | ALTANA surface                                                       | Relationship                                                                                                                                     |
| --- | --------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Job lifecycle (create/fund/execute/evaluate/settle) | ERC-8183 job/escrow adapter (`erc8183.ts`)                           | **Direct parallel** — both are agent-marketplace job rails on chain 97; shared session/ERC-1271 signing layer                                    |
| B   | Reputation score (0–100, 5-factor composite)        | 8004scan identity (ERC-8004 registry) + marketplace snapshot scoring | **Complementary** — 8004scan = identity membership; AACP reputation = quality/scope score; together = richer "agent advantage" than either alone |
| C   | USDC escrow / stake pool                            | x402 per-call payment                                                | **Complementary** — x402 = per-call micropayment; AACP = job-level escrow                                                                        |
| D   | Provider/Evaluator/Arbitrator roles                 | Altana certified skills (Executor roles)                             | **Overlapping concept, different gate** — AACP is a _protocol_; Altana skills are _certified capability metadata_                                |
| E   | Network: BSC Testnet 97                             | x402 X.4A testnet harness (97)                                       | **Identical network** — both converge on chain 97                                                                                                |
| F   | REST `/jobs`, `/reputation` (read)                  | read-only marketplace adapter stubs                                  | **Non-conflicting** — both are read adapters; no signing needed for reputation queries                                                           |

---

## 6. TermiX Integration Options vs. Risk

| Option                                  | What                                                                                                                                              | Value                                                                   | Complexity                                  | Signing?                                                                         | Risk                         | Recommended?                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Opt-0. Skip**                         | leave `termix/index.ts` stub                                                                                                                      | 0                                                                       | 0                                           | none                                                                             | 0                            | baseline (prior gap analysis default)                                   |
| **Opt-1. Read-only reputation adapter** | fetch `/api/v1/config` + `/agents/{id}/reputation`; cache to marketplace snapshots; render a "TermiX reputation" field as an extra quality signal | Medium-High (real "agent advantage" comparison data the PRD references) | Low-Med (REST + 1 API key or wallet sig)    | **No** (queries are public; no wallet signing for reads per `authentication.md`) | Low (read-only)              | **YES — strongest minimal win**                                         |
| **Opt-2. AACP job client**              | submit jobs via `ACPCore` (fund/execute/settle) — i.e. mirror `erc8183.ts` but against TermiX                                                     | High (cross-marketplace job sourcing)                                   | High (funding tx + escrow + evaluator flow) | **Yes** (wallet signing + funding)                                               | Medium-High (custody/escrow) | N/A for QA freeze — separate sprint _after_ ERC-8183 job rail is proven |

**Security note (per §3.2 constraint discipline):** Opt-1 is **read-only** with no wallet signing — it does **not** reintroduce the "execution path signing risk" that justified the prior SKIP. The prior §5 risk argument ("would require wallet/signing authority to do anything meaningful") applies to **Opt-2**, not to Opt-1. This is the correction.

---

## 7. Decision: TermiX

1. The prior "DO NOT integrate TermiX" conclusion is **revised**:
   - For **read-only reputation data** (the real "agent advantage" signal): **INTEGRATE as a read-only adapter** (Opt-1) — it is low-risk (no signing), adds a genuine quality signal the PRD references, and runs on the _same chain 97_ the x402/ERC-8183 work already targets.
   - For **job execution** (Opt-2): **DEFER** to a post-ERC-8183 sprint — it is a _separate wallet/funding_ surface and is not required for QA or the main submission.
2. **Not pre-QA code** — Opt-1 is post-QA polish, explicitly **not required** to reach Final QA (per §13 recommendation cadence). The existing stub remains; no `termix` code is added during the QA pass.

**Net:** TermiX is **not** "unnecessary and partially redundant" for the reputation read path. The earlier assessment mis-scoped it as an _execution_ concern and missed the read-only reputation surface. The stub is retained during QA; Opt-1 is a candidate **post-submission** read-only enhancement.

---

## 8. PancakeSwap — Assessment

PancakeSwap was represented only via Altana certified-skills metadata (`pancakeswap-trading`, `pancakeswap-liquidity`) in `altana/skills.ts`. This remains correct:

- **Trading (swap) surface:** Altana wallet `okx-dex-swap` + certified skills already cover swap execution; a separate `pancakeswap` execution adapter would **duplicate** and re-add transaction-signing risk.
- **Liquidity / pool data (read):** a _read-only_ PancakeSwap pools/APR subgraph adapter is the same shape as the corrected TermiX Opt-1 — low-risk, optional, **deferrable to post-submission**. Not a `pancakeswap` execution stub rewrite.
- **Hackathon track:** PancakeSwap tracks reward _swaps/ Liquidity via their SDK_; Altana's _skills metadata_ approach is a weaker claim. If the official PancakeSwap hackathon criteria explicitly require the SDK, that is a **post-QA decision point** — not a QA blocker. I found **no published PancakeSwap hackathon criteria text** in the fetched sources; the repo's `PRD.md`/`docs/TIS.md` should be re-checked at that decision point.

**Decision: PancakeSwap** — **SKIP execution SDK now** (duplicates skills + signing risk); keep the interface stub. A **read-only pools/APR adapter** is the same optional post-submission, post-QA, low-risk enhancement as TermiX Opt-1. No change to the prior §6 conclusion.

---

## 9. BNB Agent Studio — No Change

The prior §7 verdict ("brand, not documented API; covered by 8004scan + Altana") stands. No authoritative API surface was surfaced in today's fetch. SKIP.

---

## 10. Mapping To The QA Gate

| Gate                                                     | Impact of this doc                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint / Typecheck / Build / 7 runners (`altana:…:verify`) | **None** — no code added; stub unchanged                                                                                                              |
| Security scan                                            | **None** — read-only adapters are deferred, not added                                                                                                 |
| TermiX/PancakeSwap tracks                                | Track credit for 8004scan + Altana already earned by existing work; TermiX read-only reputation is an _optional enhancement_, not a track requirement |

**Bottom line:** the Final-QA sequence in `Final-Integration-Gap-Analysis.md` §15 is **unchanged** — this doc only amends the TermiX characterization in §5 and adds two _optional, read-only_ post-submission enhancements (TermiX reputation read, PancakeSwap pools read) instead of the prior "SKIP entirely" for TermiX reads.

---

## 11. Recommended Post-Submission Enhancement Backlog

1. **TermiX Reputation read adapter** (`packages/integrations/src/termix/reputation.ts`) — fetch `/api/v1/config`, query `/agents/{id}/reputation`, map to an extra marketplace snapshot quality field. Read-only, no signing, chain 97.
2. **PancakeSwap pools/APR read adapter** (`packages/integrations/src/pancakeswap/pools.ts`) — read-only subgraph/REST pools data behind the existing stub.
3. **Cross-signal:** if both TermiX reputation + Altana skills are read in, the comparison page can surface a composite "agent advantage" score (reputation × skill-certainty × snapshot PnL). This is the constructive fulfillment of the PRD's "Advantage Report" intent — computed, not fetched.

---

## 12. Final Correction Matrix (vs. prior §5 §6)

| Prior conclusion                                    | Correction                                                                       | Basis                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| "TermiX = bsc-mcp tool server; no Advantage Report" | "TermiX now documents AACP on chain 97; reputation = the Advantage signal"       | `docs.termix.ai/aacp/*` + `product/reputation.md`   |
| "Integrating TermiX adds signing/execution risk"    | "Read-only reputation adds NO signing risk; only job execution would"            | `authentication.md` (reads are public/API-key)      |
| "DO NOT integrate TermiX"                           | "Skip execution now; integrate read-only reputation as optional post-submission" | Risk is read-vs-exec scoped                         |
| "PancakeSwap = duplicate skills"                    | Unchanged                                                                        | Skills metadata already cover the execution surface |

---

## 13. Status

**ALTANA X4A STATUS: READY FOR FINAL QA (unchanged).**
**TermiX/PancakeSwap STATUS: read-only reputation & pools are OPTIONAL post-submission low-risk enhancements; execution integrations are OUT.**

No code, env, or package changes were made by this doc. The interface-only stubs at `packages/integrations/src/termix/index.ts` and `packages/integrations/src/pancakeswap/index.ts` remain unchanged.
