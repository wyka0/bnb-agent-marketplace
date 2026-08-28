# X.136 Real Marketplace Hire Retry (Corrected Chain-97 Policy)

**Mode:** One fresh real Main Track hire using the corrected X.135 plan. `createJob` + `registerJob` succeeded with the corrected policy; `setBudget` was rejected by an RPC nonce race and the flow **stopped** per the hard rule (no fund, no retry, no new job). No submit/settle; 622/641/646 untouched; no commit/push/deploy.

**Git boundary:** `HEAD`/`origin/main` = `850454da8f49f48285c31b8322215e55d37967a0` / `850454da8f49f48285c31b8322215e55d37967a0`.

---

## 1. X.135 Job 646 preserved

Job 646 (created during X.135, `registerJob` reverted, `OPEN`, `budget 0`) was **not** reused, registered, or funded. Confirmed on-chain: `646 OPEN, budget 0`.

## 2. Connected wallet

Same user-controlled EIP-1193 architecture: `0x9F0E4EAaD654333A35cdCb42A1F6B65AF601D20f` (keystore-backed, key only inside the EIP-1193 provider closure). Chain `97`. No server-held key; no seller/buyer reuse; no `ALTANA_TESTNET_PRIVATE_KEY`; no AWS.

## 3. Pre-flight (all PASS)

- Connected address verified; `eth_chainId → 0x61` (97).
- Agent 1906 → owner/agentAddress == seller `0xB0f768...`.
- Seller endpoint `/health` `200`; `/negotiate` `200`.
- Quote: `1 U`, chain `97`, commerce `0xa206c0517...`, expiry future; `verifyQuoteSignature` → `eip191`, signer == seller.
- **Corrected policy pinned**: `MAIN_TRACK_POLICY = 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA`; the `registerJob` calldata was decoded and the embedded policy == `0xd6a42175...` — **NOT** the stale `0x4f4678d4...`.
- All 5 targets allowlisted (commerce/router/token), token == `0xc70B8741...`, provider == seller, budget == `1 U`.
- Predicted job id `648` not in `{622,641,646}`; history guard `["622","641","646"]`.

## 4. Real transaction sequence

| #   | Call            | Target                          | Result                                                   |
| --- | --------------- | ------------------------------- | -------------------------------------------------------- |
| 1   | createJob       | commerce                        | **SUCCESS** → job 648 created                            |
| 2   | registerJob     | router (policy `0xd6a42175...`) | **SUCCESS**                                              |
| 3   | setBudget (1 U) | commerce                        | **REJECTED** — `nonce too low: next nonce 4, tx nonce 3` |
| 4   | approve (1 U)   | token                           | not sent                                                 |
| 5   | fund (1 U)      | commerce                        | not sent                                                 |

**STOPPED** per the milestone hard rule. No retry, no second job.

## 5. Root cause of the setBudget rejection

The corrected **policy fix is confirmed working** (registerJob with `0xd6a42175...` succeeded). The failure was a **nonce-sequencing race in the headless EIP-1193 provider**: `eth_sendTransaction` reads `eth_getTransactionCount` per call; across the rapid sequential sends the account's nonce advanced to `4` (pending/latest), while the `setBudget` transaction was built with nonce `3` and rejected (`next nonce 4`). This is a tooling/executor nonce-management issue, not a protocol or address problem. No funds moved.

## 6. Final on-chain state

```text
jobId:       648
client:      0x9F0E4EAaD654333A35cdCb42A1F6B65AF601D20f  (connected user wallet)
provider:    0xB0f7681668f916eEd97dA066D31aA295D34727c0  (Agent 1906 seller)
budget:      0
status:      OPEN (0)
submittedAt: 0
```

**No escrow moved** (`budget == 0`, no approval, no fund). Job 648 is created + registered but unfunded; it will expire naturally.

Historical jobs confirmed untouched: `622 COMPLETED`, `641 FUNDED (client 0xeb23...)`, `646 OPEN budget 0`.

## 7. Safety checks

- Corrected fail-closed behavior preserved: the flow stopped on the first transaction failure; no duplicate job; no silent retry; no arbitrary calldata; all targets allowlisted; registerJob policy pinned and decoded-verified.
- Server never received the key; no key in `.env`/Vercel/API/db/logs; Model A/X.76, `session-gate`, `capability-source` untouched.

## 8. Tests

Re-run green: `altana:main-track-user-wallet:verify` (29 checks, incl. per-call failures) and `activation:main-track:verify` (30 checks). (All other required suites were green in X.135; no source changed in X.136.)

## 9. Production impact

None — no deploy, no Vercel change, no credentials, no commit/push.

## 10. Remaining blocker

A **robust sequential executor with explicit nonce tracking** (or a user wallet that manages nonces itself, as a real browser wallet does) is required so `setBudget`/`approve`/`fund` are not rejected by a nonce race. With the corrected addresses this is the only remaining technical issue before a funded hire. A fresh, **separately authorized testnet transaction** is required.

## Classification

**B — TRANSACTION FAILED SAFELY.** The corrected policy is confirmed working (`registerJob` with `0xd6a42175...` succeeded); the flow stopped safely on a nonce race at `setBudget` before any approval or fund, with no escrow moved and no duplicate job. A funded hire awaits a separate authorization with a nonce-safe executor.

**STOP.** No submit, no settle, no second job; 622/641/646/648 untouched; no commit/push/deploy.
