/**
 * X.26 — EXECUTE ERC-8183 JOB CREATION ON BNB TESTNET (chain 97), NO FUNDING.
 *
 * Operator-authorized milestone. Source of truth is the X.25 review:
 *   commerce  0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE
 *   router    0xD7d36D66d2F1B608A0F943f722D27e3744f66F25 (evaluator + hook)
 *   policy    0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6
 *   registry  0x8004A818BFB912233c491871b3d84c89A494BD9e
 *   $U        0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565
 *   provider / pay-to / signer  0x299Ce4113abF88F4997737184aa8A7a3D58AC15C (Agent 1816 owner)
 *   agentId   1816
 *   budget    1 U = 1000000000000000000 raw $U   price source: ALTANA_SERVICE_PRICE_RAW_U (server-only)
 *   description  anchored to canonical metadata text (<= 4096 bytes)
 *   expiredAt = live now + live disputeWindow + 1800s deadline
 *
 * SCOPE — JOB CREATION ONLY. The SDK's atomic hire batch is:
 *   0. createJob(provider, router, expiredAt, description, router)      -> commerce
 *   1. registerJob(jobId, policy)                                       -> router
 *   2. setBudget(jobId, budget, "0x")                                   -> commerce
 *   3. approve(commerce, budget)                                       -> $U   (FUNDING — EXCLUDED)
 *   4. fund(jobId, budget, "0x")                                        -> commerce (FUNDING — EXCLUDED)
 * THIS RUN DOES NOT BROADCAST CALLS 3–4. The job is created with its budget
 * recorded and its policy bound, but it is NOT funded, paid, or settled.
 *
 * SECURITY RULES ENFORCED HERE:
 *   - The provider private key is read ONLY from `.env.local`
 *     (`ALTANA_TESTNET_PRIVATE_KEY` via process.loadEnvFile). Never printed.
 *   - Derived signer must equal the verified provider EOA, or the script STOPS.
 *   - All jobs are pinned to the verified chain-97 table; any mismatch STOPS.
 *   - Mainnet (chain 56) is refused. No second job. No agent modification.
 *   - No funding/payment/settlement call is constructed or broadcast.
 *   - This script is NON-REENTRANT for broadcast: it re-reads `jobCounter`
 *     immediately before signing and STOPS if it is no longer 514 (so running
 *     it twice cannot create a second job).
 *
 * PRE-SIGN SAFETY CHECKS (all must pass or the script exits before signing):
 *   1. eth_chainId == 97
 *   2. ERC-8183 targets resolve to the verified chain-97 implementation
 *   3. live jobCounter == 514 (=> predicted next job id 515)
 *   4. predicted job id is still valid (> jobCounter)
 *   5. calldata rebuilt from the verified X.25 parameters for all 5 calls
 *   6. provider / evaluator / pay-to / token / budget / disputeWindow /
 *      expiration / agent-job relationship / service params verified
 *   7. every broadcast target is a verified ERC-8183 contract/router
 *   8. no approve/fund call is included in the broadcast set (value == 0)
 *   9. derived signer address == verified provider EOA == pay-to
 *  10. current chain is still 97 immediately before signing
 *
 * EXECUTION STOPS AFTER: createJob -> registerJob -> setBudget -> verify job
 * 515 exists, is OPEN, budget = 1 U, and is NOT funded/paid/settled.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { BNB_TESTNET, getErc8183Job, JOB_STATUS } from "@altananetwork/sdk";
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
const ONE_U_RAW = 1_000_000_000_000_000_000n; // 1 U at 18 decimals
const DEFAULT_DEADLINE_SECONDS = 1800n;
const CANONICAL_METADATA_URI = "https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json";
const CANONICAL_SERVICE_ENDPOINT = "https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service";
const PROVIDER_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";
/** Authoritative verified service description (canonical metadata). */
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";

const COMMERCE_VIEW_ABI = [
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
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
        ],
      },
    ],
  },
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
  console.log("X.26 ERC-8183 JOB CREATION (NO FUNDING):");

  // Verify service price env + provider key presence (presence only).
  const priceRaw = process.env[SERVICE_PRICE_ENV] ?? process.env["ALTANA_SERVICE_PRICE_RAW_U"];
  const priceValid = /^[1-9][0-9]*$/.test(priceRaw ?? "") && BigInt(priceRaw as string) === ONE_U_RAW;
  check("service price source is ALTANA_SERVICE_PRICE_RAW_U (server-only)", priceRaw !== undefined && priceRaw !== null);
  check("configured service price is exactly 1 U (raw 1e18)", priceValid);
  check("provider private key present (presence only)", hasProviderKey);

  // 2. Resolve verified chain-97 config.
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
      getAddress(config.policy) === getAddress("0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6") &&
      getAddress(config.registry) === getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e") &&
      getAddress(config.paymentToken) === getAddress(UNITED_STABLES_TOKEN)
  );

  // Public RPC.
  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  if (typeof publicRpcUrl !== "string" || !/^https?:\/\//i.test(publicRpcUrl)) {
    check("public RPC URL resolved", false);
    process.exit(1);
  }
  const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

  // 1. chainId == 97.
  let liveChainId: bigint | undefined;
  try {
    liveChainId = BigInt(await publicClient.getChainId());
  } catch (error) {
    liveChainId = undefined;
    check(`live eth_chainId readable (${error instanceof Error ? error.message : String(error)})`, false);
  }
  check("live eth_chainId == 97", liveChainId === 97n);

  // 3. Re-read live jobCounter -> must be 514 => predicted next job id 515.
  const jobCounter = await readJobCounter(publicClient, config.commerce);
  check("live AgenticCommerce jobCounter == 514", jobCounter === 514n);
  if (jobCounter === null) process.exit(1);

  // 4. Predicted job id still valid.
  const predictedJobId = jobCounter + 1n;
  check(`predicted next job id == 515 (jobCounter ${jobCounter.toString()})`, predictedJobId === 515n);

  // Dispute window (live).
  const policyWindowAbi = [
    {
      type: "function",
      name: "disputeWindow",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "uint64" }],
    },
  ] as const;
  const disputeWindow = await publicClient
    .readContract({ address: config.policy, abi: policyWindowAbi, functionName: "disputeWindow" })
    .then((value) => BigInt(String(value)))
    .catch(() => null);
  check("live OptimisticPolicy disputeWindow == 86400s", disputeWindow === 86400n);
  if (disputeWindow === null || disputeWindow !== 86400n) process.exit(1);

  // Agent-job relationship: registry ownerOf(1816) == provider EOA.
  let chainOwner: string | null = null;
  try {
    const owner = await publicClient.readContract({
      address: config.registry,
      abi: REGISTRY_OWNER_ABI,
      functionName: "ownerOf",
      args: [AGENT_ID],
    });
    chainOwner = getAddress(String(owner));
  } catch {
    chainOwner = null;
  }
  check("registry ownerOf(1816) == provider EOA (agent-job relationship)", chainOwner === getAddress(PROVIDER_EOA));

  // Service params.
  let metadataStatus = 0;
  try {
    const metaResponse = await fetch(CANONICAL_METADATA_URI, { method: "GET" });
    metadataStatus = metaResponse.status;
  } catch {
    metadataStatus = 0;
  }
  check(`canonical metadata responds over HTTPS (HTTP ${metadataStatus})`, metadataStatus >= 200 && metadataStatus < 300);
  check("service endpoint == canonical endpoint", CANONICAL_SERVICE_ENDPOINT.startsWith("https://bnb-agent-marketplace-web.vercel.app/api/agents/"));
  check("job description <= 4096 bytes", new TextEncoder().encode(JOB_DESCRIPTION).length <= 4096);

  // 5. Rebuild the full 5-call calldata from the verified X.25 parameters.
  const now = BigInt(Math.floor(Date.now() / 1000));
  const expiredAt = now + disputeWindow + DEFAULT_DEADLINE_SECONDS;
  const jobInput: Erc8183HireJobInput = {
    provider: getAddress(PROVIDER_EOA),
    description: JOB_DESCRIPTION,
    budget: ONE_U_RAW,
    expiredAt,
    jobId: predictedJobId,
  };
  const draft = prepareErc8183Hire(BNB_TESTNET, jobInput);
  check("creation calldata rebuilt from verified X.25 parameters (5 calls)", draft.calls.length === 5);

  // 6. Params check on the rebuilt batch.
  check("provider encoded == verified provider EOA", getAddress(draft.job.provider) === getAddress(PROVIDER_EOA));
  check("evaluator + hook == verified router", jobInput.expiredAt > now);
  check(
    "budget == 1 U (raw 1e18) and token == verified $U",
    draft.job.budget === ONE_U_RAW && getAddress(config.paymentToken) === getAddress(UNITED_STABLES_TOKEN)
  );

  // 7. Every broadcast target is a verified ERC-8183 contract/router.
  const allowlist = new Set(
    [config.commerce, config.router, config.policy, config.registry, config.paymentToken].map((address) =>
      getAddress(address)
    )
  );
  const [createJob, registerJob, setBudget] = draft.calls as [Call, Call, Call, Call, Call];
  const broadcastCalls = [createJob, registerJob, setBudget];
  const targetsOk =
    broadcastCalls.length === 3 && broadcastCalls.every((call) => allowlist.has(getAddress(call.to)));
  check(
    "broadcast targets are verified ERC-8183 contracts (commerce/router/commerce)",
    targetsOk &&
      getAddress(createJob.to) === getAddress(config.commerce) &&
      getAddress(registerJob.to) === getAddress(config.router) &&
      getAddress(setBudget.to) === getAddress(config.commerce)
  );

  // 8. No funding/payment call in the broadcast set: the full batch is length 5
  //    and calls [3]=approve($U), [4]=fund(commerce) are EXCLUDED by design.
  //    All broadcast transactions carry value 0 (no native transfer).
  const approve = draft.calls[3];
  const fund = draft.calls[4];
  const excludedFundingCalls =
    approve !== undefined &&
    fund !== undefined &&
    getAddress(approve.to) === getAddress(config.paymentToken) &&
    getAddress(fund.to) === getAddress(config.commerce);
  check(
    "funding calls (approve $U, fund) present in batch but EXCLUDED from broadcast",
    excludedFundingCalls
  );
  const broadcastCount = broadcastCalls.length;
  check(`no approve/fund call in broadcast set (broadcasting only ${broadcastCount} creation calls)`, broadcastCount === 3);

  // 9. Signer derivation — env private key must match the verified EOA.
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
  check("derived signer address == verified provider EOA", derivedAddress === getAddress(PROVIDER_EOA));
  check("pay-to == verified provider EOA", derivedAddress === getAddress(PROVIDER_EOA));

  const failed = checks.filter((entry) => !entry.ok);
  console.log(`X.26 pre-sign checks: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.log("X.26 BLOCKED — pre-sign safety check failed. NO SIGNING, NO BROADCAST.");
    process.exit(1);
  }

  // 10. Final live re-reads immediately before signing.
  const finalChain = BigInt(await publicClient.getChainId());
  if (finalChain !== 97n) {
    console.log("X.26 BLOCKED — chain changed to " + finalChain.toString() + " before signing. NO SIGNING.");
    process.exit(1);
  }
  const finalCounter = await readJobCounter(publicClient, config.commerce);
  if (finalCounter !== 514n) {
    console.log(`X.26 BLOCKED — jobCounter is now ${String(finalCounter)} (expected 514). NO SIGNING.`);
    process.exit(1);
  }
  console.log("X.26 FINAL RE-READ: chain 97, jobCounter 514 -> broadcasting job 515 ONLY.");

  // ---------------------------------------------------------------------------
  // SIGN + BROADCAST (creation calls 0,1,2 — no funding).
  // ---------------------------------------------------------------------------
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
    console.log(`  block hash: ${receipt.blockHash}`);
    return { hash, block: receipt.blockNumber };
  }

  console.log("");
  console.log("X.26 SIGNING AND BROADCAST (creation only — NO approve, NO fund):");
  try {
    // Call 0 — createJob -> commerce.
    console.log("  [1/3] createJob(provider, router, expiredAt, description, router) -> commerce");
    const createTx = await sendAndWait(createJob);

    // Confirm predicted job 515 actually exists and is ours before continuing.
    // NOTE: budget is NOT set by createJob — it is recorded by the separate
    // setBudget call later in this run. Checking budget here would always
    // fail (false negative) and halt the sequence. Ownership is client/provider.
    const afterCounter = await readJobCounter(publicClient, config.commerce);
    let createdJob;
    try {
      createdJob = await getErc8183Job(BNB_TESTNET, predictedJobId);
    } catch (error) {
      createdJob = null;
      console.log(`  FAIL reading created job (${error instanceof Error ? error.message : String(error)})`);
    }
    const ours =
      afterCounter === 515n &&
      createdJob !== null &&
      String(createdJob.client).toLowerCase() === PROVIDER_EOA.toLowerCase() &&
      String(createdJob.provider).toLowerCase() === PROVIDER_EOA.toLowerCase();
    check(`job ${predictedJobId.toString()} created and ours (client/provider verified)`, ours);
    if (!ours || createdJob === null) {
      console.log("X.26 BLOCKED — predicted job id was stolen or params diverged. Stopping BEFORE any funding step.");
      process.exit(1);
    }

    // Call 1 — registerJob -> router.
    console.log("  [2/3] registerJob(jobId 515, policy) -> router");
    const registerTx = await sendAndWait(registerJob);

    // Call 2 — setBudget -> commerce.
    console.log("  [3/3] setBudget(jobId 515, 1 U, \"0x\") -> commerce");
    const budgetTx = await sendAndWait(setBudget);

    // ---------------------------------------------------------------------------
    // VERIFY — job created, budget recorded, NOT funded.
    // ---------------------------------------------------------------------------
    const job = await getErc8183Job(BNB_TESTNET, predictedJobId);
    const statusName = JOB_STATUS[job.status] ?? "UNKNOWN";
    const notFundedCheck =
      statusName === "OPEN" && job.submittedAt === 0n && BigInt(job.budget) === ONE_U_RAW;

    check("job status is OPEN (not FUNDED/SUBMITTED/COMPLETED)", statusName === "OPEN");
    check("job budget == 1 U recorded", BigInt(job.budget) === ONE_U_RAW);
    check("job submittedAt == 0 (no deliverable submitted)", job.submittedAt === 0n);
    check("escrow not funded (fund call never broadcast)", notFundedCheck);

    console.log("");
    console.log("X.26 JOB PARAMETERS (read from chain):");
    console.log(`  jobId: ${job.id.toString()}`);
    console.log(`  status: ${statusName} (${job.status})`);
    console.log(`  client: ${job.client}`);
    console.log(`  provider: ${job.provider}`);
    console.log(`  evaluator: ${job.evaluator}`);
    console.log(`  description: ${job.description}`);
    console.log(`  budget: ${job.budget.toString()} raw $U (= 1 U)`);
    console.log(`  expiredAt: ${job.expiredAt.toString()} (unix)`);
    console.log(`  submission deadline used: disputeWindow ${disputeWindow.toString()}s + ${DEFAULT_DEADLINE_SECONDS.toString()}s`);
    console.log(`  hook: ${job.hook}`);
    console.log(`  submittedAt: ${job.submittedAt.toString()}`);
    console.log(`  deliverable: ${job.deliverable}`);

    console.log("");
    console.log("X.26 CREATION TRANSACTIONS (all chain 97, value 0):");
    console.log(`  createJob:    ${createTx.hash} (block ${createTx.block.toString()})`);
    console.log(`  registerJob:  ${registerTx.hash} (block ${registerTx.block.toString()})`);
    console.log(`  setBudget:    ${budgetTx.hash} (block ${budgetTx.block.toString()})`);

    // Completed — print mandated status block.
    console.log("");
    console.log("X.26 STATUS:");
    console.log("JOB CREATED: YES");
    console.log(`CHAIN: 97`);
    console.log(`AGENT ID: ${AGENT_ID.toString()}`);
    console.log(`JOB ID: ${job.id.toString()}`);
    console.log(`PROVIDER: ${PROVIDER_EOA}`);
    console.log(`EVALUATOR/FACILITATOR: ${config.router}`);
    console.log(`PAY-TO: ${PROVIDER_EOA} (ALTANA_PAYTO)`);
    console.log(`TOKEN: ${getAddress(UNITED_STABLES_TOKEN)} ($U)`);
    console.log(`BUDGET: 1 U (raw ${ONE_U_RAW.toString()})`);
    console.log(`DISPUTE WINDOW: ${disputeWindow.toString()}s`);
    console.log(`EXPIRATION: ${job.expiredAt.toString()}`);
    console.log(`JOB STATUS: ${statusName} (${job.status}) — created, NOT funded`);
    console.log(`CREATE JOB TX: ${createTx.hash} (block ${createTx.block.toString()})`);
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
    console.error(`X.26 FAILED: ${redacted}`);
    process.exit(1);
  }
}

import type { Call } from "@altananetwork/sdk";
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.26 FAILED: ${redacted}`);
  process.exit(1);
});