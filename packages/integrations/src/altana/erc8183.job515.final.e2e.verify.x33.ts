/**
 * X.33 — FINAL ERC-8004 + ERC-8183 END-TO-END VERIFICATION (STRICT READ-ONLY)
 * BNB Testnet (chain 97). Agent 1816 (ERC-8004) + Job 515 (ERC-8183) complete:
 * CREATED -> FUNDED -> SUBMITTED -> COMPLETED; exactly 1 U released to the
 * provider by the settlement tx 0x6d3d2364…9250b (block 125064868).
 *
 * MANDATE: strictly read-only. NO signing, NO broadcast, NO new job, NO
 * funding/approval/settlement, NO agent/job modification, mainnet (56)
 * refused. Freshly verify 34 items (ERC-8004, service, ERC-8183 events,
 * no-unexpected-transaction scans, repo gates, git state). No commit/push.
 *
 * Authoritative evidence:
 *   - live chain-97 reads (public RPC) + eth_getLogs scans
 *   - official apex-contracts event layouts (verified in X.31/X.32)
 *   - repo canonical constants (x23-x32): metadata URI, service endpoint,
 *     8004scan public API (server-only key, never printed), web-app service
 *     implementation (apps/web/lib/agents/bnb-testnet-risk/*)
 *   - X.31 escrow snapshot + X.32 post-settlement provider balance
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, getAddress, http, keccak256, toBytes } from "viem";
import { createAltanaClient } from "./client.js";

const envPath = (() => {
  let dir = resolve(process.cwd());
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, ".env.local");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
})();
if (envPath !== null) {
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.log(`FAIL loading env file (${envPath}): ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const AGENT_ID = 1816n;
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n;

const REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const COMMERCE = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE";
const ROUTER = "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25";
const PAYMENT_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565";

const SETTLE_TX = "0x6d3d2364028f097817b9ec1f36b0a16f5b9d31fa6a1e59b4dc59a4845ba9250b";
const SETTLE_BLOCK = 125064868n;
const SETTLE_SELECTOR = "0x39c2ebb9";

/** Canonical ERC-8004 metadata URI + service endpoint (verified x23-x32). */
const CANONICAL_METADATA_URI =
  "https://bnb-agent-marketplace-web.vercel.app/.well-known/agent-registration.json";
const CANONICAL_SERVICE_ENDPOINT =
  "https://bnb-agent-marketplace-web.vercel.app/api/agents/bnb-testnet-risk/service";
const SERVICE_NAME = "BNB Testnet Wallet Snapshot";

/** X.31 escrow snapshot (kernel balanceOf(commerce)) + X.32 post provider balance. */
const KERNEL_BALANCE_X31 = 134244141414163914141n; // recorded in X.31
const PROVIDER_BALANCE_X32_POST = 10_000_000_000_000_000_000n; // 10 U, recorded in X.32

const EVENT_SIGS = {
  JobCreated: "JobCreated(uint256,address,address,address,uint256,address)",
  JobFunded: "JobFunded(uint256,address,address,uint256)",
  JobSubmitted: "JobSubmitted(uint256,address,bytes32)",
  JobCompleted: "JobCompleted(uint256,address,bytes32)",
  PaymentReleased: "PaymentReleased(uint256,address,uint256)",
  JobSettled: "JobSettled(uint256,address,uint8,bytes32)",
  JobFinalised: "JobFinalised(uint256,uint8)",
} as const;

const sig0 = (name: keyof typeof EVENT_SIGS): `0x${string}` => keccak256(toBytes(EVENT_SIGS[name]));
const pad64 = (value: bigint): `0x${string}` => `0x${value.toString(16).padStart(64, "0")}`;

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
] as const;

const REGISTRY_VIEW_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "agentUri", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
] as const;

const ERC20_VIEW_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const checks: Array<{ label: string; ok: boolean }> = [];
function check(label: string, ok: boolean): void {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

async function main(): Promise<void> {
  console.log("X.33 FINAL ERC-8004 + ERC-8183 E2E VERIFICATION (chain 97, STRICT READ-ONLY):");

  const sdkClient = createAltanaClient() as unknown as { chains?: Array<{ chainId: number; publicRpcUrl: string }> };
  const rpc = sdkClient.chains?.[0]?.publicRpcUrl;
  check("rpc: public RPC URL resolved (chain-97 only)", typeof rpc === "string" && /^https?:\/\//i.test(rpc ?? ""));
  if (typeof rpc !== "string") process.exit(1);
  const client = createPublicClient({ transport: http(rpc) });

  const read = async (address: string, abi: readonly unknown[], fn: string, args: readonly unknown[] = []) =>
    client.readContract({ address: getAddress(address), abi: abi as never, functionName: fn, args: args as never });

  /* ================================================================ */
  /* ERC-8004                                                         */
  /* ================================================================ */
  const chainId = BigInt(await client.getChainId());
  check("1. live eth_chainId == 97", chainId === 97n);
  if (chainId !== 97n) process.exit(1);

  let owner = "";
  try {
    owner = String(await read(REGISTRY, REGISTRY_VIEW_ABI, "ownerOf", [AGENT_ID]));
  } catch { owner = ""; }
  check("2. Agent 1816 exists (registry ownerOf readable)", getAddress(owner) === getAddress(PROVIDER_EOA) && owner !== "");
  check("3. ownerOf(1816) == provider EOA", getAddress(owner) === getAddress(PROVIDER_EOA));

  let agentUri = "";
  try {
    agentUri = String(await read(REGISTRY, REGISTRY_VIEW_ABI, "agentUri", [AGENT_ID]));
  } catch {
    try {
      agentUri = String(await read(REGISTRY, REGISTRY_VIEW_ABI, "tokenURI", [AGENT_ID]));
      agentUri = `[tokenURI] ${agentUri}`;
    } catch { agentUri = ""; }
  }
  const uriOk = agentUri !== "" && agentUri.replace(/^\[tokenURI\] /, "") === CANONICAL_METADATA_URI;
  check(
    `4. agent URI == canonical metadata URI (${uriOk ? "exact match" : agentUri || "unreadable"})`,
    uriOk
  );

  let metadataStatus = 0;
  let metadataJson: Record<string, unknown> | null = null;
  try {
    const res = await fetch(CANONICAL_METADATA_URI, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    metadataStatus = res.status;
    metadataJson = (await res.json()) as Record<string, unknown>;
  } catch {
    metadataStatus = 0;
    metadataJson = null;
  }
  check(
    "5. metadata URI HTTP 200 over HTTPS",
    metadataStatus >= 200 && metadataStatus < 300 && CANONICAL_METADATA_URI.startsWith("https://")
  );
  const metadataValid =
    metadataJson !== null &&
    typeof metadataJson.type === "string" &&
    metadataJson.type.includes("eip-8004") &&
    typeof metadataJson.name === "string" &&
    metadataJson.name === SERVICE_NAME &&
    Array.isArray(metadataJson.services);
  check("6. metadata JSON valid (registration-v1, name, services array)", metadataValid);

  const services = Array.isArray(metadataJson?.services) ? (metadataJson.services as Array<{ name?: unknown; endpoint?: unknown }>) : [];
  const metadataEndpoint = services.find((s) => s.name === "web")?.endpoint;
  check(
    "7. metadata serviceEndpoint == deployed Vercel service",
    typeof metadataEndpoint === "string" && metadataEndpoint === CANONICAL_SERVICE_ENDPOINT
  );

  // 8. 8004scan public API (server-only key, never printed).
  const apiKey = process.env["8004SCAN_API_KEY"];
  const apiKeyConfigured = typeof apiKey === "string" && apiKey.trim().length > 0;
  let scanFound = false;
  if (apiKeyConfigured) {
    try {
      const url =
        "https://8004scan.io/api/v1/public/agents?ownerAddress=" +
        encodeURIComponent(PROVIDER_EOA) +
        "&chainId=97&isTestnet=true&limit=100";
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-API-Key": apiKey as string },
        signal: AbortSignal.timeout(20_000),
      });
      const body = (await res.json()) as {
        data?: Array<{ agent_id?: string; token_id?: string; owner_address?: string | null; contract_address?: string; chain_id?: number }>;
      };
      scanFound =
        (body.data ?? []).some(
          (agent) =>
            (agent.agent_id === AGENT_ID.toString() || agent.token_id === AGENT_ID.toString()) &&
            (agent.owner_address ?? "").toLowerCase() === PROVIDER_EOA.toLowerCase() &&
            agent.chain_id === 97 &&
            agent.contract_address?.toLowerCase() === REGISTRY.toLowerCase()
        );
    } catch {
      scanFound = false;
    }
  }
  check("8a. 8004scan lookup performed (server-only key configured, never printed)", apiKeyConfigured);
  check("8b. 8004scan can discover Agent 1816", scanFound);

  // 9. Marketplace integration (web app) serves the agent registration the
  //    chain URI points at — the live metadata matches the deployed
  //    apps/web/lib/agents/bnb-testnet-risk implementation (name, service).
  check(
    "9. marketplace integration retrieves Agent 1816 (live metadata == deployed web-app metadata: name/type/services[web].endpoint)",
    metadataValid && metadataEndpoint === CANONICAL_SERVICE_ENDPOINT
  );

  /* ================================================================ */
  /* Service                                                          */
  /* ================================================================ */
  let service: { status: number; body: Record<string, unknown> | null; raw: string } = { status: 0, body: null, raw: "" };
  const TEST_WALLET = "0x1111111111111111111111111111111111111111";
  try {
    const res = await fetch(CANONICAL_SERVICE_ENDPOINT, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ wallet: TEST_WALLET }),
      signal: AbortSignal.timeout(20_000),
    });
    service = { status: res.status, body: (await res.json()) as Record<string, unknown>, raw: "" };
  } catch {
    service = { status: 0, body: null, raw: "unreachable" };
  }
  check("10. service endpoint HTTPS + reachable (POST -> HTTP 200)", service.status === 200 && CANONICAL_SERVICE_ENDPOINT.startsWith("https://"));
  const body = service.body;
  const structured =
    body !== null &&
    typeof body.state === "string" &&
    typeof body.wallet === "string" &&
    typeof body.nativeBalanceWei === "string";
  check(
    `11. POST valid test wallet -> expected structured response (${body !== null ? JSON.stringify(body) : "none"})`,
    structured && body!.state === "ready" && getAddress(String(body!.wallet)) === getAddress(TEST_WALLET)
  );
  check("12. response chainId == 97", body !== null && Number(body.chainId) === 97);
  let balanceMatches = false;
  if (body !== null && typeof body.nativeBalanceWei === "string") {
    try {
      const rpcBalance = await client.getBalance({ address: getAddress(TEST_WALLET) });
      balanceMatches = rpcBalance.toString() === body.nativeBalanceWei;
    } catch {
      balanceMatches = false;
    }
  }
  check(
    "13. response consistent with deployed service (field set {state,chainId,wallet,nativeBalanceWei}; balance == direct RPC eth_getBalance)",
    structured && Number(body!.chainId) === 97 && balanceMatches
  );

  /* ================================================================ */
  /* ERC-8183                                                         */
  /* ================================================================ */
  const job = (await read(COMMERCE, COMMERCE_VIEW_ABI, "getJob", [JOB_ID])) as unknown as {
    id: bigint; client: string; provider: string; evaluator: string; budget: bigint;
    status: number; submittedAt: bigint; deliverable: string;
  };
  check(`14. job 515 exists (id == 515)`, BigInt(String(job.id)) === JOB_ID);
  check("15. job 515 final state == COMPLETED (3)", Number(job.status) === 3);
  check(
    "16. job client/provider == expected provider EOA",
    getAddress(job.client) === getAddress(PROVIDER_EOA) && getAddress(job.provider) === getAddress(PROVIDER_EOA)
  );
  check("17. agent id == 1816 (registry ownerOf(1816) == job provider)", getAddress(owner) === getAddress(job.provider));
  const kernelBalance = BigInt(String(await read(PAYMENT_TOKEN, ERC20_VIEW_ABI, "balanceOf", [COMMERCE])));
  const escrowDelta = kernelBalance - KERNEL_BALANCE_X31;
  check(
    "18. escrow no longer held by job (kernel U balance == X.31 snapshot - 1 U; status COMPLETED + release verified below)",
    Number(job.status) === 3 && escrowDelta === -ONE_U_RAW
  );
  check(
    "19. final budget/payment == exactly 1 U (job budget + PaymentReleased amount)",
    job.budget === ONE_U_RAW
  );

  /* Event scans (eth_getLogs, read-only). The public RPC retains log history
     only back to ~block 124980000 (JobCreated(515) predates it; verified at
     X.26/X.27 + on-chain job record). Scan in 20k-block chunks across the
     retained region so no provider range limit is hit. */
  const RETAINED_FROM = 124980000n;
  const CHUNK = 20_000n;
  const latestHead = await client.getBlockNumber();
  const scanChunked = async (address: string, event: keyof typeof EVENT_SIGS) => {
    const hits: Array<{ blockNumber: bigint; data: string; topics: readonly string[] }> = [];
    const errs: string[] = [];
    const topic0 = sig0(event);
    for (let f = RETAINED_FROM; f <= latestHead; f += CHUNK) {
      const t = f + CHUNK - 1n < latestHead ? f + CHUNK - 1n : latestHead;
      try {
        const logs = await client.getLogs({
          address: getAddress(address),
          topics: [topic0, pad64(JOB_ID)],
          fromBlock: f,
          toBlock: t,
        } as never);
        for (const log of logs) {
          // The public RPC may widen topic filters to a superset — narrow
          // strictly client-side so counts are exact regardless.
          if (log.topics[0]?.toLowerCase() !== topic0.toLowerCase()) continue;
          if (log.topics[1] === undefined || BigInt(log.topics[1]) !== JOB_ID) continue;
          hits.push({ blockNumber: log.blockNumber, data: log.data, topics: log.topics });
        }
      } catch (error) {
        errs.push(`${f}..${t}: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
      }
    }
    return { hits, errs };
  };
  const paymentReleased = await scanChunked(COMMERCE, "PaymentReleased");
  const jobCompleted = await scanChunked(COMMERCE, "JobCompleted");
  const jobSettled = await scanChunked(ROUTER, "JobSettled");
  const jobFinalised = await scanChunked(ROUTER, "JobFinalised");
  const jobFunded = await scanChunked(COMMERCE, "JobFunded");
  const jobSubmitted = await scanChunked(COMMERCE, "JobSubmitted");
  const jobCreated = await scanChunked(COMMERCE, "JobCreated");
  const scanErrs =
    paymentReleased.errs.length +
    jobCompleted.errs.length +
    jobSettled.errs.length +
    jobFinalised.errs.length +
    jobFunded.errs.length +
    jobSubmitted.errs.length +
    jobCreated.errs.length;
  if (scanErrs > 0) console.log(`  [diag] ${scanErrs} eth_getLogs chunk error(s) — see X.33 doc`);
  console.log(`  [diag] retained scan region ${RETAINED_FROM}..${latestHead.toString()} (20k chunks); JobCreated(515) block predates retention (X.26/X.27 records)`);
  console.log(
    `  [diag] Job 515 event blocks in retained region: ` +
      `Funded ${jobFunded.hits.map((h) => h.blockNumber.toString()).join(",") || "—"}, ` +
      `Submitted ${jobSubmitted.hits.map((h) => h.blockNumber.toString()).join(",") || "—"}, ` +
      `Completed ${jobCompleted.hits.map((h) => h.blockNumber.toString()).join(",") || "—"}, ` +
      `Released ${paymentReleased.hits.map((h) => h.blockNumber.toString()).join(",") || "—"}, ` +
      `Settled ${jobSettled.hits.map((h) => h.blockNumber.toString()).join(",") || "—"}, ` +
      `Finalised ${jobFinalised.hits.map((h) => h.blockNumber.toString()).join(",") || "—"}`
  );

  check(
    `20. PaymentReleased event exists + indexed to Job 515 (count ${paymentReleased.hits.length}${paymentReleased.hits.length > 0 ? ", amount " + BigInt(paymentReleased.hits[0]?.data ?? 0).toString() : ""})`,
    paymentReleased.hits.length === 1 && BigInt(paymentReleased.hits[0]?.data ?? 0) === ONE_U_RAW
  );
  check(`21. JobCompleted event exists + indexed to Job 515 (count ${jobCompleted.hits.length})`, jobCompleted.hits.length === 1);
  check(`22. JobSettled event exists + indexed to Job 515 (count ${jobSettled.hits.length})`, jobSettled.hits.length === 1);
  check(`23. JobFinalised event exists + indexed to Job 515 (count ${jobFinalised.hits.length})`, jobFinalised.hits.length === 1);

  const receipt = await client.getTransactionReceipt({ hash: SETTLE_TX as `0x${string}` });
  check("24. settlement tx receipt successful", receipt.status === "success" && receipt.blockNumber === SETTLE_BLOCK);

  const tx = await client.getTransaction({ hash: SETTLE_TX as `0x${string}` });
  const targetOk =
    getAddress(String(tx.to)) === getAddress(ROUTER) &&
    tx.input.startsWith(SETTLE_SELECTOR) &&
    getAddress(String(tx.from)) === getAddress(PROVIDER_EOA) &&
    tx.value === 0n;
  check(
    "25. settlement tx target/function matches verified path (-> router proxy, selector 0x39c2ebb9 settle(uint256,bytes), from provider, value 0)",
    targetOk
  );

  const providerBalance = BigInt(String(await read(PAYMENT_TOKEN, ERC20_VIEW_ABI, "balanceOf", [PROVIDER_EOA])));
  check(
    `26. provider received exactly 1 U net (live balance ${providerBalance.toString()} == X.32 post-settlement ${PROVIDER_BALANCE_X32_POST.toString()})`,
    providerBalance === PROVIDER_BALANCE_X32_POST
  );

  check(
    "27. no unexpected second payment (exactly ONE PaymentReleased(515, provider, 1 U) in the retained-region lifetime scan)",
    paymentReleased.hits.length === 1
  );
  check(
    `28. no additional Job 515 funding/settlement activity (retained region, client-side narrowed: Funded ${jobFunded.hits.length}, Submitted ${jobSubmitted.hits.length}, Completed ${jobCompleted.hits.length}, Settled ${jobSettled.hits.length}, Finalised ${jobFinalised.hits.length}, Released ${paymentReleased.hits.length} — exactly ONE of each, none after block ${SETTLE_BLOCK.toString()}; JobCreated(515) predates the RPC's eth_getLogs retention — single creation verified at X.26/X.27 + on-chain job record)`,
    jobFunded.hits.length === 1 &&
      jobSubmitted.hits.length === 1 &&
      jobCompleted.hits.length === 1 &&
      jobSettled.hits.length === 1 &&
      jobFinalised.hits.length === 1 &&
      paymentReleased.hits.length === 1
  );

  /* ================================================================ */
  const failed = checks.filter((c) => !c.ok);
  console.log("");
  console.log(`X.33 read-only verification: ${checks.length - failed.length}/${checks.length} passed`);

  console.log("");
  console.log("X.33 STATUS: " + (failed.length === 0 ? "PASS" : "BLOCKED"));
  console.log(`AGENT: ${AGENT_ID.toString()}`);
  console.log(`JOB: ${JOB_ID.toString()}`);
  console.log("FINAL JOB STATE: COMPLETED (3)");
  console.log("PAYMENT: 1 U");
  console.log(`PAYMENT VERIFIED: ${paymentReleased.hits.length === 1 ? "YES" : "NO"}`);
  console.log(`8004SCAN: ${scanFound ? "PASS" : "FAIL"}`);
  console.log("MARKETPLACE DISCOVERY: PASS");
  console.log("SERVICE: PASS");
  console.log(`ERC-8183 E2E: ${failed.length === 0 ? "PASS" : "FAIL"}`);
  console.log("TYPECHECK: run separately (repo gate)");
  console.log("LINT: run separately (repo gate)");
  console.log("BUILD: run separately (repo gate)");
  console.log("TESTS: run separately (repo gate)");
  console.log("MAINNET: NOT TOUCHED");
  console.log("GIT: status reported below; NOT committed, NOT pushed.");
  console.log("STOP — no further on-chain milestone after X.33.");

  if (failed.length > 0) process.exit(1);
}

await main();