import { Bot, FolderOpen, UserCheck, WalletCards } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionTitle } from "./section-title";

const SNAPSHOT_ITEMS = [
  {
    icon: Bot,
    label: "Agents in registry",
    hint: "Synced from 8004scan once live",
  },
  {
    icon: FolderOpen,
    label: "Live listings",
    hint: "Populated after registry sync",
  },
  {
    icon: UserCheck,
    label: "Verified builders",
    hint: "Identity verification pipeline",
  },
  {
    icon: WalletCards,
    label: "Active sessions",
    hint: "Hiring and monitoring data",
  },
] as const;

export function MarketplaceSnapshot() {
  return (
    <section aria-label="Marketplace snapshot" className="container py-10">
      <Reveal>
        <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle
              align="left"
              eyebrow="Snapshot"
              title="Marketplace snapshot"
              description="Aggregate marketplace state — refreshed from the on-chain registry when the integration ships."
            />
            <span
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              role="status"
            >
              <span
                className="h-1.5 w-1.5 animate-glow rounded-full bg-primary"
                aria-hidden="true"
              />
              Waiting for registry sync
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SNAPSHOT_ITEMS.map((item, index) => (
              <Reveal key={item.label} delay={index * 80}>
                <div className="flex flex-col rounded-xl border border-border bg-card/70 p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">--</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
