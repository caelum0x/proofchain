/**
 * Reports service — pre-aggregated, dashboard-ready platform reports.
 *
 * Where `/analytics` serves raw figures, `/reports` composes them into named,
 * shareable summaries (a platform overview + per-domain breakdowns) that the web
 * app and PDF/CSV exporters render directly. Every figure is a concurrent
 * `count` over the read model (the generic DB layer has no GROUP BY, so state
 * breakdowns are expressed as filtered counts). Offline-safe: counts resolve to
 * zero when Supabase is unconfigured.
 */
import { validationError } from '../lib/errors.js';
import { defineService } from './base.js';

/** Domains a per-domain report can be built for. */
export const REPORT_DOMAINS = [
  'finance',
  'insurance',
  'governance',
  'marketplace',
  'settlement',
] as const;

export type ReportDomain = (typeof REPORT_DOMAINS)[number];

export interface PlatformReport {
  readonly generatedAt: string;
  readonly totals: {
    readonly indexedEvents: number;
    readonly suppliers: number;
    readonly deals: number;
  };
  readonly finance: { readonly listings: number; readonly receivables: number; readonly pools: number };
  readonly insurance: { readonly policies: number; readonly claims: number };
  readonly governance: { readonly proposals: number };
  readonly marketplace: { readonly listings: number; readonly auctions: number };
}

export interface DomainReport {
  readonly domain: ReportDomain;
  readonly generatedAt: string;
  readonly events: number;
  readonly metrics: Readonly<Record<string, number>>;
}

export interface ReportsService {
  /** The domains a per-domain report can be built for. */
  domains(): readonly ReportDomain[];
  /** A whole-platform overview report. */
  summary(): Promise<PlatformReport>;
  /** A per-domain report; throws VALIDATION_ERROR for an unknown domain. */
  domain(name: string): Promise<DomainReport>;
}

const isReportDomain = (name: string): name is ReportDomain =>
  (REPORT_DOMAINS as readonly string[]).includes(name);

/** Build a {@link ReportsService} bound to the request context. */
export const createReportsService = defineService<ReportsService>((ctx) => {
  const { db } = ctx;

  const domainMetrics = async (
    name: ReportDomain,
  ): Promise<Readonly<Record<string, number>>> => {
    switch (name) {
      case 'finance': {
        const [listings, receivables, pools] = await Promise.all([
          db.count('financing_listings'),
          db.count('receivables'),
          db.count('pools'),
        ]);
        return { listings, receivables, pools };
      }
      case 'insurance': {
        const [policies, claims] = await Promise.all([
          db.count('policies'),
          db.count('claims'),
        ]);
        return { policies, claims };
      }
      case 'governance': {
        const proposals = await db.count('proposals');
        return { proposals };
      }
      case 'marketplace': {
        const [listings, auctions] = await Promise.all([
          db.count('listings'),
          db.count('auctions'),
        ]);
        return { listings, auctions };
      }
      case 'settlement': {
        const [funded, released, refunded, disputed] = await Promise.all([
          db.count('deals', { state: 'funded' }),
          db.count('deals', { state: 'released' }),
          db.count('deals', { state: 'refunded' }),
          db.count('deals', { state: 'disputed' }),
        ]);
        return { funded, released, refunded, disputed };
      }
      default:
        return {};
    }
  };

  return {
    domains(): readonly ReportDomain[] {
      return REPORT_DOMAINS;
    },

    async summary(): Promise<PlatformReport> {
      const [
        indexedEvents,
        suppliers,
        deals,
        finListings,
        receivables,
        pools,
        policies,
        claims,
        proposals,
        mktListings,
        auctions,
      ] = await Promise.all([
        db.count('indexer_events'),
        db.count('suppliers'),
        db.count('deals'),
        db.count('financing_listings'),
        db.count('receivables'),
        db.count('pools'),
        db.count('policies'),
        db.count('claims'),
        db.count('proposals'),
        db.count('listings'),
        db.count('auctions'),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        totals: { indexedEvents, suppliers, deals },
        finance: { listings: finListings, receivables, pools },
        insurance: { policies, claims },
        governance: { proposals },
        marketplace: { listings: mktListings, auctions },
      };
    },

    async domain(name): Promise<DomainReport> {
      if (!isReportDomain(name)) {
        throw validationError(`unknown report domain '${name}'`, {
          allowed: REPORT_DOMAINS,
        });
      }
      const [events, metrics] = await Promise.all([
        db.count('indexer_events', { group_name: name }),
        domainMetrics(name),
      ]);
      return {
        domain: name,
        generatedAt: new Date().toISOString(),
        events,
        metrics,
      };
    },
  };
});
