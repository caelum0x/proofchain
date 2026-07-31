import type { ReactElement, SVGProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Dependency-free icon set (24×24, 1.6 stroke, currentColor). Kept lightweight
 * so the design system ships no icon-font/runtime dependency. Add new glyphs to
 * `PATHS` by name; unknown names render a neutral dot.
 */
export type IconName =
  | "dashboard"
  | "explorer"
  | "analytics"
  | "activity"
  | "batches"
  | "checkpoint"
  | "attestation"
  | "verifier"
  | "passport"
  | "materials"
  | "recycle"
  | "recall"
  | "deals"
  | "escrow"
  | "payments"
  | "treasury"
  | "fees"
  | "marketplace"
  | "finance"
  | "insurance"
  | "claims"
  | "compliance"
  | "shield"
  | "certificate"
  | "customs"
  | "logistics"
  | "truck"
  | "warehouse"
  | "container"
  | "delivery"
  | "leaf"
  | "carbon"
  | "water"
  | "workforce"
  | "credential"
  | "commodities"
  | "harvest"
  | "auction"
  | "orderbook"
  | "database"
  | "nft"
  | "organizations"
  | "suppliers"
  | "buyers"
  | "carriers"
  | "leaderboard"
  | "reputation"
  | "bonds"
  | "kyc"
  | "governance"
  | "proposals"
  | "disputes"
  | "voting"
  | "rewards"
  | "loyalty"
  | "staking"
  | "referrals"
  | "bell"
  | "reports"
  | "settings"
  | "admin"
  | "docs"
  | "search"
  | "wallet"
  | "sun"
  | "moon"
  | "chevron-down"
  | "chevron-right"
  | "menu"
  | "close"
  | "copy"
  | "check"
  | "external"
  | "filter"
  | "sort"
  | "download"
  | "plus"
  | "grid"
  | "list"
  | "info"
  | "warning"
  | "error"
  | "map"
  | "arrow-right"
  | "arrow-left";

const P = (d: string) => <path d={d} />;

const PATHS: Record<IconName, ReactElement> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  explorer: (
    <>
      <circle cx="11" cy="11" r="7" />
      {P("m20 20-3.2-3.2")}
    </>
  ),
  analytics: P("M4 20V10M10 20V4M16 20v-6M22 20H2"),
  activity: P("M3 12h4l2 6 4-14 2 8h6"),
  batches: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      {P("M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M3 13h18")}
    </>
  ),
  checkpoint: (
    <>
      <circle cx="12" cy="10" r="3" />
      {P("M12 21c5-5 7-8 7-11a7 7 0 1 0-14 0c0 3 2 6 7 11Z")}
    </>
  ),
  attestation: (
    <>
      {P("M9 12l2 2 4-4")}
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  verifier: P("M12 3 4 6v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V6l-8-3ZM9 12l2 2 4-4"),
  passport: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      {P("M9 16h6")}
    </>
  ),
  materials: P("M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"),
  recycle: P("M7 19H5a2 2 0 0 1-1.7-3l2-3.4M10 5l1.5-2.5 2 3.4M17 8l2 3.4a2 2 0 0 1-1.7 3H14M9 19h5M8 8 6 5"),
  recall: (
    <>
      <circle cx="12" cy="12" r="9" />
      {P("M12 7v6M12 16.5v.5")}
    </>
  ),
  deals: P("M8 12h8M12 8v8M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"),
  escrow: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      {P("M8 10V7a4 4 0 0 1 8 0v3M12 14v3")}
    </>
  ),
  payments: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      {P("M2 10h20")}
    </>
  ),
  treasury: P("M3 21h18M4 10h16M5 10 12 4l7 6M6 10v11M18 10v11M10 10v11M14 10v11"),
  fees: (
    <>
      <circle cx="12" cy="12" r="9" />
      {P("M15 9a3 3 0 0 0-3-2c-1.7 0-3 1-3 2.3 0 3 6 1.7 6 4.7C15 15.4 13.7 17 12 17a3 3 0 0 1-3-2M12 6v1M12 17v1")}
    </>
  ),
  marketplace: P("M4 9h16l-1 11H5L4 9ZM4 9 6 4h12l2 5M9 13v3M15 13v3"),
  finance: P("M4 20V10M10 20V4M16 20v-8M22 20H2M4 10l6-6 6 8"),
  insurance: P("M12 3 4 6v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V6l-8-3Z"),
  claims: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      {P("M9 8h6M9 12h6M9 16h4")}
    </>
  ),
  compliance: P("M12 3 4 6v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V6l-8-3ZM9 12l2 2 4-4"),
  shield: P("M12 3 4 6v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V6l-8-3Z"),
  certificate: (
    <>
      <circle cx="12" cy="9" r="5" />
      {P("M9 13.5 8 21l4-2 4 2-1-7.5")}
    </>
  ),
  customs: P("M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"),
  logistics: P("M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"),
  truck: P("M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"),
  warehouse: P("M3 21V8l9-4 9 4v13M3 21h18M7 21v-7h10v7"),
  container: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      {P("M7 6v12M12 6v12M17 6v12")}
    </>
  ),
  delivery: (
    <>
      <rect x="3" y="7" width="13" height="10" rx="1.5" />
      {P("M16 10h3l2 3v4h-5M7.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 12l1.5 1.5L15 10")}
    </>
  ),
  leaf: P("M4 20c0-9 7-14 16-14 0 9-6 14-13 14-1 0-3 0-3 0ZM7 17c3-4 6-6 9-7"),
  carbon: (
    <>
      <circle cx="12" cy="12" r="9" />
      {P("M12 6c3 3 3 6 0 9-3-3-3-6 0-9ZM8 16c2-1 6-1 8 0")}
    </>
  ),
  water: P("M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11Z"),
  workforce: (
    <>
      <circle cx="9" cy="8" r="3" />
      {P("M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M18 20a5 5 0 0 0-3-4.6")}
    </>
  ),
  credential: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="11" r="2" />
      {P("M5 16c.6-1.5 2-2 3-2s2.4.5 3 2M14 9h4M14 12h4M14 15h2")}
    </>
  ),
  commodities: P("M4 20V6l8-3 8 3v14M4 20h16M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01"),
  harvest: P("M12 20v-7M12 13c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 13c3 0 5-2 5-5-3 0-5 2-5 5ZM7 20h10"),
  auction: P("M14 4l6 6-3 3-6-6 3-3ZM11 7 4 14l3 3 7-7M3 21h9"),
  orderbook: P("M4 6h16M4 12h10M4 18h13M18 10l2 2-2 2"),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      {P("M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6")}
    </>
  ),
  nft: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      {P("M8 15l3-4 2 2.5L15 10l2 3M8 8h.01")}
    </>
  ),
  organizations: P("M3 21V7l6-3v17M9 21V4l6 3v14M15 21V9l6 3v9M3 21h18M6 10h.01M6 14h.01M12 9h.01M12 13h.01M18 15h.01"),
  suppliers: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      {P("M5 20a7 7 0 0 1 14 0")}
    </>
  ),
  buyers: (
    <>
      {P("M6 7h13l-1.4 8H8.4L7 4H4")}
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  carriers: P("M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"),
  leaderboard: P("M6 20V10M12 20V4M18 20v-8M4 20h16"),
  reputation: P("M12 3l2.5 5 5.5.8-4 3.9 1 5.6L12 16l-5 2.3 1-5.6-4-3.9 5.5-.8L12 3Z"),
  bonds: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      {P("M3 10h2M19 10h2M3 14h2M19 14h2")}
    </>
  ),
  kyc: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      {P("M14 9h4M14 12h4M6 16h6")}
    </>
  ),
  governance: P("M3 21h18M5 21V10M19 21V10M9 21v-6h6v6M4 10h16L12 3 4 10Z"),
  proposals: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      {P("M9 8h6M9 12h6M9 16h3")}
    </>
  ),
  disputes: P("M12 3 3 7l3 3-3 3 6 3 3-3 3 3 3-3-3-3 3-4-9-3ZM12 3v18"),
  voting: (
    <>
      {P("M9 12l2 2 4-4")}
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </>
  ),
  rewards: P("M12 8a4 4 0 1 0 0-5 4 4 0 0 0 0 5ZM8 8h8l1 13H7L8 8ZM10 4 7 2M14 4l3-2"),
  loyalty: P("M12 4l2.5 5 5.5.8-4 3.9 1 5.6L12 16l-5 2.3 1-5.6-4-3.9 5.5-.8L12 4Z"),
  staking: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      {P("M5 6v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 11v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5")}
    </>
  ),
  referrals: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      {P("M8.2 10.8 15.8 7M8.2 13.2 15.8 17")}
    </>
  ),
  bell: P("M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM9.5 19a2.5 2.5 0 0 0 5 0"),
  reports: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      {P("M8 8h8M8 12h8M8 16h5")}
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      {P("M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1")}
    </>
  ),
  admin: P("M12 3 4 6v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V6l-8-3ZM12 9v3M12 15h.01"),
  docs: (
    <>
      {P("M6 3h8l4 4v14H6ZM14 3v4h4")}
      {P("M9 12h6M9 16h6")}
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      {P("m20 20-3.2-3.2")}
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      {P("M3 10h18M17 14h.01")}
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      {P("M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4")}
    </>
  ),
  moon: P("M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"),
  "chevron-down": P("M6 9l6 6 6-6"),
  "chevron-right": P("M9 6l6 6-6 6"),
  menu: P("M4 7h16M4 12h16M4 17h16"),
  close: P("M6 6l12 12M18 6 6 18"),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      {P("M5 15V5a2 2 0 0 1 2-2h8")}
    </>
  ),
  check: P("M5 12l5 5L20 6"),
  external: P("M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"),
  filter: P("M3 5h18l-7 8v6l-4-2v-4L3 5Z"),
  sort: P("M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3"),
  download: P("M12 3v12M8 11l4 4 4-4M4 21h16"),
  plus: P("M12 5v14M5 12h14"),
  grid: P("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"),
  list: P("M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      {P("M12 11v5M12 8h.01")}
    </>
  ),
  warning: P("M12 4 2 20h20L12 4ZM12 10v4M12 17h.01"),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      {P("M9 9l6 6M15 9l-6 6")}
    </>
  ),
  map: P("M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14"),
  "arrow-right": P("M5 12h14M13 6l6 6-6 6"),
  "arrow-left": P("M19 12H5M11 6l-6 6 6 6"),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  readonly name: IconName;
  /** Pixel size (width & height). Default 18. */
  readonly size?: number;
  readonly className?: string;
}

export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  const glyph = PATHS[name] ?? <circle cx="12" cy="12" r="3" />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...rest}
    >
      {glyph}
    </svg>
  );
}
