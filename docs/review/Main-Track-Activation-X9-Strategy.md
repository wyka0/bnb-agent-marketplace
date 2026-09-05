# Main Track Activation X.9: Final Activatable-Agent Strategy

**Date:** 2026-08-12
**Mode:** STRATEGY / ARCHITECTURE CHECKPOINT — no code, no probe, no deployment
**Scope:** X.5 → X.8 evidence synthesis and path decision
**Hard constraints honored:** no signing, no x402 payment, no broadcast, no settlement, no mainnet tx, no Git, no fabricated agent/data.

---

## 0. Proven facts from X.5–X.8

| Probe                          | Result                                                                                                                                                                       | Consequence                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| X.5 real-agent capability scan | 5 real agents are BSC mainnet 56; none expose an actionable endpoint; 8004scan carries no capability metadata                                                                | No real BSC action source                            |
| X.6 hire endpoint build        | `hire.verify.ts` **23/23** green; pipeline accepts a real capability via `resolveAgentActivationCapability`; REAL ACTION = BLOCKED because no real agent supplies capability | Pipeline complete, waiting on a real source          |
| X.7 agent discovery            | 15 candidate groups checked; **ACTIVATABLE AGENT: NOT FOUND**; 4 chain-97 agents are health-only (`live:false`, `operatorAddress:null`); Aave is chain-56 only               | No chain-97 activatable agent; no real action source |
| X.8 Aave action-shape probe    | BLOCKED before `tools/call`; 9 Aave tools are state-changing; no `readOnlyHint`/`dryRun`/`preview`/`buildOnly`; output = "transactions to sign and broadcast"                | Aave cannot yield a safe unsigned action shape       |

**Net:** The "find" and "understand" legs of the main-track requirement are fully demonstrable (discovery, capability resolution, consent pipeline). The "activate with a real, non-fabricated agent" leg has **no external source** that satisfies the constraints.

---

## 1. Path decision tree

### PATH A — Integrate a real existing activatable BSC agent

- **Exact dependency:** A live BSC agent (chain 56 or 97) exposing a non-mutating action/quote endpoint or a real ERC-8183 job capability, with verifiable capability metadata.
- **Implementation effort:** Low (wire into `resolveAgentActivationCapability`), _if_ such an agent existed.
- **Satisfies main-track activation:** Yes — would be ideal.
- **Testnet/mainnet:** Either; chain-97 preferred for safety.
- **Real pricing/action data exists:** Not found.
- **Remaining blocker:** **No such agent was found in X.5–X.8.** All real BSC agents are either chain-56 mainnet with no actionable endpoint (X.5), or chain-97 health-only stubs (X.7). Aave (X.8) is chain-56 and execution-only.
- **Verdict:** ❌ RULED OUT by evidence.

### PATH B — Integrate a legitimate chain-97 seller

- **Exact dependency:** A deployed chain-97 ERC-8183 seller with public capability/pricing metadata and a working action endpoint.
- **Implementation effort:** Low integration, _if_ a live seller existed.
- **Satisfies main-track activation:** Yes.
- **Testnet/mainnet:** Testnet (97) — safest.
- **Real pricing/action data exists:** Not found.
- **Remaining blocker:** The 4 chain-97 agents (LiqShield/YieldRoute/GridPilot/RangeGuard) are `live:false`, `operatorAddress:null`, no capability fields (X.7). No other chain-97 seller was discovered.
- **Verdict:** ❌ RULED OUT by evidence.

### PATH C — Project provides its own legitimate seller/agent deployment

- **Exact dependency:** Deploy a legitimate chain-97 ERC-8183 seller (or a BNB Agent Studio seller) that exposes **real** capability metadata (token, amount, payTo, destination, calldata, pricing) and a non-fabricated action. Wire it into `resolveAgentActivationCapability` and run a live activation review + consent. Signing/broadcast remain explicitly out of scope per current design.
- **Implementation effort:** Medium. The pipeline already exists (X.6); required work = (1) build/deploy a real chain-97 seller contract or BNB Agent Studio seller, (2) publish real capability metadata (no fabricated pricing), (3) register it as the verified capability source, (4) run end-to-end activation review + consent with a real user.
- **Satisfies main-track activation:** Yes — only viable path.
- **Testnet/mainnet:** Testnet 97 (no mainnet funds, no real value at risk).
- **Real pricing/action data exists:** Will exist post-deployment, sourced from the deployed seller's own metadata — not fabricated.
- **Remaining blocker:** Deployment not yet executed; requires explicit next-milestone approval per the gating rule. No code written in X.9.
- **Verdict:** ✅ VIABLE — recommended path.

### PATH D — No viable activation path exists before submission

- **Exact dependency:** None (terminal).
- **Implementation effort:** N/A.
- **Satisfies main-track activation:** No.
- **Remaining blocker:** Would only be true if PATH C is also rejected.
- **Verdict:** ❌ Not chosen — PATH C is viable, so submission is not forced to "no path."

---

## 2. Chosen decision

**BEST PATH: C**

Rationale:

- PATH A and PATH B are conclusively eliminated by X.5–X.8.
- The project's activation pipeline (X.6) is already complete and verified; the single missing piece is a **real** capability source.
- PATH C reuses the existing `resolveAgentActivationCapability` extension point and the verified ERC-8183 infrastructure already present in the repo (X.6 report: `prepareErc8183Hire`, `getErc8183Addresses`, verified chain-97 addresses). No architectural rework is needed — only a legitimate seller deployment + metadata wiring.
- It keeps the "find → understand → activate" requirement honest: discovery and understanding are already proven; activation is completed with a real, non-fabricated seller we legitimately operate.

**This is a strategy checkpoint. No seller is deployed in X.9.**

---

## 3. X.9 STATUS

```text
X.9 STATUS:
BEST PATH: C
REAL ACTIVATABLE AGENT: NOT FOUND
REAL ACTION SOURCE: NOT FOUND
MAIN-TRACK ACTIVATION: BLOCKED (pending PATH C milestone)
RECOMMENDED NEXT MILESTONE: Deploy a legitimate chain-97 ERC-8183 seller
  exposing real capability metadata; wire it into
  resolveAgentActivationCapability; run live activation review + consent
  (signing/broadcast explicitly out of scope).

EXACT BLOCKER:
No external BSC agent currently exposes a chain-97-compatible, real,
non-fabricated activation action; the X.6 pipeline is complete and ready,
so the only honest completion is to provide our own legitimate seller
deployment as an explicitly approved next milestone.
```

---

## 4. Guardrails carried into the next milestone

- No fabricated pricing, calldata, action parameters, or agent capabilities.
- No x402 payment, no signing, no broadcast, no settlement, no mainnet transaction.
- The deployed seller must publish real metadata; if real pricing/action cannot be sourced, stop and re-classify as BLOCKED — do not invent values to satisfy the UI.
- Consent (`X.4C` fields: chain, token, amount, payTo, destination, calldata) must be independently verified against the deployed seller's real metadata before any activation is marked "possible."
- No Git/deploy action taken in X.9.
