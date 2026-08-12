import { readBnbTestnetWalletSnapshot } from "./service.ts";

// Public provider from the pre-existing chain-97 ERC-8183 job 1 (read-only).
const PUBLIC_TESTNET_PROVIDER = "0xD8c45dA4e4036f4946132B18fc7568096CB7535f" as const;

const result = await readBnbTestnetWalletSnapshot(PUBLIC_TESTNET_PROVIDER);
if (
  result.state !== "ready" ||
  result.chainId !== 97 ||
  result.wallet !== PUBLIC_TESTNET_PROVIDER
) {
  console.error(`X.13 live service verify failed: ${result.state}`);
  process.exit(1);
}

console.log(
  "X.13 live service verify: READY (chain 97 read-only balance snapshot; no value rendered)"
);
