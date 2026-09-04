/**
 * X.236-P2 — BNB Chain Mainnet (chain 56) ERC-8183 seller runtime.
 *
 * Adapted from the PROVEN Testnet seller (`services/v2-seller/seller.ts`) — same
 * architecture (SDK wallet + NegotiationHandler + http server) but pinned to
 * chain 56 with the VERIFIED Mainnet address table from mainnet-config.ts.
 *
 * SAFETY CONTRACT:
 *   - The Mainnet seller NEVER falls back to the Testnet keystore.
 *   - MAINNET_HIRE_ENABLED defaults to false; when false, /negotiate returns
 *     a truthful "unavailable" response (no signing, no quote, no write.
 *   - MAINNET_AGENT_ID remains empty until a future ERC-8004 registration.
 *   - No private key is ever printed; the keystore is encrypted Keystore V3.
 *   - No blockchain write occurs in this module.
 *   - No fundedJobWatcher — no Mainnet jobs exist.
 */

import { loadEnv, EVMWalletProvider } from "@bnbagent/sdk";
import { ERC8183Client, NegotiationHandler } from "@bnbagent/sdk/erc8183";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import {
  MAINNET_CHAIN_ID,
  MAINNET_COMMERCE,
  MAINNET_REGISTRY,
  MAINNET_ROUTER,
  MAINNET_POLICY,
  MAINNET_PAYMENT_TOKEN,
  isMainnetHireEnabled,
} from "./mainnet-config.ts";

const repositoryRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
loadEnv(repositoryRoot);

// ============================================================================
// STARTUP GATES — hard-fail on any unsafe configuration.
// ============================================================================

if (process.env.NETWORK !== "bnb-mainnet") {
  throw new Error("NETWORK must be bnb-mainnet for the Mainnet seller (refusing to start)");
}

if (!process.env.WALLET_PASSWORD) {
  throw new Error(
    "WALLET_PASSWORD is required for EVMWalletProvider. Provide it as a runtime secret (never committed, never printed)."
  );
}

// ============================================================================
// KEYSTORE — separate Mainnet path. NEVER falls back to the Testnet keystore.
// ============================================================================

const MAINNET_KEYSTORE_DIR =
  process.env.MAINNET_KEYSTORE_DIR ?? join(homedir(), ".bnbagent-mainnet");

// The owner address is the SAME public EVM address as the Testnet seller
// (X.235-P2 user decision). The keystore is chain-agnostic: the same key
// pair signs on both chain 97 and chain 56. The SEPARATE Mainnet keystore
// path prevents the two sellers from sharing mutable state.
const OWNER_ADDRESS =
  process.env.MAINNET_OWNER_ADDRESS ?? "0xB0f7681668f916eEd97dA066D31aA295D34727c0";
const keystorePath = join(MAINNET_KEYSTORE_DIR, `${OWNER_ADDRESS}.json`);
if (!existsSync(keystorePath)) {
  throw new Error(
    `Mainnet keystore not found at ${keystorePath}. ` +
      "The encrypted Keystore V3 must be manually copied to the Mainnet keystore path " +
      "(user-approved operation). Refusing to start — the Mainnet seller NEVER falls back " +
      "to the Testnet keystore."
  );
}

// ============================================================================
// WALLET — loaded from the SEPARATE Mainnet keystore.
// ============================================================================

const wallet = new EVMWalletProvider({
  password: process.env.WALLET_PASSWORD!,
  address: OWNER_ADDRESS,
  walletsDir: MAINNET_KEYSTORE_DIR,
});

if (wallet.address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
  throw new Error(
    `Wallet mismatch: keystore resolved to ${wallet.address}, expected ${OWNER_ADDRESS}. Refusing to start.`
  );
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const AGENT_URL = process.env.MAINNET_AGENT_URL ?? "http://127.0.0.1:3001";
const SERVICE_PRICE = BigInt(process.env.MAINNET_SERVICE_PRICE ?? "1000000000000000000");
const mainnetHireEnabled = isMainnetHireEnabled(process.env);
const MAINNET_AGENT_ID = process.env.MAINNET_AGENT_ID ?? "";

if (mainnetHireEnabled && !MAINNET_AGENT_ID) {
  throw new Error(
    "MAINNET_HIRE_ENABLED=true requires MAINNET_AGENT_ID (from a successful ERC-8004 registration). " +
      "The Mainnet seller refuses to negotiate without a registered agent identity."
  );
}

console.log(
  `[mainnet-seller] chain: ${MAINNET_CHAIN_ID} | owner: ${wallet.address} | hire: ${mainnetHireEnabled ? "ENABLED" : "DISABLED"} | agentId: ${MAINNET_AGENT_ID || "(not registered)"} | keystore: ${MAINNET_KEYSTORE_DIR}`
);

// ============================================================================
// ERC-8183 CLIENT — Mainnet chain 56 only.
// SDK NetworkConfig pinned to the verified Mainnet address table.
// ============================================================================

const networkConfig = {
  name: "bsc",
  chainId: MAINNET_CHAIN_ID,
  rpcUrl: process.env.MAINNET_RPC_URL ?? "https://bsc-rpc.publicnode.com",
  usePaymaster: false,
  registryContract: MAINNET_REGISTRY,
  commerceContract: MAINNET_COMMERCE,
  routerContract: MAINNET_ROUTER,
  policyContract: MAINNET_POLICY,
  paymentTokenContract: MAINNET_PAYMENT_TOKEN,
};

const erc8183Client = await ERC8183Client.create({
  walletProvider: wallet,
  network: networkConfig as never,
});
const handler = await NegotiationHandler.fromErc8183Client(erc8183Client, {
  servicePrice: String(SERVICE_PRICE),
  walletProvider: wallet,
});

// ============================================================================
// HTTP SERVER
// ============================================================================

const server = createServer(async (req, res) => {
  // GET /health — safe public operational info only.
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        chain: MAINNET_CHAIN_ID,
        seller: wallet.address,
        hire: mainnetHireEnabled ? "enabled" : "disabled",
        agentId: MAINNET_AGENT_ID || null,
      })
    );
    return;
  }

  // GET /.well-known/agent-card.json — public card (no secrets).
  if (req.url === "/.well-known/agent-card.json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name: "BNB Agent Studio Mainnet Seller",
        description: "BSC Mainnet ERC-8183 service seller — real negotiated quote service, mainnet",
        endpoints: [
          { name: "ERC-8183", endpoint: AGENT_URL, version: "1.0" },
          { name: "A2A", endpoint: `${AGENT_URL}/.well-known/agent-card.json`, version: "1.0" },
        ],
        chainId: MAINNET_CHAIN_ID,
      })
    );
    return;
  }

  // POST /negotiate — Mainnet quote (chain 56).
  // When MAINNET_HIRE_ENABLED=false, return a truthful unavailable response.
  if (req.url === "/negotiate" && req.method === "POST") {
    if (!mainnetHireEnabled) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          response: {
            accepted: false,
            reason:
              "Mainnet hiring is not yet enabled. Commercial hire is currently available on BSC Testnet (chain 97) only.",
          },
          chain_id: MAINNET_CHAIN_ID,
          verifying_contract: MAINNET_COMMERCE,
          negotiation_hash: "0x" + "00".repeat(32),
          provider_sig: null,
        })
      );
      return;
    }

    // MAINNET_HIRE_ENABLED=true (future path): delegate to the proven handler.
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const result = await handler.negotiate(JSON.parse(body));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.toDict()));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid negotiation request" }));
    }
    return;
  }

  // GET /job/{id}/response — deliverable (future, requires funded Mainnet jobs).
  if (req.method === "GET") {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not implemented for Mainnet (no funded jobs exist yet)" }));
    return;
  }

  res.writeHead(404).end();
});

const PORT = Number(process.env.MAINNET_SELLER_PORT ?? 3001);
server.listen(PORT, () =>
  console.log(
    `[mainnet-seller] listening on http://localhost:${PORT} | chain 56 | https://inbook-y1-plus.tail3e3640.ts.net:8443`
  )
);
