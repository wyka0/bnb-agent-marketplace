import Link from "next/link";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import { Reveal } from "./reveal";

const COMPARE_ROWS = [
  "Capabilities",
  "Permission surface",
  "Live performance",
  "Fee model",
] as const;

const AGENT_SLOTS = 3;

export function ComparePreview() {
  return (
    <section aria-label="Compare agents preview" className="container py-10">
      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Compare
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Compare agents side by side
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Line up capabilities, permissions, and live performance across any agents once the
                catalog is synced.
              </p>
            </div>
            <Link
              href="/compare"
              className="group inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_28px_-6px_hsl(var(--primary)/0.7)]"
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              Open Compare
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="overflow-x-auto border-t border-border/70">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">
                Comparison preview — agent slots are awaiting registry sync
              </caption>
              <thead>
                <tr className="border-b border-border/70">
                  <th scope="col" className="w-1/4 px-6 py-4 text-left font-semibold">
                    Metric
                  </th>
                  {Array.from({ length: AGENT_SLOTS }, (_, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="px-6 py-4 text-left font-medium text-muted-foreground"
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <span className="h-7 w-7 shrink-0 animate-shimmer rounded-full bg-[linear-gradient(110deg,hsl(var(--muted))_8%,hsl(var(--accent))_18%,hsl(var(--muted))_33%)] bg-[length:200%_100%]" />
                        Agent {String.fromCharCode(65 + i)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, index) => (
                  <tr key={row} className={index % 2 === 1 ? "bg-card/40" : undefined}>
                    <th scope="row" className="px-6 py-4 text-left font-medium">
                      {row}
                    </th>
                    {Array.from({ length: AGENT_SLOTS }, (_, i) => (
                      <td key={i} className="px-6 py-4 tabular-nums text-muted-foreground">
                        --
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
