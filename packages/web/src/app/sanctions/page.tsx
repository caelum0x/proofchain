"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { PageHeader } from "@/components/page";
import { AddressBadge, Button, Callout, Card, CardHeader, Field, Input, KpiRow, StatusBadge, type Column } from "@/components/ui";
import { useAccount } from "wagmi";
import { useComplianceKyc } from "@/hooks/useComplianceKyc";
import { useComplianceList } from "@/hooks/useComplianceApi";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { ComplianceList } from "@/components/t3/ComplianceList";
import { KycStatusCard } from "@/components/t3/KycStatusCard";
import {
  complianceStatusTone,
  formatAmount,
  formatDateish,
  sanctionsHitSchema,
  titleCase,
  toNumber,
  type SanctionsHit,
} from "@/components/t3/compliance-schemas";
import { textIncludes, type SortKey } from "@/components/t3/list-utils";
import { getResolvedAddress } from "@/lib/shared";

const STATUS_OPTIONS = [
  { value: "all", label: "All results" },
  { value: "clear", label: "Clear" },
  { value: "flagged", label: "Flagged" },
  { value: "blocked", label: "Blocked" },
];

function ScreeningTool() {
  const { address: connected } = useAccount();
  const [input, setInput] = useState("");
  const [screened, setScreened] = useState<string | undefined>(undefined);
  const kyc = useComplianceKyc(screened);
  const registryDeployed = Boolean(getResolvedAddress("KYCRegistry"));

  const invalid = input.trim().length > 0 && !isAddress(input.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <CardHeader title="Screen an address" description="Check a counterparty against the on-chain KYC registry." />
        <Field label="Address" htmlFor="screen-addr" error={invalid ? "Enter a valid EVM address" : undefined}>
          <Input
            id="screen-addr"
            placeholder="0x…"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setScreened(input.trim())} disabled={!isAddress(input.trim())}>
            Screen
          </Button>
          {connected ? (
            <Button
              variant="secondary"
              onClick={() => {
                setInput(connected);
                setScreened(connected);
              }}
            >
              Screen my wallet
            </Button>
          ) : null}
        </div>
        {!registryDeployed ? (
          <Callout tone="warn" title="Registry unavailable">
            On-chain KYC checks are not available on this network.
          </Callout>
        ) : screened && kyc.account ? (
          <Callout tone={kyc.isVerified ? "success" : "warn"} title={kyc.isVerified ? "Cleared" : "Not verified"}>
            {kyc.isVerified
              ? "This address holds a valid KYC tier in the registry."
              : "This address has no KYC verification on record. Manual review recommended."}
          </Callout>
        ) : null}
      </Card>

      <KycStatusCard status={kyc} title="Screening result" emptyLabel="Enter an address and run a screen." />
    </div>
  );
}

function SanctionsContent() {
  const params = useT3ListParams({ defaultSort: "screenedAt", defaultDir: "desc" });
  const hits = useComplianceList("sanctions", "/compliance/sanctions", sanctionsHitSchema);

  const flagged = hits.items.filter((h) => {
    const s = (h.status ?? "").toLowerCase();
    return s === "flagged" || s === "blocked";
  }).length;

  const columns: Column<SanctionsHit>[] = [
    { id: "name", header: "Entity", sortable: true, cell: (h) => <span className="text-fg">{h.name ?? "—"}</span> },
    {
      id: "address",
      header: "Address",
      cell: (h) => (h.address && isAddress(h.address) ? <AddressBadge address={h.address} explorer={false} /> : <span className="text-muted">{h.address ?? "—"}</span>),
    },
    { id: "listName", header: "Watchlist", className: "hidden md:table-cell", cell: (h) => h.listName ?? "—" },
    {
      id: "matchScore",
      header: "Match",
      align: "right",
      sortable: true,
      cell: (h) => <span className="font-mono tabular-nums">{formatAmount(h.matchScore)}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (h) => <StatusBadge status={complianceStatusTone(h.status)}>{titleCase(h.status)}</StatusBadge>,
    },
    { id: "screenedAt", header: "Screened", sortable: true, className: "hidden sm:table-cell", cell: (h) => formatDateish(h.screenedAt) },
  ];

  const sortKeyFor = (id: string): ((h: SanctionsHit) => SortKey) | undefined => {
    switch (id) {
      case "name":
        return (h) => h.name ?? "";
      case "matchScore":
        return (h) => toNumber(h.matchScore) ?? 0;
      case "status":
        return (h) => h.status ?? "";
      case "screenedAt":
        return (h) => String(h.screenedAt ?? "");
      default:
        return undefined;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="shield"
        accentClassName="text-compliance"
        title="Sanctions screening"
        subtitle="Screen counterparties against the KYC registry and watchlist results."
        breadcrumbs={[{ label: "Compliance", href: "/compliance" }, { label: "Sanctions" }]}
      />

      <KpiRow
        items={[
          { label: "Screenings", value: hits.total.toLocaleString(), loading: hits.isLoading },
          { label: "Flagged / blocked", value: flagged.toLocaleString(), hintTone: flagged > 0 ? "danger" : "success", loading: hits.isLoading },
          { label: "Registry", value: getResolvedAddress("KYCRegistry") ? "Live" : "Offline", hintTone: getResolvedAddress("KYCRegistry") ? "success" : "danger" },
        ]}
      />

      <ScreeningTool />

      <Card className="space-y-4">
        <CardHeader title="Screening history" description="Watchlist results from the compliance service." />
        <ComplianceList
          params={params}
          items={hits.items}
          isLoading={hits.isLoading}
          error={hits.error}
          onRetry={hits.refetch}
          columns={columns}
          getRowKey={(h) => h.id}
          filter={(h, q, status) =>
            (status === "all" || (h.status ?? "").toLowerCase() === status) &&
            (textIncludes(h.name, q) || textIncludes(h.address, q) || textIncludes(h.listName, q))
          }
          sortKeyFor={sortKeyFor}
          statusOptions={STATUS_OPTIONS}
          searchPlaceholder="Search entity, address, list…"
          emptyTitle="No screening results"
          emptyDescription="Watchlist results from the compliance service will appear here."
        />
      </Card>
    </div>
  );
}

/** Compliance › Sanctions screening (WD §3). */
export default function SanctionsPage() {
  return (
    <SearchParamsBoundary>
      <SanctionsContent />
    </SearchParamsBoundary>
  );
}
