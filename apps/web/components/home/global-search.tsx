"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  return (
    <section id="search" className="container scroll-mt-24 pb-4">
      <div className="mx-auto max-w-2xl">
        <form
          role="search"
          aria-label="Global search"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(
              query.trim() ? `/marketplace?q=${encodeURIComponent(query.trim())}` : "/marketplace"
            );
          }}
          className="relative"
        >
          <Search
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, strategies or categories..."
            aria-label="Search agents, strategies or categories"
            className="h-14 w-full rounded-full border border-border bg-card/70 pl-13 pr-40 text-base text-foreground shadow-lg backdrop-blur transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-search-cancel-button]:appearance-none"
            style={{ paddingLeft: "3.25rem" }}
          />
          <span
            aria-hidden="true"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
          >
            ⌘K
          </span>
        </form>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Searches the live ERC-8004 agent registry — results open on the Marketplace.
        </p>
      </div>
    </section>
  );
}