"use client";

import { PageHeader } from "@/components/page";
import { Card, CardHeader, KpiRow, StatusBadge, type Column } from "@/components/ui";
import { useComplianceList } from "@/hooks/useComplianceApi";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { ComplianceList } from "@/components/t3/ComplianceList";
import {
  complianceStatusTone,
  customsSchema,
  formatAmount,
  formatDateish,
  titleCase,
  toNumber,
  type CustomsDeclaration,
} from "@/components/t3/compliance-schemas";
import { downloadCsv, textIncludes, toCsv, type SortKey } from "@/components/t3/list-utils";
import { shortenHex } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "cleared", label: "Cleared" },
  { value: "held", label: "Held" },
  { value: "rejected", label: "Rejected" },
];

function CustomsContent() {
  const params = useT3ListParams({ defaultSort: "declaredAt", defaultDir: "desc" });
  const customs = useComplianceList("customs", "/compliance/customs", customsSchema);

  const cleared = customs.items.filter((c) => (c.status ?? "").toLowerCase() === "cleared").length;
  const held = customs.items.filter((c) => ["held", "rejected"].includes((c.status ?? "").toLowerCase())).length;

  const columns: Column<CustomsDeclaration>[] = [
    { id: "id", header: "Declaration", cell: (c) => <span className="font-mono text-xs">{c.id}</span> },
    {
      id: "batchId",
      header: "Batch",
      className: "hidden md:table-cell",
      cell: (c) => (c.batchId ? <span className="font-mono text-xs text-muted">{shortenHex(c.batchId)}</span> : "—"),
    },
    { id: "hsCode", header: "HS code", sortable: true, cell: (c) => <span className="font-mono">{c.hsCode ?? "—"}</span> },
    {
      id: "route",
      header: "Route",
      className: "hidden lg:table-cell",
      cell: (c) => (c.origin || c.destination ? `${c.origin ?? "—"} → ${c.destination ?? "—"}` : "—"),
    },
    {
      id: "value",
      header: "Value",
      align: "right",
      sortable: true,
      cell: (c) => <span className="font-mono tabular-nums">{formatAmount(c.value, c.currency)}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (c) => <StatusBadge status={complianceStatusTone(c.status)}>{titleCase(c.status)}</StatusBadge>,
    },
    { id: "declaredAt", header: "Declared", sortable: true, className: "hidden sm:table-cell", cell: (c) => formatDateish(c.declaredAt) },
  ];

  const sortKeyFor = (id: string): ((c: CustomsDeclaration) => SortKey) | undefined => {
    switch (id) {
      case "hsCode":
        return (c) => c.hsCode ?? "";
      case "value":
        return (c) => toNumber(c.value) ?? 0;
      case "status":
        return (c) => c.status ?? "";
      case "declaredAt":
        return (c) => String(c.declaredAt ?? "");
      default:
        return undefined;
    }
  };

  const onExport = (rows: readonly CustomsDeclaration[]) => {
    const csv = toCsv(
      ["id", "batchId", "hsCode", "origin", "destination", "value", "currency", "status", "declaredAt"],
      rows.map((c) => [c.id, c.batchId ?? "", c.hsCode ?? "", c.origin ?? "", c.destination ?? "", String(c.value ?? ""), c.currency ?? "", c.status ?? "", String(c.declaredAt ?? "")]),
    );
    downloadCsv("customs.csv", csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="customs"
        accentClassName="text-compliance"
        title="Customs"
        subtitle="Import/export declarations and clearance status."
        breadcrumbs={[{ label: "Compliance", href: "/compliance" }, { label: "Customs" }]}
      />

      <KpiRow
        items={[
          { label: "Declarations", value: customs.total.toLocaleString(), loading: customs.isLoading },
          { label: "Cleared", value: cleared.toLocaleString(), hintTone: "success", loading: customs.isLoading },
          { label: "Held / rejected", value: held.toLocaleString(), hintTone: held > 0 ? "warn" : "neutral", loading: customs.isLoading },
        ]}
      />

      <Card className="space-y-4">
        <CardHeader title="Declarations" description="Customs filings for cross-border shipments." />
        <ComplianceList
          params={params}
          items={customs.items}
          isLoading={customs.isLoading}
          error={customs.error}
          onRetry={customs.refetch}
          columns={columns}
          getRowKey={(c) => c.id}
          filter={(c, q, status) =>
            (status === "all" || (c.status ?? "").toLowerCase() === status) &&
            (textIncludes(c.id, q) || textIncludes(c.hsCode, q) || textIncludes(c.origin, q) || textIncludes(c.destination, q) || textIncludes(c.batchId, q))
          }
          sortKeyFor={sortKeyFor}
          statusOptions={STATUS_OPTIONS}
          searchPlaceholder="Search id, HS code, route…"
          onExport={onExport}
          emptyTitle="No declarations"
          emptyDescription="Customs declarations from the ProofChain API will appear here."
        />
      </Card>
    </div>
  );
}

/** Compliance › Customs declarations (WD §3). */
export default function CustomsPage() {
  return (
    <SearchParamsBoundary>
      <CustomsContent />
    </SearchParamsBoundary>
  );
}
