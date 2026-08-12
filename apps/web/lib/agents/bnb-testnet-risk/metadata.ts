import { BNB_TESTNET_RISK_SERVICE_NAME } from "./service.ts";

/** Inactive metadata preview until an ERC-8004 identity and price are verified. */
export function bnbTestnetRiskMetadata(serviceEndpoint: string) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: BNB_TESTNET_RISK_SERVICE_NAME,
    description:
      "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.",
    services: [{ name: "web", endpoint: serviceEndpoint, version: "1" }],
    x402Support: false,
    active: false,
    supportedTrust: [],
  } as const;
}
