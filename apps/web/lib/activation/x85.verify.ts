/**
 * X.85 verifier — ERC-8183 signed-quote capability resolution.
 * Run: `pnpm --filter web activation:x85:verify` (from apps/web)
 *
 * Tests the verification logic with a synthetic keypair. A synthetic key proves
 * the crypto path works but does NOT represent a real marketplace quote; the
 * production gate stays closed because no SignedQuoteReader is wired.
 */

import { privateKeyToAccount, type Hex } from "viem/accounts";
import type { Erc8183Job } from "@altananetwork/sdk";
import {
  buildQuoteMessage,
  makeSignedQuoteBindingResolver,
  verifySignedQuote,
  type Erc8183SignedQuote,
} from "./signed-quote-capability.ts";
import {
  createErc8183CapabilityProvider,
  type Erc8183CapabilityProviderConfig,
} from "./erc8183-capability-provider.ts";
import { SUPPORTED_ERC8183_CHAIN_ID } from "./erc8183-capability-provider.ts";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}`);
  }
}

const OWNER = privateKeyToAccount(("0x" + "11".repeat(32)) as Hex);
const OTHER = privateKeyToAccount(("0x" + "22".repeat(32)) as Hex);
const CHAIN = SUPPORTED_ERC8183_CHAIN_ID;
const JOB_ID = "515";
const CLIENT = ("0x" + "ab".repeat(20)) as string;

function makeJob(provider: string): Erc8183Job {
  return {
    id: BigInt(JOB_ID),
    client: CLIENT as `0x${string}`,
    provider: provider as `0x${string}`,
    evaluator: "0x0000000000000000000000000000000000000000",
    description: "job",
    budget: 1000000000000000000n,
    expiredAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
    status: 2,
    statusName: "FUNDED",
    hook: "0x0000000000000000000000000000000000000000",
    submittedAt: 0n,
    deliverable: "",
  } as unknown as Erc8183Job;
}

async function signedQuote(over: Partial<Erc8183SignedQuote> = {}): Promise<Erc8183SignedQuote> {
  const base: Omit<Erc8183SignedQuote, "signature"> = {
    jobId: JOB_ID,
    provider: OWNER.address,
    resource: "https://agent.example/a2a",
    executionCapability: "a2a:chat,a2a:search",
    quoteExpiresAt: Math.floor(Date.now() / 1000) + 600,
    signedAt: Math.floor(Date.now() / 1000),
    ...over,
  };
  const signature = await OWNER.signMessage({ message: buildQuoteMessage(base) });
  return { ...base, signature };
}

async function main(): Promise<void> {
  console.log("X.85 — signed-quote capability verification\n");

  // 1. message determinism
  const m1 = buildQuoteMessage({
    jobId: JOB_ID,
    provider: OWNER.address,
    resource: "r",
    executionCapability: "c",
    quoteExpiresAt: 100,
    signedAt: 50,
  });
  const m2 = buildQuoteMessage({
    jobId: JOB_ID,
    provider: OWNER.address,
    resource: "r",
    executionCapability: "c",
    quoteExpiresAt: 100,
    signedAt: 50,
  });
  check("buildQuoteMessage deterministic", m1 === m2);
  check("buildQuoteMessage versioned prefix", m1.startsWith("ALTANA-ERC8183-QUOTE/1\n"));

  // 2. valid signed quote verifies -> binding
  const q = await signedQuote();
  const binding = await verifySignedQuote(q, makeJob(OWNER.address), OWNER.address);
  check(
    "valid quote returns resource/capability",
    binding?.resource === "https://agent.example/a2a" &&
      binding?.executionCapability === "a2a:chat,a2a:search"
  );

  // 3. wrong signer fails
  const qWrongSigner = await signedQuote({ provider: OTHER.address }); // signed by OWNER but claims OTHER
  const bWrong = await verifySignedQuote(qWrongSigner, makeJob(OTHER.address), OTHER.address);
  check("signer != provider fails", bWrong === null);

  // 4. provider != job.provider fails
  const qMismatch = await signedQuote(); // signed by OWNER
  const bMismatch = await verifySignedQuote(qMismatch, makeJob(OTHER.address), OWNER.address);
  check("provider != job.provider fails", bMismatch === null);

  // 5. provider != registry owner fails
  const bOwner = await verifySignedQuote(
    await signedQuote(),
    makeJob(OWNER.address),
    OTHER.address
  );
  check("provider != registry owner fails", bOwner === null);

  // 6. expired quote fails
  const qExpired = await signedQuote({ quoteExpiresAt: Math.floor(Date.now() / 1000) - 10 });
  const bExpired = await verifySignedQuote(qExpired, makeJob(OWNER.address), OWNER.address);
  check("expired quote fails", bExpired === null);

  // 7. jobId mismatch fails
  const qJobMismatch = await signedQuote({ jobId: "999" });
  const bJobMismatch = await verifySignedQuote(qJobMismatch, makeJob(OWNER.address), OWNER.address);
  check("quote jobId != job.id fails", bJobMismatch === null);

  // 8. resolver with no reader => null
  const nullResolver = makeSignedQuoteBindingResolver(null, async () => OWNER.address);
  check(
    "resolver null reader => null",
    (await nullResolver("agent", makeJob(OWNER.address))) === null
  );

  // 9. resolver with reader returning valid quote => binding
  const okReader: { readSignedQuote: (a: string) => Promise<Erc8183SignedQuote | null> } = {
    readSignedQuote: async () => signedQuote(),
  };
  const okResolver = makeSignedQuoteBindingResolver(okReader, async () => OWNER.address);
  const fromResolver = await okResolver("agent", makeJob(OWNER.address));
  check("resolver valid quote => binding", fromResolver?.resource === "https://agent.example/a2a");

  // 10. integration: X.81 provider returns capability ONLY when signed quote valid
  const baseCfg: Omit<Erc8183CapabilityProviderConfig, "resolveCapabilityBinding"> = {
    reader: { readJob: async () => makeJob(OWNER.address) },
    expectedChainId: CHAIN,
    expectedClient: CLIENT,
    resolveAgentOwner: async () => OWNER.address,
    verificationSource: "0xcommerce",
  };

  const noQuoteProvider = createErc8183CapabilityProvider({
    ...baseCfg,
    resolveCapabilityBinding: makeSignedQuoteBindingResolver(null, async () => OWNER.address),
  });
  const capNone = await noQuoteProvider.resolveExecutionCapability({
    agentId: "agent",
    hireId: JOB_ID,
    chainId: CHAIN,
    walletAddress: OWNER.address,
  });
  check("X.81 provider no quote => null (gate closed)", capNone === null);

  const withQuoteProvider = createErc8183CapabilityProvider({
    ...baseCfg,
    resolveCapabilityBinding: makeSignedQuoteBindingResolver(okReader, async () => OWNER.address),
  });
  const capYes = await withQuoteProvider.resolveExecutionCapability({
    agentId: "agent",
    hireId: JOB_ID,
    chainId: CHAIN,
    walletAddress: OWNER.address,
  });
  check(
    "X.81 provider valid quote => VerifiedExecutionCapability",
    capYes !== null && capYes.jobId === JOB_ID && capYes.resource === "https://agent.example/a2a"
  );

  // 11. tampered resource rejected
  const qBadRes = await signedQuote({ resource: "default" });
  const bBadRes = await verifySignedQuote(qBadRes, makeJob(OWNER.address), OWNER.address);
  check("quote with 'default' resource fails", bBadRes === null);

  console.log(`\nX.85 summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("FAILURES:", failures);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("X.85 verifier crashed:", err);
  process.exit(1);
});
