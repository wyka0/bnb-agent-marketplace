/** P12 activation contract. Pure types/normalizers; safe for client type use. */

export const AAVE_AGENT_ID = "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:45381";
export const AAVE_CHAIN_ID = 56;
export const AAVE_SAFE_ACTION = "inspect-supported-chains" as const;

export interface ActivationRequest {
  agentId: string;
  chainId: number;
  action: typeof AAVE_SAFE_ACTION;
}

export interface SupportedChain {
  chainId: number;
  chainName: string;
}

export interface TypedDataPreview {
  domain: unknown | null;
  types: unknown | null;
  primaryType: string | null;
  message: unknown | null;
}

export interface TransactionActionPreview {
  order: number;
  chain: string | number | null;
  destination: string | null;
  value: string | null;
  actionType: string | null;
  description: string | null;
  calldata: string | null;
  typedData: TypedDataPreview | null;
}

export interface PaymentTerms {
  protocol: string | null;
  version: string | number | null;
  network: string | null;
  token: string | null;
  amount: string | null;
  payTo: string | null;
  facilitator: string | null;
  expiry: string | number | null;
  resource: string | null;
  requiredHeaders: string[];
  paymentSignatureRequired: boolean | null;
}

export type ActivationResult =
  | {
      state: "ready";
      agentId: typeof AAVE_AGENT_ID;
      chainId: typeof AAVE_CHAIN_ID;
      bscSupported: true;
      supportedChains: SupportedChain[];
      mcp: { manifest: "ok"; initialize: "ok"; toolsList: "ok"; safeProbe: "ok" };
      paymentRequired: false;
    }
  | {
      state: "transaction-required";
      actions: TransactionActionPreview[];
      signing: "signing-not-enabled";
    }
  | { state: "payment-required"; terms: PaymentTerms }
  | { state: "unsupported"; reason: "wrong-agent" | "unsupported-chain" | "unsupported-action" }
  | {
      state: "error";
      code: "timeout" | "mcp-server-error" | "malformed-response";
      message: string;
    };

export interface SigningBoundaryResult {
  state: "signing-not-enabled";
}

/** Signing is intentionally disabled in P12. */
export function requestUserSignature(_preview: TransactionActionPreview[]): SigningBoundaryResult {
  return { state: "signing-not-enabled" };
}

export function validateActivationRequest(value: unknown): ActivationRequest | ActivationResult {
  if (!isRecord(value)) return unsupported("wrong-agent");
  const allowedKeys = new Set(["agentId", "chainId", "action"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key)))
    return unsupported("unsupported-action");
  if (value.agentId !== AAVE_AGENT_ID) return unsupported("wrong-agent");
  if (value.chainId !== AAVE_CHAIN_ID) return unsupported("unsupported-chain");
  if (value.action !== AAVE_SAFE_ACTION) return unsupported("unsupported-action");
  return { agentId: AAVE_AGENT_ID, chainId: AAVE_CHAIN_ID, action: AAVE_SAFE_ACTION };
}

export function normalizePaymentRequired(body: unknown): ActivationResult {
  const source = isRecord(body) ? body : {};
  const accepts =
    Array.isArray(source.accepts) && isRecord(source.accepts[0]) ? source.accepts[0] : {};
  const resource = isRecord(source.resource) ? source.resource : {};
  const requiredHeaders = Array.isArray(source.requiredHeaders)
    ? source.requiredHeaders.filter((item): item is string => typeof item === "string")
    : [];
  return {
    state: "payment-required",
    terms: {
      protocol:
        text(source.paymentProtocol) ??
        text(source.protocol) ??
        (source.x402Version != null ? "x402" : null),
      version: scalar(source.x402Version),
      network: text(accepts.network),
      token: text(accepts.asset) ?? text(accepts.token),
      amount: text(accepts.amount),
      payTo: text(accepts.payTo),
      facilitator: text(accepts.facilitator) ?? text(source.facilitator),
      expiry: scalar(accepts.expiresAt) ?? scalar(accepts.maxTimeoutSeconds),
      resource: text(resource.url) ?? text(source.resource),
      requiredHeaders,
      paymentSignatureRequired:
        typeof source.paymentSignatureRequired === "boolean"
          ? source.paymentSignatureRequired
          : null,
    },
  };
}

export function normalizeToolResult(
  body: unknown
):
  | { kind: "chains"; chains: SupportedChain[] }
  | { kind: "transaction"; actions: TransactionActionPreview[] }
  | { kind: "malformed" } {
  if (!isRecord(body) || !isRecord(body.result)) return { kind: "malformed" };
  const structured = isRecord(body.result.structuredContent) ? body.result.structuredContent : null;
  if (structured && Array.isArray(structured.data)) {
    const chains = structured.data
      .filter(isSupportedChain)
      .map(({ chainId, chainName }) => ({ chainId, chainName }));
    if (chains.length === structured.data.length) return { kind: "chains", chains };
  }

  const actionContainer = structured ?? body.result;
  const rawActions =
    isRecord(actionContainer) && Array.isArray(actionContainer.apiRequestActions)
      ? actionContainer.apiRequestActions
      : null;
  if (!rawActions || rawActions.length === 0) return { kind: "malformed" };
  const actions = rawActions.map(normalizeAction);
  return actions.every((action): action is TransactionActionPreview => action !== null)
    ? { kind: "transaction", actions }
    : { kind: "malformed" };
}

function normalizeAction(value: unknown, index: number): TransactionActionPreview | null {
  if (!isRecord(value)) return null;
  const request = isRecord(value.request)
    ? value.request
    : isRecord(value.transaction)
      ? value.transaction
      : value;
  const toSign = isRecord(value.toSign) ? value.toSign : null;
  const typedData: TypedDataPreview | null = toSign
    ? {
        domain: toSign.domain ?? null,
        types: toSign.types ?? null,
        primaryType: text(toSign.primaryType),
        message: toSign.message ?? null,
      }
    : null;
  const calldata = text(request.calldata) ?? text(request.data);
  return {
    order: index + 1,
    chain: scalar(request.chainId) ?? text(request.chainName),
    destination: text(request.to) ?? text(request.destination),
    value: text(request.value),
    actionType: text(value.type) ?? text(value.actionType) ?? text(value.method),
    description: text(value.description) ?? text(value.note),
    calldata,
    typedData,
  };
}

function isSupportedChain(value: unknown): value is SupportedChain {
  return (
    isRecord(value) && typeof value.chainId === "number" && typeof value.chainName === "string"
  );
}

function unsupported(
  reason: "wrong-agent" | "unsupported-chain" | "unsupported-action"
): ActivationResult {
  return { state: "unsupported", reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function scalar(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}
