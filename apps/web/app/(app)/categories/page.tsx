import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AGENT_CATEGORIES } from "@bnb-marketplace/config";
import { Card, CardDescription, CardHeader, CardTitle } from "@bnb-marketplace/ui";

const categoryMeta: Record<(typeof AGENT_CATEGORIES)[number], string> = {
  rebalancing: "Automatic portfolio drift correction and fee-efficient rebalancing.",
  "grid-trading": "Range-bound market automation with grid levels and take-profits.",
  yield: "Optimized yield vaults and LP strategies.",
  "health-factor": "Liquidation risk monitoring and collateral health alerts.",
};

const categoryHrefs: Record<(typeof AGENT_CATEGORIES)[number], string> = {
  rebalancing: "/categories/rebalancing",
  "grid-trading": "/categories/grid-trading",
  yield: "/categories/yield",
  "health-factor": "/categories/health-factor",
};

export default function CategoriesPage() {
  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Categories" }]} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="mt-1 text-muted-foreground">
          Four equal-priority agent categories, each with a dedicated dashboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {AGENT_CATEGORIES.map((category) => (
          <Link key={category} href={categoryHrefs[category]}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{category.replace("-", " ")}</CardTitle>
                <CardDescription>{categoryMeta[category]}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
