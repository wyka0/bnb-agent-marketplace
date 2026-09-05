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
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the live ERC-8004 registry…"
            aria-label="Search the live ERC-8004 registry"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-search-cancel-button]:hidden"
          />
        </form>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Searches the live ERC-8004 agent registry — results open on the Marketplace.
        </p>
      </div>
    </section>
  );
}
