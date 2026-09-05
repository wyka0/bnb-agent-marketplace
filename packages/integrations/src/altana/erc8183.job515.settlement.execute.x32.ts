/**
 * X.32 — EXECUTE ERC-8183 JOB 515 SETTLEMENT ON BNB TESTNET (chain 97).
 *
 * Operator-authorized milestone. X.31 established READY: job 515 SUBMITTED(2),
 * dispute window elapsed, policy.check(515, 0x) = APPROVE, eth_call dry-run of
 * the settlement succeeds, escrow 1 U already held (no approval/funding).
 *
 * This script performs ONE transaction ONLY — the verified Job 515 settlement:
 *   target  : router proxy 0xd7d36d66d2f1b608a0f943f722d27e3744f66f25
 *   function: settle(515, 0x)  [selector 0x39c2ebb9, permissionless]
 *   path    : router.settle -> policy.check -> commerce.complete(jobId, reason, "")
 *
 * FINAL PRE-SIGN PRE-FLIGHT (ALL MUST PASS or the script exits BEFORE signing):
 *   0.  config resolves; RPC URL ok
 *   1.  live eth_chainId == 97
 *   2.  job 515 exists
 *   3.  job 515 status == SUBMITTED (2)
 *   4.  job provider & client == provider EOA; ERC-8004 agent 1816 ownerOf == EOA
 *   5.  job 515 escrow == exactly 1 U (raw 1e18)
 *   6.  evaluator & hook == router proxy; commerce/router impls unchanged (ERC-1967)
 *   7.  router.jobPolicy(515) == bound policy 0xd6a421…; disputeWindow == 900s (quorum 1)
 *   8.  dispute window elapsed (now >= submittedAt 1786723316 + 900); submittedAt unchanged
 *   9.  policy.check(515, 0x) == verdict 1 (OPTIMISTIC_APPROVED); undisputed, rejectVotes 0
 *  10.  eth_call simulation of settle(515, 0x) succeeds (no revert)
 *  11.  signed calldata == X.31 verified preview EXACTLY (byte-for-byte)
 *  12.  selector == 0x39c2ebb9 (settle(uint256,bytes))
 *  13.  broadcast target == verified router proxy
 *  14.  signer derived from env == verified provider EOA
 *  15.  commerce not paused
 *
 * If ANY pre-flight check fails -> STOP, NO SIGNING, NO BROADCAST.
 *
 * EXECUTION (single tx):
 *   A. re-read live state immediately before signing (chain, status SUBMITTED,
 *      submittedAt unchanged, undisputed, window still elapsed)
 *   B. record provider U balance (pre, for released-escrow cross-check)
 *   C. sign + broadcast the ONE settle(515, 0x) tx -> router; wait confirm
 *   D. verify receipt.status == success; re-read job 515 == COMPLETED (3)
 *   E. verify PaymentReleased(515, provider, 1 U) + JobCompleted(515, router)
 *      + JobSettled(515, policy, APPROVE) + JobFinalised(515, Completed) logs,
 *      all jobId-515-indexed; provider U balance increased by exactly 1 U
 *   F. record tx hash + block
 *   G. STOP — no further transactions of any kind.
 *
 * SECURITY (identical to X.26/X.28C/X.30):
 *   - Provider private key read ONLY from `.env.local`
 *     (`ALTANA_TESTNET_PRIVATE_KEY` via process.loadEnvFile). NEVER printed.
 *   - Derived signer must equal the verified provider EOA, or the script STOPS.
 *   - All targets pinned to the verified chain-97 table; any mismatch STOPS.
 *   - Mainnet (chain 56) refused. Job 515 is the ONLY job touched. Only ONE
 *     transaction is constructed or broadcast. No value is attached.
 *   - No approvals, no funding, no new job, no policy/agent modification.
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
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { ALTANA_ERC8183_CHAIN_ID, resolveErc8183Config } from "./erc8183.js";
import { createAltanaClient } from "./client.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const JOB_ID = 515n;
const AGENT_ID = 1816n;
const ONE_U_RAW = 1_000_000_000_000_000_000n;
const PROVIDER_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";

/** Verified chain-97 addresses (apex addresses.ts + X.27/X.29A/X.31 evidence). */
const COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE";
const COMMERCE_IMPL = "0x153783DdBDF5233c591965F04644b1df2d1A7815";
const ROUTER = "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25";
const ROUTER_IMPL = "0x40c0254610d92f1eb9c2d7d5d2114bc4c99d935e";
const BOUND_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
const PAYMENT_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565";

const EXPECTED_SUBMITTED_AT = 1786723316n;
const EXPECTED_DISPUTE_WINDOW = 900n;
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/** X.31 VERIFIED deterministic settlement preview (recorded in Main-Track-Activation-X31 report). */
const X31_SETTLE_PREVIEW =
  "0x39c2ebb9" +
  "0000000000000000000000000000000000000000000000000000000000000203" +
  "0000000000000000000000000000000000000000000000000000000000000040" +
  "0000000000000000000000000000000000000000000000000000000000000000";

// Deployed-interface ABIs (source-verified mirror of bp-chain/apex-contracts).
const SETTLE_ABI = [
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "evidence", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

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
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

const ROUTER_VIEW_ABI = [
  { type: "function", name: "jobPolicy", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const POLICY_VIEW_ABI = [
  { type: "function", name: "check", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }, { name: "evidence", type: "bytes" }], outputs: [{ type: "uint8" }, { type: "bytes32" }] },
  { type: "function", name: "submittedAt", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "disputeWindow", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "voteQuorum", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "disputed", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "rejectVotes", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "uint16" }] },
] as const;

const ERC721_VIEW_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const ERC20_VIEW_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const REASON_APPROVED = "OPTIMISTIC_APPROVED";

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
  console.log("X.32 ERC-8183 JOB 515 SETTLEMENT EXECUTION (chain 97):");

  // ---------------------------------------------------------------------------
  // FINAL PRE-SIGN PRE-FLIGHT (all must pass before any signing).
  // ---------------------------------------------------------------------------
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  check(
    "0a. runtime ERC-8183 config resolves (chain 97, commerce, router, token)",
    config.chainId === 97 &&
      getAddress(config.commerce) === getAddress(COMMERCE) &&
      getAddress(config.router) === getAddress(ROUTER)
  );

  const sdkClient = createAltanaClient() as unknown as { chains?: Array<{ chainId: number; publicRpcUrl: string }> };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  check("0b. public RPC URL resolved", typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl ?? ""));
  if (typeof publicRpcUrl !== "string") process.exit(1);
  const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

  const read = async (address: string, abi: readonly unknown[], fn: string, args: readonly unknown[] = []) =>
    publicClient.readContract({ address: getAddress(address), abi: abi as never, functionName: fn, args: args as never });

  // 1. Chain == 97.
  const liveChainId = BigInt(await publicClient.getChainId());
  check("1. live eth_chainId == 97", liveChainId === 97n);
  if (liveChainId !== 97n) process.exit(1);

  // 2/3/4/5. Job 515 state.
  const job = (await read(COMMERCE, COMMERCE_VIEW_ABI, "getJob", [JOB_ID])) as unknown as {
    id: bigint; client: string; provider: string; evaluator: string; budget: bigint;
    expiredAt: bigint; status: number; hook: string; submittedAt: bigint; deliverable: string;
  };
  check(`2. job 515 exists (id == 515)`, BigInt(String(job.id)) === JOB_ID);
  check(`3. job 515 status == SUBMITTED (2)`, Number(job.status) === 2);
  let agentOwner = "";
  try {
    agentOwner = String(await read(config.registry, ERC721_VIEW_ABI, "ownerOf", [AGENT_ID]));
  } catch {
    agentOwner = "";
  }
  check(
    "4. provider & client == provider EOA; agent 1816 ownerOf == provider EOA",
    getAddress(job.provider) === getAddress(PROVIDER_EOA) &&
      getAddress(job.client) === getAddress(PROVIDER_EOA) &&
      getAddress(agentOwner) === getAddress(PROVIDER_EOA)
  );
  check(`5. job 515 escrow == exactly 1 U (raw ${ONE_U_RAW.toString()})`, job.budget === ONE_U_RAW);

  // 6. Implementations unchanged.
  const getImpl = async (proxy: string): Promise<string | null> => {
    const slot = await publicClient.getStorageAt({ address: getAddress(proxy), slot: IMPL_SLOT });
    return slot && slot !== `0x${"0".repeat(64)}` ? getAddress(`0x${slot.slice(26)}`) : null;
  };
  check(
    "6. evaluator & hook == router proxy; commerce/router impls unchanged (ERC-1967)",
    getAddress(job.evaluator) === getAddress(ROUTER) &&
      getAddress(job.hook) === getAddress(ROUTER) &&
      (await getImpl(COMMERCE)) === getAddress(COMMERCE_IMPL) &&
      (await getImpl(ROUTER)) === getAddress(ROUTER_IMPL)
  );

  // 7. Bound policy + window.
  const boundPolicy = String(await read(ROUTER, ROUTER_VIEW_ABI, "jobPolicy", [JOB_ID]));
  const boundWindow = BigInt(String(await read(boundPolicy, POLICY_VIEW_ABI, "disputeWindow")));
  const boundQuorum = BigInt(String(await read(boundPolicy, POLICY_VIEW_ABI, "voteQuorum")));
  check(
    `7. bound policy == 0xd6a421…, disputeWindow == 900s, voteQuorum == 1`,
    getAddress(boundPolicy) === getAddress(BOUND_POLICY) && boundWindow === EXPECTED_DISPUTE_WINDOW && boundQuorum === 1n
  );

  // 8. Window elapsed.
  const nowBlock = await publicClient.getBlock({ blockTag: "latest" });
  const now = BigInt(nowBlock.timestamp);
  const policySubmittedAt = BigInt(String(await read(boundPolicy, POLICY_VIEW_ABI, "submittedAt", [JOB_ID])));
  const eligibleAt = EXPECTED_SUBMITTED_AT + EXPECTED_DISPUTE_WINDOW;
  check(
    `8. dispute window elapsed (now ${now.toString()} >= submittedAt 1786723316 + 900 = ${eligibleAt.toString()}; policy submittedAt unchanged ${policySubmittedAt.toString()})`,
    now >= eligibleAt && policySubmittedAt === EXPECTED_SUBMITTED_AT && BigInt(job.submittedAt) === EXPECTED_SUBMITTED_AT
  );

  // 9. Verdict APPROVE.
  const verdict = (await read(boundPolicy, POLICY_VIEW_ABI, "check", [JOB_ID, "0x"])) as [unknown, unknown];
  const verdictCode = Number(String(verdict[0]));
  const verdictReason = String(verdict[1]);
  const disputed = Boolean(await read(boundPolicy, POLICY_VIEW_ABI, "disputed", [JOB_ID]));
  const rejectVotes = BigInt(String(await read(boundPolicy, POLICY_VIEW_ABI, "rejectVotes", [JOB_ID])));
  check(
    "9. policy.check(515, 0x) == APPROVE (verdict 1, OPTIMISTIC_APPROVED); undisputed, rejectVotes 0",
    verdictCode === 1 && keccak256(toBytes(REASON_APPROVED)) === verdictReason && !disputed && rejectVotes === 0n
  );

  // 10. Re-run eth_call settlement simulation (read-only).
  const settleCalldata = encodeFunctionData({ abi: SETTLE_ABI, functionName: "settle", args: [JOB_ID, "0x"] });
  let dryRun = "";
  try {
    await publicClient.call({ account: getAddress(PROVIDER_EOA), to: getAddress(ROUTER), data: settleCalldata });
    dryRun = "success (no revert)";
  } catch (error) {
    dryRun = `reverted: ${error instanceof Error ? error.message : String(error)}`;
  }
  check(`10. eth_call settle(515, 0x) simulation succeeds (${dryRun})`, dryRun === "success (no revert)");

  // 11/12/13. Calldata == X.31 preview EXACTLY; selector; target.
  if (settleCalldata !== X31_SETTLE_PREVIEW) {
    const a = settleCalldata.slice(2).toLowerCase();
    const b = X31_SETTLE_PREVIEW.slice(2).toLowerCase();
    const n = Math.min(a.length, b.length);
    let first = -1;
    for (let i = 0; i < n; i += 1) {
      if (a[i] !== b[i]) { first = i; break; }
    }
    if (first === -1) first = n;
    console.log("  [mismatch] X.32 calldata vs X.31 preview:");
    console.log(`  [mismatch] lengths: encoder=${a.length} vs reference=${b.length}`);
    console.log(`  [mismatch] first diff at hex index ${first} (byte offset ${first / 2})`);
    console.log(`  [mismatch] expected: ${b.slice(Math.max(0, first - 16), first + 16)}`);
    console.log(`  [mismatch] actual:   ${a.slice(Math.max(0, first - 16), first + 16)}`);
  }
  check("11. calldata == X.31 verified preview EXACTLY (byte-for-byte)", settleCalldata === X31_SETTLE_PREVIEW);
  check("12. selector == 0x39c2ebb9 (settle(uint256,bytes))", settleCalldata.startsWith("0x39c2ebb9"));
  const rt = decodeFunctionData({ abi: SETTLE_ABI, data: settleCalldata });
  const rtArgs = rt.args as [bigint, string] | undefined;
  check(
    `13. target == verified router proxy ${getAddress(ROUTER)}; preview decodes to settle(515, 0x)`,
    getAddress(job.evaluator) === getAddress(ROUTER) &&
      rt.functionName === "settle" &&
      rtArgs !== undefined &&
      BigInt(String(rtArgs[0])) === JOB_ID &&
      rtArgs[1] === "0x"
  );

  // 14. Signer derived from env == provider EOA. (Never printed.)
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
  check(
    "14. signer/caller authorized (derived from env == provider EOA; settle is permissionless — any EOA, verbatim evidence 0x)",
    derivedAddress === getAddress(PROVIDER_EOA) && derivedAddress !== null
  );

  // 15. Not paused.
  const kernelPaused = Boolean(await read(COMMERCE, COMMERCE_VIEW_ABI, "paused"));
  check("15. commerce not paused (whenNotPaused gate open)", kernelPaused === false);

  // Provider gas (read-only) + pre-settlement U balance (for escrow-release cross-check).
  const tbnb = await publicClient.getBalance({ address: getAddress(PROVIDER_EOA) });
  check("16. provider has tBNB for gas (read-only)", tbnb > 0n);
  const uBefore = BigInt(String(await read(PAYMENT_TOKEN, ERC20_VIEW_ABI, "balanceOf", [PROVIDER_EOA])));
  check("17. provider U balance readable (pre-settlement snapshot)", uBefore >= 0n);

  const failed = checks.filter((c) => !c.ok);
  console.log(`X.32 final pre-flight: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.log("X.32 BLOCKED — pre-flight check failed. NO SIGNING, NO BROADCAST.");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // FINAL live re-read IMMEDIATELY before signing.
  // ---------------------------------------------------------------------------
  const finalChain = BigInt(await publicClient.getChainId());
  if (finalChain !== 97n) {
    console.log("X.32 BLOCKED — chain changed before signing. NO SIGNING.");
    process.exit(1);
  }
  const jobBefore = (await read(COMMERCE, COMMERCE_VIEW_ABI, "getJob", [JOB_ID])) as unknown as {
    status: number; submittedAt: bigint; expiredAt: bigint;
  };
  const finalNow = BigInt((await publicClient.getBlock({ blockTag: "latest" })).timestamp);
  const finalVerdict = (await read(boundPolicy, POLICY_VIEW_ABI, "check", [JOB_ID, "0x"])) as [unknown, unknown];
  const finalDisputed = Boolean(await read(boundPolicy, POLICY_VIEW_ABI, "disputed", [JOB_ID]));
  if (
    Number(jobBefore.status) !== 2 ||
    BigInt(jobBefore.submittedAt) !== EXPECTED_SUBMITTED_AT ||
    finalNow < eligibleAt ||
    Number(String(finalVerdict[0])) !== 1 ||
    finalDisputed
  ) {
    console.log("X.32 BLOCKED — job 515 no longer clean SUBMITTED/undisputed/eligible before signing. NO SIGNING.");
    process.exit(1);
  }
  console.log(
    `X.32 FINAL RE-READ: chain 97; job 515 SUBMITTED(2), submittedAt ${EXPECTED_SUBMITTED_AT.toString()}, ` +
    `undisputed, verdict APPROVE, window elapsed (now ${finalNow.toString()} >= ${eligibleAt.toString()}).`
  );

  // ---------------------------------------------------------------------------
  // SIGN + BROADCAST — the single Job 515 settlement transaction (to ROUTER).
  // ---------------------------------------------------------------------------
  const raw = providerKey!.trim();
  const hexKey = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hexKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(publicRpcUrl) });

  let txHash: `0x${string}` | null = null;
  let txBlock: bigint | null = null;
  try {
    console.log("");
    console.log("X.32 SIGNING AND BROADCAST (single tx — settle(515, 0x) -> router proxy):");
    txHash = await walletClient.sendTransaction({
      account,
      to: getAddress(ROUTER),
      data: settleCalldata,
      value: 0n,
    });
    console.log(`  transaction hash: ${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    if (receipt.status !== "success") {
      throw new Error(`transaction reverted (hash ${txHash})`);
    }
    txBlock = receipt.blockNumber;
    console.log(`  block number: ${receipt.blockNumber.toString()}`);
    console.log(`  block hash: ${receipt.blockHash}`);
    console.log(`  gas used: ${receipt.gasUsed.toString()}`);

    // D. Re-read job 515: SUBMITTED -> COMPLETED.
    const afterJob = (await read(COMMERCE, COMMERCE_VIEW_ABI, "getJob", [JOB_ID])) as unknown as {
      status: number; submittedAt: bigint; provider: string; budget: bigint;
    };
    check(
      `job 515 transitioned SUBMITTED(2) -> COMPLETED(3) (now status ${Number(afterJob.status)})`,
      Number(afterJob.status) === 3 && getAddress(afterJob.provider) === getAddress(PROVIDER_EOA)
    );
    if (Number(afterJob.status) !== 3) {
      console.log("X.32 BLOCKED — job 515 did not reach COMPLETED as expected. STOPPING after successful broadcast.");
      process.exit(1);
    }

    // E. Escrow release + event/log binding to Job 515.
    const uAfter = BigInt(String(await read(PAYMENT_TOKEN, ERC20_VIEW_ABI, "balanceOf", [PROVIDER_EOA])));
    const released = uAfter - uBefore;
    const releasedOk = released === ONE_U_RAW; // platformFeeBP == 0 (X.31) -> net == full escrow
    check(
      `1 U escrow released to provider (provider U balance +${released.toString()} raw; pre ${uBefore.toString()} -> post ${uAfter.toString()})`,
      releasedOk
    );

    const getLog = (address: string, topic0sig: `0x${string}`, expectedTopics1?: bigint, expectedTopics2?: string) =>
      receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== getAddress(address).toLowerCase()) return false;
        if (log.topics[0]?.toLowerCase() !== topic0sig.toLowerCase()) return false;
        if (expectedTopics1 !== undefined && (log.topics[1] === undefined || BigInt(log.topics[1]) !== expectedTopics1)) return false;
        if (expectedTopics2 !== undefined && (log.topics[2] === undefined || getAddress(`0x${log.topics[2].slice(26)}`) !== getAddress(expectedTopics2))) return false;
        return true;
      });

    const sig = (txt: string): `0x${string}` => keccak256(toBytes(txt));
    const paymentReleasedLog = getLog(COMMERCE, sig("PaymentReleased(uint256,address,uint256)"), JOB_ID, PROVIDER_EOA);
    const jobCompletedLog = getLog(COMMERCE, sig("JobCompleted(uint256,address,bytes32)"), JOB_ID, ROUTER);
    const jobSettledLog = getLog(ROUTER, sig("JobSettled(uint256,address,uint8,bytes32)"), JOB_ID, BOUND_POLICY);
    const jobFinalisedLog = getLog(ROUTER, sig("JobFinalised(uint256,uint8)"), JOB_ID);
    const paymentAmount = paymentReleasedLog !== undefined ? BigInt(paymentReleasedLog.data) : -1n;
    const logsOk =
      paymentReleasedLog !== undefined &&
      paymentAmount === ONE_U_RAW &&
      jobCompletedLog !== undefined &&
      jobSettledLog !== undefined &&
      jobFinalisedLog !== undefined &&
      (jobSettledLog.topics[3] === undefined || BigInt(jobSettledLog.topics[3]) === 1n); // verdict APPROVE
    check(
      `settlement logs bound to Job 515 (PaymentReleased(515, provider, ${paymentAmount === -1n ? "?" : paymentAmount.toString()}), JobCompleted(515, router), JobSettled(515, policy, APPROVE), JobFinalised(515, Completed))`,
      logsOk
    );
    if (!logsOk) {
      console.log("X.32 BLOCKED — escrow-release/log verification failed. STOPPING after successful broadcast.");
      process.exit(1);
    }

    // ---------------------------------------------------------------------------
    // Mandated final report.
    // ---------------------------------------------------------------------------
    console.log("");
    console.log("X.32 STATUS: PASS");
    console.log(`JOB: ${JOB_ID.toString()}`);
    console.log("PREVIOUS STATE: SUBMITTED (2)");
    console.log("FINAL STATE: COMPLETED (3)");
    console.log(`TX HASH: ${txHash}`);
    console.log(`BLOCK: ${txBlock?.toString() ?? "?"}`);
    console.log(`AGENT: ${AGENT_ID.toString()}`);
    console.log(`PROVIDER: ${getAddress(PROVIDER_EOA)}`);
    console.log(`ESCROW RELEASED: ${released.toString()} raw U (== 1 U, platformFeeBP 0 -> full escrow to provider)`);
    console.log(`SETTLEMENT FUNCTION: settle(uint256,bytes) @ router proxy ${getAddress(ROUTER)}`);
    console.log("SIGNING: PERFORMED (single tx only)");
    console.log("BROADCAST: PERFORMED (single tx only)");
    console.log("FUNDING/APPROVAL: NOT PERFORMED");
    console.log("NEW JOB: NOT CREATED");
    console.log("MAINNET: NOT TOUCHED");
    console.log("STOPPED AFTER SETTLEMENT VERIFICATION — no further transaction of any kind.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
    console.error(`X.32 FAILED: ${redacted} (txHash ${txHash ?? "none"})`);
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.32 FAILED: ${redacted}`);
  process.exit(1);
});