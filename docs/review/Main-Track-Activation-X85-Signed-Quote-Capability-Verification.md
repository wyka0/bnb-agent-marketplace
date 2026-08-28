# Main-Track Activation — X.85: Signed-Quote Capability Verification

> Status: **PARTIAL** (Signed-quote verifier implemented & tested; composed into the X.81 read-only provider as the ONLY trusted source for job-bound `resource`+`executionCapability`. Real activation still BLOCKED — production has no `SignedQuoteReader`, and no verified funded ERC-8183 job with an authoritative signed quote exists.)
> Date: 2026-08-21
> Scope: BNB Agent Studio Marketplace — a pure signed-quote capability verifier (`verifySignedQuote`) and a resolver (`makeSignedQuoteBindingResolver`) that the X.81 production provider consumes as its `resolveCapabilityBinding`.
> Explicitly out of scope: job creation/funding, signing new quotes, custody, real agent activation, on-chain writes. This module verifies quotes; it does not issue them.

---

## 1. X.84 Starting State

- X.84 produced a `CandidateCapabilityBinding` that is NEVER promoted to `VerifiedExecutionCapability` (self-asserted, not job-bound, not integrity-verified).
- X.81 confirmed the ERC-8183 job schema omits `resource` and `executionCapability`; the ONLY permitted origin for those two fields is a trusted out-of-band binding. X.85 defines what a _trustworthy_ binding looks like: a provider-signed quote that is cryptographically bound to the exact job and owner.

## 2. Signed Quote as the Trusted Binding

`Erc8183SignedQuote` (the signed-quote payload) carries:

```
jobId, provider, resource, executionCapability, quoteExpiresAt, signedAt, signature
```

The quote is signed by the **job provider** over a versioned message built by `buildQuoteMessage`:

```
ALTANA-ERC8183-QUOTE/1
jobId=<id>
provider=<addr>
resource=<resource>
executionCapability=<executionCapability>
quoteExpiresAt=<iso>
signedAt=<iso>
```

`verifySignedQuote(quote, job, trustedOwner)` recovers the signer via `recoverMessageAddress` (viem) and enforces:

1. **Signer == job.provider** (the quote must be signed by the provider named on the on-chain job).
2. **job.provider == trustedOwner** (the provider must equal the trusted ERC-8004 registry `owner_address` for the exact agent — same check as X.81 §7).
3. **jobId bound:** `quote.jobId === job.id` (the quote is for THIS job, not a reused/forged quote).
4. **Unexpired:** `quoteExpiresAt > now` (and `signedAt <= now`).
5. **Rejects placeholders:** `resource === "default"` and `executionCapability === "enabled"` are refused (these are exactly the false-activation placeholders).
6. **Recovered address is valid** and matches `provider`.

This makes the signed quote the ONLY source that can legitimately supply job-bound `resource`+`executionCapability`: it is provider-signed (cryptographic), chain-job-bound (verifiable against the on-chain job), owner-bound (verifiable against 8004scan), and expiring.

## 3. Resolver Composition into X.81

`makeSignedQuoteBindingResolver(reader: SignedQuoteReader | null, resolveOwner)`:

- If `reader === null` (production default) → returns `null` (gate stays closed; no reader = no quotes = no capability).
- Else: fetches the quote for `(agentId, jobId)`, recovers the signer, validates against the `job` + `trustedOwner`, and emits a full `Erc8183CapabilityBinding` with `authority: "erc8183-signed-quote"`, `jobBound: true`, `integrityVerified: true`, `verifiedAt`, `signature`, `signedBy`, `quoteExpiresAt`.

This resolver is wired into `createProductionErc8183CapabilityProvider({ resolveCapabilityBinding: makeSignedQuoteBindingResolver(signedQuoteReader, resolveAgentOwner) })`. The X.81 production options gained `signedQuoteReader?: SignedQuoteReader | null` (default `null`).

## 4. Async Binding Fix

X.81's `resolveCapabilityBinding` contract was originally typed `Erc8183CapabilityBinding | null`, but the X.85 resolver is asynchronous (reads the quote, recovers signature). The X.81 provider's consumption was fixed:

- `erc8183-capability-provider.ts` line ~164: `const binding = await config.resolveCapabilityBinding(...)` (was NOT awaited → `binding` was a `Promise` → always failed the resource check).
- The interface type was widened to `Erc8183CapabilityBinding | null | Promise<Erc8183CapabilityBinding | null>` so both sync (X.84-style) and async (X.85) resolvers are accepted.

## 5. Fail-Closed in Production

- Production supplies `signedQuoteReader: null` (no quote publisher is configured), so `resolveCapabilityBinding` returns `null` → the X.81 provider returns `null` → the X.80 gate stays fail-closed.
- No signed quote is forged, no placeholder capability is promoted, and the gate cannot be opened without a real, cryptographically verified quote tied to a funded job owned by the trusted registry owner.

## 6. Verification

`npm run activation:x85:verify` — **13/13 PASS** (offline, network-free; uses `privateKeyToAccount` from `viem/accounts` to sign test quotes).

- Positive: valid provider-signed, job-bound, owner-matched, unexpired quote → binding with `jobBound:true`, `integrityVerified:true`; produces a capability accepted by the X.81 provider + X.76 validator.
- Negative (all return `null`/`false`): wrong signer, signer ≠ job.provider, provider ≠ trusted owner, `jobId` mismatch, expired quote, `"default"` resource, `"enabled"` capability, tampered message, malformed signature, revoked/invalid signer.
- Boundary: production `reader === null` → `null` (gate closed); async resolver is correctly awaited by the provider.

Existing suites remain green: `activation:x81:verify` (45/45), `activation:x80:verify` (ALL PASS), `activation:capability-source:verify` (X.76 ALL PASS), `activation:hire:verify` (23/23), `activation:hire-api:verify` (14/14), `altana:session:verify` (25/25), `altana:session:api:verify` (72/72), `security:x49:verify` (25/25), `activation:verify` (33/33), `activation:x84:verify` (14/14). `typecheck`/`lint`/`build` exit 0. X.50 `check-24` untouched (pre-existing, not introduced by X.84/X.85).

## 7. Implementation Changes

Added (working tree, untracked — NOT committed):

- `apps/web/lib/activation/signed-quote-capability.ts` — `Erc8183SignedQuote`, `buildQuoteMessage`, `verifySignedQuote`, `SignedQuoteReader`, `makeSignedQuoteBindingResolver`.
- `apps/web/lib/activation/x85.verify.ts` — offline verifier (13 checks).
- `apps/web/package.json` — added script `activation:x85:verify`.

Modified (working tree, untracked — NOT committed):

- `apps/web/lib/activation/erc8183-capability-provider.server.ts` — imports `makeSignedQuoteBindingResolver` + `SignedQuoteReader`; adds `signedQuoteReader` option (default `null`); wires resolver with `resolveAgentOwner` from 8004scan. (Removed unused `Erc8183CapabilityProviderConfig` import to keep `lint` clean.)
- `apps/web/lib/activation/erc8183-capability-provider.ts` — `await`s `resolveCapabilityBinding`; widened interface to accept `Promise<...>`.

No activation route was changed; production remains fail-closed.

## 8. Limitations

1. **No production `SignedQuoteReader`:** no quote publisher is configured, so the resolver returns `null` in prod.
2. **No real signed quote exists:** there is no verified funded ERC-8183 job carrying an authoritative provider-signed quote in the repo/environment.
3. **Custody not provisioned:** even with a verified quote + capability, the X.80 gate stays `custodyAvailable = false` ⇒ Session Creation Blocked.
4. **Mainnet (56) not wired:** the underlying `getErc8183Job` + provider both refuse non-testnet.

## 9. Exact Next Dependency

To move from PARTIAL → real verification:

- An **authoritative signed-quote publisher** (the ERC-8183 `provider`/registry owner) must issue quotes over funded jobs, and a `SignedQuoteReader` must be supplied to `createProductionErc8183CapabilityProvider({ signedQuoteReader })`.
- Custody provisioning (AWS KMS + ALTANA admin signer) so `custodyAvailable` can become `true`.
- Wiring `createProductionErc8183CapabilityProvider()` into `route.ts`'s `evaluateActivationGate` (replacing the inline fail-closed `verifiedJob: null`).

## 10. Final Classification

| Dimension              | Result      | Note                                                                                              |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| SIGNED-QUOTE VERIFIER  | **PASS**    | Recovers signer, enforces signer==provider==owner, jobId-bound, unexpired, rejects placeholders.  |
| BINDING COMPOSITION    | **PASS**    | Resolver wired into X.81 as `resolveCapabilityBinding`; async await fixed.                        |
| INTEGRITY VERIFICATION | **PASS**    | Provider-signed + chain-job-bound + owner-bound + expiring.                                       |
| JOB BINDING            | **PASS**    | `quote.jobId === job.id` enforced.                                                                |
| PROD FAIL-CLOSED       | **PASS**    | `reader === null` → `null` → gate closed.                                                         |
| CUSTODY                | **BLOCKED** | Not provisioned; gate still denies.                                                               |
| REAL ACTIVATION        | **BLOCKED** | No real funded job + signed quote in repo/environment.                                            |
| **OVERALL X.85**       | **PARTIAL** | Verifier implemented & composed; blocked only by absent production reader + custody + real quote. |

### Verify vs. issue vs. real execution

- **SIGNED-QUOTE VERIFICATION:** ✅ implemented (X.85) — verifies a provider-signed, job-bound, owner-matched, unexpired quote; never issues one.
- **QUOTE ISSUANCE:** ❌ NOT implemented (out of scope; would require provider signing keys).
- **REAL EXECUTION:** ❌ NOT implemented (no custody, no session, no agent activation).
