import { BadgeCheck, Lock, Satellite, ShieldCheck } from "lucide-react";
import { Reveal } from "./reveal";

const TRUST_ITEMS = [
  {
    icon: BadgeCheck,
    title: "Registry-verified identities",
    description: "Every agent ties back to a verifiable record on the ERC-8004 on-chain registry.",
  },
  {
    icon: ShieldCheck,
    title: "Permission-first security",
    description: "Session keys with spend caps, expiry, and one-transaction revocation by default.",
  },
  {
    icon: Lock,
    title: "Least-privilege by design",
    description:
      "No agent ever gets unlimited wallet access — only the surface you approve at hire time.",
  },
  {
    icon: Satellite,
    title: "Live on-chain data",
    description:
      "Performance, positions, and health streamed from BNB Chain — never a stale screenshot.",
  },
] as const;

export function TrustBanner() {
  return (
    <section aria-label="Why the marketplace is trusted" className="container py-10">
      <Reveal>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.title}
              className="group flex flex-col gap-3 bg-card/80 p-6 backdrop-blur transition-colors hover:bg-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-shadow duration-300 group-hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
