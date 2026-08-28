# X.126B Real ERC-8183 Funded Job

**Mode:** Real BSC Testnet ERC-8183 commercial lifecycle. This milestone used the dedicated buyer Keystore V3 and performed only the authorized buyer-side commerce transactions. No marketplace production activation, seller fulfillment, `submitResult`, `submit`, `settle`, completion claim, commit, push, or deploy was performed.

## Final Classification

- **CREATE JOB:** PASS
- **REGISTER JOB:** PASS
- **SET BUDGET:** PASS (required by the official kernel lifecycle and separately authorized before broadcast)
- **AUTHORIZATION:** PASS — exact approval of `1 U`; no unlimited approval
- **FUND:** PASS
- **ON-CHAIN JOB:** PASS
- **STATUS:** FUNDED
- **OVERALL X.126B:** **A — REAL ERC-8183 FUNDED JOB**

## Parties and Contracts

- Buyer: `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- Seller/provider: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- ERC-8004 Agent ID: `1906`
- Chain: BSC Testnet / `97`
- ERC-8004 registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ERC-8183 commerce: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`
- ERC-8183 router: `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`
- ERC-8183 policy: `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`
- Payment token `$U`: `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`
- Quoted price and funded budget: `1000000000000000000` raw units = `1 U`
- Seller endpoint: `https://flux-management-helps-attended.trycloudflare.com`

## Pre-Transaction Gates

All gates passed before the first write:

- Buyer password-only reload resolved exactly to `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`.
- `BUYER_PRIVATE_KEY` was absent from the process and local buyer environment.
- SDK resolved chain ID `97`.
- SDK resolved the expected chain-97 commerce, router, and policy contracts.
- SDK resolved payment token `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`.
- `ERC8004Agent.getAgentInfo(1906)` returned seller owner and agent address `0xB0f768...`.
- Agent 1906 registered service metadata pointed to the verified seller endpoint.
- Endpoint `/health` returned HTTP `200` with chain `97`.
- Fresh `POST /negotiate` using the official `NegotiationRequest.toDict()` returned an accepted quote.
- Quote price was exactly `1 U`.
- Quote chain was `97`.
- Quote verifying contract was the official commerce contract.
- Quote expiry was future at signing and acceptance.
- `verifyQuoteSignature` returned `valid: true`, method `eip191`, signer equal to the seller.
- `buildJobDescription(quote)` produced a `769`-byte structured description with the SDK-defined quote binding fields, including `negotiation_hash` and `provider_sig`.
- Policy was whitelisted.
- Buyer pre-transaction balances were `0.03140444737482157 tBNB` and `10 U`.
- Initial commerce allowance was `0`.
- Known gas estimate before writes was `0.0000859663 tBNB`; no material native-balance threat was present.

The first request shape was corrected before any write: the seller expects the official request dictionary, so the successful fresh quote used `NegotiationRequest.toDict()`, not the envelope. No failed quote response caused a transaction.

## Job Description

The description was built by the official SDK:

```ts
const description = buildJobDescription(quote);
```

No fields were invented or manually added. Publicly observed description keys were:

- `version`
- `negotiated_at`
- `quote_expires_at`
- `task`
- `terms`
- `price`
- `currency`
- `chain_id`
- `verifying_contract`
- `negotiation_hash`
- `provider_sig`

## On-Chain Transactions

All receipts were independently found on BSC Testnet and returned `status: success`.

| Step          | Transaction                                                          |       Block | Gas used | Public operation                             |
| ------------- | -------------------------------------------------------------------- | ----------: | -------: | -------------------------------------------- |
| `createJob`   | `0xf2cd51f3bac4a4d454f58d1a3b9f5a3e977fc5cba6c657b9c1661105aa410ae4` | `127101076` | `783807` | Created job `622` with seller/provider       |
| `registerJob` | `0x88263c579296861d7bdba3488673a010f35fd34a9a32466f9981286e39e4f994` | `127101083` | `151450` | Registered job `622` with policy `0xd6a4...` |
| `setBudget`   | `0x775b373529daca6358223754c90fff1fab4488e26e7d3a7d80c59fe3d0ca2995` | `127101096` |  `96162` | Set budget to exactly `1 U`                  |
| `approve`     | `0x04f33f0734bc1616342a8e834cb44fdb124590c601516244d54a18a6e5534916` | `127101101` |  `60257` | Approved commerce to spend exactly `1 U`     |
| `fund`        | `0x3afe7a840594a449529f45142832d8540ebb9070a48b2070f3f1c08f659f0e42` | `127101339` | `102529` | Funded job `622` with exactly `1 U`          |

Explorer links:

- `https://testnet.bscscan.com/tx/0xf2cd51f3bac4a4d454f58d1a3b9f5a3e977fc5cba6c657b9c1661105aa410ae4`
- `https://testnet.bscscan.com/tx/0x88263c579296861d7bdba3488673a010f35fd34a9a32466f9981286e39e4f994`
- `https://testnet.bscscan.com/tx/0x775b373529daca6358223754c90fff1fab4488e26e7d3a7d80c59fe3d0ca2995`
- `https://testnet.bscscan.com/tx/0x04f33f0734bc1616342a8e834cb44fdb124590c601516244d54a18a6e5534916`
- `https://testnet.bscscan.com/tx/0x3afe7a840594a449529f45142832d8540ebb9070a48b2070f3f1c08f659f0e42`

### Approval Reconciliation

After the approval receipt, the first immediate SDK allowance read returned below the required amount and the execution script stopped before `fund`. A separate public-chain reconciliation then confirmed:

- Approval receipt status: `success`
- Approval block: `127101101`
- Token approval target: official payment token
- Spender: official commerce contract
- Allowance: exactly `1000000000000000000`
- Allowance sufficient: `true`
- Job `622`: still `OPEN`, budget exactly `1 U`

The authorized `fund` call was then sent once. The SDK observed the exact existing allowance and did not send a second approval.

## Independent Funded-State Verification

A separate read-only verification queried the public chain after funding. Verification block: `127102688`.

`getJob(622)` returned:

```text
id:          622
client:      0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
provider:    0xB0f7681668f916eEd97dA066D31aA295D34727c0
budget:      1000000000000000000
status:      FUNDED (1)
submittedAt: 0
deliverable: 0x0000000000000000000000000000000000000000000000000000000000000000
```

Independent event evidence:

- `JobCreated` identified job `622`, buyer client, and intended seller provider.
- `JobRegistered` bound job `622` to the verified policy.
- `BudgetSet` recorded exactly `1000000000000000000` raw units.
- ERC-20 approval recorded exactly `1000000000000000000` raw units to the commerce contract.
- `JobFunded` recorded job `622` and escrow amount exactly `1000000000000000000` raw units.
- Final status was `FUNDED`.
- Provider binding remained `0xB0f768...`.
- Buyer binding remained `0x299Ce...`.

## Remaining Public Balances

At independent verification block `127102688`:

- Buyer native balance: `0.03134419037482157 tBNB`
- Buyer `$U` balance: `9 U`
- Buyer allowance to commerce: `0 U`
- Seller native balance: `0.03 tBNB`
- Seller `$U` balance: `0 U`

The buyer allowance is zero because the exact `1 U` approval was consumed by funding. The buyer retains `9 U` outside escrow and sufficient tBNB for later separately authorized work.

## Fulfillment Boundary

- `submitResult`: **NOT CALLED**
- ERC-8183 `submit`: **NOT CALLED**
- `settle`: **NOT CALLED**
- Job status is not `SUBMITTED`, `COMPLETED`, or `REJECTED`.
- `submittedAt` is `0`.
- `deliverable` remains all-zero bytes.
- Seller `fundedJobWatcher` was explicitly disabled for this milestone and the seller process was pinned to the seller address, not the buyer address.
- No marketplace `/api/activation/hire` call was made.
- No marketplace activation, session gate, capability source, production files, or production deployment was modified.

This milestone proves a real testnet buyer funded a real ERC-8183 job for the real registered seller at the negotiated exact price. It does not prove service fulfillment or settlement.

**Next milestone:** X.126C — real seller fulfillment → submit result → settle, requiring separate explicit authorization.

No private key, password, mnemonic, seed phrase, or keystore contents are included in this report.
