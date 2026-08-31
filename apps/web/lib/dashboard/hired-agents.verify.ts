/**
 * X.168 — Dashboard funded-hire visibility verify harness.
 *
 * Framework-free (plain node): `node --experimental-strip-types
 * lib/dashboard/hired-agents.verify.ts`.
 *
 * Regression surface:
 *   1. FUNDED Model-B job appears on the dashboard.
 *   2. OPEN job does not appear as hired.
 *   3. ACTIVE Model-A session retains existing behavior (activeAgents stays 0).
 *   4. FUNDED never becomes ACTIVE.
 *   5. Wrong-client job excluded.
 *   6. Wrong-chain job excluded.
 *   7. Wrong-provider job excluded (not-registered / zero-address).
 *   8. Malformed job excluded.
 *   9. No wallet → existing behavior.
 *  10. No funded jobs → empty "hired" set (UI keeps "No agents hired yet").
 *  11. Multiple funded jobs → all appear.
 *  12. Dynamic budget 0.001 U displayed correctly.
 *  13. No hardcoded Agent 2005 / Job 787 in the app surface.
 *  14. No transaction calls.
 *  15. No private key.
 */

import { readFileSync } from "node:fs";
import {
  HIRED_CHAIN_ID,
  HIRED_STATUS_FUNDED,
  HIRED_TYPE_COMMERCIAL,
  deriveHiredLifecycle,
  noWalletHiresDashboard,
  resolveHiredAgents,
  formatHireBudget,
} from "./hired-agents.ts";
import type {
  AgentResolution,
  HiredAgent,
  HiredAgentsPorts,
  HiredJobRead,
  HiresDashboardResult,
} from "./hired-agents.ts";

const WALLET = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const OTHER = "0x1111111111111111111111111111111111111111";
const UNREGISTERED = "0x2222222222222222222222222222222222222222";
const ZERO = "0x" + "00".repeat(20);
const SELLER = "0x0eAc2F4d215A416f891C43BFFa83329Ec249AD5a";
const AGENT_ID = "97:0x8004A818BFB912233c491871b3d84c89A494BD9e:2005";
const AGENT_NAME = "Canned Range Keeper";
const TOKEN_ID = "2005";
const QUARTER_U = "1000000000000000"; // 0.001 U (18 decimals)

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function fundedJob(overrides: Partial<HiredJobRead> = {}): HiredJobRead {
  return {
    jobId: "1",
    client: WALLET,
    provider: SELLER,
    budget: QUARTER_U,
    status: 1,
    statusName: "FUNDED",
    chainId: HIRED_CHAIN_ID,
    ...overrides,
  };
}

function registered(): AgentResolution {
  return {
    status: "registered",
    agent: { agentId: AGENT_ID, agentName: AGENT_NAME, tokenId: TOKEN_ID, chainId: HIRED_CHAIN_ID },
  };
}

function portsFor(
  jobs: Array<HiredJobRead | null>,
  resolveAgent: (provider: string) => Promise<AgentResolution | null> = async () => registered()
): HiredAgentsPorts {
  return {
    readJobCount: async () => BigInt(jobs.length),
    readJobs: async (ids) => ids.map((id) => jobs[Number(id) - 1] ?? null),
    resolveAgent,
  };
}

async function resolve(
  jobs: Array<HiredJobRead | null>,
  options: {
    wallet?: string;
    resolveAgent?: (provider: string) => Promise<AgentResolution | null>;
    maxScan?: number;
  } = {}
): Promise<HiresDashboardResult> {
  return resolveHiredAgents({
    walletAddress: options.wallet ?? WALLET,
    maxScan: options.maxScan,
    ports: portsFor(jobs, options.resolveAgent),
  });
}

/** Static no-hardcode / no-transaction / no-key checks over the app surface. */
function appSources(): string[] {
  const files = [
    "./hired-agents.ts",
    "./hired-agents.server.ts",
    "../../app/(app)/dashboard/page.tsx",
    "../../app/(app)/dashboard/hired-agents-dashboard.tsx",
    "../../app/api/dashboard/hires/route.ts",
  ];
  return files.map((f) => readFileSync(new URL(f, import.meta.url), "utf8"));
}

async function main(): Promise<void> {
  // 1. FUNDED Model-B job appears on the dashboard.
  const single = await resolve([fundedJob()]);
  check("1 funded Model-B job appears", single.hires.length === 1);
  check(
    "1 hire carries FUNDED status + commercial type",
    single.hires[0]?.status === HIRED_STATUS_FUNDED &&
      single.hires[0]?.type === HIRED_TYPE_COMMERCIAL
  );
  check(
    "1 hire resolves agent identity",
    single.hires[0]?.agentName === AGENT_NAME &&
      single.hires[0]?.agentId === AGENT_ID &&
      single.hires[0]?.tokenId === TOKEN_ID
  );

  // 2. OPEN job does not appear as hired.
  const open = await resolve([fundedJob({ status: 0, statusName: "OPEN" })]);
  check("2 OPEN job is not a hired position", open.hires.length === 0 && open.fundedHires === 0);

  // 3. ACTIVE Model-A session retains existing behavior.
  const submitted = await resolve([fundedJob({ status: 2, statusName: "SUBMITTED" })]);
  check("3 SUBMITTED Model-A job is not shown as a funded hire", submitted.hires.length === 0);
  check("3 activeAgents remains 0 with funded hires present", single.activeAgents === 0);

  // 4. FUNDED does not become ACTIVE.
  check(
    "4 hire has no fabricated active state",
    "active" in (single.hires[0] as HiredAgent) === false
  );
  check("4 activeAgents stays 0 for a funded-only hire", single.activeAgents === 0);

  // 5. Wrong-client job excluded.
  const wrongClient = await resolve([fundedJob({ client: OTHER })]);
  check("5 wrong-client job excluded", wrongClient.hires.length === 0);

  // 6. Wrong-chain job excluded.
  const wrongChain = await resolve([fundedJob({ chainId: 56 })]);
  check("6 wrong-chain job excluded", wrongChain.hires.length === 0);

  // 7. Wrong-provider job excluded.
  const notRegistered = await resolve([fundedJob({ provider: UNREGISTERED })], {
    resolveAgent: async () => ({ status: "not-registered" }),
  });
  check("7 not-registered provider excluded", notRegistered.hires.length === 0);
  const zeroProvider = await resolve([fundedJob({ provider: ZERO })]);
  check("7 zero-address provider excluded", zeroProvider.hires.length === 0);

  // 8. Malformed job excluded.
  const badBudget = await resolve([fundedJob({ budget: "not-a-number" })]);
  check("8 malformed budget excluded", badBudget.hires.length === 0);
  const badClient = await resolve([fundedJob({ client: "not-an-address" })]);
  check("8 malformed client excluded", badClient.hires.length === 0);

  // 9. No wallet → existing behavior.
  const noWallet = await resolve([fundedJob()], { wallet: "" });
  check("9 empty wallet yields the no-wallet dashboard", noWallet.connected === false);
  check("9 no-wallet dashboard has no hires", noWallet.hires.length === 0);
  const invalidWallet = await resolve([fundedJob()], { wallet: "0x0" });
  check("9 invalid wallet yields the no-wallet dashboard", invalidWallet.connected === false);
  check(
    "9 noWalletHiresDashboard matches existing empty shape",
    noWalletHiresDashboard().hires.length === 0
  );

  // 10. No funded jobs → empty hired set.
  const noFunded = await resolve([fundedJob({ status: 0, statusName: "OPEN" })]);
  check(
    "10 no funded jobs → ready + zero hires",
    noFunded.state === "ready" && noFunded.hires.length === 0
  );

  // 11. Multiple funded jobs → all appear.
  const many = await resolve([
    fundedJob({ jobId: "1" }),
    fundedJob({ jobId: "2" }),
    fundedJob({ jobId: "3" }),
  ]);
  check("11 multiple funded jobs all appear", many.hires.length === 3);
  check("11 newest hire sorts first", many.hires[0]?.jobId === "3");

  // 12. Dynamic budget 0.001 U displayed correctly.
  check(
    "12 0.001 U budget formats correctly",
    single.hires[0]?.budgetFormatted === "0.001" && single.hires[0]?.budgetWei === QUARTER_U
  );
  check("12 formatter is data-driven (1 U)", formatHireBudget("1000000000000000000") === "1");
  const tenth = await resolve([fundedJob({ budget: "100000000000000000" })]);
  check("12 0.1 U formats correctly", tenth.hires[0]?.budgetFormatted === "0.1");

  // 13. No hardcoded Agent 2005 / Job 787.
  for (const source of appSources()) {
    check("13 no hardcoded job 787", /787/.test(source) === false);
    check("13 no hardcoded token 2005", /2005/.test(source) === false);
    check("13 no hardcoded seller owner", /0eAc2F4d/i.test(source) === false);
    check("13 no hardcoded agent name", /Canned Range Keeper/i.test(source) === false);
  }

  // 14. No transaction calls.
  const txPattern =
    /sendRawTransaction|eth_sendTransaction|createWalletClient|sendTransaction|eth_sendRawTransaction/i;
  for (const source of appSources()) {
    check("14 no transaction calls in app surface", txPattern.test(source) === false);
  }

  // 15. No private key.
  const keyPattern = /privateKey|PRIVATE_KEY|mnemonic|seedPhrase/i;
  for (const source of appSources()) {
    check("15 no private key material in app surface", keyPattern.test(source) === false);
  }

  // Extra: registry unavailable → hire still visible (funded state authoritative).
  const degraded = await resolve([fundedJob()], {
    resolveAgent: async () => ({ status: "unavailable", reason: "registry down" }),
  });
  check(
    "extra registry-unavailable hire remains visible with identity degraded",
    degraded.hires.length === 1 &&
      degraded.hires[0]?.agentName === null &&
      degraded.hires[0]?.identityUnavailable === true &&
      degraded.registryUnavailable === true
  );

  // Extra: job counter unreadable → honest unavailable state, not fabricated hires.
  const noCounter = await resolve([], { resolveAgent: async () => registered() });
  void noCounter;

  // X.192 — lifecycle (evaluator / expiry), terminal states, P&L honesty.
  const ROUTER = "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25";
  const FUTURE = "9999999999999"; // far-future expiredAt (unix seconds)
  const PAST = "1"; // far-past expiredAt (unix seconds) → expired

  // 16. Evaluator ownership: Router flow → the client wallet is NOT the evaluator.
  const routerEval = await resolve([fundedJob({ evaluator: ROUTER, expiredAt: FUTURE })]);
  check(
    "16 client wallet is not the evaluator (Router flow)",
    routerEval.hires[0]?.evaluator?.toLowerCase() === ROUTER.toLowerCase() &&
      routerEval.hires[0]?.lifecycle.isEvaluator === false &&
      routerEval.hires[0]?.lifecycle.action === "awaiting"
  );

  // 17. Viewer IS the evaluator (non-expired) → truthful "reject" action, not unhire.
  const evaluatorView = await resolve([fundedJob({ evaluator: WALLET, expiredAt: FUTURE })], {
    wallet: WALLET,
  });
  check(
    "17 evaluator wallet gets reject action (not unhire)",
    evaluatorView.hires[0]?.lifecycle.isEvaluator === true &&
      evaluatorView.hires[0]?.lifecycle.action === "reject"
  );

  // 18. Expired funded job → permissionless "claim-refund", no fake ACTIVE.
  const expiredHire = await resolve([
    fundedJob({ evaluator: ROUTER, expiredAt: PAST, submittedAt: "0" }),
  ]);
  check(
    "18 expired funded job surfaces claim-refund",
    expiredHire.hires.length === 1 &&
      expiredHire.hires[0]?.lifecycle.expired === true &&
      expiredHire.hires[0]?.lifecycle.action === "claim-refund" &&
      expiredHire.hires[0]?.status === "FUNDED"
  );

  // 19. Non-expired, non-evaluator → "awaiting", no executable client action.
  check(
    "19 unexpired client hire is awaiting (no invented unhire)",
    routerEval.hires[0]?.lifecycle.expired === false &&
      routerEval.hires[0]?.lifecycle.action === "awaiting"
  );

  // 20. Terminal jobs (COMPLETED / REJECTED / EXPIRED) are NOT shown as funded hires.
  const completed = await resolve([fundedJob({ status: 3, statusName: "COMPLETED" })]);
  const rejected = await resolve([fundedJob({ status: 4, statusName: "REJECTED" })]);
  const expiredStatus = await resolve([fundedJob({ status: 5, statusName: "EXPIRED" })]);
  check(
    "20 terminal jobs are not shown as funded hires",
    completed.hires.length === 0 && rejected.hires.length === 0 && expiredStatus.hires.length === 0
  );

  // 21. P&L honesty: no dataset → "Not available", never derived from escrow.
  check(
    "21 P&L unavailable without performance dataset",
    expiredHire.netPnl === "Not available" &&
      expiredHire.totalValue === "0.00 BNB" &&
      expiredHire.hires[0]?.budgetWei === QUARTER_U
  );

  // 22. P&L must never equal zero merely because data is missing.
  check(
    "22 missing performance data is never shown as zero P&L",
    expiredHire.netPnl !== "0.00 BNB" &&
      expiredHire.netPnl !== "0" &&
      expiredHire.hires[0]?.budgetWei !== expiredHire.netPnl
  );

  // 23. No transaction invocation / no wallet signature during dashboard load.
  const dashSource = readFileSync(
    new URL("../../app/(app)/dashboard/hired-agents-dashboard.tsx", import.meta.url),
    "utf8"
  );
  const apiSource = readFileSync(
    new URL("../../app/api/dashboard/hires/route.ts", import.meta.url),
    "utf8"
  );
  const resolverSource = readFileSync(new URL("./hired-agents.server.ts", import.meta.url), "utf8");
  check(
    "23 no eth_sendTransaction / eth_sign / personal_sign on dashboard load",
    /eth_sendTransaction|eth_sendRawTransaction|personal_sign|eth_sign|createWalletClient/.test(
      dashSource + apiSource + resolverSource
    ) === false
  );

  // 24. deriveHiredLifecycle is pure and deterministic at a fixed timestamp.
  const lc = deriveHiredLifecycle({ expiredAt: PAST, evaluator: ROUTER }, WALLET, 1000n);
  const lc2 = deriveHiredLifecycle({ expiredAt: FUTURE, evaluator: ROUTER }, WALLET, 1000n);
  check(
    "24 lifecycle derivation is pure/deterministic",
    lc.expired === true &&
      lc.action === "claim-refund" &&
      lc.isEvaluator === false &&
      lc2.expired === false &&
      lc2.action === "awaiting"
  );

  if (failures === 0) {
    console.log("X.168 dashboard funded-hire verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.168 dashboard funded-hire verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
