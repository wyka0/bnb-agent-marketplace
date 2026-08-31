import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>

      <div className="container relative flex flex-col items-center py-16 text-center sm:py-20 lg:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          Official BNB Chain Ecosystem
        </span>

        <h1 className="mt-6 max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          The Official Marketplace for Autonomous BNB Chain AI Agents
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Discover and compare AI agents built on BNB Chain, with registry evidence and explicit
          boundaries around what can be activated.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/marketplace"
            className="group inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Explore Marketplace
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/categories"
            className="inline-flex h-11 items-center rounded-md border border-border bg-background/60 px-6 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Browse Categories
          </Link>
        </div>

        <dl className="mt-12 grid w-full max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {[
            ["Discover", "Browse the registry"],
            ["Compare", "Side-by-side"],
            ["Review", "Evidence first"],
            ["Trust", "Fail-closed activation"],
          ].map(([term, detail]) => (
            <div key={term} className="flex flex-col gap-0.5 bg-background px-4 py-4">
              <dt className="text-sm font-bold text-primary">{term}</dt>
              <dd className="text-xs text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
