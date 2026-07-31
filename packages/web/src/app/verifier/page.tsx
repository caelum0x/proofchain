import { BatchList } from "@/components/t1/BatchList";

/**
 * Provenance → Verifier dashboard. Live provenance, attestation, and settlement
 * state for every batch — the verifier's working queue. Rebuilt on the design
 * system (previously a bespoke table) while preserving the `useBatches` wiring.
 */
export default function VerifierPage() {
  return (
    <BatchList
      basePath="/batches"
      sectionLabel="Provenance"
      breadcrumbLabel="Verifier"
      title="Verifier dashboard"
      subtitle="Live provenance, attestation, and settlement state for every batch."
      accentClassName="text-compliance"
    />
  );
}
