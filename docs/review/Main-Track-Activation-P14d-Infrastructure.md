# Main Track — P14d: Official Testnet Payment Infrastructure (Chain 97 / $U / ERC-8183)

Phase: P14d · Inspection-only research · No code changes, no signing, no transactions, no wallet creation, no `/verify` / `/settle` calls.

## 1. REPOSITORY FACT

- Only payTo constants present in the repository are TEST FIXTURES: `X402_TESTNET_FIXTURE_PAYTO` in `packages/integrations/src/altana/x402.testnet.ts` (alias `MARKETPLACE_TESTNET_PAYTO`). Never to be used live.
- No `FACILITATOR_URL` / facilitator endpoint anywhere in the codebase (visible env var set in P14 confirmed absent).
- No signer key present (all names absent, incl. `ALTANA_TESTNET_PRIVATE_KEY` and legacy variants).
- ERC-8183 chain-97 contracts verified live in P14b via `@altananetwork/sdk` table (see P14b report): Commerce `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`, Router `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`, Policy `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6`, Registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, paymentToken $U `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` (18 decimals).
- No hackathon-provided live merchant payTo or hosted facilitator exists anywhere in the repo.

## 2. OFFICIAL DOCUMENTATION (sources fetched this phase)

### Altana (official docs; operator-run seller model)

- BNB Smart Chain Testnet (chain id 97) is the official full-stack testnet: keystore, account contracts, and the Altana testnet relay (`https://testnet-relay.altana.network`) deployed there; SDK ships ready-made `BNB_TESTNET` preset. Official faucet: `https://testnet.bnbchain.org/faucet-smart`. Official testnet keystore: `0x6b8361C29d05D498b1a12B54A37310f94171E94A` (REAL, documented).
- ERC-8183 rail = sell agent services in $U escrow; x402 = buy rail (`docs.altana.network/sdk/erc8183`, `/sdk/x402-server`).
- `@altananetwork/x402-server`: merchant = `createX402Merchant` (self-hosted); `payTo` = own payout EOA bound in signature ("where the money goes"); facilitator = own EOA from `FACILITATOR_KEY`, explicitly "NOT the payTo". No hosted facilitator, no merchant registration portal. Official registration model = merchant self-provisioning.

### BNB Chain — BNB Agent SDK / BNB Agent Studio (`docs.bnbchain.org/developer-kit/bnbagent-sdk/*`, `bnbchain-studio/*`) — REAL official chain-97 deployments

- ERC-8183 stack (`AgenticCommerce` / `EvaluatorRouter` / `OptimisticPolicy` = Commerce / Router / Policy 0x… from P14b) deployed on BSC Testnet chain 97, resolved from network presets (`apex-contracts#deployments`); `ERC8183_*` address overrides exist but defaults are network presets. Confirms the P14b contract set is the official chain-97 economy.
- $U is the official agent-economy token: official statements: agents "get paid in $U", "self-funds $U", "$U transfers are gasless via EIP-3009".
- Seller pattern (official): own encrypted keystore (`bag init`, `WALLET_PASSWORD`, `PRIVATE_KEY` first run), `[wallet].address` / `[provider].address` = the merchant EOA — i.e. the real, official `payTo`-equivalent is an operator-generated wallet address, not a provided one.
- Settlement on the ERC-8183 rail: `router.settle(jobId)` is permissionless — anyone can finalize after the dispute window; no facilitator needed at all for ERC-8183 settlement.
- Testnet gas: tBNB via BSC Testnet Faucet (official). ERC-8004 agent registration on BSC Testnet and Mainnet is GAS-SPONSORED via MegaFuel paymaster (official).

### BNB Chain — MPP SDK (`docs.bnbchain.org/developer-kit/mpp-sdk/*`) — official chain-97 rails, but wrong token/protocol shape

- Official curated preset `(bsc-testnet, TEST_USDT)` — PancakeSwap test USDT on chain 97, plain BEP-20 (no EIP-3009). `RECIPIENT_ADDRESS` (merchant) and `SETTLEMENT_PRIVATE_KEY` (settlement signer) are self-provided; no hosted component.
- Excluded for this activation: token is not $U, rail is MPP intents (not x402 exact), and it still requires operator keys.

### x402 facilitator landscape (official + ecosystem)

- AEON (`facilitator.aeon.xyz`, launched with BNB Chain team, MVB10; `AEON-Project/bnb-x402`): supported networks BSC mainnet 56 (USDT / USDC / TESTU), Base 8453, X Layer 196. NO chain 97, NO $U → INCOMPATIBLE.
- B402 hosted (`https://facilitatorv3.b402.ai`, docs.b402.ai, P14c): BNB mainnet 56 + Base 8453, USDT/USDC/USD1 → INCOMPATIBLE.
- Infra402 (`facilitator.infra402.com`): BNB mainnet focus (xBNB EIP-3009 wrap), no testnet/$U → INCOMPATIBLE.
- x402 Hackathon (`x402hackathon.com`, Dec 8 2025 – Jan 5 2026): no financial prizes; resources = `create-x402`, starter kit, local-or-facilitator settlement; no testnet facilitator product identified.
- OUT OF SCOPE (not in the approved official-source set): BofAI / BANK OF AI (`docs.bankofai.io`, TRON-first, self-hosted facilitator, lists `eip155:97`) → recorded as UNKNOWN, not adopted.

### ERC-8183 official spec (`eips.ethereum.org/EIPS/eip-8183`, `8183.org`, `erc-8183` GitHub org)

- Job escrow (client / provider / evaluator), escrow release on evaluator `complete`, refund on reject/expiry. Reference implementations exist on Base. No facilitator concept: settlement is on-chain and permissionless-capable. No chain-97/$U payment-infrastructure content → irrelevant to the facilitator question, consistent with "no facilitator needed" for escrow settlement.

## 3. LIVE VERIFIED (this phase)

- Nothing new executed: inspection-only. Prior live state carries forward: P13b MCP healthy / action path blocked upstream; P14 offline verifier 19/19; PancakeSwap HTTP 500 recheck.
- Chain-97 addresses remain as verified in P14b (see section 1).

## 4. UNKNOWN

- Existence of any hosted chain-97 facilitator for $U not indexed by official/approved sources (AEON, b402, Infra402, BNB docs, Altana docs all exclude chain 97; none advertised).
- An official published $U testnet merchant payTo address (Altana docs publish seller-side prices only; none published).
- Whether the BNB "Build the Era" marketplace challenge (announced Aug 2026) will introduce hosted payout infrastructure (any payment-facilitator specifics).
- BofAI / BANK OF AI classification (out-of-scope source; TRON-first; self-hosted facilitator; lists eip155:97 with BEP-20 tokens — unverified against $U/EIP-3009).

## 5. INFERENCE

- Official chain-97 testnet payment infrastructure EXISTS and is identical to the P14b-verified set: ERC-8183 escrow contracts + $U (official economy token, EIP-3009 gasless) + official faucet + Altana testnet relay + MegaFuel gas sponsorship for ERC-8004 registration.
- NO official (or found ecosystem) hosted facilitator supports chain 97 + $U. Every hosted facilitator (AEON, b402, Infra402) is mainnet 56/8453/196-only. The official model everywhere is operator-run: merchant generates its own wallet EOA (payTo), key (signer), and either a local facilitator EOA (`FACILITATOR_KEY`) or the permissionless ERC-8183 router (`router.settle`), which needs no facilitator.
- Therefore a real chain-97 activation requires OPERATOR PROVISIONING — wallet + signer (+ tBNB from the official faucet) — plus either a self-hosted chain-97 facilitator or the ERC-8183 settlement rail. Fixture payTo remains forbidden; token stays $U; mainnet facilitators remain out of scope.

## 6. FINAL STATUS

`MAIN TRACK P14d STATUS: OFFICIAL INFRASTRUCTURE FOUND — PAYTO / FACILITATOR / SIGNER ARE OPERATOR-RUN (SELF-PROVISIONED), NOT HOSTED`

| Item                 | Result                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHAIN 97             | VERIFIED — official full-stack testnet (Altana + BNB Agent SDK/Studio presets; ERC-8183 AgenticCommerce/EvaluatorRouter/OptimisticPolicy deployments; relay + faucet documented)                                                                                                                                                                   |
| TOKEN $U             | VERIFIED — `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`, 18 decimals, official agent-economy token; EIP-3009 gasless transfers (official statements)                                                                                                                                                                                               |
| ERC-8183             | VERIFIED — Commerce `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` / Router `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25` / Policy `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6` / Registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`; settlement permissionless                                                                                    |
| PAYTO                | NOT PROVIDED — fixture payTo rejected; official model = operator's own wallet EOA (BNB Agent SDK `bag wallet new` / `[wallet].address`; Altana `createX402Merchant`); no registration portal exists                                                                                                                                                |
| FACILITATOR          | NOT FOUND for chain 97 + $U — AEON (56/8453/196), b402 (56/8453), Infra402 (mainnet) all incompatible; MPP preset TEST_USDT-only; official pattern = self-hosted EOA (`FACILITATOR_KEY`) or no facilitator (permissionless ERC-8183 `router.settle`)                                                                                               |
| SIGNER               | NOT FOUND — all env names absent (`ALTANA_TESTNET_PRIVATE_KEY` etc.); official model = operator keystore/`PRIVATE_KEY`                                                                                                                                                                                                                             |
| NEXT REQUIRED ACTION | Operator provisions a chain-97 wallet (real payTo + signer), funds tBNB from the official faucet (`https://testnet.bnbchain.org/faucet-smart`), and either (a) self-hosts a chain-97 facilitator or (b) uses the ERC-8183 permissionless router settlement rail; then re-runs the P14 live activation flow. Activation remains BLOCKED until then. |

## 7. STRICT STOP

P14d is complete. No transaction, no signing, no payment, no wallet derivation, no code change, no Git operation performed or pending. Next phase proceeds only on explicit user instruction.
