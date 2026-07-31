"use client";

import Link from "next/link";
import { isAddress } from "viem";
import { PageHeader, SearchParamsBoundary } from "@/components/page";
import { AddressBadge, Card, CardHeader, KpiRow, StatusBadge, type Column } from "@/components/ui";
import type { Crumb } from "@/components/ui/Breadcrumbs";
import { useComplianceList } from "@/hooks/useComplianceApi";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { ComplianceList } from "./ComplianceList";
import {
  certificateSchema,
  complianceStatusTone,
  formatDateish,
  titleCase,
  type Certificate,
  type CertificateKind,
} from "./compliance-schemas";
import { downloadCsv, textIncludes, toCsv, type SortKey } from "./list-utils";
import { shortenHex } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "valid", label: "Valid" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

export interface CertificatesViewProps {
  readonly title: string;
  readonly subtitle: string;
  readonly breadcrumbs: readonly Crumb[];
  /** Restrict to a certificate kind; omit for the combined hub. */
  readonly kind?: CertificateKind;
  /** Show quick links to the per-kind pages (hub only). */
  readonly showKindLinks?: boolean;
}

const KIND_LINKS: readonly { href: string; label: string }[] = [
  { href: "/certificates/origin", label: "Origin" },
  { href: "/certificates/phytosanitary", label: "Phytosanitary" },
  { href: "/certificates/halal", label: "Halal" },
];

/**
 * Shared body for the certificates hub and the per-kind pages. Reads validated
 * certificates from the ProofChain API and renders the standard KPI + list
 * template (WD §3). The `kind` filter is applied both as an API param and
 * client-side so the page is correct regardless of backend filtering support.
 */
function CertificatesViewContent({ title, subtitle, breadcrumbs, kind, showKindLinks }: CertificatesViewProps) {
  const params = useT3ListParams({ defaultSort: "expiresAt", defaultDir: "desc" });
  const certs = useComplianceList(
    `certificates-${kind ?? "all"}`,
    "/compliance/certificates",
    certificateSchema,
    kind ? { kind } : undefined,
  );

  const items = kind ? certs.items.filter((c) => (c.kind ?? "").toLowerCase() === kind) : certs.items;
  const valid = items.filter((c) => (c.status ?? "").toLowerCase() === "valid").length;
  const expiring = items.filter((c) => (c.status ?? "").toLowerCase() === "expired").length;

  const columns: Column<Certificate>[] = [
    { id: "id", header: "Certificate", cell: (c) => <span className="font-mono text-xs">{c.id}</span> },
    ...(kind ? [] : [{ id: "kind", header: "Type", sortable: true, cell: (c: Certificate) => titleCase(c.kind) } as Column<Certificate>]),
    {
      id: "batchId",
      header: "Batch",
      className: "hidden md:table-cell",
      cell: (c) => (c.batchId ? <span className="font-mono text-xs text-muted">{shortenHex(c.batchId)}</span> : "—"),
    },
    {
      id: "holder",
      header: "Holder",
      cell: (c) => (c.holder && isAddress(c.holder) ? <AddressBadge address={c.holder} explorer={false} /> : <span className="text-muted">{c.holder ?? "—"}</span>),
    },
    { id: "country", header: "Country", className: "hidden lg:table-cell", cell: (c) => c.country ?? "—" },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (c) => <StatusBadge status={complianceStatusTone(c.status)}>{titleCase(c.status)}</StatusBadge>,
    },
    { id: "expiresAt", header: "Expires", sortable: true, className: "hidden sm:table-cell", cell: (c) => formatDateish(c.expiresAt) },
  ];

  const sortKeyFor = (id: string): ((c: Certificate) => SortKey) | undefined => {
    switch (id) {
      case "kind":
        return (c) => c.kind ?? "";
      case "status":
        return (c) => c.status ?? "";
      case "expiresAt":
        return (c) => String(c.expiresAt ?? "");
      default:
        return undefined;
    }
  };

  const onExport = (rows: readonly Certificate[]) => {
    const csv = toCsv(
      ["id", "kind", "batchId", "holder", "country", "status", "expiresAt"],
      rows.map((c) => [c.id, c.kind ?? "", c.batchId ?? "", c.holder ?? "", c.country ?? "", c.status ?? "", String(c.expiresAt ?? "")]),
    );
    downloadCsv(`certificates-${kind ?? "all"}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader icon="certificate" accentClassName="text-compliance" title={title} subtitle={subtitle} breadcrumbs={breadcrumbs} />

      {showKindLinks ? (
        <div className="flex flex-wrap gap-2">
          {KIND_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-pill border border-border bg-surface px-3 py-1 text-sm text-muted transition-colors hover:border-compliance/50 hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}

      <KpiRow
        items={[
          { label: "Certificates", value: (kind ? items.length : certs.total).toLocaleString(), loading: certs.isLoading },
          { label: "Valid", value: valid.toLocaleString(), hintTone: "success", loading: certs.isLoading },
          { label: "Expired", value: expiring.toLocaleString(), hintTone: expiring > 0 ? "warn" : "neutral", loading: certs.isLoading },
        ]}
      />

      <Card className="space-y-4">
        <CardHeader title="Documents" description="Trade certificates issued for shipments and batches." />
        <ComplianceList
          params={params}
          items={items}
          isLoading={certs.isLoading}
          error={certs.error}
          onRetry={certs.refetch}
          columns={columns}
          getRowKey={(c) => c.id}
          filter={(c, q, status) =>
            (status === "all" || (c.status ?? "").toLowerCase() === status) &&
            (textIncludes(c.id, q) || textIncludes(c.batchId, q) || textIncludes(c.holder, q) || textIncludes(c.issuer, q) || textIncludes(c.country, q))
          }
          sortKeyFor={sortKeyFor}
          statusOptions={STATUS_OPTIONS}
          searchPlaceholder="Search id, batch, holder, country…"
          onExport={onExport}
          emptyTitle="No certificates"
          emptyDescription="Certificates issued via the ProofChain API will appear here."
        />
      </Card>
    </div>
  );
}

/** Certificates hub/per-kind body, self-wrapped in a Suspense boundary for `useSearchParams`. */
export function CertificatesView(props: CertificatesViewProps) {
  return (
    <SearchParamsBoundary>
      <CertificatesViewContent {...props} />
    </SearchParamsBoundary>
  );
}
