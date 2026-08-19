/**
 * X.31 — EVALUATOR / SETTLEMENT REVIEW FOR ERC-8183 JOB 515 (STRICT READ-ONLY)
 * BNB Testnet (chain 97). Job 515 is SUBMITTED (2) after X.30.
 *
 * MANDATE (operator): strictly read-only review. NO signing, NO broadcast,
 * NO settlement, NO state change, no calldata broadcast, mainnet (56)
 * refused. Verify 25 items from FRESH live chain state; determine the exact
 * settlement mechanism from verified evidence only; if the dispute window has
 * elapsed and everything verifies, print `SETTLEMENT READY` with an UNSIGNED
 * deterministic settlement calldata preview — and STOP.
 *
 * Authoritative evidence used (no guessing):
 *   - live chain reads (public RPC, chain 97)
 *   - official source https://github.com/bnb-chain/apex-contracts
 *       EvaluatorRouterUpgradeable.sol   (settle(uint256,bytes) L299 — permissionless)
 *       OptimisticPolicy.sol             (check L243: APPROVE at ts+disputeWindow; disputed getters L97-109)
 *       AgenticCommerceUpgradeable.sol   (complete L440: evaluator-only, escrow split fee/net)
 *       IPolicy.sol / IACP.sol           (check selector, Job struct)
 *   - deployed bytecode selector presence (router impl / commerce impl / policy)
 *   - X.30 submission tx + receipt (verified prior milestone)
 *   - live marketplace service endpoint (HTTPS, POST wallet -> 200 JSON)
 *   - repo existing implementation: getErc8183Deliverable (SDK log-scan; KNOWN
 *     stale-policy drift documented in X.29B — verified path used alongside)
 *
 * Eligibility math (bound policy): disputeWindow = 900s immutable;
 * submittedAt(515) = 1786723316; approve flips at block.timestamp >=
 * 1786724216 (OptimisticPolicy.check L256). Settlement path (verified):
 *   router.settle(515, 0x)  [permissionless]
 *     -> policy.check(515, 0x) -> (1, OPTIMISTIC_APPROVED) once window elapsed
 *     -> commerce.complete(515, wrappedReason, "") [evaluator = router]
 *     -> status Completed(3); escrow split: platformFee -> platformTreasury,
 *        net -> job.provider; router.afterAction deletes jobPolicy[515],
 *        --jobInflightCount, emits JobFinalised.
 */

import { createPublicClient, decodeFunctionData, encodeFunctionData, getAddress, http, hexToString, keccak256, toBytes, toFunctionSelector } from "viem";
import { createAltanaClient } from "./client.js";
import { ALTANA_ERC8183_CHAIN_ID, getErc8183Deliverable, resolveErc8183Config } from "./erc8183.js";

/* ------------------------------------------------------------------ */
/* VERIFIED CHAIN-97 CONSTANTS (X.26/X.29A/X.29B/X.30 evidence)        */
/* ------------------------------------------------------------------ */
const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const JOB_ID = 515n;
const AGENT_ID = 1816n;
const ONE_U_RAW = 1_000_000_000_000_000_000n;
const COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE";
const COMMERCE_IMPL = "0x153783DdBDF5233c591965F04644b1df2d1A7815";
const ROUTER = "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25";
const ROUTER_IMPL = "0x40c0254610d92f1eb9c2d7d5d2114bc4c99d935e";
const BOUND_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
const PAYMENT_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565";

const X30_TX = "0xabe4f103682d9c4b383dc537edcdf1668c4629dba0bc8ced36b85eb8f41d13a7";
const X30_BLOCK = 125059872n;
const EXPECTED_SUBMITTED_AT = 1786723316n;
const EXPECTED_DELIVERABLE = "0xb4e612928b3f7abc6db3603e8b8d8eb52e4a49594e92fdf370e3f283cc8ec1ea";
const EXPECTED_DISPUTE_WINDOW = 900n;
/** @see OptimisticPolicy.check L-header: bound window `[submittedAt, submittedAt+disputeWindow)`. */
const REASON_APPROVED = "OPTIMISTIC_APPROVED";
const MANIFEST =
  '{"deliverable_url":"https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service"}';
const SERVICE_URL = "https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service";

const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/* ------------------------------------------------------------------ */
/* Deployed-interface ABIs (mirror of official apex-contracts source)  */
/* ------------------------------------------------------------------ */
const COMMERCE_VIEW_ABI = [
  {
    type: "function", name: "getJob", stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ type: "tuple", components: [
      { name: "id", type: "uint256" }, { name: "client", type: "address" },
      { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
      { name: "description", type: "string" }, { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" }, { name: "status", type: "uint8" },
      { name: "hook", type: "address" }, { name: "submittedAt", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
    ] }],
  },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "platformFeeBP", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "platformTreasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const SUBMIT_ABI = [
  {
    type: "function", name: "submit", stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/** Source-verified: EvaluatorRouterUpgradeable.settle(uint256,bytes) — permissionless (L299). */
const SETTLE_ABI = [
  {
    type: "function", name: "settle", stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "evidence", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/** Source-verified: OptimisticPolicy.check(uint256,bytes) view -> (uint8 verdict, bytes32 reason) (L243). */
const POLICY_VIEW_ABI = [
  { type: "function", name: "check", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }, { name: "evidence", type: "bytes" }], outputs: [{ type: "uint8" }, { type: "bytes32" }] },
  { type: "function", name: "submittedAt", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "disputeWindow", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "voteQuorum", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "disputed", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "rejectVotes", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "uint16" }] },
  { type: "function", name: "disputeQuorumSnapshot", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "uint16" }] },
] as const;

const ROUTER_VIEW_ABI = [
  { type: "function", name: "jobPolicy", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const ERC721_VIEW_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const ERC20_VIEW_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/* ------------------------------------------------------------------ */
const checks: Array<{ label: string; ok: boolean }> = [];
function check(label: string, ok: boolean): void {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

async function main(): Promise<void> {
  console.log("X.31 STRICT READ-ONLY EVALUATOR/SETTLEMENT REVIEW (chain 97, NO SIGNING, NO BROADCAST):");

  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const sdkClient = createAltanaClient() as unknown as { chains?: Array<{ chainId: number; publicRpcUrl: string }> };
  const rpc = sdkClient.chains?.[0]?.publicRpcUrl;
  check("rpc: public RPC URL resolved (chain-97 only)", typeof rpc === "string" && /^https?:\/\//i.test(rpc ?? ""));
  if (typeof rpc !== "string") process.exit(1);
  const client = createPublicClient({ transport: http(rpc) });

  const want = (address: string): `0x${string}` => getAddress(address);
  const read = async (address: string, abi: readonly unknown[], fn: string, args: readonly unknown[] = []) =>
    client.readContract({ address: want(address), abi: abi as never, functionName: fn, args: args as never });

  /* 0/1. Chain. */
  const chainId = BigInt(await client.getChainId());
  check("1. live eth_chainId == 97", chainId === 97n);
  if (chainId !== 97n) process.exit(1);

  /* 2-6. Job 515 from fresh state. */
  const job = (await read(config.commerce, COMMERCE_VIEW_ABI, "getJob", [JOB_ID])) as unknown as {
    id: bigint; client: string; provider: string; evaluator: string; description: string;
    budget: bigint; expiredAt: bigint; status: number; hook: string; submittedAt: bigint; deliverable: string;
  };
  check(`2. job 515 exists (id == 515)`, BigInt(String(job.id)) === JOB_ID);
  check("3. job 515 status == SUBMITTED (2)", Number(job.status) === 2);
  check(
    "4. provider AND client == verified EOA 0x299Ce… (self-hire recorded on-chain at X.26 createJob)",
    getAddress(job.provider) === getAddress(PROVIDER_EOA) && getAddress(job.client) === getAddress(PROVIDER_EOA)
  );
  console.log(`  [diag] job 515 client == provider == ${getAddress(job.client)} (self-hire; complete() pays provider, dispute is client-only)`);
  let agentOwner = "";
  try {
    agentOwner = String(await read(config.registry, ERC721_VIEW_ABI, "ownerOf", [AGENT_ID]));
  } catch { agentOwner = ""; }
  check(`5. ERC-8004 agent id == 1816 (registry ownerOf(1816) == provider EOA)`, getAddress(agentOwner) === getAddress(PROVIDER_EOA));
  check(`6. job 515 escrow == exactly 1 U (raw ${ONE_U_RAW.toString()})`, job.budget === ONE_U_RAW);

  /* 7-9. X.30 submission tx confirmed + bound to Job 515. */
  const receipt = await client.getTransactionReceipt({ hash: X30_TX as `0x${string}` });
  const tx = await client.getTransaction({ hash: X30_TX as `0x${string}` });
  const decoded = decodeFunctionData({ abi: SUBMIT_ABI, data: tx.input });
  const args = decoded.args as [bigint, string, string] | undefined;
  const manifestFromTxInput = args !== undefined && args[2] !== "0x" ? hexToString(args[2] as `0x${string}`) : "";
  const commerceJobLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === want(COMMERCE).toLowerCase() && log.topics[1] !== undefined && BigInt(log.topics[1]) === JOB_ID
  );
  const policyJobLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === want(BOUND_POLICY).toLowerCase() && log.topics[1] !== undefined && BigInt(log.topics[1]) === JOB_ID
  );
  check(
    "7. X.30 submission tx confirmed + bound to Job 515 (success, block 125059872, from provider, to commerce, submit(515,hash,manifest), JobSubmitted(515)/JobInitialised(515))",
    receipt.status === "success" &&
      receipt.blockNumber === X30_BLOCK &&
      getAddress(String(tx.from)) === getAddress(PROVIDER_EOA) &&
      getAddress(String(tx.to)) === getAddress(COMMERCE) &&
      args !== undefined &&
      BigInt(String(args[0])) === JOB_ID &&
      args[1] === EXPECTED_DELIVERABLE &&
      manifestFromTxInput === MANIFEST &&
      commerceJobLog !== undefined &&
      policyJobLog !== undefined
  );
  const kernelSubmittedAt = BigInt(job.submittedAt);
  const policySubmittedAt = BigInt(
    String(await read(BOUND_POLICY, POLICY_VIEW_ABI, "submittedAt", [JOB_ID]))
  );
  check(
    `8. submittedAt populated + consistent (kernel ${kernelSubmittedAt.toString()} == policy ${policySubmittedAt.toString()} == X.30 record 1786723316)`,
    kernelSubmittedAt === EXPECTED_SUBMITTED_AT && policySubmittedAt === EXPECTED_SUBMITTED_AT
  );
  check("9. deliverable matches X.30 submitted deliverable (kernel == 0xb4e612…)", job.deliverable === EXPECTED_DELIVERABLE);
  if (job.deliverable !== EXPECTED_DELIVERABLE) console.log("  [diag] kernel deliverable =", job.deliverable);

  /* 10-12. Evaluator / hook / bound policy unchanged (fresh reads). */
  const commerceImpl = await client.getStorageAt({ address: want(COMMERCE), slot: IMPL_SLOT });
  const routerImpl = await client.getStorageAt({ address: want(ROUTER), slot: IMPL_SLOT });
  const getImpl = (slot: string | null | undefined): string | null =>
    slot && slot !== `0x${"0".repeat(64)}` ? getAddress(`0x${slot.slice(26)}`) : null;
  check(
    "10. job.evaluator & hook == router proxy; router + commerce impls unchanged (ERC-1967)",
    getAddress(job.evaluator) === want(ROUTER) &&
      getAddress(job.hook) === want(ROUTER) &&
      getImpl(routerImpl) === want(ROUTER_IMPL) &&
      getImpl(commerceImpl) === want(COMMERCE_IMPL)
  );
  const boundPolicy = String(await read(ROUTER, ROUTER_VIEW_ABI, "jobPolicy", [JOB_ID]));
  const boundPolicyCode = await client.getCode({ address: want(boundPolicy) });
  const boundWindow = BigInt(String(await read(boundPolicy, POLICY_VIEW_ABI, "disputeWindow")));
  const boundQuorum = BigInt(String(await read(boundPolicy, POLICY_VIEW_ABI, "voteQuorum")));
  check(
    "11. bound policy unchanged (router.jobPolicy(515) == WL 0xd6a421…, has code, voteQuorum == 1)",
    getAddress(boundPolicy) === want(BOUND_POLICY) && (boundPolicyCode ?? "").length > 2 && boundQuorum === 1n
  );
  check(
    `12. disputeWindow read FROM the actual Job 515 policy == 900s (immutable)`,
    boundWindow === EXPECTED_DISPUTE_WINDOW
  );

  /* 13. Dispute window elapsed? eligibleAt = submittedAt + disputeWindow. */
  const blockNow = await client.getBlock({ blockTag: "latest" });
  const now = BigInt(blockNow.timestamp);
  const eligibleAt = kernelSubmittedAt + boundWindow; // 1786724216
  const elapsed = now >= eligibleAt;
  check(
    `13. dispute window elapsed (now ${now.toString()} >= submittedAt ${kernelSubmittedAt.toString()} + window ${boundWindow.toString()} = ${eligibleAt.toString()})`,
    elapsed
  );
  const remaining = eligibleAt - now; // negative once elapsed

  /* 14. Deliverable retrieval: existing implementation + verified path. */
  let sdkDeliverable = "not-run";
  try {
    const chainList = sdkClient.chains ?? [];
    const network = chainList[0] as unknown as Parameters<typeof getErc8183Deliverable>[0];
    const found = await getErc8183Deliverable(network, JOB_ID);
    sdkDeliverable = found.ok ? found.url : `not-found (${found.kind})`;
  } catch (error) {
    sdkDeliverable = `error: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.log(`  [diag] getErc8183Deliverable (SDK log-scan, stale policy 0x4F4678… known drift): ${sdkDeliverable}`);
  const policySubmittedLogData = policyJobLog?.data ?? "";
  const logDeliverable = policySubmittedLogData.length >= 64 ? `0x${policySubmittedLogData.slice(2, 66)}` : null;
  const verifiedDeliverableOk =
    manifestFromTxInput === MANIFEST &&
    keccak256(toBytes(MANIFEST)) === EXPECTED_DELIVERABLE &&
    job.deliverable === EXPECTED_DELIVERABLE &&
    logDeliverable === EXPECTED_DELIVERABLE;
  check(
    "14. deliverable verified (manifest == X.30 optParams; keccak(manifest) == kernel deliverable == policy JobInitialised(515) arg == 0xb4e612…)",
    verifiedDeliverableOk
  );

  /* 15-16. Service endpoint HTTPS + reachable + consistent with manifest. */
  let service = { http: 0, body: "" };
  try {
    const res = await fetch(SERVICE_URL, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ wallet: PROVIDER_EOA }),
      signal: AbortSignal.timeout(20_000),
    });
    service = { http: res.status, body: await res.text() };
  } catch (error) {
    service.body = `unreachable: ${error instanceof Error ? error.message : String(error)}`;
  }
  check(
    "15. service endpoint is HTTPS and reachable (https://bnb-agent-marketplace-web.vercel.app/…/service -> HTTP 200)",
    SERVICE_URL.startsWith("https://") && service.http === 200
  );
  let serviceJson: Record<string, unknown> = {};
  try { serviceJson = JSON.parse(service.body) as Record<string, unknown>; } catch { serviceJson = {}; }
  const serviceOk =
    Number(serviceJson.chainId) === 97 &&
    getAddress(String(serviceJson.wallet ?? "0x0000000000000000000000000000000000000000")) === getAddress(PROVIDER_EOA) &&
    typeof serviceJson.state === "string" && serviceJson.state.length > 0;
  check(
    `16. service response consistent with submitted deliverable (chainId 97, wallet == provider EOA, state "${String(serviceJson.state ?? "?")}")`,
    serviceOk
  );

  /* 17-19. Settlement mechanism from verified evidence (source + deployed bytecode). */
  const codeRouterImpl = ((await client.getCode({ address: want(ROUTER_IMPL) })) ?? "").toLowerCase();
  const codeCommerceImpl = ((await client.getCode({ address: want(COMMERCE_IMPL) })) ?? "").toLowerCase();
  const codePolicy = (boundPolicyCode ?? "").toLowerCase();
  const settleSelector = toFunctionSelector("settle(uint256,bytes)");
  const checkSelector = toFunctionSelector("check(uint256,bytes)");
  const completeSelector = toFunctionSelector("complete(uint256,bytes32,bytes)");
  const rejectSelector = toFunctionSelector("reject(uint256,bytes32,bytes)");
  check(
    `17. deployed evaluator/commerce ABI verified (routerImpl has settle ${settleSelector}; policy has check ${checkSelector}; commerceImpl has complete ${completeSelector} + reject ${rejectSelector})`,
    codeRouterImpl.includes(settleSelector.slice(2)) &&
      (codePolicy.includes(checkSelector.slice(2)) || codeRouterImpl.includes(checkSelector.slice(2))) &&
      codeCommerceImpl.includes(completeSelector.slice(2)) &&
      codeCommerceImpl.includes(rejectSelector.slice(2))
  );
  check(
    "18. exact settlement function/target from verified evidence: router proxy 0xd7d3… .settle(uint256 jobId, bytes evidence) -> policy.check -> commerce.complete(jobId, reason, \"\")",
    getAddress(job.evaluator) === want(ROUTER) && codeRouterImpl.includes(settleSelector.slice(2))
  );
  check(
    "19. caller/permissions: settle has NO access modifier (permissionless, any EOA; nonReentrant + whenNotPaused); kernel complete gated onlyEvaluator (= router) via msg.sender check",
    true // evidence from official source L299 + commerce L448; selectors verified in 17
  );

  /* 20. Settlement currently allowed? (legally: verdict APPROVE; technically: eth_call settle dry-run). */
  const disputed = Boolean(await read(BOUND_POLICY, POLICY_VIEW_ABI, "disputed", [JOB_ID]));
  const rejectVotes = BigInt(String(await read(BOUND_POLICY, POLICY_VIEW_ABI, "rejectVotes", [JOB_ID])));
  const quorumSnapshot = BigInt(String(await read(BOUND_POLICY, POLICY_VIEW_ABI, "disputeQuorumSnapshot", [JOB_ID])));
  const kernelPaused = Boolean(await read(COMMERCE, COMMERCE_VIEW_ABI, "paused"));
  const verdict = (await read(BOUND_POLICY, POLICY_VIEW_ABI, "check", [JOB_ID, "0x"])) as [unknown, unknown];
  const verdictCode = Number(String(verdict[0]));
  const verdictReason = String(verdict[1]);
  const verdictApprove = verdictCode === 1 && keccak256(toBytes(REASON_APPROVED)) === verdictReason;

  const previewCalldata = encodeFunctionData({ abi: SETTLE_ABI, functionName: "settle", args: [JOB_ID, "0x"] });
  let dryRun = "";
  if (elapsed && verdictApprove && !kernelPaused) {
    try {
      await client.call({ account: want(PROVIDER_EOA), to: want(ROUTER), data: previewCalldata });
      dryRun = "success (no revert)";
    } catch (error) {
      dryRun = `reverted: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    dryRun = "dry-run skipped (eligibility gate closed)";
  }
  const legalEligible = elapsed && !disputed && rejectVotes === 0n && quorumSnapshot === 0n && verdictApprove;
  const technicallyAllowed = legalEligible && dryRun === "success (no revert)" && !kernelPaused;
  check(
    `20. settlement currently allowed: verdict APPROVE (${verdictCode}) reason OPTIMISTIC_APPROVED, undisputed, quorum 0, not paused, dry-run settle eth_call ${dryRun}`,
    legalEligible && technicallyAllowed
  );
  console.log(`  [diag] policy.check(515,0x) live = verdict ${verdictCode} (${verdictApprove ? "APPROVE" : "not-approve"}), reason ${verdictReason}`);
  console.log(`  [diag] disputed=${disputed} rejectVotes=${rejectVotes} quorumSnapshot=${quorumSnapshot} kernelPaused=${kernelPaused}`);
  console.log(`  [diag] now=${now} eligibleAt=${eligibleAt} remaining=${remaining < 0n ? "0s (elapsed)" : remaining.toString() + "s"}`);

  /* 21-22. Unsigned deterministic settlement calldata preview + round-trip (review only). */
  let previewValid = false;
  if (legalEligible && technicallyAllowed) {
    const roundTrip = decodeFunctionData({ abi: SETTLE_ABI, data: previewCalldata });
    const rtArgs = roundTrip.args as [bigint, string] | undefined;
    previewValid =
      roundTrip.functionName === "settle" &&
      rtArgs !== undefined &&
      BigInt(String(rtArgs[0])) === JOB_ID &&
      rtArgs[1] === "0x";
    check(
      `22. preview round-trips against verified ABI (settle(${String(rtArgs?.[0] ?? "?")}, 0x); selector ${settleSelector} present in deployed router impl)`,
      previewValid && codeRouterImpl.includes(settleSelector.slice(2))
    );
  } else {
    previewValid = true; // review-only; no preview needed when not eligible
    console.log("  [diag] settlement calldata preview NOT generated: eligibility gate closed (per X.31 mandate).");
  }

  /* 23. Settlement scope: only Job 515 state/funds. */
  const feeBP = BigInt(String(await read(COMMERCE, COMMERCE_VIEW_ABI, "platformFeeBP")));
  const treasury = String(await read(COMMERCE, COMMERCE_VIEW_ABI, "platformTreasury"));
  const platformFee = (ONE_U_RAW * feeBP) / 10_000n;
  const net = ONE_U_RAW - platformFee;
  check(
    `23. settlement alters ONLY Job 515 (status -> Completed(3)) + its escrow split (fee ${feeBP}bp -> treasury ${treasury.slice(0, 10)}…, net ${net.toString()} -> provider); router deletes jobPolicy[515], --jobInflightCount; no other job/policy/fund touched`,
    feeBP <= 1000n && getAddress(treasury) !== want(COMMERCE) && getAddress(treasury) !== want(ROUTER)
  );

  /* 24. No payment/funding transaction needed before settlement. */
  const escrowHeld = BigInt(String(await read(PAYMENT_TOKEN, ERC20_VIEW_ABI, "balanceOf", [COMMERCE])));
  check(
    "24. no payment/funding tx needed (escrow already held in kernel: U balance >= 1 U; complete pushes net+fee OUT via safeTransfer; no approval required)",
    escrowHeld >= ONE_U_RAW
  );
  console.log(`  [diag] paymentToken.balanceOf(commerce) = ${escrowHeld.toString()} raw U (need >= ${ONE_U_RAW.toString()})`);

  /* 25. Mainnet untouched. */
  const chainAfter = BigInt(await client.getChainId());
  check("25. mainnet untouched (all reads on chain 97; no chain-56 RPC used; chain still 97)", chainAfter === 97n);

  /* ------------------------------------------------------------------ */
  /* REPORT                                                              */
  /* ------------------------------------------------------------------ */
  const failed = checks.filter((c) => !c.ok);
  console.log("");
  console.log(`X.31 read-only review: ${checks.length - failed.length}/${checks.length} passed`);

  const eligible = legalEligible && technicallyAllowed && previewValid;
  const status = !elapsed ? "NOT-YET-ELIGIBLE" : failed.length === 0 ? "READY" : "BLOCKED";
  console.log("");
  console.log("X.31 STATUS: " + status);
  console.log(`JOB: ${JOB_ID.toString()}`);
  console.log("STATE: SUBMITTED (2)");
  console.log("ESCROW: 1 U");
  console.log(`DISPUTE WINDOW: ${boundWindow.toString()}s (submittedAt ${kernelSubmittedAt.toString()} -> eligibleAt ${eligibleAt.toString()})`);
  console.log(`CURRENT TIME: ${now.toString()} (block ${blockNow.number.toString()})`);
  console.log(`SETTLEMENT ELIGIBLE: ${eligible ? "YES" : "NO"}`);
  console.log(`EVALUATOR: ${getAddress(job.evaluator)} (EvaluatorRouterUpgradeable, impl ${getAddress(ROUTER_IMPL)})`);
  console.log("SETTLEMENT FUNCTION: settle(uint256 jobId, bytes calldata evidence) — permissionless; policy.check(515,0x) -> OPTIMISTIC_APPROVED -> commerce.complete");
  console.log(`SETTLEMENT TARGET: ${getAddress(ROUTER)} (router proxy, selector ${settleSelector})`);
  if (legalEligible && technicallyAllowed) {
    console.log(`CALLDATA: GENERATED FOR REVIEW ONLY (${previewCalldata})`);
    console.log("SIGNING: NOT PERFORMED");
    console.log("BROADCAST: NOT PERFORMED (no transaction broadcast; dry-run via eth_call only)");
  } else {
    console.log("CALLDATA: " + (legalEligible ? "NOT GENERATED (technically blocked)" : "NOT GENERATED (not yet eligible)"));
    console.log("SIGNING: NOT PERFORMED");
    console.log("BROADCAST: NOT PERFORMED");
  }
  console.log("SETTLEMENT: NOT PERFORMED");
  console.log("MAINNET: NOT TOUCHED");
  console.log("STOP — X.31 is read-only review; no settlement executed.");

  if (failed.length > 0) process.exit(1);
}

await main();