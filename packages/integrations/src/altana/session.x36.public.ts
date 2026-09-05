import type { AltanaSessionPublicSnapshot } from "./session.js";

/** Public-only evidence from the confirmed and revoked X.36 session. */
export const X36_ALTANA_SESSION_PUBLIC: AltanaSessionPublicSnapshot = {
  chainId: 97,
  agentId: 1816,
  walletAddress: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
  sessionPublicKey:
    "0x0496f94ee735e7fe01b551402352bc7dcafb332ab07b809b0367501de23d793a0ffda523869f85bfcf99a0fcececfbac44cdc397b1f02021b28bc203fca5af606f",
  keyId: "0x3f443a25f9fb6b47be34eecebc9e76bb8a2d29927bd53bfee6601c92751513c9",
  target: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
  functionSignature: "approve(address,uint256)",
  spendToken: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
  spendLimitRaw: "1",
  spentRaw: "1",
  remainingRaw: "0",
  expiry: 1786743899,
  status: "revoked",
  keyStoreActive: false,
  allowanceOwner: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
  allowanceSpender: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
  allowanceRaw: "0",
  stateTransitionVerified: true,
  transactionHash: "0x054e0c2d9fee11554ac48704a309c0e7a04f5afb96a17d6b00c0f69a5eae742e",
  revokeTransactionHash: "0x82d0497a4a89fd3c9b603e6dd9e11ce9053b130f6880f21a292ec7440bb9b211",
};
