"use client";

import { ModulePlaceholder } from "@/components/t4/ModulePlaceholder";

export default function BiodiversityPage() {
  return (
    <ModulePlaceholder
      title="Biodiversity"
      subtitle="Biodiversity and habitat-restoration credits with verified ecological outcomes."
      icon="leaf"
      breadcrumbs={[{ label: "Sustainability", href: "/esg" }, { label: "Biodiversity" }]}
      kpis={[
        { label: "Credits issued", hint: "habitat units" },
        { label: "Retired" },
        { label: "Active", hint: "tradable" },
        { label: "Projects" },
      ]}
      description="Biodiversity credits will be tracked on-chain alongside carbon and water once the biodiversity registry contract is deployed on this network."
    />
  );
}
