import { CategoryDashboard } from "@/components/category-dashboard";

export const metadata = { title: "Health Factor Monitoring Agents" };

export default function HealthFactorPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "health-factor",
        title: "Health Factor Monitoring",
        description:
          "Keep collateral positions safe with real-time liquidation distance tracking and alerts.",
        metrics: [
          { label: "Total agents", value: "—" },
          { label: "Avg health factor", value: "—" },
          { label: "Liquidation distance", value: "—" },
          { label: "Alerts triggered", value: "—" },
        ],
      }}
    />
  );
}
