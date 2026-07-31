"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";
import {
  useNotifications,
  CATEGORY_LABEL,
  type Notification,
  type NotificationCategory,
} from "@/hooks/systemNotifications";
import { useTableParams, paginate } from "@/hooks/useTableParams";
import { PageHeader, Toolbar, FilterBar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "provenance", label: CATEGORY_LABEL.provenance },
  { value: "settlement", label: CATEGORY_LABEL.settlement },
  { value: "dispute", label: CATEGORY_LABEL.dispute },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread only" },
];

/**
 * System → Notifications (WD §3 template): the on-chain activity stream rendered
 * as a filterable, URL-driven notification inbox with read state.
 */
function NotificationsViewContent() {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, isError, error, refetch, markAllRead, markRead } =
    useNotifications();
  const params = useTableParams();

  const category = params.get("category");
  const status = params.get("status");

  const filtered = useMemo(() => {
    const q = params.search.trim().toLowerCase();
    return notifications.filter((n) => {
      if (category && category !== "all" && n.category !== category) return false;
      if (status === "unread" && n.read) return false;
      if (q) {
        const hay = `${n.title} ${n.detail ?? ""} ${n.batchId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, category, status, params.search]);

  const pageRows = useMemo(
    () => paginate(filtered, params.page, PAGE_SIZE),
    [filtered, params.page],
  );

  const columns: readonly Column<Notification>[] = [
    {
      id: "event",
      header: "Event",
      cell: (n) => (
        <div className="flex items-center gap-2.5">
          {!n.read ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />
          ) : (
            <span className="h-2 w-2 shrink-0" aria-hidden="true" />
          )}
          <StatusBadge status={n.tone} dot={false}>
            {n.title}
          </StatusBadge>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      className: "hidden sm:table-cell",
      cell: (n) => <span className="text-muted">{CATEGORY_LABEL[n.category]}</span>,
    },
    {
      id: "detail",
      header: "Detail",
      className: "hidden md:table-cell",
      cell: (n) => (n.detail ? <span className="text-fg/80">{n.detail}</span> : <span className="text-faint">—</span>),
    },
    {
      id: "batch",
      header: "Batch",
      align: "right",
      cell: (n) => <span className="font-mono text-xs tabular-nums text-muted">{shortenHex(n.batchId, 5, 4)}</span>,
    },
  ];

  const openRow = (n: Notification) => {
    markRead(n.id);
    router.push(n.href);
  };

  const byCategory = (cat: NotificationCategory) => notifications.filter((n) => n.category === cat).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="bell"
        title="Notifications"
        subtitle="Live protocol events across provenance, settlement, and disputes — newest first."
        breadcrumbs={[{ label: "System" }, { label: "Notifications" }]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <Icon name="check" size={16} />
            Mark all read
          </Button>
        }
      />

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Total", value: notifications.length },
          { label: "Unread", value: unreadCount, hintTone: unreadCount > 0 ? "brand" : "neutral" },
          { label: "Settlement", value: byCategory("settlement") },
          { label: "Disputes", value: byCategory("dispute"), hintTone: byCategory("dispute") > 0 ? "danger" : "neutral" },
        ]}
      />

      <Toolbar
        actions={
          <Button variant="ghost" size="sm" onClick={params.reset} disabled={!category && !status && !params.search}>
            Clear filters
          </Button>
        }
      >
        <div className="relative w-full sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon name="search" size={16} />
          </span>
          <Input
            aria-label="Search notifications"
            placeholder="Search events or batch…"
            className="pl-9"
            value={params.search}
            onChange={(e) => params.setSearch(e.target.value)}
          />
        </div>
        <FilterBar>
          <Select
            aria-label="Filter by category"
            options={CATEGORY_OPTIONS}
            value={category || "all"}
            onChange={(e) => params.setFilter("category", e.target.value)}
          />
          <Select
            aria-label="Filter by read status"
            options={STATUS_OPTIONS}
            value={status || "all"}
            onChange={(e) => params.setFilter("status", e.target.value)}
          />
        </FilterBar>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={pageRows}
        getRowKey={(n) => n.id}
        onRowClick={openRow}
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={refetch}
        emptyTitle="No notifications"
        emptyDescription="Protocol events will appear here as batches are registered, settled, and disputed."
      />

      <Pagination
        page={params.page - 1}
        limit={PAGE_SIZE}
        total={filtered.length}
        onPageChange={(p) => params.setPage(p + 1)}
      />
    </div>
  );
}

/** System → Notifications, self-wrapped in a Suspense boundary for `useSearchParams`. */
export function NotificationsView() {
  return (
    <SearchParamsBoundary>
      <NotificationsViewContent />
    </SearchParamsBoundary>
  );
}
