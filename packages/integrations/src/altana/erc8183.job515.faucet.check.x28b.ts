/**
 * X.28B — SAFE READ-ONLY BSC TESTNET FUNDING HELPER (faucet:check).
 *
 * STRICTLY READ-ONLY. No signing, no broadcast, no approve()/fund() execution,
 * no mint/faucet contract calls, no private key use. Every value is a live
 * `eth_chainId` / `eth_getBalance` / ERC20 `balanceOf` / `allowance` read
 * against chain 97. If the wallet is not ready, the script prints a MANUAL
 * funding checklist (official faucets only) and stops — it never claims that
 * tokens were obtained.
 *
 * Wired as: pnpm --filter @bnb-marketplace/integrations altana:faucet:check
 *
 * Reads:
 *   1. payer EOA from the existing ALTANA_PAYTO environment configuration
 *   2. live chain id (must be 97)
 *   3. native tBNB balance
 *   4. $U balance via ERC20 balanceOf (token resolved at runtime from the
 *      verified ERC-8183/AgenticCommerce config, never hardcoded here)
 *   5. $U allowance(provider, AgenticCommerce) for the existing funding flow
 *   6. readiness: tBNB > 0 (gas) AND $U >= 1 U AND allowance >= 1 U
 *
 * When ready, the ONLY readiness output is: READY FOR X.28B PRE-FLIGHT
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
} from "viem";
import { ALTANA_ERC8183_CHAIN_ID, resolveErc8183Config } from "./erc8183.js";
import { createAltanaClient } from "./client.js";

const ONE_U_RAW = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
const TOKEN_DECIMALS = 18n;

/** Official BNB Chain faucets (public documentation; manual entry required). */
const TBNB_FAUCET_URL = "https://www.bnbchain.org/en/testnet-faucet";
/** Official $U faucet — documented in bnb-chain/bnbagent-sdk (python/README.md, "Faucets"). */
const U_FAUCET_URL = "https://united-coin-u.github.io/u-faucet/";

const ERC20_VIEW_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { type: "address" },
      { type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

function findEnvFile(): string | null {
  let dir = resolve(process.cwd());
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, ".env.local");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envPath = findEnvFile();
if (envPath !== null) {
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.log(`FAIL loading env file: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Keys are NEVER read by this helper. The shared env-file loader imports the
 * file as a whole (existing suite pattern) but this script only ever reads
 * `ALTANA_PAYTO`; no private-key variable name is referenced or rendered.
 */

async function main(): Promise<void> {
  console.log("X.28B SAFE READ-ONLY BSC TESTNET FUNDING CHECK (chain 97, no broadcast):");

  // 1. Payer EOA from the existing configuration (ALTANA_PAYTO), validated.
  const rawPayTo = process.env["ALTANA_PAYTO"]?.trim();
  if (rawPayTo === undefined || rawPayTo.length === 0) {
    console.log("FAIL: ALTANA_PAYTO is not configured (existing activation configuration).");
    console.log("MANUAL FUNDING CHECKLIST aborted — no payer address.");
    process.exit(1);
  }
  const payer = /^0x[0-9a-fA-F]{40}$/.test(rawPayTo) ? getAddress(rawPayTo) : null;
  if (payer === null || !isAddress(payer) || payer === getAddress("0x0000000000000000000000000000000000000000")) {
    console.log("FAIL: ALTANA_PAYTO is not a valid non-zero address.");
    process.exit(1);
  }

  // $U token + commerce resolved at runtime from the verified ERC-8183 config,
  // never hardcoded here.
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const token = getAddress(config.paymentToken);
  const commerce = getAddress(config.commerce);

  if (config.chainId !== 97) {
    console.log(`FAIL: ERC-8183 config resolved chain ${config.chainId}; expected 97.`);
    process.exit(1);
  }

  // Existing configured public RPC for chain 97.
  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  if (typeof publicRpcUrl !== "string" || !/^https?:\/\//i.test(publicRpcUrl)) {
    console.log("FAIL: public RPC URL could not be resolved from the Altana configuration.");
    process.exit(1);
  }
  const client = createPublicClient({ transport: http(publicRpcUrl) });

  // 2. Verify chainId == 97.
  const chainId = Number(await client.getChainId());
  if (chainId !== 97) {
    console.log(`FAIL: live chain id ${chainId}; refuses anything but 97 (BSC Testnet).`);
    process.exit(1);
  }

  // 3. Native tBNB balance.
  const tbnbWei = await client.getBalance({ address: payer });

  // 4. $U balance via ERC20 balanceOf.
  const uBalance = BigInt(
    String(
      await client.readContract({
        address: token,
        abi: ERC20_VIEW_ABI,
        functionName: "balanceOf",
        args: [payer],
      })
    )
  );

  // 5. $U allowance to the existing AgenticCommerce funding contract.
  const allowance = BigInt(
    String(
      await client.readContract({
        address: token,
        abi: ERC20_VIEW_ABI,
        functionName: "allowance",
        args: [payer, commerce],
      })
    )
  );

  // 6. The exact mandated summary block.
  console.log("");
  console.log(`Chain: BSC Testnet (97)`);
  console.log(`Payer: ${payer}`);
  console.log(`tBNB balance: ${formatUnits(tbnbWei, Number(TOKEN_DECIMALS))}`);
  console.log(`$U balance: ${formatUnits(uBalance, Number(TOKEN_DECIMALS))}`);
  console.log(`$U allowance to AgenticCommerce: ${formatUnits(allowance, Number(TOKEN_DECIMALS))}`);

  const gasReady = tbnbWei > 0n;
  const uReady = uBalance >= ONE_U_RAW;
  const allowanceReady = allowance >= ONE_U_RAW;
  const ready = gasReady && uReady && allowanceReady;

  if (ready) {
    // 9. Only this line once balances are sufficient.
    console.log("READY FOR X.28B PRE-FLIGHT");
    process.exit(0);
  }

  // 8. Manual funding checklist — official faucets only; never claim success.
  const missing: string[] = [];
  if (!gasReady) missing.push("tBNB (gas)");
  if (!uReady) missing.push("$U (>= 1 for the job budget)");
  if (!allowanceReady) missing.push("$U allowance to AgenticCommerce (set by approve() in the X.28B pre-flight, not here)");
  console.log("");
  console.log("NOT READY FOR X.28B PRE-FLIGHT — MISSING: " + missing.join(", "));
  console.log("");
  console.log("MANUAL FUNDING CHECKLIST (official/public faucets only; manual entry required):");
  console.log(`  [1] tBNB (gas) — official BNB Chain testnet faucet:`);
  console.log(`      ${TBNB_FAUCET_URL}`);
  console.log(`      Enter wallet address manually: ${payer}`);
  console.log(`      (alt. official Altana testnet faucet: https://testnet.bnbchain.org/faucet-smart)`);
  console.log(`  [2] $U (United Stables) — OFFICIAL $U Faucet for BSC Testnet, published in`);
  console.log(`      the official bnb-chain/bnbagent-sdk repository (python/README.md, Faucets):`);
  console.log(`      ${U_FAUCET_URL}`);
  console.log(`      Enter wallet address manually: ${payer}`);
  console.log(`      Required amount: >= 1 U (raw ${ONE_U_RAW.toString()})`);
  console.log(`      Claim via the faucet's wallet-connect UI; requires manual verification.`);
  console.log(`  [3] Re-run this helper afterwards; the chain must confirm every balance increase.`);
  console.log(`      This script never claims funds were obtained; only live balance reads count.`);
  console.log("");
  console.log(`Next: once tBNB > 0 and $U >= 1 with allowance >= 1 U, this helper will print`);
  console.log("      ONLY: READY FOR X.28B PRE-FLIGHT");
  console.log(`Payer address for manual faucet entry: ${payer}`);
  process.exit(0);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.28B FUNDING CHECK FAILED (read-only; no action taken): ${redacted}`);
  process.exit(1);
});