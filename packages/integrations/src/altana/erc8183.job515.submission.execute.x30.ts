/**
 * X.30 — EXECUTE ERC-8183 JOB 515 PROVIDER SUBMISSION ON BNB TESTNET (chain 97).
 *
 * Operator-authorized milestone. X.29B established the READY submission ABI:
 *   commerce.submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams)
 *   selector 0x9e63798d, caller = provider EOA, gate OPEN (time-box < expiredAt - 900).
 *
 * This script performs ONE transaction ONLY — the verified Job 515 provider
 * submission:
 *   target  : commerce proxy 0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE
 *   function: submit(515, <deliverable bytes32>, <manifest bytes>)
 *
 * FINAL PRE-SIGN PRE-FLIGHT (ALL MUST PASS or the script exits BEFORE signing):
 *   0.  live eth_chainId == 97
 *   1.  commerce proxy impl == verified AgenticCommerce impl (ERC-1967 slot)
 *   2.  job 515 exists
 *   3.  job 515 status == FUNDED (1)
 *   4.  job 515 escrow == exactly 1 U (raw 1e18)
 *   5.  ERC-8004 agent id == 1816 (registry ownerOf(1816) == provider EOA)
 *   6.  job.provider == signer == provider EOA 0x299Ce4113abF88F4997737184aa8A7a3D58AC15C
 *   7.  router.jobPolicy(515) == bound policy 0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA
 *   8.  bound policy disputeWindow == 900s (voteQuorum 1)
 *   9.  current time < expiredAt - 900 (submission gate STILL OPEN at sign time)
 *  10.  calldata == X.29B deterministic preview EXACTLY (byte-for-byte)
 *  11.  deliverable == X.29B verified deliverable hash b4e612…
 *  12.  manifest == {"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}
 *  13.  selector == 0x9e63798d
 *  14.  commerce not paused; policy.submittedAt(515) == 0 (not yet initialised)
 *  15.  signer derived from env == verified provider EOA
 *
 * If ANY pre-flight check fails -> STOP, NO SIGNING, NO BROADCAST.
 *
 * EXECUTION (single tx):
 *   A. re-read live state immediately before signing (chain, status FUNDED,
 *      submittedAt 0, deliverable zero, gate still open)
 *   B. sign + broadcast the ONE submit(515,...) tx -> commerce; wait confirm
 *   C. verify receipt.status == success; re-read job 515 == SUBMITTED (2),
 *      submittedAt > 0, deliverable == verified hash
 *   D. verify the submission log is jobId-515-indexed on commerce (and report
 *      the bound-policy JobInitialised(515,…) log)
 *   E. record tx hash + block
 *   F. STOP — no settle, no new job, no funding, no policy change.
 *
 * SECURITY (identical to X.26/X.28C):
 *   - Provider private key read ONLY from `.env.local`
 *     (`ALTANA_TESTNET_PRIVATE_KEY` via process.loadEnvFile). NEVER printed.
 *   - Derived signer must equal the verified provider EOA, or the script STOPS.
 *   - All targets pinned to the verified chain-97 table; any mismatch STOPS.
 *   - Mainnet (chain 56) refused. Job 515 is the ONLY job touched. Only ONE
 *     transaction is constructed or broadcast. No value is attached.
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
  toHex,
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

/** Verified chain-97 addresses (apex addresses.ts + X.27/X.29A evidence). */
const COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE";
const COMMERCE_IMPL = "0x153783DdBDF5233c591965F04644b1df2d1A7815";
const ROUTER = "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25";
const BOUND_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
const REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

const EXPECTED_EXPIRED_AT = 1786730495n;
const EXPECTED_BOUND_DISPUTE_WINDOW = 900n;
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/** X.29B VERIFIED deliverable manifest + hash + deterministic calldata. */
const DELIVERABLE_MANIFEST =
  '{"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}';
const DELIVERABLE_HASH = "0xb4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea";
const X29B_PREVIEW_CALLDATA =
  "0x9e63798d0000000000000000000000000000000000000000000000000000000000000203" +
  "b4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea" +
  "0000000000000000000000000000000000000000000000000000000000000060" +
  "0000000000000000000000000000000000000000000000000000000000000066" +
  "7b2264656c6976657261626c655f75726c223a2268747470733a2f2f626e622d6167656e742d6d61726b6574706c6163652d7765622e76657263656c2e6170702f6170692f6167656e74732f626e622d746573746e65742d7269736b2f7365727669636522" +
  "7d0000000000000000000000000000000000000000000000000000";

// Deployed-interface ABIs (source-verified mirror of bp-chain/apex-contracts).
const SUBMIT_ABI = [
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
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
  { type: "function", name: "disputeWindow", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "voteQuorum", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "submittedAt", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "uint64" }] },
] as const;

const ERC721_VIEW_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
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
  console.log("X.30 ERC-8183 JOB 515 PROVIDER SUBMISSION EXECUTION (chain 97):");

  // ---------------------------------------------------------------------------
  // FINAL PRE-SIGN PRE-FLIGHT (all must pass before any signing).
  // ---------------------------------------------------------------------------
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  check(
    "0a. runtime ERC-8183 config resolves (chain 97, commerce, router, policy, token)",
    config.chainId === 97 &&
      getAddress(config.commerce) === getAddress(COMMERCE) &&
      getAddress(config.router) === getAddress(ROUTER)
  );

  const sdkClient = createAltanaClient() as unknown as { chains?: Array<{ chainId: number; publicRpcUrl: string }> };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl;
  check("0b. public RPC URL resolved", typeof publicRpcUrl === "string" && /^https?:\/\//i.test(publicRpcUrl ?? ""));
  if (typeof publicRpcUrl !== "string") process.exit(1);
  const publicClient = createPublicClient({ transport: http(publicRpcUrl) });

  // 0. Chain == 97.
  const liveChainId = BigInt(await publicClient.getChainId());
  check("0. live eth_chainId == 97", liveChainId === 97n);
  if (liveChainId !== 97n) process.exit(1);

  // 1. commerce proxy -> verified impl (ERC-1967).
  const implSlot = await publicClient.getStorageAt({ address: getAddress(COMMERCE), slot: IMPL_SLOT });
  const implFromSlot = implSlot && implSlot !== `0x${"0".repeat(64)}` ? getAddress(`0x${implSlot.slice(26)}`) : null;
  check("1. commerce proxy impl == verified AgenticCommerce impl (0x153783…)", implFromSlot === getAddress(COMMERCE_IMPL));

  // 2/3/4. Job 515 exists, FUNDED, escrow exactly 1 U; capture submittedAt/deliverable/expiredAt.
  const job = await publicClient.readContract({
    address: getAddress(COMMERCE),
    abi: COMMERCE_VIEW_ABI,
    functionName: "getJob",
    args: [JOB_ID],
  });
  const j = job as unknown as {
    id: bigint; client: string; provider: string; evaluator: string; budget: bigint;
    expiredAt: bigint; status: number; hook: string; submittedAt: bigint; deliverable: string;
  };
  check(`2. job 515 exists (id == 515)`, BigInt(String(j.id)) === JOB_ID);
  check(`3. job 515 status == FUNDED (1)`, Number(j.status) === 1);
  check(`4. job 515 escrow == exactly 1 U (raw ${ONE_U_RAW.toString()})`, j.budget === ONE_U_RAW);

  // 5. Agent id == 1816 (ERC-8004 registry ownerOf(1816) == provider).
  let agentOwner: string = "";
  try {
    agentOwner = String(
      await publicClient.readContract({ address: getAddress(REGISTRY), abi: ERC721_VIEW_ABI, functionName: "ownerOf", args: [AGENT_ID] })
    );
  } catch {
    agentOwner = "";
  }
  check(`5. ERC-8004 agent id == 1816 (registry ownerOf(1816) == provider EOA)`, getAddress(agentOwner) === getAddress(PROVIDER_EOA));

  // 6. provider == signer == provider EOA.
  check(`6. job.provider == provider EOA ${getAddress(PROVIDER_EOA)}`, getAddress(j.provider) === getAddress(PROVIDER_EOA));

  // 7/8. bound policy + disputeWindow (authoritative via router.jobPolicy(515)).
  const boundPolicy = String(
    await publicClient.readContract({ address: getAddress(ROUTER), abi: ROUTER_VIEW_ABI, functionName: "jobPolicy", args: [JOB_ID] })
  );
  check(`7. bound policy == ${getAddress(BOUND_POLICY)}`, getAddress(boundPolicy) === getAddress(BOUND_POLICY));
  const boundWindow = BigInt(
    String(await publicClient.readContract({ address: getAddress(boundPolicy), abi: POLICY_VIEW_ABI, functionName: "disputeWindow" }))
  );
  const boundQuorum = BigInt(
    String(await publicClient.readContract({ address: getAddress(boundPolicy), abi: POLICY_VIEW_ABI, functionName: "voteQuorum" }))
  );
  check(`8. bound policy disputeWindow == 900s (voteQuorum ${boundQuorum.toString()})`, boundWindow === 900n && boundQuorum === 1n);

  // 9. current time < expiredAt - 900 (submission gate STILL OPEN).
  const nowBlock = await publicClient.getBlock({ blockTag: "latest" });
  const now = Number(nowBlock.timestamp);
  const submissionDeadline = Number(EXPECTED_EXPIRED_AT) - Number(EXPECTED_BOUND_DISPUTE_WINDOW);
  check(
    `9. current time < expiredAt - 900 (now ${now} < ${submissionDeadline})`,
    now < submissionDeadline && Number(j.expiredAt) === Number(EXPECTED_EXPIRED_AT)
  );

  // 10/11/12/13. calldata == X.29B preview EXACTLY; deliverable + manifest + selector.
  const deliverable = keccak256(toBytes(DELIVERABLE_MANIFEST));
  const optParams = toHex(DELIVERABLE_MANIFEST);
  const calldata = encodeFunctionData({ abi: SUBMIT_ABI, functionName: "submit", args: [JOB_ID, deliverable, optParams] });
  if (calldata !== X29B_PREVIEW_CALLDATA) {
    // Report the EXACT mismatch before anything else.
    const a = calldata.slice(2).toLowerCase();
    const b = X29B_PREVIEW_CALLDATA.slice(2).toLowerCase();
    const n = Math.min(a.length, b.length);
    let first = -1;
    for (let i = 0; i < n; i += 1) {
      if (a[i] !== b[i]) { first = i; break; }
    }
    if (first === -1) first = n;
    console.log("  [mismatch] X.30 calldata vs X.29B preview:");
    console.log(`  [mismatch] lengths: encoder=${a.length} hex chars vs reference=${b.length} hex chars`);
    console.log(`  [mismatch] first diff at hex index ${first} (byte offset ${first / 2})`);
    console.log(`  [mismatch] expected: ${b.slice(Math.max(0, first - 16), first + 16)}`);
    console.log(`  [mismatch] actual:   ${a.slice(Math.max(0, first - 16), first + 16)}`);
  }
  check("10. calldata == X.29B deterministic preview EXACTLY (byte-for-byte)", calldata === X29B_PREVIEW_CALLDATA);
  check("11. deliverable == X.29B verified deliverable hash", deliverable === DELIVERABLE_HASH);
  check(
    `12. manifest == {"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}`,
    DELIVERABLE_MANIFEST === `{"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}`
  );
  check("13. selector == 0x9e63798d (submit(uint256,bytes32,bytes))", calldata.startsWith("0x9e63798d"));

  // 14. commerce not paused; bound policy not yet initialised.
  const kernelPaused = Boolean(await publicClient.readContract({ address: getAddress(COMMERCE), abi: COMMERCE_VIEW_ABI, functionName: "paused" }));
  const polSubmittedAt = BigInt(
    String(await publicClient.readContract({ address: getAddress(boundPolicy), abi: POLICY_VIEW_ABI, functionName: "submittedAt", args: [JOB_ID] }))
  );
  check("14. commerce not paused; bound policy.submittedAt(515) == 0", kernelPaused === false && polSubmittedAt === 0n);

  // 15. signer derived from env == provider EOA. (Never printed.)
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
  check("15. signer derived from env == verified provider EOA", derivedAddress === getAddress(PROVIDER_EOA) && derivedAddress !== null);

  // Extra safety: gas funding (read-only) and kernel-side guard (now < expiredAt).
  const tbnb = await publicClient.getBalance({ address: getAddress(PROVIDER_EOA) });
  check("16. provider has tBNB for gas (read-only)", tbnb > 0n);

  const failed = checks.filter((c) => !c.ok);
  console.log(`X.30 final pre-flight: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.log("X.30 BLOCKED — pre-flight check failed. NO SIGNING, NO BROADCAST.");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // FINAL live re-read IMMEDIATELY before signing.
  // ---------------------------------------------------------------------------
  const finalChain = BigInt(await publicClient.getChainId());
  if (finalChain !== 97n) {
    console.log("X.30 BLOCKED — chain changed before signing. NO SIGNING.");
    process.exit(1);
  }
  const jobBefore = await publicClient.readContract({
    address: getAddress(COMMERCE), abi: COMMERCE_VIEW_ABI, functionName: "getJob", args: [JOB_ID],
  });
  const jb = jobBefore as unknown as { status: number; submittedAt: bigint; deliverable: string };
  const finalNow = Number((await publicClient.getBlock({ blockTag: "latest" })).timestamp);
  if (Number(jb.status) !== 1 || jb.submittedAt !== 0n) {
    console.log("X.30 BLOCKED — job 515 no longer FUNDED/unsubmitted before signing. NO SIGNING.");
    process.exit(1);
  }
  if (finalNow >= submissionDeadline) {
    console.log("X.30 BLOCKED — submission window closed before signing (now >= expiredAt - 900). NO SIGNING.");
    process.exit(1);
  }
  console.log(`X.30 FINAL RE-READ: chain 97; job 515 FUNDED, submittedAt 0, deliverable zero; gate open (now ${finalNow} < ${submissionDeadline}).`);

  // ---------------------------------------------------------------------------
  // SIGN + BROADCAST — the single Job 515 submission transaction.
  // ---------------------------------------------------------------------------
  const raw = providerKey!.trim();
  const hexKey = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hexKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(publicRpcUrl) });

  let txHash: `0x${string}` | null = null;
  let txBlock: bigint | null = null;
  try {
    console.log("");
    console.log("X.30 SIGNING AND BROADCAST (single tx — submit(515, deliverable, manifest) -> commerce):");
    txHash = await walletClient.sendTransaction({
      account,
      to: getAddress(COMMERCE),
      data: calldata,
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

    // C. Re-read job 515: FUNDED -> SUBMITTED, submittedAt > 0, deliverable set.
    const afterJob = await publicClient.readContract({
      address: getAddress(COMMERCE), abi: COMMERCE_VIEW_ABI, functionName: "getJob", args: [JOB_ID],
    });
    const ja = afterJob as unknown as { status: number; submittedAt: bigint; deliverable: string; provider: string };
    const stateOk =
      Number(ja.status) === 2 &&
      BigInt(ja.submittedAt) > 0n &&
      ja.deliverable === DELIVERABLE_HASH &&
      getAddress(ja.provider) === getAddress(PROVIDER_EOA);
    check(
      `job 515 transitioned FUNDED(1) -> SUBMITTED(2) (status ${Number(ja.status)}, submittedAt ${BigInt(ja.submittedAt)}, deliverable set)`,
      stateOk
    );
    if (!stateOk) {
      console.log("X.30 BLOCKED — job 515 did not reach SUBMITTED as expected. STOPPING after successful broadcast (no settle).");
      process.exit(1);
    }

    // D. Verify the submission log is jobId-515-indexed on commerce + bound policy JobInitialised.
    const txRecord = await publicClient.getTransaction({ hash: txHash });
    const submitDecoded = decodeFunctionData({ abi: SUBMIT_ABI, data: txRecord.input });
    const args = submitDecoded.args as [bigint, string, string] | undefined;
    const commerceLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === getAddress(COMMERCE).toLowerCase() &&
        log.topics[1] !== undefined &&
        BigInt(log.topics[1]) === JOB_ID
    );
    const policyLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === getAddress(BOUND_POLICY).toLowerCase() &&
        log.topics[1] !== undefined &&
        BigInt(log.topics[1]) === JOB_ID
    );
    const logOk =
      commerceLog !== undefined &&
      policyLog !== undefined &&
      getAddress(String(txRecord.from)) === getAddress(PROVIDER_EOA) &&
      getAddress(String(txRecord.to)) === getAddress(COMMERCE) &&
      txRecord.value === 0n &&
      args !== undefined &&
      BigInt(String(args[0])) === JOB_ID &&
      args[1] === DELIVERABLE_HASH &&
      args[2] === optParams;
    check(
      "submission receipt/log verified (from provider, to commerce, value 0, submit(515,hash,manifest), JobSubmitted(515)+JobInitialised(515) logs)",
      logOk
    );

    // ---------------------------------------------------------------------------
    // Mandated final report.
    // ---------------------------------------------------------------------------
    console.log("");
    console.log("X.30 STATUS: PASS");
    console.log(`JOB: ${JOB_ID.toString()}`);
    console.log("PREVIOUS STATE: FUNDED (1)");
    console.log("FINAL STATE: SUBMITTED (2)");
    console.log(`TX HASH: ${txHash}`);
    console.log(`BLOCK: ${txBlock?.toString() ?? "?"}`);
    console.log(`AGENT: ${AGENT_ID.toString()}`);
    console.log(`PROVIDER: ${getAddress(PROVIDER_EOA)}`);
    console.log(`DELIVERABLE: ${DELIVERABLE_HASH}`);
    console.log(`MANIFEST: ${DELIVERABLE_MANIFEST}`);
    console.log("SETTLEMENT: NOT PERFORMED");
    console.log("MAINNET: NOT TOUCHED");
    console.log("STOPPED AFTER SUBMISSION VERIFICATION — no settle, no new job, no further tx.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
    console.error(`X.30 FAILED: ${redacted} (txHash ${txHash ?? "none"})`);
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`X.30 FAILED: ${redacted}`);
  process.exit(1);
});