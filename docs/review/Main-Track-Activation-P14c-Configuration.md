# MAIN TRACK P14c — Configure BNB Testnet Activation

Date: 2026-08-11

## 1. ERC-8183 Testnet Contract

**VERIFIED** through the installed `@altananetwork/sdk@0.7.0` address table and
the existing testnet read-only verification:

- Network: BNB Smart Chain Testnet.
- Chain ID: `97`.
- Commerce: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`.
- Router: `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`.
- Policy: `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6`.
- Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`.
- Public RPC: `https://bsc-testnet-rpc.publicnode.com`.
- Explorer: `https://testnet.bscscan.com`.

**REPOSITORY FACT:** `prepareErc8183Hire` uses the SDK address table and builds
five ordered calls: create job, register job, set budget, token approval, and
funding. Required job parameters are:

- provider (non-zero ERC-8183 seller address);
- non-empty description, max 4096 bytes;
- positive budget in raw `$U` units;
- future absolute expiry timestamp;
- positive predicted `jobCounter() + 1` job ID.

**REPOSITORY FACT:** these values were not changed. Chain 56 remains rejected.

## 2. `$U` Token

**VERIFIED**

- Name: United Stables.
- Symbol in code: `U` / `$U`.
- Chain: 97.
- Address: `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`.
- Decimals: 18.
- EIP-712 version: `1` in the existing test merchant shape.
- Cross-check: ERC-8183 `paymentToken` equals x402-server `U_TOKEN[97]`.

No token value was changed or substituted.

## 3. Required payTo Semantics

**VERIFIED from installed project dependency contracts:**

**REQUIRED PAYTO TYPE:** the x402 **merchant/seller payout address**, i.e. the
account where payment earnings land.

**REQUIRED PAYTO SOURCE:** a real merchant-controlled payout address supplied
as the verified `MerchantConfig.payTo` value (the project accepts external
server-only conventions `ALTANA_PAYTO`, `X402_PAYTO`, or `MERCHANT_PAYTO`).

Evidence:

- `@altananetwork/x402-server` `MerchantConfig` defines `payTo` as "Where the
  money goes (e.g. the seller's Altana smart account)."
- The package README labels `payTo` as "where earnings land."
- Settlement moves funds directly from payer to `payTo`; the facilitator only
  broadcasts and pays gas.
- The recipient is cryptographically bound in the buyer signature:
  EIP-3009 `authorization.to` or Permit2 witness `to`.
- The marketplace normalizes `payTo` directly from validated merchant config;
  it never derives or defaults it.

**VERIFIED distinctions:**

- `payTo` is **not** the facilitator. `MerchantOptions` explicitly calls the
  facilitator "the settler EOA — broadcasts settlements, pays gas. NOT the
  payTo."
- `payTo` is not automatically the ERC-8183 Commerce/Router/Registry/token.
- `payTo` is not automatically the ERC-8183 provider. The provider is a job
  seller parameter; using the same address for payout would require an
  explicit merchant decision and independent verification.
- `payTo` is not automatically the burner/payer wallet.

**MISSING:** the repository has no real merchant-controlled chain-97 payout
address. Existing payTo constants are explicitly TEST FIXTURE / not real
wallet values and remain prohibited for live use.

## 4. Candidate Facilitator

Candidate supplied for evaluation:

- `https://facilitator.b402.ai`

**EXTERNAL DOCUMENTATION:** b402's current documented hosted base URL is
actually `https://facilitatorv3.b402.ai`, with public `POST /verify`, public
`POST /settle`, and public `GET /health` endpoints.

**UNKNOWN:** direct reads of `facilitator.b402.ai` root, well-known metadata,
and OpenAPI path failed at the transport layer. No payment, verification
payload, or settlement call was sent.

## 5. Facilitator Compatibility

**INCOMPATIBLE for this P14 chain-97 architecture.**

| Requirement         | Existing project                                                                                                                                       | b402 hosted docs                                                                          | Result                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------- |
| Wire/version        | B402/x402 v2 challenge; `X-PAYMENT`; EIP-3009 `$U`                                                                                                     | EOA EIP-712 authorization with `/verify` + `/settle`; x402-related EVM stack              | Partial conceptual overlap   |
| Network             | BNB Testnet, chain 97 (`eip155:97`) only                                                                                                               | BNB **mainnet 56** and Base mainnet 8453                                                  | **Incompatible**             |
| Testnet 97          | Required                                                                                                                                               | Not listed/supported                                                                      | **Incompatible**             |
| Token               | `$U` at chain-97 address                                                                                                                               | BNB mainnet USDT, USDC, USD1 whitelist                                                    | **Incompatible**             |
| Existing settlement | Installed Altana package creates a local merchant with a viem facilitator `Account`, RPC URL, and chain object; package settles token/Permit2 directly | Hosted HTTP relayer with `paymentRequirements.network = "bsc"` and b402 `relayerContract` | **Different contract**       |
| Verify endpoint     | Local `verifyPayment` in current adapter                                                                                                               | `POST https://facilitatorv3.b402.ai/verify`                                               | Not wired                    |
| Settle endpoint     | Local `settlePayment` via facilitator wallet client                                                                                                    | `POST https://facilitatorv3.b402.ai/settle`                                               | Not wired                    |
| Headers/auth        | Existing paid resource uses `X-PAYMENT`; local merchant has no hosted API                                                                              | verify/settle use JSON and `Content-Type`; no API key for public endpoints                | Different serving model      |
| API key             | Existing facilitator requires server-only EOA key (`FACILITATOR_KEY`)                                                                                  | Public verify/settle require no API key; admin deploy operations use `x-admin-api-key`    | Different custody/auth model |

**EXTERNAL DOCUMENTATION:** b402's public docs state its EVM facilitator is
live on Base and BNB mainnet, and its BNB token whitelist contains USDT, USDC,
and USD1. It does not document BNB testnet 97 or this `$U` token.

**REPOSITORY FACT:** adopting the hosted HTTP facilitator would require a new
facilitator adapter and a supported chain/token contract. P14c forbids
changing architecture before compatibility is established.

**Conclusion:** `FACILITATOR: INCOMPATIBLE`. It was not configured.

## 6. Signer Variable

**MISSING**

- Required preferred variable: `ALTANA_TESTNET_PRIVATE_KEY`.
- `.env.local` presence: absent.
- Legacy repository signer candidates: absent.
- `.env.local` is ignored.
- No signer value was read, printed, returned, written to source, or added to
  `.env.example`.

The phase did not create a wallet or substitute the merchant payTo as signer.

## 7. Burner Balance

**UNKNOWN**

- Burner address: unavailable because the signer is missing.
- Wallet chain ID: unavailable because no wallet can be derived.
- Native tBNB balance: unavailable because there is no address to query.

The repository's public RPC configuration is verified for chain 97, but a
general RPC health check is not a burner balance check.

Result: `TESTNET GAS: UNKNOWN`, not `INSUFFICIENT`. No funds were requested or
transferred.

## 8. Missing Items

1. **MISSING:** dedicated BNB-testnet burner signer in
   `ALTANA_TESTNET_PRIVATE_KEY`.
2. **MISSING:** real merchant-controlled chain-97 payTo using an existing
   server-only convention.
3. **MISSING:** a compatible chain-97 facilitator implementation. The existing
   architecture expects a local gas-funded viem facilitator account from
   `FACILITATOR_KEY`; that key is absent.
4. **UNKNOWN:** burner address, tBNB gas balance, and `$U` balance until a
   signer is securely configured.

ERC-8183 contracts and `$U` are not missing.

## 9. Exact Next Action

1. Create/provision a dedicated BNB-testnet-only burner wallet outside the
   repository and place its key only in ignored `.env.local` as
   `ALTANA_TESTNET_PRIVATE_KEY`. This phase did not create one.
2. Choose and independently verify a real merchant/seller payout account for
   chain 97; configure it under one existing payTo convention. Do not use the
   payer by default and do not reuse fixture/contract/token addresses.
3. For the **current architecture**, provision a separate gas-funded BNB
   testnet facilitator EOA under `FACILITATOR_KEY`, then implement only the
   existing package's live MerchantOptions path after a separate review.
4. Do not adopt b402's hosted facilitator for P14: its documented network/token
   support does not include chain 97 or project `$U`.
5. Once signer/payTo/facilitator are configured, derive only the public burner
   address, confirm RPC chain 97, and read tBNB + `$U` balances before any
   transaction review.

---

## FINAL STATUS

- ERC-8183: **FOUND**
- `$U`: **FOUND**
- PAYTO: **MISSING**
- FACILITATOR: **INCOMPATIBLE**
- SIGNER: **MISSING**
- TESTNET GAS: **UNKNOWN**
- CAN PROCEED TO TRANSACTION REVIEW: **NO**
- EXACT BLOCKER: **A real merchant-controlled chain-97 payTo and burner signer
  are missing, and the proposed b402 hosted facilitator supports BNB mainnet
  tokens rather than BNB testnet 97 `$U`, so it cannot be adopted without
  changing the verified architecture.**
