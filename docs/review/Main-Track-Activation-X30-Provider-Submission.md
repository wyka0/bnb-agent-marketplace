# Main Track Activation — X.30 ERC-8183 Job 515 Provider Submission Execution (BNB Testnet)

**Status:** **PASS** — Job 515 provider submission signed, broadcast, confirmed, and verified (FUNDED → SUBMITTED).
**Date:** 2026-08-14
**Mode:** EXECUTION milestone (operator-authorized; single transaction ONLY).
**Scope:** The provider-side `submit` for ERC-8183 job **515**, exactly as established READ-ONLY by X.29B. One transaction, nothing else.

---

## 1. The calldata-blocker fix (check 10)

The first X.30 run **correctly BLOCKED before signing**: check 10 (calldata == X.29B preview byte-for-byte) failed because the locally assembled hex-literal reference contained a transcription error (a misplaced nibble in the manifest tail fragment).

Fix applied exactly as mandated (no guessing):
1. Authoritative calldata regenerated from the **same deterministic encoder** (viem `encodeFunctionData`, identical `submit(uint256,bytes32,bytes)` ABI, jobId 515, `deliverable = keccak256(manifest)`, `optParams = manifest bytes`).
2. Programmatic diff vs the stale reference (lengths, first differing hex index, expected vs actual byte) — the authoritative value is identical to the X.29B printed calldata, so the reference constant was replaced wholesale with the authoritative string.
3. Runtime diagnostic retained: if the comparison ever fails again, the script prints the exact mismatch (lengths, offset, expected/actual hex) before exiting.

Second run: **19/19 pre-flight checks PASS**, including the byte-for-byte calldata comparison.

---

## 2. Final pre-flight (19/19 PASS, immediately before signing)

| Check | Result |
|---|---|
| 0. Live `eth_chainId` == 97 | PASS |
| 0a/0b. Runtime ERC-8183 config resolves; RPC resolved | PASS |
| 1. commerce proxy impl == verified AgenticCommerce impl `0x153783…` (ERC-1967) | PASS |
| 2. Job 515 exists (id 515) | PASS |
| 3. Job 515 status == FUNDED (1) | PASS |
| 4. Job 515 escrow == exactly 1 U (raw 1e18) | PASS |
| 5. ERC-8004 agent id == 1816 (`registry.ownerOf(1816)` == provider EOA) | PASS |
| 6. `job.provider` == provider EOA `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C` | PASS |
| 7. `router.jobPolicy(515)` == bound policy `0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA` | PASS |
| 8. Bound policy `disputeWindow` == 900s (`voteQuorum` 1) | PASS |
| 9. Current time < `expiredAt` − 900 (now 1786723314 < 1786729595) | PASS |
| 10. Calldata == X.29B deterministic preview **EXACTLY** (byte-for-byte) | PASS |
| 11. deliverable == X.29B verified hash `0xb4e61292…` | PASS |
| 12. Manifest == `{"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}` | PASS |
| 13. Selector == `0x9e63798d` (submit(uint256,bytes32,bytes)) | PASS |
| 14. Commerce not paused; bound `policy.submittedAt(515)` == 0 | PASS |
| 15. Signer derived from env == verified provider EOA | PASS |
| 16. Provider has tBNB for gas (read-only) | PASS |

Final live re-reads immediately before signing: chain 97, job 515 FUNDED, `submittedAt` 0, deliverable zero, gate still open.

---

## 3. Transactions (exactly ONE)

```text
TX HASH: 0xabe4f103682d9c4b383dc537edcdf1668c4629dba0bc8ced36b85eb8f41d13a7
BLOCK:   125059872
BLOCK HASH: 0x8446d20066314bd6c8b7bbb9fd1b88738aa6b3ea4eba1fe415b30f2c4751d9ac
GAS USED: 160599
```

Details verified from the confirmed receipt + transaction:
- `from` == provider EOA `0x299Ce4113abF88F4997737184aa8A7a3D58AC15C`
- `to` == commerce proxy `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` (verified AgenticCommerce)
- `value` == 0
- input decodes to `submit(515, 0xb4e61292…, <102-byte manifest>)` — selector `0x9e63798d`
- Receipt has a **jobId-515-indexed** `JobSubmitted` log on commerce and a **jobId-515-indexed** `JobInitialised(jobId, deliverable, submittedAt, optParams)` log on the bound policy `0xd6a421…`

---

## 4. Post-submission verification

| Check | Result |
|---|---|
| Receipt `status == success` | PASS |
| Job 515 re-read: status **SUBMITTED (2)**, kernel `submittedAt` = 1786723316 (> 0) | PASS |
| Deliverable bytes32 set to the verified hash `0xb4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea` | PASS |
| Submission log jobId-indexed (515) on commerce + bound policy | PASS |

State transition: **FUNDED (1) → SUBMITTED (2)** confirmed from chain.

---

## 5. Mandated final report

```text
X.30 STATUS: PASS
JOB: 515
PREVIOUS STATE: FUNDED (1)
FINAL STATE: SUBMITTED (2)
TX HASH: 0xabe4f103682d9c4b383dc537edcdf1668c4629dba0bc8ced36b85eb8f41d13a7
BLOCK: 125059872
AGENT: 1816
PROVIDER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
DELIVERABLE: 0xb4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea
MANIFEST: {"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

**STOP** — submission complete and verified. No new job created, no re-fund, no approval, no policy change, no Agent 1816 modification, no settlement, no unrelated transaction, BNB mainnet untouched. The next milestone (settlement after the 900s window) is NOT part of this milestone and was NOT started.

---

## 6. Files

- Script: `packages/integrations/src/altana/erc8183.job515.submission.execute.x30.ts`
- Package script: `altana:x30:submit` → `node dist/altana/erc8183.job515.submission.execute.x30.js`
- Run: `pnpm --filter @bnb-marketplace/integrations altana:x30:submit`

---

## 7. Verification suite re-runs after confirmation

| Suite | Result | Note |
|---|---|---|
| X.30 (this milestone) | PASS (19/19 pre-flight; receipt + state + logs verified) | single tx, block 125059872 |
| X.29B ABI review (read-only, post-submission) | 29/31 | sole FAILs = state checks the submission itself changed: `3b` (job now SUBMITTED, not FUNDED) and `4d` (policy `submittedAt(515)` now 1786723316, not 0). All mechanism/binding/calldata checks PASS — expected progression, not a regression. |
| monorepo typecheck / lint / build / test | PASS | re-run after wiring the new script |