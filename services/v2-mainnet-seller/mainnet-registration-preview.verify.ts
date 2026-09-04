/**
 * X.235-P1 — Mainnet ERC-8004 registration preview (READ-ONLY).
 *
 * Usage (when prerequisites are met):
 *   MAINNET_OWNER_ADDRESS=0x... MAINNET_AGENT_URL=https://... node mainnet-registration-preview.verify.ts
 *
 * Builds the exact agentURI payload that WOULD be submitted to
 * registerAgent(string agentURI) on the chain-56 registry. Does NOT broadcast,
 * does NOT sign, does NOT call any contract write. If owner or endpoint is
 * missing, shows placeholders explicitly marked.
 */

import { AgentEndpoint, AgentURIGenerator } from "@bnbagent/sdk/erc8004";

const OWNER_ADDRESS = process.env.MAINNET_OWNER_ADDRESS ?? "<MAINNET_OWNER_ADDRESS>";
const AGENT_URL = process.env.MAINNET_AGENT_URL ?? "<MAINNET_SELLER_URL>";

const CHAIN = 56;
const REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const SELECTOR = "0x2d2a9585";
const METHOD = "registerAgent(string agentURI)";

const ownerReady = !OWNER_ADDRESS.startsWith("<");
const endpointReady = !AGENT_URL.startsWith("<");

// Build the agent URI (placeholder URL is a valid format for the preview;
// the actual registration MUST use the real mainnet seller root URL)
const previewUrl = endpointReady ? AGENT_URL : "https://placeholder-for-preview.example.com";

const agentUri = AgentURIGenerator.generateAgentUri({
  name: "BNB Agent Studio Mainnet Seller",
  description: "BSC Mainnet ERC-8183 service seller — real negotiated quote service, mainnet",
  endpoints: [
    new AgentEndpoint({
      name: "ERC-8183",
      endpoint: previewUrl,
      capabilities: ["erc8183-negotiate"],
    }),
  ],
  identityRegistry: `eip155:${CHAIN}:${REGISTRY.toLowerCase()}`,
  chainId: CHAIN,
});

const decoded = AgentURIGenerator.decodeRegistrationFileFromBase64(
  agentUri.slice(agentUri.indexOf(",") + 1)
);

console.log("=== MAINNET ERC-8004 REGISTRATION PREVIEW (NOT BROADCAST) ===\n");
console.log(`REGISTRATION NETWORK: BSC Mainnet (chain ${CHAIN})`);
console.log(`REGISTRY: ${REGISTRY}`);
console.log(
  `OWNER: ${ownerReady ? OWNER_ADDRESS : OWNER_ADDRESS + "  ← PLACEHOLDER (fresh funded wallet required)"}`
);
console.log(`AGENT NAME: ${decoded.name}`);
console.log(`DESCRIPTION: ${decoded.description}`);
console.log(
  `SERVICES: ${JSON.stringify(decoded.services)}${endpointReady ? "" : "  ← ENDPOINT IS PLACEHOLDER"}`
);
console.log(
  `ENDPOINT: ${endpointReady ? AGENT_URL : previewUrl + "  ← PLACEHOLDER (mainnet seller root required)"}`
);
console.log(`METHOD: ${METHOD}`);
console.log(`SELECTOR: ${SELECTOR}`);
console.log(`agentURI: ${agentUri.slice(0, 80)}... (length ${agentUri.length})`);
console.log(`EXPECTED IDENTITY: ${CHAIN}:${REGISTRY.toLowerCase()}:<tokenId>`);
console.log(`TRANSACTIONS REQUIRED: 1 (registerAgent is atomic — registers + sets metadata)`);
console.log("");

if (!ownerReady) {
  console.log("REGISTRATION PREVIEW: BLOCKED — owner address is a placeholder.");
}
if (!endpointReady) {
  console.log("REGISTRATION PREVIEW: BLOCKED — endpoint URL is a placeholder.");
}
if (ownerReady && endpointReady) {
  console.log("REGISTRATION PREVIEW: READY — both prerequisites provided.");
  console.log("");
  console.log("GAS ESTIMATE: use the funded owner address for a read-only");
  console.log("estimateGas call at execution time. Do NOT guess here without credentials.");
  console.log("");
  console.log("⚠  DO NOT BROADCAST WITHOUT EXPLICIT USER AUTHORIZATION.");
}
