import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { CertificatesView } from "@/components/t3/CertificatesView";

/** Compliance › Certificates › Certificates of Origin. */
export default function OriginCertificatesPage() {
  return (
    <SearchParamsBoundary>
      <CertificatesView
        title="Certificates of origin"
        subtitle="Documents attesting the country of origin of traded goods."
        breadcrumbs={[
          { label: "Compliance", href: "/compliance" },
          { label: "Certificates", href: "/certificates" },
          { label: "Origin" },
        ]}
        kind="origin"
      />
    </SearchParamsBoundary>
  );
}
