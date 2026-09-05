/**
 * X.80 — Consent + ERC-8183 job-funded session-gate verifier.
 *
 * Offline, no network, no env, no real provider, no transactions. Proves:
 *   1. The extended consent commitment is canonical/deterministic and binds
 *      every security term (identity, chain, provider, resource, capability,
 *      price, expiry, permissions, intents, funding, jobId, verification).
 *   2. The verified-funded-job validator rejects every invalid case and the
 *      two identity rules (provider === owner, client === marketplace).
 *   3. The 6-state capability classifier distinguishes no/unverified/funded/
 *      expired/invalid/revoked-disputed.
 *   4. evaluateSessionGate enforces all 12 preconditions and NEVER creates a
 *      session; valid evidence + unavailable custody stays safely blocked.
 */

import {
  canonicalizeConsent,
  digestConsentCommitment,
  verifyConsentCommitment,
  type ConsentCommitment,
} from "./consent.commitment.ts";
import { classifyCapability, type CapabilityState } from "./capability-resolution.ts";
import { evaluateSessionGate } from "./session-gate.ts";
import {
  validateVerifiedJob,
  type VerifiedFundedErc8183JobEvidence,
  type JobValidationContext,
} from "./erc8183-job-evidence.ts";
import type { AuthenticatedIdentity } from "../auth/types.ts";

const OWNER = "0x2222222222222222222222222222222222222222";
const CLIENT = "0x3333333333333333333333333333333333333333";
const AGENT_ID = "97:0x1111111111111111111111111111111111111111:65001";
const CHAIN = 97;
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

const gateCtx: JobValidationContext = {
  expectedAgentOwner: OWNER,
  expectedClient: CLIENT,
  expectedChainId: CHAIN,
};

function baseCommitment(): ConsentCommitment {
  return {
    agentIdentity: AGENT_ID,
    chainId: CHAIN,
    provider: OWNER,
    resource: "https://agent.example/erc8183/status",
    executionCapability: "erc8183-hire",
    budget: "1000000000000000000",
    expiresAt: FUTURE,
    permissions: { kinds: ["TOKEN_SPEND"] },
    sessionIntent: true,
    executionIntent: true,
    fundingResponsibility: "marketplace",
    jobId: "42",
    verification: { source: "0xcommerce", method: "onchain:erc8183-job" },
  };
}

function validJob(): VerifiedFundedErc8183JobEvidence {
  return {
    kind: "verified",
    chainId: CHAIN,
    jobId: "42",
    client: CLIENT,
    provider: OWNER,
    agentIdentity: AGENT_ID,
    resource: "https://agent.example/erc8183/status",
    executionCapability: "erc8183-hire",
    budget: "1000000000000000000",
    expiresAt: FUTURE,
    status: "FUNDED",
    verification: {
      source: "0xcommerce",
      method: "onchain:erc8183-job",
      verifiedAt: new Date().toISOString(),
    },
  };
}

function auth(overrides: Partial<AuthenticatedIdentity> = {}): AuthenticatedIdentity {
  return {
    userId: "u1",
    walletId: "w1",
    walletAddress: OWNER,
    chainId: CHAIN,
    sessionId: "s1",
    sessionExpiresAt: new Date(Date.now() + 86_400_000),
    lastUsedAt: new Date(),
    ...overrides,
  };
}

let failures = 0;
function check(label: string, condition: boolean): void {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
}

// ---------------------------------------------------------------------------
// Consent commitment
// ---------------------------------------------------------------------------
function digestChanges(mutate: (c: ConsentCommitment) => ConsentCommitment): boolean {
  const c = baseCommitment();
  const d = digestConsentCommitment(c);
  const changed = mutate(c);
  return digestConsentCommitment(changed) !== d;
}

const c0 = baseCommitment();
const d0 = digestConsentCommitment(c0);

check("consent digest is deterministic", digestConsentCommitment(c0) === d0);
check(
  "consent canonical form is stable",
  canonicalizeConsent(c0) === canonicalizeConsent(baseCommitment())
);
check("consent verifies against its own digest", verifyConsentCommitment(c0, d0));
check("consent rejects a wrong digest", !verifyConsentCommitment(c0, "0".repeat(64)));
check("consent rejects empty digest", !verifyConsentCommitment(c0, ""));

check(
  "consent binds exact agent identity",
  digestChanges((c) => ({ ...c, agentIdentity: "97:0x9999999999999999999999999999999999999999:1" }))
);
check(
  "consent binds chain id",
  digestChanges((c) => ({ ...c, chainId: 56 }))
);
check(
  "consent binds provider",
  digestChanges((c) => ({ ...c, provider: "0x4444444444444444444444444444444444444444" }))
);
check(
  "consent binds resource",
  digestChanges((c) => ({ ...c, resource: "https://other.example/x" }))
);
check(
  "consent binds execution capability",
  digestChanges((c) => ({ ...c, executionCapability: "other" }))
);
check(
  "consent binds price/budget",
  digestChanges((c) => ({ ...c, budget: "2000000000000000000" }))
);
check(
  "consent binds expiry",
  digestChanges((c) => ({ ...c, expiresAt: PAST }))
);
check(
  "consent binds permissions",
  digestChanges((c) => ({ ...c, permissions: { kinds: ["TOKEN_SPEND", "CALL"] } }))
);
check(
  "consent binds session intent",
  digestChanges((c) => ({ ...c, sessionIntent: false }))
);
check(
  "consent binds execution intent",
  digestChanges((c) => ({ ...c, executionIntent: false }))
);
check(
  "consent binds job id",
  digestChanges((c) => ({ ...c, jobId: "43" }))
);
check(
  "consent binds verification method",
  digestChanges((c) => ({
    ...c,
    verification: { source: "0xcommerce", method: "onchain:erc8004" },
  }))
);
check(
  "consent rejects undefined-leaf canonicalization",
  (() => {
    try {
      canonicalizeConsent({ ...c0, budget: undefined as unknown as string });
      return false;
    } catch {
      return true;
    }
  })()
);

// ---------------------------------------------------------------------------
// ERC-8183 job validator
// ---------------------------------------------------------------------------
check("valid funded job passes", validateVerifiedJob(validJob(), gateCtx).ok);
check(
  "missing job id rejected",
  !validateVerifiedJob({ ...validJob(), jobId: "unknown" }, gateCtx).ok
);
check("wrong chain rejected", !validateVerifiedJob({ ...validJob(), chainId: 56 }, gateCtx).ok);
check(
  "wrong provider rejected",
  !validateVerifiedJob(
    { ...validJob(), provider: "0x4444444444444444444444444444444444444444" },
    gateCtx
  ).ok
);
check(
  "wrong client rejected",
  !validateVerifiedJob(
    { ...validJob(), client: "0x5555555555555555555555555555555555555555" },
    gateCtx
  ).ok
);
check(
  "wrong resource rejected",
  !validateVerifiedJob({ ...validJob(), resource: "default" }, gateCtx).ok
);
check(
  "wrong capability rejected",
  !validateVerifiedJob({ ...validJob(), executionCapability: "enabled" }, gateCtx).ok
);
check("expired job rejected", !validateVerifiedJob({ ...validJob(), expiresAt: PAST }, gateCtx).ok);
check(
  "invalid status (OPEN) rejected",
  !validateVerifiedJob({ ...validJob(), status: "OPEN" }, gateCtx).ok
);
check(
  "disputed job rejected",
  !validateVerifiedJob({ ...validJob(), status: "REJECTED" }, gateCtx).ok
);
check(
  "settled job rejected",
  !validateVerifiedJob({ ...validJob(), status: "COMPLETED" }, gateCtx).ok
);
check(
  "refunded/expired job rejected",
  !validateVerifiedJob({ ...validJob(), status: "EXPIRED" }, gateCtx).ok
);
check("malformed evidence (null) rejected", !validateVerifiedJob(null, gateCtx).ok);
check(
  "missing verification source rejected",
  !validateVerifiedJob(
    {
      ...validJob(),
      verification: {
        source: "",
        method: "onchain:erc8183-job",
        verifiedAt: new Date().toISOString(),
      },
    },
    gateCtx
  ).ok
);
check(
  "untrusted verification source rejected",
  !validateVerifiedJob(
    {
      ...validJob(),
      verification: {
        source: "untrusted",
        method: "onchain:erc8183-job",
        verifiedAt: new Date().toISOString(),
      },
    },
    gateCtx
  ).ok
);
check(
  "missing verification method rejected",
  !validateVerifiedJob(
    {
      ...validJob(),
      verification: { source: "0xcommerce", method: "", verifiedAt: new Date().toISOString() },
    },
    gateCtx
  ).ok
);
check("invalid price rejected", !validateVerifiedJob({ ...validJob(), budget: "0" }, gateCtx).ok);

// ---------------------------------------------------------------------------
// Capability classification
// ---------------------------------------------------------------------------
const states: Array<[string, VerifiedFundedErc8183JobEvidence | null, CapabilityState]> = [
  ["null -> no-capability", null, "no-capability"],
  ["OPEN -> unverified-job", { ...validJob(), status: "OPEN" }, "unverified-job"],
  ["EXPIRED -> expired", { ...validJob(), status: "EXPIRED" }, "expired"],
  ["REJECTED -> revoked-disputed", { ...validJob(), status: "REJECTED" }, "revoked-disputed"],
  ["FUNDED valid -> verified-funded", validJob(), "verified-funded"],
  [
    "FUNDED provider-mismatch -> invalid",
    { ...validJob(), provider: "0x4444444444444444444444444444444444444444" },
    "invalid",
  ],
];
for (const [label, job, expected] of states) {
  check(`classify ${label}`, classifyCapability(job, gateCtx) === expected);
}

// ---------------------------------------------------------------------------
// Session gate
// ---------------------------------------------------------------------------
const consent = { commitment: baseCommitment(), digest: d0 };

check(
  "gate: no auth -> reject",
  !evaluateSessionGate({
    identity: null,
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: validJob(),
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: no ownership -> reject",
  !evaluateSessionGate({
    identity: auth({ walletAddress: "" }),
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: validJob(),
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: agent identity mismatch -> reject",
  !evaluateSessionGate({
    identity: auth(),
    agentIdentity: "97:0x9999999999999999999999999999999999999999:2",
    consent,
    verifiedJob: validJob(),
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: consent digest mismatch -> reject",
  !evaluateSessionGate({
    identity: auth(),
    agentIdentity: AGENT_ID,
    consent: { commitment: baseCommitment(), digest: "0".repeat(64) },
    verifiedJob: validJob(),
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: no capability (null job) -> reject",
  !evaluateSessionGate({
    identity: auth(),
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: null,
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: unfunded job (OPEN) -> reject",
  !evaluateSessionGate({
    identity: auth(),
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: { ...validJob(), status: "OPEN" },
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: wrong job (provider) -> reject",
  !evaluateSessionGate({
    identity: auth(),
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: { ...validJob(), provider: "0x4444444444444444444444444444444444444444" },
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: expired job -> reject",
  !evaluateSessionGate({
    identity: auth(),
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: { ...validJob(), expiresAt: PAST },
    custodyAvailable: true,
    gateCtx,
  }).allowed
);
check(
  "gate: custody unavailable -> reject",
  !evaluateSessionGate({
    identity: auth(),
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: validJob(),
    custodyAvailable: false,
    gateCtx,
  }).allowed
);
check(
  "gate: valid evidence + unavailable custody stays blocked",
  evaluateSessionGate({
    identity: auth(),
    agentIdentity: AGENT_ID,
    consent,
    verifiedJob: validJob(),
    custodyAvailable: false,
    gateCtx,
  }).reason === "custody unavailable"
);
const allowed = evaluateSessionGate({
  identity: auth(),
  agentIdentity: AGENT_ID,
  consent,
  verifiedJob: validJob(),
  custodyAvailable: true,
  gateCtx,
});
check(
  "gate: full valid precondition -> allowed",
  allowed.allowed && allowed.state === "verified-funded"
);
check(
  "gate: never fabricates ACTIVE",
  !("session" in allowed) && allowed.allowed === (allowed.state === "verified-funded")
);

if (failures === 0) console.log("X.80 consent+erc8183 session-gate verifier: ALL CHECKS PASSED");
else {
  console.log(`X.80 verifier: ${failures} check(s) failed`);
  process.exitCode = 1;
}

void c0;
