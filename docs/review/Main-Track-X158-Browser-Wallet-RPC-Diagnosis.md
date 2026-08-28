# X.158 Browser Wallet RPC Transport Diagnosis

**Mode:** READ-ONLY / source diagnosis. **ZERO blockchain transactions, zero `eth_sendTransaction`/`eth_sendRawTransaction` calls, zero new jobs/wallets, zero Agent 1906 update, zero AWS/KMS, no wallet-credential modification.**

**Git boundary:** `HEAD` = `origin/main` = `850454da…` (unchanged; no commit/push). No source routing defect found, so **no fix and no deploy** were performed (per the mandate's PART 8/9).

---

## 1. Browser wallet implementation (traced)

Production browser Hire path:

```
MainTrackHireView.confirmHire()
  └─ request = (method, params) => ethereum.request({ method, params })   // window.ethereum
  └─ runMainTrackUserHireFromWallet({ request, plan, expectations, confirmStep })
       └─ createMainTrackUserWallet({ request })                          // integrations
            ├─ connect(97)   → eth_requestAccounts + eth_chainId
            └─ sendCall      → eth_sendTransaction  (×5, one per ERC-8183 step)
```

Every chain/RPC call in the browser path:

| Call                                                   | Classification                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `eth_requestAccounts`                                  | **BROWSER WALLET** (read: account list)                                                                       |
| `eth_chainId`                                          | **BROWSER WALLET** (read)                                                                                     |
| `eth_sendTransaction`                                  | **BROWSER WALLET** (write: the connected wallet signs + broadcasts via ITS OWN RPC)                           |
| `/api/activation/main-track-hire` `receipt` (per-step) | **SERVER RPC → PUBLICNODE** (read-only receipt check)                                                         |
| `/api/activation/main-track-hire` `verify` (final)     | **SERVER RPC → PUBLICNODE** (read-only job verification)                                                      |
| `prepareLiveAgentHire` (server)                        | **SERVER RPC → PUBLICNODE** (read-only: tokenURI, jobCounter) + **seller endpoint** (`/negotiate`, `/health`) |

The browser path makes **no** SDK-seed-RPC and no `eth_sendRawTransaction` call.

## 2. Wallet ownership (proven)

- `connect()` uses `eth_requestAccounts` + `eth_chainId`; the connected account is used as `from` in every `eth_sendTransaction` (`from: connectedAddress` — verified in `createMainTrackUserWallet.sendCall`).
- Source-scan of the web Hire path (`main-track-hire-view.tsx`, `main-track-user-hire.ts`, `main-track-negotiation.server.ts`, `main-track-hire.api.ts`, route): **no** `eth_sendRawTransaction(` / `sendRawTransaction(` / `privateKey` / `PRIVATE_KEY` / `BUYER_PRIVATE_KEY` / `ALTANA_TESTNET_PRIVATE_KEY` / `WALLET_PASSWORD`. The application never obtains a private key/mnemonic/seed/keystore.

## 3. Transaction object (without sending)

`sendCall` sends to the EIP-1193 wallet exactly:

```js
{ from: <connectedAccount>, to: <allowlisted target>, data: <validated calldata>, value: "0x0", chainId: "0x61" }
```

It contains **only** `from`, `to`, `data`, `value`, `chainId`. It does **not** supply `nonce`, `gas`, `gasPrice`, `maxFeePerGas`, or `maxPriorityFeePerGas` — the wallet owns those.

## 4. RPC separation

- **nonce / gas / signing / broadcast transport: BROWSER WALLET.** `eth_sendTransaction` hands the object to the connected wallet, which fills nonce/gas, signs, and broadcasts through the wallet's own RPC (e.g. MetaMask's configured RPC).
- **Marketplace constructs only the transaction** (allowlisted targets + validated calldata) and verifies receipts via PublicNode.
- The SDK-seed-RPC path (`createMainTrackHeadlessProvider` with the SDK seed broadcast transport + `eth_sendRawTransaction`) is used **only by headless scripts** (`services/v2-seller/x144-hire.mjs`, `x145-hire.mjs`, `x146-hire.mjs`, `x157-hire-agent2005.ts`) — **never** in the production web app (source-verified: no `createMainTrackHeadlessProvider` reference in `apps/web`).

## 5. Read-only wallet health (documented path)

The browser wallet exposes `eth_chainId` (used in `connect`); balance and transaction-count reads are performed by the marketplace via **PublicNode** (read-only). Expected chain 97. No account secrets are printed anywhere.

## 6. Headless (X.157) vs browser

|                     | X.157 headless failure                                  | Production browser path              |
| ------------------- | ------------------------------------------------------- | ------------------------------------ |
| Broadcast mechanism | `eth_sendRawTransaction`                                | `eth_sendTransaction`                |
| Transport           | SDK seed RPC (`data-seed-prebsc-2-s2.binance.org:8545`) | **the user's connected wallet RPC**  |
| Failure             | `unmarshal transaction failed` (X.148-class)            | **bypasses that transport entirely** |

The X.157 rejection was a **headless-harness artifact** (my script used the SDK seed transport) — it is **not** the production browser path, which delegates broadcast to the user's wallet and its RPC.

## 7. Server route

`/api/activation/main-track-hire`: `prepare` (live negotiation + signature verification, read-only), `receipt` (PublicNode receipt read), `verify` (PublicNode job read) — **no broadcast, no signing, no buyer private-key custody** (source-verified).

## 8. Source routing defect

**None found.** The production browser path correctly delegates broadcasting to the connected EIP-1193 wallet. No change to Model A / Model B / capability-source / session-gate / consent / custody / ERC-8183 addresses / dynamic quote verification was made or needed.

## 9. Production deployment

**Not performed** (no defect to fix).

## Tests (all green)

`main-track-user-hire` (X.149/X.156) · `main-track-v2` (X.131) · `security x49` (25) · `hire` (23/23). Web typecheck / lint / `next build` PASS; integrations typecheck / build PASS; prettier clean. (The X.157 diagnostic script's type annotations were cleaned so the repo typechecks; no behavioral change.)

## 10. Exact remaining action

**A real browser Hire** must be executed by an **authenticated human browser session** on the production marketplace: Agent 2005 → Hire → live quote → confirm → **connect a real EIP-1193 wallet (MetaMask etc.)** → `eth_sendTransaction` (the wallet broadcasts through its own RPC, bypassing the seed RPC entirely) → per-step receipt verification → final on-chain verification → `funded-commercial-hire`. This requires a human-operated browser (or a browser-automation harness with a wallet extension), which is a separate, explicitly-authorized execution milestone.

## Classification

**A — BROWSER WALLET COMPLETELY BYPASSES THE FAILING SEED BROADCAST PATH.**

The production browser Hire path delegates `eth_sendTransaction` to the user's connected EIP-1193 wallet, which owns nonce, gas, signing, and the broadcast transport (its own RPC) — the SDK seed RPC and `eth_sendRawTransaction` are never used in the web path. The X.157 `unmarshal transaction failed` was a headless-harness artifact (SDK seed transport), not the production browser path. No source routing defect exists, so no fix and no deploy were performed. **STOP.**
