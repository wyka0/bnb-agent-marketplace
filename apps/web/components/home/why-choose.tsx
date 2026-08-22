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
      "Activation remains fail-closed until execution capability and custody are authoritative; future sessions will be explicitly scoped.",
  },
  {
    title: "Evidence-first Data",
    icon: <Activity className="h-5 w-5" aria-hidden="true" />,
    description:
      "Registry and protocol evidence comes from live sources where available, while unsupported metrics remain Pending or —.",
  },
  {
    title: "Transparent Agent Catalog",
    icon: <Bot className="h-5 w-5" aria-hidden="true" />,
    description:
      "Explore autonomous-agent identities and evidence on BNB Chain without turning descriptions into execution claims.",
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
