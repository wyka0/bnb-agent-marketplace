/**
 * P12 safe live verification. Exactly the P12 discovery sequence:
 * manifest, initialize, tools/list, getAaveV3SupportedChains.
 * No financial mutation, payment, signing, wallet, retry, or transaction.
 */

import { AAVE_AGENT_ID, AAVE_CHAIN_ID, AAVE_SAFE_ACTION } from "./contract.ts";
import { activateAavePreview } from "./aave.server.ts";

const result = await activateAavePreview({
  agentId: AAVE_AGENT_ID,
  chainId: AAVE_CHAIN_ID,
  action: AAVE_SAFE_ACTION,
});

console.log("P12 safe live activation verification");
console.log(JSON.stringify(result, null, 2));

if (result.state !== "ready" || !result.bscSupported) {
  console.error("P12 LIVE STATUS: BLOCKED — safe MCP pipeline did not return BSC support");
  process.exit(1);
}

console.log(
  "P12 LIVE STATUS: READY — MCP connected, BSC supported, no payment/signature/transaction"
);
