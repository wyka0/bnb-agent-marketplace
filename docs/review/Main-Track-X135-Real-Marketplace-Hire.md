# X.135 Real Marketplace Hire Through User Wallet

**Mode:** First real end-to-end Main Track hire via a user-controlled EIP-1193 wallet. A real BSC Testnet transaction sequence was executed; it **reverted at registerJob** and the flow correctly stopped before fund (no second job, no escrow moved). No submit/settle; Job 622 / Job 641 untouched; no commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. Connected wallet

- User wallet: `0x9F0E4EAaD654333A35cdCb42A1F6B65AF601D20f` (new disposable testnet EOA; distinct from seller `0xB0f7...`, buyer `0x299C...`, prior marketplace client `0xeb23...`).
- Loaded as a Keystore V3 (the simulated browser-wallet storage); the key lives **only** inside the EIP-1193 provider closure (`eth_requestAccounts` / `eth_chainId` / `eth_sendTransaction`). The marketplace adapter/server never receives the key.
- Chain: `97` (`eth_chainId → 0x61`).
- Testnet funding: `0.01 tBNB` + `1.2 U` (transferred from the dedicated buyer wallet; the EIP-7702-delegated buyer required a separate U-transfer round after the in-flight limit).

## 2. Agent 1906 verification

`getAgentInfo(1906)` → `owner == 0xB0f768...` and `agentAddress == 0xB0f768...` — PASS. Seller endpoint (`/health` → `200`; live quick tunnel) and `POST /negotiate` (`200`).

## 3. Quote verification

- Price `1 U` (`1000000000000000000`), currency `0xc70B8741...`, chain `97`, commerce `0xa206c0517...`, expiry future, `provider_sig` + `negotiation_hash` present.
- `verifyQuoteSignature` → `valid:true`, `method:eip191`, `signer == 0xB0f768...` — PASS.

## 4. Real transaction sequence (BSC Testnet)

Plan built via the X.134 user-wallet adapter (`buildMainTrackUserHireCalls`), predicted job id `646`, exact 5-call batch:

| #   | Call        | Target               | Result                              |
| --- | ----------- | -------------------- | ----------------------------------- |
| 1   | createJob   | commerce `0xa206...` | **SUCCESS** (job 646 created, OPEN) |
| 2   | registerJob | router `0xd7d3...`   | **REVERTED `0xc94463e3`**           |
| 3   | setBudget   | commerce             | not sent                            |
| 4   | approve     | token `0xc70B...`    | not sent                            |
| 5   | fund        | commerce             | not sent                            |

Per the milestone's hard rule, the flow **stopped on the revert** — no fund, no second job, no retry.

## 5. On-chain state after the attempt

```text
jobId:       646
client:      0x9F0E4EAaD654333A35cdCb42A1F6B65AF601D20f
provider:    0xB0f7681668f916eEd97dA066D31aA295D34727c0
budget:      0
status:      OPEN (0)
expiredAt:   1787762567
submittedAt: 0
```

**No escrow moved** (`budget == 0`), no approval, no fund. Job 646 is a stranded OPEN artifact (will expire naturally); Job 622 and Job 641 are untouched.

## 6. Root cause of the revert

`registerJob(jobId, policy)` reverted because the plan's **policy address was wrong**: the adapter originally built the batch via `@altananetwork/sdk@0.7.0`'s address table, which returns policy `0x4f4678d4...` — **not** the deployed chain-97 OptimisticPolicy. The authoritative table (official `@bnbagent/sdk`, used by every successful X.126–X.130 job) pins:

- commerce `0xa206c0517...`
- router `0xd7d36d66...`
- **policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`**
- token `0xc70B8741...`

This is precisely the SDK address-table / peer-range mismatch flagged in X.132/X.133.

## 7. Fix applied (read-only, no new transaction)

`main-track-user-wallet.ts` now builds the 5-call batch directly with the **pinned authoritative chain-97 addresses** (`MAIN_TRACK_COMMERCE/ROUTER/POLICY/PAYMENT_TOKEN`) instead of the stale `@altananetwork/sdk` table. Re-verified read-only: the harness now checks the batch targets the correct contracts with the correct policy; **29 checks PASS** (including new per-call failure coverage: createJob / registerJob / setBudget / approve / fund each fail closed with no further calls).

## 8. Security checks

- Server never received the private key (key held only in the EIP-1193 provider closure); no key in `.env`/Vercel/API/db/logs.
- No `ALTANA_TESTNET_PRIVATE_KEY`, no AWS, no seller/buyer/prior-marketplace wallet reuse.
- Model A/X.76, `session-gate`, `consent.commitment` unchanged; Model B = `model-b-v2-commercial-agreement`.
- Every transaction was an in-wallet `eth_sendTransaction`; on revert the flow failed closed (no silent retry, no duplicate job).

## 9. Tests

- `altana:main-track-user-wallet:verify` — **29 checks PASS** (incl. per-call failure for all 5 calls).
- All required suites green: activation 33, hire 23, hire-api 14, capability-source, X.80, X.81, X.49 25, X.55 22, X.84 14, X.85 13, X.127 adapter, X.130 main-track-hire, X.131 main-track-v2 (30), ERC-8183 integration.
- Web + integrations: typecheck, lint, `next build` / build, prettier — PASS.

## 10. Production impact

None — no deploy, no Vercel env change, no credentials, no commit/push. Only the isolated adapter + harness updated.

## 11. Remaining blocker

A **fresh, separately authorized testnet transaction** is required to complete the funded hire now that the stale-policy bug is fixed. The corrected plan (job id = `jobCounter()+1`, registerJob → policy `0xd6a42175...`) is read-only verified and ready.

## Classification

**D — TRANSACTION SAFETY BLOCKED.** The real user-wallet hire was attempted and the safety system correctly stopped it: `registerJob` reverted on a stale policy address (from the `@altananetwork/sdk@0.7.0` table), no fund was sent, no second job was created, and no escrow moved. The root cause was fixed in the adapter and verified read-only (29 checks). A real funded hire now awaits **explicit testnet transaction authorization** for a fresh attempt.

**STOP after the failed-funded attempt.** No submit, no settle, no second job. Job 622 and Job 641 untouched; no commit/push/deploy.
