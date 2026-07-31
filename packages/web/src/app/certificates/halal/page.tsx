import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { CertificatesView } from "@/components/t3/CertificatesView";

/** Compliance › Certificates › Halal certificates. */
export default function HalalCertificatesPage() {
  return (
    <SearchParamsBoundary>
      <CertificatesView
        title="Halal certificates"
        subtitle="Certification that goods comply with halal requirements."
        breadcrumbs={[
          { label: "Compliance", href: "/compliance" },
          { label: "Certificates", href: "/certificates" },
          { label: "Halal" },
        ]}
        kind="halal"
      />
    </SearchParamsBoundary>
  );
}
