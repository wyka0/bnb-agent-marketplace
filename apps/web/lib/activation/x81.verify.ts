/**
 * X.81 — Read-only ERC-8183 capability-provider verifier (OFFLINE, no network).
 *
 * Uses an injected fake `Erc8183JobReader` + trusted resolvers so the full
 * verify path runs without any RPC. Proves the provider:
 *   - reads + verifies an authoritative ERC-8183 job (identity, status, funding,
 *     expiry, resource, capability, provenance);
 *   - returns null on every failure mode (fail closed);
 *   - produces VerifiedExecutionCapability / VerifiedFundedErc8183JobEvidence
 *     that satisfy the X.76 / X.80 validators;
 *   - never creates a session, never bypasses custody/consent/ownership;
 *   - when capability is verified but custody is unavailable, the X.80 gate
 *     still blocks session creation (capability verified, activation blocked).
 *
 * Explicitly does NOT test a live RPC read — that is the production wiring in
 * erc8183-capability-provider.server.ts, which is not executed here.
 */

import type { Erc8183Job } from "@altananetwork/sdk";
import {
  createErc8183CapabilityProvider,
  resolveErc8183VerifiedJob,
  type Erc8183CapabilityBinding,
  type Erc8183CapabilityProviderConfig,
  type Erc8183JobReader,
} from "./erc8183-capability-provider.ts";
import { validateVerifiedJob, type JobValidationContext } from "./erc8183-job-evidence.ts";
import { evaluateSessionGate } from "./session-gate.ts";
import { commitmentFromAgent, digestConsentCommitment } from "./consent.commitment.ts";
import { verifyExecutionCapability } from "./capability-source.ts";
import type { AuthenticatedIdentity } from "../auth/types.ts";

const OWNER = "0x2222222222222222222222222222222222222222";
const CLIENT = "0x3333333333333333333333333333333333333333";
const AGENT_ID = "97:0x1111111111111111111111111111111111111111:65001";
const COMMERCE = "0xcommerce0000000000000000000000000000000001";

function makeJob(over: Partial<Erc8183Job> = {}): Erc8183Job {
  const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const base = {
    id: 42n,
    client: CLIENT,
    provider: OWNER,
    evaluator: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    description: "hire task description",
    budget: 1000000000000000000n,
    expiredAt: future,
    status: 1,
    statusName: "FUNDED",
    hook: "0xhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
    submittedAt: 0n,
    deliverable: ("0x" + "0".repeat(64)) as `0x${string}`,
  };
  return { ...base, ...over } as unknown as Erc8183Job;
}

function readerReturning(job: Erc8183Job): Erc8183JobReader {
  return { readJob: async () => job };
}
function readerReturningNull(): Erc8183JobReader {
  return { readJob: async () => null as unknown as Erc8183Job };
}
function readerThrowing(err: unknown = new Error("rpc failure")): Erc8183JobReader {
  return {
    readJob: async () => {
      throw err;
    },
  };
}
function readerIdMismatch(): Erc8183JobReader {
  return {
    readJob: async (id) => {
      const j = makeJob();
      (j as unknown as { id: bigint }).id = id + 1n;
      return j;
    },
  };
}

const ownerOk = async (a: string): Promise<string | null> => (a === AGENT_ID ? OWNER : null);
const ownerUnknown = async (): Promise<string | null> => null;
const bindingOk = (): Erc8183CapabilityBinding => ({
  resource: "https://agent.example/erc8183/status",
  executionCapability: "erc8183-hire",
});
const bindingNull = (): Erc8183CapabilityBinding | null => null;
const bindingBadResource = (): Erc8183CapabilityBinding => ({
  resource: "default",
  executionCapability: "erc8183-hire",
});
const bindingBadCapability = (): Erc8183CapabilityBinding => ({
  resource: "https://agent.example/x",
  executionCapability: "enabled",
});

interface ConfigOverrides {
  job?: Erc8183Job;
  reader?: Erc8183JobReader;
  owner?: (a: string) => Promise<string | null>;
  binding?: () => Erc8183CapabilityBinding | null;
  expectedChainId?: number;
  expectedClient?: string;
}

function config(o: ConfigOverrides = {}): Erc8183CapabilityProviderConfig {
  return {
    reader: o.reader ?? readerReturning(o.job ?? makeJob()),
    expectedChainId: o.expectedChainId ?? 97,
    expectedClient: o.expectedClient ?? CLIENT,
    resolveAgentOwner: o.owner ?? ownerOk,
    resolveCapabilityBinding: o.binding ?? bindingOk,
    verificationSource: COMMERCE,
  };
}

const input = { agentId: AGENT_ID, hireId: "42" };

let failures = 0;
function check(label: string, condition: boolean): void {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
}

// ---------------------------------------------------------------------------
// POSITIVE
// ---------------------------------------------------------------------------
const goodEvidence = await resolveErc8183VerifiedJob(input, config());
check("positive: valid funded job resolves evidence", goodEvidence !== null);
check("positive: correct chain (97)", goodEvidence?.chainId === 97);
check("positive: correct job id", goodEvidence?.jobId === "42");
check("positive: correct client", goodEvidence?.client === CLIENT);
check("positive: correct provider === owner", goodEvidence?.provider === OWNER);
check("positive: correct agent identity", goodEvidence?.agentIdentity === AGENT_ID);
check(
  "positive: valid resource from trusted binding",
  goodEvidence?.resource === "https://agent.example/erc8183/status"
);
check("positive: valid execution capability", goodEvidence?.executionCapability === "erc8183-hire");
check("positive: valid price (budget)", goodEvidence?.budget === "1000000000000000000");
check(
  "positive: valid (future) expiry",
  goodEvidence !== null && Date.parse(goodEvidence.expiresAt) > Date.now()
);
check("positive: valid status FUNDED", goodEvidence?.status === "FUNDED");
check(
  "positive: verification provenance source = commerce contract",
  goodEvidence?.verification.source === COMMERCE
);
check(
  "positive: verification method = onchain read",
  goodEvidence?.verification.method === "onchain:erc8183-job-state-read"
);
check(
  "positive: verification timestamp parseable",
  goodEvidence !== null && Number.isFinite(Date.parse(goodEvidence.verification.verifiedAt))
);

// X.76 capability mapping + validator
const provider = createErc8183CapabilityProvider(config());
const capability = await provider.resolveExecutionCapability(input);
check("positive: X.76 provider returns capability", capability !== null);
check(
  "positive: capability passes verifyExecutionCapability",
  capability !== null && verifyExecutionCapability(capability).ok
);
check(
  "positive: capability carries provenance",
  capability !== null && capability.verification.method === "onchain:erc8183-job-state-read"
);
check(
  "positive: capability job/resource/price match evidence",
  capability !== null &&
    capability.jobId === "42" &&
    capability.resource === goodEvidence?.resource &&
    capability.price === goodEvidence?.budget
);

// X.80 validator accepts the evidence
const gateCtx: JobValidationContext = {
  expectedAgentOwner: OWNER,
  expectedClient: CLIENT,
  expectedChainId: 97,
};
check(
  "positive: produced evidence passes X.80 validateVerifiedJob",
  goodEvidence !== null && validateVerifiedJob(goodEvidence, gateCtx).ok
);

// SUBMITTED status also actionable
const submitted = await resolveErc8183VerifiedJob(
  input,
  config({ job: makeJob({ statusName: "SUBMITTED", status: 2 }) })
);
check("positive: SUBMITTED job is actionable", submitted?.status === "SUBMITTED");

// ---------------------------------------------------------------------------
// NEGATIVE — all must return null (fail closed)
// ---------------------------------------------------------------------------
check(
  "negative: nonexistent job (reader throws) -> null",
  (await resolveErc8183VerifiedJob(input, config({ reader: readerThrowing() }))) === null
);
check(
  "negative: wrong chain (56) -> null",
  (await resolveErc8183VerifiedJob(input, config({ expectedChainId: 56 }))) === null
);
check(
  "negative: wrong client -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ client: "0x4444444444444444444444444444444444444444" }) })
  )) === null
);
check(
  "negative: wrong provider -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ provider: "0x5555555555555555555555555555555555555555" }) })
  )) === null
);
check(
  "negative: wrong agent (unknown owner) -> null",
  (await resolveErc8183VerifiedJob(input, config({ owner: ownerUnknown }))) === null
);
check(
  "negative: wrong job id (id mismatch) -> null",
  (await resolveErc8183VerifiedJob(input, config({ reader: readerIdMismatch() }))) === null
);
check(
  "negative: untrusted job id (no hireId) -> null",
  (await resolveErc8183VerifiedJob({ agentId: AGENT_ID }, config())) === null
);
check(
  "negative: unfunded OPEN job -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ statusName: "OPEN", status: 0 }) })
  )) === null
);
check(
  "negative: expired job -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ expiredAt: BigInt(Math.floor(Date.now() / 1000) - 3600) }) })
  )) === null
);
check(
  "negative: disputed REJECTED job -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ statusName: "REJECTED", status: 4 }) })
  )) === null
);
check(
  "negative: settled COMPLETED job -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ statusName: "COMPLETED", status: 3 }) })
  )) === null
);
check(
  "negative: cancelled/non-actionable EXPIRED status -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ statusName: "EXPIRED", status: 5 }) })
  )) === null
);
check(
  "negative: missing resource (binding default) -> null",
  (await resolveErc8183VerifiedJob(input, config({ binding: bindingBadResource }))) === null
);
check(
  "negative: missing capability (binding enabled) -> null",
  (await resolveErc8183VerifiedJob(input, config({ binding: bindingBadCapability }))) === null
);
check(
  "negative: no trusted binding at all -> null (ERC-8183 missing field)",
  (await resolveErc8183VerifiedJob(input, config({ binding: bindingNull }))) === null
);
check(
  "negative: missing price (budget 0) -> null",
  (await resolveErc8183VerifiedJob(input, config({ job: makeJob({ budget: 0n }) }))) === null
);
check(
  "negative: missing expiry (expiredAt 0) -> null",
  (await resolveErc8183VerifiedJob(input, config({ job: makeJob({ expiredAt: 0n }) }))) === null
);
check(
  "negative: malformed RPC result (null) -> null",
  (await resolveErc8183VerifiedJob(input, config({ reader: readerReturningNull() }))) === null
);
check(
  "negative: RPC failure -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ reader: readerThrowing(new Error("contract revert")) })
  )) === null
);
check(
  "negative: stale data (provider changed) -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ provider: "0x6666666666666666666666666666666666666666" }) })
  )) === null
);
check(
  "negative: forged user-supplied client != marketplace -> null",
  (await resolveErc8183VerifiedJob(
    input,
    config({ job: makeJob({ client: "0x7777777777777777777777777777777777777777" }) })
  )) === null
);

// ---------------------------------------------------------------------------
// SECURITY
// ---------------------------------------------------------------------------
check(
  "security: provider exposes only resolveExecutionCapability",
  typeof (provider as Record<string, unknown>)["resolveExecutionCapability"] === "function" &&
    Object.keys(provider).length === 1
);
check(
  "security: capability result has no session/ACTIVE shape",
  capability === null || (!("session" in capability) && !("active" in capability))
);
check(
  "security: never bypasses custody — verified capability + custody false stays blocked",
  (() => {
    if (goodEvidence === null) return false;
    const record = { agent_id: AGENT_ID, chain_id: 97, owner_address: OWNER } as never;
    const commitment = commitmentFromAgent(record, {
      jobId: goodEvidence.jobId,
      resource: goodEvidence.resource,
      executionCapability: goodEvidence.executionCapability,
      budget: goodEvidence.budget,
      expiresAt: goodEvidence.expiresAt,
      verification: {
        source: goodEvidence.verification.source,
        method: goodEvidence.verification.method,
      },
    });
    const identity: AuthenticatedIdentity = {
      userId: "u1",
      walletId: "w1",
      walletAddress: OWNER,
      chainId: 97,
      sessionId: "s1",
      sessionExpiresAt: new Date(Date.now() + 86_400_000),
      lastUsedAt: new Date(),
    };
    const gate = evaluateSessionGate({
      identity,
      agentIdentity: AGENT_ID,
      consent: { commitment, digest: digestConsentCommitment(commitment) },
      verifiedJob: goodEvidence,
      custodyAvailable: false,
      gateCtx,
    });
    return (
      gate.allowed === false &&
      gate.reason === "custody unavailable" &&
      gate.state === "verified-funded"
    );
  })()
);

if (failures === 0)
  console.log("X.81 read-only ERC-8183 capability-provider verifier: ALL CHECKS PASSED");
else {
  console.log(`X.81 verifier: ${failures} check(s) failed`);
  process.exitCode = 1;
}
