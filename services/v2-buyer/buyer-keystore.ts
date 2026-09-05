import { EVMWalletProvider, loadEnv } from "@bnbagent/sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const buyerDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
loadEnv(buyerDir);
loadEnv("C:/bnb-agent-marketplace");

if (process.env.NETWORK !== "bsc-testnet") {
  throw new Error("NETWORK must be bsc-testnet for buyer");
}
if (!process.env.BUYER_WALLET_PASSWORD) {
  throw new Error("BUYER_WALLET_PASSWORD is required for buyer EVMWalletProvider");
}
const buyerPrivateKey = process.env.BUYER_PRIVATE_KEY;
if (
  !EVMWalletProvider.keystoreExists("0x299Ce4113abF88F4997737184aa8A7a3D58AC15C") &&
  !buyerPrivateKey
) {
  throw new Error("BUYER_PRIVATE_KEY is required for first-run buyer Keystore V3 creation");
}

const buyerWallet = new EVMWalletProvider({
  password: process.env.BUYER_WALLET_PASSWORD!,
  privateKey: buyerPrivateKey || undefined,
  address: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
});

console.log(
  JSON.stringify({
    buyerAddress: buyerWallet.address,
    addressMatch:
      buyerWallet.address.toLowerCase() === "0x299ce4113abf88f4997737184aa8a7a3d58ac15c",
    source: buyerWallet.source,
    exists: buyerWallet.exists(),
    keystore: buyerWallet.keyLocation?.split(/[\\/]/).pop() ?? null,
  })
);
