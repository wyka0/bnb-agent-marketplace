import { CategoryDashboard } from "@/components/category-dashboard";

export const metadata = { title: "Rebalancing Agents" };

export default function RebalancingPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "rebalancing",
        title: "Rebalancing",
        description:
          "Discover agents that automatically correct portfolio drift and rebalance positions in a fee-efficient way.",
        metrics: [
          { label: "Total agents", value: "—" },
          { label: "Avg rebalance cost", value: "—" },
          { label: "Drift tolerance", value: "—" },
          { label: "Avg monthly cost saved", value: "—" },
        ],
      }}
    />
  );
}
