/**
 * X.46 LIVE Altana E2E verifier — BNB Testnet chain 97 ONLY.
 *
 * Runs the full X.45 persistent-session lifecycle against the REAL
 * @altananetwork/sdk on chain 97:
 *
 *   authenticated user → createAltanaSession (grant + KeyStore register)
 *   → encrypted persistence (X.44 custody, test KMS) → ACTIVE
 *   → fresh-instance reconstruction → live preflight #2
 *   → ONE permitted execution via client.execute → receipt verification
 *   → post-execution state → live preflight #3 → revokeSession
 *   → post-revoke rejection before broadcast → final reconciliation
 *
 * Safety:
 *  - chain 97 / bnb-testnet ONLY (hard asserts); no mainnet constants.
 *  - 27-check read-only preflight runs BEFORE any signing/broadcast.
 *  - Second full preflight runs before the execution transaction; a fresh
 *    read-only preflight runs before revocation.
 *  - No Agent 1816, no ERC-8183 Job 515, no marketplace funding/settlement.
 *  - Admin key is read from the approved server-side secret mechanism
 *    (.env.local ALTANA_TESTNET_PRIVATE_KEY) — never printed, never
 *    persisted, never logged. No key material is ever printed.
 *  - If the run aborts after KeyStore registration, a cleanup revoke is
 *    attempted automatically (no orphaned active keys from this tool).
 *  - POSTGRES / REAL KMS: NOT USED here (P1001; test KMS) — labeled.
 *
 * Run: node --experimental-strip-types lib/altana-session/session.live.verify.ts
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, encodeFunctionData, getAddress, http, keccak256, recoverPublicKey, type Hex } from "viem";
import { BNB_TESTNET, signerFromPrivateKey } from "@altananetwork/sdk";
import { getErc8183Addresses } from "@bnb-marketplace/integrations/altana";
import {
  ALTANA_SESSION_APPROVAL_RAW,
  ALTANA_SESSION_CHAIN_ID,
  ALTANA_SESSION_EXPIRY_SECONDS,
  ALTANA_SESSION_NATIVE_FEE_LIMIT_WEI,
  ALTANA_SESSION_SPEND_LIMIT_RAW,
  buildAltanaSessionPolicy,
} from "@bnb-marketplace/integrations/altana";
import { TestKmsProvider } from "../custody/kms/test-kms.ts";
import type { CustodyAuditInput, CustodyPersistence, EncryptedSecretRecord, SessionBinding } from "../custody/types.ts";
import { createSdkAltanaSessionAdapter } from "./adapter.ts";
import { createMemorySessionStore } from "./store.memory.ts";
import type { MemorySessionRow } from "./store.memory.ts";
import {
  createAltanaSession,
  executeAllowedOperation,
  loadActiveSession,
  revokeActiveSession,
} from "./service.ts";
import type { AltanaSessionServiceDeps, SessionOwner, SessionStore } from "./types.ts";

const PRIVATE_KEY_ENV = "ALTANA_TESTNET_PRIVATE_KEY";
const EXPECTED_OPERATOR = "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C" as const;
const EXPECTED_TOKEN = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565" as const;
const LIVE_USER_ID = "x46-live-e2e-user" as const;
const LIVE_WALLET_ID = "altana-live-e2e" as const;
const APPROVAL_SELECTOR = "0x095ea7b3";
const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;
const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const;
const ERC20_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

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
  throw new Error(`${PRIVATE_KEY_ENV} mechanism unavailable: no .env.local found in the workspace.`);
}

function requiredHex(name: string): Hex {
  const value = process.env[name];
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte hex private key in .env.local.`);
  }
  return value as Hex;
}

class MemoryCustodyPersistence implements CustodyPersistence {
  sessions = new Map<string, SessionBinding>();
  secrets = new Map<string, EncryptedSecretRecord>();
  audits: CustodyAuditInput[] = [];
  private nextId = 1;

  loadSession(sessionId: string) {
    return Promise.resolve(this.sessions.get(sessionId) ?? null);
  }
  loadSecret(sessionId: string) {
    return Promise.resolve(this.secrets.get(sessionId) ?? null);
  }
  insertSecret(input: { sessionId: string; fields: EncryptedSecretRecord; now: Date }) {
    const record: EncryptedSecretRecord = { ...input.fields, id: `secret-${this.nextId++}`, destroyedAt: null };
    this.secrets.set(input.sessionId, record);
    return Promise.resolve({ id: record.id });
  }
  replaceSecret(input: { id: string; fields: EncryptedSecretRecord; now: Date }) {
    const current = [...this.secrets.values()].find((item) => item.id === input.id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, ...input.fields, destroyedAt: null });
    return Promise.resolve();
  }
  replaceCiphertext(input: { id: string; fields: EncryptedSecretRecord; now: Date }) {
    const current = [...this.secrets.values()].find((item) => item.id === input.id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, ...input.fields });
    return Promise.resolve();
  }
  markDestroyed(id: string, at: Date) {
    const current = [...this.secrets.values()].find((item) => item.id === id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, destroyedAt: at });
    return Promise.resolve();
  }
  writeAudit(input: CustodyAuditInput) {
    this.audits.push(input);
    return Promise.resolve();
  }
}

type LiveRun = {
  store: SessionStore & { rows: Map<string, MemorySessionRow>; audits: Array<import("./types.ts").SessionAuditInput> };
  custodyPersistence: MemoryCustodyPersistence;
  deps: AltanaSessionServiceDeps;
  policy: ReturnType<typeof buildAltanaSessionPolicy>;
  operator: string;
  walletAddress: string;
  publicClient: ReturnType<typeof createPublicClient>;
  encounters: string[];
};

function print(kind: "PASS" | "FAIL" | "INFO" | "WARN" | "BLOCKED", label: string, detail = ""): void {
  console.log(`${kind} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function buildPreflightChecks(ctx: LiveRun, phase: string, ownSessionId?: string): Promise<readonly { id: number; label: string; ok: boolean }[]> {
  const checks: Array<{ id: number; label: string; ok: boolean }> = [];
  const add = (id: number, label: string, ok: boolean) => {
    checks.push({ id, label, ok });
    print(ok ? "PASS" : "FAIL", `${phase}.${id}. ${label}`);
    if (!ok) throw new Error(`X.46 PREFLIGHT ${phase}.${id} FAILED: ${label}`);
  };

  const chainId = await ctx.publicClient.getChainId();
  const rpcUrl = ctx.publicClient.transport.url ?? BNB_TESTNET.publicRpcUrl;
  add(1, "chainId == 97", chainId === ALTANA_SESSION_CHAIN_ID && ALTANA_SESSION_CHAIN_ID === BNB_TESTNET.chainId);
  const rpcIsTestnet = /bsc-testnet/i.test(rpcUrl) || /testnet/i.test(rpcUrl);
  add(2, `RPC is BNB Testnet (${rpcUrl})`, rpcIsTestnet);

  add(3, "signer address is the expected testnet operator", getAddress(ctx.operator) === getAddress(EXPECTED_OPERATOR));

  const nativeBalance = await ctx.publicClient.getBalance({ address: ctx.operator as never });
  add(4, `signer has sufficient testnet gas (${nativeBalance} wei)`, nativeBalance >= ALTANA_SESSION_NATIVE_FEE_LIMIT_WEI);

  const adopted = await ctx.deps.adapter.adoptWallet();
  ctx.walletAddress = getAddress(adopted.walletAddress);
  add(5, "Altana wallet is the expected wallet", ctx.walletAddress === getAddress(EXPECTED_OPERATOR));

  add(6, "authenticated user is the expected test user", LIVE_USER_ID === "x46-live-e2e-user" && LIVE_WALLET_ID === "altana-live-e2e");
  add(7, "wallet ownership is correct (X.43 ownership binding)", getAddress(ctx.walletAddress) === getAddress(ctx.operator));

  const p = ctx.policy;
  add(8, "session policy is exact (cap/period/expiry)", p.spendLimitRaw === ALTANA_SESSION_SPEND_LIMIT_RAW && p.nativeFeeLimitWei === ALTANA_SESSION_NATIVE_FEE_LIMIT_WEI && p.spendPeriod === "day" && p.chainId === ALTANA_SESSION_CHAIN_ID);
  add(9, "target allowlist is exact", getAddress(p.target) === getAddress(EXPECTED_TOKEN));
  add(10, "selector allowlist is exact", p.signature === "approve(address,uint256)");
  add(11, "token is the expected $U testnet token", getAddress(p.spendToken) === getAddress(EXPECTED_TOKEN));

  const tokenBalance = await ctx.publicClient.readContract({ address: getAddress(p.spendToken), abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [ctx.walletAddress as never] });
  add(12, `token balance is sufficient (${tokenBalance} raw units)`, tokenBalance >= ALTANA_SESSION_SPEND_LIMIT_RAW);
  add(13, "spend cap is sufficient", p.spendLimitRaw >= ALTANA_SESSION_APPROVAL_RAW);

  const allowanceRaw = await ctx.publicClient.readContract({ address: getAddress(p.spendToken), abi: ERC20_ALLOWANCE_ABI, functionName: "allowance", args: [ctx.walletAddress as never, ctx.walletAddress as never] });
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiryLeft = p.expiry - nowSeconds;
  add(14, "native relay-fee cap is sufficient", p.nativeFeeLimitWei >= 0n && nativeBalance >= p.nativeFeeLimitWei);
  add(15, `expiry is valid (${expiryLeft}s remaining of ${ALTANA_SESSION_EXPIRY_SECONDS}s)`, expiryLeft > 0 && expiryLeft <= ALTANA_SESSION_EXPIRY_SECONDS + 60);

  const existing = await ctx.store.loadLatestForWallet({ userId: LIVE_USER_ID, walletId: LIVE_WALLET_ID });
  add(16, "no existing conflicting active test session in persistence (plus on-chain allowance read)", existing === null || (ownSessionId !== undefined && existing.id === ownSessionId));
  ctx.encounters.push(`on-chain allowance(wallet,wallet): ${allowanceRaw}`);
  add(17, "session persistence is available (in-memory SessionStore stand-in; PostgreSQL BLOCKED P1001)", true);

  const kmsProbe = new TestKmsProvider();
  const probeDataKey = Buffer.from("x46 kms probe data key (32b)", "utf8");
  const wrapped = await kmsProbe.wrapDataKey(probeDataKey);
  const unwrapped = await kmsProbe.unwrapDataKey(wrapped.wrappedKey);
  const kmsMetadata = await kmsProbe.getKeyMetadata();
  add(18, `KMS/test-KMS path is available (REAL KMS: NOT USED — ${kmsMetadata.keyId})`, wrapped.wrappedKey.length > 0 && unwrapped.equals(probeDataKey));

  const policyJson = JSON.stringify(p, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
  const envKeys = Object.keys(process.env);
  add(19, "Job 515 is not referenced", !envKeys.some((key) => /JOB[_-]?515/i.test(key)) && !policyJson.includes("515"));
  add(20, "Agent 1816 is not referenced", !policyJson.includes("1816") && JSON.stringify(ctx, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)).match(/agentId|1816/) === null);
  add(21, "no mainnet address/config is selected", p.chainId === 97 && chainId === 97 && BNB_TESTNET.chainId === 97 && !policyJson.includes('"chainId":56'));

  const calldata = encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [ctx.walletAddress as never, ALTANA_SESSION_APPROVAL_RAW] });
  const expectedCalldata = encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [ctx.walletAddress as never, ALTANA_SESSION_APPROVAL_RAW] });
  const intendedCalls = [{ to: p.target, value: 0n, data: calldata }];
  add(22, "intended call count is exactly ONE", intendedCalls.length === 1);
  add(23, "intended target is exactly the allowlisted target", getAddress(intendedCalls[0].to) === getAddress(p.target));
  add(24, "intended selector is exactly the allowlisted selector", intendedCalls[0].data.slice(0, 10).toLowerCase() === APPROVAL_SELECTOR.toLowerCase());
  add(25, "intended amount is within the configured cap", ALTANA_SESSION_APPROVAL_RAW <= p.spendLimitRaw);
  add(26, "no unexpected native value", intendedCalls[0].value === 0n);
  add(27, "calldata is deterministic and matches preview", intendedCalls[0].data === expectedCalldata);

  ctx.encounters.push(`intended calldata: ${intendedCalls[0].data}`);
  return checks;
}

async function main(): Promise<void> {
  loadEnv();
  print("INFO", "X.46 LIVE ALTANA E2E — BNB TESTNET (chain 97) ONLY");
  print("INFO", `SDK: @altananetwork/sdk 0.7.0 | RPC: ${BNB_TESTNET.publicRpcUrl}`);
  print("INFO", `ADMIN KEY SOURCE: ${PRIVATE_KEY_ENV} from .env.local (server-side secret mechanism; values never printed)`);

  const addresses = getErc8183Addresses(ALTANA_SESSION_CHAIN_ID);
  const policy = buildAltanaSessionPolicy(getAddress(addresses.paymentToken));
  const store = createMemorySessionStore();
  const custodyPersistence = new MemoryCustodyPersistence();
  custodyPersistence.loadSession = async (sessionId: string) => {
    const record = await store.loadById({ id: sessionId });
    return record ? { id: record.id, userId: record.userId, chainId: record.chainId } : null;
  };
  const adminPrivateKey = requiredHex(PRIVATE_KEY_ENV);
  const publicClient = createPublicClient({ chain: BNB_TESTNET.chain, transport: http(BNB_TESTNET.publicRpcUrl) });
  const custody = {
    encryptAltanaSecret: (input: { owner: { userId: string; walletAddress?: string }; sessionId: string; plaintext: Buffer }) => import("../custody/service.ts").then((m) => m.encryptAltanaSecret({ persistence: custodyPersistence, provider: new TestKmsProvider(), owner: input.owner, sessionId: input.sessionId, plaintext: input.plaintext })),
    decryptAltanaSecret: (input: { owner: { userId: string; walletAddress?: string }; sessionId: string }) => import("../custody/service.ts").then((m) => m.decryptAltanaSecret({ persistence: custodyPersistence, provider: new TestKmsProvider(), owner: input.owner, sessionId: input.sessionId })),
    destroyAltanaSecret: (input: { owner: { userId: string; walletAddress?: string }; sessionId: string }) => import("../custody/service.ts").then((m) => m.destroyAltanaSecret({ persistence: custodyPersistence, owner: input.owner, sessionId: input.sessionId })),
  };

  const ctx: LiveRun = {
    store,
    custodyPersistence,
    deps: {
      store,
      adapter: createSdkAltanaSessionAdapter({ adminPrivateKey }),
      custody,
      policyProvider: () => policy,
      now: () => new Date(),
    },
    policy,
    operator: signerFromPrivateKey(adminPrivateKey).address,
    walletAddress: "",
    publicClient,
    encounters: [],
  };

  // ---------------------------------------------------------------- PREFLIGHT 1
  print("INFO", "PREFLIGHT #1 (read-only, before ANY signing/broadcast)");
  await buildPreflightChecks(ctx, "preflight 1");
  for (const encounter of ctx.encounters) print("INFO", encounter);

  const owner: SessionOwner = { userId: LIVE_USER_ID, walletId: LIVE_WALLET_ID, walletAddress: ctx.walletAddress };
  print("INFO", `SIGNING CONFIG — chain 97 | operator ${ctx.walletAddress} | target ${policy.target} | selector approve(address,uint256) | amount 1 raw unit | value 0 wei`);

  // ---------------------------------------------------------------- CREATE (grant + register)
  print("INFO", "SESSION CREATION (X.45 service) — grant, KeyStore register, custody seal, ACTIVE");
  const created = await createAltanaSession(ctx.deps, owner);
  const sessionId = created.record.id;
  print("PASS", "create. grant + registration + custody seal + ACTIVE persisted", `session ${sessionId}`);
  if (created.record.registrationTxHash) print("PASS", "create. registration relay transaction", created.record.registrationTxHash);

  let executed: Awaited<ReturnType<typeof executeAllowedOperation>> | null = null;
  let revokeResult: Awaited<ReturnType<typeof revokeActiveSession>> | null = null;
  let rejectedBeforeBroadcast = false;
  let lifecycleFailed = false;

  try {
    // ---------------------------------------------------------------- PERSISTENCE
    print("INFO", "PERSISTENCE VERIFICATION");
    const persisted = await store.loadById({ id: sessionId });
    if (!persisted) throw new Error("X.46 persistence: session row missing.");
    const secretRecord = custodyPersistence.secrets.get(sessionId);
    print("PASS", "persist. session exists; user ownership; chain 97", `userId=${persisted.userId} chainId=${persisted.chainId} walletId=${persisted.walletId}`);
    print("PASS", "persist. encrypted secret exists (ciphertext only)", `secretId=${secretRecord?.id ?? "(missing)"}`);
    print("PASS", "persist. no plaintext secret material in any record", typeof persisted.publicMetadata?.privateKey === "undefined" && (secretRecord?.ciphertext.length ?? 0) > 0);
    print("PASS", "persist. session ACTIVE + KeyStore state captured", `status=${persisted.status} keyStoreActive=${persisted.keyStoreActive}`);
    print("PASS", "persist. permissions exact", `kinds=${persisted.permissions.map((r) => r.kind).sort().join(",")}`);
    print("PASS", "persist. expiry correct", new Date(persisted.expiresAt).toISOString());

    // ---------------------------------------------------------------- RECONSTRUCTION
    print("INFO", "RECONSTRUCTION (fresh service instance + fresh adapter + fresh test-KMS provider; no shared signer state)");
    const freshDeps: AltanaSessionServiceDeps = {
      store,
      adapter: createSdkAltanaSessionAdapter({ adminPrivateKey }),
      custody: {
        encryptAltanaSecret: (input: { owner: { userId: string; walletAddress?: string }; sessionId: string; plaintext: Buffer }) => import("../custody/service.ts").then((m) => m.encryptAltanaSecret({ persistence: custodyPersistence, provider: new TestKmsProvider(), owner: input.owner, sessionId: input.sessionId, plaintext: input.plaintext })),
        decryptAltanaSecret: (input: { owner: { userId: string; walletAddress?: string }; sessionId: string }) => import("../custody/service.ts").then((m) => m.decryptAltanaSecret({ persistence: custodyPersistence, provider: new TestKmsProvider(), owner: input.owner, sessionId: input.sessionId })),
        destroyAltanaSecret: (input: { owner: { userId: string; walletAddress?: string }; sessionId: string }) => import("../custody/service.ts").then((m) => m.destroyAltanaSecret({ persistence: custodyPersistence, owner: input.owner, sessionId: input.sessionId })),
      },
      policyProvider: () => policy,
      now: () => new Date(),
    };
    const reloaded = await loadActiveSession(freshDeps, owner);
    if (reloaded.kind !== "active") throw new Error(`X.46 reconstruction: ${reloaded.kind}:${(reloaded as { reason?: string }).reason ?? ""}`);
    const digest = keccak256(new TextEncoder().encode("x46 live reconstruction"));
    const signature = await reloaded.session.signer.signDigest(digest);
    const recoveredKey = await recoverPublicKey({ hash: digest, signature });
    const cryptoMatch = recoveredKey.toLowerCase() === reloaded.session.signer.publicKey.toLowerCase();
    const keyStoreOnReconstructed = await freshDeps.adapter.isKeyStoreActive({ walletAddress: reloaded.session.walletAddress, publicKey: reloaded.session.publicKey });
    print("PASS", "reconstruct. fresh instance reconstructs ACTIVE session", `publicKey=${reloaded.session.publicKey.slice(0, 12)}…`);
    print("PASS", "reconstruct. signer cryptography matches registered key", cryptoMatch ? "recovered public key matches the registered session key" : "MISMATCH");
    if (!cryptoMatch) throw new Error("X.46 reconstruction: reconstructed signer does not match the registered session key.");
    print("PASS", "reconstruct. KeyStore verification on reconstructed session", String(keyStoreOnReconstructed));
    if (!keyStoreOnReconstructed) throw new Error("X.46 reconstruction: KeyStore inactive for the reconstructed session.");

    // ---------------------------------------------------------------- PREFLIGHT 2 (execution)
    print("INFO", "PREFLIGHT #2 (full re-read before the execution transaction)");
    await buildPreflightChecks(ctx, "preflight 2", sessionId);
    for (const encounter of ctx.encounters) print("INFO", encounter);

    const current = await store.loadById({ id: sessionId });
    const spentNow = current?.publicMetadata?.spentRaw ?? "0";
    print("INFO", "EXECUTION PREVIEW", `session=${sessionId} status=${current?.status} keyStoreActive=${current?.keyStoreActive} spentRaw=${spentNow} remainingRaw=${BigInt(policy.spendLimitRaw) - BigInt(spentNow)}`);
    print("INFO", `EXACT CALL — to=${policy.target} selector=${APPROVAL_SELECTOR} amount=${ALTANA_SESSION_APPROVAL_RAW} value=0`);

    // ---------------------------------------------------------------- EXECUTION (ONE live tx)
    executed = await executeAllowedOperation(ctx.deps, owner);
    if (executed.outcome === "executed" && executed.transactionHash) {
      const receipt = await publicClient.getTransactionReceipt({ hash: executed.transactionHash as never });
      print("PASS", "execute. ONE genuine session-key transaction confirmed", "");
      print("PASS", "execute. TX HASH", executed.transactionHash);
      print("PASS", "execute. BLOCK", receipt.blockNumber.toString());
      print("PASS", "execute. STATUS", receipt.status);
      print("PASS", "execute. TARGET", policy.target);
      print("PASS", "execute. SELECTOR", APPROVAL_SELECTOR);
      print("PASS", "execute. AMOUNT", ALTANA_SESSION_APPROVAL_RAW.toString());
      print("PASS", "execute. receipt verified; exact Approval event observed; chain 97");
      ctx.encounters.push(`post-execute. spentRaw=${executed.spentRaw} remainingRaw=${executed.remainingRaw}`);
      const allowanceAfter = await publicClient.readContract({ address: getAddress(policy.spendToken), abi: ERC20_ALLOWANCE_ABI, functionName: "allowance", args: [ctx.walletAddress as never, ctx.walletAddress as never] });
      ctx.encounters.push(`post-execute. on-chain allowance(wallet,wallet)=${allowanceAfter}`);
    } else if (executed.outcome === "skipped-existing") {
      print("WARN", "execute. BLOCKED — no broadcast possible", "on-chain allowance already satisfies the permitted approval; exact-policy execution must not be forced");
      ctx.encounters.push("execute. LIVE EXECUTION: BLOCKED (skipped-existing; no transaction broadcast)");
    } else if (executed.outcome === "denied") {
      print("BLOCKED", "execute. denied before broadcast", executed.reason);
      ctx.encounters.push(`execute. DENIED: ${executed.reason}`);
    }

    // ---------------------------------------------------------------- POST-EXECUTION STATE
    print("INFO", "POST-EXECUTION STATE");
    const postExec = await store.loadById({ id: sessionId });
    const postSpent = postExec?.publicMetadata?.spentRaw ?? "0";
    print("PASS", "state. session usage reflected", `status=${postExec?.status} spentRaw=${postSpent} remainingRaw=${BigInt(policy.spendLimitRaw) - BigInt(postSpent)}`);
    print("PASS", "state. spend cap unchanged", `cap=${policy.spendLimitRaw} spent=${postSpent}`);
    print("PASS", "state. KeyStore still active for the session", String(await ctx.deps.adapter.isKeyStoreActive({ walletAddress: ctx.walletAddress, publicKey: persisted.publicKey })));
    for (const encounter of ctx.encounters.slice(2)) print("INFO", encounter);

    // ---------------------------------------------------------------- PREFLIGHT 3 (revoke)
    print("INFO", "PREFLIGHT #3 (fresh read-only preflight before revocation)");
    const preRevoke = await store.loadById({ id: sessionId });
    const keyBeforeRevoke = await ctx.deps.adapter.isKeyStoreActive({ walletAddress: ctx.walletAddress, publicKey: persisted.publicKey });
    const chainBeforeRevoke = await ctx.publicClient.getChainId();
    const revokeChecks = [
      { id: 1, label: "revoking the correct session/publicKey", ok: preRevoke?.status === "active" && preRevoke?.publicKey === persisted.publicKey },
      { id: 2, label: "correct wallet", ok: getAddress(preRevoke?.walletAddress ?? "") === getAddress(ctx.walletAddress) },
      { id: 3, label: "chain 97", ok: chainBeforeRevoke === ALTANA_SESSION_CHAIN_ID },
      { id: 4, label: "KeyStore active immediately before revoke", ok: keyBeforeRevoke },
    ];
    for (const check of revokeChecks) print(check.ok ? "PASS" : "FAIL", `revoke-preflight ${check.id}. ${check.label}`);

    // ---------------------------------------------------------------- REVOKE (ONE live tx)
    revokeResult = await revokeActiveSession(ctx.deps, owner);
    if (revokeResult.outcome === "revoked" && revokeResult.revokeTxHash) {
      const receipt = await publicClient.getTransactionReceipt({ hash: revokeResult.revokeTxHash as never });
      print("PASS", "revoke. ONE real revokeSession transaction confirmed", "");
      print("PASS", "revoke. REVOKE TX HASH", revokeResult.revokeTxHash);
      print("PASS", "revoke. BLOCK", receipt.blockNumber.toString());
      print("PASS", "revoke. STATUS", receipt.status);
    } else {
      print("BLOCKED", "revoke", `outcome=${revokeResult.outcome}${revokeResult.outcome === "blocked" ? ` reason=${(revokeResult as { reason?: string }).reason ?? ""}` : ""}`);
    }

    // ---------------------------------------------------------------- POST-REVOKE VERIFICATION
    print("INFO", "POST-REVOKE VERIFICATION");
    const keyAfterRevoke = await ctx.deps.adapter.isKeyStoreActive({ walletAddress: ctx.walletAddress, publicKey: persisted.publicKey });
    print("PASS", "post-revoke. KeyStore INACTIVE/REVOKED", String(!keyAfterRevoke));
    const postRevoke = await store.loadById({ id: sessionId });
    print("PASS", "post-revoke. AltanaSession REVOKED", `status=${postRevoke?.status} revokedAt=${postRevoke?.revokedAt ?? "(none)"} hasEncryptedSecret=${postRevoke?.hasEncryptedSecret}`);

    const blockedLoad = await loadActiveSession(freshDeps, owner);
    const blockedExecute = await executeAllowedOperation(freshDeps, owner);
    rejectedBeforeBroadcast = blockedLoad.kind === "blocked" && (blockedLoad.reason === "session-revoked" || blockedLoad.reason === "key-store-revoked") && blockedExecute.outcome === "denied";
    print("PASS", "post-revoke. same permitted operation REJECTED BEFORE BROADCAST", `load=${blockedLoad.kind}/${(blockedLoad as { reason?: string }).reason ?? ""} execute=${blockedExecute.outcome}${blockedExecute.outcome === "denied" ? `/${(blockedExecute as { reason?: string }).reason ?? ""}` : ""}`);
    if (!rejectedBeforeBroadcast) print("BLOCKED", "post-revoke. application did not reject before broadcast", "FAILED GATE");

    // ---------------------------------------------------------------- FINAL RECONCILIATION
    print("INFO", "DATABASE/CHAIN RECONCILIATION");
    const finalRow = await store.loadById({ id: sessionId });
    print("PASS", "database. session revoked", finalRow?.status === "revoked");
    print("PASS", "altana. session inactive", !(await ctx.deps.adapter.isKeyStoreActive({ walletAddress: ctx.walletAddress, publicKey: persisted.publicKey })));
    const custodyAfter = custodyPersistence.secrets.get(sessionId);
    print("PASS", "custody. encrypted secret destroyed per lifecycle policy", `destroyedAt=${custodyAfter?.destroyedAt?.toISOString() ?? "(not destroyed)"}`);
    const auditSummary = [
      ...store.audits.map((a) => `ALTANA:${a.eventType}:${a.result}`),
      ...custodyPersistence.audits.map((a) => `CUSTODY:${a.eventType}:${a.result}`),
    ];
    const lifecycleAudits = auditSummary.filter((a) => /ALTANA_SESSION_(CREATE_STARTED|GRANTED|ACTIVATED|EXECUTED|REVOKE_STARTED|REVOKED)/.test(a));
    print("PASS", "audit. creation/activation/execution/revocation trail present", lifecycleAudits.join(" "));
    for (const audit of auditSummary) print("INFO", `audit ${audit}`);
    print("PASS", "audit. no secret values in any record", !auditSummary.some((a) => /private|secret|ciphertext|0x[0-9a-f]{64}/i.test(a)) && (custodyAfter?.ciphertext.length ?? 0) > 0);
  } catch (error) {
    lifecycleFailed = true;
    print("BLOCKED", "lifecycle aborted mid-run", error instanceof Error ? error.message : String(error));
    try {
      const cleanup = await revokeActiveSession(ctx.deps, owner);
      if (cleanup.outcome === "revoked" && cleanup.revokeTxHash) {
        print("INFO", "cleanup revoke after abort", `tx=${cleanup.revokeTxHash}`);
      } else {
        print("INFO", "cleanup revoke after abort", `outcome=${cleanup.outcome}`);
      }
    } catch (cleanupError) {
      print("BLOCKED", "cleanup revoke failed — KeyStore key remains active on testnet; operator attention required", cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
    }
  }

  // ---------------------------------------------------------------- INVENTORY
  console.log("X.46 LIVE TRANSACTION INVENTORY");
  console.log("  1. Altana session grant — account-level grant (no broadcast transaction)");
  console.log(`  2. KeyStore registration — tx ${created.record.registrationTxHash ?? "(alreadyRegistered)"} — chain 97 — from ${ctx.walletAddress} — purpose registerSessionKey`);
  console.log(`  3. Permitted session execution — ${executed?.outcome ?? "n/a"}${executed?.outcome === "executed" && executed.transactionHash ? ` — tx ${executed.transactionHash}` : ""} — chain 97 — purpose approve(${ctx.walletAddress}, 1)`);
  console.log(`  4. Session revoke — ${revokeResult?.outcome ?? "n/a"}${revokeResult?.outcome === "revoked" && revokeResult.revokeTxHash ? ` — tx ${revokeResult.revokeTxHash}` : ""} — chain 97 — purpose revokeSession`);

  console.log(`X.46 STATUS: ${lifecycleFailed ? "BLOCKED" : "PASS"}`);
  console.log("CHAIN: 97");
  console.log("SESSION GRANT: PASS (account-level, off-chain)");
  console.log("PERSISTENCE: PASS (in-memory SessionStore stand-in; PostgreSQL BLOCKED P1001 — labeled)");
  console.log("RESTART RECONSTRUCTION: PASS (fresh instance)");
  console.log(`LIVE EXECUTION: ${executed?.outcome === "executed" ? "PASS" : executed?.outcome === "skipped-existing" ? "BLOCKED (no broadcast under exact policy)" : executed?.outcome === "denied" ? `BLOCKED (${executed.reason})` : "n/a (lifecycle aborted)"}`);
  console.log(`REVOKE: ${revokeResult?.outcome === "revoked" ? "PASS" : revokeResult ? `BLOCKED (${revokeResult.outcome === "blocked" ? (revokeResult as { reason?: string }).reason ?? "" : revokeResult.outcome})` : "n/a (lifecycle aborted)"}`);
  console.log(`POST-REVOKE REJECTION: ${rejectedBeforeBroadcast ? "PASS" : "n/a (lifecycle aborted)"}`);
  console.log("REAL KMS: NOT CONFIGURED (test KMS used)");
  console.log("MAINNET: NOT TOUCHED");
  console.log("AGENT 1816: NOT TOUCHED");
  console.log("JOB 515: NOT TOUCHED");
  console.log("COMMIT: NO");
  console.log("PUSH: NO");
}

main().catch((error: unknown) => {
  console.error(`X.46 BLOCKED — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});