"use client";

import Link from "next/link";
import { Button, Card, CardContent } from "@bnb-marketplace/ui";
import type { LeaderboardAgent } from "@/lib/eight004scan/leaderboard-types";
import { classifyAgentActivation } from "@/lib/activation/capability";

export function HireReviewPanel({ agent }: { agent: LeaderboardAgent }) {
  const classification = classifyAgentActivation({
    chainId: agent.chainId,
    isTestnet: agent.isTestnet,
  });
  const available = classification.state === "ACTIVATABLE";

  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Activation
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {available ? "Available" : "Unavailable"}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{classification.detail}</p>
        {available ? (
          <Button asChild className="mt-4 h-11 w-full">
            <Link href={`/agents/${encodeURIComponent(agent.slug)}/hire`}>Review & Activate</Link>
          </Button>
        ) : (
          <Button type="button" disabled title={classification.detail} className="mt-4 h-11 w-full">
            Activation unavailable
          </Button>
        )}
        <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
          No activation is recorded until the server confirms a real Altana session.
        </p>
      </CardContent>
    </Card>
  );
}
