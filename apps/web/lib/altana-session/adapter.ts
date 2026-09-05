/**
 * X.45 adapter — real @altananetwork/sdk wiring (chain 97 only) and the
 * pure session-signer reconstruction helper used for restart safety.
 *
 * This mirrors the X.36 grant/register/execute/revoke flow (same SDK
 * surfaces, same KeyStore read, same receipt evidence) but WITHOUT the
 * Agent-1816 coupling: no ownerOf(1816) prerequisite, no agentId in any
 * snapshot. The authenticated user's own Altana wallet is adopted.
 */

import {
  BNB_TESTNET,
  createPrivateKeySigner,
  signerFromPrivateKey,
} from "@altananetwork/sdk";
import { createPublicClient, getAddress, http, keccak256, type Hex } from "viem";
import { createAltanaClient } from "@bnb-marketplace/integrations/altana";
import {
  ALTANA_SESSION_CHAIN_ID,
  ALTANA_SESSION_APPROVAL_RAW,
  ALTANA_SESSION_CALL_SIGNATURE,
} from "@bnb-marketplace/integrations/altana";
import {
  SessionExecutionError,
} from "./types.ts";
import type {
  AdapterSession,
  AdapterSessionSigner,
  AltanaSessionAdapter,
  GrantSessionResult,
  RegisterSessionKeyResult,
  SessionExecutionResult,
} from "./types.ts";

const ERC20_ABI = [
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

const KEY_STORE_IS_VALID_KEY_ABI = [
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
] as const;

/**
 * Reconstructs an AdapterSession from persisted material: the custody-
 * decrypted session-signer private key plus the persisted public key,
 * wallet, permissions and expiry. This is the restart-safe inverse of
 * grantSession — no re-grant, no duplicate on-chain key.
 */
export function reconstructAdapterSession(input: {
  privateKey: string;
  walletAddress: string;
  publicKey: string;
  permissions: AdapterSession["permissions"];
  expiry: number;
}): AdapterSession {
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.privateKey)) {
    throw new Error("X.45 reconstruction: persisted session signer is not a valid private key.");
  }
  const signer = signerFromPrivateKey(input.privateKey as Hex);
  return {
    walletAddress: getAddress(input.walletAddress),
    publicKey: input.publicKey,
    expiry: input.expiry,
    permissions: input.permissions,
    signer: signer as unknown as AdapterSessionSigner,
  };
}

export function keyIdOf(publicKey: string): string {
  return keccak256(publicKey as Hex);
}

/**
 * Creates the real chain-97 adapter. `adminPrivateKey` is the Altana admin
 * signer (the authenticated operator wallet's authority). Never call this
 * outside the server boundary; the key is held in memory only.
 */
export function createSdkAltanaSessionAdapter(opts: {
  adminPrivateKey: string;
  rpcUrl?: string;
}): AltanaSessionAdapter {
  if (ALTANA_SESSION_CHAIN_ID !== BNB_TESTNET.chainId) {
    throw new Error("X.45 configuration error: SDK BNB_TESTNET is not chain 97.");
  }
  const client = createAltanaClient({
    network: "bnb-testnet",
    rpcUrl: opts.rpcUrl,
    defaultChainId: ALTANA_SESSION_CHAIN_ID,
  });
  if (client.defaultChainId !== ALTANA_SESSION_CHAIN_ID) {
    throw new Error(`X.45 adapter: expected chain 97, got ${client.defaultChainId}.`);
  }
  const adminSigner = signerFromPrivateKey(opts.adminPrivateKey as Hex);
  const publicClient = createPublicClient({
    chain: BNB_TESTNET.chain,
    transport: http(opts.rpcUrl ?? BNB_TESTNET.publicRpcUrl),
  });
  type SdkWallet = Awaited<ReturnType<typeof client.createWallet>>;
  let wallet: SdkWallet | undefined;

  async function requireWallet(): Promise<SdkWallet> {
    if (wallet === undefined) {
      wallet = await client.createWallet({ signer: adminSigner });
    }
    return wallet;
  }

  return {
    chainId: ALTANA_SESSION_CHAIN_ID,

    async adoptWallet() {
      const adopted = await requireWallet();
      return { walletAddress: getAddress(adopted.address) };
    },

    async grantSession(input): Promise<GrantSessionResult> {
      const adopted = await requireWallet();
      const sessionSigner = createPrivateKeySigner();
      const granted = await client.grantSession({
        wallet: adopted,
        signer: adminSigner,
        chainId: ALTANA_SESSION_CHAIN_ID,
        permissions: {
          calls: input.permissions.calls.map((call) => ({ to: call.to, signature: call.signature })),
          spend: input.permissions.spend.map((spend) =>
            spend.token === undefined
              ? { limit: spend.limit, period: spend.period }
              : { limit: spend.limit, period: spend.period, token: spend.token }
          ),
        },
        expiry: input.expiry,
        sessionSigner,
        register: false,
      });
      const session: AdapterSession = {
        walletAddress: getAddress(granted.walletAddress),
        publicKey: granted.publicKey,
        expiry: granted.expiry,
        permissions: input.permissions,
        signer: sessionSigner as unknown as AdapterSessionSigner,
      };
      if (session.walletAddress !== getAddress(adopted.address)) {
        throw new Error("X.45 grant: granted session wallet does not match the adopted wallet.");
      }
      return { session };
    },

    async registerSessionKey(input): Promise<RegisterSessionKeyResult> {
      const adopted = await requireWallet();
      const registered = await client.registerSessionKey({
        wallet: adopted,
        signer: adminSigner,
        session: input.session as never,
        chainId: ALTANA_SESSION_CHAIN_ID,
      });
      if (registered.alreadyRegistered === true) {
        return { alreadyRegistered: true, callsId: "", transactionHash: "", status: "ALREADY" };
      }
      return {
        alreadyRegistered: false,
        callsId: registered.callsId ?? null,
        transactionHash: registered.transactionHash ?? null,
        status: registered.status,
      };
    },

    async isKeyStoreActive(input) {
      // No in-memory wallet gate: after a restart the process has NOT adopted
      // the wallet yet, and the KeyStore read is fully parameterized by the
      // input. Gating on the cached wallet would reconcile an ACTIVE session
      // to REVOKED every time a fresh process reconstructed it (X.46 live
      // finding). KeyStore is authoritative; the read speaks for itself.
      return publicClient.readContract({
        address: BNB_TESTNET.keyStore,
        abi: KEY_STORE_IS_VALID_KEY_ABI,
        functionName: "isValidKey",
        args: [getAddress(input.walletAddress), keyIdOf(input.publicKey) as Hex],
      });
    },

    async executeSessionCall(input): Promise<SessionExecutionResult> {
      let result: Awaited<ReturnType<typeof client.execute>>;
      try {
        result = await client.execute({
          session: input.session as never,
          chainId: ALTANA_SESSION_CHAIN_ID,
          calls: [
            {
              to: getAddress(input.call.to),
              value: input.call.value,
              data: input.call.data,
            },
          ],
        });
      } catch {
        // The SDK may have submitted before surfacing an RPC/receipt failure;
        // never classify this as safely pre-broadcast.
        throw new SessionExecutionError("Altana execution outcome is unknown.", true);
      }
      if (result.status !== "CONFIRMED" || result.transactionHash === undefined) {
        throw new SessionExecutionError(`Altana execution did not confirm: ${result.status}`, true);
      }
      let receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>>;
      try {
        receipt = await publicClient.getTransactionReceipt({ hash: result.transactionHash });
      } catch {
        throw new SessionExecutionError("Altana receipt is not available yet.", true);
      }
      return {
        status: result.status,
        transactionHash: result.transactionHash,
        receiptStatus: receipt.status,
        logs: receipt.logs.map((log) => ({
          address: getAddress(log.address),
          topics: log.topics as readonly string[],
          data: log.data,
        })),
      };
    },

    async revokeSession(input) {
      const adopted = await requireWallet();
      const result = await client.revokeSession({
        wallet: adopted,
        signer: adminSigner,
        session: input.publicKey as Hex,
        chainId: ALTANA_SESSION_CHAIN_ID,
      });
      if (result.status !== "CONFIRMED" || result.transactionHash === undefined) {
        throw new Error(`X.45 revoke did not confirm: ${result.status}`);
      }
      return { transactionHash: result.transactionHash };
    },

    async readAllowance(input) {
      return publicClient.readContract({
        address: getAddress(input.token),
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [getAddress(input.owner), getAddress(input.spender)],
      });
    },

    async readChainId() {
      return publicClient.getChainId();
    },
  };
}

export { ALTANA_SESSION_CALL_SIGNATURE, ALTANA_SESSION_APPROVAL_RAW, ERC20_ABI };
