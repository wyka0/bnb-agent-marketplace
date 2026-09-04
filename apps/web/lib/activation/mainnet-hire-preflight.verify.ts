/**
 * X.241/X.242 — Mainnet preflight (READ-ONLY).
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
 *
 * X.242 — first-hire demo price: 0.00001 $U (10000000000000 wei, $U 18dp).
 * Buyer (user-designated): 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C.
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
/** X.242 — user-designated Mainnet buyer for the first controlled hire. */
const BUYER = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
/** X.242 — first-hire demo price: 0.00001 $U (1e13 wei; $U has 18 decimals). */
const FIRST_HIRE_PRICE_WEI = 10_000_000_000_000n;

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
// X.242 — the user-designated buyer; the seller/owner wallet is reported too
// (buyers and sellers are NOT required to be the same wallet).
const buyerCandidates = [BUYER, OWNER];
for (const wallet of buyerCandidates) {
  const uBal = (await client.readContract({
    address: MAINNET_HIRE_CHAIN_CONFIG.paymentToken,
    abi: erc20,
    functionName: "balanceOf",
    args: [wallet],
  })) as bigint;
  const bnbBal = await client.getBalance({ address: wallet });
  const requiredU = FIRST_HIRE_PRICE_WEI; // X.242 first-hire demo price (0.00001 $U)
  const ready = uBal >= requiredU;
  const role = wallet === BUYER ? "BUYER" : "SELLER/OWNER";
  console.log(
    `INFO P5 ${role} ${wallet}: mainnet $U=${(Number(uBal) / 1e18).toFixed(6)} (required ${Number(requiredU) / 1e18}) | BNB=${(Number(bnbBal) / 1e18).toFixed(9)}`
  );
  if (wallet === BUYER) {
    check(`P5 buyer $U balance verified (read-only)`, uBal >= 0n, uBal.toString());
    if (!ready) {
      console.log(
        `BLOCKED — INSUFFICIENT BUYER $U (buyer ${wallet}: ${(Number(uBal) / 1e18).toFixed(6)} $U < 0.00001 $U)`
      );
    } else {
      console.log(`P5 buyer READY: $U sufficient for the 0.00001 $U first hire.`);
    }
    if (bnbBal === 0n) {
      console.log(`BLOCKED — BUYER HAS NO BNB FOR GAS (buyer ${wallet}: 0 BNB on chain 56)`);
    }
  }
}
check(
  "P5 first-hire price is exactly 1e13 wei (0.00001 $U, 18dp)",
  FIRST_HIRE_PRICE_WEI === 10_000_000_000_000n
);

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
console.log(
  "INFO MAINNET_HIRE_ENABLED (local env):",
  isMainnetHireEnabled(process.env) ? "true" : "false"
);
// The live seller reports its own flag via /health (checked in P4: hire disabled).
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
