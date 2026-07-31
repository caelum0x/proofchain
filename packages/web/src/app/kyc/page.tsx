"use client";

import { useMemo } from "react";
import { useKycAccount, useKycDirectory, KYC_LEVEL_LABEL, type KycRecord } from "@/hooks/useKyc";
import { useTableParams, paginate } from "@/hooks/useTableParams";
import { PageHeader, Toolbar, KpiRow, FilterBar, SearchParamsBoundary } from "@/components/page";
import { KycLevelBadge } from "@/components/t6/KycLevelBadge";
import { KycAdminForm } from "@/components/t6/KycAdminForm";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Callout } from "@/components/ui/Callout";
import { Pagination } from "@/components/ui/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatTimestamp } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const PAGE_SIZE = 12;

const LEVEL_FILTERS = [
  { value: "all", label: "All levels" },
  ...[1, 2, 3].map((l) => ({ value: String(l), label: KYC_LEVEL_LABEL[l] })),
];

/**
 * KYC registry: the compliance directory of verified counterparties. Anyone can
 * browse verification levels; KYC providers get an inline console to set/revoke.
 */
function KycPageContent() {
  const account = useKycAccount();
  const directory = useKycDirectory();
  const params = useTableParams();
  const levelFilter = params.get("level");

  const filtered = useMemo<KycRecord[]>(() => {
    const q = params.search.trim().toLowerCase();
    return directory.records.filter((r) => {
      if (q && !r.account.toLowerCase().includes(q)) return false;
      if (levelFilter && levelFilter !== "all" && String(r.level) !== levelFilter) return false;
      return true;
    });
  }, [directory.records, params.search, levelFilter]);

  const pageRows = paginate(filtered, params.page, PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const columns: readonly Column<KycRecord>[] = [
    { id: "account", header: "Account", cell: (r) => <AddressBadge address={r.account} /> },
    { id: "level", header: "Level", cell: (r) => <KycLevelBadge level={r.level} /> },
    {
      id: "provider",
      header: "Provider",
      cell: (r) => (r.provider ? <AddressBadge address={r.provider} /> : <span className="text-faint">—</span>),
    },
    {
      id: "updatedAt",
      header: "Updated",
      align: "right",
      cell: (r) => (
        <span className="text-muted">{r.updatedAt ? formatTimestamp(r.updatedAt) : "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="kyc"
        title="KYC"
        subtitle="Verified-counterparty registry. Verification levels gate access to regulated settlement flows."
        breadcrumbs={[{ label: "Identity" }, { label: "KYC" }]}
      />

      <KpiRow
        items={[
          { label: "Verified accounts", value: directory.records.length, loading: directory.isLoading },
          {
            label: "Your status",
            value: account.deployed ? (account.verified ? KYC_LEVEL_LABEL[account.level] : "Unverified") : "—",
            hintTone: account.verified ? "success" : "warn",
            hint: account.verified ? "Cleared for settlement" : "Not verified",
            loading: account.isLoading,
          },
          {
            label: "Provider access",
            value: account.isAdmin ? "Yes" : "No",
            hint: account.isAdmin ? "You can set KYC levels" : undefined,
          },
        ]}
      />

      {directory.notDeployed ? (
        <Callout tone="warn" title="KYCRegistry not deployed">
          The KYCRegistry contract is not configured on this network.
        </Callout>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Toolbar
              actions={
                <FilterBar>
                  <Select
                    options={LEVEL_FILTERS}
                    value={levelFilter || "all"}
                    onChange={(e) => params.setFilter("level", e.target.value)}
                    aria-label="Filter by level"
                    className="w-40"
                  />
                </FilterBar>
              }
            >
              <Input
                value={params.search}
                onChange={(e) => params.setSearch(e.target.value)}
                placeholder="Search by account address…"
                className="max-w-xs"
                aria-label="Search KYC accounts"
              />
            </Toolbar>
            <DataTable
              columns={columns}
              rows={pageRows}
              getRowKey={(r) => r.account}
              isLoading={directory.isLoading}
              error={directory.isError ? getErrorMessage(directory.error) : null}
              onRetry={directory.refetch}
              emptyTitle="No verified accounts"
              emptyDescription="Accounts appear here once a provider assigns a KYC level."
            />
            {pageCount > 1 ? (
              <Pagination
                page={params.page - 1}
                limit={PAGE_SIZE}
                total={filtered.length}
                onPageChange={(p) => params.setPage(p + 1)}
              />
            ) : null}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Your verification" />
              {account.account ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <AddressBadge address={account.account} />
                  </div>
                  <div className="flex items-center gap-2">
                    <KycLevelBadge level={account.level} />
                    {account.updatedAt ? (
                      <span className="text-xs text-muted">since {formatTimestamp(account.updatedAt)}</span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Connect a wallet to see your KYC status.</p>
              )}
            </Card>

            {account.isAdmin ? (
              <RequireWallet>
                <KycAdminForm onDone={directory.refetch} />
              </RequireWallet>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KycPage() {
  return (
    <SearchParamsBoundary>
      <KycPageContent />
    </SearchParamsBoundary>
  );
}
