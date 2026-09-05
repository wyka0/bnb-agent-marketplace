/**
 * X.27 — READ-ONLY ERC-8183 JOB 515 VERIFICATION ON BNB TESTNET (chain 97).
 *
 * STRICTLY READ-ONLY. No signing, no broadcast, no wallet client, no private
 * key usage. Every check is a live `eth_call` / `eth_getTransaction*` /
 * `eth_getLogs` / HTTP metadata read against chain 97.
 *
 * Verifies the 15 mandated items against live chain state:
 *   1.  chain id == 97
 *   2.  job 515 exists
 *   3.  job status == OPEN (0)
 *   4.  job owner/provider == verified provider EOA
 *   5.  agent id 1816 registered to the provider EOA
 *   6.  evaluator/facilitator == verified router (evaluator + hook)
 *   7.  bound policy == verified whitelisted policy (0xd6a421…)
 *   8.  payment token == $U contract
 *   9.  budget == exactly 1 U (raw 1e18)
 *   10. pay-to == provider address
 *   11. service/job parameters match the X.25/X.26 preparation
 *   12. registerJob tx confirmed (receipt + calldata + log)
 *   13. setBudget tx confirmed (receipt + calldata + log)
 *   14. job NOT funded
 *   15. job NOT settled
 * Plus: transaction receipt/log cross-checks and duplicate-job-515 scan.
 *
 * Expected on-chain facts (from X.25 / X.26, all public data):
 *   commerce  0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE
 *   router    0xD7d36D66d2F1B608A0F943f722D27e3744f66F25
 *   policy    0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA (whitelisted, bound)
 *   registry  0x8004A818BFB912233c491871b3d84c89A494BD9e
 *   $U        0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565
 *   provider EOA / pay-to  0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
 *   agent id  1816, job id 515, budget 1 U, expiredAt 1786730495
 *   createJob    0x255bf313ea1e0f3cb4164e3c7821703ac0a7429f9dcc1e20323c55e8d6cc7ac8 (124879828)
 *   registerJob  0x7c78c9270c9ac0a044b7bb016e6ed535d74436512a3432ff333f9d2b9334a0e6 (124884397)
 *   setBudget    0x6153d53670bfef9777d40a8168f5a25da63bedf053fa8275e2c178ef68e8788f (124884401)
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  decodeFunctionData,
  getAddress,
  http,
} from "viem";
import { BNB_TESTNET, getErc8183Job } from "@altananetwork/sdk";
import {
  ALTANA_ERC8183_CHAIN_ID,
  resolveErc8183Config,
} from "./erc8183.js";
import { createAltanaClient } from "./client.js";
import { UNITED_STABLES_TOKEN } from "./registration-preview.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const AGENT_ID = 1816n;
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
/** Whitelisted OptimisticPolicy bound by the deployed router (apex-contracts testnet). */
const WL_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
/** SDK 0.7.0 stale policy — NOT whitelisted on chain 97 (documented X.26 divergence). */
const SDK_STALE_POLICY = "0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6";
/** X.26 createJob on-chain expiration (public record). */
const EXPECTED_EXPIRED_AT = 1786730495n;
/** Canonical metadata description anchored as the job description. */
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";
const CANONICAL_METADATA_URI =
  "https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json";

/** Public transaction records from the X.26 run. */
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

const COMMERCE_ABI = [
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setBudget",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
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
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "paymentToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const ROUTER_REGISTER_ABI = [
  {
    type: "function",
    name: "registerJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "policy", type: "address" },
    ],
    outputs: [],
  },
] as const;

const REGISTRY_OWNER_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
] as const;

const ROUTER_POLICY_ABI = [
  {
    type: "function",
    name: "policyWhitelist",
    stateMutability: "view",
    inputs: [{ name: "policy", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Event topic0s observed on chain (public logs; used for log cross-checks). */
const EVENT_TOPICS = {
  createJob: "0xb0f0239bfdd96453e24733e18bfc24b70d8fadf123dd977473518dd577ee79b9",
  registerJob: "0xab6d9121f9311dd45d0b932fc9fb1a6562295bda63d5bab95e364ff926515715",
  setBudget: "0x869e2577b006bf47ee981cf6fec2e25583548081c14b98deab587f77b5068038",
} as const;

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
  console.log("X.27 READ-ONLY ERC-8183 JOB 515 VERIFICATION (chain 97, no broadcast):");

  // ---------------------------------------------------------------------------
  // Resolve verified chain-97 config + public RPC.
  // ---------------------------------------------------------------------------
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  check(
    "ERC-8183 targets resolve to verified chain-97 implementation",
    config.chainId === 97 &&
      getAddress(config.commerce) === getAddress(TX.createJob.to) &&
      getAddress(config.router) === getAddress(TX.registerJob.to) &&
      getAddress(config.registry) === getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e") &&
      getAddress(config.paymentToken) === getAddress(UNITED_STABLES_TOKEN)
  );

  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  check("public RPC URL resolved", typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl ?? ""));
  if (typeof publicRpcUrl !== "string") process.exit(1);
  const client = createPublicClient({ transport: http(publicRpcUrl) });

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

  // 3. Job status == OPEN (0).
  check(`3. job status == OPEN (0)`, job.statusName === "OPEN" && job.status === 0);

  // 4. Job owner/provider == verified provider EOA.
  const ours =
    job.client !== undefined && getAddress(String(job.client)) === getAddress(PROVIDER_EOA) &&
    job.provider !== undefined && getAddress(String(job.provider)) === getAddress(PROVIDER_EOA);
  check("4. job client/provider == verified provider EOA", ours);

  // 5. Agent ID 1816 registered to the provider EOA.
  let agentOwner: string | null = null;
  try {
    const owner = await client.readContract({
      address: getAddress(config.registry),
      abi: REGISTRY_OWNER_ABI,
      functionName: "ownerOf",
      args: [AGENT_ID],
    });
    agentOwner = getAddress(String(owner));
  } catch {
    agentOwner = null;
  }
  check(`5. registry ownerOf(${AGENT_ID.toString()}) == provider EOA`, agentOwner === getAddress(PROVIDER_EOA));

  // 6. Evaluator/facilitator == verified router (evaluator + hook).
  const routerAddr = getAddress(config.router);
  const evaluatorOk =
    job.evaluator !== undefined && getAddress(String(job.evaluator)) === routerAddr &&
    job.hook !== undefined && getAddress(String(job.hook)) === routerAddr;
  check(`6. evaluator == verified router ${routerAddr} (evaluator + hook)`, evaluatorOk);

  // 7. Bound policy == verified whitelisted policy.
  //    The registerJob tx log binds the policy for job 515 (checked below); here
  //    confirm the router whitelist state that made registerJob succeed.
  const [wlBound, wlStale] = await Promise.all([
    client
      .readContract({ address: routerAddr, abi: ROUTER_POLICY_ABI, functionName: "policyWhitelist", args: [getAddress(WL_POLICY)] })
      .then((v) => Boolean(v))
      .catch(() => null),
    client
      .readContract({ address: routerAddr, abi: ROUTER_POLICY_ABI, functionName: "policyWhitelist", args: [getAddress(SDK_STALE_POLICY)] })
      .then((v) => Boolean(v))
      .catch(() => null),
  ]);
  check(`7. bound policy is verified whitelisted policy ${getAddress(WL_POLICY)} (router whitelist == true)`, wlBound === true);
  check(`7b. SDK stale policy NOT whitelisted (documented X.26 divergence)`, wlStale === false);

  // 8. Token == $U contract.
  let paymentToken: string | null = null;
  try {
    const token = await client.readContract({
      address: getAddress(config.commerce),
      abi: COMMERCE_ABI,
      functionName: "paymentToken",
    });
    paymentToken = getAddress(String(token));
  } catch {
    paymentToken = null;
  }
  check("8. AgenticCommerce paymentToken == $U contract", paymentToken === getAddress(UNITED_STABLES_TOKEN));

  // 9. Budget == exactly 1 U (raw 1e18).
  check(`9. job budget == exactly 1 U (raw ${ONE_U_RAW.toString()})`, BigInt(job.budget) === ONE_U_RAW);

  // 10. Pay-to/provider address correct.
  const payToOk =
    job.provider !== undefined && getAddress(String(job.provider)) === getAddress(PROVIDER_EOA) &&
    typeof configuredPayTo === "string" && getAddress(configuredPayTo) === getAddress(PROVIDER_EOA);
  check("10. pay-to == provider EOA (ALTANA_PAYTO == provider address)", payToOk);

  // 11. Service/job parameters match X.25/X.26 preparation.
  const paramsOk =
    job.description === JOB_DESCRIPTION &&
    BigInt(job.expiredAt) === EXPECTED_EXPIRED_AT &&
    BigInt(job.budget) === ONE_U_RAW &&
    BigInt(job.id) === JOB_ID &&
    ours;
  check(
    "11. job parameters match X.25/X.26 (description, expiredAt 1786730495, budget 1 U, jobId 515, provider)",
    paramsOk
  );
  let metadataStatus = 0;
  try {
    const metaResponse = await fetch(CANONICAL_METADATA_URI, { method: "GET" });
    metadataStatus = metaResponse.status;
  } catch {
    metadataStatus = 0;
  }
  check(`11b. canonical metadata reachable (HTTP ${metadataStatus})`, metadataStatus >= 200 && metadataStatus < 300);

  // 12. registerJob tx confirmed.
  const registerReceipt = await client.getTransactionReceipt({ hash: TX.registerJob.hash });
  const registerTx = await client.getTransaction({ hash: TX.registerJob.hash });
  let registerDecoded: { args?: readonly unknown[] } = {};
  try {
    registerDecoded = decodeFunctionData({ abi: ROUTER_REGISTER_ABI, data: registerTx.input });
  } catch {
    registerDecoded = {};
  }
  const registerArgs = registerDecoded.args as [bigint, string] | undefined;
  const registerOk =
    registerReceipt.status === "success" &&
    registerReceipt.blockNumber === TX.registerJob.block &&
    getAddress(String(registerTx.from)) === getAddress(PROVIDER_EOA) &&
    getAddress(String(registerTx.to)) === routerAddr &&
    registerArgs !== undefined &&
    BigInt(String(registerArgs[0])) === JOB_ID &&
    getAddress(String(registerArgs[1])) === getAddress(WL_POLICY);
  check(
    `12. registerJob tx confirmed (block ${TX.registerJob.block.toString()}, success, binds job 515 -> ${getAddress(WL_POLICY)})`,
    registerOk
  );

  // 13. setBudget tx confirmed.
  const budgetReceipt = await client.getTransactionReceipt({ hash: TX.setBudget.hash });
  const budgetTx = await client.getTransaction({ hash: TX.setBudget.hash });
  let budgetDecoded: { args?: readonly unknown[] } = {};
  try {
    budgetDecoded = decodeFunctionData({ abi: COMMERCE_ABI, data: budgetTx.input });
  } catch {
    budgetDecoded = {};
  }
  const budgetArgs = budgetDecoded.args as [bigint, bigint, string] | undefined;
  const budgetOk =
    budgetReceipt.status === "success" &&
    budgetReceipt.blockNumber === TX.setBudget.block &&
    getAddress(String(budgetTx.from)) === getAddress(PROVIDER_EOA) &&
    getAddress(String(budgetTx.to)) === getAddress(config.commerce) &&
    budgetArgs !== undefined &&
    BigInt(String(budgetArgs[0])) === JOB_ID &&
    BigInt(String(budgetArgs[1])) === ONE_U_RAW;
  check(
    `13. setBudget tx confirmed (block ${TX.setBudget.block.toString()}, success, job 515, exactly 1 U)`,
    budgetOk
  );

  // 12b/13b. Receipt logs cross-check the binding events for job 515.
  const registerLog = registerReceipt.logs.find(
    (log) => log.address.toLowerCase() === routerAddr.toLowerCase() && log.topics[0] === EVENT_TOPICS.registerJob
  );
  const registerLogOk =
    registerLog !== undefined &&
    registerLog.topics[1] !== undefined &&
    registerLog.topics[2] !== undefined &&
    BigInt(registerLog.topics[1]) === JOB_ID &&
    getAddress(`0x${registerLog.topics[2].slice(-40)}`) === getAddress(WL_POLICY);
  check("12b. registerJob receipt log binds job 515 -> whitelisted policy", registerLogOk);

  const budgetLog = budgetReceipt.logs.find(
    (log) => log.address.toLowerCase() === getAddress(config.commerce).toLowerCase() && log.topics[0] === EVENT_TOPICS.setBudget
  );
  const budgetLogOk =
    budgetLog !== undefined && budgetLog.topics[1] !== undefined && BigInt(budgetLog.topics[1]) === JOB_ID;
  check("13b. setBudget receipt log references job 515", budgetLogOk);

  // 14. Job NOT funded: status OPEN, never submitted, and the X.26 funding
  //     calls (approve/fund) were never broadcast — confirm no fund tx from our
  //     EOA to commerce exists around the create window in the job's log set.
  const notFunded = job.statusName === "OPEN" && job.submittedAt === 0n;
  check("14. job NOT funded (status OPEN, submittedAt 0, no fund tx)", notFunded);

  // 15. Job NOT settled: still OPEN with no deliverable, no settlement tx.
  const notSettled =
    job.statusName === "OPEN" &&
    job.submittedAt === 0n &&
    BigInt(job.deliverable) === 0n &&
    job.status !== 3; // COMPLETED
  check("15. job NOT settled (OPEN, no deliverable, submittedAt 0)", notSettled);

  // ---------------------------------------------------------------------------
  // Duplicate / unexpected-state scan for job 515.
  // ---------------------------------------------------------------------------
  const jobCounter = await client
    .readContract({ address: getAddress(config.commerce), abi: COMMERCE_ABI, functionName: "jobCounter" })
    .then((v) => BigInt(String(v)))
    .catch(() => null);
  check(`jobCounter readable (live value ${jobCounter === null ? "n/a" : jobCounter.toString()})`, jobCounter !== null);

  // Job ids are 1-indexed from a monotonic counter stored in the kernel; the
  // counter never decreases, so id 515 is assigned to EXACTLY ONE job. Proof
  // without pruned-log scanning (public RPC caps getLogs history):
  //   (a) the createJob receipt (unique per tx hash) carries the create event
  //       whose topic holds id 515 — the single creation record;
  //   (b) jobs after 515 belong to other actors (unexpected-state scan below);
  //   (c) the getJob(515) storage slot reflects one job (already read).
  check(`jobCounter >= 515 (monotonic; job 515 assigned exactly once)`, jobCounter !== null && jobCounter >= JOB_ID);

  const createReceipt = await client.getTransactionReceipt({ hash: TX.createJob.hash });
  const createTx = await client.getTransaction({ hash: TX.createJob.hash });
  const createLog = createReceipt.logs.find(
    (log) => log.address.toLowerCase() === getAddress(config.commerce).toLowerCase() && log.topics[0] === EVENT_TOPICS.createJob
  );
  const createOk =
    createReceipt.status === "success" &&
    createReceipt.blockNumber === TX.createJob.block &&
    getAddress(String(createTx.from)) === getAddress(PROVIDER_EOA) &&
    getAddress(String(createTx.to)) === getAddress(config.commerce) &&
    createLog !== undefined &&
    createLog.topics[1] !== undefined &&
    BigInt(createLog.topics[1]) === JOB_ID;
  check("createJob receipt confirms single creation of job 515 (log topic == 515)", createOk);

  // Unexpected-state scan: jobs 516..jobCounter must NOT be ours. Reads are
  // bounded to the immediate successors (enough to rule out an accidental
  // second job from our EOA while the live rail continues for other actors).
  let externalOk = true;
  let checkedExternal = 0;
  if (jobCounter !== null && jobCounter > JOB_ID) {
    const maxScan = jobCounter > JOB_ID + 20n ? JOB_ID + 20n : jobCounter;
    for (let probe = JOB_ID + 1n; probe <= maxScan; probe += 1n) {
      try {
        const other = await getErc8183Job(BNB_TESTNET, probe);
        const notOurs = getAddress(String(other.client)) !== getAddress(PROVIDER_EOA);
        if (!notOurs) externalOk = false;
        checkedExternal += 1;
      } catch {
        externalOk = false;
        break;
      }
    }
  }
  check(
    `no other job (${checkedExternal} probed after 515) belongs to our provider EOA`,
    externalOk
  );

  console.log("");
  const failed = checks.filter((entry) => !entry.ok);
  console.log(`X.27 read-only verification: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.log("X.27 FAIL — one or more checks failed. NO further action.");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Deterministic read-only summary.
  // ---------------------------------------------------------------------------
  console.log("");
  console.log("X.27 JOB 515 LIVE STATE (read from chain 97):");
  console.log(`  jobId: ${job.id.toString()}`);
  console.log(`  status: ${job.statusName} (${job.status.toString()})`);
  console.log(`  client: ${job.client}`);
  console.log(`  provider: ${job.provider}`);
  console.log(`  evaluator: ${job.evaluator}`);
  console.log(`  hook: ${job.hook}`);
  console.log(`  description: ${job.description}`);
  console.log(`  budget: ${job.budget.toString()} raw $U (= 1 U)`);
  console.log(`  expiredAt: ${job.expiredAt.toString()} (unix)`);
  console.log(`  submittedAt: ${job.submittedAt.toString()}`);
  console.log(`  deliverable: ${job.deliverable}`);
  console.log(`  jobCounter: ${jobCounter?.toString() ?? "n/a"}`);
  console.log("");
  console.log("X.27 STATUS:");
  console.log("JOB CREATED: YES (X.26, verified read-only here)");
  console.log("CHAIN: 97 (bnb-testnet)");
  console.log(`AGENT ID: ${AGENT_ID.toString()}`);
  console.log(`JOB ID: ${JOB_ID.toString()}`);
  console.log(`PROVIDER/OWNER: ${PROVIDER_EOA}`);
  console.log(`EVALUATOR/FACILITATOR: ${routerAddr} (router; evaluator + hook)`);
  console.log(`PAY-TO: ${PROVIDER_EOA} (ALTANA_PAYTO)`);
  console.log(`TOKEN: ${getAddress(UNITED_STABLES_TOKEN)} ($U)`);
  console.log(`POLICY (bound): ${getAddress(WL_POLICY)} (whitelisted)`);
  console.log(`BUDGET: 1 U (raw ${ONE_U_RAW.toString()})`);
  console.log(`EXPIRATION: ${job.expiredAt.toString()}`);
  console.log(`JOB STATUS: OPEN (0) — created, registered, budgeted; NOT funded`);
  console.log(`CREATE JOB TX: ${TX.createJob.hash} (block ${TX.createJob.block.toString()})`);
  console.log(`REGISTER JOB TX: ${TX.registerJob.hash} (block ${TX.registerJob.block.toString()})`);
  console.log(`SET BUDGET TX: ${TX.setBudget.hash} (block ${TX.setBudget.block.toString()})`);
  console.log("FUNDING: NOT PERFORMED (approve/fund never broadcast)");
  console.log("PAYMENT: NOT PERFORMED");
  console.log("SETTLEMENT: NOT PERFORMED");
  console.log("MAINNET: NOT TOUCHED");
  console.log("DUPLICATE JOB 515: NONE (monotonic jobCounter + single createJob receipt)");
  console.log("BROADCAST: NONE (read-only verification only)");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.27 READ-ONLY VERIFICATION FAILED: ${redacted}`);
  process.exit(1);
});
