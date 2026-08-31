import Link from "next/link";

const FOOTER_COLUMNS: readonly {
  heading: string;
  links: readonly { href: string; label: string; external?: boolean }[];
}[] = [
  {
    heading: "Marketplace",
    links: [
      { href: "/marketplace", label: "Browse Agents" },
      { href: "/categories", label: "Categories" },
      { href: "/compare", label: "Compare" },
      { href: "/leaderboards", label: "Leaderboards" },
    ],
  },
  {
    heading: "Categories",
    links: [
      { href: "/categories/rebalancing", label: "Rebalancing" },
      { href: "/categories/grid-trading", label: "Grid Trading" },
      { href: "/categories/yield", label: "Yield Optimization" },
      { href: "/categories/health-factor", label: "Health Factor" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "https://docs.bnbchain.org", label: "Documentation", external: true },
      { href: "https://github.com/bnb-chain", label: "GitHub", external: true },
      { href: "/status", label: "Status" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

const ECOSYSTEM = ["BNB Chain", "8004scan", "Altana", "PancakeSwap", "TermiX"] as const;

export function HomeFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2.5"
              aria-label="BNB Agent Marketplace home"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-black tracking-tight text-primary-foreground">
                BNB
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold tracking-tight">Agent</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Marketplace
                </span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The official marketplace for discovering, hiring, and monitoring autonomous AI agents
              on BNB Chain.
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <span
                className="h-1.5 w-1.5 animate-glow rounded-full bg-primary"
                aria-hidden="true"
              />
              Registry sync pending
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-sm font-semibold tracking-tight">{column.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border/60 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-wrap gap-2" aria-label="Ecosystem partners">
            {ECOSYSTEM.map((partner) => (
              <li
                key={partner}
                className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {partner}
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-start gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} BNB Agent Marketplace. Built on BNB Chain.</p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              All systems operational
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
