/**
 * X.166 — READ-ONLY forensics for the partially-executed Agent 2005 hire.
 *
 * Reads on-chain job state ONLY. Sends ZERO transactions (eth_call only).
 * Run: node --experimental-strip-types lib/activation/x166-forensics.readonly.ts
 */
import { ERC8183Client } from "@bnbagent/sdk/erc8183";
import {
  createMainTrackNetworkConfig,
  createMainTrackPublicClient,
  MAIN_TRACK_COMMERCE,
} from "@bnb-marketplace/integrations/altana";

const OWNER = "0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a"; // Agent 2005 verified owner/seller

const publicClient = createMainTrackPublicClient();
const erc = await ERC8183Client.create({ network: createMainTrackNetworkConfig() });

async function readCounter(): Promise<bigint> {
  const abi = [
    {
      type: "function",
      name: "jobCounter",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256" }],
    },
  ] as const;
  return (await publicClient.readContract({
    address: MAIN_TRACK_COMMERCE as `0x${string}`,
    abi,
    functionName: "jobCounter",
  })) as bigint;
}

let counter: bigint;
try {
  counter = await readCounter();
  console.log(`jobCounter() = ${counter}`);
} catch (e) {
  console.log("jobCounter() READ FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(0);
}

const STATUS = ["OPEN", "FUNDED", "SUBMITTED", "COMPLETED", "REJECTED", "EXPIRED"];
let found = 0;
const start = counter > 12n ? counter - 12n : 1n;
for (let id = start; id <= counter; id += 1n) {
  try {
    const job = await erc.getJob(id);
    const provider = (job.provider ?? "").toLowerCase();
    const is2005 = provider === OWNER.toLowerCase();
    if (!is2005) continue;
    found += 1;
    console.log(
      JSON.stringify({
        jobId: job.id.toString(),
        client: job.client,
        provider: job.provider,
        budget: job.budget.toString(),
        status: job.status,
        statusName: STATUS[job.status] ?? String(job.status),
        submittedAt: job.submittedAt.toString(),
        deliverable: job.deliverable,
      })
    );
  } catch (e) {
    console.log(`getJob(${id}) error:`, e instanceof Error ? e.message : String(e));
  }
}
console.log(
  found === 0 ? "NO Agent-2005 jobs found in recent range." : `Found ${found} Agent-2005 job(s).`
);
