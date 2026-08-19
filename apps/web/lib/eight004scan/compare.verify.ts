import {
  MAX_COMPARE_AGENTS,
  addCompareAgent,
  parseCompareIds,
  removeCompareAgent,
  serializeCompareAgents,
} from "./compare.ts";
import type { LeaderboardAgent } from "./leaderboard-types.ts";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}

// Labeled test fixtures only. These never enter a runtime registry result.
const agent = (id: number): LeaderboardAgent =>
  ({
    slug: `56:0x000000000000000000000000000000000000000${id}:${id}`,
    name: `TEST FIXTURE ${id}`,
  }) as LeaderboardAgent;

const a = agent(1);
const b = agent(2);
const c = agent(3);
const d = agent(4);

const two = addCompareAgent(addCompareAgent([], a), b);
check("two distinct agents can be selected", two.length === 2);
const three = addCompareAgent(two, c);
check("three distinct agents can be selected", three.length === MAX_COMPARE_AGENTS);
check("duplicate identities are prevented", addCompareAgent(three, a) === three);
check("fourth agent is rejected at max three", addCompareAgent(three, d) === three);
const removed = removeCompareAgent(three, b.slug);
check("one agent can be removed", removed.length === 2 && !removed.some((x) => x.slug === b.slug));
check("comparison can be cleared", removeCompareAgent(removed, a.slug).filter((x) => x.slug !== c.slug).length === 0);
const serialized = serializeCompareAgents(three);
check("selection serializes exact registry identities", serialized === [a.slug, b.slug, c.slug].join(","));
check("URL selection round-trips", JSON.stringify(parseCompareIds(serialized)) === JSON.stringify([a.slug, b.slug, c.slug]));
check("URL duplicate identities collapse", parseCompareIds(`${a.slug},${a.slug}`).length === 1);
check("URL input is capped at three", parseCompareIds(`${a.slug},${b.slug},${c.slug},${d.slug}`).length === 3);

if (failures > 0) process.exitCode = 1;
else console.log("X.64 compare verifier: 10 checks passed, 0 failed");
