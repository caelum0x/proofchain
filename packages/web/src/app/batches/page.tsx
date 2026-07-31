import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BatchList } from "@/components/t1/BatchList";

/** Provenance → Batches: every registered batch with live attestation + settlement. */
export default function BatchesPage() {
  return (
    <BatchList
      basePath="/batches"
      sectionLabel="Provenance"
      breadcrumbLabel="Batches"
      title="Batches"
      subtitle="Every registered batch with its live AI attestation and settlement state."
      accentClassName="text-dpp"
      headerActions={
        <Link href="/supplier">
          <Button size="sm">Register batch</Button>
        </Link>
      }
    />
  );
}
