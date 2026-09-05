/**
 * X.235-P1 — Mainnet owner wallet readiness check (READ-ONLY).
 *
 * Usage:
 *   MAINNET_OWNER_ADDRESS=0x... MAINNET_AGENT_ID=56:... node mainnet-owner-readiness.verify.ts
 *
 * Performs ZERO writes, ZERO signatures, ZERO wallet prompts. Only read-only
 * balance checks and (optionally) an 8004scan ownership lookup. If
 * MAINNET_OWNER_ADDRESS is missing or invalid, returns a clean BLOCKED result.
 *
 * NEVER requests or prints a private key, seed phrase, or password.
 */

import { createPublicClient, http, formatEther } from "viem";

const OWNER_ADDRESS = process.env.MAINNET_OWNER_ADDRESS ?? "";
const AGENT_ID = process.env.MAINNET_AGENT_ID ?? "";
const RPC_URL = process.env.MAINNET_RPC_URL ?? "https://bsc-rpc.publicnode.com";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

interface OwnerReadiness {
  ownerAddress: string;
  valid: boolean;
  chain: number | null;
  bnbBalance: string | null;
  ownsAgent: boolean | null;
  ready: boolean;
  blockers: string[];
}

async function main(): Promise<void> {
  console.log("=== MAINNET OWNER READINESS CHECK (READ-ONLY) ===\n");
  console.log(`RPC: ${RPC_URL}`);

  const result: OwnerReadiness = {
    ownerAddress: OWNER_ADDRESS,
    valid: false,
    chain: null,
    bnbBalance: null,
    ownsAgent: null,
    ready: false,
    blockers: [],
  };

  // 1. Valid EVM address
  if (!OWNER_ADDRESS) {
    result.blockers.push("MAINNET_OWNER_ADDRESS is not set");
    console.log("\nOWNER ADDRESS: MISSING");
    console.log("MAINNET BNB BALANCE: N/A");
    console.log("ERC-8004 MAINNET AGENT: N/A");
    console.log("PRIVATE KEY: NEVER REQUESTED / NEVER PRINTED");
    console.log("\nOWNER: BLOCKED — no owner address provided.");
    process.exit(0);
  }
  if (!ADDRESS_RE.test(OWNER_ADDRESS)) {
    result.blockers.push("MAINNET_OWNER_ADDRESS is not a valid EVM address");
    console.log("\nOWNER ADDRESS: INVALID");
    console.log(`  value: ${OWNER_ADDRESS}`);
    console.log("PRIVATE KEY: NEVER REQUESTED / NEVER PRINTED");
    console.log("\nOWNER: BLOCKED — invalid address.");
    process.exit(0);
  }
  result.valid = true;
  console.log(`\nOWNER ADDRESS: VALID (${OWNER_ADDRESS})`);

  // 2. Chain = 56
  const pc = createPublicClient({ transport: http(RPC_URL) });
  try {
    const chainId = await pc.getChainId();
    result.chain = chainId;
    console.log(
      `CHAIN: ${chainId}${chainId === 56 ? " (BSC Mainnet — PASS)" : " (NOT 56 — FAIL)"}`
    );
    if (chainId !== 56) result.blockers.push(`chain is ${chainId}, not 56`);
  } catch {
    console.log("CHAIN: RPC UNREACHABLE");
    result.blockers.push("mainnet RPC unreachable");
  }

  // 3. Address balance (read-only)
  try {
    const bal = await pc.getBalance({ address: OWNER_ADDRESS as `0x${string}` });
    result.bnbBalance = formatEther(bal);
    console.log(`MAINNET BNB BALANCE: ${result.bnbBalance} BNB`);
    if (bal === 0n) result.blockers.push("owner wallet has 0 BNB on mainnet (gas required)");
  } catch {
    console.log("MAINNET BNB BALANCE: READ FAILED");
    result.blockers.push("balance read failed");
  }

  // 4. ERC-8004 ownership lookup (only if agent ID supplied)
  if (AGENT_ID) {
    try {
      const url = `https://8004scan.io/api/v1/public/agents?limit=5&chainId=56&ownerAddress=${OWNER_ADDRESS}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const body = (await res.json()) as { data?: Array<{ agent_id: string }> };
      const owned = body.data?.some((a) => a.agent_id === AGENT_ID) ?? false;
      result.ownsAgent = owned;
      console.log(
        `ERC-8004 MAINNET AGENT (${AGENT_ID}): ${owned ? "FOUND (owned by this address)" : "NOT FOUND (not owned)"}`
      );
      if (!owned)
        result.blockers.push(`agent ${AGENT_ID} is not owned by this address on chain 56`);
    } catch {
      console.log("ERC-8004 MAINNET AGENT: LOOKUP FAILED (8004scan unreachable)");
    }
  } else {
    console.log("ERC-8004 MAINNET AGENT: NOT CHECKED (no MAINNET_AGENT_ID supplied)");
  }

  console.log("\nPRIVATE KEY: NEVER REQUESTED / NEVER PRINTED");

  // Final readiness
  result.ready = result.blockers.length === 0;
  if (result.ready) {
    console.log("\nOWNER: READY — valid address on chain 56 with BNB balance.");
  } else {
    console.log("\nOWNER: BLOCKED");
    for (const b of result.blockers) console.log(`  — ${b}`);
  }
  process.exit(0);
}

void main();
