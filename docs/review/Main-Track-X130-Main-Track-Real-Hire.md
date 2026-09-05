# X.130 Main Track Real Hire Activation

**Mode:** Main Track rubric. A NEW BSC Testnet ERC-8183 commercial hire was created and funded with a dedicated **marketplace-client** wallet, using the proven V2 path. The X.76/Altana execution-capability gates were **not** weakened, deleted, or bypassed. STOPPED at FUNDED — no submit, no settle. No deploy/commit/push.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Rubric interpretation

The Main Track rubric requires `land → find agent → understand → activate`. It does **not** explicitly require the X.76 `resource`/`executionCapability` fields. X.128 concluded production activation must remain fail-closed on the stricter Altana path (X.76 capability authority) until that authority exists. X.130 does not touch that conclusion. Instead it establishes a **separate, legitimate Main Track commercial activation path**: a real V2 ERC-8183 hire where the marketplace is the client, funded escrow on testnet, with complete auditable evidence and no fabricated state.

## 2. Why Main Track V2 activation is separated from X.76

- **X.76/Altana path** (unchanged): `VerifiedExecutionCapability` requires `resource` + `executionCapability` + marketplace-as-client + custody. It stays fail-closed (Hire `403`/`409`, Altana `503`).
- **Main Track V2 path** (this milestone): a distinct boundary `runMainTrackV2HireActivation()` that requires the verified V2 commercial agreement and executes a real marketplace-client ERC-8183 hire to FUNDED. It does not fabricate a capability, resource, job, session, or ACTIVE state. `active` remains `false`; the activation state is `funded-commercial-hire`.

## 3. Marketplace-client wallet identity

- Address: `0xeb237fb12588eaff8b907B8b9C1f5349969bb98d`
- Loaded via official `@bnbagent/sdk@0.5.1` `EVMWalletProvider`
- Keystore V3: `~/.bnbagent/wallets/0xeb237fb12588eaff8b907B8b9C1f5349969bb98d.json`
- `source: loaded_keystore` (password-only reload verified, fresh process)
- Chain: `97`
- Distinct from seller `0xB0f7...` ✅ and buyer `0x299C...` ✅ (never OnchainOS/OKX/Altana production)
- Testnet funding (transferred from the dedicated buyer wallet, which itself is a disposable testnet wallet):
  - native funding transfer (on-chain confirmed; marketplace balance `0.01 tBNB`)
  - `$U` transfer: `0x73e3a9e6bc8d82c1d382d782e07ff59f06e637e9ef19bd17795ee927cc5cc2a2` (block `127162045`, success) → `1.2 U`
  - Honest note: an earlier `$U` transfer attempt reverted (out-of-gas) because the buyer is an EIP-7702 delegated account needing ~66,250 gas; it was resent with correct gas.

## 4. Seller identity / Agent 1906

- Seller/provider: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- ERC-8004 Agent ID: `1906` (registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, chain 97)
- `getAgentInfo(1906)` → owner == seller ✅, agentAddress == seller ✅
- Operational seller endpoint (current quick tunnel serving the isolated seller): `https://humanitarian-home-aaa-baptist.trycloudflare.com`
  - `/health` → `200` ✅, `/.well-known/agent-card.json` → `200` ✅, `POST /negotiate` → `200` ✅
  - Limitation (honest): the on-chain registered `services[].endpoint` still points to an earlier expired tunnel; updating it requires an on-chain `setAgentUri` (not authorized). The live seller service is the same identity.

## 5. Quote verification

- Fresh `POST /negotiate` (official `NegotiationRequest.toDict()`)
- Quote: `accepted:true`, `price: 1000000000000000000` (1 U), `currency: 0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`, `chain_id: 97`, `verifying_contract: 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`, expiry future, `provider_sig` + `negotiation_hash` present
- `verifyQuoteSignature` → `valid:true`, `method:eip191`, `signer == 0xB0f7681668f916eEd97dA066D31aA295D34727c0` ✅
- `buildJobDescription(quote)` → 769-byte on-chain description

## 6. Real marketplace-client ERC-8183 hire (NEW JOB, chain 97)

Client (marketplace): `0xeb237fb12588eaff8b907B8b9C1f5349969bb98d`
Provider (seller/Agent 1906): `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
Commerce: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` · Router `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` · Policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` · Token `0xc70B...`

| Step                | Transaction                                                          | Block       | Status  |
| ------------------- | -------------------------------------------------------------------- | ----------- | ------- |
| createJob (Job 641) | `0xeb185939f977053be8f7846c7c1cdcbf3cb7902480d13892f9ee30295f1127f8` | `127163380` | success |
| registerJob         | `0x323a68f99e1cfe8846b6490f316b545e7f7fefe340b21f3f2282746bfc8ace1e` | `127163386` | success |
| setBudget (1 U)     | `0xe8d80bf3d2a5d19361e8c91687b6cc7b907efecc3c89801397a72b90ed7420d1` | `127163392` | success |
| approve (1 U exact) | `0x9bd3c2b8c79899212ac3af59f6ee91beefe1905b70f1e26d93903d7061ba1353` | `127163396` | success |
| fund (1 U)          | `0xfb8c7dd6cbe9afd9e3c91d270ffe8e30cb84bf15d30539f12480ea9e7ae5e76d` | `127163526` | success |

Explorer links:

- `https://testnet.bscscan.com/tx/0xeb185939f977053be8f7846c7c1cdcbf3cb7902480d13892f9ee30295f1127f8`
- `https://testnet.bscscan.com/tx/0xfb8c7dd6cbe9afd9e3c91d270ffe8e30cb84bf15d30539f12480ea9e7ae5e76d`

## 7. Exact on-chain state (independent read-only verification)

```text
jobId:      641
client:     0xeb237fb12588eaff8b907B8b9C1f5349969bb98d  (marketplace client)
provider:   0xB0f7681668f916eEd97dA066D31aA295D34727c0  (seller / Agent 1906)
budget:     1000000000000000000 (1 U)
status:     FUNDED (1)
expiredAt:  1787757261
submittedAt: 0
deliverable: 0x0000...0000
```

All five receipts: status `success`, from the marketplace client, to commerce/router/token. `submittedAt == 0` and `deliverable` all-zero → no submit, no settle.

Marketplace client remaining balances: `0.009939743 tBNB`, `0.2 U` (escrow held 1 U; exact approval consumed → allowance `0`).

**STOPPED at FUNDED.** No submit, no settle (seller `fundedJobWatcher` disabled).

## 8. Main Track V2 activation boundary

`packages/integrations/src/altana/v2/main-track-hire.ts` — `runMainTrackV2HireActivation(ports, input)`, pure with injected I/O, exported from `@bnb-marketplace/integrations/altana`:

- Requires a verified marketplace-client wallet (`loaded_keystore`, chain 97, distinct from seller/buyer).
- Requires the verified V2 commercial agreement (X.127 `runV2HireNegotiation`).
- Fails closed on: wallet unavailable / identity unverifiable / wrong chain; seller identity mismatch; invalid quote signature; chain / commerce / token / price mismatch; expired quote; endpoint unavailable; seller/client mismatch; failed `createJob`; failed `fund`.
- Builds the 5-call plan; executes via an injected SDK-backed executor; independently verifies FUNDED on-chain.
- Never fabricates ACTIVE: `active:false`, activationState `funded-commercial-hire`; `nextRequiredAction` forbids submit/settle in X.130.
- Job 622 is accepted only as `historicalEvidence` — never as the new hire; a pre-bound `jobId` on the agreement is rejected.
- Pure UI helpers: `buildMainTrackHireConfirmation` (agent / seller identity / service description / price / chain / quote expiry / what-will-happen) and `mainTrackHireStepLabel` (Creating job → Registering → Funding → Funded).

## 9. Security gates (unchanged, fail-closed)

- X.76 `capability-source`: untouched — no provider → `null`.
- `session-gate`, `consent.commitment.ts`, `capability.ts`, `/api/activation/hire` route: **not modified**.
- The Main Track path is a distinct boundary; nothing in production imports or wires it yet.
- No mainnet, no AWS/KMS, no Altana production custody, no OnchainOS/OKX.
- No secrets printed or committed; keystores are not staged.

## 10. Test results

New (this milestone):

- `packages/integrations/src/altana/v2/main-track-hire.verify.ts` — **45 checks PASS** (successful FUNDED; wallet missing; wallet identity unverifiable; buyer-as-client; seller-as-client; mainnet wallet; wrong provider; wrong signer; wrong chain; wrong commerce; wrong price; expired quote; endpoint unavailable; failed createJob; failed fund; executor throw; seller/client mismatch; job not FUNDED on chain; Job 622 history-only; confirmation + step labels; no ACTIVE).

Existing suites (all PASS):

- `activation:verify` 33/33 · `activation:hire:verify` 23/23 · `activation:hire-api:verify` 14/14 · `activation:capability-source:verify` ALL
- `activation:x80:verify` ALL · `activation:x81:verify` ALL · `security:x49:verify` 25/25 · `security:x55:verify` 22/22
- X.84 14/14 · X.85 13/13
- `altana:erc8183:verify` PASS (testnet, no tx) · `hire-adapter:verify` (X.127) ALL
- Build/typecheck/lint/format: `packages/integrations` build + `tsc --noEmit` + lint PASS; `apps/web` `tsc --noEmit` + lint + `next build` PASS; prettier PASS.

## 11. Production impact

- **No production behavior changed.** The production `/api/activation/hire` remains fail-closed (Hire `403`/`409`, Altana `503`).
- The real funded job was executed from isolated tooling (`services/v2-*`), not from the production route, because production has no marketplace-client custody.
- Wiring the production Hire button to `runMainTrackV2HireActivation` requires: (a) an explicit integration decision, (b) marketplace-client Keystore V3 custody provisioned in the deployment environment (or a remote signer), and (c) re-verification of every gate. This remains a documented, separately-authorized step — consistent with X.128.

## 12. Remaining limitations

1. Marketplace-client custody is local/isolated; production wiring requires provisioned custody.
2. The on-chain registered seller endpoint (Agent 1906 metadata) is stale (expired tunnel); the operational seller endpoint was verified reachable. Updating the registration requires an authorized `setAgentUri`.
3. The job is `FUNDED` only — submit/settle are not authorized by X.130 (escrow is live on testnet).
4. This is a **commercial** activation (funded escrow), distinct from an X.76 execution-capability authority; the Altana/X.76 path remains fail-closed per X.128/X.129.

## Final classification

**A — REAL MAIN TRACK HIRE FUNDED.** A new marketplace-client ERC-8183 job (Job 641) was created and funded on BSC Testnet with a dedicated disposable marketplace-client wallet, using the verified V2 commercial path, with full auditable evidence. STOPPED at FUNDED; no submit/settle. Production behavior unchanged and still fail-closed on the X.76 path.

No private key, password, mnemonic, seed phrase, or keystore contents are included in this report.
