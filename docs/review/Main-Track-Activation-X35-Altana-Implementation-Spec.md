# X.35 - Altana Session Implementation Specification

- Scope: implementation design only for the BNB Chain "Best Built with Altana" track
- SDK inspected: `@altananetwork/sdk@0.7.0`
- Related package inspected: `porto@0.2.37`
- Target network: BNB Smart Chain Testnet, chain 97 only
- Chain activity: none
- Signing/broadcast: none
- Agent 1816 / Job 515: unchanged
- Commit/push: none

## Executive Summary

The installed SDK contains the required wallet, session, relay, KeyStore,
execution, and revoke primitives. The repository currently uses none of the
session lifecycle methods. Existing X.23/X.26/X.28c/X.30/X.32 transactions are
direct `viem` EOA transactions and must remain separate from the future
session-qualified flow.

The narrowest track-qualification path is:

1. Adopt the existing provider key only as an Altana admin signer for a new
   Altana smart-account representation, without changing Agent 1816.
2. Create an Altana wallet handle with `client.createWallet({ signer })`.
3. Grant a separate session signer with explicit target/signature calls,
   token-aware spend, and absolute expiry.
4. Register that session in KeyStore.
5. Execute a new, harmless chain-97 permitted call through
   `client.execute({ session, calls })`.
6. Revoke it with the admin signer and verify the same session is rejected.

This specification does not execute those steps.

## SDK Evidence And Sources

The following local installed files were inspected:

- `node_modules/.pnpm/@altananetwork+sdk@0.7.0_*/node_modules/@altananetwork/sdk/package.json`
- `.../@altananetwork/sdk/README.md`
- `.../@altananetwork/sdk/dist/index.d.ts`
- `.../@altananetwork/sdk/dist/client.d.ts`
- `.../@altananetwork/sdk/dist/createWallet.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/internal/sessions.d.ts`
- `.../@altananetwork/sdk/dist/grantSession.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/registerSessionKey.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/execute.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/revokeSession.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/internal/keystore.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/config.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/internal/relay.d.ts` and `.js`
- `.../@altananetwork/sdk/dist/internal/signer.d.ts` and `.js`
- `node_modules/.pnpm/porto@0.2.37_*/node_modules/porto/src/viem/Key.ts`
- `.../porto/src/core/internal/schema/key.ts`

Repository sources used:

- `packages/integrations/src/altana/client.ts`
- `packages/integrations/src/altana/index.ts`
- `packages/integrations/src/altana/erc8183.ts`
- `packages/integrations/src/altana/x402.ts`
- `docs/TIS.md`
- `docs/review/Altana-Integration-Discovery.md`
- `packages/config/src/env.ts`
- `.env.example`

The installed declarations and source are sufficient to specify the SDK calls.
Official documentation/source still must be consulted before implementation for
the product-level custody model, authentication/ownership model, production
session persistence/encryption, and any required judging evidence format. The
repository does not contain those application contracts.

## Exact SDK Surface

### Package and network

```ts
import {
  BNB_TESTNET,
  createClient,
  registerSessionKey,
  signerFromPrivateKey,
  createPrivateKeySigner,
} from "@altananetwork/sdk";
import type {
  Call,
  CallPermission,
  Client,
  Session,
  SessionPermissions,
  SpendPermission,
  Wallet,
} from "@altananetwork/sdk";
```

Important import detail:

- `createWallet`, `grantSession`, `execute`, and `revokeSession` are exposed as
  **client methods** in the public API. Their standalone implementation files
  exist in `dist`, but they are not named value exports from `dist/index.d.ts`.
- `registerSessionKey` is both a public named export and a client method. Use
  `client.registerSessionKey` for one consistent chain-aware adapter.
- `signerFromPrivateKey` and `createPrivateKeySigner` are public named exports.
- The installed public index does not export `signerFromInjected`, despite the
  internal signer documentation mentioning it. Do not design against that name
  without verifying a newer official SDK version.

`BNB_TESTNET` is the official SDK config:

- chain: viem `bscTestnet`
- chainId: `97`
- KeyStore: `0x6b8361C29d05D498b1a12B54A37310f94171E94A`
- KeyStoreController: `0xb530D1971f5453F3359518343F05D0AedFfF7e12`
- public RPC: `https://bsc-testnet-rpc.publicnode.com`
- relay: `https://testnet-relay.altana.network`

These addresses come from the installed SDK's `config.js`, whose comment cites
the Altana KeyStore deployment manifest. The repository's `createAltanaClient`
and `resolveConfig` already resolve the same SDK network values. Do not add a
second handwritten address table.

## Requirement 1 - Wallet Provisioning / Adoption

### Exact API

```ts
const client = createClient({ chains: [BNB_TESTNET], defaultChainId: 97 });

const adminSigner = signerFromPrivateKey(privateKey);
const walletResult = await client.createWallet({ signer: adminSigner });
const wallet: Wallet = walletResult;
const signer = walletResult.signer;
```

SDK declarations:

```ts
type ClientCreateWalletOptions = { signer?: Signer };
type Wallet = { address: Address };
type CreateWalletResult = Wallet & { signer: Signer };
client.createWallet(opts?: ClientCreateWalletOptions): Promise<CreateWalletResult>;
```

### Behavior and transaction boundary

- `createWallet` calls the Altana testnet relay to register/bootstrap the
  account representation for the signer.
- The installed implementation describes this as counterfactual and says no
  on-chain transaction occurs during wallet creation; first on-chain admin
  action carries account setup and initial KeyStore registration as needed.
- `createWallet` does not return a private key unless the SDK generated one;
  the returned `signer` is the custody boundary.
- For a private-key signer, the wallet address is the EOA address and the
  signer directly authorizes EIP-7702 account setup. This is still an Altana
  smart-account wallet flow, but the admin signer remains an EOA key.
- For browser users, `client.createPasskeyWallet({ name, rpId? })` returns a
  wallet and passkey signer. Its WebAuthn ceremony is interactive and requires
  official browser/passkey UX design; it is not currently wired in this repo.

### Required signer and environment

- Admin signer: `Signer` from `signerFromPrivateKey`, `createPrivateKeySigner`,
  or a supported passkey signer.
- Existing server variable: `ALTANA_TESTNET_PRIVATE_KEY` in `.env.local`.
- This variable is currently the X.23/X.26/X.28c/X.30/X.32 operator EOA secret.
  Reusing it for an Altana admin would require an explicit custody decision and
  must not be confused with the generated session signer.
- No API key is required by the SDK.
- The existing `ALTANA_NETWORK` and `ALTANA_RPC_URL` configuration should be
  retained, but the implementation must pass `env.ALTANA_RPC_URL` explicitly to
  `createAltanaClient({ rpcUrl })`; the current client does not automatically
  consume that env value.

### BNB Testnet

Yes. `BNB_TESTNET` has a live testnet relay and KeyStore deployment according to
the installed SDK config. Mainnet `BNB` must not be selected for this track
implementation.

### Reusable repository code

- `packages/integrations/src/altana/client.ts`: client creation, chain pinning,
  resolved KeyStore/controller/RPC/relay snapshot.
- `packages/integrations/src/altana/erc8183.ts`: testnet-only network gate and
  SDK-derived contract configuration.
- `packages/integrations/src/altana/index.ts`: adapter extension point, but its
  DTOs need to become SDK-compatible.
- `packages/config/src/env.ts`: server-only env validation.

### Missing

- Custody and user ownership model.
- Concrete wallet service and wallet persistence.
- Authentication proving the requesting user controls the admin signer.
- Separation between historical operator EOA scripts and the new session flow.

## Requirement 2 - `grantSession`

### Exact API

```ts
const session: Session = await client.grantSession({
  wallet,
  signer: adminSigner,
  chainId: 97,
  permissions,
  expiry,
  sessionSigner,
  register: false,
});
```

Declaration:

```ts
type ClientGrantSessionOptions = {
  wallet: Wallet;
  signer: Signer;
  feeToken?: Address;
} & GrantSessionOptions & { chainId?: number };

type GrantSessionOptions = {
  permissions: SessionPermissions;
  expiry: number;
  sessionSigner?: Signer;
  register?: boolean;
};

client.grantSession(opts: ClientGrantSessionOptions): Promise<Session>;
```

`Session` returned by SDK 0.7.0:

```ts
  walletAddress: Address;
  signer: Signer;
  publicKey: Hex;
  permissions: SessionPermissions;
  expiry: number;
};
```

### Behavior and transaction boundary

- The admin signer authorizes the session on-chain through the Altana relay.
- `grantSession` defaults `register` to `true`, which batches session-key
  registration in KeyStore with the authorization.
- For an auditable dependency sequence, use `register: false` first, then call
  `client.registerSessionKey` as Phase 3. This creates an account authorization
  phase distinct from public registry registration.
- `grantSession` waits for relay confirmation and returns the live session.
- The SDK waits for the session key to become visible through the account's
  `getKeys` read, but that is not the same as public KeyStore registration when
  `register: false` is used.

### Required signer

- `adminSigner`: wallet owner/admin; required to authorize the session.
- `sessionSigner`: optional caller-supplied `Signer`; if omitted, SDK generates
  a fresh secp256k1 signer via `createPrivateKeySigner` and returns it in the
  `Session` object.
- For a server agent, generate once with `createPrivateKeySigner()` and persist
  the raw key through an application-controlled encrypted secret store. The SDK
  does not persist keys.

### Missing implementation

- Change `CreateSessionInput` from generic `SpendCap` strings to explicit SDK
  permissions, expiry, wallet, agent, and chain fields.
- Generate/persist/reconstruct the session signer without exposing it to the
  browser.
- Add idempotency and state transitions around relay `callsId` and status.
- Ensure calls are default-deny: do not omit `permissions.calls`.

## Requirement 3 - Target + Function-Selector Allowlist

### Exact SDK type

```ts
  | { signature: string; to: Address }
  | { signature: string }
  | { to: Address };

type SessionPermissions = {
  calls?: readonly CallPermission[];
  spend?: readonly SpendPermission[];
};
```

### Selector distinction

The public SDK input is a human-readable ABI function signature, for example:

```ts
{ to: commerce, signature: "approve(address,uint256)" }
```

The Porto relay conversion accepts either a hex string or an ABI signature. Its
installed source calls `AbiFunction.getSelector(signature)` when the string is
not hex, and emits a selector plus target to the relay permission. Therefore:

- use canonical signatures in application policy;
- derive the expected four-byte selector using viem/`AbiFunction` for review;
- validate each call's `data.slice(0, 10)` against the derived selector before
  execution;
- never treat a target-only rule as selector-restricted;
- never omit `permissions.calls`, because omission means all targets/selectors.

The SDK 0.7.0 public type does not define a separate raw selector field. A raw
`0x12345678` string is accepted by the internal Porto conversion, but the
application should use canonical ABI signatures and test the conversion rather
than inventing a new permission shape.

### Contract/config source

Use `resolveErc8183Config(97)` and its SDK-derived address table for ERC-8183:

- `commerce`
- `router`
- `policy`
- `registry`
- `paymentToken`

For any other protocol, use its official SDK/address source. Do not reuse the
stale generic policy address documented in X.29B; job 515's authoritative bound
policy was read from the deployed router/job path.

### Transaction boundary and BNB Testnet

The allowlist itself is encoded into the session authorization transaction made
by `grantSession`. The permitted transaction later uses the relay through
`client.execute`; both are real transaction-capable operations. BNB Testnet is
supported by the SDK relay.

### Reusable code and missing work

- Reuse `prepareErc8183Hire` for pure call construction only.
- Reuse X.25/X.28c/hire.server destination checks as defense-in-depth.
- Add a single pure policy builder that maps approved actions to exact target +
  signature entries and rejects unknown calls.
- Add a pre-execution validator that checks target, selector, value, token, and
  spend estimate against the persisted policy.
- Local allowlists alone are not sufficient; the Altana session validator is the
  required enforcement layer.

## Requirement 4 - Token-Aware Spend Cap

### Exact SDK type

```ts
  limit: bigint;
  period: "minute" | "hour" | "day" | "week" | "month" | "year";
  token?: Address;
};
```

Examples:

```ts
const spend: SpendPermission[] = [
  { limit: 1_000_000_000_000_000_000n, period: "day", token: paymentToken },
];
```

- `token` omitted means the native token according to the SDK/Porto schema.
- ERC-20/BEP-20 limits are smallest raw units, not display units.
- `$U` on BNB Testnet is the SDK/ERC-8183 payment token from
  `resolveErc8183Config(97).paymentToken`; use its official decimals from the
  token registry/config, not a guessed number.
- A lifetime cap is not a native SDK `SpendPermission` field. If the product
  needs both lifetime and rolling-period limits, enforce the lifetime budget in
  the application policy/database in addition to the on-chain rolling cap.

### Transaction boundary

Spend permissions are committed as part of session authorization and enforced
by the Altana account validator. Each subsequent `client.execute` is a real
relay-backed transaction and must be accounted for in the application.

### Missing work

- Replace string `SpendCap` with bigint-safe token/limit/period records.
- Persist raw units as strings/decimal database fields, never JS numbers.
- Add usage accounting, reservation/idempotency, and rejection tests.
- Display token symbol, raw limit, normalized display amount, period, and used
  amount in the product.

## Requirement 5 - Expiry

### Exact API

```ts
const expiry = Math.floor(Date.now() / 1000) + 60 * 60;
await client.grantSession({ ..., expiry });
```

- `expiry` is an absolute Unix timestamp in seconds.
- `Session.expiry` returns that same numeric value.
- KeyStore registration accepts the same expiry as `uint40`.
- `0` means non-expiring at the KeyStore encoding layer; this track must never
  grant an unlimited session, so the application must require a bounded future
  expiry.

### Transaction boundary and BNB Testnet

Expiry is part of the on-chain session authorization and, when registered,
KeyStore entry. No separate expiry transaction is needed. The validator rejects
session use after expiry; `isValidKey` also reports the current KeyStore validity
for registered keys.

### Missing work

- Choose and validate a maximum duration policy.
- Store both raw epoch seconds and a display timestamp.
- Reconcile local status (`active`/`expired`/`revoked`) with on-chain reads.
- Add boundary tests for now, expiry-1, expiry, and expiry+1.

## Requirement 6 - Keystore Registration

### Exact API

```ts
const result = await client.registerSessionKey({
  wallet,
  signer: adminSigner,
  session,
  chainId: 97,
});
```

Declaration:

```ts
  | { alreadyRegistered: true }
  | ({ alreadyRegistered: false } & ExecuteResult);

type ExecuteResult = {
  callsId: Hex;
  transactionHash?: Hex;
  status: "PENDING" | "CONFIRMED" | "FAILED";
};
```

### Behavior and signer

- Requires `wallet`, the admin signer, and the full `Session` object.
- Internally derives `keyId = keccak256(session.publicKey)`.
- Reads active validity first; if already valid, returns without a transaction.
- Otherwise pays the current registration fee through the SDK controller and
  submits the registration intent through the testnet relay.
- The registration entry carries the session public key and expiry.
- Required signer: admin signer, not the session signer.

### Address/config source

Use `BNB_TESTNET.keyStore` and `BNB_TESTNET.keyStoreController` from the SDK,
or the same values returned by existing `resolveConfig`. Do not hardcode a new
address table.

### Missing work

- Persist `keyId`, callsId, tx hash, status, KeyStore address, expiry, and
  verification time.
- Keep the session authorization and public registration states separate.
- Do not import `dist/internal/keystore` in application code: those helpers are
  not public exports. Use the public `registerSessionKey` method and a local
  minimal read ABI for public verification, or obtain an officially supported
  public read API before implementation.

## Requirement 7 - Keystore Active-Session Verification

### Exact contract reads verified locally

The installed SDK internal source uses the KeyStore contract at
`BNB_TESTNET.keyStore` with:

```solidity
function getKeys(address user) view returns (bytes32[]);
function getPublicKey(address user, bytes32 keyId) view returns (bytes);
function isValidKey(address user, bytes32 keyId) view returns (bool);
```

Key convention:

```ts
const keyId = keccak256(session.publicKey);
```

The SDK internal helper signatures are:

```ts
deriveKeyId(publicKey: Hex): Hex;
readActiveKeys(publicClient, network, user): Promise<readonly Hex[]>;
readPublicKey(publicClient, network, user, keyId): Promise<Hex>;
readIsValidKey(publicClient, network, user, keyId): Promise<boolean>;
```

These helpers are in `dist/internal/keystore.*` and are not exported from the
public package index. The implementation must either:

1. use a repository-owned ABI/read wrapper with viem and treat the ABI as an
   explicitly verified contract surface; or
2. confirm with official Altana documentation that a public read helper/export
   is available in the intended SDK version.

### Read-only boundary

Verification is plain `eth_call` through a public RPC and requires no signer,
transaction, or fee. It works on BNB Testnet. It must be run after relay
confirmation and retried for BSC RPC propagation lag, as the SDK's own grant
implementation does.

### Missing work

- Add a read-only `verifySessionKey` service returning keyId, public-key match,
  active validity, expiry, and last checked time.
- Never call a key "active" from local DB state alone.
- Test active, expired, revoked, absent, and stale-RPC cases.

## Requirement 8 - Session-Key Transaction Execution

### Exact API

```ts
const result = await client.execute({
  session,
  chainId: 97,
  calls: [{
    to: target,
    value: 0n,
    data: calldata,
  }],
});
```

Declaration:

```ts
type ClientExecuteOptions =
  | { wallet: Wallet; signer: Signer; calls: Call | readonly Call[]; ... }
  | { session: Session; calls: Call | readonly Call[]; ... };

client.execute(opts: ClientExecuteOptions): Promise<ExecuteResult>;
```

The session overload signs the relay intent with `session.signer`, includes the
session public key, expiry, and permissions in the relay key descriptor, and
submits through `https://testnet-relay.altana.network`. The transaction is
genuine when the returned result is `CONFIRMED` with a transaction hash and the
receipt/state evidence identifies the Altana wallet call.

### Direct EOA distinction

These existing scripts are **not** session execution:

- X.23 `registration-execution.x23.ts`: `privateKeyToAccount` + direct
  `walletClient.sendTransaction`.
- X.26 `erc8183.job.creation.x26.ts`: direct EOA sequential writes.
- X.28c `erc8183.job515.funding.execute.x28c.ts`: direct EOA approval/funding.
- X.30 `erc8183.job515.submission.execute.x30.ts`: direct EOA submission.
- X.32 `erc8183.job515.settlement.execute.x32.ts`: direct EOA settlement.

They prove the provider EOA can operate the deployed contracts. They do not
prove a registered Altana session key can act within a scope.

### Safer qualification action

Do not use Job 515: it is completed and must remain unchanged. Use a new,
explicitly approved testnet-only harmless call against a target that is already
allowed by the session policy, or a new Altana SDK-provided smoke action that
does not create an ERC-8183 job. The exact target/call must be selected from
official Altana testnet documentation before implementation; this repository
does not contain a harmless qualification contract or call.

## Requirement 9 - Session Revocation

### Exact API

```ts
const result = await client.revokeSession({
  wallet,
  signer: adminSigner,
  session: session.publicKey, // Session or Hex public key
  chainId: 97,
});
```

Declaration:

```ts
  wallet: Wallet;
  signer: Signer;
  session: Session | Hex;
  feeToken?: Address;
  chainId?: number;
};

client.revokeSession(opts: ClientRevokeSessionOptions): Promise<ExecuteResult>;
```

### Behavior and transaction boundary

- Requires the admin signer.
- Accepts the full session or only `session.publicKey`.
- The SDK derives `keccak256(publicKey)`, checks whether the KeyStore entry is
  currently valid, and bundles KeyStore revocation when present.
- It also revokes the session key in the Altana account authorization.
- One relay-backed transaction; after confirmation the next session execution
  is expected to fail at validator level.
- Revocation is monotonic in the installed SDK comments and cannot reactivate
  the key.

### Missing work

- Owner-authenticated revoke endpoint and service.
- Idempotent `ACTIVE -> REVOKING -> REVOKED` state machine.
- Persist reason, actor, callsId, tx hash, status, and confirmation time.
- Keep the raw session signer out of the browser and API response.

## Requirement 10 - Post-Revoke Rejection

### Required verification sequence

1. Read `isValidKey(wallet.address, keccak256(session.publicKey)) == true`.
2. Execute an in-scope call with `client.execute({ session, calls })` and record
   a confirmed result.
3. Revoke with `client.revokeSession` and wait for `CONFIRMED`.
4. Read `isValidKey(...) == false`.
5. Attempt the same in-scope call with the same `Session` object.
6. Assert the SDK/relay returns a failed result or throws an authorization
   rejection, according to the exact behavior observed in the official SDK
   version. Do not classify a network timeout as proof of revocation.

No repository code currently implements this sequence. It must be a dedicated,
opt-in chain-97 test and must not touch Agent 1816 or Job 515.

## Requirement 11 - User-Facing Permission / Status UI

### Existing reusable UI

- `apps/web/app/(app)/settings/page.tsx`: current permission placeholder.
- `apps/web/app/(app)/agents/[slug]/agent-detail-view.tsx`: static
  `PERMISSION_ROWS` and pending state.
- `apps/web/app/(app)/compare/compare-view.tsx`: static permission matrix.
- `apps/web/app/(app)/agents/[slug]/hire-review-panel.tsx`: loading, error,
  immutable review, and explicit confirmation interaction patterns.
- `packages/ui/src/components/{table,badge,tabs,modal,alert,button}.tsx`:
  reusable primitives.

### Required UI data

The product must display, from authenticated server DTOs:

- Altana wallet address and associated agent/listing.
- Session public key and derived KeyStore keyId.
- Exact target + canonical signature allowlist.
- Token, raw and display spend limit, period, and tracked usage.
- Absolute expiry and local status.
- Live `isValidKey`/KeyStore status and last verification time.
- Registration/revoke transaction status and explorer link where available.
- Stale/unknown state when the RPC read fails.

Never return admin private keys, session private keys, signer objects,
`ALTANA_TESTNET_PRIVATE_KEY`, raw credentials, or relay secrets.

### Missing product infrastructure

- Wallet authentication and user ownership middleware.
- Prisma models for users, wallets, sessions, permissions, operations, and
  audit events; `prisma/schema.prisma` is currently model-free.
- `GET /api/sessions`, `GET /api/sessions/:id`, and
  `POST /api/sessions/:id/revoke` or equivalent server actions.
- Permission page/route and navigation entry.
- Real status/error/revoke states replacing pending placeholders.

## Existing Environment And Address Matrix

| Need | Current source | X.35 decision |
|---|---|---|
| SDK package | `packages/integrations/package.json` | Keep `@altananetwork/sdk` 0.7.0 |
| Network | `BNB_TESTNET` in SDK; `createAltanaClient` | Chain 97 only |
| RPC | SDK default / `ALTANA_RPC_URL` | Explicit server-side override only |
| Relay | `BNB_TESTNET.relayUrl` | Use SDK config, no new URL constant |
| KeyStore | `BNB_TESTNET.keyStore` | Use SDK config/read ABI |
| Controller | `BNB_TESTNET.keyStoreController` | Use SDK config |
| Admin signer | `.env.local` `ALTANA_TESTNET_PRIVATE_KEY` today | Custody decision required before use |
| Session signer | none | Generate with `createPrivateKeySigner()` or approved user signer; persist securely |
| ERC-8183 targets | `resolveErc8183Config(97)` | Reuse only for policy/call construction; do not use Job 515 |
| `$U` token | `resolveErc8183Config(97).paymentToken` / official token config | Use raw units and verified decimals |

No new environment variable should be added until the custody and persistence
design is approved. Likely server-only additions are encrypted session-store
configuration, wallet-owner auth configuration, and an explicit testnet gate,
but their names are an implementation decision, not an SDK API.

## Dependency-Ordered Implementation Plan

### PHASE 1 - Wallet

1. Decide between server-held admin signer for an autonomous demo wallet and a
   browser passkey wallet for user-owned custody. Confirm this against official
   Altana custody guidance and judging expectations.
2. Add authenticated user/wallet ownership and persistence.
3. Create the chain-97 client from existing `createAltanaClient` and explicitly
   pass the validated RPC override.
4. Call `signerFromPrivateKey` + `client.createWallet({ signer })` or the
   approved passkey equivalent. No Agent 1816 mutation is required.
5. Store wallet address and signer reference securely. Do not store a raw key
   in Prisma or return it to the browser.

### PHASE 2 - Session Grant

1. Define canonical session policy DTOs with exact targets/signatures, raw
   token limits, periods, and bounded epoch expiry.
2. Generate a dedicated session signer with `createPrivateKeySigner()` or an
   approved signer path.
3. Build `SessionPermissions` with nonempty calls and explicit spend.
4. Call `client.grantSession({ ..., register: false })`.
5. Persist the reconstructable session metadata and encrypted signer material;
   never serialize a signer object directly.

### PHASE 3 - Keystore Registration

1. Derive `keyId = keccak256(session.publicKey)`.
2. Call `client.registerSessionKey({ wallet, signer: adminSigner, session,
   chainId: 97 })`.
3. Persist `callsId`, optional tx hash, status, expiry, and keyId.
4. Read `isValidKey` via a repository-owned read wrapper after confirmation,
   with retry for BSC public-RPC propagation.

### PHASE 4 - Permitted Transaction

1. Select a new harmless chain-97 qualification call; do not use Job 515.
2. Revalidate target, signature/selector, calldata, value, token, and spend
   against the persisted policy.
3. Reconstruct the session and call `client.execute({ session, chainId: 97,
   calls })`.
4. Persist callsId, tx hash, status, call digest, and read-only receipt/state
   evidence.
5. Add negative checks for wrong target, wrong signature, excess value, and
   exhausted spend.

### PHASE 5 - Permission UI

1. Add authenticated session list/detail endpoints and a permissions route.
2. Display exact allowlist, caps/usage, expiry, wallet, keyId, and live
   KeyStore status.
3. Add loading, stale, unavailable, active, expired, and revoked states.
4. Remove or correct marketing claims until the live flow exists.

### PHASE 6 - Revoke

1. Require authenticated owner/admin authority.
2. Show exact wallet, agent, public key, permissions, and expiry in confirmation.
3. Call `client.revokeSession({ session: publicKey, ... })`.
4. Persist operation result and reconcile `isValidKey == false`.
5. Mark local state revoked only after confirmed on-chain result.

### PHASE 7 - Verification / Tests

1. Add offline unit tests for policy construction, canonical signature/selectors,
   raw-unit caps, expiry boundaries, serialization, and secret redaction.
2. Add mocked SDK tests for state transitions, idempotency, and error handling.
3. Add UI/API tests for permission display, stale state, owner checks, revoke,
   and no-secret responses.
4. Add an explicitly opt-in chain-97 E2E lifecycle:
   wallet → grant → register → active read → permitted execute → revoke →
   invalid read → post-revoke rejection.
5. Keep the E2E harness separate from X.23/X.26/X.28c/X.30/X.32 and never
   include it in default CI without deliberately provisioned test credentials.

## Unknowns Requiring Official Confirmation Before Implementation

1. Which custody model the competition accepts as an agent's "own Altana
   wallet": server-held private-key signer, passkey wallet, or both.
2. Whether the qualification transaction may use a no-op/read-like relay call,
   and which official BNB Testnet target is recommended without creating a job.
3. Exact official evidence expected to prove a transaction was signed by the
   session key rather than merely executed by the wallet address.
4. Whether official docs require public KeyStore `getKeys` plus `isValidKey`, or
   a specific verifier/MCP output, for judging.
5. Production-safe persistence/encryption guidance for the returned SDK
   `Session.signer`; the SDK explicitly says it does not persist keys.
6. Exact post-revoke error/status contract for the relay. The SDK docs guarantee
   validator rejection, but this repository has not executed or observed it.
7. Whether the product must support passkey/injected user wallets. SDK 0.7.0's
   public exports expose passkey helpers but not the documented injected signer.

## Prohibited Actions For Implementation Follow-Up

- No mainnet network or address.
- No change to Agent 1816.
- No change to Job 515.
- No reuse of historical direct-EOA transaction scripts as session evidence.
- No transaction without explicit approval for the implementation phase.
- No commit or push unless separately requested.

## Local Quality Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS (exit 0) |
| `pnpm lint` | PASS (exit 0) |
| `pnpm build` | PASS (exit 0) |
| `pnpm test` | PASS (exit 0) |

Only the root workspace's standard local scripts were run. No `altana:x*`,
wallet, session, ERC-8183, signing, or broadcast command was executed.

## Final Report

```text
X.35 STATUS: SPECIFICATION COMPLETE

SDK: @altananetwork/sdk 0.7.0 inspected from installed declarations/source
NETWORK: BNB TESTNET ONLY (chain 97)
WALLET API: client.createWallet / client.createPasskeyWallet
SESSION API: client.grantSession
KEYSTORE API: client.registerSessionKey + verified read ABI (public read helpers are internal-only)
EXECUTION API: client.execute({ session, calls })
REVOKE API: client.revokeSession
DIRECT EOA SCRIPTS: NOT SESSION QUALIFICATION
AGENT 1816 / JOB 515: UNCHANGED
TRANSACTIONS: NONE
SIGNING/BROADCAST: NONE
IMPLEMENTATION: NOT PERFORMED
COMMIT/PUSH: NONE
```

STOP after specification audit.
