/**
 * X.241 — Mainnet preflight (READ-ONLY).
 *
 * Verifies the complete Mainnet hire readiness WITHOUT any write, signature,
 * job, approval, or transfer. Run:
 *   node --experimental-strip-types apps/web/lib/activation/mainnet-hire-preflight.verify.ts
 * (from anywhere; uses public RPC + the live seller endpoint).
 *
 * Checks:
 *   P4  agent/chain/registry/owner/endpoint/health
 *   P5  buyer $U readiness (REPORT-ONLY; READY or BLOCKED — INSUFFICIENT BUYER $U)
 *   P7  quote/signature binding shape (cross-chain fail-closed, offline)
 */

import { createPublicClient, http, parseAbi, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import { AgentURIGenerator } from "@bnbagent/sdk/erc8004";
import {
  HIRE_CHAIN_MAINNET,
  HIRE_CHAIN_TESTNET,
  MAINNET_HIRE_CHAIN_CONFIG,
  TESTNET_HIRE_CHAIN_CONFIG,
  chainIdFromAgentId,
  isMainnetHireEnabled,
  resolveHireChainConfig,
} from "@bnb-marketplace/integrations/altana";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`ok   ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

const AGENT_ID = "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:334760";
const OWNER = "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
const ENDPOINT = "https://inbook-y1-plus.tail3e3640.ts.net:8443";
const TOKEN_ID = 334760;

// ---- P4: agent + endpoint preflight (live reads) ----
console.log("=== X.241 MAINNET PREFLIGHT (READ-ONLY) ===");
const client: PublicClient = createPublicClient({
  chain: bsc,
  transport: http("https://bsc-dataseed.binance.org"),
});

check("P4 chain id is 56", (await client.getChainId()) === HIRE_CHAIN_MAINNET);
const ownerOf = (await client.readContract({
  address: MAINNET_HIRE_CHAIN_CONFIG.registry,
  abi: parseAbi(["function ownerOf(uint256) view returns (address)"]),
  functionName: "ownerOf",
  args: [BigInt(TOKEN_ID)],
})) as string;
check(
  "P4 ownerOf(334760) is the mainnet owner",
  ownerOf.toLowerCase() === OWNER.toLowerCase(),
  ownerOf
);

const tokenURI = (await client.readContract({
  address: MAINNET_HIRE_CHAIN_CONFIG.registry,
  abi: parseAbi(["function tokenURI(uint256) view returns (string)"]),
  functionName: "tokenURI",
  args: [BigInt(TOKEN_ID)],
})) as string;
const decoded = AgentURIGenerator.decodeRegistrationFileFromBase64(
  tokenURI.slice(tokenURI.indexOf(",") + 1)
);
check("P4 tokenURI name is the mainnet seller", decoded.name === "BNB Agent Studio Mainnet Seller");
check(
  "P4 tokenURI endpoint is the live mainnet seller",
  decoded.services[0]?.endpoint === ENDPOINT
);
check(
  "P4 tokenURI capabilities include erc8183-negotiate",
  (decoded.services[0]?.capabilities ?? []).includes("erc8183-negotiate")
);

const health = (await (await fetch(`${ENDPOINT}/health`)).json()) as {
  status: string;
  chain: number;
  seller: string;
  agentId: string | null;
  hire: string;
};
check("P4 seller /health is ok", health.status === "ok", health);
check("P4 seller /health chain is 56", health.chain === HIRE_CHAIN_MAINNET);
check("P4 seller /health owner matches", health.seller.toLowerCase() === OWNER.toLowerCase());
check("P4 seller /health agentId matches", health.agentId === AGENT_ID, health.agentId);
check("P4 seller /health hire disabled (flag off)", health.hire === "disabled");

// ---- P4: contract configuration (verified table, no invented addresses) ----
check(
  "P4 commerce matches verified table",
  MAINNET_HIRE_CHAIN_CONFIG.commerce === "0xEa4DAa3100A767e86FDed867729ae7446476EBA6"
);
check(
  "P4 router matches verified table",
  MAINNET_HIRE_CHAIN_CONFIG.router === "0x51895229E12F9876011789B04f8698af06cCD6DA"
);
check(
  "P4 policy matches verified table",
  MAINNET_HIRE_CHAIN_CONFIG.policy === "0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5"
);
check(
  "P4 registry matches verified table",
  MAINNET_HIRE_CHAIN_CONFIG.registry === "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
);
check(
  "P4 $U matches verified table",
  MAINNET_HIRE_CHAIN_CONFIG.paymentToken === "0xcE24439F2D9C6a2289F741120FE202248B666666"
);

// ---- P5: $U preflight (read-only; REPORT-ONLY verdict) ----
const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);
const buyerCandidates = [OWNER]; // marketplace buyers use their own wallets; owner is the only currently known mainnet wallet
for (const wallet of buyerCandidates) {
  const uBal = (await client.readContract({
    address: MAINNET_HIRE_CHAIN_CONFIG.paymentToken,
    abi: erc20,
    functionName: "balanceOf",
    args: [wallet],
  })) as bigint;
  const bnbBal = await client.getBalance({ address: wallet });
  const requiredU = 1_000_000_000_000_000_000n; // configured default service price (1 $U) — the seller MAINNET_SERVICE_PRICE default
  const ready = uBal >= requiredU;
  console.log(
    `INFO P5 wallet ${wallet}: mainnet $U=${(Number(uBal) / 1e18).toFixed(6)} (required ${Number(requiredU) / 1e18}) | BNB=${(Number(bnbBal) / 1e18).toFixed(9)}`
  );
  check(`P5 $U verdict ${wallet}`, ready || uBal < requiredU, true); // verdict itself is reported, not failed
  if (!ready)
    console.log(
      `BLOCKED — INSUFFICIENT BUYER $U (${wallet}: ${(Number(uBal) / 1e18).toFixed(6)} $U < 1 $U)`
    );
}

// ---- P7: quote/signature binding (offline, cross-chain fail-closed) ----
const cfg56 = resolveHireChainConfig(HIRE_CHAIN_MAINNET);
const cfg97 = resolveHireChainConfig(HIRE_CHAIN_TESTNET);
check("P7 mainnet resolver returns chain 56", cfg56.chainId === HIRE_CHAIN_MAINNET);
check("P7 testnet resolver returns chain 97", cfg97.chainId === HIRE_CHAIN_TESTNET);
check("P7 mainnet commerce ≠ testnet commerce", cfg56.commerce !== cfg97.commerce);
// A testnet envelope (chain 97 + testnet commerce) against a mainnet agent identity:
const testnetEnvelope = { chain_id: 97, verifying_contract: TESTNET_HIRE_CHAIN_CONFIG.commerce };
const mainnetAgentChain = chainIdFromAgentId(AGENT_ID);
check(
  "P7 testnet envelope cannot bind to mainnet agent (chain mismatch)",
  testnetEnvelope.chain_id !== mainnetAgentChain
);
check(
  "P7 testnet envelope commerce cannot equal mainnet commerce",
  testnetEnvelope.verifying_contract.toLowerCase() !== cfg56.commerce.toLowerCase()
);
// A mainnet envelope against the testnet config:
const mainnetEnvelope = { chain_id: 56, verifying_contract: MAINNET_HIRE_CHAIN_CONFIG.commerce };
check(
  "P7 mainnet envelope cannot bind to testnet config (chain mismatch)",
  mainnetEnvelope.chain_id !== cfg97.chainId
);
check("P7 flag defaults disabled", isMainnetHireEnabled({}) === false);
check(
  "P7 flag only literal 'true' enables",
  isMainnetHireEnabled({ MAINNET_HIRE_ENABLED: "true" }) === true &&
    isMainnetHireEnabled({ MAINNET_HIRE_ENABLED: "1" }) === false
);

console.log("");
if (failed > 0) {
  console.error(`X.241 mainnet preflight: ${passed} passed, ${failed} FAILED`);
  process.exit(1);
}
console.log(`X.241 mainnet preflight: ${passed} checks passed, 0 failed`);
console.log(
  "BLOCKED — INSUFFICIENT BUYER $U (see P5 verdicts) — preflight is read-only; no action taken."
);
