import type { Metadata } from "next";
import { ReportsDashboard } from "@/components/t7/ReportsDashboard";

export const metadata: Metadata = {
  title: "Reports — ProofChain",
  description: "Operational analytics and exportable activity reports across the protocol.",
};

export default function ReportsPage() {
  return <ReportsDashboard />;
}
