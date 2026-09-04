# X.240 — Mainnet Hire Readiness / Dry Run

Date: 2026-09-05 — DRY-RUN / READ-ONLY milestone. Mainnet hiring STILL
DISABLED at end of milestone. Zero transactions, zero signatures, zero
Mainnet writes, zero ERC-8183 jobs, zero $U approvals/transfers, zero wallet
prompts.

## 1. Executive verdict

**PASS (dry-run readiness confirmed; two non-code blockers remain before a
real Mainnet hire can run).** The complete buyer → discovery → negotiation →
quote-validation → signature-validation → ERC-8183 preparation path is
implemented, chain-aware, verified against the live Mainnet agent 334760,
and fails closed at four independent layers while `MAINNET_HIRE_ENABLED=false`.
The exact would-be write sequence (5 buyer-signed transactions) is traced.
Cross-chain signature substitution is cryptographically impossible in the
marketplace verifier. Blockers for a future real hire: (a) both Mainnet
gates must be user-enabled (server flag + seller flag), (b) the 8004scan
indexer must index token 334760 so the marketplace UI can resolve the agent
(currently ~6 tokens of indexer lag — registration is ~1 h old), (c) a buyer
wallet needs Mainnet $U + BNB.

## 2. Buyer → seller flow trace — **PASS**

Full production path (read-only code trace, no changes):

1. **Agent page** `apps/web/app/(app)/agents/[slug]/page.tsx` L23–28 resolves the agent from the 8004scan registry record.
2. **Hire card** `agent-detail-view.tsx` L657–725: chain-97 + owner → `<MainTrackHireView>`; **chain-56 → disabled "Mainnet hiring coming soon" card** (L660–687, comment: "can NEVER reach signing"); other → activation review panel.
3. **Hire view** `main-track-hire-view.tsx`: auth gate (`/api/auth/me`), `POST /api/activation/main-track-hire {action:"prepare"}` (L119–123), review state, confirm → **client-side execution** `runMainTrackUserHireFromWallet` with `window.ethereum` (L190–210); per-step `POST {action:"receipt"}` polling (L173–187); final `POST {action:"verify"}` (L227–237).
4. **API route** `route.ts` + `main-track-hire.api.ts`: auth + CSRF + rate limit; **hard chain gate L156–169: `agent.chain_id !== 97` → 409 unsupported-chain** (a Mainnet block INDEPENDENT of the feature flag).
5. **Negotiation server** `main-track-negotiation.server.ts` `prepareLiveAgentHire` L402–489: registry validation of the agent ID (chain/registry/tokenId + `tokenURI` read), `POST {endpoint}/negotiate`, SDK quote-signature verification (chain + commerce + signer==owner), `buildJobDescription`, `jobCounter()+1`, **MAINNET gate L435–441**.
6. **Hire plan** `main-track-user-hire.ts` `prepareMainTrackUserHire` L194–329: validates quote (chain resolvable, commerce binding, price/currency, official $U, non-expired, signer shape, job-id history) → 5-call plan; **MAINNET gate L221–227**; chain-aware allowlist (L271–278) + 5-call shape + registerJob policy decode (L283–287).
7. **Execution** `runMainTrackUserHireFromWallet` L345–526: wallet connect, wrong-chain switch UX, per-call `eth_sendTransaction` → receipt verify → next call; hard stop on failure.
8. **Final verification** `verifyMainTrackUserHireFunded` (`main-track-user-hire.server.ts` L84–205): on-chain job read — status FUNDED, client==buyer, provider==registered owner, budget, no deliverable.

## 3. Chain-56 resolution — **PASS**

Exercised the SHIPPED seam (`packages/integrations/dist/altana/hire-chains.js`):

- `resolveHireChainConfig(56)` → commerce `0xEa4D…EBA6`, router `0x5189…D6DA`, policy `0x9C01…6dE5`, registry `0x8004…a432`, $U `0xcE24…6666` — **all match the verified table** (no invented addresses).
- `chainIdFromAgentId("56:0x8004…:334760")` → **56** — PASS.
- `isMainnetHireEnabled({})` → **false** — PASS (literal `"true"` only).
- No fallback: `resolveHireChainConfig` throws for unknown chains; the verifier requires quote chain == agent identity chain; the API layer additionally hard-pins chain 97 today. A chain-56 flow can never silently resolve to chain-97 config.

## 4. Agent 334760 verification — **PASS**

- `ownerOf(334760)` → `0xB0f768…7c0` — PASS
- `tokenURI(334760)` → decodes to `BNB Agent Studio Mainnet Seller`, endpoint `https://inbook-y1-plus.tail3e3640.ts.net:8443`, capabilities `["erc8183-negotiate"]` — PASS
- Registration tx `0x59edb714…cdbd2` (X.238) — not re-sent, confirmed on-chain.

## 5. Seller endpoint verification — **PASS**

- `GET :8443/health` → 200, `chain:56`, owner `0xB0f768…7c0`, `agentId: 56:0x8004…:334760`, `hire: disabled` — all PASS.

## 6. Negotiation dry-run — **PASS (gate fires correctly; no bypass)**

- **Production pipeline** (real `prepareLiveAgentHire`, flag=false): `{ok:false, reason:"Mainnet hiring is unavailable (coming soon). Commercial hire is currently BSC Testnet (chain 97) only."}` — **fails closed BEFORE any network negotiation**.
- **Direct real `/negotiate`** (no gate bypass): HTTP 200, `accepted:false`, chain_id 56, verifying contract Mainnet Commerce `0xEa4D…EBA6`, `provider_sig: null` (seller signs nothing while its own `MAINNET_HIRE_ENABLED=false`) — the truthful disabled response, correct for a dry-run with zero signatures.
- No job created, no transaction, nothing signed. The production gate was NOT altered.

## 7. Provider signature verification — **PASS (offline/deterministic)**

- The marketplace binds every quote: `chain_id` (vs agent identity chain), `verifying_contract` (vs chain cfg Commerce), EIP-191 recovery of `provider_sig` over `negotiation_hash` (recomputed from canonical signed content), signer == registered owner, plus expiry. (`main-track-negotiation.server.ts` L343–394, L462–468; SDK `verifyQuoteSignature`.)
- **Cross-chain substitution impossible**: a genuine chain-97 testnet envelope (real X.237 quote, signer recovers to `0xB0f768…7c0` — same seller key) CANNOT pass Mainnet verification: chain 97 ≠ 56 and testnet Commerce ≠ `0xEa4D…` — rejected before crypto. Symmetrically a chain-56 envelope cannot pass the chain-97 config. Verified by envelope-vs-config analysis + the verifier's own checks (chain mismatch at identity level, commerce mismatch at `expectedVerifyingContract`).
- No real signature was produced by the live seller in this milestone (seller disabled path signs nothing).
- Job/expiry binding: quote `quote_expires_at` checked against block time; `negotiation_hash` covers terms; job description embeds the agreed terms + provider signature (SDK `buildJobDescription`), preventing post-agreement tampering.

## 8. Exact ERC-8183 write sequence that WOULD occur — **PASS (traced, not executed)**

If (and only if) both Mainnet gates are enabled and a buyer confirms, the
buyer wallet signs **5 separate standard transactions** (fixed sequence,
`main-track-user-wallet.ts` L200–246, all `value: 0`, chainId 56):

1. `createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook)` → **Mainnet Commerce** `0xEa4D…` — args: (verified signer/owner, **Mainnet Router** as evaluator, quote expiry, SDK job description embedding the signed terms, Mainnet Router hook)
2. `registerJob(uint256 jobId, address policy)` → **Mainnet Router** `0x5189…` — args: (jobCounter+1, **Mainnet Policy** `0x9C01…`)
3. `setBudget(uint256 jobId, uint256 amount, bytes)` → **Mainnet Commerce** — args: (jobId, quoted $U budget, `0x`)
4. **`approve(address spender, uint256 amount)` → Mainnet $U `0xcE24…`** — args: (Mainnet Commerce, exact budget) — ERC-20 approval
5. `fund(uint256 jobId, uint256 expectedBudget, bytes)` → **Mainnet Commerce** — args: (jobId, budget, `0x`)

**Answer: C — ERC-20 approval + job creation (as part of a fixed 5-transaction sequence).** Not permit/meta-tx (`usePaymaster:false`, no EIP-2612); not single-tx. Each step confirmed via receipt before the next; failure stops the flow (no auto-retry).

## 9. Required $U — **PASS (determined)**

The seller's configured price (default `MAINNET_SERVICE_PRICE`, 1e18 wei = 1 $U when enabled) + gas. The quote currency is validated as the **official $U** (`cfg.paymentToken`) — Mainnet $U `0xcE24…`.

## 10. Buyer balance — **NOT APPLICABLE / BLOCKED for any specific buyer (truthful)**

Marketplace buyers hire with **their own wallet** via `window.ethereum` (user-controlled model); there is no pinned mainnet buyer wallet. No buyer $U exists on Mainnet among repo-known wallets today (owner's Mainnet $U = 0). A future real hire requires the buyer to hold Mainnet $U ≥ quote price and Mainnet BNB for gas. Per the milestone: **BLOCKED — INSUFFICIENT BUYER $U** (nothing attempted; no transfers/approvals).

## 11. BNB balance — **PASS (read-only)**

Owner `0xB0f768…7c0`: **0.000427122484102691 BNB** (matches prior verification; unchanged — no spends).

## 12. Mainnet gate behavior — **PASS (fails closed, 4 layers)**

1. UI card (chain-56 → disabled "coming soon" card — cannot reach signing)
2. API hard gate (`agent.chain_id !== 97` → 409) — independent of the flag
3. `prepareLiveAgentHire` gate (mainnetHireEnabled !== true → fail) — verified LIVE in this dry-run
4. `prepareMainTrackUserHire` gate (same) + flag source accepts only literal `"true"`

No client-side bypass: gates 2–4 are server-side; the client only renders
what the server prepared. No wallet prompt occurred in the dry-run (the flow
never reached execution).

## 13. Testnet regression — **PASS**

- `https://…ts.net/health` → 200, chain 97, seller `0xB0f768…7c0` — unchanged.
- Real testnet negotiate → 200, `accepted:true`, chain_id 97, testnet Commerce — the proven commercial path intact (no job created).
- Agent 1906: UNCHANGED (its production page renders fully). Job 920/787: untouched. No testnet writes.

## 14. Security isolation — **PASS**

- Mainnet seller keystore `~/.bnbagent-mainnet` — hard-gated, never falls back (runtime harness asserts); testnet seller (`v2-seller`) hard-gates `bsc-testnet` + its own keystore.
- Mainnet agent ID cannot resolve to Agent 1906: identity is the FULL `56:0x8004…:334760` string — exact-match resolution (verified by hire.verify PASS 1/1b: neighboring token id does NOT resolve).
- Chain fallback impossible (§3); Commerce/Router/Policy fallback impossible (chain-aware `cfg` + allowlist built from `cfg`, verified L271–278 chain-aware).
- Browser receives no private keys (user-controlled wallet model; keys never leave `window.ethereum`); WALLET_PASSWORD is server/runtime-env only; `.env.example` contains no secrets; keystore files outside the repo; secrets scan in activation.verify PASS (M).

## 15. UI state — **PARTIAL (indexer lag, not a code bug)**

- The production marketplace (`05ab4f4` deploy) correctly scopes Mainnet (X.231/232) and renders the truthful chain-56 "Mainnet hiring coming soon" card (no implication a hire can execute).
- **Agent 334760's page does not fully render yet**: the marketplace resolves agents through the 8004scan indexer, whose chain-56 head is at token 334754 (~6 tokens / ~1 h lag). The agent page returns a 200 shell without the agent body until the indexer catches up. On-chain state (§4) is correct and complete; this is a waiting item, not a correctness bug. (Per milestone rules: UI NOT changed.)

## 16. Tests — **PASS**

| Suite                                                        | Result                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| seller-runtime (X.236-P2)                                    | 35/35                                                                                 |
| mainnet-seller-readiness                                     | 36/36                                                                                 |
| mainnet-provisioning                                         | 52/52                                                                                 |
| main-track-user-hire (chain-aware X.234 incl. mainnet gates) | ALL PASS                                                                              |
| network-selector (X.216/231/232)                             | 63/63                                                                                 |
| hire.verify (ERC-8183 identity)                              | PASS (no signing/broadcast/payment)                                                   |
| hire.api.verify                                              | 14/14                                                                                 |
| main-track-v2.server.verify                                  | ALL PASS                                                                              |
| typecheck / lint / build                                     | PASS                                                                                  |
| prettier                                                     | PASS (after formatting `hire-chains.ts` — uncommitted X.234 file, behavior identical) |
| git diff --check                                             | CLEAN                                                                                 |

## 17. Files changed

- `packages/integrations/src/altana/hire-chains.ts` — prettier formatting only (uncommitted X.234 file; zero behavior change; user-hire suite re-passed).
- This report. No other files. **No commit, no push.**

## 18. Remaining blockers (for a future real Mainnet hire)

1. **User authorization to enable** `MAINNET_HIRE_ENABLED=true` (server/web) — required.
2. **User authorization to enable the Mainnet seller's** `MAINNET_HIRE_ENABLED` (its own flag) and restart it — required (both ends must sign/accept).
3. **8004scan indexer** must index token 334760 (expected within indexer lag window) so the marketplace UI can resolve the agent page → hire card.
4. **Buyer-side funding**: a buyer wallet with Mainnet $U (≥ 1 $U default quote) + Mainnet BNB gas. Currently **BLOCKED — INSUFFICIENT BUYER $U** (no action taken).

## 19. Exact requirements to enable Mainnet hiring

1. Set `MAINNET_HIRE_ENABLED=true` (literal string) in the web app's server environment AND the Mainnet seller's environment (two independent flags by design), restart the seller process.
2. Ship the UI's chain-56 hire path (today the API layer pins chain 97 — enabling the flag alone still yields 409 `unsupported-chain` from `main-track-hire.api.ts` L156–169; the chain-97 hard pin must be consciously relaxed to chain-56-with-flag by a future code milestone + authorization — this is defense-in-depth by design, NOT a bug).
3. Wait for 8004scan to index agent 334760 (marketplace discovery prerequisite).
4. Buyer acquires Mainnet $U + BNB gas.
5. Then the full 5-tx dry-run path becomes executable end-to-end.

## Safety ledger

| Item                                  | Count                                         |
| ------------------------------------- | --------------------------------------------- |
| Transactions                          | 0                                             |
| Signatures                            | 0                                             |
| Mainnet writes                        | 0                                             |
| ERC-8183 jobs                         | 0                                             |
| $U approvals / transfers              | 0 / 0                                         |
| Wallet prompts                        | 0                                             |
| Mainnet hires                         | 0                                             |
| Testnet writes                        | 0                                             |
| Agent 1906 / 2005 / Job 787 / Job 920 | UNCHANGED / UNTOUCHED / UNTOUCHED / UNTOUCHED |
| MAINNET_HIRE_ENABLED                  | false (unchanged)                             |
| Commit / push                         | 0 / 0                                         |

**Mainnet hiring is STILL DISABLED. STOP.**
