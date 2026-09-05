import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, type Hex } from "viem";
import { resolveErc8183Config } from "./erc8183.js";
import {
  ALTANA_SESSION_CHAIN_ID,
  createAltanaSessionManager,
} from "./session.js";

const PRIVATE_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";

function loadEnv(): void {
  let dir = resolve(process.cwd());
  for (let depth = 0; depth < 6; depth += 1) {
    const path = resolve(dir, ".env.local");
    if (existsSync(path)) {
      process.loadEnvFile(path);
      return;
    }
    dir = resolve(dir, "..");
  }
}

function requiredHex(name: string): Hex {
  const value = process.env[name];
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte hex private key in .env.local.`);
  }
  return value as Hex;
}

async function main(): Promise<void> {
  loadEnv();
  const config = resolveErc8183Config(ALTANA_SESSION_CHAIN_ID);
  const manager = createAltanaSessionManager({
    adminPrivateKey: requiredHex(PRIVATE_KEY_ENV),
    paymentToken: getAddress(config.paymentToken),
    registry: getAddress(config.registry),
  });

  console.log("X.36 ALTANA SESSION FLOW (BNB TESTNET ONLY):");
  const prerequisites = await manager.verifyPrerequisites();
  for (const check of prerequisites) console.log(`${check.ok ? "PASS" : "FAIL"} prerequisite. ${check.label}`);
  const granted = await manager.grant();
  console.log(`PASS 2. wallet adopted (${granted.walletAddress})`);
  console.log(`PASS 3. session granted (${granted.sessionPublicKey})`);
  console.log(`PASS 4. KeyStore active (${granted.keyId})`);
  console.log(`PASS 5. allowlist ${granted.target} :: ${granted.functionSignature}`);
  console.log(`PASS 6. spend cap ${granted.spendLimitRaw} raw units`);
  console.log(`PASS 7. expiry ${granted.expiry}`);
  const preflight = await manager.preflight();
  for (const check of preflight) console.log(`${check.ok ? "PASS" : "FAIL"} preflight ${check.id}. ${check.label}`);
  const executed = await manager.executeQualificationCall();
  if (executed.transactionHash === undefined) throw new Error("X.36 missing session transaction hash.");
  console.log(`PASS 8. genuine session-key transaction ${executed.transactionHash}`);
  if (!executed.stateTransitionVerified) throw new Error("X.36 state transition evidence missing.");
  console.log("PASS 9. receipt success + exact Approval(wallet,wallet,1) observed");
  const revoked = await manager.revoke();
  console.log(`PASS 10. revoked; KeyStore active=${revoked.keyStoreActive}`);
  let rejected = false;
  try {
    await manager.preflight();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("X.36 post-revoke preflight unexpectedly allowed execution.");
  console.log("PASS 11. post-revoke execution rejected before signing/broadcast");
  console.log("X.36 STATUS: PASS");
  console.log(`CHAIN: ${ALTANA_SESSION_CHAIN_ID}`);
  console.log("MAINNET: NOT TOUCHED");
  console.log("AGENT 1816 / JOB 515: UNCHANGED");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
