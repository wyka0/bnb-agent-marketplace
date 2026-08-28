# X.134 Main Track Hire Without AWS — User-Controlled Wallet

**Mode:** Implementation + isolated tests (mock EIP-1193 wallet; no real transaction). No new ERC-8183 job, no submit/settle of Job 641, no AWS, no server-held key, no deploy/commit/push.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. SDK support for a user-controlled signer

Audited the installed `@bnbagent/sdk@0.5.1`:

- `WalletProvider` is an abstract seam with `signTransaction` / `signMessage` / `signTypedData` (defaults raise `UnsupportedWalletOperation`) and **`makeExecutor(context)` returning an `IntentExecutor`** — explicitly designed for **self-broadcasting wallets** (the SDK's own Altana/TWAK wallets override it; they declare `broadcast.self` / `intents.erc8183` and never `sign.*`).
- `ERC8183Client` accepts any `WalletProvider`; all ERC-8183 writes flow through `executeIntent(intent)`.
- **No EIP-1193/browser wallet provider ships in the SDK** (grep: no `eip1193`/`window.ethereum`/wagmi). `AltanaSignerType` includes `"injected"` but only for the Altana SDK's internal signer, and `serializeSession` rejects injected/passkey signers.
- Conclusion: the SDK supports a user-controlled signer via the **`WalletProvider.makeExecutor` self-broadcasting seam**, using the browser wallet's `eth_sendTransaction` (each call approved in-wallet). `EVMWalletProvider` itself is a local-keystore wallet and is **not** used (no server key).

## 2. Implementation

`packages/integrations/src/altana/v2/main-track-user-wallet.ts` (browser-safe, injected I/O, no AWS, no key material):

- `Eip1193Request` seam (`window.ethereum.request` shape).
- `buildMainTrackUserHireCalls(...)` — builds the **exact 5-call ERC-8183 batch** (`createJob → registerJob → setBudget → approve → fund`) for chain 97 from the official `prepareErc8183Hire` / address table, binding the verified description, provider, `1 U` budget, expiry, and predicted job id.
- `validateMainTrackUserHirePlan(...)` — fails closed on wrong chain, wrong provider, wrong price, malformed calls, or any **non-allowlisted ERC-8183 target** (commerce/router/policy/token).
- `createMainTrackUserWallet({ request })` — a structural `WalletProvider`-shaped self-broadcasting signer: `connect` (eth_requestAccounts + eth_chainId) and `sendCall` (`eth_sendTransaction` per call). **No `sign.*`**, matching the SDK self-broadcasting convention.
- `runMainTrackUserHire(...)` — orchestrates: explicit `confirmed` gate → quote-expiry gate → connect wallet → plan client/address match → plan validation → history (622/641) guard → send each call (each approved in the user's wallet; any rejection → fail closed) → read job → verify **FUNDED** + client/provider/budget → returns `active:false`, `activationState:"funded-commercial-hire"`, real job id + tx hashes.

The **server never sees, receives, or stores a private key**; the marketplace only authenticates, negotiates, verifies the quote, builds the verified plan, and reads back the funded job. `FUNDED` is commercial escrow, never `ACTIVE`.

## 3. User experience

Hire modal (server-provided verified review): Agent 1906 · Provider `0xB0f768...` · Network BSC Testnet · Price `1 U` · Quote Verified → `[Confirm Hire]`. After confirmation the user's wallet connects and **every transaction is approved in-wallet**: Connect wallet → Verify wallet → Quote verified → Create job → Register job → Set budget → Approve 1 U → Fund → **FUNDED** (real job ID + tx hashes). No silent signing; rejections surface as honest failure states.

## 4. Security

- No server-side key, no key in Vercel/.env, no key sent to the API, no `ALTANA_TESTNET_PRIVATE_KEY`, no AWS, no seller/buyer/old-marketplace wallet reuse. The browser wallet is authoritative.
- Model A (X.76), `capability-source`, `session-gate`, `consent.commitment`, and the Altana execution path are untouched. Model B = verified V2 commercial agreement + user-authorized ERC-8183 funding.

## 5. Tests

New: `altana:main-track-user-wallet:verify` (packages/integrations) — **24 checks PASS** with a mock EIP-1193 provider + fake on-chain read: no connected wallet; wrong wallet; wrong chain; user rejects transaction; wrong ERC-8183 contract; wrong token target; wrong provider; wrong price; expired quote; missing confirmation; successful funded; FUNDED ≠ ACTIVE; real job id + tx evidence; no private key in request/response; wallet sends only `to/data/chainId` via `eth_*`; Job 622 and Job 641 history-only; structural wallet checks.

All required suites green: activation 33, hire 23, hire-api 14, capability-source, X.80, X.81, X.49 25, X.55 22, X.84 14, X.85 13, X.127 adapter, X.130 main-track-hire, X.131 main-track-v2 (30), ERC-8183 integration. Typecheck + lint + `next build` (web) and typecheck + lint + build (integrations) PASS; prettier PASS. Model A unchanged (capability-source `null` without provider; X.131 harness asserts it).

## 6. Transaction boundary

No real transaction was broadcast in X.134. The user-wallet path was implemented and tested with **mocks / read-only transaction preparation**. Per the milestone, before any real Main Track testnet transaction:

> **READY FOR EXPLICIT TESTNET TRANSACTION AUTHORIZATION**

Any real execution requires: the user connects a BSC-testnet wallet in the UI, the server builds the verified plan, the user confirms, and the wallet approves each of the 5 ERC-8183 calls. This is a separate, explicitly authorized step.

## 7. Production impact

None — no deploy, no Vercel env change, no AWS, no credentials, no commit/push. Only isolated source added (`main-track-user-wallet.ts` + verify) and exported; no production behavior wired.

## Classification

**A — USER-CONTROLLED HIRE PATH IMPLEMENTED.** The Main Track Hire can be funded by a user-controlled browser wallet via the official SDK `WalletProvider` self-broadcasting seam, with no AWS and no server-held key. Fully tested (mocks/read-only). **No real transaction was broadcast**; a real testnet execution is gated on explicit authorization.

No private key, mnemonic, seed, password, or keystore contents are included in this report.
