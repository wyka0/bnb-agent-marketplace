import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, EmptyState } from "@bnb-marketplace/ui";

export default function AgentsPage() {
  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Agents" }]} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
        <p className="mt-1 text-muted-foreground">All agents across all categories.</p>
      </div>
      <Card>
        <CardContent>
          <EmptyState
            title="No agents to show"
            description="Agent listings arrive with the data layer in a future milestone."
          />
        </CardContent>
      </Card>
    </div>
  );
}
