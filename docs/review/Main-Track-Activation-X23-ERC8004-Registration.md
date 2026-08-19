# Main Track Activation X.23: ERC-8004 Registration (Executed)

**Date:** 2026-08-13
**Mode:** Operator-authorized ERC-8004 registration execution
**Network:** BNB Smart Chain Testnet, chain 97
**Source of truth:** X.22 registration approval review (all values pinned to it)

## Outcome

X.23 **REGISTRATION: PASS**. The verified provider EOA signed and broadcast the
exact X.20/X.22 `register(string agentURI)` calldata against the verified
ERC-8004 registry on chain 97. The transaction was confirmed, the registry
assigned **Agent ID 1816**, and the registration was independently verified
on-chain (owner, agent URI, registry state) and through 8004scan.

Security rules were strictly observed: the provider private key and 8004scan API
key were loaded only from the server/local secret environment and never printed,
echoed, logged, or committed. No secret is in source code. BNB mainnet (chain
56) was refused. No ERC-8183 job, no payment, no settlement, and no unrelated
transaction was created. Execution stopped after registration verification.

## Pre-Sign Safety Checks (all 13 PASS — nothing was signed otherwise)

```text
PASS live chainId == 97
PASS preview chainId == 97
PASS current chain is still 97
PASS registry bytecode present
PASS provider address == verified provider EOA
PASS provider is an EOA (empty bytecode)
PASS metadata URL responds over HTTPS (HTTP 200)
PASS calldata decodes to exact canonical metadata URI
PASS calldata hash equals X.22 constant
PASS transaction target == verified registry
PASS transaction value == 0
PASS provider private key present (presence only)
PASS derived signer address == verified provider EOA
X.23 pre-sign checks: 13/13 passed
```

## Published Transaction

```text
TRANSACTION HASH: 0xba7f8e611fb61ca9280fd5005ea66a32c9d1041ecb4b210ebc16e9e23f265a83
BLOCK NUMBER:     124869834
BLOCK HASH:       0x009956ec4042f157a853356c14e3b8ea1b21db2893d2073a09970c788aad66b9
STATUS:           success
FROM:             0x299ce4113abf88f4997737184aa8a7a3d58ac15c  (provider EOA)
TO:               0x8004a818bfb912233c491871b3d84c89a494bd9e  (verified registry)
```

## Registered Agent (from the ERC-8004 `Registered` event in the receipt)

```text
AGENT ID:            1816
REGISTERED OWNER:    0x299Ce4113abF88F4997737184aa8A7a3D58AC15C  (provider EOA)
REGISTERED AGENT URI: https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
```

## On-Chain Verification (independent read-only re-check)

```text
tx status:      success (block 124869834)
caller (from):  0x299ce4113abf88f4997737184aa8a7a3d58ac15c
target (to):    0x8004a818bfb912233c491871b3d84c89a494bd9e
ownerOf(1816):  0x299Ce4113abF88F4997737184aa8A7a3D58AC15C   — matches provider EOA
tokenURI(1816): https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json  — exact canonical URI
```

Registry on-chain reads confirm the owner is the verified provider EOA and the
agent URI is the exact canonical metadata URI.

## 8004scan Verification

The 8004scan indexer had a short propagation delay immediately after the block;
the inline in-script check ran just ahead of the indexer and reported
`NOT_FOUND`. A subsequent bounded read-only re-query (same server-only key) finds
the registered agent and matches identity exactly:

```text
8004SCAN VERIFICATION: PASS
id:         468c1707-8448-43ae-a17d-37ca0cb5a0c8
agent_id:   97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1816
token_id:   1816
chain_id:   97
is_testnet: true
owner_address: 0x299ce4113abf88f4997737184aa8a7a3d58ac15c
```

Note: the in-script matcher was tightened to accept the API's canonical
`agent_id` form (`{chainId}:{registry}:{agentId}`) in addition to the bare
`token_id`; the corrected matcher reproduces the PASS above.

## Focused Tests And Gates (post-registration)

```text
X.16 registration preview verify: 19/19 PASS
X.20 canonical registration preview verify: 17/17 PASS
X.21 registration transaction review verify: 7/7 PASS (+ live snapshots; provider nonce now 2)
X.22 registration approval review verify: 16/16 PASS (+ live snapshots; provider nonce now 2)
X.23 registration execution: 13/13 pre-sign checks + sign + broadcast + confirm + verify
Typecheck: PASS
Lint: PASS
Build: PASS
```

The provider EOA pending nonce moved from 1 (pre-registration snapshots) to 2
post-registration, consistent with the single published transaction.

## X.23 Status

```text
X.23 STATUS:
REGISTRATION: PASS
CHAIN: 97
REGISTRY: 0x8004A818BFB912233c491871b3d84c89A494BD9e
PROVIDER EOA: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
TRANSACTION HASH: 0xba7f8e611fb61ca9280fd5005ea66a32c9d1041ecb4b210ebc16e9e23f265a83
BLOCK NUMBER: 124869834
AGENT ID: 1816
REGISTERED OWNER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
REGISTERED AGENT URI: https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
8004SCAN VERIFICATION: PASS

SIGNING: PERFORMED
BROADCAST: PERFORMED
TRANSACTION CONFIRMED: YES

ERC-8183 JOB: NOT CREATED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
MAINNET: NOT TOUCHED
```

## Files Changed

- `packages/integrations/src/altana/registration-execution.x23.ts`: new
  operator-authorized X.23 execution script (pre-sign safety checks, env-only
  secret loading, sign, broadcast, confirm, agentId extraction, on-chain +
  8004scan verification; no ERC-8183 / payment / settlement path).
- `packages/integrations/package.json`: added `altana:x23:register` script.
- `docs/review/Main-Track-Activation-X23-ERC8004-Registration.md`: this report.

No production application code, X.13 service, or metadata was changed. No
secrets were added to any tracked file. Changes are not committed or pushed.

## Next Legitimate Milestone (operator-gated, NOT started)

Per operator instruction, X.23 **stopped after registration verification**. Any
ERC-8183 job creation, payment, or settlement remains a separate,
operator-gated milestone and was explicitly not performed.