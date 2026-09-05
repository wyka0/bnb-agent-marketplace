import { hireActivationApi, type HireApiDeps } from "./hire.api.ts";
import type { HireActivationOutcome } from "./hire.server.ts";
import type { AuthenticatedIdentity } from "../auth/types.ts";
import type { PublicSessionView } from "../altana-session/view.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";

const TEST_AGENT: Scan8004Agent = {
  id: "x65-test-agent",
  agent_id: "97:0x1111111111111111111111111111111111111111:65001",
  token_id: "65001",
  chain_id: 97,
  chain_type: "evm",
  contract_address: "0x1111111111111111111111111111111111111111",
  is_testnet: true,
  owner_id: "x65-owner",
  owner_address: "0x2222222222222222222222222222222222222222",
  owner_ens: null,
  owner_username: "TEST FIXTURE",
  owner_avatar_url: null,
  owner_publisher_tier: null,
  owner_certified_name: null,
  name: "X.65 TEST FIXTURE AGENT",
  description: "Offline verifier fixture. Never served by the production route.",
  image_url: null,
  is_verified: true,
  star_count: 0,
  supported_protocols: ["MCP"],
  x402_supported: true,
  total_score: 0,
  rank: null,
  network_rank: null,
  health_score: null,
  total_feedbacks: 0,
  average_score: 0,
  cross_chain_versions: null,
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

const ORIGIN = "http://localhost:3000";
const CSRF = "x65-csrf-token";
const identity: AuthenticatedIdentity = {
  userId: "x65-user",
  walletId: "x65-wallet",
  walletAddress: "0x1111111111111111111111111111111111111111",
  chainId: 97,
  sessionId: "x65-auth-session",
  sessionExpiresAt: new Date("2027-01-01T00:00:00Z"),
  lastUsedAt: new Date("2026-08-17T00:00:00Z"),
};

const consentDigest = `0x${"12".repeat(32)}`;
const actionable: HireActivationOutcome = {
  classifier: "ACTIVATABLE",
  agentId: TEST_AGENT.agent_id,
  chainId: 97,
  available: true,
  reviewJson: {
    state: "REVIEWED",
    chainId: 97,
    action: "TEST FIXTURE review — no broadcast",
    amount: "1",
  },
  consent: { consentDigest, reviewRef: `0x${"34".repeat(32)}`, state: "PINNED" },
  quote: { available: true, reason: "TEST FIXTURE quote" },
};

const unavailable: HireActivationOutcome = {
  classifier: "NOT_ACTIVATABLE",
  agentId: TEST_AGENT.agent_id,
  chainId: 56,
  reason: "unsupported-chain",
  detail: "Mainnet is not supported for activation.",
  available: false,
};

const safeSession: PublicSessionView = {
  sessionId: "x65-altana-session",
  chainId: 97,
  walletAddress: identity.walletAddress,
  status: "active",
  keyStoreActive: true,
  createdAt: "2026-08-17T00:00:00Z",
  updatedAt: "2026-08-17T00:00:00Z",
  expiresAt: "2026-08-18T00:00:00Z",
  revokedAt: null,
  lastVerifiedAt: "2026-08-17T00:00:00Z",
  lastReconstructedAt: null,
  spentRaw: "0",
  remainingRaw: "1",
  permissionLimitRaw: "1",
  nativeFeeLimitRaw: "0",
  permissions: [
    {
      kind: "CALL",
      targetAddress: "0x2222222222222222222222222222222222222222",
      functionSignature: "approve(address,uint256)",
      functionSelector: "0x095ea7b3",
      tokenAddress: null,
      spendCapRaw: null,
      spendPeriod: null,
    },
  ],
  grantCallsId: null,
  registrationCallsId: null,
  registrationTxHash: null,
  revokeCallsId: null,
  revokeTxHash: null,
  agentId: TEST_AGENT.agent_id,
  agentName: TEST_AGENT.name,
  agentSource: "8004scan",
};

function request(body: unknown, csrf = CSRF): Request {
  return new Request(`${ORIGIN}/api/activation/hire`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": csrf,
    },
    body: JSON.stringify(body),
  });
}

function deps(options: {
  outcome?: HireActivationOutcome;
  resolve?: Scan8004Agent | null;
  create?: () => Promise<PublicSessionView>;
} = {}): HireApiDeps {
  return {
    async resolveAgent(agentId) {
      const record = options.resolve === undefined ? TEST_AGENT : options.resolve;
      return record?.agent_id === agentId ? record : null;
    },
    async review() {
      return options.outcome ?? actionable;
    },
    async createSession() {
      return options.create ? options.create() : safeSession;
    },
    mapError(error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "duplicate") return { status: 409, message: "An active session already exists." };
      if (message === "database") return { status: 503, message: "Session persistence is unavailable." };
      return { status: 503, message: "Altana session support is not configured on this deployment." };
    },
  };
}

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
}

async function run() {
  const unauth = await hireActivationApi({ identity: null, request: request({ action: "review", agentId: TEST_AGENT.agent_id }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps() });
  check("unauthenticated user cannot activate", unauth.status === 401);

  const csrf = await hireActivationApi({ identity, request: request({ action: "review", agentId: TEST_AGENT.agent_id }, "wrong"), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps() });
  check("CSRF mismatch is rejected", csrf.status === 403);

  const malformed = await hireActivationApi({ identity, request: request({ action: "activate", agentId: "not-an-agent" }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps() });
  check("malformed identity is rejected", malformed.status === 400);

  const unknown = await hireActivationApi({ identity, request: request({ action: "review", agentId: TEST_AGENT.agent_id }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps({ resolve: null }) });
  check("unknown exact agent is rejected", unknown.status === 404);

  let createCalls = 0;
  const blocked = await hireActivationApi({ identity, request: request({ action: "activate", agentId: TEST_AGENT.agent_id, consentDigest }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps({ outcome: unavailable, create: async () => { createCalls += 1; return safeSession; } }) });
  check("non-actionable agent never creates a session", blocked.status === 409 && createCalls === 0);
  check("no fake ACTIVE when capability unavailable", !JSON.stringify(blocked.body).includes('"status":"active"'));

  const review = await hireActivationApi({ identity, request: request({ action: "review", agentId: TEST_AGENT.agent_id }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps() });
  check("review requires and preserves exact identity", review.status === 200 && JSON.stringify(review.body).includes(TEST_AGENT.agent_id));

  const mismatch = await hireActivationApi({ identity, request: request({ action: "activate", agentId: TEST_AGENT.agent_id, consentDigest: `0x${"00".repeat(32)}` }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps() });
  check("changed review digest cannot activate", mismatch.status === 409);

  const activated = await hireActivationApi({ identity, request: request({ action: "activate", agentId: TEST_AGENT.agent_id, consentDigest }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps() });
  check("confirmed activation returns public session only", activated.status === 201 && JSON.stringify(activated.body).includes("x65-altana-session"));
  const rendered = JSON.stringify(activated.body);
  check("activation response exposes no custody secrets", ["publicKey", "keyId", "privateKey", "ciphertext", "kms", "mnemonic"].every((term) => !rendered.toLowerCase().includes(term.toLowerCase())));
  check("session is bound to exact server-resolved agent", rendered.includes(TEST_AGENT.agent_id) && rendered.includes('"agentSource":"8004scan"'));

  const duplicate = await hireActivationApi({ identity, request: request({ action: "activate", agentId: TEST_AGENT.agent_id, consentDigest }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps({ create: async () => { throw new Error("duplicate"); } }) });
  check("duplicate activation is conflict, not fake success", duplicate.status === 409);

  const database = await hireActivationApi({ identity, request: request({ action: "activate", agentId: TEST_AGENT.agent_id, consentDigest }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps({ create: async () => { throw new Error("database"); } }) });
  check("database failure maps to safe unavailable", database.status === 503 && !JSON.stringify(database.body).includes("DATABASE_URL"));

  const custody = await hireActivationApi({ identity, request: request({ action: "activate", agentId: TEST_AGENT.agent_id, consentDigest }), csrfCookie: CSRF, expectedOrigin: ORIGIN, deps: deps({ create: async () => { throw new Error("custody"); } }) });
  check("custody unavailable never returns ACTIVE", custody.status === 503 && !JSON.stringify(custody.body).includes('"status":"active"'));

  if (failures === 0) console.log("X.65 hire API verifier: 14 checks passed, 0 failed");
  else process.exitCode = 1;
}

void run();
