import { EVMWalletProvider, loadEnv } from "@bnbagent/sdk";
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

if (process.env.ERC8183_DISABLE_WATCHER !== "1") {
  await fundedJobWatcher(
    jobOps,
    async (job) => {
      const jobId = job.jobId as number;
      const result = await jobOps.submitResult(jobId, `fulfilled ${jobId}`, {
        model: "v2-seller-v1",
      });
      if (!result.success) return { retry: result.retryable === true };
      console.log(`submitted ${jobId} tx=${result.txHash}`);
    },
    { interval: 30 }
  );
}
