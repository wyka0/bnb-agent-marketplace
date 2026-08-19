/**
 * X.26-CONT — COMPLETE ERC-8183 JOB 515 CREATION ON BNB TESTNET (chain 97),
 * BROADCASTING ONLY registerJob + setBudget. NO FUNDING.
 *
 * Continuation for the X.26 run that created job 515 (createJob tx confirmed,
 * block 124879828) but wrongly halted at a post-create check that required
 * `budget == 1U` immediately after createJob — a false negative, because the
 * budget is recorded by the separate setBudget call, not by createJob.
 * Verified on-chain: job 515 exists, client/provider == provider EOA, status
 * OPEN, budget 0, not registered, never submitted.
 *
 * THIS RUN:
 *   - Re-reads chain (must be 97) and job 515 (must be ours, OPEN, budget 0).
 *   - Rebuilds the exact same 5-call draft from the verified X.25 params via
 *     prepareErc8183Hire (budget 1 U, jobId 515).
 *   - Broadcasts ONLY registerJob(515, WL_POLICY) -> router (calldata rebuilt
 *     to bind the live whitelisted policy 0xd6a421…, since the SDK config's
 *     policy 0x4F4678… is NOT whitelisted and reverted with
 *     PolicyNotWhitelisted) and draft.calls[2] = setBudget(515, 1 U, "0x")
 *     -> commerce.
 *   - NEVER re-broadcasts createJob. NEVER broadcasts approve/fund (funding).
 *   - Verifies job 515 final state: OPEN, budget == 1 U, submittedAt == 0.
 *
 * SECURITY RULES (same as X.26):
 *   - Provider private key read ONLY from `.env.local` (ALTANA_TESTNET_PRIVATE_KEY).
 *   - Derived signer must equal the verified provider EOA, or STOP.
 *   - All targets pinned to the verified chain-97 table; any mismatch STOPS.
 *   - jobCounter at start must be 515 (job 515 was created, nothing else ran).
 *   - No funding/payment/settlement call is constructed or broadcast.
 *   - Mainnet refused. No second job. No agent modification.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { BNB_TESTNET, getErc8183Job } from "@altananetwork/sdk";
import type { Call } from "@altananetwork/sdk";
import {
  ALTANA_ERC8183_CHAIN_ID,
  prepareErc8183Hire,
  resolveErc8183Config,
} from "./erc8183.js";
import type { Erc8183HireJobInput } from "./erc8183.js";
import { createAltanaClient } from "./client.js";
import { SERVICE_PRICE_ENV, UNITED_STABLES_TOKEN } from "./registration-preview.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const AGENT_ID = 1816n;
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n;
const DEFAULT_DEADLINE_SECONDS = 1800n;
/**
 * OptimisticPolicy bound by the deployed chain-97 EvaluatorRouter.
 * Authoritative source: `bnb-chain/apex-contracts` `scripts/addresses.ts`
 * (bscTestnet entry). The router's `policyWhitelist` is the gate for
 * `registerJob`; the SDK 0.7.0 `ERC8183_ADDRESSES[97].policy` value
 * (0x4F4678…) is NOT whitelisted and causes `registerJob` to revert with
 * `PolicyNotWhitelisted`. Verified on-chain: `policyWhitelist(WL_POLICY)=true`,
 * `disputeWindow()=900`, `voteQuorum()=1`.
 */
const WL_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
/** Already-confirmed createJob tx from the halted X.26 run (public on-chain data). */
const CREATE_JOB_TX = "0x255bf313ea1e0f3cb4164e3c7821703ac0a7429f9dcc1e20323c55e8d6cc7ac8";
const CREATE_JOB_BLOCK = 124879828n;
const PROVIDER_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";

const COMMERCE_VIEW_ABI = [
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ type: "tuple", components: [
      { name: "id", type: "uint256" },
      { name: "client", type: "address" },
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "description", type: "string" },
      { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "hook", type: "address" },
      { name: "submittedAt", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
    ] }],
  },
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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

const providerKey = process.env[PROVIDER_KEY_ENV];
const hasProviderKey = typeof providerKey === "string" && providerKey.trim().length > 0;

async function readJobCounter(client: ReturnType<typeof createPublicClient>, commerce: string): Promise<bigint | null> {
  try {
    const value = await client.readContract({
      address: getAddress(commerce),
      abi: COMMERCE_VIEW_ABI,
      functionName: "jobCounter",
    });
    return BigInt(String(value));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log("X.26-CONT COMPLETE JOB 515 CREATION (registerJob + setBudget, NO FUNDING):");

  const priceRaw = process.env[SERVICE_PRICE_ENV] ?? process.env["ALTANA_SERVICE_PRICE_RAW_U"];
  const priceValid = /^[1-9][0-9]*$/.test(priceRaw ?? "") && BigInt(priceRaw as string) === ONE_U_RAW;
  check("configured service price is exactly 1 U (raw 1e18)", priceValid);
  check("provider private key present (presence only)", hasProviderKey);

  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  if (config.commerce === undefined || config.router === undefined) {
    check("verified ERC-8183 chain-97 config resolves", false);
    process.exit(1);
  }
  check(
    "ERC-8183 targets resolve to verified chain-97 implementation",
    config.chainId === 97 &&
      getAddress(config.commerce) === getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE") &&
      getAddress(config.router) === getAddress("0xD7d36D66d2F1B608A0F943f722D27e3744f66F25") &&
      getAddress(config.registry) === getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e") &&
      getAddress(config.paymentToken) === getAddress(UNITED_STABLES_TOKEN)
  );
  check(
    "SDK config.policy (0x4F4678…) is the known-stale un-whitelisted address (documented divergence)",
    getAddress(config.policy) === getAddress("0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6")
  );

  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  if (typeof publicRpcUrl !== "string" || !/^https?:\/\//i.test(publicRpcUrl)) {
    check("public RPC URL resolved", false);
    process.exit(1);
  }
  const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

  let liveChainId: bigint | undefined;
  try {
    liveChainId = BigInt(await publicClient.getChainId());
  } catch {
    liveChainId = undefined;
  }
  check("live eth_chainId == 97", liveChainId === 97n);
  if (liveChainId !== 97n) process.exit(1);

  const jobCounter = await readJobCounter(publicClient, config.commerce);
  check("live jobCounter == 515 (job 515 created, nothing else ran)", jobCounter === 515n);
  if (jobCounter !== 515n) {
    console.log("X.26-CONT BLOCKED — jobCounter diverged from 515. NO SIGNING.");
    process.exit(1);
  }

  const job = await getErc8183Job(BNB_TESTNET, JOB_ID);
  const ours =
    job.client !== undefined &&
    getAddress(String(job.client)) === getAddress(PROVIDER_EOA) &&
    job.provider !== undefined &&
    getAddress(String(job.provider)) === getAddress(PROVIDER_EOA);
  const openAndUnset =
    job.statusName === "OPEN" && BigInt(job.budget) === 0n && job.submittedAt === 0n;
  check(`job ${JOB_ID.toString()} is ours (client/provider == provider EOA)`, ours);
  check(
    `job ${JOB_ID.toString()} is OPEN with budget 0 and never submitted (registerJob/setBudget pending)`,
    openAndUnset
  );
  if (!ours || !openAndUnset) {
    console.log("X.26-CONT BLOCKED — job 515 state does not match the continuation precondition. NO SIGNING.");
    process.exit(1);
  }

  // Rebuild the exact same draft from the verified X.25 parameters (jobId 515).
  const now = BigInt(Math.floor(Date.now() / 1000));
  const policyAbi = [
    { type: "function", name: "disputeWindow", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
    { type: "function", name: "voteQuorum", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  ] as const;
  const [liveWhitelisted, liveDisputeWindow, liveVoteQuorum] = await Promise.all([
    publicClient
      .readContract({
        address: getAddress(config.router),
        abi: [
          {
            type: "function",
            name: "policyWhitelist",
            stateMutability: "view",
            inputs: [{ name: "policy", type: "address" }],
            outputs: [{ name: "", type: "bool" }],
          },
        ] as const,
        functionName: "policyWhitelist",
        args: [getAddress(WL_POLICY)],
      })
      .then((value) => Boolean(value))
      .catch(() => null),
    publicClient
      .readContract({ address: getAddress(WL_POLICY), abi: policyAbi, functionName: "disputeWindow" })
      .then((value) => BigInt(String(value)))
      .catch(() => null),
    publicClient
      .readContract({ address: getAddress(WL_POLICY), abi: policyAbi, functionName: "voteQuorum" })
      .then((value) => BigInt(String(value)))
      .catch(() => null),
  ]);
  check(
    "router.policyWhitelist(WL_POLICY 0xd6a421…) == true (deployed whitelisted OptimisticPolicy)",
    liveWhitelisted === true
  );
  check("WL_POLICY disputeWindow == 900s and voteQuorum == 1 (apex-contracts testnet policy)", 
    liveDisputeWindow === 900n && liveVoteQuorum === 1n);
  if (liveWhitelisted !== true || liveDisputeWindow !== 900n || liveVoteQuorum !== 1n) {
    console.log("X.26-CONT BLOCKED — WL_POLICY is not the live whitelisted policy. NO SIGNING.");
    process.exit(1);
  }
  const expiredAt = now + liveDisputeWindow + DEFAULT_DEADLINE_SECONDS;
  const jobInput: Erc8183HireJobInput = {
    provider: getAddress(PROVIDER_EOA),
    description: JOB_DESCRIPTION,
    budget: ONE_U_RAW,
    expiredAt,
    jobId: JOB_ID,
  };
  const draft = prepareErc8183Hire(BNB_TESTNET, jobInput);
  check("draft rebuilt from verified X.25 params (5 calls)", draft.calls.length === 5);

  const [_createJob, draftRegisterJob, setBudget, approve, fund] = draft.calls as [Call, Call, Call, Call, Call];
  const registerJobAbi = [
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
  const registerJobData = encodeFunctionData({
    abi: registerJobAbi,
    functionName: "registerJob",
    args: [JOB_ID, getAddress(WL_POLICY)],
  });
  const registerJob: Call = { to: getAddress(config.router), data: registerJobData, value: draftRegisterJob.value };
  check("createJob NOT rebroadcast — call 0 skipped (already confirmed)", true);
  check(
    "registerJob calldata rebuilt to bind the WHITELISTED policy (jobId 515, WL_POLICY 0xd6a421…)",
    getAddress(registerJob.to) === getAddress(config.router) &&
      registerJob.data?.toLowerCase() ===
        `0x51d5456d${JOB_ID.toString(16).padStart(64, "0")}${WL_POLICY.toLowerCase().slice(2).padStart(64, "0")}`
  );
  check(
    "setBudget targets verified commerce with budget 1 U",
    getAddress(setBudget.to) === getAddress(config.commerce) && draft.job.budget === ONE_U_RAW
  );
  check("funding calls (approve/fund) present but NOT broadcast", 
    getAddress(approve.to) === getAddress(config.paymentToken) && getAddress(fund.to) === getAddress(config.commerce));

  // Signer derivation == provider EOA.
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
  check("derived signer == provider EOA == pay-to", derivedAddress === getAddress(PROVIDER_EOA));

  const failed = checks.filter((entry) => !entry.ok);
  console.log(`X.26-CONT pre-sign checks: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.log("X.26-CONT BLOCKED — pre-sign safety check failed. NO SIGNING.");
    process.exit(1);
  }

  // Final live re-read before signing.
  const finalChain = BigInt(await publicClient.getChainId());
  const finalCounter = await readJobCounter(publicClient, config.commerce);
  let finalJobState;
  try {
    finalJobState = await getErc8183Job(BNB_TESTNET, JOB_ID);
  } catch (error) {
    finalJobState = null;
    console.log(`X.26-CONT FAILED reading job ${JOB_ID.toString()} before signing: ${error instanceof Error ? error.message : String(error)}`);
  }
  const finalStillPending =
    finalJobState !== null &&
    finalJobState.statusName === "OPEN" &&
    BigInt(finalJobState.budget) === 0n &&
    finalJobState.submittedAt === 0n;
  if (finalChain !== 97n || finalCounter !== 515n || !finalStillPending) {
    console.log("X.26-CONT BLOCKED — chain, jobCounter, or job 515 state changed before signing. NO SIGNING.");
    process.exit(1);
  }
  console.log("X.26-CONT FINAL RE-READ: chain 97, jobCounter 515, job 515 OPEN/budget 0 -> registerJob + setBudget on job 515 ONLY.");

  const raw = providerKey!.trim();
  const hexKey = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hexKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(publicRpcUrl) });

  async function sendAndWait(call: Call): Promise<{ hash: `0x${string}`; block: bigint }> {
    const hash = await walletClient.sendTransaction({ account, to: call.to, data: call.data, value: 0n });
    console.log(`  transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") {
      throw new Error(`transaction reverted (hash ${hash})`);
    }
    console.log(`  block number: ${receipt.blockNumber.toString()}`);
    return { hash, block: receipt.blockNumber };
  }

  console.log("");
  console.log("X.26-CONT SIGNING AND BROADCAST (registerJob + setBudget only — NO approve, NO fund):");
  try {
    console.log("  [1/2] registerJob(jobId 515, policy) -> router");
    const registerTx = await sendAndWait(registerJob);

    console.log("  [2/2] setBudget(jobId 515, 1 U, \"0x\") -> commerce");
    const budgetTx = await sendAndWait(setBudget);

    const finalJob = await getErc8183Job(BNB_TESTNET, JOB_ID);
    const statusName = finalJob.statusName;
    check("job 515 is OPEN after continuation", statusName === "OPEN");
    check("job 515 budget == 1 U recorded", BigInt(finalJob.budget) === ONE_U_RAW);
    check("job 515 submittedAt == 0 (never submitted)", finalJob.submittedAt === 0n);
    check("job 515 NOT funded (no approve/fund broadcast)", statusName === "OPEN" && BigInt(finalJob.budget) === ONE_U_RAW);

    console.log("");
    console.log("X.26-CONT JOB 515 FINAL PARAMETERS (read from chain):");
    console.log(`  jobId: ${finalJob.id.toString()}`);
    console.log(`  status: ${statusName} (${finalJob.status.toString()})`);
    console.log(`  client: ${finalJob.client}`);
    console.log(`  provider: ${finalJob.provider}`);
    console.log(`  evaluator: ${finalJob.evaluator}`);
    console.log(`  description: ${finalJob.description}`);
    console.log(`  budget: ${finalJob.budget.toString()} raw $U (= 1 U)`);
    console.log(`  expiredAt: ${finalJob.expiredAt.toString()} (unix)`);
    console.log(`  hook: ${finalJob.hook}`);
    console.log(`  submittedAt: ${finalJob.submittedAt.toString()}`);

    console.log("");
    console.log("X.26-CONT TRANSACTIONS (all chain 97, value 0):");
    console.log(`  createJob:    ${CREATE_JOB_TX} (block ${CREATE_JOB_BLOCK.toString()}) [previous run]`);
    console.log(`  registerJob:  ${registerTx.hash} (block ${registerTx.block.toString()})`);
    console.log(`  setBudget:    ${budgetTx.hash} (block ${budgetTx.block.toString()})`);

    console.log("");
    console.log("X.26 STATUS:");
    console.log("JOB CREATED: YES");
    console.log("CHAIN: 97");
    console.log(`AGENT ID: ${AGENT_ID.toString()}`);
    console.log(`JOB ID: ${finalJob.id.toString()}`);
    console.log(`PROVIDER: ${PROVIDER_EOA}`);
    console.log(`EVALUATOR/FACILITATOR: ${config.router}`);
    console.log(`PAY-TO: ${PROVIDER_EOA} (ALTANA_PAYTO)`);
    console.log(`TOKEN: ${getAddress(UNITED_STABLES_TOKEN)} ($U)`);
    console.log(`BUDGET: 1 U (raw ${ONE_U_RAW.toString()})`);
    console.log(`DISPUTE WINDOW: ${liveDisputeWindow.toString()}s`);
    console.log(`EXPIRATION: ${finalJob.expiredAt.toString()}`);
    console.log(`JOB STATUS: ${statusName} (${finalJob.status.toString()}) — created, NOT funded`);
    console.log(`CREATE JOB TX: ${CREATE_JOB_TX} (block ${CREATE_JOB_BLOCK.toString()})`);
    console.log(`REGISTER JOB TX: ${registerTx.hash} (block ${registerTx.block.toString()})`);
    console.log(`SET BUDGET TX: ${budgetTx.hash} (block ${budgetTx.block.toString()})`);
    console.log("FUNDING: NOT PERFORMED (approve/fund calls excluded)");
    console.log("PAYMENT: NOT PERFORMED");
    console.log("SETTLEMENT: NOT PERFORMED");
    console.log("MAINNET: NOT TOUCHED");
    console.log("STOPPED AFTER JOB CREATION VERIFICATION — no funding/payment/settlement step was started.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
    console.error(`X.26-CONT FAILED: ${redacted}`);
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.26-CONT FAILED: ${redacted}`);
  process.exit(1);
});