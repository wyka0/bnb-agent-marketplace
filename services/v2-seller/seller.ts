import { EVMWalletProvider, loadEnv, ERC8004Agent } from "@bnbagent/sdk";
import {
  ERC8183Client,
  ERC8183JobOps,
  fundedJobWatcher,
  NegotiationHandler,
} from "@bnbagent/sdk/erc8183";
import { LocalStorageProvider } from "@bnbagent/sdk/storage";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const repositoryRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
loadEnv(repositoryRoot);

if (process.env.NETWORK !== "bsc-testnet") {
  throw new Error("NETWORK must be bsc-testnet for testnet seller");
}
if (!process.env.WALLET_PASSWORD) {
  throw new Error("WALLET_PASSWORD is required for EVMWalletProvider");
}
const privateKey = process.env.PRIVATE_KEY;
if (!EVMWalletProvider.keystoreExists() && !privateKey) {
  throw new Error("PRIVATE_KEY is required for first-run Keystore V3 creation");
}

const wallet = new EVMWalletProvider({
  password: process.env.WALLET_PASSWORD!,
  privateKey: privateKey || undefined,
  address: "0xB0f7681668f916eEd97dA066D31aA295D34727c0",
});

/** X.221: the seller's ERC-8004 read network (SDK preset + env RPC override). */
function createSellerNetworkConfig() {
  // The SDK preset reads RPC_URL_BSC_TESTNET / RPC_URL from the environment
  // (set to PublicNode in .env.local); chain stays bsc-testnet (97).
  return "bsc-testnet";
}

/** X.221 Task 06: the ERC-8183 read network for security-posture analysis (read-only). */
const COMMERCE_ADDR = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE";
const ROUTER_ADDR = "0xD7d36D66d2F1B608A0F943f722D27e3744f66F25";
const POLICY_ADDR = "0xd6a4217588F6B1F5657a92A3e94E6422aD771cEA";
import { createMainTrackNetworkConfig as createMainTrackSellerNetwork } from "../../packages/integrations/dist/altana/v2/main-track-user-wallet.js";
const agentUrl = process.env.ERC8183_AGENT_URL || "http://127.0.0.1:3000";

if (wallet.source === "imported") {
  console.log(`seller wallet imported and encrypted: ${wallet.address}`);
}
const jobOps = await ERC8183JobOps.create({
  walletProvider: wallet,
  network: "bsc-testnet",
  storageProvider: new LocalStorageProvider("./.agent-data"),
  servicePrice: BigInt(process.env.ERC8183_SERVICE_PRICE ?? "1000000000000000000"),
  agentUrl,
  allowUnsignedJobs: false,
});
const erc8183Client = await ERC8183Client.create({
  walletProvider: wallet,
  network: "bsc-testnet",
});
const handler = await NegotiationHandler.fromErc8183Client(erc8183Client, {
  servicePrice: process.env.ERC8183_SERVICE_PRICE!,
  walletProvider: wallet,
});

const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ status: "ok", chain: 97, seller: wallet.address }));
    return;
  }
  if (req.url === "/.well-known/agent-card.json") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        name: "BNB Agent Studio v2 Testnet Seller",
        description:
          "BSC Testnet ERC-8183 service seller — real negotiated quote service, testnet-only",
        endpoints: [
          { name: "ERC-8183", endpoint: agentUrl, version: "1.0" },
          { name: "A2A", endpoint: `${agentUrl}/.well-known/agent-card.json`, version: "1.0" },
        ],
        chainId: 97,
      })
    );
    return;
  }
  if (req.url === "/negotiate" && req.method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const result = await handler.negotiate(JSON.parse(body));
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(result.toDict()));
    } catch {
      res
        .writeHead(400, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: "invalid negotiation request" }));
    }
    return;
  }
  if (req.method === "GET") {
    const responseMatch = /^\/job\/(\d+)\/response$/.exec(req.url ?? "");
    if (responseMatch) {
      const result = await jobOps.getResponse(Number(responseMatch[1]));
      if (!result.success) {
        res
          .writeHead(404, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: result.error ?? "not found" }));
        return;
      }
      const { success: _success, ...manifest } = result;
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(manifest));
      return;
    }
  }
  res.writeHead(404).end();
});
server.listen(3000, () => console.log("seller listening on http://localhost:3000"));

/**
 * X.221 Task 05 — deterministic discovery fulfillment. Reads REAL registry
 * data only (8004scan indexer enumeration + on-chain owner verification via
 * ERC8004Agent.getAgentInfo) and returns a shortlist whose every field is
 * sourced from the registry/indexer record. No fabricated market data, no
 * unsupported claims, no on-chain writes. Falls back to the plain
 * acknowledgment only if the registry read fails (honest degradation).
 */
async function discoveryShortlist(limit: number, keyword: string | null): Promise<string> {
  const registry = await ERC8004Agent.create({
    walletProvider: wallet,
    network: createSellerNetworkConfig(),
  });
  const page = await registry.getAllAgents(100, 0);
  const items = (page.items ?? []) as Array<Record<string, unknown>>;
  const kw = (keyword ?? "").toLowerCase();
  const scored: Array<Record<string, unknown>> = [];
  for (const it of items) {
    const name = String(it.name ?? "");
    const desc = String(it.description ?? "");
    const text = `${name} ${desc}`.toLowerCase();
    if (kw && !text.includes(kw)) continue;
    scored.push({
      agent_id: it.agent_id,
      token_id: it.token_id,
      name,
      description: desc,
      verified: it.is_verified === true,
      protocols: it.supported_protocols ?? [],
      x402_supported: it.x402_supported === true,
      average_score: it.average_score ?? 0,
      owner_address_indexer: it.owner_address ?? null,
    });
  }
  // deterministic ordering: verified first, then score desc, then token id
  scored.sort((x, y) => {
    const v = Number(y.verified === true) - Number(x.verified === true);
    if (v !== 0) return v;
    const s = Number(y.average_score ?? 0) - Number(x.average_score ?? 0);
    if (s !== 0) return s;
    return Number(x.token_id ?? 0) - Number(y.token_id ?? 0);
  });
  const shortlist = scored.slice(0, limit);
  // On-chain owner verification for the shortlist (real registry reads).
  const verifiedList = [];
  for (const entry of shortlist) {
    try {
      const info = await registry.getAgentInfo(Number(entry.token_id));
      verifiedList.push({
        ...entry,
        owner_onchain: (info as unknown as Record<string, unknown>).owner ?? null,
        owner_match:
          String((info as unknown as Record<string, unknown>).owner ?? "").toLowerCase() ===
          String(entry.owner_address_indexer ?? "").toLowerCase(),
      });
    } catch {
      verifiedList.push({
        ...entry,
        owner_onchain: null,
        owner_match: false,
        note: "on-chain read unavailable",
      });
    }
  }
  return JSON.stringify(
    {
      task: "deterministic agent/opportunity discovery shortlist",
      source: "8004scan indexer (chain 97) + ERC-8004 registry on-chain owner verification",
      generatedAt: new Date().toISOString(),
      criteria: {
        keyword: kw || null,
        limit,
        ordering: "verified desc, average_score desc, token_id asc",
      },
      totalScanned: items.length,
      shortlist: verifiedList,
      limitations:
        "Indexer enumeration covers the first 100 chain-97 records; scores are registry-reported values, not market performance. No market data is fabricated; unverified fields are passed through as reported.",
    },
    null,
    1
  );
}

/**
 * X.221 Task 06 — deterministic security-posture fulfillment. READ-ONLY
 * on-chain analysis of the BSC Testnet ERC-8183 deployment: contract wiring,
 * configuration, job census, and exposure indicators. Every field is a real
 * public view call; no writes, no signing, no exploitation, no fabricated data.
 */
async function securityPostureReport(sampleSize: number, buyer: string | null): Promise<string> {
  const net = createMainTrackSellerNetwork();
  const commerce = (await ERC8183Client.create({ network: net })).commerce;
  const erc = await ERC8183Client.create({ network: net });
  const router = erc.router;
  const policy = erc.policy;

  // --- Contract wiring (public view reads) ---
  const wiring = {
    commerce_paymentToken: await commerce.paymentToken(),
    commerce_platformFeeBp: (await commerce.platformFeeBp()).toString(),
    commerce_platformTreasury: await commerce.platformTreasury(),
    router_commerce: await router.commerce(),
    router_paused: await router.paused(),
    policy_commerce: await policy.commerce(),
    policy_router: await policy.router(),
    policy_disputeWindow_seconds: (await policy.disputeWindow()).toString(),
  };
  const wiringChecks = {
    routerBoundToExpectedCommerce:
      String(wiring.router_commerce).toLowerCase() ===
      String((await commerce.paymentToken()) ? COMMERCE_ADDR : COMMERCE_ADDR).toLowerCase(),
    policyBoundToRouter: String(wiring.policy_router).toLowerCase() === ROUTER_ADDR.toLowerCase(),
    routerNotPaused: wiring.router_paused === false,
    disputeWindowSane:
      Number(wiring.policy_disputeWindow_seconds) > 0 &&
      Number(wiring.policy_disputeWindow_seconds) <= 30 * 86400,
    platformFeeZeroOrSmall: Number(wiring.commerce_platformFeeBp) <= 500,
  };

  // --- Job census (batch reads over a bounded recent window) ---
  const counter = await commerce.jobCounter();
  const total = Number(counter);
  const from = Math.max(1, total - sampleSize + 1);
  const ids: number[] = [];
  for (let id = total; id >= from; id--) ids.push(id);
  const statuses: Record<string, number> = {
    OPEN: 0,
    FUNDED: 0,
    SUBMITTED: 0,
    COMPLETED: 0,
    REJECTED: 0,
    EXPIRED: 0,
  };
  const nowSec = Math.floor(Date.now() / 1000);
  let refundEligibleExpiredFunded = 0;
  let expiredAtMissing = 0;
  const sample = await commerce.getJobsBatch(ids.map((i) => BigInt(i)));
  const jobs = Array.isArray(sample) ? sample : ((sample as Record<string, unknown>)?.jobs ?? []);
  for (const j of jobs as Array<Record<string, unknown>>) {
    const st = Number(j.status ?? 0);
    const name =
      ["OPEN", "FUNDED", "SUBMITTED", "COMPLETED", "REJECTED", "EXPIRED"][st] ?? `UNKNOWN_${st}`;
    statuses[name] = (statuses[name] ?? 0) + 1;
    const expiredAt = Number(j.expiredAt ?? 0);
    if (!expiredAt) {
      expiredAtMissing += 1;
      continue;
    }
    if (st === 1 && expiredAt <= nowSec) refundEligibleExpiredFunded += 1; // FUNDED past expiry → claimRefund-eligible exposure
  }

  // --- Buyer hygiene (only if a buyer address was parsed from the task) ---
  let buyerHygiene = null;
  if (buyer && /^0x[0-9a-fA-F]{40}$/.test(buyer)) {
    try {
      const allowance = await erc.tokenAllowance(buyer, COMMERCE_ADDR);
      const balance = await erc.tokenBalance(buyer);
      buyerHygiene = {
        buyer,
        u_allowance_to_commerce: allowance.toString(),
        u_balance: balance.toString(),
        allowance_exceeds_balance_by_10x: Number(allowance) > Number(balance) * 10,
        note: "allowance vs balance ratio is the hygiene signal; exact-infinity approvals are flagged by the 10x heuristic",
      };
    } catch {
      buyerHygiene = { buyer, note: "allowance/balance read unavailable" };
    }
  }

  // --- Suspicious/inconsistent indicators (deterministic rules) ---
  const indicators: Array<{ id: string; severity: string; observed: string; detail: string }> = [];
  if (!wiringChecks.routerBoundToExpectedCommerce)
    indicators.push({
      id: "W1",
      severity: "high",
      observed: `router.commerce=${wiring.router_commerce}`,
      detail: "router is not bound to the expected Commerce contract",
    });
  if (!wiringChecks.policyBoundToRouter)
    indicators.push({
      id: "W2",
      severity: "high",
      observed: `policy.router=${wiring.policy_router}`,
      detail: "policy is not bound to the router",
    });
  if (!wiringChecks.routerNotPaused)
    indicators.push({
      id: "W3",
      severity: "medium",
      observed: "router.paused=true",
      detail: "router is paused — settlement/dispute flows halted",
    });
  if (refundEligibleExpiredFunded > 0)
    indicators.push({
      id: "E1",
      severity: "info",
      observed: `${refundEligibleExpiredFunded} FUNDED jobs past expiredAt in sample`,
      detail:
        "refund-eligible exposure: expired FUNDED jobs can be reclaimed by their clients via claimRefund",
    });
  if (buyerHygiene && buyerHygiene.allowance_exceeds_balance_by_10x)
    indicators.push({
      id: "A1",
      severity: "low",
      observed: `allowance ${buyerHygiene.u_allowance_to_commerce} vs balance ${buyerHygiene.u_balance}`,
      detail:
        "token allowance to Commerce exceeds balance by >10x — consider reducing to exact needs",
    });
  if (
    Number(wiring.commerce_platformTreasury) === 0 ||
    /dead/i.test(wiring.commerce_platformTreasury)
  )
    indicators.push({
      id: "F1",
      severity: "info",
      observed: `platformTreasury=${wiring.commerce_platformTreasury}, feeBp=${wiring.commerce_platformFeeBp}`,
      detail:
        "zero-fee configuration with placeholder treasury — no fee skimming, but confirm intent",
    });

  return JSON.stringify(
    {
      task: "BSC Testnet ERC-8183 security-posture report",
      source:
        "on-chain public view reads via PublicNode (chain 97): CommerceClient, RouterClient, PolicyClient",
      generatedAt: new Date().toISOString(),
      methodology:
        "deterministic read-only checks; fixed rules; no writes, no signing, no exploitation",
      contracts: { commerce: COMMERCE_ADDR, router: ROUTER_ADDR, policy: POLICY_ADDR },
      wiring,
      wiringChecks,
      jobCensus: {
        totalJobs: total,
        sampleWindow: { from, to: total, size: ids.length },
        statusDistribution: statuses,
        expiredAtMissingCount: expiredAtMissing,
        refundEligibleExpiredFundedInSample: refundEligibleExpiredFunded,
      },
      buyerHygiene,
      indicators,
      limitations: [
        "Read-only analysis from public view calls; no on-chain state was changed.",
        "Job census covers the most recent bounded sample, not all historical jobs.",
        "Refund eligibility is derived from status/expiry fields; it is not a guarantee of reclaim success (contract-level guards may differ).",
        "No financial advice; no trading recommendations; no exploit testing was performed.",
      ],
    },
    null,
    1
  );
}

if (process.env.ERC8183_DISABLE_WATCHER !== "1") {
  await fundedJobWatcher(
    jobOps,
    async (job) => {
      const jobId = job.jobId as number;
      let content = `fulfilled ${jobId}`;
      let metadata: Record<string, unknown> = { model: "v2-seller-v1" };
      // X.221: discovery task → real deterministic registry-derived shortlist.
      const description = String((job as Record<string, unknown>).description ?? "");
      if (description.includes("discovery shortlist")) {
        const limitMatch = /top\s+(\d+)/i.exec(description);
        const kwMatch = /keyword\s+"([^"]+)"/i.exec(description);
        try {
          content = await discoveryShortlist(
            limitMatch ? Math.min(Number(limitMatch[1]), 10) : 5,
            kwMatch ? kwMatch[1] : null
          );
          metadata = { model: "v2-seller-v1", fulfillment: "deterministic-discovery" };
        } catch (e) {
          console.log(
            `discovery fulfillment degraded: ${e instanceof Error ? e.message : String(e)}`
          );
          metadata = {
            model: "v2-seller-v1",
            fulfillment: "acknowledgment-degraded",
            reason: "registry read failed",
          };
        }
      }
      // X.221 Task 06: security-posture task → deterministic read-only on-chain analysis.
      if (description.includes("security-posture")) {
        const sampleMatch = /sample\s+(\d+)/i.exec(description);
        const buyerMatch = /buyer\s+(0x[0-9a-fA-F]{40})/i.exec(description);
        try {
          content = await securityPostureReport(
            sampleMatch ? Math.min(Number(sampleMatch[1]), 100) : 50,
            buyerMatch ? buyerMatch[1] : null
          );
          metadata = { model: "v2-seller-v1", fulfillment: "deterministic-security-posture" };
        } catch (e) {
          console.log(
            `security fulfillment degraded: ${e instanceof Error ? e.message : String(e)}`
          );
          metadata = {
            model: "v2-seller-v1",
            fulfillment: "acknowledgment-degraded",
            reason: "on-chain read failed",
          };
        }
      }
      const result = await jobOps.submitResult(jobId, content, metadata);
      if (!result.success) return { retry: result.retryable === true };
      console.log(`submitted ${jobId} tx=${result.txHash}`);
    },
    { interval: 30 }
  );
}
