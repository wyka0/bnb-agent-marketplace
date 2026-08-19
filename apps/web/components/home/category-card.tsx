import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AgentCategory } from "@bnb-marketplace/config";

interface CategoryCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  category: AgentCategory;
  /** Live matched count from bounded BSC discovery; hidden when unavailable. */
  count?: number | null;
}

export function CategoryCard({ title, description, href, icon, category, count }: CategoryCardProps) {
  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-card/60 p-6 backdrop-blur transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {category.replace("-", " ")}
          </span>
          {typeof count === "number" ? (
            <span
              title="Live matched agents from bounded BSC category discovery (8004scan, chain 56)"
              className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              {count.toLocaleString()} matched
            </span>
          ) : null}
        </div>
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>

      <div className="mt-5">
        <Link
          href={href}
          aria-label={`Learn more about ${title} agents`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Explore {title}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}