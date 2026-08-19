/**
 * X.28A — READ-ONLY ERC-8183 JOB 515 FUNDING / PAYMENT REVIEW (chain 97).
 *
 * STRICTLY READ-ONLY. No signing, no broadcast, no approval execution, no
 * fund/transfer/payment/settlement, no private key usage. Every check is a
 * live `eth_call` / `eth_getStorageAt` / `eth_simulate`-style simulated call
 * against chain 97 (state is never mutated; eth_call simulation is discarded).
 *
 * Determines the deterministic funding transaction set that WOULD fund job 515:
 *   call A: approve(spender = AgenticCommerce, amount = 1 U)  -> $U token
 *   call B: fund(jobId = 515, expectedBudget = 1 U, "0x")     -> AgenticCommerce
 * and verifies every prerequisite live, so a downstream EXECUTION milestone
 * can act only when this review reports READY.
 *
 * Mandated checks:
 *   1.  chain id == 97
 *   2.  job 515 exists
 *   3.  job status == OPEN (not funded / not settled / not expired)
 *   4.  job client + provider == verified provider EOA (payer)
 *   5.  current funded amount == 0 (OPEN, submittedAt 0, budget exact)
 *   6.  payment token == $U (live contract read + metadata)
 *   7.  contracts/router match verified chain-97 deployment
 *   8.  funding ABI == fund(jobId, expectedBudget, optParams) on commerce
 *   9.  funding amount == exactly 1 U (raw 1e18)
 *   10. approval state == live allowance(provider, commerce) on $U
 *   11. spender == AgenticCommerce (escrow), no unrelated recipient
 *   12. funding call == fund(515, 1 U, "0x") -> commerce, deterministic calldata
 *   13. no settlement / no service execution included in the preview
 *   14. preview targets are chain-97 addresses (never 56/mainnet)
 *   15. address consistency across live reads, SDK config, and X.26 runs
 * Plus: simulated (read-only) approval + funding outcome, payer feasibility.
 *
 * Expected on-chain facts (from X.25 / X.26 / X.27, all public data):
 *   provider EOA / payer / pay-to  0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
 *   commerce (AgenticCommerce)     0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE
 *   router (EvaluatorRouter)       0xD7d36D66d2F1B608A0F943f722D27e3744f66F25
 *   policy (whitelisted, bound)    0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA
 *   registry                       0x8004A818BFB912233c491871b3d84c89A494BD9e
 *   $U (United Stables)            0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565
 *   agent id 1816, job id 515, budget 1 U, expiredAt 1786730495, status OPEN
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  http,
} from "viem";
import {
  BNB_TESTNET,
  buildHireCalls,
  erc8183Addresses,
  getErc8183Job,
} from "@altananetwork/sdk";
import {
  ALTANA_ERC8183_CHAIN_ID,
  resolveErc8183Config,
} from "./erc8183.js";
import { createAltanaClient } from "./client.js";
import { UNITED_STABLES_TOKEN } from "./registration-preview.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
const EXPECTED_EXPIRED_AT = 1786730495n;
/** Canonical metadata description anchored as the job description. */
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";

/** Public transaction records from the X.26 run (no funding tx among them). */
const TX = {
  createJob: {
    hash: "0x255bf313ea1e0f3cb4164e3c7821703ac0a7429f9dcc1e20323c55e8d6cc7ac8",
    block: 124879828n,
    to: "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
  },
  registerJob: {
    hash: "0x7c78c9270c9ac0a044b7bb016e6ed535d74436512a3432ff333f9d2b9334a0e6",
    block: 124884397n,
    to: "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25",
  },
  setBudget: {
    hash: "0x6153d53670bfef9777d40a8168f5a25da63bedf053fa8275e2c178ef68e8788f",
    block: 124884401n,
    to: "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE",
  },
} as const;

/** Second independent public RPC for payer-balance cross-checking. */
const CROSS_CHECK_RPC = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

/**
 * ABI shapes mirroring the SDK 0.7.0 canonical batch bit-for-bit, so calldata
 * produced here is identical to what the SDK's buildHireCalls would build.
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
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
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

const COMMERCE_PAYMENT_TOKEN_ABI = [
  {
    type: "function",
    name: "paymentToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
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

/** Pay-to is a public address config; never rendered, only compared. */
const configuredPayTo = process.env["ALTANA_PAYTO"];

async function main(): Promise<void> {
  console.log("X.28A READ-ONLY ERC-8183 JOB 515 FUNDING/PAYMENT REVIEW (chain 97, no broadcast):");

  // ---------------------------------------------------------------------------
  // Resolve verified chain-97 config + public RPC.
  // ---------------------------------------------------------------------------
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const sdkAddresses = erc8183Addresses(97);
  const commerceAddr = getAddress(config.commerce);
  const routerAddr = getAddress(config.router);
  const tokenAddr = getAddress(UNITED_STABLES_TOKEN);
  check(
    "ERC-8183 targets resolve to verified chain-97 implementation",
    config.chainId === 97 &&
      commerceAddr === getAddress(sdkAddresses.commerce) &&
      getAddress(config.paymentToken) === tokenAddr &&
      commerceAddr === getAddress(TX.createJob.to) &&
      routerAddr === getAddress(TX.registerJob.to)
  );

  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  check("public RPC URL resolved", typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl ?? ""));
  if (typeof publicRpcUrl !== "string") process.exit(1);
  const client = createPublicClient({ transport: http(publicRpcUrl) });
  const crossClient = createPublicClient({ transport: http(CROSS_CHECK_RPC) });

  // 1. Chain ID == 97.
  let liveChainId: bigint | undefined;
  try {
    liveChainId = BigInt(await client.getChainId());
  } catch {
    liveChainId = undefined;
  }
  check("1. live eth_chainId == 97", liveChainId === 97n);
  if (liveChainId !== 97n) process.exit(1);

  // 2. Job 515 exists.
  let job;
  try {
    job = await getErc8183Job(BNB_TESTNET, JOB_ID);
    check(`2. job ${JOB_ID.toString()} exists on chain`, job.id === JOB_ID);
  } catch (error) {
    job = null;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL 2. job ${JOB_ID.toString()} exists on chain (${message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]")})`);
    process.exit(1);
  }

  // 3. Job status == OPEN (0) -> not funded, not settled, not expired.
  check(`3. job status == OPEN (0)`, job.statusName === "OPEN" && job.status === 0);
  if (job.statusName !== "OPEN" || job.status !== 0) {
    console.log("X.28A BLOCKED: job 515 is not OPEN.");
    printBlockerSummary(job, null, null, null, null, null);
    process.exit(0);
  }

  // 4. Job client/provider == verified provider EOA (the payer).
  const ours =
    job.client !== undefined && getAddress(String(job.client)) === getAddress(PROVIDER_EOA) &&
    job.provider !== undefined && getAddress(String(job.provider)) === getAddress(PROVIDER_EOA);
  check("4. job client/provider == verified provider EOA (payer)", ours);

  // 5. Current funded amount == 0 (status OPEN + submittedAt 0 + budget exact).
  const budgetOk = BigInt(job.budget) === ONE_U_RAW;
  const fundedZero =
    job.statusName === "OPEN" && job.submittedAt === 0n && BigInt(job.deliverable) === 0n && budgetOk;
  check("5. current funded amount == 0 (OPEN, submittedAt 0, no fund tx)", fundedZero);

  // 6. Payment token == $U (live contract read + metadata).
  let paymentToken: string | null = null;
  try {
    const token = await client.readContract({
      address: commerceAddr,
      abi: COMMERCE_PAYMENT_TOKEN_ABI,
      functionName: "paymentToken",
    });
    paymentToken = getAddress(String(token));
  } catch {
    paymentToken = null;
  }
  check("6. AgenticCommerce paymentToken == $U contract", paymentToken === tokenAddr);

  let tokenMeta: { name: string; symbol: string; decimals: bigint } | null = null;
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address: tokenAddr, abi: ERC20_VIEW_ABI, functionName: "name" }),
      client.readContract({ address: tokenAddr, abi: ERC20_VIEW_ABI, functionName: "symbol" }),
      client.readContract({ address: tokenAddr, abi: ERC20_VIEW_ABI, functionName: "decimals" }),
    ]);
    tokenMeta = { name: String(name), symbol: String(symbol), decimals: BigInt(String(decimals)) };
    check(`6b. token metadata live (${tokenMeta.name} / ${tokenMeta.symbol} / ${tokenMeta.decimals.toString()} decimals)`, tokenMeta.decimals === 18n);
  } catch {
    tokenMeta = null;
    check("6b. token metadata live read", false);
  }

  // 7. Contracts/router match verified chain-97 deployment (already checked
  //    above); re-assert against values bound in the job itself.
  const jobHasVerifiedRouter =
    job.evaluator !== undefined && getAddress(String(job.evaluator)) === routerAddr &&
    job.hook !== undefined && getAddress(String(job.hook)) === routerAddr;
  check(`7. job evaluator + hook == verified router ${routerAddr}`, jobHasVerifiedRouter);

  // 8. Funding ABI == fund(jobId, expectedBudget, optParams) on commerce and
  //    the exact SDK funding step. Verified by building the canonical batch
  //    and decoding the funding call.
  let sdkBatch: Array<{ to: `0x${string}`; data: `0x${string}` }> = [];
  try {
    sdkBatch = buildHireCalls({
      addresses: sdkAddresses,
      jobId: JOB_ID,
      provider: getAddress(PROVIDER_EOA),
      expiredAt: EXPECTED_EXPIRED_AT,
      budget: ONE_U_RAW,
      description: JOB_DESCRIPTION,
    }) as unknown as Array<{ to: `0x${string}`; data: `0x${string}` }>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL SDK batch build (${message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]")})`);
  }
  const sdkFund = sdkBatch[4];
  const sdkApprove = sdkBatch[3];
  let fundDecoded: { args?: readonly unknown[] } = {};
  try {
    if (sdkFund !== undefined) {
      fundDecoded = decodeFunctionData({ abi: COMMERCE_FUND_ABI, data: sdkFund.data });
    }
  } catch {
    fundDecoded = {};
  }
  const fundArgs = fundDecoded.args as [bigint, bigint, string] | undefined;
  const fundAbiOk =
    sdkBatch.length === 5 &&
    sdkFund !== undefined &&
    getAddress(sdkFund.to) === commerceAddr &&
    fundArgs !== undefined &&
    BigInt(String(fundArgs[0])) === JOB_ID &&
    BigInt(String(fundArgs[1])) === ONE_U_RAW &&
    fundArgs[2] === "0x";
  check(`8. funding ABI matches fund(jobId, expectedBudget, optParams) -> commerce (SDK canonical step 5)`, fundAbiOk);

  // 9. Funding amount == exactly 1 U (raw 1e18) — in the call and on the job.
  check(`9. funding amount == exactly 1 U (raw ${ONE_U_RAW.toString()})`, fundAbiOk && budgetOk);

  // 10. Approval state: live allowance(provider, commerce) on $U.
  let allowance: bigint | null = null;
  try {
    allowance = BigInt(
      String(
        await client.readContract({
          address: tokenAddr,
          abi: ERC20_VIEW_ABI,
          functionName: "allowance",
          args: [getAddress(PROVIDER_EOA), commerceAddr],
        })
      )
    );
  } catch {
    allowance = null;
  }
  check("10. live allowance(provider -> commerce) on $U readable", allowance !== null);

  // 11. Spender == AgenticCommerce (escrow, the only recipient); the fund
  //     route pays the kernel, which escrows for job 515 — no unrelated
  //     recipient anywhere in the funding path.
  let approveData: `0x${string}` | null = null;
  try {
    approveData = encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [commerceAddr, ONE_U_RAW],
    });
  } catch {
    approveData = null;
  }
  const approveMatch = sdkApprove !== undefined && approveData !== null && sdkApprove.data === approveData;
  const spenderOk =
    approveData !== null &&
    sdkApprove !== undefined &&
    getAddress(String(decodeFunctionData({ abi: ERC20_APPROVE_ABI, data: approveData }).args[0])) === commerceAddr &&
    getAddress(sdkApprove.to) === tokenAddr;
  check("11. spender == AgenticCommerce escrow; no unrelated recipient (approve -> $U, fund -> commerce)", spenderOk && approveMatch);

  // 12. Deterministic funding calldata (identical to the SDK canonical batch).
  let fundData: `0x${string}` | null = null;
  try {
    fundData = encodeFunctionData({
      abi: COMMERCE_FUND_ABI,
      functionName: "fund",
      args: [JOB_ID, ONE_U_RAW, "0x"],
    });
  } catch {
    fundData = null;
  }
  const fundMatch = sdkFund !== undefined && fundData !== null && sdkFund.data === fundData;
  check("12. funding call == fund(515, 1 U, \"0x\") -> commerce (deterministic calldata, SDK-identical)", fundMatch);

  // 13. Preview contains ONLY the two funding calls — no settlement, no
  //     service execution, no createJob/registerJob/setBudget re-run.
  const preview = [
    { to: tokenAddr, data: approveData, label: "approve($U -> commerce, 1 U)" },
    { to: commerceAddr, data: fundData, label: "fund(515, 1 U, \"0x\") -> commerce" },
  ].filter((entry) => entry.data !== null) as Array<{
    to: string;
    data: `0x${string}`;
    label: string;
  }>;
  check("13. preview contains ONLY approve + fund (no settlement, no service execution)", preview.length === 2);

  // 14. All preview targets are chain-97 addresses.
  const targetsOk =
    preview.length === 2 &&
    preview.every(
      (entry) =>
        entry.to.toLowerCase() === tokenAddr.toLowerCase() ||
        entry.to.toLowerCase() === commerceAddr.toLowerCase()
    );
  check("14. preview targets are chain-97 contracts (never mainnet 56)", targetsOk);

  // 15. Address consistency: every live source agrees.
  const addressConsistency =
    paymentToken === tokenAddr &&
    commerceAddr === getAddress(sdkAddresses.commerce) &&
    routerAddr === getAddress(sdkAddresses.router) &&
    getAddress(config.paymentToken) === tokenAddr &&
    (typeof configuredPayTo !== "string" || getAddress(configuredPayTo) === getAddress(PROVIDER_EOA));
  check("15. address consistency (live reads == SDK config == X.25/X.26 records)", addressConsistency);

  // ---------------------------------------------------------------------------
  // Read-only simulated outcome (eth_call — state never mutated).
  // ---------------------------------------------------------------------------

  // Approve would succeed next block; simulation returns the bool.
  let approveSim: `0x${string}` | null = null;
  try {
    approveSim = (await client.call({
      account: getAddress(PROVIDER_EOA),
      to: tokenAddr,
      data: approveData ?? undefined,
    })) as unknown as `0x${string}`;
  } catch (error) {
    approveSim = null;
    console.log(`  (approve simulation reverted: ${error instanceof Error ? error.message : String(error)} — informational)`);
  }
  check("sim. approve(1 U) from payer simulated successfully (eth_call, discarded)", approveSim !== null);

  // Fund as-is would revert today: allowance 0 and payer balance 0.
  let fundSim: `0x${string}` | null = null;
  let fundSimError = "";
  try {
    fundSim = (await client.call({
      account: getAddress(PROVIDER_EOA),
      to: commerceAddr,
      data: fundData ?? undefined,
    })) as unknown as `0x${string}`;
  } catch (error) {
    fundSim = null;
    fundSimError = error instanceof Error ? error.message : String(error);
  }
  check("sim. fund(515, 1 U) from payer reverts with current balance/allowance (expected)", fundSim === null);

  // 16. Payer feasibility: balance must be >= 1 U to fund.
  let balance: bigint | null = null;
  try {
    balance = BigInt(
      String(
        await client.readContract({
          address: tokenAddr,
          abi: ERC20_VIEW_ABI,
          functionName: "balanceOf",
          args: [getAddress(PROVIDER_EOA)],
        })
      )
    );
  } catch {
    balance = null;
  }
  let crossBalance: bigint | null = null;
  try {
    crossBalance = BigInt(
      String(
        await crossClient.readContract({
          address: tokenAddr,
          abi: ERC20_VIEW_ABI,
          functionName: "balanceOf",
          args: [getAddress(PROVIDER_EOA)],
        })
      )
    );
  } catch {
    crossBalance = null;
  }
  check(
    `16. payer $U balance >= 1 U (live: ${balance?.toString() ?? "n/a"}; cross-RPC: ${crossBalance?.toString() ?? "n/a"})`,
    balance !== null && crossBalance !== null && balance >= ONE_U_RAW && crossBalance >= ONE_U_RAW
  );

  console.log("");
  const failures = checks.filter((entry) => !entry.ok);
  const contracFailures = failures.filter((entry) => !/sim\.|16\./.test(entry.label));
  console.log(`X.28A read-only funding review: ${checks.length - failures.length}/${checks.length} checks passed`);
  if (contracFailures.length > 0) {
    console.log("X.28A FAIL — one or more core checks failed. NO further action.");
    printBlockerSummary(job, balance, crossBalance, allowance, approveData, fundData);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Deterministic read-only funding preview.
  // ---------------------------------------------------------------------------
  const approvalRequired = allowance === null || allowance < ONE_U_RAW;
  const canFund = balance !== null && balance >= ONE_U_RAW;

  printFundingPreview({
    job,
    balance,
    crossBalance,
    allowance,
    approveData,
    fundData,
    approvalRequired,
    canFund,
    fundSimError,
  });

  if (!canFund) {
    console.log("");
    console.log("REVIEW COMPLETE — FUNDING EXECUTION BLOCKED (payer $U balance is 0).");
    console.log("NO approval, funding, payment or settlement was performed.");
    process.exit(0);
  }
}

function printBlockerSummary(
  job: unknown,
  balance: bigint | null,
  crossBalance: bigint | null,
  allowance: bigint | null,
  approveData: `0x${string}` | null,
  fundData: `0x${string}` | null
): void {
  console.log("");
  console.log("X.28A BLOCKER SUMMARY:");
  console.log(`  job status: ${job === null ? "n/a" : String((job as { statusName: string }).statusName)}`);
  console.log(`  payer $U balance: ${balance?.toString() ?? "n/a"} (cross-RPC: ${crossBalance?.toString() ?? "n/a"})`);
  console.log(`  allowance -> commerce: ${allowance?.toString() ?? "n/a"}`);
  console.log(`  approve calldata: ${approveData ?? "n/a"} (FOR REVIEW ONLY)`);
  console.log(`  fund calldata: ${fundData ?? "n/a"} (FOR REVIEW ONLY)`);
  console.log("  CURRENT STATUS: BLOCKED — funding cannot execute until payer holds >= 1 U.");
  console.log("  SIGNING: NOT PERFORMED. BROADCAST: NOT PERFORMED. PAYMENT: NOT PERFORMED.");
  console.log("  SETTLEMENT: NOT PERFORMED. MAINNET: NOT TOUCHED.");
}

function printFundingPreview(args: {
  job: {
    id: bigint;
    statusName: string;
    status: number;
    client: unknown;
    provider: unknown;
    budget: bigint;
    submittedAt: bigint;
  };
  balance: bigint | null;
  crossBalance: bigint | null;
  allowance: bigint | null;
  approveData: `0x${string}` | null;
  fundData: `0x${string}` | null;
  approvalRequired: boolean;
  canFund: boolean;
  fundSimError: string;
}): void {
  console.log("");
  console.log("X.28A JOB 515 FUNDING PREVIEW (read from chain 97, deterministic):");
  console.log(`  jobId: ${args.job.id.toString()}`);
  console.log(`  status: ${args.job.statusName} (${args.job.status.toString()})`);
  console.log(`  client: ${args.job.client}`);
  console.log(`  provider: ${args.job.provider}`);
  console.log(`  budget: ${args.job.budget.toString()} raw $U (= 1 U)`);
  console.log(`  current funded amount: 0 (OPEN, submittedAt ${args.job.submittedAt.toString()})`);
  console.log("");
  console.log("X.28A DETERMINISTIC FUNDING TX SET (review only — NOT broadcast):");
  console.log(`  [A] to ${getAddress("0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565")} ($U)`);
  console.log(`      approve(spender = ${getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE")}, amount = 1e18)`);
  console.log(`      calldata: ${args.approveData ?? "n/a"}`);
  console.log(`  [B] to ${getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE")} (AgenticCommerce)`);
  console.log(`      fund(jobId = 515, expectedBudget = 1e18, optParams = "0x")`);
  console.log(`      calldata: ${args.fundData ?? "n/a"}`);
  console.log("");
  console.log("X.28A STATUS:");
  console.log("REVIEW: COMPLETE");
  console.log("JOB: 515");
  console.log("CHAIN: 97 (bnb-testnet)");
  console.log("CURRENT JOB STATUS: OPEN (0)");
  console.log("CURRENT FUNDED AMOUNT: 0");
  console.log("TOKEN: United Stables ($U)");
  console.log("TOKEN DECIMALS: 18");
  console.log(`FUNDING AMOUNT: 1 U (raw ${ONE_U_RAW.toString()})`);
  console.log(`SPENDER: ${getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE")} (AgenticCommerce — escrow)`);
  console.log(`FUNDING CONTRACT: ${getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE")} (AgenticCommerce)`);
  console.log(`APPROVAL REQUIRED: ${args.approvalRequired ? "YES" : "NO"} (live allowance ${args.allowance?.toString() ?? "n/a"})`);
  console.log(`APPROVAL AMOUNT: ${ONE_U_RAW.toString()} (1 U)`);
  console.log('FUNDING CALL: fund(515, 1000000000000000000, "0x") -> AgenticCommerce');
  console.log("CALLDATA: GENERATED FOR REVIEW ONLY");
  console.log("SIGNING: NOT PERFORMED");
  console.log("BROADCAST: NOT PERFORMED");
  console.log("PAYMENT: NOT PERFORMED");
  console.log("SETTLEMENT: NOT PERFORMED");
  console.log("MAINNET: NOT TOUCHED");
  console.log(`PAYER $U BALANCE: ${args.balance?.toString() ?? "n/a"} (cross-RPC: ${args.crossBalance?.toString() ?? "n/a"})`);
  console.log(`FUNDING EXECUTION FEASIBLE: ${args.canFund ? "YES" : "NO — payer holds 0 U; fund would revert"}`);
  if (!args.canFund) {
    console.log("X.28A STATUS: BLOCKED");
    console.log("BLOCKER: payer EOA holds 0 $U on chain 97; deposit >= 1 U (e.g. $U faucet) before funding.");
  } else {
    console.log("X.28A STATUS: READY");
  }
  if (args.fundSimError) {
    console.log(`(eth_call fund simulation reverted with current state: ${args.fundSimError.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]")})`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.28A READ-ONLY REVIEW FAILED: ${redacted}`);
  process.exit(1);
});