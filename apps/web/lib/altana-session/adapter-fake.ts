/**
 * X.45 fake adapter — an in-memory mini-chain for offline verification.
 *
 * The fake simulates the Altana account-contract validator semantics for
 * the X.36 demonstrated policy: calls are only honored while the session key
 * is registered and not revoked, the call matches a granted CallPermission
 * (target + selector) exactly, the amount equals the permitted approval,
 * and the token spend cap is not exceeded. On a qualifying execution it
 * simulates the token allowance state and emits a synthetic Approval log
 * with the exact same shape the real receipt check consumes.
 *
 * The session signer itself is REAL (@altananetwork/sdk createPrivateKeySigner),
 * so reconstruction cryptography is genuine. Test-only; never used by the
 * server entry.
 */

import { createPrivateKeySigner } from "@altananetwork/sdk";
import { encodeFunctionData, getAddress, keccak256, type Hex } from "viem";
import {
  ALTANA_SESSION_APPROVAL_RAW,
  ALTANA_SESSION_CHAIN_ID,
} from "@bnb-marketplace/integrations/altana";
import { ERC20_ABI } from "./adapter.ts";
import { SessionExecutionError } from "./types.ts";
import type {
  AdapterSession,
  AdapterSessionSigner,
  AltanaSessionAdapter,
  GrantSessionResult,
  SessionCall,
} from "./types.ts";

export const APPROVAL_EVENT_TOPIC = keccak256(new TextEncoder().encode("Approval(address,address,uint256)")) as Hex;

export type FakeAltanaChainState = {
  grantCount: number;
  executeCount: number;
  revokeCount: number;
  registered: boolean;
  revoked: boolean;
  allowance: bigint;
  spent: bigint;
  tokenSpendCap: bigint;
  failNextRegister: boolean;
  simulateKeyStoreOutage: boolean;
  revokeIneffective: boolean;
};

function selectorFromSignature(signature: string): string {
  return `0x${keccak256(new TextEncoder().encode(signature)).slice(2, 10)}`;
}

export function createFakeAltanaSessionAdapter(initial: Partial<FakeAltanaChainState> = {}): {
  adapter: AltanaSessionAdapter;
  state: FakeAltanaChainState;
} {
  const state: FakeAltanaChainState = {
    grantCount: 0,
    executeCount: 0,
    revokeCount: 0,
    registered: false,
    revoked: false,
    allowance: 0n,
    spent: 0n,
    tokenSpendCap: 1n,
    failNextRegister: false,
    simulateKeyStoreOutage: false,
    revokeIneffective: false,
    ...initial,
  };

  let active: AdapterSession | undefined;

  function checkValidator(session: AdapterSession, call: SessionCall): void {
    if (state.revoked) throw new Error("X.45 fake chain: session key revoked.");
    if (Date.now() / 1000 >= session.expiry) throw new Error("X.45 fake chain: session expired.");
    const calls = session.permissions.calls;
    if (!calls || calls.length === 0) throw new Error("X.45 fake chain: no call permission.");
    const permission = calls[0];
    if (permission === undefined) throw new Error("X.45 fake chain: no call permission.");
    if (getAddress(call.to) !== getAddress(permission.to)) throw new Error("X.45 fake chain: target not permitted.");
    if (call.data.slice(0, 10).toLowerCase() !== selectorFromSignature(permission.signature).toLowerCase()) {
      throw new Error("X.45 fake chain: selector not permitted.");
    }
    if (call.value !== 0n) throw new Error("X.45 fake chain: native value not permitted.");
    if (call.data !== encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [getAddress(session.walletAddress), ALTANA_SESSION_APPROVAL_RAW] })) {
      throw new Error("X.45 fake chain: calldata outside permitted approval.");
    }
    const tokenSpend = session.permissions.spend?.find((spend) => spend.token !== undefined);
    if (tokenSpend && state.spent + ALTANA_SESSION_APPROVAL_RAW > tokenSpend.limit) {
      throw new Error("X.45 fake chain: token spend cap exceeded.");
    }
    if (tokenSpend && state.spent + ALTANA_SESSION_APPROVAL_RAW > state.tokenSpendCap) {
      throw new Error("X.45 fake chain: simulated token spend cap exceeded.");
    }
  }

  return {
    state,

    adapter: {
      chainId: ALTANA_SESSION_CHAIN_ID,

      async adoptWallet() {
        return { walletAddress: getAddress("0x299Ce4113abF88F4997737184aa8A7a3D58AC15C") };
      },

      async grantSession(input): Promise<GrantSessionResult> {
        if (active !== undefined) throw new Error("X.45 fake chain: a session is already active for this wallet.");
        state.grantCount += 1;
        const signer = createPrivateKeySigner();
        const session: AdapterSession = {
          walletAddress: getAddress("0x299Ce4113abF88F4997737184aa8A7a3D58AC15C"),
          publicKey: signer.publicKey,
          expiry: input.expiry,
          permissions: input.permissions,
          signer: signer as unknown as AdapterSessionSigner,
        };
        active = session;
        return { grantCallsId: `0x${state.grantCount.toString(16).padStart(64, "0")}`, session };
      },

      async registerSessionKey(input) {
        if (state.failNextRegister) {
          state.failNextRegister = false;
          throw new Error("X.45 fake chain: registration failed (injected).");
        }
        if (active === undefined || active.publicKey !== input.session.publicKey) {
          throw new Error("X.45 fake chain: cannot register an unknown session.");
        }
        if (!state.registered) {
          state.registered = true;
          state.revoked = false;
        }
        return {
          alreadyRegistered: state.registered,
          callsId: `0x${"r".repeat(64)}`,
          transactionHash: `0x${"1".repeat(64)}`,
          status: "CONFIRMED",
        };
      },

      async isKeyStoreActive(input) {
        if (state.simulateKeyStoreOutage) return false;
        if (active === undefined) return false;
        if (active.publicKey !== input.publicKey) return false;
        if (getAddress(active.walletAddress) !== getAddress(input.walletAddress)) return false;
        return state.registered && !state.revoked;
      },

      async executeSessionCall(input) {
        if (active === undefined) throw new Error("X.45 fake chain: no granted session.");
        try {
          checkValidator(input.session, input.call);
        } catch (error) {
          throw new SessionExecutionError(error instanceof Error ? error.message : "fake validator rejected execution", false);
        }
        state.executeCount += 1;
        state.spent += ALTANA_SESSION_APPROVAL_RAW;
        state.allowance = ALTANA_SESSION_APPROVAL_RAW;
        const amountTail = ALTANA_SESSION_APPROVAL_RAW.toString(16).padStart(64, "0");
        const callTarget = input.session.permissions.calls[0];
        if (callTarget === undefined) throw new Error("X.45 fake chain: no call permission.");
        return {
          status: "CONFIRMED",
          transactionHash: `0x${state.executeCount.toString(16).padStart(64, "0")}`,
          receiptStatus: "success",
          logs: [
            {
              address: getAddress(callTarget.to),
              topics: [APPROVAL_EVENT_TOPIC],
              data: `0x${"0".repeat(128)}${amountTail}`,
            },
          ],
        };
      },

      async revokeSession() {
        state.revokeCount += 1;
        if (!state.revokeIneffective) {
          state.revoked = true;
          state.registered = false;
        }
        return { transactionHash: `0x${"f".repeat(64)}` };
      },

      async readAllowance(input) {
        if (getAddress(input.owner) !== getAddress("0x299Ce4113abF88F4997737184aa8A7a3D58AC15C")) return 0n;
        return state.allowance;
      },

      async readChainId() {
        return ALTANA_SESSION_CHAIN_ID;
      },
    },
  };
}
