"use client";

import { useAccount } from "wagmi";
import { PageHeader } from "@/components/page";
import { AddressBadge, Card, CardHeader, KpiRow, StatusBadge, type Column } from "@/components/ui";
import { useComplianceKyc } from "@/hooks/useComplianceKyc";
import { useComplianceKycEvents, type KycAccountRecord } from "@/hooks/useComplianceKycEvents";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { ComplianceList } from "@/components/t3/ComplianceList";
import { SetKycForm } from "@/components/t3/SetKycForm";
import { NotAvailable } from "@/components/t3/NotAvailable";
import { kycLevelLabel, kycLevelTone } from "@/components/t3/compliance-schemas";
import { downloadCsv, textIncludes, toCsv, type SortKey } from "@/components/t3/list-utils";

const STATUS_OPTIONS = [
  { value: "all", label: "All accounts" },
  { value: "verified", label: "Verified" },
  { value: "revoked", label: "Revoked" },
];

function AmlContent() {
  const { address: connected } = useAccount();
  const kyc = useComplianceKyc(connected);
  const params = useT3ListParams({ defaultSort: "level", defaultDir: "desc" });
  const { records, deployed, isLoading, error, refetch } = useComplianceKycEvents();

  const verified = records.filter((r) => r.state === "verified").length;
  const revoked = records.filter((r) => r.state === "revoked").length;
  const institutional = records.filter((r) => r.state === "verified" && r.level >= 3).length;

  const columns: Column<KycAccountRecord>[] = [
    { id: "account", header: "Account", cell: (r) => <AddressBadge address={r.account} /> },
    {
      id: "level",
      header: "KYC tier",
      sortable: true,
      cell: (r) => <StatusBadge status={kycLevelTone(r.level)}>{kycLevelLabel(r.level)}</StatusBadge>,
    },
    {
      id: "state",
      header: "Status",
      sortable: true,
      cell: (r) => (
        <StatusBadge status={r.state === "verified" ? "success" : "danger"}>
          {r.state === "verified" ? "Verified" : "Revoked"}
        </StatusBadge>
      ),
    },
    {
      id: "provider",
      header: "Provider",
      className: "hidden md:table-cell",
      cell: (r) => (r.provider ? <AddressBadge address={r.provider} explorer={false} /> : "—"),
    },
  ];

  const sortKeyFor = (id: string): ((r: KycAccountRecord) => SortKey) | undefined => {
    switch (id) {
      case "level":
        return (r) => r.level;
      case "state":
        return (r) => r.state;
      default:
        return undefined;
    }
  };

  const onExport = (rows: readonly KycAccountRecord[]) => {
    const csv = toCsv(
      ["account", "level", "status", "provider"],
      rows.map((r) => [r.account, kycLevelLabel(r.level), r.state, r.provider ?? ""]),
    );
    downloadCsv("aml-kyc.csv", csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="shield"
        accentClassName="text-compliance"
        title="AML monitoring"
        subtitle="KYC tiers and verification status folded from the registry event log."
        breadcrumbs={[{ label: "Compliance", href: "/compliance" }, { label: "AML" }]}
      />

      {!deployed ? (
        <NotAvailable resource="AML monitoring" reason="The KYCRegistry contract is not deployed for the configured chain." />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Tracked accounts", value: records.length.toLocaleString(), loading: isLoading },
              { label: "Verified", value: verified.toLocaleString(), hintTone: "success", loading: isLoading },
              { label: "Revoked", value: revoked.toLocaleString(), hintTone: revoked > 0 ? "danger" : "neutral", loading: isLoading },
              { label: "Institutional", value: institutional.toLocaleString(), hint: "tier 3", loading: isLoading },
            ]}
          />

          {kyc.isAdmin ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="space-y-4">
                  <CardHeader title="Account register" description="Latest KYC status per account." />
                  <ComplianceList
                    params={params}
                    items={records}
                    isLoading={isLoading}
                    error={error}
                    onRetry={refetch}
                    columns={columns}
                    getRowKey={(r) => r.account}
                    filter={(r, q, status) =>
                      (status === "all" || r.state === status) && (textIncludes(r.account, q) || textIncludes(r.provider, q))
                    }
                    sortKeyFor={sortKeyFor}
                    statusOptions={STATUS_OPTIONS}
                    searchPlaceholder="Search account or provider…"
                    onExport={onExport}
                    emptyTitle="No KYC records"
                    emptyDescription="KYC set/revoke events will appear here."
                  />
                </Card>
              </div>
              <div className="lg:col-span-1">
                <SetKycForm onChanged={refetch} />
              </div>
            </div>
          ) : (
            <Card className="space-y-4">
              <CardHeader title="Account register" description="Latest KYC status per account." />
              <ComplianceList
                params={params}
                items={records}
                isLoading={isLoading}
                error={error}
                onRetry={refetch}
                columns={columns}
                getRowKey={(r) => r.account}
                filter={(r, q, status) =>
                  (status === "all" || r.state === status) && (textIncludes(r.account, q) || textIncludes(r.provider, q))
                }
                sortKeyFor={sortKeyFor}
                statusOptions={STATUS_OPTIONS}
                searchPlaceholder="Search account or provider…"
                onExport={onExport}
                emptyTitle="No KYC records"
                emptyDescription="KYC set/revoke events will appear here."
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** Compliance › AML monitoring (WD §3). */
export default function AmlPage() {
  return (
    <SearchParamsBoundary>
      <AmlContent />
    </SearchParamsBoundary>
  );
}
