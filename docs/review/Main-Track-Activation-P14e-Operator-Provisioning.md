# Main Track - P14e: Operator Testnet Provisioning (Chain 97 / $U / ERC-8183)

**Phase label:** `CONFIG AUDIT + PROVISIONING READINESS REVIEW — READ-ONLY`
**Strict rules honored this phase:** no transaction, no signature, no broadcast, no settle, no approve, no transfer, no ERC-8183 job creation, no MCP execution, no live payment, no mainnet, no Git commit. Presence-only env checks; no private key/seed/mnemonic ever printed, logged, or committed.

---

## 1. REPOSITORY FACT (VERIFIED — code inspection)

- **Existing operator-facing config names** (all read from source, names preserved):
  - Signer: `ALTANA_TESTNET_PRIVATE_KEY`, `ALTANA_PRIVATE_KEY`, `X402_PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, `PRIVATE_KEY`, `ALTANA_SIGNER`, `SIGNER_KEY`.
  - payTo: `ALTANA_PAYTO`, `X402_PAYTO`, `MERCHANT_PAYTO`.
  - Facilitator credential env: `FACILITATOR_KEY` (`X402_FACILITATOR_KEY_ENV` in `x402.ts:56`).
- **`.env.local` (VERIFIED — key names only):** `8004SCAN_API_KEY`, `PANCAKESWAP_API_KEY`. No operator/signer/payTo/facilitator/RPC key present.
- **`.env.example` (CONFIGURED this phase):** now carries `8004SCAN_API_KEY=`, `ALTANA_PAYTO=`, `ALTANA_RPC_URL=`, `ALTANA_TESTNET_PRIVATE_KEY=`, `FACILITATOR_KEY=`, `MERCHANT_PAYTO=`, `PANCAKESWAP_API_KEY=`, `X402_PAYTO=` — all empty placeholders, no values, no hex.
- **`.gitignore` (VERIFIED):** `.env`, `.env.*`, `!.env.example`, `.env*.local` lines 14-18; `git check-ignore -v .env.local` → matched `.gitignore:18`.
- **Secret-leak scans (VERIFIED — CLEAN):**
  - `apps/web/.next/static/**`: no operator env names, no 64-hex private-key pattern.
  - Source + docs (`apps`, `packages`, `docs`, `tests`, `prisma`, minus `node_modules/.next/dist`): only hit is the all-zero 64-hex in `erc8183.verify.ts:103` (fixture zero-hash — benign).
  - `apps/web`: zero `process.env` references to `NEXT_PUBLIC_`/operator names (grep).
  - Live `pnpm lint` + `pnpm typecheck` + build: 12/12 packages clean.
- **Existing chain pinning (VERIFIED):** `getX402Network` accepts `97`/`"97"`/`bnb-testnet`/`bsc-testnet`/`eip155:97`; rejects `56`/`"bnb"`/`"binance"`/`"bsc"`/`eip155:56`/`"0x38"` (`x402.ts:127-141`); `assertErc8183TestnetChainOnly` refuses anything ≠ 97 (`erc8183.ts:219`). No automatic network switching exists anywhere — wrong chain is always a hard error.

## 2. LIVE VERIFIED (read-only probes this phase)

- `eth_chainId` via `https://bsc-testnet-rpc.publicnode.com` → `0x61` = **chain 97, BNB Smart Chain Testnet (VERIFIED)**. Nothing else queried on-chain; no balance reads (no operator address exists yet).

## 3. CONFIGURED (repo reality)

- Chain-97 contract set (from code + P14b/P14d evidence): Commerce `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE`, Router `0xD7d36D66d2F1B608A0F943f722D27e3744f66F25`, Policy `0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6`, Registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, $U `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` (18 decimals, EIP-3009) — the single accepted router configuration (fixture check 10).
- Facilitator boundary: `checkX402Facilitator()` returns `{ configured: false, env: "FACILITATOR_KEY" }` — the adapter never fabricates or auto-generates a settler EOA; `assertX402SellSideBoundary` always throws (fixture check 9).
- Sell-side execution: not-implemented by design (`not-implemented`) until an external operator supplies signer + payTo + facilitator key.
- `.env.example`: operator placeholder names added (empty values only) — Step 11 completed.

## 4. MISSING (operator-side provisioning — proven absent, presence-only)

- **OPERATOR SIGNER: MISSING** — none of the 7 signer env names present (`ALTANA_TESTNET_PRIVATE_KEY` deliberately absent too — P14 check 10).
- **OPERATOR payTo: MISSING** — none of `ALTANA_PAYTO` / `X402_PAYTO` / `MERCHANT_PAYTO` present.
- **FACILITATOR KEY: MISSING** — env `FACILITATOR_KEY` absent.
- **OPERATOR ADDRESS: UNKNOWN** — cannot be derived without a signer; therefore **TESTNET GAS: UNKNOWN** (no address → no balance read; P14d faucet documented but not claimed).

## 5. FIXTURE (checks added this phase — Step 13, 11/11 PASS)

New suite `packages/integrations/src/altana/p14e.operator.provisioning.verify.ts` + script `altana:p14e:operator:verify`:

1. chain-97 accepted by x402 guard, SDK `BNB_TESTNET` preset, ERC-8183 adapter, both `ALTANA_X402_CHAIN_ID` / `ALTANA_ERC8183_CHAIN_ID` = 97 ✅
2. chain-56 and hex `0x38` rejected by x402 + ERC-8183 guards ✅
3. missing operator signer rejected by provisioning review gate ✅
4. signer probe exposes presence-only boolean, never a credential ✅
5. missing operator payTo rejected ✅
6. fixture payTo (`X402_TESTNET_FIXTURE_PAYTO`) rejected as operator payTo; `isNonFixturePayTo` refuses it ✅
7. wrong-chain payTo rejected; zero-address payTo rejected ✅
8. non-$U token on chain 97 rejected (mainnet USDT) ✅
9. missing facilitator config rejected; sell-side boundary always refuses with `X402_SELL_SIDE_REQUIRES_FACILITATOR` ✅
10. valid chain-97 router config accepted — hard-verified against the single official contract set ✅
11. secrets never rendered client-side — no `NEXT_PUBLIC_*` operator keys in env, `.env.example` is placeholder-only, review objects carry presence flags only ✅

- Console baseline (boolean only, safe to run anywhere): signer present NO, payTo present NO, facilitator env `FACILITATOR_KEY` not rendered.

## 6. UNKNOWN

- Operator address, tBNB balance/insufficiency (no signer exists this phase).
- Whether the operator will choose facilitator mode A) self-hosted `FACILITATOR_KEY` EOA or B) permissionless `router.settle`. P14e picks by explicit gate, never both automatically — decision deferred to operator.
- BofAI / any other layer-2 rails — out of scope (P14d UNKNOWN, unchanged).

## 7. INFERENCE

- Activation is **operator-run**: signer, payTo, and facilitator key are all operator-supplied via environment; the repo's guards, fixtures, and boundary errors are the deliverable this phase. In-phase evidence: every suite states the same exact missing-dependency list (e2e suite prints it verbatim).
- Chain 97 + $U + ERC-8183 remain the only permitted rail; nothing in this phase touched or could touch mainnet.

## 8. VERIFICATION SUITES RUN (all VERIFIED — zero failures)

| Suite                                  | Result                                          |
| -------------------------------------- | ----------------------------------------------- |
| `altana:p14e:operator:verify` (new)    | 11/11 PASS                                      |
| `altana:p14:testnet:verify`            | 19/19 PASS, tx NONE, funds NONE                 |
| `altana:x402:testnet:verify`           | 16 PASS; live signing BLOCKED as designed       |
| `altana:x402:verify`                   | all PASS; facilitator `configured=false`        |
| `altana:x402:marketplace:verify`       | 10 PASS                                         |
| `altana:x402:e2e:testnet:verify`       | 8 offline PASS; live payment BLOCKED (expected) |
| `altana:erc8183:verify`                | all PASS; no tx submitted                       |
| `altana:verify` (phase 2)              | all PASS, readonly probe chain 97               |
| `altana:skills:verify`                 | all PASS                                        |
| web `activation:verify`                | 33 PASS                                         |
| web `activation:p13:verify`            | 20 PASS                                         |
| `pnpm lint` / `pnpm typecheck` / build | 12/12 clean (turbo)                             |

## 9. OPERATOR PROVISIONING RUNBOOK (documented; NOT executed this phase)

1. Fund a fresh wallet on BNB testnet: official faucet `https://testnet.bnbchain.org/faucet-smart` (P14d evidence).
2. Export the private key ONLY into the secure environment as `ALTANA_TESTNET_PRIVATE_KEY` (or one of the accepted aliases).
3. Export the facilitator settler EOA key as `FACILITATOR_KEY`.
4. Export a real operator-controlled payTo as `ALTANA_PAYTO` (`X402_PAYTO` / `MERCHANT_PAYTO` accepted); never a fixture payTo.
5. Re-run `altana:p14e:operator:verify` and `altana:x402:e2e:testnet:verify`; both must flip to signer `YES` / payTo `YES` before any transaction review phase.

## 10. FINAL STATUS

```
P14e STATUS: CONFIG AUDIT COMPLETE — OPERATOR PROVISIONING REQUIRED
OPERATOR SIGNER: MISSING
CHAIN: 97 (VERIFIED live, eth_chainId 0x61)
OPERATOR ADDRESS: (none — no signer provisioned)
TESTNET GAS: UNKNOWN (no operator address to read)
PAYTO: MISSING
$U: VERIFIED (0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565, chain 97)
ERC-8183: VERIFIED (Commerce/Router/Policy/Registry + paymentToken pinned to chain 97)
FACILITATOR MODE: MISSING (env FACILITATOR_KEY absent; adapter boundary refuses fabrication)
CAN PROCEED TO TRANSACTION REVIEW: NO
EXACT BLOCKER: No operator credentials exist — signer (ALTANA_TESTNET_PRIVATE_KEY / aliases),
payTo (ALTANA_PAYTO / aliases), and facilitator key (FACILITATOR_KEY) are all absent,
so no operator address or testnet gas can be established.
```

## 11. EXACT BLOCKER

**No operator credentials exist — signer (`ALTANA_TESTNET_PRIVATE_KEY` or aliases), payTo (`ALTANA_PAYTO`/`X402_PAYTO`/`MERCHANT_PAYTO`), and facilitator key (`FACILITATOR_KEY`) are all absent, so no operator address or testnet gas can be established.** Unblocked only by the operator supplying those via the secure environment, then re-running `altana:p14e:operator:verify` and `altana:x402:e2e:testnet:verify`.

## 12. STRICT STOP

Configuration-only phase complete. NO transaction, signature, broadcast, settlement, approval, token transfer, ERC-8183 job creation, MCP execution, live payment, mainnet access, or Git commit occurred or was enabled. `Transaction submitted: NONE. Funds moved: NONE.`
