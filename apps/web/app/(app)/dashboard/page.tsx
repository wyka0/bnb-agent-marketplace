import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@bnb-marketplace/ui";

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

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active agents", value: "0" },
          { label: "Total value", value: "0.00 BNB" },
          { label: "Net P&L", value: "0.00 BNB" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your agents</CardTitle>
          <CardDescription>
            Agents you have hired will appear here with live performance data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No agents hired yet"
            description="Explore the marketplace to discover and hire your first agent."
            action={
              <Link
                href="/marketplace"
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Browse marketplace
              </Link>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
