"use client";

import { isAddress } from "viem";
import { PageHeader } from "@/components/page";
import { AddressBadge, Card, CardHeader, KpiRow, StatusBadge, type Column } from "@/components/ui";
import { useComplianceList } from "@/hooks/useComplianceApi";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { ComplianceList } from "@/components/t3/ComplianceList";
import {
  complianceStatusTone,
  exportLicenseSchema,
  formatDateish,
  titleCase,
  type ExportLicense,
} from "@/components/t3/compliance-schemas";
import { downloadCsv, textIncludes, toCsv, type SortKey } from "@/components/t3/list-utils";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

function ExportLicensesContent() {
  const params = useT3ListParams({ defaultSort: "expiresAt", defaultDir: "desc" });
  const licenses = useComplianceList("export-licenses", "/compliance/export-licenses", exportLicenseSchema);

  const active = licenses.items.filter((l) => (l.status ?? "").toLowerCase() === "active").length;
  const expired = licenses.items.filter((l) => ["expired", "revoked"].includes((l.status ?? "").toLowerCase())).length;

  const columns: Column<ExportLicense>[] = [
    { id: "licenseNumber", header: "License", sortable: true, cell: (l) => <span className="font-mono text-xs">{l.licenseNumber ?? l.id}</span> },
    {
      id: "exporter",
      header: "Exporter",
      cell: (l) => (l.exporter && isAddress(l.exporter) ? <AddressBadge address={l.exporter} explorer={false} /> : <span className="text-fg">{l.exporter ?? "—"}</span>),
    },
    { id: "destination", header: "Destination", className: "hidden md:table-cell", cell: (l) => l.destination ?? "—" },
    { id: "goods", header: "Goods", className: "hidden lg:table-cell", cell: (l) => l.goods ?? "—" },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (l) => <StatusBadge status={complianceStatusTone(l.status)}>{titleCase(l.status)}</StatusBadge>,
    },
    { id: "expiresAt", header: "Expires", sortable: true, className: "hidden sm:table-cell", cell: (l) => formatDateish(l.expiresAt) },
  ];

  const sortKeyFor = (id: string): ((l: ExportLicense) => SortKey) | undefined => {
    switch (id) {
      case "licenseNumber":
        return (l) => l.licenseNumber ?? l.id;
      case "status":
        return (l) => l.status ?? "";
      case "expiresAt":
        return (l) => String(l.expiresAt ?? "");
      default:
        return undefined;
    }
  };

  const onExport = (rows: readonly ExportLicense[]) => {
    const csv = toCsv(
      ["id", "licenseNumber", "exporter", "destination", "goods", "status", "issuedAt", "expiresAt"],
      rows.map((l) => [l.id, l.licenseNumber ?? "", l.exporter ?? "", l.destination ?? "", l.goods ?? "", l.status ?? "", String(l.issuedAt ?? ""), String(l.expiresAt ?? "")]),
    );
    downloadCsv("export-licenses.csv", csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="docs"
        accentClassName="text-compliance"
        title="Export licenses"
        subtitle="Controlled-goods export authorizations and their status."
        breadcrumbs={[{ label: "Compliance", href: "/compliance" }, { label: "Export licenses" }]}
      />

      <KpiRow
        items={[
          { label: "Licenses", value: licenses.total.toLocaleString(), loading: licenses.isLoading },
          { label: "Active", value: active.toLocaleString(), hintTone: "success", loading: licenses.isLoading },
          { label: "Expired / revoked", value: expired.toLocaleString(), hintTone: expired > 0 ? "warn" : "neutral", loading: licenses.isLoading },
        ]}
      />

      <Card className="space-y-4">
        <CardHeader title="Authorizations" description="Export licenses issued for controlled goods." />
        <ComplianceList
          params={params}
          items={licenses.items}
          isLoading={licenses.isLoading}
          error={licenses.error}
          onRetry={licenses.refetch}
          columns={columns}
          getRowKey={(l) => l.id}
          filter={(l, q, status) =>
            (status === "all" || (l.status ?? "").toLowerCase() === status) &&
            (textIncludes(l.licenseNumber, q) || textIncludes(l.exporter, q) || textIncludes(l.destination, q) || textIncludes(l.goods, q))
          }
          sortKeyFor={sortKeyFor}
          statusOptions={STATUS_OPTIONS}
          searchPlaceholder="Search license, exporter, goods…"
          onExport={onExport}
          emptyTitle="No export licenses"
          emptyDescription="Export authorizations from the ProofChain API will appear here."
        />
      </Card>
    </div>
  );
}

/** Compliance › Export licenses (WD §3). */
export default function ExportLicensesPage() {
  return (
    <SearchParamsBoundary>
      <ExportLicensesContent />
    </SearchParamsBoundary>
  );
}
