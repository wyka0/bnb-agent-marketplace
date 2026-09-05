/**
 * X.28C — EXECUTE ERC-8183 JOB 515 FUNDING ON BNB TESTNET (chain 97).
 *
 * Operator-authorized milestone (X.28B readiness confirmed). Executes the two
 * remaining funding calls for job 515 ONLY:
 *   A. approve(spender = AgenticCommerce, amount = 1 U) -> $U token
 *   B. fund(jobId = 515, expectedBudget = 1 U, "0x")    -> AgenticCommerce
 *
 * Source of truth is the verified X.28A funding review + X.28B readiness:
 *   commerce  0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE (escrow/spender)
 *   $U        0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565 (18 decimals)
 *   payer / provider / signer  0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
 *   job 515    OPEN, budget exactly 1 U, funded amount 0
 *   balances   $U 10 (>= 1), tBNB > 0 (gas), allowance 0 (approval required)
 *
 * PRE-SIGN SAFETY CHECKS (all must pass or the script exits before signing):
 *   1.  live eth_chainId == 97
 *   2.  job 515 exists and is OPEN
 *   3.  job 515 client/provider == verified payer EOA
 *   4.  job 515 budget == exactly 1 U (raw 1e18)
 *   5.  live $U balance of payer >= 1 U
 *   6.  approval spender == verified AgenticCommerce address (X.28A)
 *   7.  $U token address == runtime ERC-8183 configuration (resolveErc8183Config)
 *   8.  live allowance(payer -> commerce) read and reported
 *   9.  approval amount == exactly 1 U (raw 1e18)
 *  10.  funding call == fund(515, 1e18, "0x") -> commerce (SDK-identical calldata)
 *  11.  no settlement / service execution / unrelated transfer in the tx set
 *  Plus: signer address derived from env == verified payer EOA; re-read chain
 *  immediately before each signing step.
 *
 * EXECUTION SEQUENCE (stops on the first failure):
 *   A. sign + broadcast approve(commerce, 1 U) -> $U; wait for confirmation
 *   B. re-read allowance, confirm >= 1 U
 *   C. sign + broadcast fund(515, 1 U, "0x") -> commerce; wait for confirmation
 *   D. read job 515: status FUNDED, budget still exactly 1 U
 *   E. verify funding receipt + jobId-indexed log
 *   F. STOP — no settlement, no service execution.
 *
 * SECURITY RULES ENFORCED HERE (same as X.26):
 *   - Provider private key read ONLY from `.env.local`
 *     (`ALTANA_TESTNET_PRIVATE_KEY` via process.loadEnvFile). Never printed.
 *   - Derived signer must equal the verified payer EOA, or the script STOPS.
 *   - All targets pinned to the verified chain-97 table; any mismatch STOPS.
 *   - Mainnet (chain 56) refused. Job 515 is the ONLY job touched.
 *   - No other transaction is constructed or broadcast.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { BNB_TESTNET, buildHireCalls, erc8183Addresses, getErc8183Job } from "@altananetwork/sdk";
import { ALTANA_ERC8183_CHAIN_ID, resolveErc8183Config } from "./erc8183.js";
import { createAltanaClient } from "./client.js";
import { UNITED_STABLES_TOKEN } from "./registration-preview.js";

const PAYER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
const PROVIDER_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";
/** Verified chain-97 implementation addresses (X.27/X.28A evidence). */
const COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE";
const U_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565";
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";

/**
 * ABI shapes mirroring the SDK 0.7.0 canonical batch bit-for-bit (same as
 * X.28A), so calldata produced here is byte-identical to the SDK.
 */
const COMMERCE_FUND_ABI = [
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "expectedBudget", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

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
    console.log(`FAIL loading env file (${envPath}): ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const providerKey = process.env[PROVIDER_KEY_ENV];
const hasProviderKey = typeof providerKey === "string" && providerKey.trim().length > 0;

async function main(): Promise<void> {
  console.log("X.28C ERC-8183 JOB 515 FUNDING EXECUTION (chain 97):");

  // ---------------------------------------------------------------------------
  // PRE-SIGN SAFETY CHECKS (all 11 + signer derivation).
  // ---------------------------------------------------------------------------
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const commerce = getAddress(config.commerce);
  const token = getAddress(config.paymentToken);
  const sdkAddresses = erc8183Addresses(97);

  check(
    "runtime ERC-8183 config == verified chain-97 implementation",
    config.chainId === 97 &&
      commerce === getAddress(COMMERCE) &&
      getAddress(sdkAddresses.commerce) === getAddress(COMMERCE) &&
      token === getAddress(U_TOKEN) &&
      token === getAddress(UNITED_STABLES_TOKEN)
  );

  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  check("public RPC URL resolved", typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl ?? ""));
  if (typeof publicRpcUrl !== "string") process.exit(1);
  const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

  // 1. Chain id == 97.
  let liveChainId: bigint | undefined;
  try {
    liveChainId = BigInt(await publicClient.getChainId());
  } catch {
    liveChainId = undefined;
  }
  check("1. live eth_chainId == 97", liveChainId === 97n);
  if (liveChainId !== 97n) process.exit(1);

  // 2/3/4. Job 515 exists, OPEN, ours, budget exactly 1 U.
  let job;
  try {
    job = await getErc8183Job(BNB_TESTNET, JOB_ID);
  } catch {
    job = null;
  }
  check(`2. job 515 exists and is OPEN`, job !== null && job.id === JOB_ID && job.statusName === "OPEN" && job.status === 0);
  check(
    `3. job 515 client/provider == verified payer EOA`,
    job !== null &&
      job.client !== undefined && getAddress(String(job.client)) === getAddress(PAYER_EOA) &&
      job.provider !== undefined && getAddress(String(job.provider)) === getAddress(PAYER_EOA)
  );
  check(`4. job 515 budget == exactly 1 U (raw ${ONE_U_RAW.toString()})`, job !== null && BigInt(job.budget) === ONE_U_RAW);
  if (job === null || job.statusName !== "OPEN") {
    console.log("X.28C BLOCKED — job 515 is not OPEN. NO SIGNING.");
    process.exit(1);
  }

  // 5. Payer $U balance >= 1 U.
  const uBalance = BigInt(
    String(
      await publicClient.readContract({
        address: token,
        abi: ERC20_VIEW_ABI,
        functionName: "balanceOf",
        args: [getAddress(PAYER_EOA)],
      })
    )
  );
  check(`5. payer $U balance >= 1 U (live: ${uBalance.toString()} raw)`, uBalance >= ONE_U_RAW);

  // 6. Approval spender == verified AgenticCommerce.
  check(`6. approval spender == verified AgenticCommerce ${commerce}`, commerce === getAddress(COMMERCE));

  // 7. Token address from runtime config (already asserted above; re-assert).
  check(`7. $U token address == runtime config ${token}`, token === getAddress(U_TOKEN));

  // 8. Current allowance.
  const allowanceBefore = BigInt(
    String(
      await publicClient.readContract({
        address: token,
        abi: ERC20_VIEW_ABI,
        functionName: "allowance",
        args: [getAddress(PAYER_EOA), commerce],
      })
    )
  );
  check(`8. current allowance readable (live: ${allowanceBefore.toString()} raw)`, allowanceBefore === 0n || allowanceBefore < ONE_U_RAW);

  // 9/10. Approval amount == 1 U; funding call == fund(515, 1 U, "0x").
  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [commerce, ONE_U_RAW],
  });
  const fundData = encodeFunctionData({
    abi: COMMERCE_FUND_ABI,
    functionName: "fund",
    args: [JOB_ID, ONE_U_RAW, "0x"],
  });
  const sdkBatch = buildHireCalls({
    addresses: sdkAddresses,
    jobId: JOB_ID,
    provider: getAddress(PAYER_EOA),
    description: JOB_DESCRIPTION,
    budget: ONE_U_RAW,
    expiredAt: BigInt(job.expiredAt),
  }) as unknown as Array<{ to: string; data: `0x${string}` }>;
  const sdkApprove = sdkBatch[3];
  const sdkFund = sdkBatch[4];
  check("9. approval amount == exactly 1 U (raw 1e18)", approveData === sdkApprove?.data);
  check(
    `10. funding call == fund(515, 1e18, "0x") -> commerce (SDK-identical)`,
    fundData === sdkFund?.data && getAddress(String(sdkFund?.to)) === commerce && getAddress(String(sdkApprove?.to)) === token
  );

  // 11. Tx set contains ONLY approve + fund — no settlement, no service
  //     execution, no unrelated transfer (value 0 on both txs).
  const txSet: Array<{ to: `0x${string}`; data: `0x${string}`; value: bigint }> = [
    { to: token as `0x${string}`, data: approveData, value: 0n },
    { to: commerce as `0x${string}`, data: fundData, value: 0n },
  ];
  const allowlist = new Set([commerce, token].map((a) => getAddress(a)));
  const isFundSelector = fundData.startsWith("0xd2e13f50"); // fund(uint256,uint256,bytes)
  check(
    "11. tx set == approve($U) + fund(commerce) only; value 0; no settle/service/unrelated transfer",
    txSet.length === 2 &&
      txSet.every((tx) => allowlist.has(getAddress(tx.to))) &&
      txSet.every((tx) => tx.value === 0n) &&
      isFundSelector
  );
  check("11b. no settlement call constructed (tx set has exactly 2 entries)", txSet.length === 2);
  check(
    "11c. any payable-value transfer is excluded (both txs value 0)",
    txSet.length === 2 && txSet.every((tx) => tx.value === 0n)
  );

  // Signer derivation — env private key must match the verified payer EOA.
  let derivedAddress: `0x${string}` | null = null;
  if (hasProviderKey) {
    try {
      const raw = providerKey!.trim();
      const hexKey = raw.startsWith("0x") ? raw : `0x${raw}`;
      derivedAddress = getAddress(privateKeyToAccount(hexKey as `0x${string}`).address);
    } catch {
      derivedAddress = null;
    }
  }
  check("signer derived from env matches verified payer EOA", derivedAddress === getAddress(PAYER_EOA));

  const failed = checks.filter((entry) => !entry.ok);
  console.log(`X.28C pre-sign checks: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.log("X.28C BLOCKED — pre-sign safety check failed. NO SIGNING, NO BROADCAST.");
    process.exit(1);
  }

  // Final live re-reads immediately before signing.
  const finalChain = BigInt(await publicClient.getChainId());
  if (finalChain !== 97n) {
    console.log("X.28C BLOCKED — chain changed before signing. NO SIGNING.");
    process.exit(1);
  }
  const finalAllowance = BigInt(
    String(
      await publicClient.readContract({
        address: token,
        abi: ERC20_VIEW_ABI,
        functionName: "allowance",
        args: [getAddress(PAYER_EOA), commerce],
      })
    )
  );
  console.log(`X.28C FINAL RE-READ: chain 97; allowance before broadcast ${finalAllowance.toString()} raw.`);
  if (finalAllowance !== allowanceBefore) {
    console.log("X.28C BLOCKED — allowance changed since pre-flight. NO SIGNING.");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // SIGN + BROADCAST.
  // ---------------------------------------------------------------------------
  const raw = providerKey!.trim();
  const hexKey = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hexKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(publicRpcUrl) });

  async function sendAndWait(
    call: { to: `0x${string}`; data: `0x${string}`; value: bigint },
    label: string
  ): Promise<{ hash: `0x${string}`; block: bigint }> {
    console.log(`  [broadcast] ${label}`);
    const hash = await walletClient.sendTransaction({ account, to: call.to, data: call.data, value: call.value });
    console.log(`  transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") {
      throw new Error(`transaction reverted (hash ${hash})`);
    }
    console.log(`  block number: ${receipt.blockNumber.toString()}`);
    console.log(`  block hash: ${receipt.blockHash}`);
    return { hash, block: receipt.blockNumber };
  }

  console.log("");
  console.log("X.28C SIGNING AND BROADCAST (approve + fund ONLY):");
  try {
    // A. approve(commerce, 1 U) -> $U.
    const approveTx = await sendAndWait(txSet[0]!, "approve(AgenticCommerce, 1 U) -> $U");

    // B. Re-read allowance; must be >= 1 U before proceeding to fund.
    const allowanceAfterApprove = BigInt(
      String(
        await publicClient.readContract({
          address: token,
          abi: ERC20_VIEW_ABI,
          functionName: "allowance",
          args: [getAddress(PAYER_EOA), commerce],
        })
      )
    );
    check(`allowance after approve >= 1 U (live: ${allowanceAfterApprove.toString()} raw)`, allowanceAfterApprove >= ONE_U_RAW);
    if (allowanceAfterApprove < ONE_U_RAW) {
      console.log("X.28C BLOCKED — allowance below 1 U after approve. NO FUNDING TX.");
      process.exit(1);
    }

    // C. fund(515, 1 U, "0x") -> commerce.
    const fundTx = await sendAndWait(txSet[1]!, 'fund(515, 1 U, "0x") -> AgenticCommerce');

    // D. Read job 515 from chain: funded with exactly 1 U.
    const fundedJob = await getErc8183Job(BNB_TESTNET, JOB_ID);
    const fundedOk =
      fundedJob.id === JOB_ID &&
      fundedJob.statusName === "FUNDED" &&
      BigInt(fundedJob.budget) === ONE_U_RAW &&
      fundedJob.submittedAt === 0n &&
      BigInt(fundedJob.deliverable) === 0n;
    check(
      `job 515 funded with exactly 1 U (status ${fundedJob.statusName} (${fundedJob.status.toString()}), budget ${fundedJob.budget.toString()})`,
      fundedOk
    );

    // E. Verify funding receipt + jobId-indexed log.
    const fundReceipt = await publicClient.getTransactionReceipt({ hash: fundTx.hash });
    const fundTxRecord = await publicClient.getTransaction({ hash: fundTx.hash });
    let fundDecoded: { args?: readonly unknown[] } = {};
    try {
      fundDecoded = decodeFunctionData({ abi: COMMERCE_FUND_ABI, data: fundTxRecord.input });
    } catch {
      fundDecoded = {};
    }
    const fundArgs = fundDecoded.args as [bigint, bigint, string] | undefined;
    const fundLog = fundReceipt.logs.find(
      (log) =>
        log.address.toLowerCase() === commerce.toLowerCase() &&
        log.topics[0] !== undefined &&
        log.topics[1] !== undefined &&
        BigInt(log.topics[1]) === JOB_ID
    );
    const receiptOk =
      fundReceipt.status === "success" &&
      fundReceipt.blockNumber === fundTx.block &&
      getAddress(String(fundTxRecord.from)) === getAddress(PAYER_EOA) &&
      getAddress(String(fundTxRecord.to)) === commerce &&
      fundArgs !== undefined &&
      BigInt(String(fundArgs[0])) === JOB_ID &&
      BigInt(String(fundArgs[1])) === ONE_U_RAW &&
      fundArgs[2] === "0x" &&
      fundLog !== undefined;
    check(`funding receipt confirmed (block ${fundTx.block.toString()}, from payer, to commerce, fund(515,1 U,"0x"), jobId-indexed log)`, receiptOk);

    // Final balances after funding.
    const finalUBalance = BigInt(
      String(
        await publicClient.readContract({
          address: token,
          abi: ERC20_VIEW_ABI,
          functionName: "balanceOf",
          args: [getAddress(PAYER_EOA)],
        })
      )
    );
    const finalAllowanceAfter = BigInt(
      String(
        await publicClient.readContract({
          address: token,
          abi: ERC20_VIEW_ABI,
          functionName: "allowance",
          args: [getAddress(PAYER_EOA), commerce],
        })
      )
    );
    const finalTbnb = await publicClient.getBalance({ address: getAddress(PAYER_EOA) });

    // ---------------------------------------------------------------------------
    // Mandated final report.
    // ---------------------------------------------------------------------------
    console.log("");
    console.log("X.28C STATUS:");
    console.log(`APPROVAL TX: ${approveTx.hash} (block ${approveTx.block.toString()})`);
    console.log(`FUNDING TX: ${fundTx.hash} (block ${fundTx.block.toString()})`);
    console.log(`CHAIN: 97 (bnb-testnet)`);
    console.log(`JOB ID: ${JOB_ID.toString()}`);
    console.log(`FINAL $U BALANCE: ${finalUBalance.toString()} raw (${fundedJob.statusName} funding of exactly 1 U consumed)`);
    console.log(`FINAL ALLOWANCE: ${finalAllowanceAfter.toString()} raw`);
    console.log(`FINAL tBNB BALANCE: ${finalTbnb.toString()} raw`);
    console.log(`JOB 515 STATUS: ${fundedJob.statusName} (${fundedJob.status.toString()})`);
    console.log(`FUNDED AMOUNT: ${ONE_U_RAW.toString()} raw (exactly 1 U)`);
    console.log(`TOKEN: ${token} ($U)`);
    console.log(`SPENDER/FUNDING CONTRACT: ${commerce} (AgenticCommerce)`);
    console.log("SETTLEMENT: NOT PERFORMED");
    console.log("SERVICE EXECUTION: NOT PERFORMED");
    console.log("MAINNET: NOT TOUCHED");
    console.log("STOPPED AFTER FUNDING VERIFICATION — no settlement, no service execution started.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
    console.error(`X.28C FAILED: ${redacted}`);
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.28C FAILED: ${redacted}`);
  process.exit(1);
});