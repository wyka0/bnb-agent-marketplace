/**
 * X.29B — PROVIDER SUBMISSION ABI DISCOVERY (READ-ONLY)
 * BNB Testnet (chain 97). Determines the exact ERC-8183 mechanism to move
 * job 515 FUNDED (1) -> SUBMITTED (2), cross-verifying the deployed contract
 * bytecode against the official `bnb-chain/apex-contracts` source and the
 * EIP-8183 specification. Generates an UNSIGNED deterministic `submit`
 * calldata preview and verifies every selector on-chain. NO BROADCAST.
 *
 * CONTRADICTION RESOLUTION (disputeWindow 900s vs 86400s):
 * The two figures come from TWO DIFFERENT policy contracts:
 *   - 86400s = STALE SDK policy 0x4F4678… (config.policy; read by X.25/X.26
 *     creation to derive expiredAt).
 *   - 900s   = BOUND WL policy 0xd6a421… (router.jobPolicy(515); read by
 *     X.26-cont and X.29A).
 * This script reads BOTH live from the exact contracts; the submission gate
 * (OptimisticPolicy.onSubmitted L223) is evaluated ONLY with the BOUND
 * policy's immutable window. No guessing: the binding comes from
 * router.jobPolicy(515).
 *
 * Authoritative sources used:
 *   - deployed bytecode (proxy ERC-1967 slots + function selectors)
 *   - official source: https://github.com/bnb-chain/apex-contracts
 *       contracts/AgenticCommerceUpgradeable.sol   (kernel: submit)
 *       contracts/EvaluatorRouterUpgradeable.sol   (hook/evaluator -> policy.onSubmitted)
 *       contracts/OptimisticPolicy.sol             (onSubmitted/check/dispute)
 *       contracts/IPolicy.sol / IACPHook.sol / IACP.sol
 *       scripts/addresses.ts (bscTestnet registry)
 *   - EIP-8183 spec (eips.ethereum.org/EIPS/eip-8183): provider-only submit
 *   - @altananetwork/sdk 0.7.1 (NO provider submission functions; 0.7.1's
 *     erc8183.js is byte-identical to 0.7.0)
 *
 * SECURITY:
 *   - NO signing, NO broadcast, NO payment, NO settlement, NO new job.
 *   - Private key is never read. Env is not even required.
 *   - Mainnet refused. Deterministic calldata preview only.
 */

import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  toBytes,
  toHex,
} from "viem";
import { createAltanaClient } from "./client.js";
import { resolveErc8183Config, ALTANA_ERC8183_CHAIN_ID } from "./erc8183.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n;
const WL_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
const EXPECTED_EXPIRED_AT = 1786730495n;
/** Bound OptimisticPolicy immutable disputeWindow (verified by X.26-cont/X.29A; re-verified live here). */
const EXPECTED_BOUND_DISPUTE_WINDOW = 900n;
/** Stale SDK policy disputeWindow (source of the X.25/X.26 86400 expiredAt derivation). */
const EXPECTED_STALE_DISPUTE_WINDOW = 86400n;

/** Official apex-contracts `scripts/addresses.ts` bscTestnet registry. */
const OFFICIAL_ADDRESSES = {
  paymentToken: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
  treasury: "0x1001b2C085345f388778A975648aA50bcfd0D134",
  commerceProxy: "0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de",
  commerceImpl: "0x153783ddbdf5233c591965f04644b1df2d1a7815",
  routerProxy: "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25",
  routerImpl: "0x40c0254610d92f1eb9c2d7d5d2114bc4c99d935e",
  policy: "0xd6a4217588f6b1f5657a92a3e94e6422ad771cea",
} as const;

/** The deliverable manifest bound to optParams (repo deliverable contract). */
const DELIVERABLE_MANIFEST =
  '{"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}';

const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Deployed-interface ABIs (source-verified).
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
  { type: "function", name: "policyWhitelist", stateMutability: "view", inputs: [{ name: "policy", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

const POLICY_VIEW_ABI = [
  { type: "function", name: "submittedAt", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "disputeWindow", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "voteQuorum", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
] as const;

/** The exact verified ABI for `submit` (APE IACP/AgenticCommerceUpgradeable). */
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

const checks: Array<{ label: string; ok: boolean }> = [];
function check(label: string, ok: boolean): void {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

async function main(): Promise<void> {
  console.log("X.29B READ-ONLY PROVIDER SUBMISSION ABI DISCOVERY (chain 97, NO BROADCAST):");

  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const sdkClient = createAltanaClient() as unknown as { chains?: Array<{ publicRpcUrl: string }> };
  const rpc = sdkClient.chains?.[0]?.publicRpcUrl;
  check("public RPC URL resolved", typeof rpc === "string" && /^https?:\/\//i.test(rpc ?? ""));
  if (typeof rpc !== "string") process.exit(1);
  const client = createPublicClient({ transport: http(rpc) });

  // 0. Chain.
  check("0. live eth_chainId == 97", BigInt(await client.getChainId()) === 97n);

  // 1. Deployed proxies / impls / policy == official apex addresses.ts.
  const commerceImpl = await client.getStorageAt({ address: getAddress(config.commerce), slot: IMPL_SLOT });
  const routerImpl = await client.getStorageAt({ address: getAddress(config.router), slot: IMPL_SLOT });
  const getImpl = (slot: string | null | undefined): string | null =>
    slot && slot !== `0x${"0".repeat(64)}` ? getAddress(`0x${slot.slice(26)}`) : null;
  check(
    "1a. commerce proxy impl == official commerceImpl 0x153783…",
    config.commerce.toLowerCase() === OFFICIAL_ADDRESSES.commerceProxy.toLowerCase() &&
      getImpl(commerceImpl)?.toLowerCase() === OFFICIAL_ADDRESSES.commerceImpl.toLowerCase()
  );
  check(
    "1b. router proxy impl == official routerImpl 0x40c025…",
    config.router.toLowerCase() === OFFICIAL_ADDRESSES.routerProxy.toLowerCase() &&
      getImpl(routerImpl)?.toLowerCase() === OFFICIAL_ADDRESSES.routerImpl.toLowerCase()
  );
  check("1c. official registry policy address constant == router job-binding target", WL_POLICY.toLowerCase() === OFFICIAL_ADDRESSES.policy.toLowerCase());
  check("1d. paymentToken == official U 0xc70B…", config.paymentToken.toLowerCase() === OFFICIAL_ADDRESSES.paymentToken.toLowerCase());

  // 2. Selector presence in deployed bytecode (authoritative on-chain evidence).
  const targets = {
    commerceImpl: OFFICIAL_ADDRESSES.commerceImpl,
    routerImpl: OFFICIAL_ADDRESSES.routerImpl,
    policy: OFFICIAL_ADDRESSES.policy,
  } as const;
  const code: Record<string, string> = {};
  for (const [name, addr] of Object.entries(targets)) {
    code[name] = ((await client.getCode({ address: getAddress(addr) })) ?? "").toLowerCase();
  }
  const has = (name: keyof typeof targets, bytes4: string): boolean =>
    (code[name] ?? "").includes(bytes4.slice(2));

  check("2a. submit(uint256,bytes32,bytes) 0x9e63798d in commerce impl", has("commerceImpl", "0x9e63798d"));
  check("2b. submit uint256,bytes32,bytes 0x9e63798d in router impl (SUBMIT_SELECTOR)", has("routerImpl", "0x9e63798d"));
  check("2c. onSubmitted(uint256,bytes32,bytes) 0xc08731ba in policy", has("policy", "0xc08731ba"));
  check("2d. check(uint256,bytes) 0xe57deb39 in policy + router", has("policy", "0xe57deb39") && has("routerImpl", "0xe57deb39"));
  check("2e. beforeAction 0xdc08fb1d + afterAction 0xa3fe4783 in router", has("routerImpl", "0xdc08fb1d") && has("routerImpl", "0xa3fe4783"));
  check("2f. fund 0xd2e13f50 + claimRefund 0x5b7baf64 in commerce impl", has("commerceImpl", "0xd2e13f50") && has("commerceImpl", "0x5b7baf64"));
  check("2g. dispute 0x86d6282c + disputeWindow 0x117f5f92 + voteReject 0xfedf9462 in policy", has("policy", "0x86d6282c") && has("policy", "0x117f5f92") && has("policy", "0xfedf9462"));
  check("2h. registerJob 0x51d5456d + settle 0x39c2ebb9 in router impl", has("routerImpl", "0x51d5456d") && has("routerImpl", "0x39c2ebb9"));
  check("2i. official registry policy 0xd6a421… deployed (has code)", (code.policy ?? "").length > 2);

  // 3. Job 515 state (provider, FUNDED, budget, expiry, hook).
  const job = await client.readContract({
    address: getAddress(config.commerce),
    abi: COMMERCE_VIEW_ABI,
    functionName: "getJob",
    args: [JOB_ID],
  });
  const jobRec = job as unknown as {
    client: string; provider: string; evaluator: string; budget: bigint;
    expiredAt: bigint; status: bigint; hook: string; submittedAt: bigint; deliverable: string;
  };
  check("3a. job 515 provider == provider EOA", getAddress(jobRec.provider) === getAddress(PROVIDER_EOA));
  check("3b. job 515 status == FUNDED (1)", Number(jobRec.status) === 1);
  check("3c. job 515 budget == exactly 1 U", jobRec.budget === ONE_U_RAW);
  check("3d. job 515 evaluator & hook == router", getAddress(jobRec.evaluator) === getAddress(config.router) && getAddress(jobRec.hook) === getAddress(config.router));
  check("3e. job 515 expiredAt == X.26 record 1786730495", jobRec.expiredAt === BigInt(EXPECTED_EXPIRED_AT));

  // 4. Submission preconditions still hold.
  const nowBlock = await client.getBlock({ blockTag: "latest" });
  const now = Number(nowBlock.timestamp);
  check("4a. expiredAt in future (now < 1786730495)", now < EXPECTED_EXPIRED_AT);

  // 4b. RESOLVING THE disputeWindow CONTRADICTION (X.26 report: '900s' vs '86400s').
  // The X.26 report recorded BOTH figures from TWO DIFFERENT policy contracts:
  //   - 86400s came from config.policy = the STALE SDK policy 0x4F4678… (read
  //     in erc8183.job.creation.x26.ts and used to derive expiredAt).
  //   - 900s came from the WL policy 0xd6a421… (erc8183.job.completion.cont.ts),
  //     which is the policy router.jobPolicy(515) actually binds the job to.
  // We verify BOTH live, from the exact contracts, with the binding taken
  // authoritatively from router.jobPolicy(515) — no guessing.
  const boundPolicy = String(
    await client.readContract({ address: getAddress(config.router), abi: ROUTER_VIEW_ABI, functionName: "jobPolicy", args: [JOB_ID] })
  );
  const staleSdkPolicy = getAddress(config.policy);
  const boundDisputeWindow = BigInt(
    String(await client.readContract({ address: getAddress(boundPolicy), abi: POLICY_VIEW_ABI, functionName: "disputeWindow" }))
  );
  const boundVoteQuorum = BigInt(
    String(await client.readContract({ address: getAddress(boundPolicy), abi: POLICY_VIEW_ABI, functionName: "voteQuorum" }))
  );
  const staleDisputeWindow = BigInt(
    String(await client.readContract({ address: staleSdkPolicy, abi: POLICY_VIEW_ABI, functionName: "disputeWindow" }))
  );
  check("4b0. router.jobPolicy(515) == WL policy 0xd6a421… (authoritative binding)", getAddress(boundPolicy) === getAddress(WL_POLICY));
  check("4b1. BOUND policy disputeWindow == 900s (reproduces X.26-cont/X.29A live)", boundDisputeWindow === EXPECTED_BOUND_DISPUTE_WINDOW);
  check("4b2. STALE SDK policy disputeWindow == 86400s (source of X.25/X.26 expiredAt derivation)", staleDisputeWindow === EXPECTED_STALE_DISPUTE_WINDOW);
  check("4b3. SUBMISSION GATE open with BOUND window: now + 900 <= expiredAt", BigInt(now) + boundDisputeWindow <= BigInt(EXPECTED_EXPIRED_AT));

  const kernelPaused = Boolean(await client.readContract({ address: getAddress(config.commerce), abi: COMMERCE_VIEW_ABI, functionName: "paused" }));
  check("4c. commerce not paused (whenNotPaused gate open)", kernelPaused === false);
  const polSubmit = BigInt(
    String(await client.readContract({ address: getAddress(boundPolicy), abi: POLICY_VIEW_ABI, functionName: "submittedAt", args: [JOB_ID] }))
  );
  check("4d. BOUND policy.submittedAt(515) == 0 (not yet initialised; onSubmitted idempotent)", polSubmit === 0n);

  // DIAGNOSTIC DUMP — surface raw values so the contradiction is fully explained.
  console.log("  [diag] router.jobPolicy(515)      =", getAddress(boundPolicy), "(authoritative binding)");
  console.log("  [diag] BOUND policy disputeWindow  =", boundDisputeWindow.toString() + "s", "| voteQuorum =", boundVoteQuorum.toString());
  console.log("  [diag] STALE SDK policy            =", staleSdkPolicy, "| disputeWindow =", staleDisputeWindow.toString() + "s");
  console.log("  [diag] job515 status               =", jobRec.status.toString(), "| kernel submittedAt=", jobRec.submittedAt.toString(), "| deliverable set:", jobRec.deliverable !== `0x${"0".repeat(64)}`);
  console.log("  [diag] now(block)=", now, "| expiredAt=", EXPECTED_EXPIRED_AT.toString(), "| remaining=", (EXPECTED_EXPIRED_AT - BigInt(now)).toString() + "s");

  // 5. Deterministic unsigned `submit` calldata preview + round-trip decode.
  const deliverable = keccak256(toBytes(DELIVERABLE_MANIFEST)); // deterministic manifest hash (bytes32)
  const optParams = toHex(DELIVERABLE_MANIFEST);
  const callData = encodeFunctionData({ abi: SUBMIT_ABI, functionName: "submit", args: [JOB_ID, deliverable, optParams] });
  check("5a. calldata selector == 0x9e63798d (submit(uint256,bytes32,bytes))", callData.startsWith("0x9e63798d"));

  // Manual ABI decode of (uint256,bytes32,bytes): selector(4B) + 3 heads(96B), then optParams tail.
  const hex = callData.slice(2);
  const headJobId = BigInt("0x" + hex.slice(8, 8 + 64)).toString();
  const headDeliverable = `0x${hex.slice(8 + 64, 8 + 128)}`;
  const optByteOffset = Number(BigInt("0x" + hex.slice(8 + 128, 8 + 192))); // bytes, relative to byte 4
  const optStart = 8 + optByteOffset * 2; // hex char = 2 * absolute byte; absolute byte = 4 + offset
  const optLen = BigInt("0x" + hex.slice(optStart, optStart + 64));
  const optText = Buffer.from(hex.slice(optStart + 64, optStart + 64 + Number(optLen) * 2), "hex").toString("utf8");
  const decodedOk =
    BigInt(headJobId) === JOB_ID && headDeliverable === deliverable && optText === DELIVERABLE_MANIFEST;
  check(
    `5b. calldata round-trips to submit(515, keccak(manifest), manifest) ` +
      `[jobId=${headJobId} deliverable=${headDeliverable.slice(0, 10)}… optParams=${optText.length}B ${decodedOk ? "exact" : "MISMATCH"}]`,
    decodedOk
  );
  check("5c. deliverable bytes32 = keccak256(manifest) (nonzero)", deliverable !== "0x" + "0".repeat(64));

  // 6. SubmissionGate verdict (authoritative: OptimisticPolicy.onSubmitted L223, BOUND window).
  const gateOpen = BigInt(now) + boundDisputeWindow <= BigInt(EXPECTED_EXPIRED_AT);
  const gate = gateOpen ? "OPEN — job 515 CAN be submitted" : "BLOCKED — SubmissionTooLate (now + disputeWindow > expiredAt)";
  check(`6a. bound policy.onSubmitted gate [${gate}]`, gateOpen);
  const submitDeadline = Number(EXPECTED_EXPIRED_AT) - Number(boundDisputeWindow); // last second a submit can be mined
  console.log(`  [diag] submit must be mined before unix ${submitDeadline} (${new Date(submitDeadline * 1000).toISOString()})`);

  console.log("");
  const failed = checks.filter((c) => !c.ok);
  console.log(`X.29B read-only ABI discovery: ${checks.length - failed.length}/${checks.length} passed`);

  console.log("");
  console.log("MECHANISM FOUND (authoritative):");
  console.log("  Submission contract : AgenticCommerce (ERC-8183 kernel) proxy");
  console.log(`    commerce proxy     : ${getAddress(config.commerce)}`);
  console.log(`    commerce impl      : ${getAddress(OFFICIAL_ADDRESSES.commerceImpl)} (AgenticCommerceUpgradeable)`);
  console.log(`  path                : commerce.submit(jobId, deliverable, optParams)`);
  console.log(`                      -> hook(router).afterAction(SUBMIT) -> policy.onSubmitted(jobId, deliverable, optParams)`);
  console.log(`  router (hook+evalu) : ${getAddress(config.router)}`);
  console.log(`  policy              : ${getAddress(WL_POLICY)} (OptimisticPolicy)`);
  console.log(`  Function signature  : submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams)`);
  console.log(`  Selector            : 0x9e63798d`);
  console.log(`  Caller              : job.provider = ${getAddress(jobRec.provider)} (provider-only per EIP-8183)`);
  console.log(`  Arguments           : jobId=515, deliverable=<bytes32 manifest hash>, optParams=<deliverable manifest bytes>`);
  console.log(`  Deliverable format  : optParams JSON manifest = ${DELIVERABLE_MANIFEST}`);
  console.log(`  deliverable bytes32 : ${deliverable}`);
  console.log(`  optParams (hex)     : ${optParams}`);
  console.log(`  State transition    : FUNDED (1) -> SUBMITTED (2); kernel sets submittedAt+deliverable;`);
  console.log(`                        policy.onSubmitted records policy-side submittedAt + emits JobInitialised;`);
  console.log(`                        escalate COMPLETED only via router.settle after disputeWindow when verdict=APPROVE.`);

  console.log("");
  console.log("  SUBMISSION GATE (OptimisticPolicy.onSubmitted L223: block.timestamp + disputeWindow > expiredAt -> SubmissionTooLate):");
  console.log(`    now(block)=${now}, BOUND disputeWindow=${boundDisputeWindow}, STALE SDK disputeWindow=${staleDisputeWindow}, expiredAt=${EXPECTED_EXPIRED_AT}`);
  console.log(`    remaining=${EXPECTED_EXPIRED_AT - BigInt(now)}s vs BOUND disputeWindow=${boundDisputeWindow}s -> ${gateOpen ? "gate OPEN" : "gate BLOCKED (SubmissionTooLate)"}`);
  console.log(`    => JOB 515 IS ${gateOpen ? "SUBMITTABLE" : "NOT SUBMITTABLE"} AT THIS BLOCK HEIGHT.`);
  if (gateOpen) {
    console.log(`    TIME-BOX: submit must be mined before unix ${submitDeadline} (expiredAt - disputeWindow); kernel guard: block.timestamp < expiredAt.`);
  } else {
    console.log(`    UNBLOCK RECIPE: create+fund a NEW job (next id = jobCounter()+1) with expiredAt >= now + ${boundDisputeWindow} + margin`);
    console.log(`    (createJob bound: expiredAt in (now + 5min, now + MAX_EXPIRY_DURATION)); then submit with this exact ABI/calldata shape.`);
  }
  console.log("");
  console.log(`  SDK DRIFT (finding): @altananetwork/sdk erc8183Addresses(97).policy = ${getAddress(config.policy)}`);
  console.log(`    != bound policy ${getAddress(WL_POLICY)} (router.jobPolicy(515)). The SDK address table is stale; the`);
  console.log(`    authoritative policy is the one registered in the router lab (apex addresses.ts + jobPolicy).`);
  console.log(`    This drift is ALSO the root cause of the X.26 900s-vs-86400s disputeWindow contradiction:`);
  console.log(`    86400s = stale SDK policy 0x4F4678… (X.25/X.26 read it for expiredAt); 900s = BOUND policy 0xd6a421…`);
  console.log(`    (X.26-cont + X.29A). The bound-policy 900s is the only window the submission gate applies.`);

  console.log("");
  console.log(`  UNSIGNED PREVIEW submit calldata (NOT BROADCAST): ${callData}`);
  console.log("");

  console.log("X.29B STATUS: FOUND — exact provider submission mechanism + calldata shape established (READ-ONLY).");
  console.log(`  SUBMISSION GATE : ${gateOpen ? "OPEN — job 515 is SUBMITTABLE (time-box until unix " + submitDeadline + ")" : "BLOCKED — SubmissionTooLate; restage a new job per UNBLOCK RECIPE"}`);
  console.log("  SIGNING:    NOT PERFORMED");
  console.log("  BROADCAST:  NOT PERFORMED");
  console.log("  PAYMENT:    NOT PERFORMED");
  console.log("  SETTLEMENT: NOT PERFORMED");
  console.log("  MAINNET:    NOT TOUCHED");

  if (failed.length > 0) process.exit(1);
}

await main();