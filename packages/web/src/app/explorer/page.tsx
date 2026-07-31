import { BatchList } from "@/components/t1/BatchList";

/**
 * Overview → Explorer: the public batch explorer. Every registered batch, its AI
 * attestation verdict, and settlement state — searchable, filterable, shareable.
 */
export default function ExplorerPage() {
  return (
    <BatchList
      basePath="/explorer"
      sectionLabel="Overview"
      breadcrumbLabel="Explorer"
      title="Batch Explorer"
      subtitle="Every registered batch, its AI attestation verdict, and settlement state."
      accentClassName="text-brand"
    />
  );
}
