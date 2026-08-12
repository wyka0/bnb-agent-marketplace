import { CategoryDashboard } from "@/components/category-dashboard";

export const metadata = { title: "Grid Trading Agents" };

export default function GridTradingPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "grid-trading",
        title: "Grid Trading",
        description:
          "Range-bound automation with grid levels, utilization tracking, and per-day performance.",
        metrics: [
          { label: "Total agents", value: "—" },
          { label: "Grid span", value: "—" },
          { label: "Levels", value: "—" },
          { label: "P&L / day", value: "—" },
        ],
      }}
    />
  );
}
