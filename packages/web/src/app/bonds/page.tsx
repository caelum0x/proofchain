"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useBondDirectory, useBondAccount, type BondPosition } from "@/hooks/useBond";
import { useTableParams, paginate } from "@/hooks/useTableParams";
import { PageHeader, Toolbar, KpiRow, SearchParamsBoundary } from "@/components/page";
import { BondDepositForm } from "@/components/t6/BondDepositForm";
import { RequireWallet } from "@/components/RequireWallet";
import { Input } from "@/components/ui/Field";
import { Callout } from "@/components/ui/Callout";
import { Meter } from "@/components/ui/Meter";
import { Pagination } from "@/components/ui/Pagination";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const PAGE_SIZE = 10;

/**
 * Performance-bond directory: every supplier that has posted collateral, ranked
 * by total bond, with the locked/unlocked split. The connected account can
 * deposit or withdraw its own bond from the side panel.
 */
function BondsPageContent() {
  const directory = useBondDirectory();
  const account = useBondAccount();
  const params = useTableParams({ defaultSort: { id: "total", dir: "desc" } });

  const filtered = useMemo<BondPosition[]>(() => {
    const q = params.search.trim().toLowerCase();
    let rows = directory.positions.filter((p) => (q ? p.supplier.toLowerCase().includes(q) : true));
    if (params.sort) {
      const { id, dir } = params.sort;
      rows = [...rows].sort((a, b) => {
        const av = id === "locked" ? a.locked : id === "unlocked" ? a.unlocked : a.total;
        const bv = id === "locked" ? b.locked : id === "unlocked" ? b.unlocked : b.total;
        const cmp = av > bv ? 1 : av < bv ? -1 : 0;
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [directory.positions, params.search, params.sort]);

  const totalBonded = useMemo(
    () => directory.positions.reduce((sum, p) => sum + p.total, 0n),
    [directory.positions],
  );
  const totalLocked = useMemo(
    () => directory.positions.reduce((sum, p) => sum + p.locked, 0n),
    [directory.positions],
  );

  const pageRows = paginate(filtered, params.page, PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const columns: readonly Column<BondPosition>[] = [
    {
      id: "supplier",
      header: "Supplier",
      cell: (r) => (
        <Link href={`/suppliers/${r.supplier}`} onClick={(e) => e.stopPropagation()}>
          <AddressBadge address={r.supplier} />
        </Link>
      ),
    },
    {
      id: "total",
      header: "Total bond",
      align: "right",
      sortable: true,
      cell: (r) => <span className="font-mono">{formatTokenAmount(r.total, 18)}</span>,
    },
    {
      id: "locked",
      header: "Locked",
      align: "right",
      sortable: true,
      cell: (r) => <span className="font-mono text-warn">{formatTokenAmount(r.locked, 18)}</span>,
    },
    {
      id: "unlocked",
      header: "Available",
      align: "right",
      sortable: true,
      cell: (r) => <span className="font-mono text-success">{formatTokenAmount(r.unlocked, 18)}</span>,
    },
    {
      id: "util",
      header: "Utilisation",
      className: "w-40",
      cell: (r) => {
        const pct = r.total > 0n ? Number((r.locked * 10000n) / r.total) / 100 : 0;
        return <Meter value={pct} max={100} invert />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="bonds"
        title="Bonds"
        subtitle="Supplier performance bonds — collateral the protocol locks against active deals and slashes on proven misconduct."
        breadcrumbs={[{ label: "Identity" }, { label: "Bonds" }]}
      />

      <KpiRow
        items={[
          { label: "Bonded suppliers", value: directory.positions.length, loading: directory.isLoading },
          { label: "Total bonded", value: formatTokenAmount(totalBonded, 18), loading: directory.isLoading },
          {
            label: "Locked collateral",
            value: formatTokenAmount(totalLocked, 18),
            hint: totalBonded > 0n ? `${((Number(totalLocked) / Number(totalBonded)) * 100).toFixed(1)}% committed` : undefined,
            loading: directory.isLoading,
          },
          { label: "Your bond", value: account.deployed ? formatTokenAmount(account.total, 18) : "—", loading: account.isLoading },
        ]}
      />

      {directory.notDeployed ? (
        <Callout tone="warn" title="SupplierBond not deployed">
          The SupplierBond contract is not configured on this network.
        </Callout>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Toolbar>
              <Input
                value={params.search}
                onChange={(e) => params.setSearch(e.target.value)}
                placeholder="Search by supplier address…"
                className="max-w-xs"
                aria-label="Search bonds"
              />
            </Toolbar>
            <DataTable
              columns={columns}
              rows={pageRows}
              getRowKey={(r) => r.supplier}
              sort={params.sort}
              onSortChange={params.setSort}
              isLoading={directory.isLoading}
              error={directory.isError ? getErrorMessage(directory.error) : null}
              onRetry={directory.refetch}
              emptyTitle="No bonds posted yet"
              emptyDescription="Suppliers appear here once they deposit collateral."
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

          <div>
            <RequireWallet>
              <BondDepositForm onDone={() => { directory.refetch(); account.refetch(); }} />
            </RequireWallet>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BondsPage() {
  return (
    <SearchParamsBoundary>
      <BondsPageContent />
    </SearchParamsBoundary>
  );
}
