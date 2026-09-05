# X.126A Buyer Keystore

**Mode:** Dedicated disposable buyer Keystore V3 provisioning only. No job creation, funding, submission, settlement, marketplace production change, commit, push, or deployment was performed. No secrets printed or committed.

**Expected Buyer:** `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` / BSC Testnet `97`

**Seller (preserved, separate):** `0xB0f7681668f916eEd97dA066D31aA295D34727c0` / Agent `1906` / chain `97` — not replaced and not used as buyer

## Environment Isolation

- Buyer credentials isolated to `services/v2-buyer/.env.local` (gitignored via `.env*` / `.env*.local`), loaded via `loadEnv(buyerDir)` + `loadEnv(repoRoot)` from official `@bnbagent/sdk@0.5.1`
- Seller credentials remain in `/.env.local` (`WALLET_PASSWORD`, `NETWORK=bsc-testnet`, `ERC8183_SERVICE_PRICE`, `ERC8183_AGENT_URL`) — not overwritten or reused
- `services/v2-buyer/.env.local` initially contained empty placeholders (`BUYER_WALLET_PASSWORD=` / `BUYER_PRIVATE_KEY=`); updated locally with first-run `BUYER_PRIVATE_KEY` then cleared after keystore creation
- No `PRIVATE_KEY`/`WALLET_PASSWORD` printed, logged, or committed

## First-Run Import

Executed via isolated buyer scaffold `services/v2-buyer/buyer-keystore.ts`:

```ts
new EVMWalletProvider({
  password: process.env.BUYER_WALLET_PASSWORD!,
  privateKey: process.env.BUYER_PRIVATE_KEY!,
  address: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
});
```

SDK (`EVMWalletProvider` + Keystore V3 scrypt/AES-128-CTR) returned:

- `buyerAddress: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- `addressMatch: true` (case-insensitive vs expected)
- `source: imported`
- `exists: true`
- `keystore: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C.json`

Keystore V3 verified at `%USERPROFILE%\.bnbagent\wallets\0x299Ce4113abF88F4997737184aa8A7a3D58AC15C.json`.

## Private Key Cleanup

After successful `source == "imported"` and `exists == true`:

- Removed **only** the `BUYER_PRIVATE_KEY=` line from `services/v2-buyer/.env.local` (and from root `.env.local` where it had been mirrored) via file filter `!/^\s*BUYER_PRIVATE_KEY\s*=/`.
- Retained `BUYER_WALLET_PASSWORD` and `NETWORK=bsc-testnet` locally for password-only reloads.

Subsequent loads use password-only; `PRIVATE_KEY` absent verified.

## Password-Only Reload

Fresh process:

```ts
new EVMWalletProvider({
  password: process.env.BUYER_WALLET_PASSWORD!,
  address: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
});
```

Result:

- `buyerAddress: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- `addressMatch: true`
- `source: loaded_keystore`
- `exists: true`
- `keystore: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C.json`
- `PRIVATE_KEY` env absent — **PASS**

## Chain

- `resolveNetwork("bsc-testnet")` + `publicClient.getChainId()` → `97` — **PASS**
- Buyer `chainMatch: true`

## Balance (Public Only)

Read via `createPublicClient({ transport: http(network.rpcUrl) })` on BSC Testnet, no transaction:

- `tbnbWei: 31404447374821570` → `tBNB: 0.03140444737482157`
- `uWei: 10000000000000000000` → `U: 10` (payment token `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`, 18 decimals)

No transfer, approval, or funding transaction was sent.

## Seller/Buyer Separation

- `EVMWalletProvider.listWallets()` → `["0xB0f7681668f916eEd97dA066D31aA295D34727c0", "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C"]` after provisioning — **two distinct keystores**
- Seller `0xB0f7...` ≠ buyer `0x299C...` — **PASS**
- Seller `WALLET_PASSWORD` (root) ≠ buyer `BUYER_WALLET_PASSWORD` (buyer dir) — separate env namespaces
- No reuse of seller wallet, OnchainOS, OKX, or Altana wallet

## Final Classification

- **BUYER KEYSTORE:** **PASS** — `0x299C...json` exists, `source` transitions `imported` → `loaded_keystore`
- **BUYER ADDRESS:** `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- **ADDRESS MATCH:** **PASS**
- **CHAIN 97:** **PASS**
- **PASSWORD-ONLY RELOAD:** **PASS**
- **SELLER/BUYER SEPARATION:** **PASS**
- **TBNB BALANCE:** `0.0314 tBNB` — **PASS** (sufficient for registration/job gas if paymaster not sponsoring; required ~0.02)
- **U BALANCE:** `10 U` — **PASS** (sufficient for 1 U job; required 1 U)
- **FUNDING:** **PASS**

**Overall X.126A: BUYER KEYSTORE READY — FUNDING SUFFICIENT**

No `createJob`, `registerJob`, `approve`, `fund`, `FUNDED`, `submit`, `settle`, marketplace production, `capability-source`, commit, push, or deploy was performed. Next: **X.126B — REAL ERC-8183 createJob → registerJob → fund** (buyer `0x299C...` → seller `0xB0f7...` on chain 97, `1 U`, `verifyQuoteSignature`-bound description).

No private key, password, mnemonic, seed phrase, or keystore contents were printed or committed.
