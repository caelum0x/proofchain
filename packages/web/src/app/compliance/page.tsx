"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/page";
import { Callout, Card, CardHeader, KpiRow, StatusBadge } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useComplianceKyc } from "@/hooks/useComplianceKyc";
import { KycStatusCard } from "@/components/t3/KycStatusCard";
import { kycLevelLabel } from "@/components/t3/compliance-schemas";
import { getResolvedAddress } from "@/lib/shared";

interface Section {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: IconName;
}

const SECTIONS: readonly Section[] = [
  { href: "/sanctions", label: "Sanctions screening", description: "Screen counterparties against KYC and watchlists.", icon: "shield" },
  { href: "/aml", label: "AML monitoring", description: "KYC tiers and risk from the registry event log.", icon: "shield" },
  { href: "/certificates", label: "Certificates", description: "Origin, phytosanitary, and halal trade documents.", icon: "certificate" },
  { href: "/customs", label: "Customs", description: "Import/export declarations and clearance status.", icon: "customs" },
  { href: "/duties", label: "Duties & tariffs", description: "Duty rates and a landed-cost calculator.", icon: "fees" },
  { href: "/export-licenses", label: "Export licenses", description: "Controlled-goods export authorizations.", icon: "docs" },
];

/** Compliance overview (WD §3): connected-wallet KYC + section navigation. */
export default function CompliancePage() {
  const { address, isConnected } = useAccount();
  const kyc = useComplianceKyc(address);
  const registryDeployed = Boolean(getResolvedAddress("KYCRegistry"));

  return (
    <div className="space-y-6">
      <PageHeader
        icon="compliance"
        accentClassName="text-compliance"
        title="Compliance"
        subtitle="Sanctions, AML, trade certificates, customs, duties, and export controls."
        breadcrumbs={[{ label: "Compliance" }]}
      />

      {!registryDeployed ? (
        <Callout tone="warn" title="KYC registry not deployed">
          On-chain KYC/AML checks are unavailable on this network. Trade-document surfaces read from the ProofChain API.
        </Callout>
      ) : null}

      <KpiRow
        items={[
          {
            label: "Your KYC",
            value: isConnected ? (kyc.isVerified ? "Verified" : "Unverified") : "—",
            hint: isConnected ? kycLevelLabel(kyc.level) : "connect wallet",
            hintTone: kyc.isVerified ? "success" : "warn",
            loading: isConnected && kyc.isLoading,
          },
          { label: "Registry", value: registryDeployed ? "Live" : "Offline", hintTone: registryDeployed ? "success" : "danger" },
          { label: "Admin access", value: kyc.isAdmin ? "Yes" : "No", hint: "KYC role" },
          { label: "Sections", value: String(SECTIONS.length), hint: "compliance surfaces" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <KycStatusCard status={kyc} title="Connected wallet" emptyLabel="Connect a wallet to view your KYC status." />
        </div>

        <div className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <Link key={section.href} href={section.href} className="group">
                <Card className="h-full transition-colors group-hover:border-compliance/50">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-compliance">
                      <Icon name={section.icon} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-fg">{section.label}</p>
                      <p className="mt-1 text-sm text-muted">{section.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {kyc.isAdmin ? (
        <Card>
          <CardHeader title="Administrator" description="You hold the KYC admin role." />
          <div className="flex items-center gap-2">
            <StatusBadge status="brand">KYC Admin</StatusBadge>
            <Link href="/aml" className="text-sm text-brand hover:underline">
              Manage KYC in AML monitoring →
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
