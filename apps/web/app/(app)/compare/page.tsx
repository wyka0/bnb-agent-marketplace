import type { Metadata } from "next";
import { CompareView } from "./compare-view";

export const metadata: Metadata = {
  title: "Compare Agents",
  description: "Compare multiple ERC-8004 agents side-by-side.",
};

export default function ComparePage() {
  return <CompareView />;
}
