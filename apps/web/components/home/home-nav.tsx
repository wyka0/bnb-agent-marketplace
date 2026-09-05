"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@bnb-marketplace/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { AuthControls } from "@/components/auth-controls";

const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/compare", label: "Compare" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export function HomeNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-8">
        <BrandLogo />

        <nav
          className="hidden flex-1 items-center gap-1 border-l border-border/60 pl-6 lg:flex"
          aria-label="Main"
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/marketplace?focus=1"
            aria-label="Search marketplace"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>

          <ThemeToggle />

          <div className="hidden xl:block">
            <AuthControls />
          </div>

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
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-1 border-t border-border/60 pt-3">
            <AuthControls />
          </div>
        </nav>
      </div>
    </header>
  );
}
