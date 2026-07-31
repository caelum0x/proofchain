/**
 * Grouped sidebar navigation (WD §5) wired to the full route map (WD §6).
 *
 * This is the single source of truth for the AppShell Sidebar and TopBar
 * breadcrumbs. Each section is a collapsible group with an icon + accent; each
 * item points at a section index route (dynamic `[id]` routes are reached from
 * within a section page). The design system owns this file — page teams add
 * pages, not nav entries.
 */
import type { IconName } from "@/components/ui/Icon";

/** Accent token driving a section's icon/active colour. */
export type NavAccent =
  | "primary"
  | "finance"
  | "compliance"
  | "dpp"
  | "logistics"
  | "sustainability"
  | "workforce"
  | "governance"
  | "markets"
  | "info";

export interface SidebarItem {
  readonly href: string;
  readonly label: string;
  readonly icon: IconName;
}

export interface SidebarGroup {
  readonly label: string;
  readonly accent: NavAccent;
  readonly icon: IconName;
  readonly items: readonly SidebarItem[];
}

/** Tailwind text-color class per accent (static so Tailwind keeps them). */
export const ACCENT_TEXT: Record<NavAccent, string> = {
  primary: "text-brand",
  finance: "text-finance",
  compliance: "text-compliance",
  dpp: "text-dpp",
  logistics: "text-logistics",
  sustainability: "text-sustainability",
  workforce: "text-workforce",
  governance: "text-governance",
  markets: "text-markets",
  info: "text-info",
};

/** CSS variable an active section sets so `bg-accent`/`text-accent` follow it. */
export const ACCENT_VAR: Record<NavAccent, string> = {
  primary: "var(--primary)",
  finance: "var(--accent-finance)",
  compliance: "var(--accent-compliance)",
  dpp: "var(--accent-dpp)",
  logistics: "var(--accent-logistics)",
  sustainability: "var(--accent-sustainability)",
  workforce: "var(--accent-workforce)",
  governance: "var(--accent-governance)",
  markets: "var(--accent-markets)",
  info: "var(--info)",
};

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    label: "Overview",
    accent: "primary",
    icon: "dashboard",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/explorer", label: "Explorer", icon: "explorer" },
      { href: "/analytics", label: "Analytics", icon: "analytics" },
      { href: "/activity", label: "Activity", icon: "activity" },
    ],
  },
  {
    label: "Provenance",
    accent: "dpp",
    icon: "batches",
    items: [
      { href: "/batches", label: "Batches", icon: "batches" },
      { href: "/checkpoints", label: "Checkpoints", icon: "checkpoint" },
      { href: "/attestations", label: "Attestations", icon: "attestation" },
      { href: "/verifier", label: "Verifier", icon: "verifier" },
      { href: "/passports", label: "Passports (DPP)", icon: "passport" },
      { href: "/materials", label: "Materials", icon: "materials" },
      { href: "/recycling", label: "Recycling", icon: "recycle" },
      { href: "/recalls", label: "Recalls", icon: "recall" },
    ],
  },
  {
    label: "Settlement",
    accent: "finance",
    icon: "deals",
    items: [
      { href: "/deals", label: "Deals", icon: "deals" },
      { href: "/escrows", label: "Escrows", icon: "escrow" },
      { href: "/payments", label: "Payments", icon: "payments" },
      { href: "/treasury", label: "Treasury", icon: "treasury" },
      { href: "/fees", label: "Fees", icon: "fees" },
    ],
  },
  {
    label: "Trade Finance",
    accent: "finance",
    icon: "finance",
    items: [
      { href: "/finance", label: "Marketplace", icon: "marketplace" },
      { href: "/finance/pools", label: "Pools", icon: "staking" },
      { href: "/finance/lend", label: "Lend", icon: "finance" },
      { href: "/invoices", label: "Invoices", icon: "claims" },
      { href: "/letters-of-credit", label: "Letters of Credit", icon: "certificate" },
      { href: "/factoring", label: "Factoring", icon: "payments" },
      { href: "/po-financing", label: "PO Financing", icon: "reports" },
      { href: "/dynamic-discounting", label: "Dynamic Discounting", icon: "fees" },
      { href: "/securitization", label: "Securitization", icon: "database" },
      { href: "/credit-lines", label: "Credit Lines", icon: "finance" },
      { href: "/guarantees", label: "Guarantees", icon: "shield" },
    ],
  },
  {
    label: "Insurance",
    accent: "info",
    icon: "insurance",
    items: [
      { href: "/insurance", label: "Insurance", icon: "insurance" },
      { href: "/insurance/policies", label: "Policies", icon: "certificate" },
      { href: "/insurance/claims", label: "Claims", icon: "claims" },
      { href: "/insurance/pools", label: "Pools", icon: "staking" },
    ],
  },
  {
    label: "Compliance",
    accent: "compliance",
    icon: "compliance",
    items: [
      { href: "/compliance", label: "Overview", icon: "compliance" },
      { href: "/sanctions", label: "Sanctions / AML", icon: "shield" },
      { href: "/aml", label: "AML", icon: "shield" },
      { href: "/certificates", label: "Certificates", icon: "certificate" },
      { href: "/customs", label: "Customs & Duties", icon: "customs" },
      { href: "/duties", label: "Duties", icon: "fees" },
      { href: "/export-licenses", label: "Export Licenses", icon: "docs" },
    ],
  },
  {
    label: "Logistics",
    accent: "logistics",
    icon: "logistics",
    items: [
      { href: "/logistics", label: "Overview", icon: "logistics" },
      { href: "/freight", label: "Freight", icon: "truck" },
      { href: "/cold-chain", label: "Cold Chain", icon: "water" },
      { href: "/warehouses", label: "Warehouses", icon: "warehouse" },
      { href: "/fleet", label: "Fleet", icon: "truck" },
      { href: "/containers", label: "Containers", icon: "container" },
      { href: "/proof-of-delivery", label: "Proof of Delivery", icon: "delivery" },
    ],
  },
  {
    label: "Sustainability",
    accent: "sustainability",
    icon: "leaf",
    items: [
      { href: "/esg", label: "ESG Scores", icon: "leaf" },
      { href: "/carbon", label: "Carbon", icon: "carbon" },
      { href: "/recs", label: "RECs", icon: "leaf" },
      { href: "/emissions-trading", label: "Emissions", icon: "carbon" },
      { href: "/water-credits", label: "Water", icon: "water" },
      { href: "/biodiversity", label: "Biodiversity", icon: "leaf" },
      { href: "/green-bonds", label: "Green Bonds", icon: "bonds" },
    ],
  },
  {
    label: "Workforce",
    accent: "workforce",
    icon: "workforce",
    items: [
      { href: "/workforce", label: "Overview", icon: "workforce" },
      { href: "/credentials", label: "Credentials", icon: "credential" },
      { href: "/safety-training", label: "Safety Training", icon: "shield" },
      { href: "/payroll", label: "Payroll", icon: "payments" },
      { href: "/skills", label: "Skills", icon: "reputation" },
    ],
  },
  {
    label: "Markets",
    accent: "markets",
    icon: "commodities",
    items: [
      { href: "/commodities", label: "Commodities", icon: "commodities" },
      { href: "/harvests", label: "Harvests", icon: "harvest" },
      { href: "/grading", label: "Grading", icon: "reputation" },
      { href: "/storage-receipts", label: "Storage", icon: "warehouse" },
      { href: "/marketplace", label: "Marketplace", icon: "marketplace" },
      { href: "/marketplace/auctions", label: "Auctions", icon: "auction" },
      { href: "/order-book", label: "Order Book", icon: "orderbook" },
      { href: "/data-market", label: "Data Market", icon: "database" },
      { href: "/nft", label: "NFTs", icon: "nft" },
    ],
  },
  {
    label: "Identity",
    accent: "primary",
    icon: "organizations",
    items: [
      { href: "/organizations", label: "Organizations", icon: "organizations" },
      { href: "/suppliers", label: "Suppliers", icon: "suppliers" },
      { href: "/buyers", label: "Buyers", icon: "buyers" },
      { href: "/carriers", label: "Carriers", icon: "carriers" },
      { href: "/reputation", label: "Reputation", icon: "reputation" },
      { href: "/bonds", label: "Bonds", icon: "bonds" },
      { href: "/kyc", label: "KYC", icon: "kyc" },
      { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    ],
  },
  {
    label: "Governance",
    accent: "governance",
    icon: "governance",
    items: [
      { href: "/governance", label: "Proposals", icon: "proposals" },
      { href: "/voting", label: "Voting", icon: "voting" },
      { href: "/disputes", label: "Arbitration / Disputes", icon: "disputes" },
    ],
  },
  {
    label: "Rewards",
    accent: "markets",
    icon: "rewards",
    items: [
      { href: "/rewards", label: "Rewards", icon: "rewards" },
      { href: "/loyalty", label: "Loyalty", icon: "loyalty" },
      { href: "/staking", label: "Staking", icon: "staking" },
      { href: "/referrals", label: "Referrals", icon: "referrals" },
    ],
  },
  {
    label: "System",
    accent: "info",
    icon: "settings",
    items: [
      { href: "/notifications", label: "Notifications", icon: "bell" },
      { href: "/reports", label: "Reports", icon: "reports" },
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/admin", label: "Admin", icon: "admin" },
      { href: "/docs", label: "Docs", icon: "docs" },
    ],
  },
] as const;

/** Flat list of every sidebar route (handy for tests / search). */
export const ALL_SIDEBAR_ITEMS: readonly SidebarItem[] = SIDEBAR_GROUPS.flatMap((g) => g.items);

/** Routes rendered outside the AppShell (marketing / full-bleed). */
export const MARKETING_ROUTES: readonly string[] = ["/", "/onboarding", "/docs"];

/** True when a path should use the MarketingShell rather than the AppShell. */
export function isMarketingRoute(pathname: string): boolean {
  return MARKETING_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`)) || pathname === "/";
}

/** Resolve the active group + item for a pathname (longest match wins). */
export function activeSidebar(pathname: string): {
  readonly group?: SidebarGroup;
  readonly item?: SidebarItem;
} {
  let best: { group: SidebarGroup; item: SidebarItem } | undefined;
  for (const group of SIDEBAR_GROUPS) {
    for (const item of group.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (!matches) continue;
      if (!best || item.href.length > best.item.href.length) best = { group, item };
    }
  }
  return best ?? {};
}
