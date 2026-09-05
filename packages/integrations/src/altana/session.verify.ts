import { encodeFunctionData, getAddress } from "viem";
import { assertAltanaSessionPolicyCall, buildAltanaSessionPolicy } from "./session.js";

const TOKEN = getAddress("0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565");
const OTHER = getAddress("0x1111111111111111111111111111111111111111");
const policy = buildAltanaSessionPolicy(TOKEN);
const abi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }] as const;
const valid = { to: TOKEN, value: 0n, data: encodeFunctionData({ abi, functionName: "approve", args: [OTHER, 1n] }) };

let passed = 0;
function check(label: string, fn: () => void, shouldPass = true): void {
  let ok = true;
  try { fn(); } catch { ok = false; }
  if (ok !== shouldPass) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${label}`);
}

check("allowed target and selector", () => assertAltanaSessionPolicyCall(policy, valid));
check("blocked target", () => assertAltanaSessionPolicyCall(policy, { ...valid, to: OTHER }), false);
check("blocked selector", () => assertAltanaSessionPolicyCall(policy, { ...valid, data: "0x12345678" }), false);
check("spend within cap", () => assertAltanaSessionPolicyCall(policy, valid));
check("spend exceeding cap", () => assertAltanaSessionPolicyCall(policy, { ...valid, value: 2n }), false);
check("exact approval amount", () => assertAltanaSessionPolicyCall(policy, valid));
check("wrong approval amount", () => assertAltanaSessionPolicyCall(policy, { ...valid, data: encodeFunctionData({ abi, functionName: "approve", args: [OTHER, 2n] }) }), false);
check("expiry is bounded and future", () => { if (policy.expiry <= Math.floor(Date.now() / 1000)) throw new Error("expired"); });
check("token-aware cap", () => { if (policy.spendToken !== TOKEN || policy.spendLimitRaw !== 1n) throw new Error("bad cap"); });
check("chain 97 only", () => { if (policy.chainId !== 97) throw new Error("wrong chain"); });

console.log(`Altana session offline verification: ${passed}/10 passed`);
