import { Reveal } from "./reveal";

const ACTIVITY_ROWS = 5;

export function RecentActivity() {
  return (
    <section aria-label="Recent marketplace activity" className="container py-10">
      <Reveal>
        <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Activity
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Recent Marketplace Activity
              </h2>
            </div>
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

          <ul className="mt-8 divide-y divide-border/70">
            {Array.from({ length: ACTIVITY_ROWS }, (_, i) => (
              <li key={i} className="flex items-center gap-4 py-4" aria-hidden="true">
                <span className="h-10 w-10 shrink-0 animate-shimmer rounded-full bg-[linear-gradient(110deg,hsl(var(--muted))_8%,hsl(var(--accent))_18%,hsl(var(--muted))_33%)] bg-[length:200%_100%]" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block h-3.5 w-2/5 animate-shimmer rounded-full bg-[linear-gradient(110deg,hsl(var(--muted))_8%,hsl(var(--accent))_18%,hsl(var(--muted))_33%)] bg-[length:200%_100%]" />
                  <span className="block h-3 w-3/5 animate-shimmer rounded-full bg-[linear-gradient(110deg,hsl(var(--muted))_8%,hsl(var(--accent))_18%,hsl(var(--muted))_33%)] bg-[length:200%_100%]" />
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">--</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-muted-foreground">
            Recent hires, listings, and registry events will appear here as the live feed connects.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
