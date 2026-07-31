/**
 * Canonical site navigation for the ProofChain platform.
 *
 * This is the single source of truth for the top-level Nav/Header. It covers
 * every platform section in SPEC2 "Web" plus the original supplier/buyer/
 * verifier flows. Page agents render pages for these routes but do NOT edit the
 * navigation — add/adjust entries here only.
 *
 * Each group becomes a dropdown in the desktop header and a section in the
 * mobile drawer. `href` values point at the section index routes; dynamic
 * sub-routes (e.g. `/suppliers/[address]`) are reached by navigating within a
 * section page.
 */

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly description?: string;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Explore",
    items: [
      { href: "/explorer", label: "Batch Explorer", description: "Every registered batch, provenance trail, and attestation." },
      { href: "/suppliers", label: "Suppliers", description: "Supplier directory, profiles, and track record." },
      { href: "/buyers", label: "Buyers", description: "Buyer profiles and their funded deals." },
      { href: "/carriers", label: "Carriers", description: "Logistics carriers pushing IoT checkpoints." },
      { href: "/organizations", label: "Organizations", description: "Orgs and their members across the network." },
      { href: "/leaderboard", label: "Leaderboard", description: "Top suppliers by reputation and volume." },
      { href: "/reputation", label: "Reputation", description: "On-chain reputation scores and history." },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/finance", label: "Financing Market", description: "List and fund attested receivables." },
      { href: "/finance/pools", label: "Pools", description: "Pooled lender capital by risk grade." },
      { href: "/finance/lend", label: "Lend", description: "Deposit capital and earn yield." },
      { href: "/invoices", label: "Invoices", description: "Receivable NFTs and financing terms." },
    ],
  },
  {
    label: "Risk",
    items: [
      { href: "/insurance", label: "Insurance", description: "Underwrite and buy shipment/credit cover." },
      { href: "/insurance/claims", label: "Claims", description: "File and track insurance claims." },
      { href: "/disputes", label: "Disputes", description: "Staked arbiters resolve disputed deals." },
    ],
  },
  {
    label: "Assets",
    items: [
      { href: "/nft", label: "NFTs", description: "Batch NFTs, receivables, and warehouse receipts." },
      { href: "/marketplace", label: "Marketplace", description: "Order book for tokenized assets." },
      { href: "/marketplace/auctions", label: "Auctions", description: "English auctions for invoice NFTs." },
    ],
  },
  {
    label: "Sustainability",
    items: [
      { href: "/esg", label: "ESG", description: "ESG scores and attestations per batch/org." },
      { href: "/carbon", label: "Carbon", description: "Carbon credits and offset marketplace." },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/governance", label: "Governance", description: "Proposals and votes over protocol params." },
    ],
  },
  {
    label: "Rewards",
    items: [
      { href: "/rewards", label: "Rewards", description: "Loyalty points and staking rewards." },
      { href: "/referrals", label: "Referrals", description: "Refer participants and earn payouts." },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", description: "Network analytics and time series." },
      { href: "/supplier", label: "Supplier", description: "Register batches and request verification." },
      { href: "/buyer", label: "Buyer", description: "Fund escrow deals in MockUSDC." },
      { href: "/verifier", label: "Verifier", description: "Live dashboard of every batch." },
      { href: "/admin", label: "Admin", description: "Protocol configuration and roles." },
    ],
  },
] as const;

/** Flat list of every navigable route, handy for tests and sitemaps. */
export const ALL_NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Resolve the active group + item for a pathname. A route is active when it
 * equals the item href or is nested under it (longest match wins so `/finance`
 * doesn't shadow `/finance/pools`).
 */
export function activeNav(pathname: string): {
  readonly group?: NavGroup;
  readonly item?: NavItem;
} {
  let best: { group: NavGroup; item: NavItem } | undefined;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (!matches) continue;
      if (!best || item.href.length > best.item.href.length) {
        best = { group, item };
      }
    }
  }
  return best ?? {};
}
