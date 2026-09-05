/**
 * X.139 - Main Track user-controlled wallet hire verify harness (no tx, no AWS).
 *
 * Exercises the EIP-1193-backed hire flow with a deterministic nonce-safe
 * provider that confirms each receipt via `pollForReceipt`, a mock browser
 * wallet, and a fake on-chain read. Run after build:
 *   node dist/altana/v2/main-track-user-wallet.verify.js
 */

import {
  MAIN_TRACK_COMMERCE,
  MAIN_TRACK_ROUTER,
  MAIN_TRACK_POLICY,
  MAIN_TRACK_PAYMENT_TOKEN,
  MAIN_TRACK_PUBLIC_RPC,
  MainTrackNonceLedger,
  MainTrackNonceTooLowError,
  createMainTrackHeadlessProvider,
  createMainTrackNetworkConfig,
  createMainTrackReceiptReader,
  createMainTrackBroadcast,
  createMainTrackUserWallet,
  createNonceSafeEip1193Provider,
  createReliableReceiptReader,
  normalizeReceipt,
  normalizeReceiptStatus,
  pollForReceipt,
  toBigintSafe,
  runMainTrackUserHire,
  validateMainTrackUserHirePlan,
  buildMainTrackUserHireCalls,
} from "./main-track-user-wallet.js";
import type {
  MainTrackSigner,
  MainTrackUserHireDeps,
  MainTrackUserHireExpectations,
  MainTrackUserHirePlan,
} from "./main-track-user-wallet.js";
import type { PublicClient } from "viem";
import { parseTransaction, recoverTransactionAddress, decodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const SELLER = "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
const OTHER = "0x1111111111111111111111111111111111111111";
const USER = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const PRICE = "1000000000000000000";

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function expectations(): MainTrackUserHireExpectations {
  return {
    expectedChainId: 97,
    expectedCommerce: MAIN_TRACK_COMMERCE,
    expectedRouter: MAIN_TRACK_ROUTER,
    expectedPolicy: MAIN_TRACK_POLICY,
    expectedPaymentToken: MAIN_TRACK_PAYMENT_TOKEN,
    expectedPrice: PRICE,
    expectedProvider: SELLER,
  };
}

function buildPlan(overrides: Partial<MainTrackUserHirePlan> = {}): MainTrackUserHirePlan {
  const now = BigInt(nowSeconds());
  const built = buildMainTrackUserHireCalls({
    provider: SELLER,
    description: JSON.stringify({
      version: 1,
      task: "deterministic report",
      price: PRICE,
      currency: MAIN_TRACK_PAYMENT_TOKEN,
      chain_id: 97,
    }),
    budget: BigInt(PRICE),
    expiredAt: now + 100000n,
    jobId: 651n,
    chainId: 97,
  });
  return {
    chainId: 97,
    client: USER.toLowerCase(),
    provider: SELLER.toLowerCase(),
    budget: PRICE,
    jobId: "651",
    expiredAt: (now + 100000n).toString(),
    calls: built.calls,
    ...overrides,
  };
}

function fundedJob() {
  return {
    jobId: "651",
    client: USER.toLowerCase(),
    provider: SELLER.toLowerCase(),
    budget: PRICE,
    status: 1,
    statusName: "FUNDED",
    expiredAt: String(nowSeconds() + 90000),
  };
}

/** Simple EIP-1193 request (eth_requestAccounts / eth_chainId / eth_sendTransaction). */
function rawRequest(opts: { accounts?: string[]; chainId?: number } = {}) {
  const calls: Array<{ method: string; params: unknown }> = [];
  const request: MainTrackUserHireDeps["request"] = async (method, params) => {
    calls.push({ method, params: params as unknown });
    if (method === "eth_requestAccounts") return opts.accounts ?? [USER];
    if (method === "eth_chainId") return `0x${(opts.chainId ?? 97).toString(16)}`;
    if (method === "eth_sendTransaction") return "0x" + "cc".repeat(32);
    return null;
  };
  return { request, calls };
}

type ReceiptMode =
  "immediate" | "afterPolls" | "reverted" | "timeout" | "error" | "bigint" | "malformed";

/** Deterministic nonce-safe provider deps with controllable receipt behavior. */
function nonceSafeDeps(
  opts: {
    accounts?: string[];
    chainId?: number;
    initialNonce?: bigint;
    /** Fail the Nth broadcast with a user rejection. */
    failBroadcastAt?: number;
    /** Fail the Nth broadcast with a nonce-too-low error. */
    nonceTooLowAt?: number;
    /** Receipt mode applied to tx index `receiptAt` (1-based); other txs succeed. */
    receipt?: ReceiptMode;
    receiptAt?: number;
    receiptAfter?: number;
  } = {}
) {
  const nonces: bigint[] = [];
  let broadcastCount = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  let polls = 0;
  const pollCounts = new Map<string, number>();
  const raw = rawRequest({ accounts: opts.accounts, chainId: opts.chainId });

  const getReceipt = async (hash: string): Promise<unknown> => {
    polls += 1;
    const idx = Number.parseInt(hash.replace(/^0x/, "").replace(/^0+/, "") || "0", 16);
    const pollCount = (pollCounts.get(hash) ?? 0) + 1;
    pollCounts.set(hash, pollCount);
    if (opts.receiptAt !== undefined && idx !== opts.receiptAt) return { status: "success" };
    const mode = opts.receipt ?? "immediate";
    if (mode === "immediate") return { status: "success" };
    if (mode === "afterPolls")
      return pollCount <= (opts.receiptAfter ?? 2) ? null : { status: "success" };
    if (mode === "reverted") return { status: "reverted" };
    if (mode === "timeout") return null;
    if (mode === "error") throw new Error("rpc polling error");
    if (mode === "bigint")
      throw new Error("Cannot mix BigInt and other types, use explicit conversions");
    if (mode === "malformed") return { status: "weird" };
    return { status: "success" };
  };

  const provider = createNonceSafeEip1193Provider({
    request: raw.request,
    getPendingNonce: async () => opts.initialNonce ?? 0n,
    broadcast: async (tx, nonce) => {
      broadcastCount += 1;
      const idx = broadcastCount;
      nonces.push(nonce);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      if (opts.nonceTooLowAt !== undefined && idx === opts.nonceTooLowAt) {
        inFlight -= 1;
        throw new Error("nonce too low: next nonce 9, tx nonce 8");
      }
      if (opts.failBroadcastAt !== undefined && idx === opts.failBroadcastAt) {
        inFlight -= 1;
        throw new Error("user rejected transaction");
      }
      inFlight -= 1;
      return "0x" + idx.toString(16).padStart(64, "0");
    },
    getReceipt,
    receiptMaxAttempts: 5,
    receiptIntervalMs: 1,
  });
  return {
    deps: { request: provider, readJob: async () => fundedJob() },
    nonces,
    maxInFlight: () => maxInFlight,
    broadcastCount: () => broadcastCount,
    polls: () => polls,
  };
}

async function main(): Promise<void> {
  console.log("X.139 - MAIN TRACK RECEIPT-SAFE USER WALLET VERIFY (no tx, no AWS)");

  // 0. Preparation: exact 5-call batch to allowlisted contracts with 1 U.
  {
    const plan = buildPlan();
    const expected = expectations();
    const targets = new Set(plan.calls.map((c) => c.to));
    check("prep: 5 calls", plan.calls.length === 5);
    check(
      "prep: targets are official commerce/router/token only",
      [
        expected.expectedCommerce.toLowerCase(),
        expected.expectedRouter.toLowerCase(),
        expected.expectedPaymentToken.toLowerCase(),
      ].every((t) => targets.has(t))
    );
    check("prep: plan validates", validateMainTrackUserHirePlan(plan, expected).ok === true);
  }

  // 1. No connected wallet.
  {
    const { deps } = nonceSafeDeps({ accounts: [] });
    const out = await runMainTrackUserHire({
      deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "1. no connected wallet blocked",
      out.ok === false && out.blocked.reason.includes("no connected wallet")
    );
  }

  // 2. Wrong wallet / 3. wrong chain.
  {
    const wrongWallet = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan({ client: OTHER.toLowerCase() }),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "2. wrong wallet blocked",
      wrongWallet.ok === false && wrongWallet.blocked.stage === "wallet"
    );
    const wrongChain = await runMainTrackUserHire({
      deps: nonceSafeDeps({ chainId: 56 }).deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "3. wrong chain blocked",
      wrongChain.ok === false && wrongChain.blocked.reason.includes("wrong chain")
    );
  }

  // 4. Broadcast user rejection at each call: no further sends, no receipt poll after.
  {
    const callNames = ["createJob", "registerJob", "setBudget", "approve", "fund"];
    for (let i = 1; i <= 5; i += 1) {
      const { deps, broadcastCount } = nonceSafeDeps({ failBroadcastAt: i });
      const out = await runMainTrackUserHire({
        deps,
        plan: buildPlan(),
        expected: expectations(),
        confirmed: true,
      });
      check(
        `4. ${callNames[i - 1]} user rejection blocked (no further calls)`,
        out.ok === false && out.blocked.stage === "transaction" && broadcastCount() === i
      );
    }
  }

  // 5. Nonce-too-low at broadcast: typed stop, no next step.
  {
    for (let i = 1; i <= 5; i += 1) {
      const { deps, broadcastCount } = nonceSafeDeps({ nonceTooLowAt: i });
      const out = await runMainTrackUserHire({
        deps,
        plan: buildPlan(),
        expected: expectations(),
        confirmed: true,
      });
      check(
        `5. step ${i} nonce-too-low stops`,
        out.ok === false &&
          out.blocked.reason.toLowerCase().includes("nonce too low") &&
          broadcastCount() === i
      );
    }
  }

  // 6. Success (receipt immediately available): funded, monotonic nonces, serialized.
  {
    const { deps, nonces, maxInFlight, broadcastCount, polls } = nonceSafeDeps();
    const out = await runMainTrackUserHire({
      deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check("6. successful funded", out.ok === true && out.stage === "funded");
    check(
      "6. nonces 0..4 monotonic no reuse",
      nonces.length === 5 && nonces.every((n, idx) => n === BigInt(idx))
    );
    check("6. max in-flight 1", maxInFlight() === 1);
    check("6. broadcast count 5", broadcastCount() === 5);
    check("6. one receipt per tx", polls() === 5);
    check(
      "6. funded != ACTIVE",
      out.ok === true &&
        out.active === false &&
        out.activationState.state === "funded-commercial-hire"
    );
    check(
      "6. real job id + tx evidence",
      out.ok === true && out.jobId === "651" && typeof out.txHashes.fund === "string"
    );
  }

  // 7. Receipt appears after polling: still confirmed (bounded), nonce committed once.
  {
    const { deps, nonces, broadcastCount, polls } = nonceSafeDeps({
      receipt: "afterPolls",
      receiptAfter: 2,
    });
    const out = await runMainTrackUserHire({
      deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check("7. receipt after polling succeeds", out.ok === true && out.stage === "funded");
    check(
      "7. nonces committed once each",
      nonces.length === 5 && nonces.every((n, idx) => n === BigInt(idx))
    );
    check("7. polls > 5 (multiple poll attempts)", polls() > 5);
    check("7. no rebroadcast", broadcastCount() === 5);
  }

  // 8-12. Receipt failure at each step: reverted / timeout / error / bigint / malformed.
  {
    const callNames = ["createJob", "registerJob", "setBudget", "approve", "fund"];
    const modes: Array<{
      mode: "reverted" | "timeout" | "error" | "bigint" | "malformed";
      expect: RegExp;
    }> = [
      { mode: "reverted", expect: /reverted/ },
      { mode: "timeout", expect: /receipt timeout|not confirmed/ },
      { mode: "error", expect: /receipt polling error/ },
      { mode: "bigint", expect: /receipt polling error/ },
      { mode: "malformed", expect: /receipt polling error|malformed/ },
    ];
    for (const { mode, expect } of modes) {
      for (let i = 1; i <= 5; i += 1) {
        const { deps, broadcastCount } = nonceSafeDeps({ receipt: mode, receiptAt: i });
        const out = await runMainTrackUserHire({
          deps,
          plan: buildPlan(),
          expected: expectations(),
          confirmed: true,
        });
        check(
          `${mode} at ${callNames[i - 1]}: blocked, no next step, no rebroadcast`,
          out.ok === false && expect.test(out.blocked.reason) && broadcastCount() === i
        );
      }
    }
  }

  // 13. Ledger unit behavior.
  {
    const ledger = new MainTrackNonceLedger(5n);
    check("13. ledger initial allocation", ledger.allocate() === 5n);
    ledger.commit(5n);
    check("13. ledger advances after commit", ledger.current === 6n);
    ledger.commit(5n);
    check("13. stale commit does not advance", ledger.current === 6n);
    ledger.markFailed();
    check("13. failed ledger stops allocation", ledger.allocate() === null);
  }

  // 14. pollForReceipt / normalizeReceiptStatus pure behavior.
  {
    check(
      "14. normalize success string",
      normalizeReceiptStatus({ status: "success" }) === "success"
    );
    check("14. normalize success hex", normalizeReceiptStatus({ status: "0x1" }) === "success");
    check("14. normalize success bigint", normalizeReceiptStatus({ status: 1n }) === "success");
    check("14. normalize reverted bigint", normalizeReceiptStatus({ status: 0n }) === "reverted");
    check("14. normalize unknown", normalizeReceiptStatus({ status: "weird" }) === "unknown");
    const immediate = await pollForReceipt("0x1", {
      getReceipt: async () => ({ status: "success" }),
      maxAttempts: 3,
      intervalMs: 1,
    });
    check("14. poll immediate success", immediate.status === "success");
    const reverted = await pollForReceipt("0x2", {
      getReceipt: async () => ({ status: "reverted" }),
      maxAttempts: 3,
      intervalMs: 1,
    });
    check("14. poll reverted", reverted.status === "reverted");
    const pending = await pollForReceipt("0x3", {
      getReceipt: (() => {
        let n = 0;
        return async () => {
          n += 1;
          return n < 2 ? null : { status: "success" };
        };
      })(),
      maxAttempts: 5,
      intervalMs: 1,
    });
    check("14. poll appears after pending", pending.status === "success");
    const timeout = await pollForReceipt("0x4", {
      getReceipt: async () => null,
      maxAttempts: 3,
      intervalMs: 1,
    });
    check("14. poll timeout", timeout.status === "timeout");
    const bigintErr = await pollForReceipt("0x5", {
      getReceipt: async () => {
        throw new Error("Cannot mix BigInt and other types, use explicit conversions");
      },
      maxAttempts: 3,
      intervalMs: 1,
    });
    check(
      "14. poll bigint error stops",
      bigintErr.status === "error" && bigintErr.error.includes("BigInt")
    );
    const pendingMsg = await pollForReceipt("0x6", {
      getReceipt: (() => {
        let n = 0;
        return async () => {
          n += 1;
          if (n < 2)
            throw new Error(
              'Transaction receipt with hash "0x…" could not be found. The Transaction may not be processed on a block yet.'
            );
          return { status: "success" };
        };
      })(),
      maxAttempts: 5,
      intervalMs: 1,
    });
    check(
      "14. poll treats 'could not be found' as pending then succeeds",
      pendingMsg.status === "success"
    );
  }

  // 15. Provider-managed nonce: eth_sendTransaction params omit nonce/gas.
  {
    const raw = rawRequest();
    const wallet = createMainTrackUserWallet({ request: raw.request });
    await wallet.connect(97);
    await wallet.sendCall({ to: MAIN_TRACK_COMMERCE, data: "0x00" }, 97);
    const send = raw.calls.find((c) => c.method === "eth_sendTransaction");
    const params = (send?.params as Array<Record<string, unknown>>)?.[0] ?? {};
    check("15. send omits nonce", !("nonce" in params));
    check("15. send omits gas", !("gas" in params));
    check(
      "15. send includes from/to/data/value/chainId",
      ["from", "to", "data", "value", "chainId"].every((k) => k in params)
    );
  }

  // 16. Wrong target / calldata / token / provider / price; expired quote; confirmation; history; no key.
  {
    const plan = buildPlan();
    const badTarget = {
      ...plan,
      calls: plan.calls.map((c, i) => (i === 0 ? { to: OTHER.toLowerCase(), data: c.data } : c)),
    };
    check(
      "16. wrong target rejected",
      validateMainTrackUserHirePlan(badTarget, expectations()).ok === false
    );
    const badCalldata = {
      ...plan,
      calls: plan.calls.map((c, i) => (i === 3 ? { to: c.to, data: "0x" } : c)),
    };
    check(
      "16. wrong calldata rejected",
      validateMainTrackUserHirePlan(badCalldata, expectations()).ok === false
    );
    const badProvider = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan({ provider: OTHER.toLowerCase() }),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "16. wrong provider blocked",
      badProvider.ok === false && badProvider.blocked.reason.includes("wrong provider")
    );
    const badPrice = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan({ budget: "2000000000000000000" }),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "16. wrong price blocked",
      badPrice.ok === false && badPrice.blocked.reason.includes("wrong price")
    );
    const expired = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan({ expiredAt: String(nowSeconds() - 5) }),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "16. expired quote blocked",
      expired.ok === false && expired.blocked.reason.includes("quote expired")
    );
    const noConfirm = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: false,
    });
    check(
      "16. missing confirmation blocked",
      noConfirm.ok === false && noConfirm.blocked.reason.includes("confirmation required")
    );
    const h622 = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan({ jobId: "622" }),
      expected: expectations(),
      confirmed: true,
      historyJobIds: ["622", "641", "646", "648", "649", "650"],
    });
    check(
      "16. job622 cannot be reused",
      h622.ok === false && h622.blocked.reason.includes("historical job id")
    );
    const h649 = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan({ jobId: "649" }),
      expected: expectations(),
      confirmed: true,
      historyJobIds: ["622", "641", "646", "648", "649", "650"],
    });
    check(
      "16. job649 cannot be reused",
      h649.ok === false && h649.blocked.reason.includes("historical job id")
    );
    const funded = await runMainTrackUserHire({
      deps: nonceSafeDeps().deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "16. no private key in response",
      !/(private[_ ]?key|mnemonic|seed[_ ]?phrase|wallet_password)/i.test(JSON.stringify(funded))
    );
  }

  // 17. Typed nonce error.
  {
    const err = new MainTrackNonceTooLowError();
    check(
      "17. typed nonce error",
      err instanceof Error && err.name === "MainTrackNonceTooLowError"
    );
  }

  // 18. Bigint normalization (explicit, no Number mixing).
  {
    const norm = normalizeReceipt({
      status: "0x1",
      blockNumber: "0x10",
      transactionIndex: "0x1",
      gasUsed: "0x100",
      effectiveGasPrice: "0x200",
    });
    check("18. normalize status success", norm.status === "success");
    check("18. blockNumber bigint", norm.blockNumber === 16n);
    check("18. transactionIndex bigint", norm.transactionIndex === 1n);
    check("18. gasUsed bigint", norm.gasUsed === 256n);
    check("18. effectiveGasPrice bigint", norm.effectiveGasPrice === 512n);
    check("18. toBigintSafe string hex", toBigintSafe("0x10") === 16n);
    check("18. toBigintSafe safe number", toBigintSafe(123) === 123n);
    check("18. toBigintSafe malformed -> null", toBigintSafe("abc") === null);
    check("18. toBigintSafe null -> null", toBigintSafe(null) === null);
    const nonObj = normalizeReceipt(null);
    check(
      "18. normalize null -> unknown/null fields",
      nonObj.status === "unknown" && nonObj.blockNumber === null
    );
  }

  // 19. Reliable receipt reader: isolates primary BigInt-mix behind a fallback.
  {
    const mined = await createReliableReceiptReader({
      read: async () => ({ status: "success", blockNumber: "0x10" }),
    })("0xa1");
    check(
      "19. mined normalized",
      (mined as { status?: string })?.status === "success" &&
        (mined as { blockNumber?: bigint })?.blockNumber === 16n
    );
    const pending = await createReliableReceiptReader({ read: async () => null })("0xa2");
    check("19. pending -> null", pending === null);
    const pendingWording = await createReliableReceiptReader({
      read: async () => {
        throw new Error(
          'Transaction receipt with hash "0x…" could not be found. The Transaction may not be processed on a block yet.'
        );
      },
    })("0xa3");
    check("19. pending wording -> null", pendingWording === null);
    const bigintPrimary = await createReliableReceiptReader({
      read: async () => {
        throw new Error("Cannot mix BigInt and other types, use explicit conversions");
      },
      fallback: async () => ({ status: "success", gasUsed: "0x100" }),
    })("0xa4");
    check(
      "19. BigInt-mix primary -> fallback success",
      (bigintPrimary as { status?: string })?.status === "success" &&
        (bigintPrimary as { gasUsed?: bigint })?.gasUsed === 256n
    );
    const reverted = await createReliableReceiptReader({
      read: async () => ({ status: "reverted" }),
    })("0xa5");
    check("19. reverted normalized", (reverted as { status?: string })?.status === "reverted");
    const bothFail = await createReliableReceiptReader({
      read: async () => {
        throw new Error("Cannot mix BigInt and other types, use explicit conversions");
      },
      fallback: async () => {
        throw new Error("Cannot mix BigInt and other types, use explicit conversions");
      },
    })("0xa6");
    check("19. both fail -> null (isolated, bounded poller will time out)", bothFail === null);
    const noFallback = await createReliableReceiptReader({
      read: async () => {
        throw new Error("rpc polling error");
      },
    })("0xa7");
    check("19. primary error no fallback -> null", noFallback === null);
  }

  // 20. Executor with reliable reader: BigInt-mix primary at one tx -> fallback succeeds -> funded.
  {
    let primaryFails = true;
    const reader = createReliableReceiptReader({
      read: async () => {
        if (primaryFails) {
          primaryFails = false;
          throw new Error("Cannot mix BigInt and other types, use explicit conversions");
        }
        return { status: "success", blockNumber: "0x10" };
      },
      fallback: async () => ({ status: "success" }),
    });
    const raw = rawRequest();
    let broadcastCount = 0;
    const provider = createNonceSafeEip1193Provider({
      request: raw.request,
      getPendingNonce: async () => 0n,
      broadcast: async () => {
        broadcastCount += 1;
        return "0x" + broadcastCount.toString(16).padStart(64, "0");
      },
      getReceipt: reader,
      receiptMaxAttempts: 3,
      receiptIntervalMs: 1,
    });
    const deps = { request: provider, readJob: async () => fundedJob() };
    const out = await runMainTrackUserHire({
      deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "20. reliable reader funds despite primary BigInt-mix",
      out.ok === true && out.stage === "funded" && broadcastCount === 5
    );
  }

  // 21. Executor with reliable reader but NO fallback: primary BigInt-mix -> blocked, no next step, no rebroadcast.
  {
    const reader = createReliableReceiptReader({
      read: async () => {
        throw new Error("Cannot mix BigInt and other types, use explicit conversions");
      },
    });
    const raw = rawRequest();
    let broadcastCount = 0;
    const provider = createNonceSafeEip1193Provider({
      request: raw.request,
      getPendingNonce: async () => 0n,
      broadcast: async () => {
        broadcastCount += 1;
        return "0x" + broadcastCount.toString(16).padStart(64, "0");
      },
      getReceipt: reader,
      receiptMaxAttempts: 2,
      receiptIntervalMs: 1,
    });
    const deps = { request: provider, readJob: async () => fundedJob() };
    const out = await runMainTrackUserHire({
      deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "21. no fallback -> blocked timeout, no next step, no rebroadcast",
      out.ok === false && out.blocked.stage === "transaction" && broadcastCount === 1
    );
  }

  // 22. X.144: reliable Main Track RPC wiring (PublicNode, never the seed RPC).
  {
    const cfg = createMainTrackNetworkConfig();
    check(
      "22. network config uses PublicNode RPC",
      cfg.rpcUrl === MAIN_TRACK_PUBLIC_RPC &&
        cfg.rpcUrl === "https://bsc-testnet-rpc.publicnode.com"
    );
    check("22. network config chain 97", cfg.chainId === 97);
    check("22. network config usePaymaster false", cfg.usePaymaster === false);
    check(
      "22. public rpc is the reliable PublicNode endpoint (no seed RPC)",
      !/bnbchain\.org|data-seed/.test(cfg.rpcUrl)
    );
  }

  // 23. X.144: headless provider chains EVERY chain operation through ONE
  // injected public client (nonce, gas price, estimateGas, send, receipt).
  {
    const calls: string[] = [];
    let nonceCalls = 0;
    let gasPriceCalls = 0;
    let estimateCalls = 0;
    let sendCalls = 0;
    let receiptCalls = 0;
    const signRequests: Array<Record<string, unknown>> = [];
    const fakeClient = {
      getTransactionCount: async () => {
        nonceCalls += 1;
        return 0;
      },
      getGasPrice: async () => {
        gasPriceCalls += 1;
        return 1n;
      },
      estimateGas: async () => {
        estimateCalls += 1;
        return 100000n;
      },
      sendRawTransaction: async () => {
        sendCalls += 1;
        return "0x" + sendCalls.toString(16).padStart(64, "0");
      },
      getTransactionReceipt: async () => {
        receiptCalls += 1;
        return { status: "success", blockNumber: "0x10" };
      },
    } as never;
    const raw: MainTrackUserHireDeps["request"] = async (method, _params) => {
      calls.push(method);
      if (method === "eth_requestAccounts") return [USER];
      if (method === "eth_chainId") return "0x61";
      if (method === "eth_sendTransaction") {
        return "0x" + "dd".repeat(32);
      }
      return null;
    };
    const signer: MainTrackSigner = {
      sign: async (req) => {
        signRequests.push({ ...req });
        return { rawTransaction: ("0x" + "ee".repeat(32)) as `0x${string}` };
      },
    };
    const provider = createMainTrackHeadlessProvider({
      request: raw,
      signer,
      publicClient: fakeClient as PublicClient,
      receiptMaxAttempts: 2,
      receiptIntervalMs: 1,
    });
    const deps = { request: provider, readJob: async () => fundedJob() };
    const out = await runMainTrackUserHire({
      deps,
      plan: buildPlan(),
      expected: expectations(),
      confirmed: true,
    });
    check(
      "23. one injected client used for all chain ops (funded)",
      out.ok === true && out.stage === "funded"
    );
    check("23. nonce read via injected client", nonceCalls === 1);
    check("23. gas price via injected client", gasPriceCalls === 5);
    check("23. estimateGas via injected client", estimateCalls === 5);
    check("23. sendRawTransaction via injected client", sendCalls === 5);
    check("23. receipt read via injected client", receiptCalls === 5);
    check(
      "23. signer got bigint nonce/gas/gasPrice (no Number mixing)",
      signRequests.length === 5 &&
        signRequests.every(
          (r) =>
            typeof r.nonce === "bigint" &&
            typeof r.gas === "bigint" &&
            typeof r.gasPrice === "bigint"
        )
    );
    check(
      "23. signer never receives a private key",
      signRequests.every(
        (r) =>
          !/private|key|secret|password|mnemonic/i.test(
            JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
          )
      )
    );
  }

  // 24. X.144: stage-annotated errors pin the exact stage (X.143 regression).
  {
    // 24a. getPendingNonce BigInt-mix -> "nonce read failed", NO broadcast.
    {
      const raw = rawRequest();
      const provider = createNonceSafeEip1193Provider({
        request: raw.request,
        getPendingNonce: async () => {
          throw new Error("Cannot mix BigInt and other types, use explicit conversions");
        },
        broadcast: async () => {
          throw new Error("must not broadcast");
        },
        getReceipt: async () => ({ status: "success" }),
      });
      const out = await runMainTrackUserHire({
        deps: { request: provider, readJob: async () => fundedJob() },
        plan: buildPlan(),
        expected: expectations(),
        confirmed: true,
      });
      check(
        "24a. nonce read BigInt-mix -> 'nonce read failed', no broadcast",
        out.ok === false &&
          out.blocked.reason.includes("nonce read failed") &&
          out.blocked.reason.includes("BigInt") &&
          out.blocked.stage === "transaction"
      );
    }
    // 24b. broadcast BigInt-mix -> "broadcast failed", STOP, no retry/rebroadcast.
    {
      let broadcasts = 0;
      const raw = rawRequest();
      const provider = createNonceSafeEip1193Provider({
        request: raw.request,
        getPendingNonce: async () => 0n,
        broadcast: async () => {
          broadcasts += 1;
          throw new Error("Cannot mix BigInt and other types, use explicit conversions");
        },
        getReceipt: async () => ({ status: "success" }),
      });
      const out = await runMainTrackUserHire({
        deps: { request: provider, readJob: async () => fundedJob() },
        plan: buildPlan(),
        expected: expectations(),
        confirmed: true,
      });
      check(
        "24b. broadcast BigInt-mix -> 'broadcast failed', no retry/rebroadcast",
        out.ok === false &&
          out.blocked.reason.includes("broadcast failed") &&
          out.blocked.reason.includes("BigInt") &&
          broadcasts === 1
      );
    }
    // 24c. X.143 receipt path still isolated behind the X.142 reader (PublicNode primary).
    {
      const primaryClient = {
        getTransactionReceipt: async () => {
          throw new Error("Cannot mix BigInt and other types, use explicit conversions");
        },
      } as never;
      const reader = createMainTrackReceiptReader({
        publicClient: primaryClient as PublicClient,
        fallback: async () => ({ status: "success", gasUsed: "0x100" }),
      });
      const r1 = await reader("0xb1");
      check(
        "24c. main-track reader PublicNode primary BigInt-mix -> fallback",
        (r1 as { status?: string })?.status === "success" &&
          (r1 as { gasUsed?: bigint })?.gasUsed === 256n
      );
    }
  }

  // 25. X.144: no BigInt mixing in the headless executor path (pure, bigint-safe).
  {
    const n = toBigintSafe("0x7b");
    check("25. toBigintSafe hex -> bigint", n === 123n);
    const nr = normalizeReceipt({ status: "0x1", blockNumber: 16, transactionIndex: "0x0" });
    check(
      "25. normalize receipt number/hex -> bigint fields",
      nr.status === "success" && nr.blockNumber === 16n && nr.transactionIndex === 0n
    );
    const cfg = createMainTrackNetworkConfig();
    check(
      "25. no silent Number conversion in config/plan",
      typeof cfg.chainId === "number" && typeof MAIN_TRACK_PAYMENT_TOKEN === "string"
    );
  }

  // 26. X.146: signed-transaction encoding + broadcast-transport separation.
  {
    // 26a. Legacy EIP-155 serialization is valid and recovers the signer; the
    // app never receives the private key (deterministic test fixture only).
    {
      const key: `0x${string}` =
        "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
      const acct = privateKeyToAccount(key);
      const raw = await acct.signTransaction({
        to: MAIN_TRACK_COMMERCE,
        data: ("0x" + "ab".repeat(32)) as `0x${string}`,
        value: 0n,
        gas: 100000n,
        gasPrice: 100000000n,
        nonce: 0,
        chainId: 97,
      });
      const parsed = parseTransaction(raw as never);
      check(
        "26a. legacy serialization parses",
        parsed.type === "legacy" &&
          parsed.nonce === 0 &&
          parsed.gas === 100000n &&
          parsed.gasPrice === 100000000n
      );
      const v = parsed.v;
      check("26a. EIP-155 chainId 97 from v", typeof v === "bigint" && (v - 35n) / 2n === 97n);
      const rec = await recoverTransactionAddress({ serializedTransaction: raw as never });
      check("26a. ECDSA recovery matches signer", rec.toLowerCase() === acct.address.toLowerCase());
      check(
        "26a. no EIP-7702/type-4 envelope",
        parsed.type === "legacy" && !("authorizationList" in parsed)
      );
      check("26a. signer address not a private key", !/^0x[0-9a-f]{64}$/i.test(acct.address));
    }
    // 26b. Broadcast transport separation: reads (gasPrice/estimateGas) go to
    // the read client; sendRawTransaction goes to the WALLET's transport.
    {
      let readGasPrice = 0;
      let readEstimate = 0;
      let transportSends = 0;
      const readClient = {
        getGasPrice: async () => {
          readGasPrice += 1;
          return 1n;
        },
        estimateGas: async () => {
          readEstimate += 1;
          return 100000n;
        },
        sendRawTransaction: async () => {
          throw new Error("read client must not broadcast");
        },
        getTransactionCount: async () => 0,
        getTransactionReceipt: async () => ({ status: "success" }),
      } as never;
      const transport = {
        sendRawTransaction: async (raw: `0x${string}`) => {
          transportSends += 1;
          if (!raw.startsWith("0x") || raw.length < 4) throw new Error("malformed raw");
          return ("0x" + transportSends.toString(16).padStart(64, "0")) as `0x${string}`;
        },
      };
      const broadcast = createMainTrackBroadcast({
        signer: {
          sign: async (_tx) => ({ rawTransaction: ("0x" + "cc".repeat(32)) as `0x${string}` }),
        },
        publicClient: readClient as PublicClient,
        transport,
      });
      const hash = await broadcast(
        { from: USER, to: MAIN_TRACK_COMMERCE, data: "0x00", value: 0n, chainId: 97 },
        0n
      );
      check("26b. gasPrice read from read client", readGasPrice === 1);
      check("26b. estimateGas read from read client", readEstimate === 1);
      check("26b. sendRawTransaction via wallet transport", transportSends === 1);
      check("26b. hash returned from transport", typeof hash === "string" && hash.startsWith("0x"));
    }
    // 26c. Headless provider uses the wallet transport for broadcast (send via
    // transport, reads via read client, receipts via read client).
    {
      let sendCalls = 0;
      let readReceipts = 0;
      const transport = {
        sendRawTransaction: async (_raw: `0x${string}`) => {
          sendCalls += 1;
          return ("0x" + sendCalls.toString(16).padStart(64, "0")) as `0x${string}`;
        },
      };
      const readClient = {
        getTransactionCount: async () => 0,
        getGasPrice: async () => 1n,
        estimateGas: async () => 100000n,
        sendRawTransaction: async () => {
          throw new Error("read client must not broadcast");
        },
        getTransactionReceipt: async () => {
          readReceipts += 1;
          return { status: "success", blockNumber: "0x10" };
        },
      } as never;
      const raw: MainTrackUserHireDeps["request"] = async (method, _params) => {
        if (method === "eth_requestAccounts") return [USER];
        if (method === "eth_chainId") return "0x61";
        if (method === "eth_sendTransaction") return "0x" + "dd".repeat(32);
        return null;
      };
      const provider = createMainTrackHeadlessProvider({
        request: raw,
        signer: {
          sign: async () => ({ rawTransaction: ("0x" + "ee".repeat(32)) as `0x${string}` }),
        },
        publicClient: readClient as PublicClient,
        transport,
        receiptMaxAttempts: 2,
        receiptIntervalMs: 1,
      });
      const deps = { request: provider, readJob: async () => fundedJob() };
      const out = await runMainTrackUserHire({
        deps,
        plan: buildPlan(),
        expected: expectations(),
        confirmed: true,
      });
      check("26c. funded via wallet transport", out.ok === true && out.stage === "funded");
      check("26c. all 5 broadcasts via wallet transport", sendCalls === 5);
      check("26c. receipts read via read client", readReceipts === 5);
    }
    // 26d. Provider rejection / transport failure: user rejects -> blocked, no
    // further send, no retry/rebroadcast.
    {
      let sends = 0;
      const transport = {
        sendRawTransaction: async () => {
          sends += 1;
          throw new Error("user rejected transaction");
        },
      };
      const readClient = {
        getTransactionCount: async () => 0,
        getGasPrice: async () => 1n,
        estimateGas: async () => 100000n,
        getTransactionReceipt: async () => ({ status: "success" }),
      } as never;
      const raw: MainTrackUserHireDeps["request"] = async (method, _params) => {
        if (method === "eth_requestAccounts") return [USER];
        if (method === "eth_chainId") return "0x61";
        if (method === "eth_sendTransaction") return "0x" + "dd".repeat(32);
        return null;
      };
      const provider = createMainTrackHeadlessProvider({
        request: raw,
        signer: {
          sign: async () => ({ rawTransaction: ("0x" + "ee".repeat(32)) as `0x${string}` }),
        },
        publicClient: readClient as PublicClient,
        transport,
      });
      const out = await runMainTrackUserHire({
        deps: { request: provider, readJob: async () => fundedJob() },
        plan: buildPlan(),
        expected: expectations(),
        confirmed: true,
      });
      check(
        "26d. wallet rejection -> blocked, single send, no retry/rebroadcast",
        out.ok === false && out.blocked.stage === "transaction" && sends === 1
      );
    }
    // 26e. Malformed raw from a transport -> blocked (no second send).
    {
      let sends = 0;
      const transport = {
        sendRawTransaction: async (raw: `0x${string}`) => {
          sends += 1;
          if (raw === "0x00") throw new Error("malformed raw transaction");
          return ("0x" + sends.toString(16).padStart(64, "0")) as `0x${string}`;
        },
      };
      const readClient = {
        getTransactionCount: async () => 0,
        getGasPrice: async () => 1n,
        estimateGas: async () => 100000n,
        getTransactionReceipt: async () => ({ status: "success" }),
      } as never;
      let sendMalformed = true;
      const rawReq: MainTrackUserHireDeps["request"] = async (method, _params) => {
        if (method === "eth_requestAccounts") return [USER];
        if (method === "eth_chainId") return "0x61";
        return null;
      };
      const signer: MainTrackSigner = {
        sign: async () => {
          const rawHex: `0x${string}` = sendMalformed
            ? "0x00"
            : (("0x" + "ee".repeat(32)) as `0x${string}`);
          sendMalformed = false;
          return { rawTransaction: rawHex };
        },
      };
      const provider = createMainTrackHeadlessProvider({
        request: rawReq,
        signer,
        publicClient: readClient as PublicClient,
        transport,
      });
      const out = await runMainTrackUserHire({
        deps: { request: provider, readJob: async () => fundedJob() },
        plan: buildPlan(),
        expected: expectations(),
        confirmed: true,
      });
      check(
        "26e. malformed raw -> blocked, no rebroadcast",
        out.ok === false && out.blocked.stage === "transaction" && sends === 1
      );
    }
  }

  // 27. X.148: forensics-oriented checks (decode round-trip, ABI dynamic offsets,
  // clean description, RLP validity, no-broadcast invariant).
  {
    // 27a. createJob calldata decode round-trip.
    {
      const built = buildMainTrackUserHireCalls({
        provider: SELLER,
        description: JSON.stringify({
          version: 1,
          task: "t",
          price: PRICE,
          currency: MAIN_TRACK_PAYMENT_TOKEN,
          chain_id: 97,
        }),
        budget: BigInt(PRICE),
        expiredAt: 2000000000n,
        jobId: 900n,
        chainId: 97,
      });
      const d = decodeFunctionData({
        abi: parseAbi([
          "function createJob(address provider,address evaluator,uint256 expiredAt,string description,address hook) returns (uint256)",
        ]),
        data: built.calls[0]!.data as `0x${string}`,
      });
      check("27a. createJob decode functionName", d.functionName === "createJob");
      const a = d.args;
      check(
        "27a. createJob args match",
        a[0] !== undefined &&
          a[2] !== undefined &&
          a[4] !== undefined &&
          String(a[0]).toLowerCase() === SELLER.toLowerCase() &&
          a[2] === 2000000000n &&
          String(a[4]).toLowerCase() === MAIN_TRACK_ROUTER.toLowerCase()
      );
    }
    // 27b. ABI dynamic-offset validation for the description string.
    {
      const built = buildMainTrackUserHireCalls({
        provider: SELLER,
        description: "abc",
        budget: BigInt(PRICE),
        expiredAt: 2000000000n,
        jobId: 901n,
        chainId: 97,
      });
      const buf = Buffer.from(built.calls[0]!.data.slice(2), "hex");
      const offset = Number(buf.readUInt32BE(4 + 3 * 32 + 28)); // description offset (4th arg), relative to args start (after 4-byte selector)
      check("27a/27b. description offset == 160 (0xa0)", offset === 160);
      const abs = 4 + offset; // absolute position of the description tail (length word)
      const descLen = Number(buf.readUInt32BE(abs + 28));
      check(
        "27a/27b. description length word matches",
        descLen === 3 && buf.slice(abs + 32, abs + 32 + 3).toString("utf8") === "abc"
      );
    }
    // 27c. Description forensics: clean ASCII, no control/null bytes.
    {
      const desc = JSON.stringify({
        chain_id: 97,
        price: PRICE,
        task: "Produce a deterministic BSC testnet grid-strategy report; no trading or transaction execution.",
        terms: { deliverables: "JSON analysis report" },
      });
      const bytes = Buffer.from(desc, "utf8");
      let clean = true;
      for (const b of bytes) if (b === 0 || b < 0x20) clean = false;
      check(
        "27c. description is clean ASCII (no control/null)",
        clean && bytes.every((b) => b <= 0x7f)
      );
      check("27c. description price == 1 U", desc.includes(`"price":"${PRICE}"`));
    }
    // 27d. RLP length consistency + EIP-155 chainId (viem round-trip).
    {
      const key: `0x${string}` =
        "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
      const acct = privateKeyToAccount(key);
      const raw = await acct.signTransaction({
        to: MAIN_TRACK_COMMERCE,
        data: "0xabcd",
        value: 0n,
        gas: 50000n,
        gasPrice: 100000000n,
        nonce: 0,
        chainId: 97,
      });
      const p = parseTransaction(raw as never);
      check(
        "27d. RLP parse + EIP-155 chainId 97",
        typeof p.v === "bigint" && (p.v - 35n) / 2n === 97n
      );
    }
    // 27e. no-broadcast invariant: the X.148 forensic script must not invoke any
    // broadcast method.
    {
      const { readFileSync } = await import("node:fs");
      let src = "";
      try {
        src = readFileSync(
          "C:/bnb-agent-marketplace/services/v2-seller/x148-transaction-forensics.mjs",
          "utf8"
        );
      } catch {
        src = "";
      }
      const forbidden =
        /(eth_sendTransaction\(|eth_sendRawTransaction\(|\.sendRawTransaction\(|waitForTransactionReceipt\()/;
      check(
        "27e. forensic script has no broadcast invocations",
        src.length > 0 && !forbidden.test(src)
      );
    }
  }

  if (failures === 0) {
    console.log("X.139 main-track-user-wallet verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.139 main-track-user-wallet verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
