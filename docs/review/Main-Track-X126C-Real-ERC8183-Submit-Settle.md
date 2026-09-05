# X.126C Real ERC-8183 Fulfillment → Submit → Settle

**Mode:** Real BSC Testnet ERC-8183 fulfillment and settlement for the existing funded job `622`. No new job was created, no additional funding or approval was performed, and no marketplace production change, commit, push, or deploy occurred.

## Final Classification

- **JOB 622 PRE-STATE GATE:** PASS (matched recorded X.126B state: FUNDED, buyer `0x299C...`, provider `0xB0f7...`, budget exactly `1 U`, `submittedAt` 0)
- **FULFILLMENT (submit deliverable):** PASS
- **INDEPENDENT SUBMITTED VERIFICATION:** PASS
- **SETTLE:** PASS (after the `900s` optimistic-policy dispute window; policy verdict `APPROVE`)
- **FINAL ON-CHAIN STATE:** COMPLETED
- **OVERALL X.126C:** **A — REAL ERC-8183 SUBMITTED → SETTLED JOB**

## Parties and Contracts

- Buyer/client: `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- Seller/provider: `0xB0f7681668f916eEd97dA066D31aA295D34727c0`
- ERC-8004 Agent ID: `1906`
- Chain: BSC Testnet / `97`
- ERC-8183 commerce: `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`
- ERC-8183 router: `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`
- ERC-8183 policy: `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`
- Payment token `$U`: `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565`
- Budget: `1000000000000000000` raw = `1 U`
- Dispute window: `900` seconds

## Endpoint Rotation (environment, not on-chain)

The previously registered quick tunnel `flux-management-helps-attended.trycloudflare.com` expired (DNS no longer resolved) between X.126B and X.126C. Per the established workflow, a fresh account-less quick tunnel was started and the isolated seller runtime `ERC8183_AGENT_URL` was updated:

- New public tunnel: `https://ref-been-bought-classification.trycloudflare.com`
- Local seller service: healthy on `http://127.0.0.1:3000` (`/health` → `200`, chain `97`)
- Public `/health` → `200`, chain `97`
- New `GET /job/:id/response` route added to the isolated seller service (serves the stored deliverable manifest for public re-hashing)
- The seller `fundedJobWatcher` remained disabled for the entire milestone; no auto-submission occurred
- The ERC-8004 registration for Agent 1906 was **not** modified (out of X.126C scope); the registered metadata still references the expired tunnel URL, which is recorded here honestly as a known runtime/metadata discrepancy from tunnel rotation

## Pre-Submit Gates

Before any write, the job was re-read on-chain and must (and did) match the recorded X.126B state:

- `id == 622`
- `client == 0x299Ce...`
- `provider == 0xB0f768...`
- `budget == 1000000000000000000`
- `status == FUNDED (1)`
- `submittedAt == 0`
- `expiredAt` in the future with a valid submit deadline (`expiredAt - disputeWindow` still in the future)

The first submit attempt was correctly gated and **did not broadcast**: the SDK `verifyJob` step failed on an `eth_getLogs` limit from the public seed RPC while locating the `JobFunded` block. No transaction was sent (`tx_hash: null`). The script was retried with a public RPC that supports the required log range (`RPC_URL` process override, no code/protocol change); the same strict gates then passed.

## Fulfillment (Deliverable Submit)

The real deliverable was a deterministic grid-strategy analysis report matching the negotiated task ("no trading or transaction execution"), produced as valid JSON with explicit assumptions and no execution claims.

- Submit tx: `0xcf4fcae8f000cbfc2883ed374c5e0d31efbc3fb24a06800f721881c0b7a261db`
- Submit block: `127144344`
- From (provider): `0xb0f7681668f916eed97da066d31aa295d34727c0`
- To (commerce): `0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de`
- Receipt status: `success`
- Deliverable URL: `https://ref-been-bought-classification.trycloudflare.com/job/622/response`
- On-chain deliverable (bytes32): `0x0c52326cf6c1f64d8c173f924c8f41090d61eaced8fb4c0f3a3c9b59f8d3b00c`
- The on-chain `deliverable` equals `DeliverableManifest.manifestHash()` of the uploaded manifest
- A verifier fetch of the public URL re-derived the same hash (`remoteManifestOk: true`), proving the submitted deliverable is complete and publicly re-hashable

Explorer: `https://testnet.bscscan.com/tx/0xcf4fcae8f000cbfc2883ed374c5e0d31efbc3fb24a06800f721881c0b7a261db`

## Independent SUBMITTED Verification

A separate read-only process confirmed:

- `getJob(622)` → `status == SUBMITTED (2)`
- `submittedAt == 1787661400`
- `deliverable == 0x0c52326c...b00c` (matches submitted hash)
- Provider/buyer/budget unchanged
- Public deliverable fetch re-hash matches on-chain deliverable

## Settle

Settlement is permissionless via the Router but the OptimisticPolicy only approves after the dispute window. The script waited until `submittedAt + disputeWindow` (`1787662300`) elapsed, verified the verdict, then settled:

- Policy verdict after window: `APPROVE` (reason `0xcff4b273...`)
- Settle tx: `0xcc8cdbd8269674174e4860a40e28d3f740be9bdfeb7b12a261294a9ad588c41d`
- Settle block: `127146371`
- From (provider): `0xb0f7681668f916eed97da066d31aa295d34727c0`
- To (router): `0xd7d36d66d2f1b608a0f943f722d27e3744f66f25`
- Receipt status: `success`

Explorer: `https://testnet.bscscan.com/tx/0xcc8cdbd8269674174e4860a40e28d3f740be9bdfeb7b12a261294a9ad588c41d`

## Final On-Chain Verification

Independent read-only verification after settle:

```text
jobId:      622
client:     0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
provider:   0xB0f7681668f916eEd97dA066D31aA295D34727c0
budget:     1000000000000000000
status:     COMPLETED (3)
submittedAt: 1787661400
expiredAt:   1787729224
deliverable: 0x0c52326cf6c1f64d8c173f924c8f41090d61eaced8fb4c0f3a3c9b59f8d3b00c
```

- Submit receipt: success (block `127144344`)
- Settle receipt: success (block `127146371`)
- No new job was created (commerce `jobCounter` untouched by this milestone)
- No additional funding or approval occurred
- Buyer allowance to commerce: `0`

## Final Balances (public)

| Address              |                  tBNB | `$U` |
| -------------------- | --------------------: | ---: |
| Buyer `0x299C...`    | `0.03134419037482157` |  `9` |
| Provider `0xB0f7...` |                `0.03` |  `1` |

The escrowed `1 U` was released to the provider in full (platform fee `0`; treasury `0x1001b2C085345f388778A975648aA50bcfd0D134`). Buyer retains `9 U` and unchanged tBNB.

## Boundaries

- No new ERC-8183 job created.
- No additional `createJob`, `registerJob`, `setBudget`, `approve`, or `fund` performed.
- No marketplace `/api/activation/hire`, `session-gate`, `capability-source`, or production file modified.
- No commit, push, or deploy.
- No private key, password, mnemonic, seed phrase, or keystore contents included in this report.

**Next (not automatic):** any marketplace production integration using this verified v2 funded→submitted→completed evidence would require separate explicit authorization.

No private key, password, mnemonic, seed phrase, or keystore contents are included in this report.
