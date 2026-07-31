/**
 * Page template primitives (WD §3). Compose every resource page the same way:
 *   PageHeader → KpiRow → Toolbar/FilterBar → Body (DataTable/CardGrid/…) with
 *   an AsyncBoundary wrapping loading/empty/error, and DetailDrawer for rows.
 *
 *   import { PageHeader, Toolbar, FilterBar, AsyncBoundary } from "@/components/page";
 */
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { Toolbar, FilterBar, ViewToggle, type ToolbarProps, type FilterBarProps, type ViewMode } from "./Toolbar";
export { DetailDrawer, type DetailDrawerProps } from "./DetailDrawer";
export { AsyncBoundary, type AsyncBoundaryProps } from "./AsyncBoundary";
export { SearchParamsBoundary } from "./SearchParamsBoundary";

// State layers are re-exported for page-primitive ergonomics.
export { LoadingState, EmptyState, ErrorState } from "@/components/ui/States";
export { KpiRow, type Kpi } from "@/components/ui/KpiRow";
