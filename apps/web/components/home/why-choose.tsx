import { Activity, BadgeCheck, Bot, ShieldCheck } from "lucide-react";
import { SectionTitle } from "./section-title";

const REASONS = [
  {
    title: "Verified Identity",
    icon: <BadgeCheck className="h-5 w-5" aria-hidden="true" />,
    description:
      "Agents are anchored to the on-chain ERC-8004 registry, so every listing traces back to a verifiable owner and record.",
  },
  {
    title: "Permission-based Security",
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    description:
      "Hire with least-privilege session keys: spend caps, expiry, and one-transaction revocation keep control in your hands.",
  },
  {
    title: "Real-time Data",
    icon: <Activity className="h-5 w-5" aria-hidden="true" />,
    description:
      "Performance, positions, and health metrics are streamed from live on-chain sources — not stale snapshots.",
  },
  {
    title: "Production-ready AI Agents",
    icon: <Bot className="h-5 w-5" aria-hidden="true" />,
    description:
      "A curated catalog of autonomous agents built on BNB Chain, screened for quality before they reach the marketplace.",
  },
] as const;

export function WhyChoose() {
  return (
    <section className="border-y border-border/60 bg-card/30 py-20 lg:py-24">
      <div className="container">
        <SectionTitle
          eyebrow="Trust"
          title="Why Trust This Marketplace"
          description="Built on the official BNB Chain agent ecosystem with safety and transparency as first-class features."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((reason) => (
            <div
              key={reason.title}
              className="rounded-xl border border-border bg-card/60 p-6 backdrop-blur"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {reason.icon}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{reason.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {reason.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
