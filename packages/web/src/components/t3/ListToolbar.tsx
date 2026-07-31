"use client";

import type { ReactNode } from "react";
import { Button, Input, Select } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { Toolbar, FilterBar } from "@/components/page";
import type { ListParamsApi } from "@/hooks/useT3ListParams";

export interface StatusFacet {
  readonly value: string;
  readonly label: string;
}

export interface ListToolbarProps {
  readonly params: ListParamsApi;
  readonly statusOptions?: readonly StatusFacet[];
  readonly searchPlaceholder?: string;
  readonly onExport?: () => void;
  /** Extra right-aligned controls (view toggle, primary action). */
  readonly actions?: ReactNode;
}

/**
 * The standard section list toolbar (WD §3.3): URL-backed search + a status
 * facet on the left; export and page-specific actions on the right. All state
 * flows through `useT3ListParams`, so filters live in the URL and are shareable.
 */
export function ListToolbar({
  params,
  statusOptions,
  searchPlaceholder = "Search…",
  onExport,
  actions,
}: ListToolbarProps) {
  return (
    <Toolbar
      actions={
        <>
          {onExport ? (
            <Button variant="secondary" size="sm" onClick={onExport}>
              <Icon name="download" size={15} />
              Export
            </Button>
          ) : null}
          {actions}
        </>
      }
    >
      <FilterBar>
        <div className="relative">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            aria-label="Search"
            placeholder={searchPlaceholder}
            value={params.state.q}
            onChange={(e) => params.setQuery(e.target.value)}
            className="w-56 pl-8"
          />
        </div>
        {statusOptions && statusOptions.length > 0 ? (
          <Select
            aria-label="Filter by status"
            options={statusOptions as StatusFacet[]}
            value={params.state.status}
            onChange={(e) => params.setStatus(e.target.value)}
            className="w-44"
          />
        ) : null}
        {params.state.q || (params.state.status && params.state.status !== "all") ? (
          <Button variant="ghost" size="sm" onClick={params.reset}>
            Clear
          </Button>
        ) : null}
      </FilterBar>
    </Toolbar>
  );
}
