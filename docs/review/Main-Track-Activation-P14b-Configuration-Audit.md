# MAIN TRACK P14b — Existing Testnet Activation Configuration Audit

Date: 2026-08-11

## 1. Objective

Inspect the existing repository, dependencies, local environment variable
names, tests, and documentation to determine whether one real BNB Smart Chain
Testnet activation can be configured without inventing a wallet, recipient,
facilitator, contract, token, or payment amount.

**REPOSITORY FACT:** this was an inspection-only phase. No external service was
called, no failed action was retried, no wallet was derived, and no payment,
signature, settlement, or transaction occurred.

## 2. BSC Testnet Configuration

**VERIFIED**

- Network: BNB Smart Chain Testnet.
- Chain ID: `97`.
- Network identifier accepted by x402: `bnb-testnet`, `bsc-testnet`,
  `eip155:97`, `97`.
- Default RPC from installed Altana SDK:
  `https://bsc-testnet-rpc.publicnode.com`.
- Explorer: `https://testnet.bscscan.com`.
- `ALTANA_NETWORK` is absent locally, so repository default `bnb-testnet`
  applies.
- `ALTANA_RPC_URL` is absent locally, so the SDK public RPC applies.
- Mainnet chain 56 is explicitly rejected by both x402 and ERC-8183 guards.

**Source references:**

- `packages/integrations/src/altana/x402.ts:47-50, 121-140` — x402 chain 97
  constants and accepted/rejected identifiers.
- `packages/integrations/src/altana/client.ts:91-103, 122-142` — SDK network
  selection, testnet default, and client construction.
- `packages/config/src/env.ts:42-60` — server-only Altana env contract and
  testnet-first default.
- `packages/integrations/src/altana/x402.e2e.testnet.verify.ts:127-154` —
  testnet chain/RPC assertions.

## 3. Signer Configuration

**MISSING**

Presence-only local environment results:

| Name                         | Present | Server-only | Purpose                                         |
| ---------------------------- | ------: | ----------: | ----------------------------------------------- |
| `ALTANA_TESTNET_PRIVATE_KEY` |      NO |         YES | P14-preferred dedicated testnet burner signer   |
| `ALTANA_PRIVATE_KEY`         |      NO |         YES | Existing X.4A candidate signer name             |
| `X402_PRIVATE_KEY`           |      NO |         YES | Existing X.4A candidate x402 signer name        |
| `WALLET_PRIVATE_KEY`         |      NO |         YES | Existing X.4A generic wallet signer name        |
| `PRIVATE_KEY`                |      NO |         YES | Existing X.4A generic signer fallback name      |
| `ALTANA_SIGNER`              |      NO |         YES | Existing X.4A external signer/session candidate |
| `SIGNER_KEY`                 |      NO |         YES | Existing X.4A signer-key candidate              |
| `ALTANA_NETWORK`             |      NO |         YES | Altana network selector; defaults to testnet    |
| `ALTANA_RPC_URL`             |      NO |         YES | Optional server-side testnet RPC override       |

**REPOSITORY FACT:** `packages/config/src/env.ts:47-50` explicitly says a
private-key signer variable is not yet part of the validated configuration and
arrives with a later session phase.

**REPOSITORY FACT:** `.env.example` declares only `8004SCAN_API_KEY` and
`PANCAKESWAP_API_KEY`; it does not advertise signer credentials.

**VERIFIED:** `.env.local` is ignored by `.gitignore:14-18`.

**Conclusion:** `TESTNET SIGNER: NOT CONFIGURED`.

## 4. x402 Configuration

**PARTIALLY FOUND / LIVE EXECUTION BLOCKED**

Repository-defined x402 facts:

- **VERIFIED:** chain 97 only (`ALTANA_X402_CHAIN_ID = 97`).
- **VERIFIED:** canonical network `bnb-testnet` / CAIP-compatible
  `eip155:97` parsing.
- **VERIFIED:** payment rail `eip3009` for the testnet fixture merchant.
- **VERIFIED:** payment token `$U` / United Stables, 18 decimals.
- **VERIFIED:** amount format is positive `bigint` atomic token units; the
  marketplace exposes it as a decimal string.
- **VERIFIED:** challenge flow uses official
  `@altananetwork/x402-server`: build challenge -> decode `X-PAYMENT` -> verify
  signature and business constraints -> server-side verdict.
- **VERIFIED:** client claims (`paid`, `paymentVerified`, `transactionHash`)
  are ignored; only the verifier can produce payment-verified.
- **BLOCKED:** no live merchant is constructed and no settlement path is
  configured. `assertX402SellSideBoundary` always stops.

**Source references:**

- `packages/integrations/src/altana/x402.ts:40-78` — official packages,
  token registry, facilitator env name, and sell-side boundary.
- `packages/integrations/src/altana/x402.ts:177-221` — payment-requirement
  parsing.
- `packages/integrations/src/altana/x402.ts:316-403` — merchant validation,
  including chain, payTo, price, rails, timeout, and resource.
- `packages/integrations/src/altana/marketplace.ts:88-147` — normalized
  requirement fields and configured-value-only construction.
- `packages/integrations/src/altana/marketplace.ts:168-227` — authoritative
  server-side payment-verifier result mapping.
- `packages/integrations/src/altana/x402.testnet.ts:94-125` — fixture merchant
  configuration.

## 5. payTo Discovery

**REAL TESTNET PAYTO: NOT FOUND**

| Source                                                                | Variable / constant                          |             Chain | Address present |                 Verified as testnet | Status                                                         |
| --------------------------------------------------------------------- | -------------------------------------------- | ----------------: | --------------: | ----------------------------------: | -------------------------------------------------------------- |
| `packages/integrations/src/altana/x402.testnet.ts:71-80`              | `X402_TESTNET_FIXTURE_PAYTO`                 | 97 fixture config |             YES | Structurally, but not operationally | **TEST FIXTURE — explicitly not a real wallet; unusable live** |
| `packages/integrations/src/altana/marketplace.testnet.ts:35, 146-156` | `MARKETPLACE_TESTNET_PAYTO` alias            | 97 fixture config |             YES |                        Fixture only | **TEST FIXTURE — not live configuration**                      |
| `packages/integrations/src/altana/x402.e2e.testnet.verify.ts:102-109` | `ALTANA_PAYTO`                               |       Intended 97 |              NO |                                  NO | **MISSING environment value**                                  |
| same                                                                  | `X402_PAYTO`                                 |       Intended 97 |              NO |                                  NO | **MISSING environment value**                                  |
| same                                                                  | `MERCHANT_PAYTO`                             |       Intended 97 |              NO |                                  NO | **MISSING environment value**                                  |
| ERC-8183 deployment table                                             | commerce/router/policy/registry/paymentToken |                97 |             YES |                                 YES | **Contract/token addresses, not a merchant payTo**             |

**REPOSITORY FACT:** the fixture's source comment says it is not a real wallet
and no funds may move to it (`x402.testnet.ts:69-77`).

**REPOSITORY FACT:** P14's guard rejects the fixture recipient for live review
(`packages/integrations/src/altana/p14.testnet.verify.ts:51-56, 124-127`).

No mainnet or unknown-chain address was promoted to testnet payTo.

## 6. Facilitator Discovery

**TESTNET FACILITATOR: NOT CONFIGURED**

| Item                  | Result                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| Credential env        | `FACILITATOR_KEY`, absent                                                     |
| `FACILITATOR_URL`     | absent and not used by project code                                           |
| Facilitator URL       | **UNKNOWN / NOT CONFIGURED**                                                  |
| Network / chain       | Intended BNB testnet / 97, but no live config instance exists                 |
| Auth requirement      | viem `Account` derived from server-only facilitator EOA key                   |
| Existing usage        | validation and hard-stop boundary only; merchant not constructed              |
| Testnet compatibility | supported conceptually by official x402-server config; not configured locally |
| Verify endpoint       | none configured                                                               |
| Settle endpoint       | none configured                                                               |

**REPOSITORY FACT:** `x402.ts:406-423` returns
`configured:false`, requiring a gas-only settler EOA from `FACILITATOR_KEY`.

**REPOSITORY FACT:** `x402.ts:467-473` always refuses merchant creation and
settlement while facilitator/payTo/funded-wallet inputs are absent.

**REPOSITORY FACT:** `x402.testnet.ts:128-173` is an in-process keyless
verification fixture, deliberately omitting facilitator, RPC settlement, and
signing. It is not an external/live facilitator.

No external facilitator option is adopted in repository configuration.

## 7. ERC-8183 Discovery

**ERC-8183 TESTNET CONTRACT: FOUND**

- **CHAIN:** 97.
- **DEPLOYMENT:** **VERIFIED** as the address table exported by the installed
  `@altananetwork/sdk@0.7.0`, with prior read-only testnet job reads passing.
- Commerce: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`.
- Router: `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`.
- Policy: `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6`.
- Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`.
- Payment token: `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`.

Job creation architecture:

- `prepareErc8183Hire(BNB_TESTNET, input)` validates provider, description,
  positive budget, future deadline, and predicted positive job ID.
- SDK builds five ordered calls: create job, register job, set budget, approve
  token, and fund job.
- Submission is intentionally absent;
  `assertErc8183SigningBoundary("hire")` always throws.

**Source references:**

- `packages/integrations/src/altana/erc8183.ts:47-55, 138-180` — chain,
  execution boundary, deployment/result types.
- `erc8183.ts:218-258` — chain gate and SDK address resolution.
- `erc8183.ts:287-363` — input validation and hire draft construction.
- `erc8183.ts:517-528` — signing/submission hard stop.
- `packages/integrations/src/altana/erc8183.verify.ts` — contract/address,
  five-call draft, mainnet rejection, signing boundary, and read-only live job
  lifecycle verification.

## 8. Payment Token

**PAYMENT TOKEN: FOUND**

- Name: United Stables.
- Symbol: `$U` / `U` in code.
- Address on chain 97:
  `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`.
- Decimals: 18.
- EIP-712 version: `1` in fixture merchant configuration.
- **VERIFIED:** ERC-8183 `paymentToken` and x402-server `U_TOKEN[97]` resolve
  to the same address.
- **REPOSITORY FACT:** mainnet USDT is explicitly not a chain-97 token option
  (`x402.ts:268-285`).

## 9. Existing Fixtures

**REPOSITORY FACT:** fixtures prove contracts and validation, not live payment
configuration.

- `x402.testnet.ts`: fixture payTo, price, resource, challenge, signature
  verification, replay guard, no facilitator settlement.
- `x402.testnet.verify.ts`: 16 keyless payment-flow assertions; genuine payment
  explicitly blocked.
- `marketplace.testnet.ts`: fixture agent identities, fixture merchant, and
  verifier wiring; never a production listing/payment.
- `marketplace.verify.ts`: server-authoritative verification and ignored
  client claims.
- `x402.e2e.testnet.verify.ts`: presence-only live prerequisites audit; stops
  before signing when signer/facilitator/payTo are absent.
- `p14.testnet.verify.ts`: 19 fixture assertions; rejects fixture payTo for a
  live review and contains no signer/broadcast path.

## 10. Existing Deployment Addresses

| Component                  |                                      Chain | Source                                  | Status                              |
| -------------------------- | -----------------------------------------: | --------------------------------------- | ----------------------------------- |
| ERC-8183 Commerce          |                                         97 | Altana SDK address table                | **VERIFIED**                        |
| ERC-8183 Router            |                                         97 | Altana SDK address table                | **VERIFIED**                        |
| ERC-8183 Policy            |                                         97 | Altana SDK address table                | **VERIFIED**                        |
| ERC-8183 Registry          |                                         97 | Altana SDK address table                | **VERIFIED**                        |
| ERC-8183 / x402 `$U` token |                                         97 | Altana SDK + x402-server token registry | **VERIFIED**                        |
| Permit2                    | Generic canonical contract; exposed by SDK | Testnet adapter surface                 | **FOUND, approval not provisioned** |
| Real merchant payTo        |                                         97 | Environment/config                      | **MISSING**                         |
| Facilitator account/URL    |                                         97 | Environment/config                      | **MISSING**                         |

The deployment addresses establish where an ERC-8183 job would be created;
they do not establish who should receive an x402 merchant payment.

## 11. Security

- **VERIFIED:** environment inspection was presence-only; no value was printed
  or stored in this report.
- **VERIFIED:** all signer, facilitator, and payTo names are server-only; none
  uses `NEXT_PUBLIC_`.
- **VERIFIED:** `.env.local` is ignored.
- **VERIFIED:** `.env.example` contains no wallet/facilitator/payTo secret.
- **REPOSITORY FACT:** web code contains no Altana signer or facilitator
  implementation.
- **REPOSITORY FACT:** x402 merchant/settlement and ERC-8183 submission remain
  hard-stop boundaries.
- No external B402/facilitator option was adopted or called.

## 12. Missing Configuration

Three independent live prerequisites are missing:

1. **MISSING:** funded BNB-testnet signer (`ALTANA_TESTNET_PRIVATE_KEY` or one
   of the repository's legacy X.4A signer inputs).
2. **MISSING:** real chain-97 merchant payTo (`ALTANA_PAYTO`, `X402_PAYTO`, or
   `MERCHANT_PAYTO`).
3. **MISSING:** facilitator account configuration (`FACILITATOR_KEY`); no
   facilitator URL/verify/settle endpoint is configured either.

ERC-8183 testnet contracts and the payment token are not blockers.

**Classification:**

P14b STATUS:
MULTIPLE TESTNET CONFIG ITEMS MISSING

## 13. Exact Next Action

1. Provision a dedicated, funded BNB-testnet-only signer in ignored local
   configuration under `ALTANA_TESTNET_PRIVATE_KEY` (do not add it to
   `.env.example` or browser config).
2. Provision and independently verify a real chain-97 merchant recipient using
   one existing payTo convention.
3. Decide and configure the repository's supported facilitator model: the
   current official package expects a server-side viem facilitator account
   from `FACILITATOR_KEY`; no URL-based facilitator is currently implemented.
4. Only after all three are present, derive the wallet address/balance and
   construct an exact chain-97 transaction review for explicit approval.
5. Do not substitute fixture addresses, ERC-8183 contract addresses, token
   addresses, or mainnet addresses for the missing merchant recipient.

---

## FINAL SUMMARY

- TESTNET CHAIN: **97**
- SIGNER: **NOT CONFIGURED**
- PAYTO: **NOT FOUND**
- FACILITATOR: **NOT FOUND**
- ERC-8183 TESTNET: **FOUND**
- PAYMENT TOKEN: **FOUND**
- CAN GENERATE LIVE TRANSACTION REVIEW: **NO**
- EXACT BLOCKER: **The repository has verified chain-97 ERC-8183 contracts and
  `$U`, but no funded testnet signer, real merchant payTo, or configured
  facilitator; all existing recipients are explicitly test fixtures.**
