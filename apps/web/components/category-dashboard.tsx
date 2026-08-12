import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  EmptyState,
  Input,
} from "@bnb-marketplace/ui";

export interface CategoryDashboardConfig {
  slug: string;
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
}

export function CategoryDashboard({ config }: { config: CategoryDashboardConfig }) {
  return (
    <div className="container py-8">
      <Breadcrumbs
        items={[{ label: "Categories", href: "/categories" }, { label: config.title }]}
      />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{config.title}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{config.description}</p>
        </div>
        <Badge variant="secondary">{config.slug}</Badge>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {config.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="max-w-sm flex-1">
          <Input
            type="search"
            placeholder="Search this category..."
            aria-label={`Search ${config.title}`}
          />
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Rankings</Badge>
          <Badge variant="outline">Featured</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <EmptyState
            title={`${config.title} agents coming soon`}
            description="This category dashboard and its rankings, filters, and featured agents
              will be populated when the catalog data layer ships."
          />
        </CardContent>
      </Card>
    </div>
  );
}
