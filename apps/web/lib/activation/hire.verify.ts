/**
 * X.6 — HIRE endpoint verification. TEST FIXTURES only, offline, no network,
 * no environment access. Proves the real hire pipeline: exact identity
 * resolution, unknown/non-actionable rejection, the ACTIVATABLE path through
 * prepareErc8183Hire -> canonical calldata -> buildX402LiveReview ->
 * pinX402Consent, fixture rejection, chain-97/$U/payTo/destination/amount/
 * calldata pinning, consent invalidation, secret protection and the no-sign /
 * no-broadcast surface. Every fixture is labeled TEST FIXTURE and can never
 * be served by the production route (it resolves real 8004scan rows only).
 */

import * as hireServerModule from "./hire.server.ts";
import {
  buildHireReviewFromCapability,
  decodeErc8183HireCalldata,
  encodeErc8183HireCalldata,
  findAgentByIdentity,
  hireActivationConfigFromEnv,
  isValidAgentIdentity,
  HireActivationError,
  runHireActivation,
} from "./hire.server.ts";
import { classifyAgentActivation } from "./capability.ts";
import {
  buildX402LiveReview,
  getErc8183Addresses,
  isX402FixtureCalldata,
  pinX402Consent,
  verifyX402Consent,
  X402_FIXTURE_CALLDATA,
  X402_REVIEW_CHAIN_ID,
  X402_REVIEW_TOKEN,
  X402ReviewError,
} from "@bnb-marketplace/integrations/altana";
import { EVM_VERIFIED_AGENT } from "../eight004scan/fixtures.ts";
import type { Scan8004Agent } from "../eight004scan/types.ts";
import type { AgentActivationCapability } from "./capability.ts";

// ---------------------------------------------------------------------------
// Fixtures (clearly labeled — never served by the real route)
// ---------------------------------------------------------------------------

/** PUBLIC TEST-FIXTURE activation addresses (EIP-55 example addresses). */
const FX_ENV = {
  ALTANA_PAYTO: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  ALTANA_FACILITATOR_ADDRESS: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
  ALTANA_OPERATOR_ADDRESS: "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
} as const;

const FX_CONFIG = {
  payTo: FX_ENV.ALTANA_PAYTO,
  facilitator: FX_ENV.ALTANA_FACILITATOR_ADDRESS,
  operator: FX_ENV.ALTANA_OPERATOR_ADDRESS,
} as const;

/** Chain-97 testnet agent record (TEST FIXTURE / NOT LIVE MARKETPLACE DATA). */
const FX_ACTIVATABLE_RECORD: Scan8004Agent = {
  id: "fx-97-01",
  agent_id: "97:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:90001",
  token_id: "90001",
  chain_id: 97,
  chain_type: "evm",
  contract_address: "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
  is_testnet: true,
  owner_id: "fx-owner-1",
  owner_address: "0x" + "ab".repeat(20),
  owner_ens: null,
  owner_username: "fixture",
  owner_avatar_url: null,
  owner_publisher_tier: null,
  owner_certified_name: null,
  name: "X6 Fixture Rebalancer (TEST FIXTURE / NOT LIVE MARKETPLACE DATA)",
  description: "Test fixture agent used to exercise the X.6 hire pipeline.",
  image_url: null,
  is_verified: true,
  star_count: 0,
  supported_protocols: ["MCP"],
  x402_supported: false,
  total_score: 0,
  rank: null,
  network_rank: null,
  health_score: null,
  total_feedbacks: 0,
  average_score: 0,
  cross_chain_versions: null,
  created_at: "2026-08-12T00:00:00Z",
  updated_at: "2026-08-12T00:00:00Z",
};

const FX_CAPABILITY: AgentActivationCapability = {
  kind: "erc8183-hire",
  amount: 250_000_000_000_000_000n,
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3_600),
  jobId: 9_000_000_000_000_000_002n,
  resourceUrl: "https://x6.test.example/activate/fx-rebalancer",
};

const fxRows = [FX_ACTIVATABLE_RECORD, EVM_VERIFIED_AGENT];

function activationOutcome() {
  return runHireActivation(FX_ACTIVATABLE_RECORD, {
    env: FX_ENV,
    capability: FX_CAPABILITY,
    category: "rebalancing",
  });
}

const checks: Array<{ label: string; run: () => boolean | Promise<boolean> }> = [];

// 1. EXACT agent identity resolution ---------------------------------------------
checks.push({
  label: "1 exact agent identity resolution — full agent_id string must match exactly",
  run: () =>
    findAgentByIdentity(fxRows, FX_ACTIVATABLE_RECORD.agent_id)?.agent_id ===
    FX_ACTIVATABLE_RECORD.agent_id,
});
checks.push({
  label: "1b exact identity — a neighboring token id is NOT resolved (no partial match)",
  run: () =>
    findAgentByIdentity(fxRows, "97:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:90002") === null,
});

// 2. UNKNOWN agent rejection -------------------------------------------------------
checks.push({
  label: "2 unknown agent rejection — absent identity resolves to null (typed not-found)",
  run: () =>
    findAgentByIdentity(fxRows, "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:999999") === null,
});
checks.push({
  label: "2b identity format forced — malformed identities are rejected at the boundary",
  run: () =>
    !isValidAgentIdentity(undefined) &&
    !isValidAgentIdentity("") &&
    !isValidAgentIdentity("not-an-identity") &&
    isValidAgentIdentity("97:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:1"),
});

// 3. NON-ACTIONABLE agent rejection -------------------------------------------------
checks.push({
  label: "3 non-actionable agent rejection — mainnet (chain 56) records are NOT_ACTIVATABLE",
  run: async () => {
    const outcome = await runHireActivation(EVM_VERIFIED_AGENT, {
      env: FX_ENV,
      capability: FX_CAPABILITY,
    });
    return (
      outcome.classifier === "NOT_ACTIVATABLE" &&
      outcome.reason === "unsupported-chain" &&
      outcome.available === false &&
      outcome.chainId === 56
    );
  },
});
checks.push({
  label: "3b non-actionable — chain-97 records without a real capability stay CAPABILITY_UNKNOWN",
  run: () =>
    classifyAgentActivation({ chainId: 97, isTestnet: true, agentId: "97:0xdead:1" }).state ===
    "CAPABILITY_UNKNOWN",
});

// X.235-UI-POLISH — truthful future-facing mainnet activation copy.
checks.push({
  label: "3c chain-56 record → NOT_ACTIVATABLE with future-facing mainnet copy (no 'never used')",
  run: () => {
    const r = classifyAgentActivation({ chainId: 56, isTestnet: false, agentId: "56:0xabc:1" });
    return (
      r.state === "NOT_ACTIVATABLE" &&
      r.reason === "unsupported-chain" &&
      r.detail.includes("Mainnet activation is coming soon.") &&
      r.detail.includes("BNB Testnet (chain 97)") &&
      !r.detail.includes("never used") &&
      !r.detail.includes("not the supported activation chain")
    );
  },
});

// 4. ACTIONABLE agent resolution -----------------------------------------------------
checks.push({
  label:
    "4 actionable agent resolution — ACTIVATABLE record + real capability traverses the pipeline",
  run: async () => {
    const outcome = await activationOutcome();
    return outcome.classifier === "ACTIVATABLE" && outcome.available === true;
  },
});

// 5. REAL action passed to the review builder -----------------------------------------
checks.push({
  label: "5 real action passed to review builder — LIVE review + pinned consent produced",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    return (
      outcome.reviewJson.state === "REVIEWED" &&
      outcome.reviewJson.action === `erc8183-hire (LIVE/REAL action, job ${FX_CAPABILITY.jobId})` &&
      outcome.consent.state === "PINNED" &&
      typeof outcome.consent.consentDigest === "string" &&
      outcome.consent.consentDigest.startsWith("0x")
    );
  },
});

// 6. FIXTURE action rejection ---------------------------------------------------------
checks.push({
  label: "6 fixture action rejected — the reviewed batch is never the fixture calldata",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    return (
      outcome.reviewJson.calldata !== X402_FIXTURE_CALLDATA &&
      !isX402FixtureCalldata(outcome.reviewJson.calldata)
    );
  },
});
checks.push({
  label: "6b fixture calldata refused by the LIVE review builder",
  run: () => {
    try {
      buildX402LiveReview({
        kind: "erc8183-settle",
        chainId: X402_REVIEW_CHAIN_ID,
        token: X402_REVIEW_TOKEN,
        amount: FX_CAPABILITY.amount,
        payTo: FX_ENV.ALTANA_PAYTO,
        destination: getErc8183Addresses(X402_REVIEW_CHAIN_ID).router,
        calldata: X402_FIXTURE_CALLDATA,
        facilitator: FX_ENV.ALTANA_FACILITATOR_ADDRESS,
        operator: FX_ENV.ALTANA_OPERATOR_ADDRESS,
        jobId: 1n,
        configuredPayTo: FX_ENV.ALTANA_PAYTO,
      });
      return false;
    } catch (error) {
      return error instanceof X402ReviewError && error.message.includes("fixture calldata");
    }
  },
});

// 7. CHAIN-97 enforcement ---------------------------------------------------------------
checks.push({
  label: "7 chain 97 enforcement — the review builder refuses the mainnet record",
  run: async () => {
    try {
      await buildHireReviewFromCapability(EVM_VERIFIED_AGENT, FX_CAPABILITY, FX_CONFIG, undefined);
      return false;
    } catch (error) {
      return error instanceof HireActivationError && error.message.includes("chain 97");
    }
  },
});

// 8. $U enforcement ----------------------------------------------------------------------
checks.push({
  label: "8 $U enforcement — the reviewed token is exactly the verified chain-97 $U",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    return outcome.reviewJson.token === X402_REVIEW_TOKEN;
  },
});

// 9. PAYTO enforcement ---------------------------------------------------------------------
checks.push({
  label: "9a payTo enforcement — missing facilitator/operator addresses block configuration",
  run: () => hireActivationConfigFromEnv({ ALTANA_PAYTO: FX_ENV.ALTANA_PAYTO }).ok === false,
});
checks.push({
  label: "9b payTo enforcement — review recipient is exactly the configured payTo",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    return outcome.reviewJson.payTo === FX_ENV.ALTANA_PAYTO;
  },
});

// 10. DESTINATION enforcement ---------------------------------------------------------------
checks.push({
  label:
    "10 destination enforcement — hire review targets the verified commerce contract; every batch target is allowlisted",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    const verified = getErc8183Addresses(X402_REVIEW_CHAIN_ID);
    const allowlist = new Set(
      [
        verified.commerce,
        verified.router,
        verified.policy,
        verified.registry,
        verified.paymentToken,
      ].map((address) => address.toLowerCase())
    );
    const targets = decodeErc8183HireCalldata(outcome.reviewJson.calldata);
    return (
      outcome.reviewJson.destination === verified.commerce &&
      targets.length > 0 &&
      targets.every((call) => allowlist.has(call.to))
    );
  },
});

// 11. AMOUNT preservation ---------------------------------------------------------------------
checks.push({
  label: "11 amount preservation — atomic $U amount pinned exactly",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    return outcome.reviewJson.amount === FX_CAPABILITY.amount.toString();
  },
});

// 12. CALLDATA preservation ----------------------------------------------------------------------
checks.push({
  label: "12 calldata preservation — canonical batch round-trips; digest is a pinned keccak",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    const decoded = decodeErc8183HireCalldata(outcome.reviewJson.calldata);
    const reEncoded = encodeErc8183HireCalldata(decoded);
    return (
      reEncoded === outcome.reviewJson.calldata &&
      /^0x(?:[0-9a-f]{2})+$/.test(outcome.reviewJson.calldata) &&
      outcome.reviewJson.calldataDigest.startsWith("0x") &&
      outcome.reviewJson.calldataDigest.length === 66
    );
  },
});
checks.push({
  label: "12b malformed canonical calldata is rejected by the decoder",
  run: () => {
    try {
      decodeErc8183HireCalldata("0x1234");
      return false;
    } catch (error) {
      return error instanceof HireActivationError;
    }
  },
});

// 13. CONSENT digest ------------------------------------------------------------------------------
checks.push({
  label: "13 consent digest — pinned digest verifies against the exact same review",
  run: async () => {
    const result = await buildHireReviewFromCapability(
      FX_ACTIVATABLE_RECORD,
      FX_CAPABILITY,
      FX_CONFIG,
      "rebalancing"
    );
    const consent = pinX402Consent(result.review);
    return (
      consent.consentDigest.length === 66 && verifyX402Consent(result.review, consent) === true
    );
  },
});

// 14. CHANGED action invalidates consent -------------------------------------------------------------
checks.push({
  label: "14 changed action invalidates consent — a single-unit amount change breaks the digest",
  run: async () => {
    const first = await buildHireReviewFromCapability(
      FX_ACTIVATABLE_RECORD,
      FX_CAPABILITY,
      FX_CONFIG,
      "rebalancing"
    );
    const consent = pinX402Consent(first.review);
    const changed = await buildHireReviewFromCapability(
      FX_ACTIVATABLE_RECORD,
      { ...FX_CAPABILITY, amount: FX_CAPABILITY.amount + 1n },
      FX_CONFIG,
      "rebalancing"
    );
    return verifyX402Consent(changed.review, consent) === false;
  },
});

// 15. Server-only secret protection -------------------------------------------------------------------
checks.push({
  label: "15 server-only secret protection — no credential or key string reaches the response",
  run: async () => {
    const outcome = await activationOutcome();
    const rendered = JSON.stringify(outcome);
    const banned = [
      "privateKey",
      "PRIVATE_KEY",
      "secret",
      "credential",
      "mnemonic",
      "FACILITATOR_KEY",
      "API_KEY",
      "ALTANA_TESTNET",
      "X-PAYMENT",
    ];
    return banned.every((term) => !rendered.includes(term));
  },
});

// 16. NO automatic signing / broadcast -------------------------------------------------------------------
checks.push({
  label: "16a no automatic signing/broadcast — the hire module exports no sign/broadcast surface",
  run: () => {
    const banned = [
      "sign",
      "signature",
      "broadcast",
      "sendTransaction",
      "settle",
      "submit",
      "withdraw",
      "transfer",
      "execute",
    ];
    const declared = Object.keys(hireServerModule);
    const verbHits = declared.filter((name) =>
      banned.some((term) => name.toLowerCase().includes(term))
    );
    const payNames = declared.filter((name) => name.toLowerCase().includes("pay"));
    return (
      verbHits.length === 0 && payNames.length === 1 && payNames[0] === "createHirePaymentGuard"
    );
  },
});
checks.push({
  label: "16b no automatic signing/broadcast — the pipeline emits no tx hash or signature",
  run: async () => {
    const outcome = await activationOutcome();
    if (outcome.classifier !== "ACTIVATABLE" || !outcome.available) return false;
    const rendered = JSON.stringify(outcome);
    return !rendered.includes("txHash") && !rendered.includes("signature");
  },
});

// -----------------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------------

async function main(): Promise<void> {
  const results: Array<{ ok: boolean; label: string }> = [];
  for (const check of checks) {
    let ok = false;
    try {
      ok = (await check.run()) === true;
    } catch {
      ok = false;
    }
    results.push({ ok, label: check.label });
    console.log(`${ok ? "PASS" : "FAIL"}  ${check.label}`);
  }
  const failed = results.filter((entry) => !entry.ok);
  console.log(
    `\nX.6 hire endpoint verify: ${results.length - failed.length}/${results.length} checks passed`
  );
  console.log("SIGNING: NOT PERFORMED   BROADCAST: NOT PERFORMED   PAYMENT: NOT PERFORMED");
  if (failed.length > 0) {
    console.error("X.6 hire endpoint verify FAILED.");
    process.exit(1);
  }
}

void main();
