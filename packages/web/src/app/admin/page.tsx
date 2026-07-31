import type { Metadata } from "next";
import { AdminConsole } from "@/components/t7/AdminConsole";

export const metadata: Metadata = {
  title: "Admin — ProofChain",
  description: "Protocol configuration and role-gated access control.",
};

export default function AdminPage() {
  return <AdminConsole />;
}
