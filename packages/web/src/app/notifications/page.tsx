import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/States";
import { NotificationsView } from "@/components/t7/NotificationsView";

export const metadata: Metadata = {
  title: "Notifications — ProofChain",
  description: "Live protocol events across provenance, settlement, and disputes.",
};

export default function NotificationsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading notifications…" />}>
      <NotificationsView />
    </Suspense>
  );
}
