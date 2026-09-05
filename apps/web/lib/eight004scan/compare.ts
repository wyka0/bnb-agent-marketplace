import type { LeaderboardAgent } from "./leaderboard-types";

export const MAX_COMPARE_AGENTS = 3;

export function parseCompareIds(value: string | null | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_COMPARE_AGENTS
  );
}

export function addCompareAgent(
  selected: LeaderboardAgent[],
  agent: LeaderboardAgent
): LeaderboardAgent[] {
  if (
    selected.length >= MAX_COMPARE_AGENTS ||
    selected.some((item) => item.slug === agent.slug)
  ) {
    return selected;
  }
  return [...selected, agent];
}

export function removeCompareAgent(
  selected: LeaderboardAgent[],
  slug: string
): LeaderboardAgent[] {
  return selected.filter((agent) => agent.slug !== slug);
}

export function serializeCompareAgents(selected: LeaderboardAgent[]): string {
  return selected.slice(0, MAX_COMPARE_AGENTS).map((agent) => agent.slug).join(",");
}
