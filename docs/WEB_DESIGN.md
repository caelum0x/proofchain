# ProofChain — Web Design System & Page Structure

> The web app is a **product**, not a set of forms. Every page follows one structured template,
> one design language, and one navigation model. This spec drives the enhanced web wave.
> Target: ~80 pages, a real component library, consistent shells. Stack: Next.js 15 App Router,
> TypeScript, Tailwind, wagmi/viem/RainbowKit, data via `@proofchain/api` (`lib/api.ts`).

## 1. Design language

**Aesthetic:** industrial-fintech — precise, trustworthy, data-dense but calm. Think a
Bloomberg-terminal-meets-Linear feel. Dark-first with a light mode.

### Design tokens (`src/design/tokens.ts` + Tailwind theme extension)
- **Color**
  - Base (dark): `bg` `#0B0E14`, `surface` `#121722`, `surface-2` `#1A2130`, `border` `#232C3D`.
  - Text: `text` `#E6EDF3`, `muted` `#9AA7B8`, `faint` `#5C6B80`.
  - Brand: `primary` `#3B82F6` (electric blue), `primary-hi` `#60A5FA`.
  - Semantic: `success` `#22C55E`, `warn` `#F59E0B`, `danger` `#EF4444`, `info` `#38BDF8`.
  - Domain accents (for section theming): finance `#22C55E`, compliance `#F59E0B`,
    dpp `#8B5CF6`, logistics `#38BDF8`, sustainability `#10B981`, workforce `#EC4899`,
    governance `#A78BFA`, markets `#F97316`.
- **Type:** Inter (UI), JetBrains Mono (addresses/hashes/amounts). Scale: `xs 12 / sm 14 /
  base 15 / lg 18 / xl 24 / 2xl 30 / 3xl 40`. Tabular numerals for all figures.
- **Space:** 4-pt grid. **Radius:** `sm 6 / md 10 / lg 14 / pill 999`. **Shadow:** subtle,
  1–2 layers; elevation only on overlays. **Motion:** 120–200ms ease-out; respect reduced-motion.

Provide `light` + `dark` themes via CSS variables; default dark. All colors referenced through
tokens/Tailwind classes — never hardcoded hex in components.

## 2. Layout shells (`src/components/shells/`)

- **AppShell** — the authenticated product frame: left **Sidebar** (grouped nav, collapsible),
  **TopBar** (global search, network/wallet, notifications, theme toggle, breadcrumbs), scrollable
  **content** region with a max-width container. Used by all app pages.
- **MarketingShell** — full-bleed header + footer for `/`, `/docs`, `/onboarding`.
- **DetailShell** — two-column: main content + a sticky right rail (metadata, actions, timeline).
- All shells handle responsive: sidebar → drawer on mobile; content reflows to single column.

## 3. The page template (EVERY resource page uses this)

`src/components/page/` primitives, composed the same way on every page:
1. **PageHeader** — breadcrumbs, title, subtitle, primary/secondary actions (right-aligned).
2. **KpiRow** — 3–5 `StatCard`s summarizing the resource (counts, volume, rates).
3. **Toolbar** — `FilterBar` (facets), search, sort, view toggle (table/grid), export.
4. **Body** — one of: `DataTable` (list), `CardGrid` (gallery), `DetailView` (single), `FormLayout` (create/edit), `Dashboard` (charts).
5. **State layers** — every body wraps `LoadingState` / `EmptyState` / `ErrorState` (never a blank screen).
6. **Detail affordance** — row click → `DetailDrawer` or navigate to `/[id]` DetailShell.

Consistency rule: a supplier list, an invoice list, and a dispute list are visually the *same
machine* with different columns — learn one page, know them all.

## 4. Component library (`src/components/ui/`)

Primitives: `Button` (variants: primary/secondary/ghost/danger, sizes, loading), `IconButton`,
`Input`, `Select`, `Combobox`, `Textarea`, `Checkbox`, `Switch`, `RadioGroup`, `Slider`,
`Badge`/`StatusBadge` (semantic + domain), `Tag`, `Avatar`, `AddressBadge` (ENS-ish truncation +
copy + explorer link), `Tooltip`, `Popover`, `Dropdown`, `Tabs`, `Accordion`, `Dialog`/`Modal`,
`Drawer`, `Toast`/`Toaster`, `Skeleton`, `Spinner`, `Progress`, `Meter`, `Breadcrumbs`,
`Pagination`, `Stepper`, `Card`, `Divider`, `Callout`, `EmptyState`, `CodeBlock`, `CopyButton`.
Data: `DataTable` (sortable/filterable/paginated, sticky header, row selection, column config),
`CardGrid`, `KpiRow`/`StatCard`, `Timeline`, `Chart` wrappers (Line/Area/Bar/Donut/Sparkline via a
lightweight lib), `MapPreview` (route/checkpoint), `FileDropzone`, `JsonViewer`, `TxButton`
(wagmi write + pending/confirm/error UX), `NetworkGuard`, `WalletButton`.
Forms: `FormLayout`, `Field` (label/help/error), `FormSection`, `FormActions` — all via
react-hook-form + zod resolver.

All components: dark/light, keyboard-accessible, aria-correct, controlled + typed props.

## 5. Navigation model (grouped sidebar)

Sections (each a collapsible group with an accent + icon):
- **Overview** — Dashboard, Explorer, Analytics, Activity.
- **Provenance** — Batches, Checkpoints, Attestations, Verifier, Passports (DPP), Materials, Recalls.
- **Settlement** — Deals, Escrows, Payments, Treasury, Fees.
- **Trade Finance** — Marketplace, Letters of Credit, Factoring, PO Financing, Dynamic Discounting, Securitization, Credit Lines, Pools, Lend.
- **Insurance** — Policies, Claims, Pools, Underwriting.
- **Compliance** — Sanctions/AML, Certificates, Customs & Duties, Export Licenses.
- **Logistics** — Freight, Cold Chain, Warehouses, Fleet, Containers, Proof of Delivery.
- **Sustainability (ESG)** — ESG Scores, Carbon, RECs, Emissions, Water, Biodiversity, Green Bonds.
- **Workforce** — Credentials, Safety Training, Payroll, Skills.
- **Markets** — Commodities, Harvests, Grading, Storage, Auctions, Order Book, Data Market.
- **Identity** — Organizations, Suppliers, Buyers, Carriers, Reputation, Bonds, KYC.
- **Governance** — Proposals, Voting, Arbitration/Disputes, Treasury Gov.
- **Rewards** — Rewards, Loyalty, Staking, Referrals.
- **System** — Notifications, Reports, Settings, Admin, Docs.

## 6. Full route map (~80 pages, App Router)

Each `list` page = template §3 with DataTable/CardGrid; each `[id]` = DetailShell.

- Overview: `/dashboard`, `/explorer` + `/explorer/[batchId]`, `/analytics` + `/analytics/[domain]`, `/activity`.
- Provenance: `/batches` + `/batches/[batchId]`, `/checkpoints`, `/attestations` + `/attestations/[batchId]`, `/verifier`, `/passports` + `/passports/[tokenId]` + `/passports/scan`, `/materials`, `/recycling`, `/recalls`.
- Settlement: `/deals` + `/deals/[batchId]`, `/escrows`, `/payments`, `/treasury`, `/fees`.
- Trade finance: `/finance`, `/finance/pools` + `/finance/pools/[id]`, `/finance/lend`, `/invoices` + `/invoices/[batchId]`, `/letters-of-credit` + `/[id]`, `/factoring`, `/po-financing`, `/dynamic-discounting`, `/securitization` + `/tranches/[id]`, `/credit-lines`, `/guarantees`.
- Insurance: `/insurance`, `/insurance/policies` + `/[id]`, `/insurance/claims` + `/[id]`, `/insurance/pools`.
- Compliance: `/compliance`, `/sanctions`, `/aml`, `/certificates` (+ `/origin`, `/phytosanitary`, `/halal`), `/customs`, `/duties`, `/export-licenses`.
- Logistics: `/logistics`, `/freight` + `/[id]`, `/cold-chain`, `/warehouses` + `/[id]`, `/fleet`, `/containers/[id]`, `/proof-of-delivery`.
- Sustainability: `/esg`, `/carbon`, `/recs`, `/emissions-trading`, `/water-credits`, `/biodiversity`, `/green-bonds`.
- Workforce: `/workforce`, `/credentials/[address]`, `/safety-training`, `/payroll`, `/skills`.
- Markets: `/commodities` + `/[symbol]`, `/harvests`, `/grading`, `/storage-receipts`, `/marketplace` + `/marketplace/auctions/[id]`, `/order-book`, `/data-market`, `/nft` + `/nft/[tokenId]`.
- Identity: `/organizations` + `/[id]`, `/suppliers` + `/[address]`, `/buyers/[address]`, `/carriers`, `/leaderboard`, `/reputation/[address]`, `/bonds`, `/kyc`.
- Governance: `/governance`, `/governance/proposals/[id]`, `/disputes` + `/disputes/[batchId]`, `/voting`.
- Rewards: `/rewards`, `/loyalty`, `/staking`, `/referrals`.
- System/Marketing: `/` (landing), `/onboarding`, `/notifications`, `/reports`, `/settings`, `/admin`, `/docs`.

## 7. Data & interaction conventions

- All reads via `lib/api.ts` (typed, `{success,data,error}`), with wagmi for live on-chain reads
  where freshness matters; TanStack Query for caching, loading, and refetch.
- All writes via `TxButton` (approve→write→pending→confirmed→error) with optimistic UI + toasts.
- URL is the source of truth for filters/sort/pagination (searchParams), so pages are shareable.
- Zod schemas for every form and every API response boundary. No `any` at boundaries.
- Accessibility: focus rings, aria roles, keyboard nav, contrast ≥ WCAG AA in both themes.

## 8. Build order (enhanced web wave — runs after Wave B)

1. **design-system** (1 agent): tokens + Tailwind theme + the full `ui/` primitive library + shells + page primitives + Sidebar/TopBar nav. Everything a page needs, with a component gallery at `/system` (dev-only) and vitest render tests.
2. **page teams** (parallel, by section): each section's list + detail + create pages using ONLY the design system (no bespoke styling), wired to `lib/api.ts` + wagmi. Distinct route dirs + `components/<section>/`.
3. **web-integrate** (1 agent): `next build` + typecheck + vitest green; nav covers every route; no design drift (all pages use the shells/templates).
