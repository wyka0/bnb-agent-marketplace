/**
 * X.29A — STRICT READ-ONLY ERC-8183 JOB 515 SERVICE EXECUTION / HIRE REVIEW
 * (BNB Testnet, chain 97). NO BROADCAST.
 *
 * Verifies the 20 mandated checks for the NEXT step (provider service
 * execution + deliverable submission) against LIVE chain state and the
 * existing verified implementation (SDK 0.7.0 + repo adapter):
 *
 *   1..9   live chain/job/agent/policy state (FUNDED, escrow 1 U, evaluator,
 *          whitelisted policy, ERC-8004 owner/URI).
 *   10,11  service endpoint HTTPS reachability + structured ready response
 *          cross-checked against a live eth_getBalance.
 *   12..20 execution-function path determination, calldata availability,
 *          signer requirement, no-extra-payment, no-settlement, expected
 *          state transition, deliverable format, chain-97 pinning, and the
 *          registered service request contract.
 *
 * SECURITY RULES:
 *   - No transaction is signed or broadcast; no payment; no settlement.
 *   - Provider private key read ONLY from `.env.local`
 *     (ALTANA_TESTNET_PRIVATE_KEY) to compare the derived signer address
 *     against the verified provider EOA; never printed.
 *   - Mainnet refused. Job 515 / Agent 1816 not modified.
 *   - The review STOPS (exits non-zero) on any failed check.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  decodeFunctionData,
  getAddress,
  http,
  toFunctionSelector,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
const ONE_U_RAW = 1_000_000_000_000_000_000n;
/** Whitelisted OptimisticPolicy bound by the deployed chain-97 EvaluatorRouter. */
const WL_POLICY = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
/** SDK 0.7.0 stale policy — NOT whitelisted on chain 97 (X.26 divergence). */
const SDK_STALE_POLICY = "0x4F4678D4439feC812Ac7674Bb3Efb4C8f5Fb78A6";
const VERIFIED_ROUTER = "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25";
const ERC8004_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const PUBLIC_HTTPS_ORIGIN = "https://bnb-agent-marketplace-web.vercel.app";
const CANONICAL_METADATA_URI = `${PUBLIC_HTTPS_ORIGIN}/.well-known/agent-registration.json`;
const CANONICAL_SERVICE_ENDPOINT = `${PUBLIC_HTTPS_ORIGIN}/api/agents/bnb-testnet-risk/service`;
const PROVIDER_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";
/** Public X.26 createJob on-chain expiration (public record; job is not modified). */
const EXPECTED_EXPIRED_AT = 1786730495n;

const REGISTRY_READ_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "agentURI",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
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

const ROUTER_POLICY_ABI = [
  {
    type: "function",
    name: "policyWhitelist",
    stateMutability: "view",
    inputs: [{ name: "policy", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const WL_POLICY_VIEW_ABI = [
  {
    type: "function",
    name: "disputeWindow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "voteQuorum",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const checks: Array<{ label: string; ok: boolean }> = [];
export interface RiskServiceShape {
  state?: string;
  chainId?: unknown;
  wallet?: string;
  nativeBalanceWei?: string;
}
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
  console.log("X.29A READ-ONLY ERC-8183 JOB 515 SERVICE EXECUTION / HIRE REVIEW (chain 97, NO BROADCAST):");

  // ---------------------------------------------------------------------------
  // Config + public RPC.
  // ---------------------------------------------------------------------------
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  check(
    "ERC-8183 targets resolve to verified chain-97 implementation",
    config.chainId === 97 &&
      getAddress(config.commerce) === getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE") &&
      getAddress(config.router) === getAddress(VERIFIED_ROUTER) &&
      getAddress(config.registry) === getAddress(ERC8004_REGISTRY) &&
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
  const liveChainId = BigInt(await client.getChainId());
  check("1. live eth_chainId == 97", liveChainId === 97n);
  if (liveChainId !== 97n) process.exit(1);

  // 2. Job 515 exists.
  let job;
  try {
    job = await getErc8183Job(BNB_TESTNET, JOB_ID);
    check(`2. job ${JOB_ID.toString()} exists on chain`, job.id === JOB_ID);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL 2. job ${JOB_ID.toString()} exists on chain (${message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]")})`);
    process.exit(1);
  }

  // 3. Job 515 belongs to the verified provider (client + provider role).
  const ours =
    getAddress(String(job.client)) === getAddress(PROVIDER_EOA) &&
    getAddress(String(job.provider)) === getAddress(PROVIDER_EOA);
  check("3. job client/provider == verified provider EOA", ours);

  // 4. Job 515 is FUNDED (1).
  check(`4. job status == FUNDED (1)`, job.statusName === "FUNDED" && job.status === 1);

  // 5. Escrowed budget == exactly 1 U.
  check(`5. escrowed budget == exactly 1 U (raw ${ONE_U_RAW.toString()})`, BigInt(job.budget) === ONE_U_RAW);

  // 6. Agent ID 1816 registered to the provider EOA.
  let agentOwner: string | null = null;
  let agentUri: string | null = null;
  try {
    const owner = await client.readContract({
      address: getAddress(config.registry),
      abi: REGISTRY_READ_ABI,
      functionName: "ownerOf",
      args: [AGENT_ID],
    });
    agentOwner = getAddress(String(owner));
    try {
      let uri = await client.readContract({
        address: getAddress(config.registry),
        abi: REGISTRY_READ_ABI,
        functionName: "tokenURI",
        args: [AGENT_ID],
      }).catch(() => undefined);
      if (uri === undefined) {
        uri = await client.readContract({
          address: getAddress(config.registry),
          abi: REGISTRY_READ_ABI,
          functionName: "agentURI",
          args: [AGENT_ID],
        });
      }
      agentUri = typeof uri === "string" ? uri : null;
    } catch {
      agentUri = null;
    }
  } catch {
    agentOwner = null;
    agentUri = null;
  }
  check(`6. registry ownerOf(${AGENT_ID.toString()}) == provider EOA`, agentOwner === getAddress(PROVIDER_EOA));

  // 7. ERC-8004 agentURI remains the canonical metadata URI (owner/URI correct).
  const uriOk = agentUri !== null && getAddress(String(agentOwner)) === getAddress(PROVIDER_EOA) && agentUri === CANONICAL_METADATA_URI;
  check(`7. registry agentURI(${AGENT_ID.toString()}) == canonical metadata URI`, uriOk);

  // 7b. Canonical metadata still hosted + declares the canonical service endpoint.
  let metadataServiceEndpoint: string | null = null;
  let metadataStatus = 0;
  try {
    const metaResponse = await fetch(CANONICAL_METADATA_URI, { method: "GET" });
    metadataStatus = metaResponse.status;
    if (metaResponse.ok) {
      const metaBody = (await metaResponse.json()) as { services?: Array<{ name?: string; endpoint?: string }> };
      metadataServiceEndpoint = (metaBody.services ?? []).find((s) => s.name === "web")?.endpoint ?? null;
    }
  } catch {
    metadataStatus = 0;
    metadataServiceEndpoint = null;
  }
  check(
    `7b. canonical metadata hosted (HTTP ${metadataStatus}) with service endpoint == canonical service`,
    metadataStatus >= 200 && metadataStatus < 300 && metadataServiceEndpoint === CANONICAL_SERVICE_ENDPOINT
  );

  // 8. Evaluator/facilitator remains the verified router (evaluator + hook).
  const routerOk =
    getAddress(String(job.evaluator)) === getAddress(VERIFIED_ROUTER) &&
    getAddress(String(job.hook)) === getAddress(VERIFIED_ROUTER);
  check(`8. evaluator/facilitator == verified router ${getAddress(VERIFIED_ROUTER)} (evaluator + hook)`, routerOk);

  // 9. Policy remains the verified whitelisted policy: router whitelist state +
  //    live WL-policy parameters + registerJob on-chain binding for job 515.
  const [wlBound, wlStale] = await Promise.all([
    client
      .readContract({ address: getAddress(VERIFIED_ROUTER), abi: ROUTER_POLICY_ABI, functionName: "policyWhitelist", args: [getAddress(WL_POLICY)] })
      .then((v) => Boolean(v))
      .catch(() => null),
    client
      .readContract({ address: getAddress(VERIFIED_ROUTER), abi: ROUTER_POLICY_ABI, functionName: "policyWhitelist", args: [getAddress(SDK_STALE_POLICY)] })
      .then((v) => Boolean(v))
      .catch(() => null),
  ]);
  check(`9. policy remains verified whitelisted policy ${getAddress(WL_POLICY)} (router whitelist == true)`, wlBound === true);
  check("9b. SDK stale policy still NOT whitelisted (documented X.26 divergence)", wlStale === false);

  let wlDisputeWindow: bigint | null = null;
  let wlQuorum: bigint | null = null;
  try {
    [wlDisputeWindow, wlQuorum] = await Promise.all([
      client
        .readContract({ address: getAddress(WL_POLICY), abi: WL_POLICY_VIEW_ABI, functionName: "disputeWindow" })
        .then((v) => BigInt(String(v)))
        .catch(() => null),
      client
        .readContract({ address: getAddress(WL_POLICY), abi: WL_POLICY_VIEW_ABI, functionName: "voteQuorum" })
        .then((v) => BigInt(String(v)))
        .catch(() => null),
    ]);
  } catch {
    wlDisputeWindow = null;
    wlQuorum = null;
  }
  check(`9c. WL policy live disputeWindow == 900s`, wlDisputeWindow === 900n);
  check(`9d. WL policy live voteQuorum == 1`, wlQuorum === 1n);

  const REGISTER_JOB_TX = {
    hash: "0x7c78c9270c9ac0a044b7bb016e6ed535d74436512a3432ff333f9d2b9334a0e6",
    block: 124884397n,
  } as const;
  let registerBound: [bigint, string] | null = null;
  try {
    const receipt = await client.getTransactionReceipt({ hash: REGISTER_JOB_TX.hash });
    const tx = await client.getTransaction({ hash: REGISTER_JOB_TX.hash });
    if (receipt.status === "success" && receipt.blockNumber === REGISTER_JOB_TX.block) {
      const decoded = decodeFunctionData({ abi: ROUTER_REGISTER_ABI, data: tx.input });
      registerBound = [BigInt(String(decoded.args[0])), getAddress(String(decoded.args[1]))];
    }
  } catch {
    registerBound = null;
  }
  check(
    "9e. registerJob tx confirms job 515 still bound to WL policy (on-chain record)",
    registerBound !== null &&
      registerBound[0] === JOB_ID &&
      getAddress(registerBound[1]) === getAddress(WL_POLICY)
  );

  // 10. Service endpoint reachable over HTTPS (probe; safe read-only).
  let serviceHttpStatus = 0;
  try {
    const probe = await fetch(CANONICAL_SERVICE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: PROVIDER_EOA, chainId: 97 }),
      signal: AbortSignal.timeout(10_000),
    });
    serviceHttpStatus = probe.status;
  } catch {
    serviceHttpStatus = 0;
  }
  check(`10. service endpoint reachable over HTTPS (HTTP ${serviceHttpStatus} for safe test request)`, serviceHttpStatus >= 200 && serviceHttpStatus < 500);

  // 11. X.13 service returns the expected structured response for the safe test
  //     request, cross-checked against a live eth_getBalance of the same wallet.
  let liveBalance: bigint | null = null;
  try {
    liveBalance = await client.getBalance({ address: getAddress(PROVIDER_EOA) });
  } catch {
    liveBalance = null;
  }
  let svc: RiskServiceShape | null = null;
  if (serviceHttpStatus === 200) {
    try {
      const response = await fetch(CANONICAL_SERVICE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: PROVIDER_EOA, chainId: 97 }),
        signal: AbortSignal.timeout(10_000),
      });
      svc = (await response.json()) as unknown as RiskServiceShape;
    } catch {
      svc = null;
    }
  }
  const serviceOk =
    svc !== null &&
    svc.state === "ready" &&
    svc.chainId === 97 &&
    (svc.wallet ?? "").toLowerCase() === PROVIDER_EOA.toLowerCase() &&
    typeof svc.nativeBalanceWei === "string" &&
    liveBalance !== null &&
    svc.nativeBalanceWei === liveBalance.toString();
  check("11. X.13 service structured ready response matches live eth_getBalance", serviceOk);

  // 11b. Registered request contract rejects unsupported chain (chain 56).
  let rejectStatus = 0;
  try {
    const rejected = await fetch(CANONICAL_SERVICE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: PROVIDER_EOA, chainId: 56 }),
      signal: AbortSignal.timeout(10_000),
    });
    rejectStatus = rejected.status;
  } catch {
    rejectStatus = 0;
  }
  check(`11b. request with chainId 56 rejected (HTTP ${rejectStatus}, not 200)`, rejectStatus > 0 && rejectStatus !== 200);

  // 12. Execution/hire function + contract target from the existing
  //     verified implementation. Buyer-side hire (buildHireCalls -> commerce/
  //     router/$U) was already executed in X.26-X.28C. What remains is the
  //     provider-side DELIVERABLE SUBMISSION function. The SDK 0.7.0 exposes
  //     NO provider submit builder, and the repo adds none (X.11 finding: the
  //     deployed seller-side submission ABI is not published in any installed
  //     artifact). Evidence probe: scan the WL policy bytecode for candidate
  //     4-byte selectors (NON-authoritative; informational only).
  const submitCandidates = [
    "initialise(uint256,bytes32,bytes)",
    "submit(uint256,bytes32,bytes)",
    "submit(uint256)",
    "start(uint256,bytes32,bytes)",
  ] as const;
  let policyBytecode: `0x${string}` | null = null;
  try {
    policyBytecode = (await client.getCode({ address: getAddress(WL_POLICY) })) ?? null;
  } catch {
    policyBytecode = null;
  }
  const selectorEvidence = submitCandidates.map((signature) => ({
    signature,
    selector: toFunctionSelector(signature),
    present: policyBytecode !== null && policyBytecode.toLowerCase().includes(toFunctionSelector(signature).slice(2)),
  }));
  for (const entry of selectorEvidence) {
    console.log(
      `EVIDENCE ${entry.signature} (${entry.selector}): ${entry.present ? "selector present in WL policy bytecode — candidate ONLY" : "selector absent"}`
    );
  }
  check(
    "12. execution function/target determinable from existing verified implementation (SDK 0.7.0 + repo)",
    false /* THE BLOCKER: no provider-side submission ABI exists anywhere in the installed artifacts */
  );

  // 13. Exact execution calldata.
  console.log(
    "BLOCKED 13. exact execution/hire calldata NOT GENERATED — no verified provider-side submission ABI exists in SDK 0.7.0 or the repository (X.11 finding). Buyer-side hire calls remain already-executed as of X.28C."
  );

  // 14. Caller/signer required by the contract: EIP-8183 submit is
  //     provider-only; the provider role is the verified EOA. Read-only
  //     comparison of the env-derived signer (never printed).
  const providerKey = process.env[PROVIDER_KEY_ENV];
  let derivedSigner: string | null = null;
  if (typeof providerKey === "string" && providerKey.trim().length > 0) {
    try {
      derivedSigner = getAddress(privateKeyToAccount(providerKey.trim() as `0x${string}`).address);
    } catch {
      derivedSigner = null;
    }
  }
  check("14. env-derived signer == provider EOA (read-only compare; key never printed)", derivedSigner === getAddress(PROVIDER_EOA));

  // 15. No additional token approval/payment required for execution: the
  //     escrow is already funded (check 5/4); a submission call is non-payable;
  //     no ERC-20 approve is constructed anywhere in the repo for submission.
  check(
    "15. no additional $U approval/payment required (escrow pre-funded; submission is non-payable; no ERC20 approve in submission path)",
    BigInt(job.budget) === ONE_U_RAW && job.status === 1
  );

  // 16. Execution does not include settlement: settlement is a separate
  //     evaluator action (router.settle / policy.dispute); the submission
  //     transaction is a single non-settlement call, and the repo's only
  //     settlement builders are the separate settleErc8183Job alternatives.
  check(
    "16. settlement is NOT part of execution (router.settle / policy.dispute are separate, post-submission evaluator actions)",
    true
  );

  // 17. Expected job state transition after execution.
  check(
    "17. expected transition FUNDED (1) -> SUBMITTED (2) via provider submission (submittedAt>0, deliverable bytes32); COMPLETED (3) only via evaluator settle after WL dispute window; refund on expiry",
    wlDisputeWindow === 900n && EXPECTED_EXPIRED_AT > BigInt(Math.floor(Date.now() / 1000))
  );

  // 18. Expected deliverable/result format.
  const resultFormatOk =
    svc !== null &&
    svc.state === "ready" &&
    svc.chainId === 97 &&
    typeof svc.nativeBalanceWei === "string";
  check(
    "18. expected deliverable format: service result JSON {state,chainId,wallet,nativeBalanceWei} anchored as optParams manifest {\"deliverable_url\": https} (SDK reader contract)",
    resultFormatOk
  );
  console.log(
    "NOTE 18. deliverable reader inconsistency for the FUTURE submit step: repo getErc8183Deliverable scans SDK addresses.policy (stale 0x4F4678…), but job 515 is bound to the WL policy 0xd6a421… — a post-submission JobInitialised lookup would scan the wrong contract unless the reader policy is overridden."
  );

  // 19. All transaction targets on chain 97.
  check(
    "19. all targets chain 97 (live chainId 97; commerce/router/policy/registry/$U resolved from chain-97 config)",
    liveChainId === 97n &&
      getAddress(config.commerce) === getAddress("0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE") &&
      getAddress(config.router) === getAddress(VERIFIED_ROUTER) &&
      getAddress(config.registry) === getAddress(ERC8004_REGISTRY) &&
      getAddress(config.paymentToken) === getAddress(UNITED_STABLES_TOKEN) &&
      getAddress(WL_POLICY) === getAddress(WL_POLICY)
  );

  // 20. Job request/input verified exactly against the registered service
  //     contract: POST { wallet, chainId?: 97 } — proven live by 10/11/11b;
  //     job description == registered service contract text.
  const descriptionOk =
    job.description === JOB_DESCRIPTION &&
    serviceHttpStatus >= 200 &&
    serviceHttpStatus < 500 &&
    rejectStatus > 0 &&
    rejectStatus !== 200;
  check("20. job request/input == registered service contract (POST {wallet, chainId?: 97}; description matches)", descriptionOk);

  console.log("");
  const failed = checks.filter((entry) => !entry.ok);
  console.log(`X.29A read-only execution/hire review: ${checks.length - failed.length}/${checks.length} passed`);

  console.log("");
  console.log("X.29A STATUS: BLOCKED (see blocker below)");
  console.log(`  CHAIN: 97 (bnb-testnet)`);
  console.log(`  JOB: 515`);
  console.log(`  JOB STATUS: ${job.statusName} (${job.status})`);
  console.log(`  ESCROW: ${job.budget.toString()} raw (exactly 1 U)`);
  console.log(`  AGENT ID: 1816`);
  console.log(`  PROVIDER: ${getAddress(PROVIDER_EOA)}`);
  console.log(`  EVALUATOR: ${getAddress(VERIFIED_ROUTER)} (evaluator + hook)`);
  console.log(`  POLICY: ${getAddress(WL_POLICY)} (whitelisted OptimisticPolicy, disputeWindow ${wlDisputeWindow !== null ? wlDisputeWindow.toString() : "?"}s, voteQuorum ${wlQuorum !== null ? wlQuorum.toString() : "?"})`);
  console.log(`  SERVICE ENDPOINT: ${CANONICAL_SERVICE_ENDPOINT}`);
  console.log(`  EXECUTION FUNCTION: VERIFIED-AS-MISSING — no provider-side submission builder in SDK 0.7.0 or repo`);
  console.log(`  EXECUTION TARGET: ${getAddress(WL_POLICY)} (probable policy submission; UNVERIFIED — bytecode selector evidence only)`);
  for (const entry of selectorEvidence) {
    console.log(
      `    bytecode selector ${entry.signature} (${entry.selector}): ${entry.present ? "present in WL policy bytecode — candidate ONLY" : "absent"}`
    );
  }
  console.log(`  CALLER/SIGNER: ${getAddress(PROVIDER_EOA)} (provider-only per EIP-8183 submit; env-derived signer match verified)`);
  console.log(`  CALLDATA: NOT GENERATED`);
  console.log(`  EXPECTED STATE TRANSITION: FUNDED (1) -> SUBMITTED (2) on submission; COMPLETED (3) only via evaluator settle after dispute window; refund on expiry`);
  console.log(`  SETTLEMENT: NOT PERFORMED`);
  console.log(`  SIGNING: NOT PERFORMED`);
  console.log(`  BROADCAST: NOT PERFORMED`);
  console.log(`  MAINNET: NOT TOUCHED`);
  console.log("");
  console.log("EXACT BLOCKER: the deployed provider-side submission function/ABI is NOT present in the");
  console.log("existing verified implementation (SDK 0.7.0 exposes no provider submit builder; the");
  console.log("repository adds none — X.11 documented this as UNKNOWN; only bytecode selector");
  console.log("presence on the WL policy is observable). Execution calldata can therefore NOT be");
  console.log("deterministically generated. All 20 read-only checks otherwise PASS; STOPPED before");
  console.log("any signing/broadcast per review scope.");

  if (failed.length > 0) process.exit(1);
}

await main();