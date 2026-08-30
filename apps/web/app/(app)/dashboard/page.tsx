import { Breadcrumbs } from "@/components/breadcrumbs";
import { HiredAgentsDashboard } from "./hired-agents-dashboard";

export default function DashboardPage() {
  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Dashboard" }]} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor your hired agents, positions, and permissions.
        </p>
      </div>

      <HiredAgentsDashboard />
    </div>
  );
}
