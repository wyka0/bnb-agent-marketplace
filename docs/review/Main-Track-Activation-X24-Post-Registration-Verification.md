# Main Track Activation X.24: Post-Registration ERC-8004 Verification

**Date:** 2026-08-13
**Mode:** Read-only post-registration verification
**Network:** BNB Smart Chain Testnet, chain 97
**Registration verified:** Agent ID 1816 (registered in X.23)

## Outcome

X.24 **PASSES**. The registered Agent ID 1816 was re-read from the ERC-8004
registry with the owner, agent URI, metadata document, and X.13 service all
independently confirmed, and the agent is discoverable through 8004scan and the
existing marketplace integration. Everything below is a read-only check: no
ERC-8183 job, no payment, no settlement, no new transaction, no signing, and no
mainnet access occurred.

## Verified Registration (source of truth, from X.23)

```text
CHAIN:     97 (BNB Smart Chain Testnet)
AGENT ID:  1816
OWNER:     0x299Ce4113abF88F4997737184aa8A7a3D58AC15C  (provider EOA)
AGENT URI: https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
REGISTRY:  0x8004A818BFB912233c491871b3d84c89A494BD9e
TX:        0xba7f8e61…3f265a83
```

## Read-Only Checks (10/10 PASS)

```text
PASS pinned calldata hash still matches X.22/X.23
PASS current chain is 97 (confirmed)
PASS Agent ID 1816 readable from registry (ownerOf)
PASS registered owner == verified provider EOA
PASS registered agent URI == canonical metadata URI
PASS metadata URI HTTP 200 + valid JSON (HTTP 200)
PASS metadata serviceEndpoint == canonical service
PASS X.13 service structured ready response
PASS 8004scan agent lookup performed (key present)
PASS 8004scan returns Agent ID 1816
X.24 read-only verification: 10/10 passed
```

### 1–3. On-Chain Registry Read (Agent ID 1816)

```text
agentId:    1816
owner:      0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
agentURI:   https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
```

`ownerOf(1816)` equals the verified provider EOA and the registry's agent URI
(`tokenURI`/`agentURI`) exactly equals the canonical metadata URI.

### 4–5. Canonical Metadata Document

```text
GET https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
HTTP 200  Content-Type application/json  valid JSON  yes
serviceEndpoint: https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service
```

The metadata document resolves (HTTP 200), parses as JSON, and its
`services[0].endpoint` matches the canonical X.13 service endpoint exactly.

### 6–7. X.13 Service Safe Test Request

```text
POST https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service
Body: {"wallet":"0x0000000000000000000000000000000000000001"}
Response: { "state": "ready", "chainId": 97, "wallet": "0x000…0001",
            "nativeBalanceWei": "<read-only balance>" }
```

The service returns the expected structured `ready` response for chain 97 with a
read-only native balance. No funds are moved and no value is rendered.

### 8–9. 8004scan (server-only API key, never printed)

```text
8004SCAN VERIFICATION: PASS
id:          468c1707-8448-43ae-a17d-37ca0cb5a0c8
agent_id:    97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1816
token_id:    1816
chain_id:    97
is_testnet:  true
chain_type:  evm
contract_address: 0x8004a818bfb912233c491871b3d84c89a494bd9e
owner_address:    0x299ce4113abf88f4997737184aa8a7a3d58ac15c
owner_id:         aef2de5f-6464-4e15-a9d7-c1121ab5c7d1
name:        Agent #1816
created_at:  2026-08-13T16:16:38Z
```

8004scan returns the registered agent with matching `agent_id`,
`contract_address`, and `owner_address`. The API key was read only from the
server environment and never rendered.

### 10. Marketplace Discovery via the Existing Integration

The existing marketplace path (`listAgents` → `normalizeAgents` →
`pickAgentBySlug`) discovers and normalizes Agent 1816 exactly:

```text
listAgents search match:            true
pickAgentBySlug exact-match:        true
slug:        97:0x8004a818bfb912233c491871b3d84c89a494bd9e:1816
tokenId:     1816
name:        Agent #1816
chainId:     97      isTestnet: true
ownerAddress: 0x299ce4113abf88f4997737184aa8a7a3d58ac15c
source:      8004scan
```

Note on scope: the marketplace returned agent would not appear in the mainnet
catalog (`getMarketplaceAgentBySlug` hardcodes `isTestnet: false`, so a testnet
record is intentionally not returned there) — this is the existing honest
mainnet-only catalog boundary. With the documented testnet filter the agent is
discovered and normalized for display by the same verified code path.

## Suites Run After X.24

```text
X.16 registration preview verify: 19/19 PASS
X.20 canonical registration preview verify: 17/17 PASS
X.21 registration transaction review verify: 7/7 PASS
X.22 registration approval review verify: 16/16 PASS
X.24 post-registration verification verify: 10/10 PASS
marketplace:verify (base/state/lookup/card/filter+sort): 83/83 PASS
marketplace:live:verify: 14/14 PASS
discovery:verify: 59/59 PASS
discovery:live:verify: 12/12 PASS
Typecheck: PASS (workspace, 12 tasks)
Lint: PASS (workspace, 12 tasks)
Build: PASS (workspace, 7 tasks)
```

## X.24 Status

```text
X.24 STATUS:
REGISTRY AGENT: PASS
AGENT ID: 1816
OWNER: 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
AGENT URI: https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json
METADATA: PASS
SERVICE: PASS
8004SCAN: PASS
MARKETPLACE DISCOVERY: PASS

TYPECHECK: PASS
LINT: PASS
BUILD: PASS

ERC-8183 JOB: NOT CREATED
PAYMENT: NOT PERFORMED
SETTLEMENT: NOT PERFORMED
NEW TRANSACTION: NOT PERFORMED
MAINNET: NOT TOUCHED
```

## Files Changed

- `packages/integrations/src/altana/post-registration.verify.x24.ts`: new
  read-only X.24 post-registration verification (on-chain registry read,
  metadata document, X.13 service probe, 8004scan; no private key, no signing,
  no transaction).
- `packages/integrations/package.json`: added `altana:x24:verify` script.
- `docs/review/Main-Track-Activation-X24-Post-Registration-Verification.md`:
  this report.

No production application code, X.13 service, metadata, or registered agent was
modified. No secrets were exposed or committed. Changes are not committed or
pushed.

## Stop Condition

X.24 verification is complete and PASSES. Per operator instruction, X.24 stops
here: no ERC-8183 job, no payment, no settlement, and no new on-chain
transaction was performed. The next milestone (any ERC-8183 or payment step)
remains operator-gated and was not started.