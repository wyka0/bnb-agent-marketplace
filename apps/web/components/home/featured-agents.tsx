"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AgentCard, RegistryBadge } from "@bnb-marketplace/ui";
import type { AgentCardData } from "@bnb-marketplace/ui";
import { SectionTitle } from "./section-title";
import type { MarketplaceDataState } from "@/lib/eight004scan/marketplace";

export function FeaturedAgents({
  cards,
  state,
}: {
  cards: AgentCardData[];
  state: MarketplaceDataState;
}) {
  const router = useRouter();
  const ready = state === "ready" && cards.length > 0;

  return (
    <section className="border-y border-border/60 bg-card/30 py-20 lg:py-24">
      <div className="container">
        <SectionTitle
          eyebrow="Featured"
          title="Featured Agents"
          description={
            ready
              ? "The newest agents from the live ERC-8004 registry, as indexed by 8004scan."
              : state === "missing-key"
                ? "Live agent cards appear once the 8004scan API key is configured on the server — nothing is simulated."
                : "The ERC-8004 registry is unavailable right now — live agent cards will appear when it responds."
          }
        />

        {ready ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <AgentCard
                key={card.registry.tokenId}
                agent={card}
                variant="standard"
                onViewDetails={(agent) => {
                  if (agent.href) router.push(agent.href);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-8 flex w-fit max-w-xl flex-col items-center gap-3 text-center">
            <RegistryBadge state={state === "missing-key" ? "waiting" : "offline"} size="sm" />
            <p className="text-sm text-muted-foreground">
              {state === "missing-key"
                ? "The 8004scan API key is not configured on the server (8004SCAN_API_KEY, server-side only)."
                : "Registry data is temporarily unavailable — please retry shortly."}
            </p>
            <Link
              href="/marketplace"
              className="group inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              Open Marketplace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
