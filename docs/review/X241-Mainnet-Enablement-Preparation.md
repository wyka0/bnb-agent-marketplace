# X.241 — Mainnet Enablement Preparation

Date: 2026-09-05 — CODE/PREFLIGHT only. `MAINNET_HIRE_ENABLED` remains
**false** throughout. Zero transactions, zero signatures, zero Mainnet
writes, zero jobs, zero approvals, zero $U transfers, zero wallet prompts.

## 1. Executive verdict

**COMPLETE.** The chain-97 hard pin in the hire API layer was replaced with
chain-aware resolution (agent identity determines the chain; chain 56 only
behind `MAINNET_HIRE_ENABLED`; all four existing gates preserved; ambiguous
resolution fails closed). A read-only Mainnet preflight harness was added
(24 checks, all PASS) and seven new chain-resolution regression tests
(A–G + sub-cases) were added, all passing. The full test matrix (testnet
regression included) remains green. Mainnet hiring is STILL DISABLED.

## 2. Chain-97 hard-pin location (removed)

`apps/web/lib/activation/main-track-hire.api.ts` L156–169 (X.131):
`if (agent.chain_id !== 97) → 409 unsupported-chain "BSC Testnet (chain 97)
only"`. This was the last preparation-layer pin; the deeper layers
(`prepareLiveAgentHire`, `prepareMainTrackUserHire`, `buildMainTrackUserHireCalls`)
were already chain-aware since X.234 (`resolveHireChainConfig(chainId)`).

## 3. Chain-aware resolution (new behavior)

Replaced with (same file, ~L156):

1. `chainIdFromAgentId(agent.agent_id)` → the agent's OWN identity determines
   the chain (56 or 97). `null` (unparseable) → 409 fail-closed.
2. Cross-check: the resolved identity chain must equal the indexer record's
   `chain_id` — mismatch (e.g. chain-56 record carrying a chain-97 identity)
   → 409 `unsupported-chain`. **No silent 56↔97 fallback in either direction.**
3. `resolveHireChainConfig(hireChain)` — the single authoritative resolver
   (reused; no address duplication; throws for non-56/97).
4. Registry pin: the agent record's registry must equal the chain config's
   verified registry → else 409 `registry-mismatch`.
5. Chain 56 **and** `MAINNET_HIRE_ENABLED !== literal "true"` → 409
   `mainnet-hire-disabled` with the truthful "coming soon" message.
6. Unknown chain → 409 `unsupported-chain`.

The flag reads from the API's `input.env` (already wired from
`route.ts` L45 `env: process.env`) — server-side only, no client bypass.

## 4. Mainnet preflight — **PASS (24/24)**

New harness `apps/web/lib/activation/mainnet-hire-preflight.verify.ts`
(READ-ONLY; public RPC + live seller; no writes). Verifies live: chain 56,
`ownerOf(334760)` = `0xB0f768…7c0`, `tokenURI` name/endpoint/capabilities,
seller `/health` (status/chain/owner/agentId/`hire: disabled`), and the
complete verified contract table (Commerce/Router/Policy/Registry/$U — no
invented addresses). Plus offline P7 signature-binding checks (below).

## 5. $U readiness — **BLOCKED — INSUFFICIENT BUYER $U (reported, no action)**

- Configured hire price: 1 $U (`MAINNET_SERVICE_PRICE` default 1e18 wei).
- Buyer-side: marketplace buyers use their own wallets (`window.ethereum`);
  the only currently known Mainnet wallet (owner `0xB0f768…7c0`) holds
  **0 $U** on chain 56 and 0.000427122484102691 BNB.
- Verdict: **BLOCKED — INSUFFICIENT BUYER $U**. No transfers, no approvals,
  no fund acquisition attempted (preflight is report-only).

## 6. Five-transaction plan (preserved exactly from X.240; NOT executed)

Signer: the BUYER's wallet (user-controlled; marketplace never signs).
All `value: 0`, chainId 56, per-step receipt confirmation required before the
next; any failure/rejection/timeout hard-stops the flow (no rebroadcast).

| #   | Function                                                       | Contract                       | Key args                                                                                                                                                                          | Receipt                                                                |
| --- | -------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `createJob(provider, evaluator, expiredAt, description, hook)` | Mainnet Commerce `0xEa4D…EBA6` | provider=verified seller signer, evaluator=Mainnet Router, expiry=quote `quote_expires_at`, description=SDK `buildJobDescription` (embeds signed terms+provider sig), hook=Router | required before #2                                                     |
| 2   | `registerJob(jobId, policy)`                                   | Mainnet Router `0x5189…D6DA`   | jobId=`jobCounter()+1` (read at prepare), policy=Mainnet Policy `0x9C01…6dE5` (plan asserts this in calldata decode)                                                              | required before #3                                                     |
| 3   | `setBudget(jobId, amount, optParams)`                          | Mainnet Commerce               | amount=quoted $U budget                                                                                                                                                           | required before #4                                                     |
| 4   | `approve(spender, amount)`                                     | Mainnet $U `0xcE24…6666`       | spender=Mainnet Commerce, amount=exact budget (ERC-20)                                                                                                                            | required before #5                                                     |
| 5   | `fund(jobId, expectedBudget, optParams)`                       | Mainnet Commerce               | budget transfer of $U into escrow                                                                                                                                                 | final; verified by `verifyMainTrackUserHireFunded` (on-chain job read) |

Calldata construction: `buildMainTrackUserHireCalls`
(`packages/integrations/src/altana/v2/main-track-user-wallet.ts` L177–249)
via `resolveHireChainConfig` — chain-aware, allowlist-enforced
(`cfg`-derived; mainnet plan targets only mainnet addresses).

## 7. Quote + signature validation — **PASS (fail-closed, cross-chain)**

The Mainnet preparation path (`prepareLiveAgentHire` →
`defaultVerifyQuote` → SDK `verifyQuoteSignature`) already binds: chainId 56
(quote chain must equal agent identity chain), Mainnet Commerce
(`expectedVerifyingContract`), owner (recovered signer == registry owner ==
`0xB0f768…7c0`), quote expiry (vs block time), negotiation hash (recomputed
keccak over canonical signed content), and the job description embeds the
signed terms (post-agreement tamper impossible). Verified offline:

- Testnet envelope (chain 97 + testnet Commerce) CANNOT bind to a Mainnet
  agent (chain mismatch + commerce mismatch) — rejected before crypto.
- Mainnet envelope CANNOT validate against the Testnet config (symmetric).
- New API-layer registry pin adds: foreign-registry mainnet agents are
  rejected before preparation (`registry-mismatch`).

## 8. UI behavior — **PASS (unchanged, truthful)**

While the flag is false, chain-56 agents keep the existing truthful card
(`agent-detail-view.tsx` L660–687: "Mainnet hiring coming soon… no wallet
interaction, negotiation, or transaction is available for Mainnet agents",
disabled button). No UI change needed; the conditional enabled state is the
API-layer code prepared in this milestone (flag-gated, still off).

## 9. Safety gates — **ALL PRESERVED**

1. UI activation gate (chain-56 card can never reach signing) — unchanged.
2. API gate — now chain-aware + flag-gated (L156 area) — the only change, strictly widening nothing while flag false: a chain-56 agent previously hit `unsupported-chain`, now hits `mainnet-hire-disabled` (equally blocked, more truthful code).
3. `prepareLiveAgentHire` gate (L435–441) — unchanged (X.234G test still passes).
4. `prepareMainTrackUserHire` gate (L221–227) — unchanged (X.241E tests it).
5. `MAINNET_HIRE_ENABLED` — remains the final production gate, literal `"true"`
   only (X.241E2: "1"/"yes" stay blocked). Server-side env; no client bypass.

## 10. Testnet regression — **PASS**

- All suites green including the full chain-97 hire path (X.241B/D/F:
  testnet Agent 1906 identity proceeds regardless of flag state).
- Live: `https://…ts.net/health` → 200 chain 97; real negotiate → 200
  `accepted:true` chain 97 (no job created).
- Agent 1906: UNCHANGED · Agent 2005: UNTOUCHED · Job 787: UNTOUCHED.
- No Testnet behavior regressed (63/63 selector suite; 24/24 hire endpoint;
  14/14 hire API; X.149 suite incl. all X.224–X.234 testnet tests).

## 11. Security checks — **PASS**

- Mainnet cannot use Testnet contract config (per-chain tables disjoint;
  resolver throws on mismatch; allowlist built from `cfg`; X.241G asserts
  commerce/registry/$U inequality).
- Testnet cannot use Mainnet config (symmetric).
- Mainnet agent cannot be Agent 1906 (exact full-identity match; 1906 is
  `97:…` — different chain prefix entirely; X.65 PASS 1/1b).
- Testnet cannot accidentally use agent 334760 (chain-97 record with a
  chain-56 identity → identity/record mismatch → fail closed, X.241C2).
- No private keys in browser code (execution is user-wallet
  `eth_sendTransaction`; check 15 no-private-key scans pass).
- No secrets logged (no new logging; password env-only); `.env.example`
  values-free; nothing committed this milestone.
- No chain fallback (resolver throws; identity/record cross-check).
- No feature-flag bypass (flag is server-env; UI/API gates fail closed;
  X.241C/E/E2 prove the blocked paths).

## 12. Tests — **ALL PASS**

| Suite                                                              | Result                 |
| ------------------------------------------------------------------ | ---------------------- |
| main-track-user-hire.verify (incl. new X.241A–G, X.241C2/C3/E2/G2) | ALL PASS               |
| mainnet-hire-preflight.verify (NEW)                                | 24/24                  |
| hire.verify (X.6)                                                  | 24/24                  |
| hire.api.verify (X.65)                                             | 14/14                  |
| main-track-v2.server.verify (X.131)                                | ALL PASS               |
| x80 / x81 / x84 / x85                                              | ALL PASS               |
| activation.verify (P12)                                            | 33/33                  |
| p13-review / capability-source                                     | ALL PASS               |
| network-selector (X.216)                                           | 63/63                  |
| seller-runtime / readiness / provisioning                          | 35/36/52 — all PASS    |
| typecheck / lint / build                                           | PASS (turbo all tasks) |
| prettier (changed files)                                           | PASS                   |
| git diff --check                                                   | CLEAN                  |

New regression tests: A (mainnet→56, flag on), B (testnet→97), C (mainnet
blocked flag off + truthful message), C2 (no 56↔97 fallback), C3 (unknown
chain fails), D (testnet unaffected by flag), E (flag=false final gate),
E2 (literal "true" only), F (1906 proceeds), G (cross-chain signature
mismatch), G2 (foreign registry rejected).

## 13. Files changed (all uncommitted; no commit/push)

- `apps/web/lib/activation/main-track-hire.api.ts` — chain-aware gate
  replacing the chain-97 hard pin (the milestone's core change).
- `apps/web/lib/activation/main-track-user-hire.verify.ts` — X.241 A–G
  regression tests appended.
- `apps/web/lib/activation/mainnet-hire-preflight.verify.ts` — NEW read-only
  preflight harness.
- `packages/integrations/src/altana/hire-chains.ts` — prettier-only
  formatting (X.240 leftover, zero behavior change).
- This report.

## 14. Remaining blockers (for a real Mainnet hire — X.242+)

1. `MAINNET_HIRE_ENABLED=true` on the WEB app (user decision) — still false.
2. Mainnet SELLER's own `MAINNET_HIRE_ENABLED=true` + process restart (its
   `/negotiate` still returns the truthful disabled response) — user decision.
3. **Buyer $U on chain 56** — BLOCKED — INSUFFICIENT BUYER $U (owner wallet
   has 0 $U; buyers need ≥ 1 $U + BNB gas).
4. 8004scan indexing of agent 334760 (UI discovery; indexer lag at X.240,
   likely resolved by now — recheck in X.242).
5. Deployment of this code (commit + push + Vercel) — requires explicit user
   authorization (HARD STOP maintained).

## 15. Exact requirements for X.242 (Mainnet activation)

1. User authorizes commit + push + deploy of the X.241 changes.
2. User sets `MAINNET_HIRE_ENABLED=true` in the web deployment environment
   (Vercel env var).
3. User authorizes enabling the Mainnet seller's flag
   (`MAINNET_HIRE_ENABLED=true` env) and a seller restart (port 3001).
4. Buyer wallet funded with Mainnet $U (≥ 1 $U default quote) and BNB gas.
5. Verify 8004scan has indexed agent 334760 (agent page renders).
6. Re-run this milestone's preflight harness (expect all-PASS incl. $U).
7. Then — and only then — a first real Mainnet hire can be attempted with
   explicit per-transaction user authorization (X.240's 5-tx sequence).

## Mandatory ledger

| Item                                       | Count                             |
| ------------------------------------------ | --------------------------------- |
| Transactions / Signatures / Mainnet writes | 0 / 0 / 0                         |
| Jobs / Approvals / $U transfers            | 0 / 0 / 0                         |
| Wallet prompts / Real hires                | 0 / 0                             |
| MAINNET_HIRE_ENABLED                       | **false** (unchanged)             |
| Agent 1906 / Agent 2005 / Job 787          | UNCHANGED / UNTOUCHED / UNTOUCHED |
| Commit / Push                              | 0 / 0                             |

**STOP — Mainnet hiring still disabled. No commit, no push.**
