# X.157 Real Testnet Hire: Agent 2005

**Mode:** ONE authorized real testnet ERC-8183 Hire attempt against Agent 2005 through the marketplace's production Hire code path, using the LIVE discovered endpoint + LIVE negotiated quote. Outcome: **createJob broadcast was REJECTED by the RPC before mining; the attempt STOPPED per the hard limit. No job, no escrow, no side effects.**

**Git boundary:** `HEAD` = `origin/main` = `850454da…` (unchanged; no commit/push).

---

## Agent 2005 identity

- **Agent ID:** 2005 — "Canned Range Keeper"; chain 97; registered owner `0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a`.
- **Endpoint (on-chain card):** `https://range-keeper.103-195-188-198.sslip.io/erc8183` — resolved, `/health` 200, reachable.

## Live quote + provider signature verification (official SDK)

`POST /negotiate` returned a **fresh** quote: `accepted:true`, `price = 1000000000000000` (**0.001 U** — not assumed, refreshed live), `chain_id:97`, `verifying_contract:0xa206c0517…` (official commerce), `currency:0xc70B8741…` (official $U), future expiry. `verifyQuoteSignature` (official SDK, PublicNode): **valid, eip191, signer == `0x0eAc2F4d…` == registered owner**; chain/commerce/token/expiry all verified.

## Pre-flight (all checks passed)

1–16: connected keystore wallet (user6 `0xb0Dac7297eFD2fE9Ea6F35acc7F8eaE5032060C3`, existing disposable, nonce 0) · address displayed · chain 97 · Agent 2005 resolved · endpoint reachable · `/negotiate` success · quote fresh · providerSig verified · signer == owner · official commerce · official $U · price = live quote (0.001 U) · expiry future · canonical description (`buildJobDescription`) · allowlisted targets · no historical job id (next id 730, not in `{622,641,646,648,649,650,651,652,653}`).

## User confirmation (presented)

```
Agent:     97:0x8004A818…:2005   (Canned Range Keeper)
Agent ID:  2005
Network:   BNB Smart Chain Testnet
Provider:  0x0eAc2F4d… (verified registered owner)
Price:     0.001 U (1000000000000000 wei)
Expiry:    <live expiry>
"This will create and fund an ERC-8183 job using your connected wallet."
```

## Connected wallet + chain

user6 `0xb0Dac7297eFD2fE9Ea6F35acc7F8eaE5032060C3`, chain 97, 0.002 tBNB + 1.2 U. Wallet = EIP-1193 adapter (eth_requestAccounts/eth_chainId/eth_sendTransaction); the keystore wallet owns signing; broadcast through the wallet's own SDK transport. No server private key, no `eth_sendRawTransaction` from a browser path, no `BUYER_PRIVATE_KEY`/`ALTANA_TESTNET_PRIVATE_KEY`/`WALLET_PASSWORD`/seller keystore.

## Execution

The 5-call sequence began with `createJob` (provider `0x0eAc2F4d…`, evaluator/hook router, budget `1000000000000000`, canonical description, chain 97). The wallet broadcast the signed legacy transaction (raw `0xf9042b…`, viem-canonical, valid RLP) through the SDK seed transport.

**`createJob` broadcast was REJECTED by the RPC before mining:**

```
URL: https://data-seed-prebsc-2-s2.binance.org:8545
Details: unmarshal transaction failed
```

Per the HARD LIMIT, the executor **STOPPED immediately** — no retry, no rebroadcast, no second job, no wallet switch. `createJob`, `registerJob`, `setBudget`, `approve`, `fund` were NOT executed (nothing broadcast).

## Final ERC-8183 state (independent read-only verification)

```text
jobCounter = 729   (no job created; next id would have been 730)
user6 nonce = 0    (nothing broadcast)
user6 tBNB  = 0.002  (unchanged)
user6 U     = 1.2    (unchanged)
```

- **client/provider/budget verification:** N/A — no job was created.
- **escrow moved:** NO (0 U).
- **active = false:** N/A (no job); the flow never claimed ACTIVE.
- **security verification:** no secrets, no AWS/KMS, no server key; browser-wallet path unchanged.

## Production URL + git status

Production marketplace: `https://bnb-agent-marketplace-web.vercel.app` (unchanged from X.156). `HEAD`/`origin/main` = `850454da…`; no commit, no push; no `.env`/keystore/wallet/password staged.

## Root cause (documented, not hidden)

The rejection is the **X.148-class broadcast infrastructure behavior**: a viem-canonical, RLP-valid, low-s legacy createJob transaction (here 1067 bytes with Agent 2005's ~770-byte description) was rejected by the SDK seed RPC (`data-seed-prebsc-2-s2.binance.org:8545`) with `unmarshal transaction failed`, and previously by PublicNode with `failed to decode signed transaction` (X.145/X.147) — while near-identical transactions mined historically (Job 653). X.148 classified this as **E — no deterministic defect; unresolved RPC infrastructure behavior**. This milestone is the first authorized live attempt against a real discovered seller; it failed at the same RPC transport gate, safely.

## Classification

**B — FAILED SAFELY BEFORE FUNDING.**

All pre-flight checks passed (live Agent 2005 endpoint + fresh quote + official provider-signature verification + explicit confirmation), and the wallet connected, but the **first transaction (`createJob`) was rejected by the RPC before mining** (`unmarshal transaction failed` on the SDK seed transport) — the same X.148-class infrastructure behavior. Per the ONE-attempt hard limit the flow stopped immediately with **zero side effects** (no job, no escrow, no allowance, user6 nonce 0). No retry, no second job, no rebroadcast. The remaining action for a real funded hire is the X.148-class RPC infrastructure resolution (separate, authorized). **STOP.**
