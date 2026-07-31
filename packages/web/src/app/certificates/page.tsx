import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { CertificatesView } from "@/components/t3/CertificatesView";

/** Compliance › Certificates hub — all trade documents with per-kind links. */
export default function CertificatesPage() {
  return (
    <SearchParamsBoundary>
      <CertificatesView
        title="Certificates"
        subtitle="Origin, phytosanitary, and halal trade documents for shipments."
        breadcrumbs={[{ label: "Compliance", href: "/compliance" }, { label: "Certificates" }]}
        showKindLinks
      />
    </SearchParamsBoundary>
  );
}
