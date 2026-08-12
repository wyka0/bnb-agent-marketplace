import { CategoryDashboard } from "@/components/category-dashboard";

export const metadata = { title: "Yield Optimization Agents" };

export default function YieldPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "yield",
        title: "Yield Optimization",
        description:
          "Optimize yield across stablecoins and LPs with APY tracking and compounding strategies.",
        metrics: [
          { label: "Total agents", value: "—" },
          { label: "Realized APY", value: "—" },
          { label: "Compounding", value: "—" },
          { label: "Vault health", value: "—" },
        ],
      }}
    />
  );
}
