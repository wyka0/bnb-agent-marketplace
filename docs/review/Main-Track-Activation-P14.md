# MAIN TRACK P14 — Real BNB Testnet Activation

Date: 2026-08-11

## 1. Objective

Implement and verify one end-to-end marketplace activation on BNB Smart Chain
Testnet (chain 97) using the existing Altana x402 and ERC-8183 architecture.

**BLOCKED:** live prerequisites are not configured. The phase stopped before
wallet derivation, balance lookup, transaction review approval, signing, or
broadcast. No testnet transaction was submitted.

## 2. Testnet Configuration

**VERIFIED**

- Network: BNB Smart Chain Testnet.
- Chain ID: 97.
- SDK `BNB_TESTNET.chainId`: 97.
- Verified SDK RPC configuration exists.
- No RPC override is configured locally.
- `getX402Network(97)` accepts chain 97.
- Chain 56 and all non-97 chains are rejected by P14 and the existing x402 /
  ERC-8183 guards; no network switching exists.

## 3. Wallet Configuration

**BLOCKED**

- `.env.local` is ignored by `.gitignore` (`.env*.local`).
- `ALTANA_TESTNET_PRIVATE_KEY`: absent.
- Existing legacy signer variable names: absent.
- No wallet was generated or created.
- Wallet address: UNKNOWN / unavailable because no signer is configured.
- Wallet chain: not queried because no signer exists.
- Wallet testnet BNB balance: not queried because no signer exists.
- Testnet signer: **NOT CONFIGURED**.

No private-key value was read, printed, returned, documented, or sent to the
browser.

## 4. Chain Guard

**IMPLEMENTED / VERIFIED**

The P14 verifier adds an explicit `chainId === 97` assertion and reuses:

- `getX402Network` (testnet 97 only);
- `getErc8183Addresses` / `prepareErc8183Hire` (testnet 97 only);
- SDK `BNB_TESTNET`.

Offline tests prove chain 97 accepted, chain 56 rejected, ERC-8183 mainnet
addresses rejected, and no silent substitution.

## 5. Activation Architecture

**IMPLEMENTED OFFLINE / LIVE BLOCKED**

The smallest existing architecture is:

```text
marketplace service identity
  -> configured x402 payment requirement
  -> server-side payment verification
  -> ERC-8183 five-call hire draft
     createJob / registerJob / setBudget / approve / fund
  -> local testnet signing authority
  -> chain-97 broadcast
  -> independently confirmed receipt / job state
```

The existing fixture marketplace agents and fixture merchant recipient are
explicitly NOT live data and cannot be used for a funded activation.

## 6. Payment Requirement

**OFFLINE VERIFIED / LIVE BLOCKED**

- Network: BNB testnet, chain 97.
- Rail: EIP-3009.
- Token: official testnet `$U` (`United Stables`) from the Altana registry.
- Amount: derived exactly from the merchant configuration in atomic units.
- Fixture payTo: structurally valid for tests but explicitly NOT a real wallet
  and rejected by the P14 live-review guard.
- Real payTo environment configuration: absent.
- Facilitator key: absent.

Therefore no exact live payment review can be produced. P14 status at this
boundary is equivalent to `MISSING TESTNET PAYTO`, with the signer and
facilitator also missing.

## 7. ERC-8183

**TEST FIXTURE / VERIFIED CONSTRUCTION ONLY**

- Existing SDK testnet addresses resolve for commerce, router, policy,
  registry, and payment token.
- `prepareErc8183Hire` constructs the existing verified five-call atomic batch
  on chain 97.
- Provider, description, budget, deadline, and predicted job ID are validated.
- Fixture construction uses labeled non-live values only.
- No ERC-8183 adapter was weakened or changed.
- No ERC-8183 job was submitted.

## 8. Transaction Review

**IMPLEMENTED OFFLINE / LIVE BLOCKED**

The P14 verifier defines an immutable informational review containing:

- network and chain ID;
- from address;
- verified contract destination;
- exact value and token;
- verified function/purpose;
- configured payment recipient;
- estimated gas when available;
- validation state.

It rejects missing/fixture payTo, unknown destination, unknown value/token,
and non-97 chain. It contains no signer or private key.

A live review was not displayed for approval because signer/from address,
balance, real payTo, and facilitator are unavailable. No approval was
requested for an incomplete transaction.

## 9. Signing

**NOT IMPLEMENTED / BLOCKED**

- No signer exists in the secure environment.
- No signing library path was added.
- No raw signature or signed transaction was created or logged.
- No server or browser received a private key.
- Signing stopped before wallet derivation, as required.

## 10. Broadcast

**NOT IMPLEMENTED / BLOCKED**

- No transaction was broadcast.
- No automatic retry exists.
- Transaction hash: none.
- No chain other than 97 was contacted for a write.

## 11. Confirmation

**IMPLEMENTED AS OFFLINE VERDICT RULE / LIVE NOT APPLICABLE**

Fixture tests prove:

- submitted/pending is not success;
- a receipt is required;
- wrong-chain or reverted receipt is failure;
- only chain-97 successful receipt can become confirmed.

No live receipt, block number, event, or contract state exists because no
transaction was submitted.

## 12. Payment Verification

**OFFLINE VERIFIED / LIVE BLOCKED**

- Client claims (`paid`, `paymentVerified`, fake `transactionHash`) remain
  ignored.
- Only the server-side x402 verifier can produce payment-verified state.
- Requirement recipient is derived from merchant config and compared exactly.
- Fixture recipient is rejected for live review.
- No live payer, amount, token settlement, receipt, or tx hash exists.

## 13. Security

**VERIFIED**

- `.env.local` is ignored.
- No signer/facilitator/payTo value exists or was exposed.
- No 64-hex private-key literal in new P14 source.
- No signing, wallet-client, write-contract, transaction-send, or broadcast
  API in new P14 source.
- `.env.example` was not modified and contains no P14 secret variable.
- `.next/static` contains no signer variable, key marker, or wallet signing
  implementation.
- Client cannot access a signer.
- No logs contain a private key, signature, signed transaction, or payment
  credential.

## 14. Offline Tests

**TEST FIXTURE / VERIFIED: 19 passed, 0 failed**

Covered requirements:

1. chain 97 accepted;
2. chain 56 rejected;
3. missing signer rejected;
4. missing payTo rejected;
5. invalid/fixture payTo rejected;
6. insufficient balance rejected;
7. immutable review generated;
8. destination verified;
9. value/token verified;
10. no private-key read/log;
11. client cannot access signer;
12. client payment claims ignored;
13. receipt required;
14. failed receipt rejected;
15. no automatic retry;
16. P14 testnet-only guard;
17. ERC-8183 chain pinned to 97;
18. settlement recipient derived from merchant config.

Additional assertion: unknown recipient cannot produce a valid review.

## 15. Live Test

**BLOCKED — NOT RUN**

The live signing portion stopped before transaction review because:

- `ALTANA_TESTNET_PRIVATE_KEY`: absent;
- funded testnet signer: absent;
- real testnet payTo: absent;
- facilitator key: absent.

Because signer identity is absent, wallet address and testnet BNB balance
cannot be checked. No wallet was created and no funds were requested.

## 16. Transaction Evidence

**NONE**

- Wallet address: unavailable.
- Chain ID for configured architecture: 97.
- Transaction hash: none.
- Block number: none.
- Receipt status: none.
- Activation result: blocked before signing.
- Funds moved: none.

## 17. Regression

**VERIFIED — all requested gates pass**

- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS.
- P14 verifier: 19/19.
- Altana read-only, ERC-8183, skills, x402, x402 testnet, and marketplace x402:
  PASS.
- TermiX package/web: PASS.
- PancakeSwap data/server/UI: PASS.
- Marketplace fixture/live: 83/83 and 14/14.
- Discovery fixture/live: 59/59 and 12/12.

The funded E2E runner was not invoked because secure prerequisites are absent;
the P14 presence check already stopped before signing.

## 18. Remaining Main-Track Work

Before a future separately authorized live test:

1. Configure `ALTANA_TESTNET_PRIVATE_KEY` in ignored `.env.local` with a
   dedicated funded BNB-testnet-only burner wallet.
2. Configure a real testnet merchant payTo (existing accepted convention:
   `ALTANA_PAYTO`, `X402_PAYTO`, or `MERCHANT_PAYTO`).
3. Configure the official facilitator credential required by the existing
   x402-server architecture.
4. Verify the derived wallet address, RPC chain 97, testnet BNB gas balance,
   and `$U` balance without exposing the key.
5. Replace every fixture identity/recipient with independently verified live
   testnet configuration.
6. Produce the exact immutable transaction review and obtain explicit user
   approval before one broadcast.
7. Implement the minimal existing-adapter signing/broadcast path with no
   arbitrary calldata and no retry.
8. Confirm receipt, payment, recipient, amount/token, and ERC-8183 job state
   independently.

---

## FINAL STATUS

MAIN TRACK P14 STATUS:
TESTNET ACTIVATION BLOCKED

- Testnet signer: **NOT CONFIGURED**.
- Real testnet payTo: **NOT CONFIGURED**.
- Facilitator: **NOT CONFIGURED**.
- Chain guard: **VERIFIED, chain 97 only; chain 56 rejected**.
- Offline activation/review tests: **19/19 passed**.
- Transaction: **NONE**.
- Payment/signature/funds moved: **NONE**.
- Security: **PASS**.
- Regression: **PASS**.
