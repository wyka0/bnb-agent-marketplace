/**
 * READ-ONLY diagnostic for the X.26-CONT registerJob revert on chain 97.
 * eth_calls the exact registerJob calldata from the provider EOA and probes
 * the router for whitelist/registration views to localize why it reverted.
 * NO SIGNING, NO BROADCAST, NO ENV SECRETS.
 */

import { createPublicClient, getAddress, http } from "viem";
import { encodeFunctionData, decodeFunctionData } from "viem";
import { BNB_TESTNET } from "@altananetwork/sdk";
import { ALTANA_ERC8183_CHAIN_ID, prepareErc8183Hire, resolveErc8183Config } from "./erc8183.js";
import type { Erc8183HireJobInput } from "./erc8183.js";
import { createAltanaClient } from "./client.js";

const PROVIDER_EOA = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C";
const JOB_ID = 515n;
const ONE_U_RAW = 1_000_000_000_000_000_000n;
const DISPUTE_WINDOW = 86400n;
const DEADLINE = 1800n;
const JOB_DESCRIPTION =
  "Read-only BNB Testnet wallet snapshot. Reports the requested wallet's native BNB balance from chain 97; it does not move funds or execute portfolio actions.";

const ROUTER_ABI = [
  { type: "function", name: "registerJob", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }, { name: "policy", type: "address" }], outputs: [] },
] as const;

const PROBE_ABI = [
  { type: "function", name: "policies", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "policy", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "knownPolicy", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "approvedPol", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "pricing", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "commerce", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "kernel", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "policyWhitelist", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "jobPolicy", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "jobToPolicy", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "registeredJobs", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "isRegistered", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "registrar", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

/** eth_call registerJob and report SUCCEED/REVERT + first line. */
async function probeRegister(
  client: ReturnType<typeof createPublicClient>,
  router: string,
  data: string,
  fromLabel: string,
  from: `0x${string}`
): Promise<void> {
  try {
    const result = await client.call({ account: from, to: getAddress(router), data: data as `0x${string}` });
    console.log(`  [${fromLabel}] call SUCCEEDED (revertData=${result.data})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  [${fromLabel}] call REVERTED: ${message.split("\n")[0]}`);
  }
}

async function main(): Promise<void> {
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const publicRpcUrl = sdkClient.chains?.[0]?.publicRpcUrl ?? "";
  const client = createPublicClient({ transport: http(publicRpcUrl) });

  console.log("READ-ONLY registerJob REVERT DIAGNOSIS (chain 97, no broadcast):");
  console.log(`  commerce: ${config.commerce}`);
  console.log(`  router:   ${config.router}`);
  console.log(`  policy:   ${config.policy}`);
  console.log(`  provider EOA: ${getAddress(PROVIDER_EOA)}`);

  const jobInput: Erc8183HireJobInput = {
    provider: getAddress(PROVIDER_EOA),
    description: JOB_DESCRIPTION,
    budget: ONE_U_RAW,
    expiredAt: BigInt(Math.floor(Date.now() / 1000)) + DISPUTE_WINDOW + DEADLINE,
    jobId: JOB_ID,
  };
  const draft = prepareErc8183Hire(BNB_TESTNET, jobInput);
  const registerCall = draft.calls[1] as { to: string; data: string };
  registerCall satisfies { to: string; data: string };
  console.log(`  registerJob to=${registerCall.to}`);
  console.log(`  registerJob calldata=${registerCall.data}`);
  try {
    const decoded = decodeFunctionData({ abi: ROUTER_ABI, data: registerCall.data as `0x${string}` });
    console.log(`  decoded function=${decoded.functionName}`);
    console.log(`  decoded args=${JSON.stringify(decoded.args)}`);
  } catch (error) {
    console.log(`  decode failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 1. eth_call the exact call from the provider EOA.
  console.log("\n[eth_call registerJob from provider EOA]");
  await probeRegister(client, config.router, registerCall.data, "provider EOA", getAddress(PROVIDER_EOA));

  // 3. eth_call registerJob from the commerce contract itself.
  console.log("\n[eth_call registerJob from commerce]");
  await probeRegister(client, config.router, registerCall.data, "commerce", getAddress(config.commerce));
  console.log("\n[eth_call registerJob from router itself]");
  await probeRegister(client, config.router, registerCall.data, "router", getAddress(config.router));

  // 4. Does the policy argument matter? Try a zero policy + the commerce as policy.
  console.log("\n[eth_call registerJob with different policy args (provider EOA sender)]");
  const encode = (policy: `0x${string}`): string =>
    encodeFunctionData({ abi: ROUTER_ABI, functionName: "registerJob", args: [JOB_ID, policy] });
  await probeRegister(client, config.router, encode("0x0000000000000000000000000000000000000000"), "policy=0x0", getAddress(PROVIDER_EOA));
  await probeRegister(client, config.router, encode(getAddress(config.commerce)), "policy=commerce", getAddress(PROVIDER_EOA));
  await probeRegister(
    client,
    config.router,
    encode(getAddress("0xd6a4217588f6b1f5657a92a3e94e6422ad771cea")),
    "policy=0xd6a421...(apex addresses.ts)",
    getAddress(PROVIDER_EOA)
  );

  console.log("\n[router policy-whitelist + job-policy probes]");
  for (const fn of PROBE_ABI) {
    if (fn.stateMutability !== "view") continue;
    const probeArgs: unknown[][] = fn.inputs.length > 0 ? [] : [[]];
    const policyCandidates = [getAddress(config.policy), getAddress("0xd6a4217588f6b1f5657a92a3e94e6422ad771cea")];
    for (const input of fn.inputs) {
      if (input.type === "uint256") {
        probeArgs.push([JOB_ID]);
      } else {
        for (const candidate of policyCandidates) probeArgs.push([candidate]);
      }
    }
    for (const args of probeArgs) {
      try {
        const value = await client.readContract({
          address: getAddress(config.router),
          abi: PROBE_ABI,
          functionName: fn.name as never,
          args: args as never,
        });
        const argLabel = fn.inputs[0]?.type === "uint256" ? JOB_ID.toString() : "policy";
        const addrLabel = fn.inputs[0]?.type === "uint256" ? "" : String(args[0]).slice(0, 10);
        const label = fn.inputs.length > 0 ? `${fn.name}(${argLabel})@${addrLabel}` : `${fn.name}()`;
        console.log(`  ${label} = ${String(value)}`);
      } catch {
        const argLabel = fn.inputs[0]?.type === "uint256" ? JOB_ID.toString() : "policy";
        const addrLabel = fn.inputs[0]?.type === "uint256" ? "" : String(args[0]).slice(0, 10);
        const label = fn.inputs.length > 0 ? `${fn.name}(${argLabel})@${addrLabel}` : `${fn.name}()`;
        console.log(`  ${label} = (revert/not-found)`);
      }
    }
  }

  console.log("\nREAD-ONLY DIAGNOSIS COMPLETE — NO SIGNING, NO BROADCAST.");
  await verifyWhitelistedPolicy();
}

const POLICY_VIEW_ABI = [
  { type: "function", name: "disputeWindow", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
  { type: "function", name: "voteQuorum", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const CORRECT_POLICY = "0xd6a4217588f6b1f5657a92a3e94e6422ad771cea";

async function verifyWhitelistedPolicy(): Promise<void> {
  const config = resolveErc8183Config(ALTANA_ERC8183_CHAIN_ID);
  const sdkClient = createAltanaClient() as unknown as {
    chains?: Array<{ chainId: number; publicRpcUrl: string }>;
  };
  const client = createPublicClient({
    transport: http(sdkClient.chains?.[0]?.publicRpcUrl ?? "https://bsc-testnet-rpc.publicnode.com"),
  });
  const policy = getAddress(CORRECT_POLICY);
  console.log(`\n[whitelisted policy ${policy} params]`);
  for (const fn of POLICY_VIEW_ABI) {
    try {
      const value = await client.readContract({ address: policy, abi: POLICY_VIEW_ABI, functionName: fn.name as never });
      console.log(`  ${fn.name}() = ${String(value)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.log(`  ${fn.name}() = (revert/not-found: ${message})`);
    }
  }
  const router = getAddress(config.router);
  const routerAbi = [
    { type: "function", name: "policyWhitelist", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  ] as const;
  const wl = await client
    .readContract({ address: router, abi: routerAbi, functionName: "policyWhitelist", args: [policy] })
    .catch(() => null);
  console.log(`  router.policyWhitelist(correct) = ${String(wl)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message.replace(/0x[0-9a-fA-F]{64}/g, "0x…[REDACTED]");
  console.error(`DIAGNOSIS FAILED: ${redacted}`);
  process.exit(1);
});