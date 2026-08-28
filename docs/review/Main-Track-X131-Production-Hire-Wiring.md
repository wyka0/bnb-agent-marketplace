# X.131 Production Hire Wiring — Main Track V2 (Model B)

**Mode:** Wiring implementation + tests. No new blockchain transaction, no submit/settle of Job 641, no production custody provisioning, no deploy/commit/push. Job 641 is evidence only.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. X.130 evidence (recap)

- Marketplace-client wallet: `0xeb237fb12588eaff8b907B8b9C1f5349969bb98d` (dedicated disposable, Keystore V3, chain 97)
- Agent 1906 / provider: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- **Job 641 FUNDED** on BSC Testnet: client = marketplace client, provider = seller, budget `1 U`, `expiredAt 1787757261`, `submittedAt 0`
- Transactions: `createJob 0xeb185939...` · `registerJob 0x323a68f9...` · `setBudget 0xe8d80bf3...` · `approve 0x9bd3c2b8...` · `fund 0xfb8c7dd6...`
- No submit/settle performed.

## 2. Model A vs Model B decision

Two explicit activation policies, kept distinct in code (`apps/web/lib/activation/main-track-v2.ts`):

- **MODEL A** (`model-a-x76-verified-execution-capability`) — the strict X.76/Altana path: requires `VerifiedExecutionCapability` (resource + executionCapability + marketplace-as-client + custody). **UNCHANGED and still fail-closed** (verified: `resolveExecutionCapability` returns `null` without a provider; `/api/activation/hire` untouched; Altana `503`).
- **MODEL B** (`model-b-v2-commercial-agreement`) — the Main Track commercial hire boundary: verified V2 commercial agreement + funded marketplace-client ERC-8183 job. `FUNDED` is escrow, never `ACTIVE`.

The boundary `runMainTrackV2HireActivation()` (packages/integrations/src/altana/v2/main-track-hire.ts) is the single Model B entry.

## 3. Production architecture

New files (all fail-closed; existing security controls untouched):

- `apps/web/lib/activation/main-track-v2.ts` — Model A/B constants, explicit Hire state model (`pending → negotiating → quote-verified → creating-job → registering → funding → funded | failed`), custody seam `resolveMainTrackCustody` (never reads a raw key; only `MAIN_TRACK_CUSTODY_PROVIDER` / `MAIN_TRACK_CUSTODY_KEY_REFERENCE`, and only `kms`/`remote-signer`/`external-custody` providers accepted), review view builder, and `runMainTrackHireOrFailClosed` (fail-closed orchestration around the integration boundary).
- `apps/web/lib/activation/main-track-hire.api.ts` — testable Model B handler: auth → CSRF → rate limit → exact identity → chain-97 → owner → custody → review / activate(with explicit `confirmed:true`) → funded result (job id + tx evidence, `active:false`).
- `apps/web/app/api/activation/main-track-hire/route.ts` — production route wiring the handler with the existing auth/CSRF/rate-limit/8004scan machinery. Delegates to the pure boundary via the custody seam.
- `apps/web/lib/activation/main-track-v2.server.verify.ts` + `activation:main-track:verify` script.
- No change to `/api/activation/hire`, `session-gate`, `capability-source`, `consent.commitment.ts`, or the Altana/X.76 path.

## 4. Custody status

- The X.130 marketplace-client wallet is a **local Keystore V3** (password-only). Production has **no** custody for it: `resolveMainTrackCustody(process.env)` returns `available:false` ("main-track marketplace custody not provisioned; no server-held raw private keys").
- AWS/KMS + management/admin custody remain unprovisioned (X.75 unchanged: no `AWS_REGION`/`ALTANA_KMS_KEY_ID`/`ALTANA_KMS_PROVIDER`; no remote signer).
- Per the milestone, the implementation **must not** introduce server-held raw private keys and **must not** copy the X.130 keystore into production. Therefore the route is fail-closed: it returns `main-track-custody-required` until a compliant custody mechanism (KMS-backed remote signer / external custody) is provisioned.

## 5. UI flow (state model + confirmation)

The state model and review view are implemented; the UI renders explicit states and never shows ACTIVE/RUNNING/EXECUTING/COMPLETED:

- Review shows: Agent 1906, provider `0xB0f7...`, network BNB Chain Testnet, price `1 U`, commerce ERC-8183, quote `Verified`, quote expiry, marketplace wallet identified (no secret), and `Confirm Hire — 1 U`.
- After confirmation: Preparing hire → Negotiating → Quote verified → Creating job → Registering job → Funding → Funded; then `Funded` + Job ID + real transaction hashes.
- Without custody the UI receives the fail-closed `main-track-custody-required` state (honest), not a fabricated success.

## 6. API flow

`POST /api/activation/main-track-hire` `{ action, agentId, confirmed? }`:

1. Authenticate (`getAuthenticatedUser`) → 401 if absent.
2. CSRF + origin → 403 on mismatch.
3. Rate limit.
4. Exact ERC-8004 identity resolution (8004scan) → 404 on unknown.
5. Chain-97 gate → 409 on non-97.
6. Registry owner present.
7. Custody check → 409 `main-track-custody-required` if unavailable (current production behavior).
8. `review` → Model B review view.
9. `activate` → requires `confirmed:true` (409 otherwise) → runs `runMainTrackV2HireActivation` → returns 201 with `state:"funded"`, job ID, txHashes, blockNumbers, `active:false`, `activationState:"funded-commercial-hire"`, `nextRequiredAction` (submit/settle require separate authorization).
10. No secret or private key is ever in a response.

## 7. Security gates

- Model A path unchanged; capability-source returns `null` without a provider.
- Session-gate, consent commitment, Altana custody: untouched.
- Explicit confirmation mandatory before any spend.
- Custody resolver rejects raw-key providers and never reads a private key.
- Mainnet rejected; commerce/token/price pinned to official chain-97 values.

## 8. Test results

New: `activation:main-track:verify` — **30 checks PASS** (unauthenticated 401, CSRF 403, wrong agent 404, wrong seller, invalid providerSig, wrong chain, wrong commerce, wrong price, expired quote, endpoint unavailable, no wallet (route + integration), confirmation required, funded ≠ ACTIVE, real job id, tx evidence, Job 622 history-only, Model A unchanged, Model B explicit, no secrets/private keys in responses, custody fail-closed).

All existing suites green:

- `activation:hire:verify` 23/23 · `activation:hire-api:verify` 14/14 · `activation:capability-source:verify` ALL · `activation:x80`/`x81` ALL · `security:x49` 25/25 · `security:x55` 22/22
- X.84 14/14 · X.85 13/13 · `altana:erc8183:verify` PASS · `hire-adapter` (X.127) ALL · `main-track-hire` (X.130) ALL
- `apps/web` typecheck + lint + `next build` PASS; `packages/integrations` typecheck + lint + build PASS; prettier PASS.

## 9. Production readiness

- Implementation is wired and fully tested **fail-closed**.
- The one thing blocking live production funding is **marketplace-client custody** (KMS/remote-signer), which is not provisioned. Copying the X.130 local keystore into production would violate the no-server-held-raw-key rule and is not done.

## 10. Exact remaining blockers

1. **Marketplace-client custody** — provision a compliant mechanism (e.g. KMS-wrapped remote signer / external custody provider) and set `MAIN_TRACK_CUSTODY_PROVIDER` + `MAIN_TRACK_CUSTODY_KEY_REFERENCE`. Until then the route returns `main-track-custody-required`.
2. **SDK-backed ports in production** — when custody exists, wire real negotiation/verify/execute ports (official `@bnbagent/sdk` with the custody signer) into the route's injected ports.
3. **Seller registered endpoint** — Agent 1906 on-chain metadata still points to an expired tunnel; the operational endpoint is verified reachable. Update registration when authorized.
4. **Submit/settle** — requires separate explicit authorization (not part of X.131).

## Final classification

**B — PRODUCTION CUSTODY REQUIRED.** The Main Track V2 (Model B) production wiring is implemented, explicitly separated from Model A, fully tested, and fail-closed; but live production funding cannot proceed until compliant marketplace-client custody is provisioned. No security boundary was weakened, no server-held raw key introduced, no secret staged, no transaction broadcast, and no commit/push/deploy performed.
