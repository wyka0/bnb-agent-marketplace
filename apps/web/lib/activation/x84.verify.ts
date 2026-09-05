/**
 * X.84 verifier — ERC-8004 registration-file candidate resolution.
 * Run: `pnpm --filter web activation:x84:verify` (from apps/web)
 *
 * Confirms the resolver ONLY ever emits a self-asserted CANDIDATE (jobBound:false,
 * integrityVerified:false) and NEVER a VerifiedExecutionCapability. It must fail
 * soft (null) on missing URI / read errors / non-object payloads.
 */

import {
  DEFAULT_REGISTRATION_FILE_URL,
  normalizeRegistrationFileCandidate,
  resolveRegistrationFileCandidate,
  type Erc8004RegistrationFile,
  type RegistrationFileReader,
} from "./registration-file-capability.ts";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}`);
  }
}

async function main(): Promise<void> {
  console.log("X.84 — registration-file candidate verification\n");

  check(
    "default URL points at well-known path",
    DEFAULT_REGISTRATION_FILE_URL.endsWith("/.well-known/agent-registration.json")
  );

  // 1. normalize from a self-asserted file
  const file: Erc8004RegistrationFile = {
    agent_id: "agent1",
    services: [
      {
        type: "a2a",
        endpoint: "https://agent.example/a2a",
        skills: ["a2a:chat"],
        mcpTools: ["search"],
        a2aSkills: ["summarize"],
        capabilities: ["cap:x"],
      },
    ],
  };
  const c = normalizeRegistrationFileCandidate("agent1", "https://x/reg.json", file);
  check("candidate resource = endpoint", c.resource === "https://agent.example/a2a");
  check(
    "candidate capability union of declared",
    c.executionCapability.includes("a2a:chat") &&
      c.executionCapability.includes("search") &&
      c.executionCapability.includes("summarize") &&
      c.executionCapability.includes("cap:x")
  );
  check("candidate is NOT job-bound", c.jobBound === false);
  check("candidate integrity NOT verified", c.integrityVerified === false);
  check("candidate authority self-asserted", c.authority === "self-asserted-registration-file");
  check("candidate carries caveats", c.caveats.length >= 3);

  // 2. empty services -> fallback resource + no-capability marker
  const c2 = normalizeRegistrationFileCandidate("agent2", "uri", { services: [] });
  check(
    "empty services -> agent-registration fallback resource",
    c2.resource === "agent-registration:agent2"
  );
  check(
    "empty services -> no-capability marker",
    c2.executionCapability === "self-asserted:no-capability-declared"
  );

  // 3. resolve fails soft on missing URI
  const alwaysNull: RegistrationFileReader = { readRegistrationFile: async () => ({}) };
  const r1 = await resolveRegistrationFileCandidate("agent1", {
    reader: alwaysNull,
    resolveAgentUri: async () => null,
  });
  check("missing URI => null", r1 === null);

  // 4. resolve fails soft on read error
  const errReader: RegistrationFileReader = {
    readRegistrationFile: async () => {
      throw new Error("boom");
    },
  };
  const r2 = await resolveRegistrationFileCandidate("agent1", {
    reader: errReader,
    resolveAgentUri: async () => "https://x/reg.json",
  });
  check("read error => null", r2 === null);

  // 5. resolve fails soft on non-object payload
  const badReader: RegistrationFileReader = { readRegistrationFile: async () => "not-an-object" };
  const r3 = await resolveRegistrationFileCandidate("agent1", {
    reader: badReader,
    resolveAgentUri: async () => "https://x/reg.json",
  });
  check("non-object payload => null", r3 === null);

  // 6. resolve succeeds with injected reader
  const okReader: RegistrationFileReader = { readRegistrationFile: async () => file };
  const r4 = await resolveRegistrationFileCandidate("agent1", {
    reader: okReader,
    resolveAgentUri: async () => "https://x/reg.json",
  });
  check("valid file => candidate", r4 !== null && r4.resource === "https://agent.example/a2a");

  // 7. blank agent id => null
  const r5 = await resolveRegistrationFileCandidate("  ", {
    reader: okReader,
    resolveAgentUri: async () => "https://x/reg.json",
  });
  check("blank agent id => null", r5 === null);

  console.log(`\nX.84 summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("FAILURES:", failures);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("X.84 verifier crashed:", err);
  process.exit(1);
});
