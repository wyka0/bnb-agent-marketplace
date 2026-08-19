import {
  BNB_TESTNET,
  createPrivateKeySigner,
  signerFromPrivateKey,
} from "@altananetwork/sdk";
import type {
  Call,
  CallPermission,
  Client,
  Session,
  SpendPermission,
  Wallet,
} from "@altananetwork/sdk";
import {
  createPublicClient,
  encodeFunctionData,
  decodeFunctionData,
  getAddress,
  keccak256,
  http,
  type Address,
  type Hex,
} from "viem";
import { createAltanaClient } from "./client.js";

export const ALTANA_SESSION_CHAIN_ID = 97 as const;
export const ALTANA_SESSION_CALL_SIGNATURE = "approve(address,uint256)" as const;
export const ALTANA_SESSION_EXPIRY_SECONDS = 60 * 60;
export const ALTANA_SESSION_SPEND_LIMIT_RAW = 1n;
export const ALTANA_SESSION_APPROVAL_RAW = 1n;
export const ALTANA_SESSION_NATIVE_FEE_LIMIT_WEI = 10_000_000_000_000_000n;

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

export type AltanaSessionPolicy = {
  chainId: 97;
  target: Address;
  signature: typeof ALTANA_SESSION_CALL_SIGNATURE;
  spendToken: Address;
  spendLimitRaw: bigint;
  nativeFeeLimitWei: bigint;
  spendPeriod: SpendPermission["period"];
  expiry: number;
};

export type AltanaSessionPublicSnapshot = {
  chainId: 97;
  agentId: number;
  walletAddress: Address;
  sessionPublicKey: Hex;
  keyId: Hex;
  target: Address;
  functionSignature: string;
  spendToken: Address;
  spendLimitRaw: string;
  spentRaw: string;
  remainingRaw: string;
  expiry: number;
  status: "active" | "expired" | "revoked";
  keyStoreActive: boolean;
  allowanceOwner: Address;
  allowanceSpender: Address;
  allowanceRaw: string;
  stateTransitionVerified: boolean;
  grantCallsId?: Hex;
  registrationCallsId?: Hex;
  registrationTransactionHash?: Hex;
  transactionHash?: Hex;
  revokeTransactionHash?: Hex;
};

export type AltanaSessionManager = {
  readonly client: Client;
  readonly wallet: Wallet;
  readonly policy: AltanaSessionPolicy;
  verifyPrerequisites(): Promise<readonly { label: string; ok: boolean }[]>;
  getPublicSnapshot(): Promise<AltanaSessionPublicSnapshot>;
  grant(): Promise<AltanaSessionPublicSnapshot>;
  preflight(): Promise<readonly { id: number; label: string; ok: boolean }[]>;
  executeQualificationCall(): Promise<AltanaSessionPublicSnapshot>;
  revoke(): Promise<AltanaSessionPublicSnapshot>;
};

function sessionCall(policy: AltanaSessionPolicy, walletAddress: Address): Call {
  return {
    to: policy.target,
    value: 0n,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [walletAddress, ALTANA_SESSION_APPROVAL_RAW],
    }),
  };
}

function selectorFromSignature(signature: string): string {
  return `0x${keccak256(new TextEncoder().encode(signature)).slice(2, 10)}`;
}

export function assertAltanaSessionPolicyCall(policy: AltanaSessionPolicy, call: Call): void {
  if (getAddress(call.to) !== getAddress(policy.target)) {
    throw new Error("X.36 preflight: call target is outside the session allowlist.");
  }
  const data = call.data ?? "0x";
  if (data.slice(0, 10).toLowerCase() !== selectorFromSignature(policy.signature)) {
    throw new Error("X.36 preflight: function selector is outside the session allowlist.");
  }
  const decoded = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data });
  if (decoded.functionName !== "approve" || decoded.args[1] !== ALTANA_SESSION_APPROVAL_RAW) {
    throw new Error("X.36 preflight: calldata does not exactly match the permitted approval.");
  }
  if ((call.value ?? 0n) > policy.spendLimitRaw) {
    throw new Error("X.36 preflight: call value exceeds the session spend cap.");
  }
}

function assertChain(client: Client): void {
  if (client.defaultChainId !== ALTANA_SESSION_CHAIN_ID) {
    throw new Error(`X.36 preflight: expected chain 97, got ${client.defaultChainId}.`);
  }
}

export function buildAltanaSessionPolicy(paymentToken: Address): AltanaSessionPolicy {
  if (ALTANA_SESSION_CHAIN_ID !== BNB_TESTNET.chainId) {
    throw new Error("X.36 configuration error: SDK BNB_TESTNET is not chain 97.");
  }
  return {
    chainId: ALTANA_SESSION_CHAIN_ID,
    target: getAddress(paymentToken),
    signature: ALTANA_SESSION_CALL_SIGNATURE,
    spendToken: getAddress(paymentToken),
    spendLimitRaw: ALTANA_SESSION_SPEND_LIMIT_RAW,
    nativeFeeLimitWei: ALTANA_SESSION_NATIVE_FEE_LIMIT_WEI,
    spendPeriod: "day",
    expiry: Math.floor(Date.now() / 1000) + ALTANA_SESSION_EXPIRY_SECONDS,
  };
}

export function createAltanaSessionManager(opts: {
  adminPrivateKey: `0x${string}`;
  paymentToken: `0x${string}`;
  registry: `0x${string}`;
  agentId?: bigint;
  rpcUrl?: string;
}): AltanaSessionManager {
  const client = createAltanaClient({
    network: "bnb-testnet",
    rpcUrl: opts.rpcUrl,
    defaultChainId: ALTANA_SESSION_CHAIN_ID,
  });
  assertChain(client);
  const adminSigner = signerFromPrivateKey(opts.adminPrivateKey as Hex);
  const policy = buildAltanaSessionPolicy(getAddress(opts.paymentToken));
  const registry = getAddress(opts.registry);
  const agentId = opts.agentId ?? 1816n;
  let wallet: Wallet | undefined;
  let session: Session | undefined;
  let grantCallsId: Hex | undefined;
  let registrationCallsId: Hex | undefined;
  let registrationTransactionHash: Hex | undefined;
  let transactionHash: Hex | undefined;
  let revokeTransactionHash: Hex | undefined;
  let spentRaw = 0n;
  let revoked = false;
  let stateTransitionVerified = false;

  const publicClient = createPublicClient({
    chain: BNB_TESTNET.chain,
    transport: http(opts.rpcUrl ?? BNB_TESTNET.publicRpcUrl),
  });

  async function keyStoreActive(): Promise<boolean> {
    if (wallet === undefined || session === undefined) return false;
    return publicClient.readContract({
      address: BNB_TESTNET.keyStore,
      abi: [
        {
          type: "function",
          name: "isValidKey",
          stateMutability: "view",
          inputs: [
            { name: "user", type: "address" },
            { name: "keyId", type: "bytes32" },
          ],
          outputs: [{ type: "bool" }],
        },
      ],
      functionName: "isValidKey",
      args: [wallet.address, keccak256(session.publicKey)],
    });
  }

  async function allowance(): Promise<bigint> {
    if (wallet === undefined) return 0n;
    return publicClient.readContract({
      address: policy.target,
      abi: ERC20_APPROVE_ABI,
      functionName: "allowance",
      args: [wallet.address, wallet.address],
    });
  }

  async function verifyPrerequisites(): Promise<readonly { label: string; ok: boolean }[]> {
    const chainId = await publicClient.getChainId();
    const [keyStoreCode, controllerCode, tokenCode, registryCode, owner] = await Promise.all([
      publicClient.getBytecode({ address: BNB_TESTNET.keyStore }),
      publicClient.getBytecode({ address: BNB_TESTNET.keyStoreController }),
      publicClient.getBytecode({ address: policy.target }),
      publicClient.getBytecode({ address: registry }),
      publicClient.readContract({
        address: registry,
        abi: [{ type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] }],
        functionName: "ownerOf",
        args: [agentId],
      }),
    ]);
    const checks = [
      { label: "RPC chain ID is 97", ok: chainId === ALTANA_SESSION_CHAIN_ID },
      { label: "SDK KeyStore code exists", ok: keyStoreCode !== undefined && keyStoreCode !== "0x" },
      { label: "SDK KeyStoreController code exists", ok: controllerCode !== undefined && controllerCode !== "0x" },
      { label: "official payment-token code exists", ok: tokenCode !== undefined && tokenCode !== "0x" },
      { label: "ERC-8004 registry code exists", ok: registryCode !== undefined && registryCode !== "0x" },
      { label: `Agent ${agentId.toString()} owner matches Altana admin wallet`, ok: getAddress(owner) === getAddress(adminSigner.address) },
    ];
    const failure = checks.find((check) => !check.ok);
    if (failure) throw new Error(`X.36 prerequisite failed: ${failure.label}`);
    return checks;
  }

  async function snapshot(): Promise<AltanaSessionPublicSnapshot> {
    const current = Math.floor(Date.now() / 1000);
    const active = session !== undefined && !revoked && current < session.expiry && (await keyStoreActive());
    const remaining = policy.spendLimitRaw - spentRaw;
    const walletAddress = wallet?.address ?? adminSigner.address;
    return {
      chainId: ALTANA_SESSION_CHAIN_ID,
      agentId: 1816,
      walletAddress,
      sessionPublicKey: session?.publicKey ?? "0x",
      keyId: session === undefined ? "0x" : keccak256(session.publicKey),
      target: policy.target,
      functionSignature: policy.signature,
      spendToken: policy.spendToken,
      spendLimitRaw: policy.spendLimitRaw.toString(),
      spentRaw: spentRaw.toString(),
      remainingRaw: remaining > 0n ? remaining.toString() : "0",
      expiry: session?.expiry ?? policy.expiry,
      status: revoked ? "revoked" : current >= (session?.expiry ?? policy.expiry) ? "expired" : active ? "active" : "expired",
      keyStoreActive: active,
      allowanceOwner: walletAddress,
      allowanceSpender: walletAddress,
      allowanceRaw: (await allowance()).toString(),
      stateTransitionVerified,
      ...(grantCallsId ? { grantCallsId } : {}),
      ...(registrationCallsId ? { registrationCallsId } : {}),
      ...(registrationTransactionHash ? { registrationTransactionHash } : {}),
      ...(transactionHash ? { transactionHash } : {}),
      ...(revokeTransactionHash ? { revokeTransactionHash } : {}),
    };
  }

  async function grant(): Promise<AltanaSessionPublicSnapshot> {
    assertChain(client);
    wallet = await client.createWallet({ signer: adminSigner });
    const sessionSigner = createPrivateKeySigner();
    const granted = await client.grantSession({
      wallet,
      signer: adminSigner,
      chainId: ALTANA_SESSION_CHAIN_ID,
      permissions: {
        calls: [{ to: policy.target, signature: policy.signature } satisfies CallPermission],
        spend: [
          { limit: policy.nativeFeeLimitWei, period: policy.spendPeriod },
          { limit: policy.spendLimitRaw, period: policy.spendPeriod, token: policy.spendToken },
        ],
      },
      expiry: policy.expiry,
      sessionSigner,
      register: false,
    });
    session = granted;
    const registration = await client.registerSessionKey({
      wallet,
      signer: adminSigner,
      session,
      chainId: ALTANA_SESSION_CHAIN_ID,
    });
    if (!registration.alreadyRegistered) {
      registrationCallsId = registration.callsId;
      registrationTransactionHash = registration.transactionHash;
      if (registration.status !== "CONFIRMED") throw new Error("X.36 KeyStore registration did not confirm.");
    }
    if (!(await keyStoreActive())) throw new Error("X.36 KeyStore registration is not active after confirmation.");
    return snapshot();
  }

  async function executeQualificationCall(): Promise<AltanaSessionPublicSnapshot> {
    assertChain(client);
    if (wallet === undefined || session === undefined) throw new Error("X.36 execution requires a granted session.");
    const current = Math.floor(Date.now() / 1000);
    const call = sessionCall(policy, wallet.address);
    if (current >= session.expiry) throw new Error("X.36 preflight: session is expired.");
    if (revoked || !(await keyStoreActive())) throw new Error("X.36 preflight: session is not active in KeyStore.");
    if (policy.spendLimitRaw <= spentRaw) throw new Error("X.36 preflight: spend cap is exhausted.");
    assertAltanaSessionPolicyCall(policy, call);
    if ((call.value ?? 0n) > policy.spendLimitRaw - spentRaw) throw new Error("X.36 preflight: remaining cap is insufficient.");
    const result = await client.execute({ session, chainId: ALTANA_SESSION_CHAIN_ID, calls: call });
    if (result.status !== "CONFIRMED" || result.transactionHash === undefined) throw new Error(`X.36 session transaction did not confirm: ${result.status}`);
    transactionHash = result.transactionHash;
    const receipt = await publicClient.getTransactionReceipt({ hash: result.transactionHash });
    const approvalTopic = keccak256(new TextEncoder().encode("Approval(address,address,uint256)"));
    const observedApproval = receipt.status === "success" && receipt.logs.some((log) =>
      getAddress(log.address) === getAddress(policy.target) &&
      log.topics[0] === approvalTopic &&
      log.data.endsWith(ALTANA_SESSION_APPROVAL_RAW.toString(16).padStart(64, "0"))
    );
    if (!observedApproval) throw new Error("X.36 post-transaction verification failed: expected Approval event was not observed.");
    stateTransitionVerified = true;
    spentRaw += ALTANA_SESSION_APPROVAL_RAW;
    return snapshot();
  }

  async function preflight(): Promise<readonly { id: number; label: string; ok: boolean }[]> {
    const checks: Array<{ id: number; label: string; ok: boolean }> = [];
    const add = (id: number, label: string, ok: boolean) => {
      checks.push({ id, label, ok });
      if (!ok) throw new Error(`X.36 preflight ${id} failed: ${label}`);
    };
    add(1, "chain ID is 97", client.defaultChainId === ALTANA_SESSION_CHAIN_ID);
    add(2, "Altana wallet exists", wallet !== undefined);
    add(3, "session exists", session !== undefined);
    if (wallet === undefined || session === undefined) return checks;
    add(4, "session wallet matches Altana wallet", session.walletAddress === wallet.address);
    add(5, "session public key is non-empty", session.publicKey.length > 2);
    add(6, "KeyStore registration is active", await keyStoreActive());
    add(7, "session target is allowlisted", session.permissions.calls?.some((call) => "to" in call && getAddress(call.to) === getAddress(policy.target)) === true);
    add(8, "session selector is allowlisted", session.permissions.calls?.some((call) => "signature" in call && call.signature === policy.signature) === true);
    add(9, "token and native-fee spend caps exist", session.permissions.spend?.some((spend) => spend.token === policy.spendToken && spend.limit === policy.spendLimitRaw) === true && session.permissions.spend?.some((spend) => spend.token === undefined && spend.limit === policy.nativeFeeLimitWei) === true);
    add(10, "current spend is within cap", spentRaw <= policy.spendLimitRaw);
    add(11, "remaining spend is positive", policy.spendLimitRaw > spentRaw);
    add(12, "session expiry is in the future", Math.floor(Date.now() / 1000) < session.expiry);
    add(13, "transaction value is within remaining cap", 0n <= policy.spendLimitRaw - spentRaw);
    add(14, "session authorization is active", !revoked && await keyStoreActive());
    const call = sessionCall(policy, wallet.address);
    assertAltanaSessionPolicyCall(policy, call);
    add(15, "calldata is exact", true);
    return checks;
  }

  async function revoke(): Promise<AltanaSessionPublicSnapshot> {
    if (wallet === undefined || session === undefined) throw new Error("X.36 revoke requires a granted session.");
    const result = await client.revokeSession({ wallet, signer: adminSigner, session: session.publicKey, chainId: ALTANA_SESSION_CHAIN_ID });
    if (result.status !== "CONFIRMED") throw new Error(`X.36 revoke did not confirm: ${result.status}`);
    revokeTransactionHash = result.transactionHash;
    revoked = true;
    if (await keyStoreActive()) throw new Error("X.36 post-revoke verification failed: KeyStore key remains active.");
    return snapshot();
  }

  return { client, get wallet() { if (!wallet) throw new Error("Wallet has not been granted."); return wallet; }, policy, verifyPrerequisites, getPublicSnapshot: snapshot, grant, preflight, executeQualificationCall, revoke };
}
