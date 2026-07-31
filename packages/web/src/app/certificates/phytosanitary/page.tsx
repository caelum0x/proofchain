import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { CertificatesView } from "@/components/t3/CertificatesView";

/** Compliance › Certificates › Phytosanitary certificates. */
export default function PhytosanitaryCertificatesPage() {
  return (
    <SearchParamsBoundary>
      <CertificatesView
        title="Phytosanitary certificates"
        subtitle="Plant-health documents required for agricultural exports."
        breadcrumbs={[
          { label: "Compliance", href: "/compliance" },
          { label: "Certificates", href: "/certificates" },
          { label: "Phytosanitary" },
        ]}
        kind="phytosanitary"
      />
    </SearchParamsBoundary>
  );
}
