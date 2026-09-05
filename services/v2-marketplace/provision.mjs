import { loadEnv, EVMWalletProvider } from "@bnbagent/sdk";
import { generatePrivateKey } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dir = resolve(fileURLToPath(new URL(".", import.meta.url)));
loadEnv(dir);

if (process.env.NETWORK !== "bsc-testnet") throw new Error("NETWORK must be bsc-testnet");
if (!process.env.MARKETPLACE_WALLET_PASSWORD)
  throw new Error("MARKETPLACE_WALLET_PASSWORD missing");

const privateKey = generatePrivateKey();
const wallet = new EVMWalletProvider({
  password: process.env.MARKETPLACE_WALLET_PASSWORD,
  privateKey,
});
const publicClient = createPublicClient({ transport: http("https://bsc-testnet.publicnode.com") });
const chain = await publicClient.getChainId();
if (chain !== 97) throw new Error("CHAIN_MISMATCH");

console.log(
  JSON.stringify({
    marketplaceClient: wallet.address,
    source: wallet.source,
    keystoreExists: wallet.exists(),
    chain,
    distinctFromSeller:
      wallet.address.toLowerCase() !== "0xb0f7681668f916eed97da066d31aa295d34727c0",
    distinctFromBuyer:
      wallet.address.toLowerCase() !== "0x299ce4113abf88f4997737184aa8a7a3d58ac15c",
  })
);
