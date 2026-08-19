/**
 * X.28B — READ-ONLY FUNDING-READINESS VERIFICATION FOR ERC-8183 JOB 515.
 *
 * STRICTLY READ-ONLY. No signing, no broadcast, no approve()/fund() execution,
 * no private key use. Confirms, against live chain 97 state:
 *   1. chain id == 97
 *   2. payer EOA == ALTANA_PAYTO (existing configuration), valid address
 *   3. native tBNB balance readable (reported live)
 *   4. $U balance readable via ERC20 balanceOf (token from runtime config)
 *   5. $U allowance(provider -> AgenticCommerce) readable (spender == commerce)
 *   6. job 515 still exists and is OPEN (not funded/settled/expired)
 *   7. job 515 budget == exactly 1 U (raw 1e18)
 *
 * Output mirrors the X.27/X.28A verification suites: PASS/FAIL per check and a
 * single summary; exit code reflects the result. Nothing is submitted.
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
import { BNB_TESTNET, getErc8183Job } from "@altananetwork/sdk";
import { ALTANA_ERC8183_CHAIN_ID, resolveErc8183Config } from "./erc8183.js";
import { createAltanaClient } from "./client.js";

const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
const DECIMALS = 18n;

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

const checks: Array<{ label: string; ok: boolean }> = [];
function check(label: string, ok: boolean): void {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

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

async function main(): Promise<void> {
  console.log("X.28B READ-ONLY FUNDING-READINESS VERIFICATION (chain 97, no broadcast):");

  // 2. Payer EOA from the existing configuration; only ALTANA_PAYTO is read.
  const rawPayTo = process.env["ALTANA_PAYTO"]?.trim();
  const payer =
    rawPayTo !== undefined && /^0x[0-9a-fA-F]{40}$/.test(rawPayTo) ? getAddress(rawPayTo) : null;
  check(
    `payer EOA resolved from ALTANA_PAYTO${payer === null ? "" : ` (${payer})`}`,
    payer !== null && isAddress(payer ?? "") && payer !== getAddress("0x0000000000000000000000000000000000000000")
  );
  if (payer === null) process.exit(1);

  // Runtime config: $U token + AgenticCommerce from the verified ERC-8183 table.
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const token = getAddress(config.paymentToken);
  const commerce = getAddress(config.commerce);

  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  check("public RPC URL resolved from Altana configuration", typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl ?? ""));
  if (typeof publicRpcUrl !== "string") process.exit(1);
  const client = createPublicClient({ transport: http(publicRpcUrl) });

  // 1. Chain id == 97.
  let chainId: number | null = null;
  try {
    chainId = Number(await client.getChainId());
  } catch {
    chainId = null;
  }
  check("1. live eth_chainId == 97 (BSC Testnet)", chainId === 97);
  if (chainId !== 97) process.exit(1);

  // 3. tBNB balance.
  let tbnbWei: bigint | null = null;
  try {
    tbnbWei = await client.getBalance({ address: payer });
    check(`3. tBNB balance readable (live: ${tbnbWei === null ? "n/a" : formatUnits(tbnbWei, Number(DECIMALS))} tBNB)`, tbnbWei !== null);
  } catch {
    tbnbWei = null;
    check("3. tBNB balance readable", false);
  }

  // 4. $U balance.
  let uBalance: bigint | null = null;
  try {
    uBalance = BigInt(
      String(
        await client.readContract({
          address: token,
          abi: ERC20_VIEW_ABI,
          functionName: "balanceOf",
          args: [payer],
        })
      )
    );
    check(`4. $U balance readable (live: ${formatUnits(uBalance, Number(DECIMALS))} U)`, uBalance !== null);
  } catch {
    uBalance = null;
    check("4. $U balance readable", false);
  }

  // 5. $U allowance to AgenticCommerce (spender == commerce).
  let allowance: bigint | null = null;
  try {
    allowance = BigInt(
      String(
        await client.readContract({
          address: token,
          abi: ERC20_VIEW_ABI,
          functionName: "allowance",
          args: [payer, commerce],
        })
      )
    );
    check(
      `5. $U allowance to AgenticCommerce readable (spender ${commerce}; live: ${formatUnits(allowance, Number(DECIMALS))} U)`,
      allowance !== null
    );
  } catch {
    allowance = null;
    check("5. $U allowance to AgenticCommerce readable", false);
  }

  // 6. Job 515 still exists and is OPEN.
  let job;
  try {
    job = await getErc8183Job(BNB_TESTNET, JOB_ID);
    const openOk = job.id === JOB_ID && job.statusName === "OPEN" && job.status === 0;
    const oursOk =
      job.client !== undefined && getAddress(String(job.client)) === payer &&
      job.provider !== undefined && getAddress(String(job.provider)) === payer;
    check(`6. job 515 exists and is OPEN (live status: ${job.statusName} (${job.status.toString()}); client/provider == payer)`, openOk && oursOk);
  } catch (error) {
    job = null;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL 6. job 515 read (${message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]")})`);
  }

  // 7. Job 515 budget == exactly 1 U.
  const budgetOk = job !== null && BigInt(job.budget) === ONE_U_RAW;
  check(`7. job 515 budget == exactly 1 U (raw ${ONE_U_RAW.toString()})`, budgetOk);

  console.log("");
  const failed = checks.filter((entry) => !entry.ok);
  console.log(`X.28B funding-readiness verification: ${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length > 0) {
    console.log("X.28B FAIL — the funding prerequisite set is NOT confirmed.");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Deterministic read-only summary (mirrors the mandated faucet:check block).
  // ---------------------------------------------------------------------------
  console.log("");
  console.log("X.28B LIVE SUMMARY (read-only):");
  console.log(`  Chain: BSC Testnet (97)`);
  console.log(`  Payer: ${payer}`);
  console.log(`  tBNB balance: ${formatUnits(tbnbWei ?? 0n, Number(DECIMALS))}`);
  console.log(`  $U balance: ${formatUnits(uBalance ?? 0n, Number(DECIMALS))}`);
  console.log(`  $U allowance to AgenticCommerce: ${formatUnits(allowance ?? 0n, Number(DECIMALS))}`);
  console.log(`  $U token: ${token}`);
  console.log(`  AgenticCommerce: ${commerce}`);
  console.log(`  Job 515: ${job?.statusName ?? "n/a"} (${job?.status.toString() ?? "n/a"}), budget ${formatUnits(BigInt(job?.budget ?? 0n), Number(DECIMALS))} U`);
  console.log("  SIGNING: NOT PERFORMED");
  console.log("  BROADCAST: NOT PERFORMED");
  console.log("  APPROVE/FUND: NOT EXECUTED");
  console.log("  PAYMENT: NOT PERFORMED");
  console.log("  SETTLEMENT: NOT PERFORMED");
  console.log("  MAINNET: NOT TOUCHED");
  console.log(`  READY FOR X.28B PRE-FLIGHT DELIVERED BY: altana:faucet:check (this is read-only verification only)`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.28B VERIFICATION FAILED (read-only; no action taken): ${redacted}`);
  process.exit(1);
});