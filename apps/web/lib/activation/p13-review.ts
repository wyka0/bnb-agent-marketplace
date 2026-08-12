/** P13 immutable informational review model. It has no execute/sign method. */

import {
  AAVE_AGENT_ID,
  AAVE_CHAIN_ID,
  type PaymentTerms,
  type TransactionActionPreview,
} from "./contract.ts";

export const P13_SAFE_ACTION = "getReservesList" as const;

export interface ActivationReview {
  readonly agentIdentity: typeof AAVE_AGENT_ID;
  readonly actionName: typeof P13_SAFE_ACTION;
  readonly chain: number | null;
  readonly destination: string | null;
  readonly value: string | null;
  readonly payload: string | null;
  readonly paymentRequirement: Readonly<PaymentTerms> | null;
  readonly warnings: readonly string[];
  readonly validation: Readonly<{
    state: "valid" | "invalid-action";
    errors: readonly string[];
  }>;
}

export interface UserApprovalBoundaryResult {
  state: "signing-not-enabled";
}

export function createActivationReview(input: {
  actionName: string;
  action: TransactionActionPreview;
  paymentRequirement?: PaymentTerms | null;
}): ActivationReview {
  const errors: string[] = [];
  if (input.actionName !== P13_SAFE_ACTION) errors.push("invalid-action");
  if (input.action.chain !== AAVE_CHAIN_ID)
    errors.push(input.action.chain == null ? "missing-chain" : "wrong-chain");
  if (input.action.destination === null) errors.push("missing-destination");
  if (input.action.value === null) errors.push("missing-value");
  if (input.action.calldata === null || !/^0x(?:[0-9a-fA-F]{2})*$/.test(input.action.calldata)) {
    errors.push("malformed-calldata");
  }

  const warnings = [
    "Informational review only.",
    "Signing is intentionally disabled in P13.",
    ...(errors.length > 0
      ? ["Action must not proceed until every validation error is resolved."]
      : []),
  ];
  return Object.freeze({
    agentIdentity: AAVE_AGENT_ID,
    actionName: P13_SAFE_ACTION,
    chain: typeof input.action.chain === "number" ? input.action.chain : null,
    destination: input.action.destination,
    value: input.action.value,
    payload: input.action.calldata,
    paymentRequirement: input.paymentRequirement
      ? Object.freeze({ ...input.paymentRequirement })
      : null,
    warnings: Object.freeze(warnings),
    validation: Object.freeze({
      state: errors.length === 0 ? "valid" : "invalid-action",
      errors: Object.freeze(errors),
    }),
  });
}

/** Signing is intentionally disabled in P13. */
export function requestUserApproval(_review: ActivationReview): UserApprovalBoundaryResult {
  return { state: "signing-not-enabled" };
}
