"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@bnb-marketplace/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

const NAV_LINKS: readonly { href: string; label: string; external?: boolean }[] = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "https://docs.bnbchain.org", label: "Documentation", external: true },
];

export function HomeNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-6">
        <BrandLogo />

        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href="#search"
            aria-label="Jump to global search"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </a>

          <ThemeToggle />

          <button
            type="button"
            disabled
            title="Wallet connection arrives in a future sprint"
            className="hidden h-10 items-center gap-2 rounded-md border border-border bg-primary/10 px-4 text-sm font-medium text-primary opacity-70 xl:inline-flex"
          >
            Connect Wallet
            <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Coming Soon
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={cn("border-t border-border/60 lg:hidden", open ? "block" : "hidden")}
      >
        <nav className="container flex flex-col gap-1 py-3" aria-label="Mobile">
          {NAV_LINKS.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            )
          )}
          <div className="mt-1 border-t border-border/60 pt-3">
            <button
              type="button"
              disabled
              title="Wallet connection arrives in a future sprint"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-primary/10 px-4 text-sm font-medium text-primary opacity-70"
            >
              Connect Wallet
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Coming Soon
              </span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
