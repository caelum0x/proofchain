"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatBps } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/directory";
import { GradeBadge } from "@/components/reputation/GradeBadge";

/**
 * Ranked table of suppliers by on-chain track record. Rank reflects the ordering
 * applied by `sortLeaderboard` (pass rate → avg score → deals → fewest disputes).
 * Rows link to the supplier's reputation page.
 */
export function LeaderboardTable({
  entries,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  entries: readonly LeaderboardEntry[];
  isLoading: boolean;
  isError: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();

  const columns: readonly Column<LeaderboardEntry>[] = [
    {
      id: "rank",
      header: "#",
      className: "w-10",
      cell: (_row, index) => <span className="tabular-nums text-muted">{index + 1}</span>,
    },
    {
      id: "supplier",
      header: "Supplier",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg">{row.name || "Unnamed"}</span>
          <AddressBadge address={row.account} copyable={false} explorer={false} />
        </div>
      ),
    },
    {
      id: "grade",
      header: "Grade",
      className: "hidden sm:table-cell",
      cell: (row) => <GradeBadge grade={row.grade} />,
    },
    {
      id: "passRate",
      header: "Pass rate",
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatBps(row.reputation.passRateBps)}</span>,
    },
    {
      id: "avgScore",
      header: "Avg. score",
      align: "right",
      className: "hidden md:table-cell",
      cell: (row) => <span className="tabular-nums">{formatBps(row.reputation.avgScoreBps)}</span>,
    },
    {
      id: "deals",
      header: "Deals",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.reputation.totalDeals}</span>,
    },
    {
      id: "disputes",
      header: "Disputes",
      align: "right",
      className: "hidden md:table-cell",
      cell: (row) => <span className="tabular-nums">{row.reputation.disputes}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={entries}
      getRowKey={(row) => row.account}
      onRowClick={(row) => router.push(`/reputation/${row.account}`)}
      isLoading={isLoading}
      error={isError ? (error ?? "Failed to load leaderboard.") : null}
      onRetry={onRetry}
      emptyTitle="No ranked suppliers yet"
      emptyDescription="Suppliers appear here once they register and settle deals."
    />
  );
}
