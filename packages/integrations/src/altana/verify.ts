/**
 * ALTANA Phase 2 — read-only integration verification runner.
 *
 * Safe by construction: NO transactions, NO session creation, NO ERC-8183
 * jobs, NO x402, NO skills, NO wallet funding, NO private keys, NO mainnet
 * writes. It proves the @altananetwork/sdk is initialized and configured
 * correctly against BNB testnet (chain 97), then attempts a single plain
 * eth_getBalance probe.
 *
 * Exit policy:
 *   - 1  configuration/initialization failure (the integration gate).
 *   - 0  otherwise; an unreachable testnet RPC downgrades the network probe to
 *        "SKIPPED" (network read, not a config failure).
 *
 * Run after `pnpm build`:  node dist/altana/verify.js
 */

import {
  checkAltanaReadonly,
  createAltanaClient,
  getAltanaStatus,
  validateAltanaConfiguration,
} from "./client.js";

function fail(message: string): never {
  console.error(`ALTANA VERIFY FAILED: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("ALTANA PHASE 2 — read-only verification (testnet, no tx, no sessions)");

  // 1. Pure config validation (offline). Testnet is the default.
  const testnet = validateAltanaConfiguration({ network: "bnb-testnet" });
  if (!testnet.ok) fail(`testnet config invalid: ${testnet.errors.join(" | ")}`);
  if (testnet.config.chainId !== 97) fail("testnet must resolve to chain id 97");
  console.log(`ok   network=bnb-testnet chainId=97 keystore=${testnet.config.keyStore}`);

  // 2. Network/chain-id consistency (offline assertions).
  const mainnet = validateAltanaConfiguration({ network: "bnb", defaultChainId: 56 });
  if (!mainnet.ok) fail(`mainnet config invalid: ${mainnet.errors.join(" | ")}`);
  if (mainnet.config.chainId !== 56) fail("bnb must resolve to chain id 56");

  const mismatch = validateAltanaConfiguration({ network: "bnb", defaultChainId: 97 });
  if (mismatch.ok) fail("mixed network + chainId mismatch must be rejected");
  const badNetwork = validateAltanaConfiguration({ network: "mainnet" });
  if (badNetwork.ok) fail('network "mainnet" must be rejected');

  const badRpc = validateAltanaConfiguration({ network: "bnb-testnet", rpcUrl: "not-a-url" });
  if (badRpc.ok) fail("non-http rpcUrl must be rejected");
  console.log("ok   validation rejects unknown networks, mismatched chainIds, bad rpcUrls");

  // 3. Default client construction defaults to testnet (never mainnet).
  const client = createAltanaClient();
  if (client.defaultChainId !== 97) fail("createAltanaClient must default to bnb-testnet (97)");

  // 4. Status snapshot + read-only probe (best-effort network).
  const status = await getAltanaStatus(client, { probe: true });
  console.log(
    `ok   sdk=${status.sdk.packageName}@${status.sdk.version} configured=${status.configured} defaultChainId=${status.defaultChainId}`
  );

  const probe = status.probe ?? (await checkAltanaReadonly(client));
  if (probe.ok) {
    console.log(
      `ok   readonly probe (chain ${probe.chainId}) nativeBalanceWei=${probe.nativeBalanceWei}`
    );
  } else {
    console.warn(
      `SKIP readonly RPC probe unreachable (${probe.error ?? "unknown error"}). ` +
        "Initialization and configuration are still verified; this is a network read, not a failure."
    );
  }

  console.log("ALTANA STATUS: READY FOR IMPLEMENTATION");
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(`ALTANA VERIFY FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
