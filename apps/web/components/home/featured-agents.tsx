import { Loader2 } from "lucide-react";
import { SectionTitle } from "./section-title";
import { SkeletonAgentCard } from "./skeleton-agent-card";

const SKELETON_COUNT = 6;

export function FeaturedAgents() {
  return (
    <section className="border-y border-border/60 bg-card/30 py-20 lg:py-24">
      <div className="container">
        <SectionTitle
          eyebrow="Featured"
          title="Featured Agents"
          description="Quality agents from the ERC-8004 registry will be featured here once the live registry integration ships."
        />

        <div
          className="mx-auto mt-8 flex w-fit items-center gap-2.5 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          Loading live agents from registry…
          <span className="hidden text-xs text-muted-foreground/80 sm:inline">
            — ready for future 8004scan integration.
          </span>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <SkeletonAgentCard key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
