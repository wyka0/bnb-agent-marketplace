# X.34 - Altana Track Qualification Audit

- Scope: existing repository against the official BNB Chain "Best Built with Altana" requirements
- Date: 2026-08-14
- Method: static, read-only repository audit plus local quality gates
- Chain activity: none
- Signing/broadcast: none
- Agent 1816 / Job 515 changes: none
- Git: not committed, not pushed

## Executive verdict

The official Altana SDK and x402 server package are installed, and the
repository contains substantial ERC-8004/ERC-8183 and x402 review scaffolding.
It does not yet implement the core Altana wallet/session lifecycle required by
the track. Existing live transactions were signed directly by a long-lived EOA
through `viem`, not executed by an Altana session key registered in Keystore.

| Official core requirement | Status |
|---|---|
| Agent on its own Altana wallet | MISSING |
| Session call allowlist | PARTIAL |
| Session spend cap | PARTIAL |
| Session expiry | PARTIAL |
| Session registered in Keystore | MISSING |
| On-chain transaction through session key | MISSING |
| User can view live agent permissions | PARTIAL |
| User can revoke session in product | MISSING |

`PARTIAL` means a type, review-time control, configuration address, or UI
placeholder exists. It does not mean the corresponding Altana session feature
is operational or enforced on-chain.

## A-M repository audit

### A. Altana SDK/package dependencies - COMPLETE

- File: `packages/integrations/package.json`
- Relevant entries: dependencies `@altananetwork/sdk` `0.7.0`,
  `@altananetwork/x402-server` `^0.2.0`, `porto` `0.2.37`, `ox`, and `viem`.
- File: `apps/web/package.json`
- Relevant entry: dependency `@altananetwork/sdk` `0.7.0`.
- File: `pnpm-lock.yaml`
- Current behavior: resolves the official Altana SDK and x402 server packages.
- Missing: no package is missing for basic SDK session implementation; the
  installed session APIs are simply not called by repository code.

### B. Existing wallet/session implementation - MISSING

- File: `packages/integrations/src/altana/client.ts`
- Relevant function: `createAltanaClient`.
- Current behavior: constructs a server-safe SDK client and exposes network,
  RPC, KeyStore, controller, explorer, and relay configuration. The module
  explicitly excludes `grantSession`, `execute`, and `revokeSession`.
- File: `packages/integrations/src/altana/index.ts`
- Relevant types: `SpendCap`, `SessionKey`, `CreateSessionInput`,
  `RevokeSessionInput`, `AltanaAdapter`.
- Current behavior: declares an interface only; `ALTANA_ADAPTER_NOT_IMPLEMENTED`
  and the module header explicitly state that the real implementation is not
  wired.
- File: `packages/integrations/src/altana/registration-execution.x23.ts`
- Relevant execution: `privateKeyToAccount`, `createWalletClient`,
  `walletClient.sendTransaction`.
- Current behavior: the existing ERC-8004 wallet is a directly controlled EOA.
  The same direct-EOA pattern is used by X.26, X.28c, X.30, and X.32.
- Missing: SDK `createWallet` or an equivalent existing Altana wallet
  provisioning/adoption flow; persistent wallet ownership records; concrete
  `AltanaAdapter`; account/session lifecycle APIs.

### C. Existing session-key generation - MISSING

- File: `packages/integrations/src/altana/index.ts`
- Relevant function contract: `AltanaAdapter.createSession`.
- Current behavior: type-only contract returning `SessionKey`.
- File: `packages/integrations/src/altana/x402.ts`
- Relevant function: `requestWithX402`.
- Current behavior: accepts an externally supplied SDK `Session` but throws if
  none is supplied; this repository never creates one.
- Repository search: no authored calls to `grantSession`, no session signer/key
  generation, and no secure session persistence.
- Missing: generate a session signer, call the SDK session grant flow, retain
  the exact SDK session object/key material securely, and associate it with the
  wallet, user, and agent.

### D. Existing call allowlist implementation - PARTIAL

- File: `packages/integrations/src/altana/erc8183.job.preview.x25.ts`
- Relevant logic: the hire preview checks destinations against SDK-resolved
  Commerce, Router, Policy, Registry, and payment-token addresses.
- File: `packages/integrations/src/altana/erc8183.job515.funding.execute.x28c.ts`
- Relevant logic: local `allowlist` permits only Commerce and `$U` during the
  funding stage.
- File: `apps/web/lib/activation/hire.server.ts`
- Relevant function: hire call validation rejects destinations outside the
  verified chain-97 contract set.
- Current behavior: these are useful local review/pre-flight restrictions for
  particular ERC-8183 calls.
- Missing: SDK-native session `permissions.calls`, including target and
  selector restrictions, registered/enforced by the Altana session validator.
  Existing checks are bypassable by any other direct use of the EOA key and do
  not satisfy the official session allowlist requirement.

### E. Existing spend-cap implementation - PARTIAL

- File: `packages/integrations/src/altana/index.ts`
- Relevant type: `SpendCap` (`total`, optional `perPeriod`).
- Current behavior: interface-only representation; no code consumes or enforces
  it.
- File: `apps/web/app/(app)/settings/page.tsx`
- Relevant component: `SettingsPage` permissions card.
- Current behavior: explicitly labels session keys and spend caps as a
  placeholder and renders skeletons.
- Missing: SDK-native spend permission with token-aware bigint limits, total or
  period accounting/enforcement, configuration UX, persistence, live display,
  and cap-exhaustion tests.

### F. Existing expiry implementation - PARTIAL

- File: `packages/integrations/src/altana/index.ts`
- Relevant fields: `CreateSessionInput.expiresInMs`, `SessionKey.expiresAt`, and
  `SessionStatus` including `expired`.
- Current behavior: types only.
- File: `packages/integrations/src/altana/erc8183.ts`
- Relevant function: `validateErc8183HireInput` validates a job `expiredAt`.
- File: `packages/integrations/src/altana/x402.ts`
- Current behavior: x402 authorization validity windows are validated.
- Missing: an Altana session expiry passed to `grantSession`, Keystore-backed
  validity, runtime expiry enforcement/state reconciliation, UI, and tests.
  ERC-8183 job expiry and x402 payment validity are unrelated to session expiry.

### G. Existing Keystore integration - PARTIAL

- File: `packages/integrations/src/altana/client.ts`
- Relevant functions/types: `resolveConfig`, `AltanaResolvedConfig`,
  `getAltanaStatus`.
- Current behavior: exposes SDK `keyStore` and `keyStoreController` addresses.
- File: `packages/integrations/src/altana/erc8183.ts`
- Relevant function: `erc8183NetworkFromClient` carries these addresses into a
  network snapshot.
- Missing: Keystore authority reads such as key enumeration/validity checks,
  session-to-wallet reconciliation, and any write registering a session key.
  ERC-8004 `register(string)` registers an agent NFT and is not Keystore session
  registration.

### H. Existing on-chain session registration - MISSING

- Repository search: no authored call to `grantSession({ register: true })`,
  `registerSessionKey`, or an equivalent Keystore registration operation.
- Current behavior: none.
- Missing: explicit user-authorized registration of the generated session in
  Keystore, receipt confirmation, persisted transaction/reference data, and
  post-registration validity verification.

### I. Existing session-key transaction execution - MISSING

- Files: `registration-execution.x23.ts`, `erc8183.job.creation.x26.ts`,
  `erc8183.job.completion.cont.ts`, `erc8183.job515.funding.execute.x28c.ts`,
  `erc8183.job515.submission.execute.x30.ts`, and
  `erc8183.job515.settlement.execute.x32.ts` under
  `packages/integrations/src/altana/`.
- Relevant functions: `privateKeyToAccount`, `createWalletClient`,
  `walletClient.sendTransaction`.
- Current behavior: all live milestone writes use the provider EOA private key
  directly. This proves EOA control and transaction correctness, not Altana
  session execution.
- File: `packages/integrations/src/altana/x402.ts`
- Relevant function: `requestWithX402`.
- Current behavior: deliberately blocks without an externally supplied session
  and has no repository-created session to execute with.
- Missing: SDK `execute`/session-backed execution, one confirmed on-chain
  transaction whose authorization is the registered session key, and checks
  proving the wallet, session, permission scope, spend, and expiry used.

### J. Existing user-facing permission UI - PARTIAL

- File: `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`
- Relevant component/data: `AgentDetailView`, `PERMISSION_ROWS`.
- Current behavior: shows conceptual actions/scopes such as "Approved routers"
  and "Whitelisted only", but every access value is `Pending`; no live session
  data is loaded.
- File: `apps/web/app/(app)/compare/compare-view.tsx`
- Relevant component/data: `CompareView`, `PERMISSION_ROWS`, `PendingChip`.
- Current behavior: static pending comparison matrix.
- File: `apps/web/app/(app)/agents/[slug]/hire-review-panel.tsx`
- Relevant components/functions: `HireReviewPanel`, `ReviewView`, `requestHire`.
- Current behavior: displays an immutable ERC-8183 action review and records a
  checkbox only in local React state; it explicitly does not sign or broadcast.
- File: `apps/web/app/(app)/settings/page.tsx`
- Relevant component: `SettingsPage`.
- Current behavior: permission card is an explicit placeholder.
- Missing: a real session list/detail view showing wallet, agent, allowed
  targets/functions, spend token/caps/usage, expiry, active/revoked state, and
  Keystore status. No `/dashboard/permissions` route exists.
- Accuracy concern: `components/home/ecosystem-partners.tsx`,
  `components/home/why-choose.tsx`, and `components/home/trust-banner.tsx` claim
  session keys, spend caps, expiry, and revocation as current behavior, while
  the implementation remains placeholder-only.

### K. Existing revoke functionality - MISSING

- File: `packages/integrations/src/altana/index.ts`
- Relevant contract: `AltanaAdapter.revokeSession` and `RevokeSessionInput`.
- Current behavior: interface only; no implementation.
- Repository search: no authored SDK `revokeSession` call, web API route, server
  action, button, session status reconciliation, or revocation receipt storage.
- Missing: in-product revoke control, explicit confirmation, Keystore
  revocation transaction, receipt/status handling, and post-revoke execution
  rejection verification.

### L. Existing environment variables/configuration - PARTIAL

- File: `packages/config/src/env.ts`
- Relevant schema: `ALTANA_NETWORK` (defaults to `bnb-testnet`) and optional
  `ALTANA_RPC_URL`; all are server-only.
- File: `.env.example`
- Relevant names: `ALTANA_PAYTO`, `ALTANA_FACILITATOR_ADDRESS`,
  `ALTANA_OPERATOR_ADDRESS`, `ALTANA_SERVICE_PRICE_RAW_U`, `ALTANA_RPC_URL`,
  `ALTANA_TESTNET_PRIVATE_KEY`, `FACILITATOR_KEY`, `MERCHANT_PAYTO`, and
  `X402_PAYTO`.
- Current behavior: supports current read-only, operator, ERC-8183, and x402
  scaffolding. `.env.local` is gitignored and secret values were not inspected.
- Missing: validated session policy defaults, secure session-key encryption or
  KMS configuration, session persistence configuration, and complete schema
  validation for the operator/x402 variables already used. `createAltanaClient`
  reads `ALTANA_NETWORK` but only honors `ALTANA_RPC_URL` when passed explicitly
  as `opts.rpcUrl`.
- File: `prisma/schema.prisma`
- Current behavior: provider configured, but no models exist.
- Missing: wallet, session, permission, revocation/audit, and transaction models.

### M. Existing tests - MISSING for core sessions

- Repository search: no `*.test.*` or `*.spec.*` files; root `tests/` contains
  only `.gitkeep`.
- Files: `packages/integrations/src/altana/verify.ts`, `erc8183.verify.ts`,
  `x402.verify.ts`, `x402.testnet.verify.ts`, `x402.consent.verify.ts`, and
  `apps/web/lib/activation/hire.verify.ts`.
- Current behavior: executable verification harnesses cover SDK setup,
  chain/address pinning, ERC-8183 call construction/review, x402 challenge and
  validity handling, consent digests, and no-sign/no-broadcast boundaries.
- Missing: tests for wallet creation/adoption, session-key generation,
  call/selector rejection, spend-cap exhaustion, expiry, Keystore registration
  and reads, session-backed execution, UI permission state, revocation, and
  execution rejection after revocation.
- Safety note: execution-capable package scripts (X.23, X.26, X.28c, X.30,
  X.32) were not run in this audit.

## Official requirement assessment

### 1. Agents on their own Altana wallets - MISSING

Agent 1816 is owned by and was operated from provider EOA
`0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`. Repository evidence verifies
that ownership, but no Altana smart wallet is created or associated with the
agent. Direct EOA ownership is not evidence of the required Altana wallet.

### 2. Sessions with real limits

#### Call allowlist - PARTIAL

ERC-8183-specific local destination allowlists exist, but no Altana session
call permission is granted, registered, or enforced.

#### Spend cap - PARTIAL

The `SpendCap` interface and placeholder copy exist. No real token-aware cap is
configured, enforced, consumed, or displayed.

#### Expiry - PARTIAL

Session expiry fields exist in interfaces. No session exists, so no expiry is
registered or enforced.

### 3. Sessions registered in Keystore - MISSING

Keystore addresses are resolved from the SDK; no session key is registered and
no validity read proves one exists.

### 4. Real on-chain transactions through a session key - MISSING

The completed live transactions were direct EOA `sendTransaction` calls.
There is no Altana session-backed transaction.

### 5. User-facing control

#### User can see what the agent may do - PARTIAL

Static/pending permission tables and an ERC-8183 action review exist. They do
not display actual session scope, cap, expiry, or Keystore state.

#### User can revoke the session inside the product - MISSING

No session list/detail or revoke action exists in the product or API.

## Bonus assessment

### ERC-8183 hiring of BNB Agent Studio agents - COMPLETE

- Evidence: Agent 1816 / Job 515 on BNB Testnet.
- Files: X.26 through X.33 scripts and reports, especially
  `docs/review/Main-Track-Activation-X33-Final-E2E-Verification.md`.
- Result: Job 515 reached COMPLETED (3), released exactly 1 U, and the final
  read-only E2E suite passed 30/30.
- Classification: bonus only. It does not satisfy any core Altana wallet or
  session requirement because its transactions were direct EOA operations.

### x402/B402 selling - PARTIAL

- File: `packages/integrations/src/altana/x402.ts`
- Relevant functions: `parsePaymentRequired`, `requestWithX402`,
  `validateX402MerchantConfig`, `assertX402SellSideBoundary`.
- File: `packages/integrations/src/altana/x402.testnet.ts`
- Current behavior: B402 challenge parsing, buyer/server configuration,
  merchant validation, and a keyless verification harness are implemented.
- File: `apps/web/lib/activation/hire.server.ts`
- Relevant functions: `createHirePaymentGuard`, `buildHireMerchantConfig`.
- Current behavior: the production guard always rejects because signed
  `X-PAYMENT` verification is not wired; merchant creation, protected service
  delivery, facilitator settlement, and session-backed buyer execution remain
  blocked.
- Missing for COMPLETE: a live protected seller endpoint, real merchant and
  facilitator wiring, verified signed payment, replay/idempotency handling,
  service delivery after payment, and settlement evidence.

## Local quality gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS (exit 0) |
| `pnpm lint` | PASS (exit 0) |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | PASS (exit 0) |

These gates are local repository commands. No Altana verification or milestone
script that could sign or broadcast is part of this audit.

## Minimum implementation required for full eligibility

1. Provision or adopt an Altana wallet for the agent/user and persist the
   wallet-to-agent relationship.
2. Implement one server-side session service using the installed SDK:
   generate the session key, call `grantSession`, and supply explicit
   call/selector allowlist, token-aware spend cap, and expiry.
3. Register that session in Keystore and verify its active authority through a
   read after confirmation.
4. Execute one permitted BNB Testnet transaction through the registered
   session key and retain receipt plus permission evidence; do not use the
   direct provider EOA execution scripts as qualification evidence.
5. Add one product session page showing wallet, agent, allowed calls, spend
   cap/usage, expiry, and live active/revoked Keystore state.
6. Add an in-product revoke action backed by the SDK/Keystore and verify that
   the revoked session can no longer execute.
7. Add focused tests for allowed execution, disallowed target/selector, spend
   cap, expiry, registration visibility, revocation, and post-revoke rejection.

Completing x402 selling is bonus work and is not required to close the eight
core gaps above.

## Final report

```text
X.34 STATUS: AUDIT COMPLETE

CORE ALTANA:
1. Own Altana wallet: MISSING
2. Call allowlist: PARTIAL
3. Spend cap: PARTIAL
4. Expiry: PARTIAL
5. Keystore registration: MISSING
6. Session-key transaction: MISSING
7. User permission view: PARTIAL
8. User revoke: MISSING

BONUS:
ERC-8183: COMPLETE
x402/B402: PARTIAL

TRANSACTIONS: NONE
SIGNING/BROADCAST: NONE
AGENT 1816 / JOB 515: UNCHANGED
GIT: NOT COMMITTED, NOT PUSHED
```

STOP after audit. No implementation was performed.
