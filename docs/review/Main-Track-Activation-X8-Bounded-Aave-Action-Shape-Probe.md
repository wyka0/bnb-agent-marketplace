# Main Track Activation X.8: Bounded Aave Action-Shape Probe

**Date:** 2026-08-12
**Mode:** READ-ONLY manifest audit; bounded probe stopped before `tools/call`
**Candidate:** Aave powered by HeyAnon

## X.8 STATUS

```text
PROBE:                  BLOCKED
ACTION SHAPE:           NOT FOUND
ACTION TYPE:            UNKNOWN (no safe action-builder tool exists)
CHAIN:                  BSC mainnet 56
TOKEN:                  UNKNOWN
AMOUNT:                 MISSING
PAYTO:                  MISSING
DESTINATION:            MISSING
CALLDATA:               MISSING
X402:                   UNKNOWN (execution-layer terms not requested)
EXECUTION PERFORMED:    NO
PAYMENT PERFORMED:      NO
SIGNING PERFORMED:      NO
BROADCAST PERFORMED:    NO

TESTNET COMPATIBILITY:  NO (candidate is chain 56; no chain-97 action was probed)
X.4C COMPATIBILITY:     NO
```

**EXACT BLOCKER:** The live MCP manifest exposes only Aave state-changing tools
whose transaction output is described as “EVM transactions to sign and broadcast”;
no tool is explicitly guaranteed to be preview-only, simulation-only, dry-run, or
build-only, so calling `tools/call` would violate the X.8 non-mutating boundary.

**NEXT ACTION:** Obtain explicit authorization for a separately reviewed Aave
non-mutating action-builder contract, or require HeyAnon to expose a documented
preview/dry-run tool before attempting another probe.

The process stopped here. No MCP `tools/call` request was sent.

## 1. Candidate

- Name: Aave powered by HeyAnon
- Exact identity: `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381`
- Chain: BSC mainnet, chain ID `56`
- MCP endpoint: `https://erc8004.heyanon.ai/mcp/aave`
- MCP protocol: `2025-06-18`
- Server: `heyanon-erc8004-aave`, version `1.0.0`

The endpoint was previously verified for manifest, initialization, and tool
discovery. The X.8 manifest was fetched again read-only, and the official guide
at `https://erc8004.heyanon.ai/mcp/skill.md` was reviewed before deciding whether
any tool could be called safely.

## 2. Tool Safety Determination

The manifest exposes 22 tools. Nine produce transaction-shaped output:

| Tool                   | Required action parameters                                                                                   | Explicit no-execution guarantee? |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `supply`               | `chainName`, `assetAddress`, `amount`, `userAddress`                                                         | No                               |
| `borrow`               | `chainName`, `assetAddress`, `amount`, `interestRateMode`, `userAddress`                                     | No                               |
| `withdraw`             | `chainName`, `assetAddress`, `amount`, `userAddress`                                                         | No                               |
| `repay`                | `chainName`, `assetAddress`, `amount`, `interestRateMode`, `userAddress`                                     | No                               |
| `repayWithATokens`     | `chainName`, `assetAddress`, `amount`, `interestRateMode`, `userAddress`                                     | No                               |
| `liquidationCall`      | `chainName`, `liquidatedUser`, `debtAsset`, `collateralAsset`, `debtToCover`, `receiveAToken`, `userAddress` | No                               |
| `setEModeCategory`     | `chainName`, `categoryId`, `userAddress`                                                                     | No                               |
| `setUsageAsCollateral` | `chainName`, `assetAddress`, `usageAsCollateral`, `userAddress`                                              | No                               |
| `swapBorrowRateMode`   | `chainName`, `assetAddress`, `interestRateMode`, `userAddress`                                               | No                               |

The transaction output shape is:

```text
transactions[].chainId
transactions[].transaction.target
transactions[].transaction.data
transactions[].transaction.value
```

The output description is:

```text
EVM transactions to sign and broadcast
```

None of the nine tools has:

- an MCP `annotations` object;
- `readOnlyHint: true`;
- `destructiveHint: false`;
- a `dryRun` parameter;
- a `simulate` parameter;
- a `preview` parameter;
- a `buildOnly` parameter;
- a description guaranteeing that the server will not execute the action;
- a separate quote or action-builder contract.

The official guide also says that `tools/call` may require x402 payment and that
responses can contain ordered signing actions. Therefore a `tools/call` request
would be an execution-class request, not a proven read-only action-shape probe.

## 3. Why No Tool Was Called

The safest-looking action, `setEModeCategory`, still changes on-chain user state.
It requires:

```text
chainName
categoryId
userAddress
```

Choosing a category or wallet address without explicit user intent would be
guessing. Calling `supply`, `borrow`, `repay`, `withdraw`, liquidation, collateral,
or rate-mode tools would be even more clearly state-changing. None is acceptable
under the X.8 boundary.

The safe read-only tools (`getAaveV3SupportedChains`, reserve queries, wallet
balance/reserve queries, health indicators, and similar data tools) cannot produce
the concrete transaction action shape requested. They were not called because the
previous read-only probe already established BSC support and they cannot resolve
the missing action fields.

No 402 request was intentionally generated. No payment header, payment signature,
or x402 retry was created.

## 4. Required Fields Result

Because no action-producing call was made, no concrete action was returned:

| Field       | Result                                 | Reason                                                                                |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| Chain       | Found as candidate metadata only: `56` | Not an action response                                                                |
| Token       | Missing                                | No action response                                                                    |
| Amount      | Missing                                | No action response; any amount would be guessed                                       |
| PayTo       | Missing                                | Aave action schema has no marketplace payTo                                           |
| Destination | Missing                                | No returned transaction target                                                        |
| Calldata    | Missing                                | No returned transaction data                                                          |
| Action type | Missing                                | Tool names are state-changing Aave operations, not a verified marketplace action type |
| x402 terms  | Unknown                                | No execution-class call or payment challenge requested                                |

The candidate therefore cannot feed the existing X.4B transaction review or the
X.4C consent digest. In particular, no consent was pinned, and the result was not
passed to the hire endpoint or any signing path.

## 5. Chain Assessment

The candidate identity is explicitly BSC mainnet chain `56`. The manifest's
network enum includes `bsc`, and the prior safe supported-chain query confirmed
BSC support, but this is not chain `97` compatibility. No chain-97 Aave action,
contract, token, or endpoint was established.

```text
TESTNET COMPATIBILITY: NO
```

The action shape objective was not allowed to change the candidate's chain or
pretend mainnet data was testnet data.

## 6. Safety Stop

```text
MCP manifest fetch:       READ-ONLY
Official guide fetch:     READ-ONLY
MCP tools/call:            NOT SENT
x402 payment:             NOT SENT
Private key:              NOT READ
ALTANA_PRIVATE_KEY:       NOT READ
FACILITATOR_KEY:          NOT READ
Mainnet funds:            NOT USED
Supply/borrow/repay:      NOT PERFORMED
Withdraw/approve/transfer:NOT PERFORMED
Signing:                  NOT PERFORMED
Broadcast:                NOT PERFORMED
Settlement:               NOT PERFORMED
Git/deploy:               NOT PERFORMED
```

## 7. Final Classification

This was a valid bounded stop, not a failed network probe. The live candidate has
action-producing schemas, but it does not expose a separately documented,
non-mutating action-builder capability. Under the explicit X.8 safety rule,
obtaining concrete calldata would require an execution-class `tools/call`, which
was not authorized and was not performed.
