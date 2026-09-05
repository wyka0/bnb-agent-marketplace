# X.121C Seller Keystore Creation

**Mode:** First-run local Keystore V3 initialization and verification only. No ERC-8004 registration, ERC-8183 publication, endpoint exposure, job, funding, settlement, marketplace change, commit, push, or deployment was performed.

## Results

- Keystore creation: **PASS**
- Seller address: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Address match: **PASS** against expected seller address
- Buyer separation: **PASS** — seller address differs from buyer `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- OnchainOS separation: **PASS** — seller address is not old managed address `0xa636f972efd44cc0221ff4d77c64ca204fa5e30c`
- Chain: `97` — **PASS**
- TBNB balance: `0.03 tBNB` (`30000000000000000` wei)
- Signing capability: **PASS** — official `EVMWalletProvider.signMessage` surface available; no signature was sent or broadcast

## Keystore Verification

The official `@bnbagent/sdk@0.5.1` `EVMWalletProvider` first-run import returned `source: imported`, persisted the encrypted Keystore V3, and reported:

`%USERPROFILE%\\.bnbagent\\wallets\\0xB0f7681668f916eEd97dA066D31aA295D34727c0.json`

The filename matches the derived public address. Keystore contents were not read or printed.

## Password-Only Reload

A fresh process was run after Keystore creation with:

- `WALLET_PASSWORD`: retained locally
- `NETWORK=bsc-testnet`: retained locally
- `PRIVATE_KEY`: absent

Result:

- `source: loaded_keystore`
- Derived address: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- Address match: **PASS**
- Keystore exists: **PASS**
- `PRIVATE_KEY` environment variable: **absent**

Only the `PRIVATE_KEY` line was removed from the gitignored repository-root `.env.local`. `WALLET_PASSWORD`, `NETWORK`, and `ERC8183_SERVICE_PRICE` remain.

## Security Boundaries

- Private key, password, mnemonic, seed phrase, and encrypted keystore contents were never printed.
- No OKX/OnchainOS, TWAK, or Altana wallet provider was used.
- No mainnet was used.
- No transaction or blockchain write was performed.
- No ERC-8004 identity was registered.
- No ERC-8183 job was created or funded.
- No seller endpoint was exposed.
- Marketplace production was not modified.

## Next Step

The dedicated seller wallet is ready for X.122: register the real testnet seller identity and verify the `/negotiate` provider-signature path. Do not use the buyer wallet for seller operations.
