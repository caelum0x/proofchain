"use client";

import { ModulePlaceholder } from "@/components/t4/ModulePlaceholder";

export default function GreenBondsPage() {
  return (
    <ModulePlaceholder
      title="Green Bonds"
      subtitle="Tokenized green bonds financing verified sustainability projects, with on-chain use-of-proceeds reporting."
      icon="bonds"
      breadcrumbs={[{ label: "Sustainability", href: "/esg" }, { label: "Green Bonds" }]}
      kpis={[
        { label: "Bonds issued", hint: "notional" },
        { label: "Outstanding" },
        { label: "Coupon", hint: "avg APR" },
        { label: "Proceeds deployed" },
      ]}
      description="Green bond issuance and use-of-proceeds tracking will settle through the platform's bond registry once it is deployed on this network. In the meantime, explore live carbon and REC markets."
    />
  );
}
