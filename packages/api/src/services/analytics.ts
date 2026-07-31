/**
 * Analytics service — per-domain aggregations backing `src/routes/analytics/*`.
 *
 * The foundation's `/analytics` route serves the network-wide overview; this
 * service supplies the DOMAIN drill-downs (`/analytics/finance`,
 * `/analytics/insurance`, …). Each method composes concurrent `count`s over the
 * read model (projection tables + the `indexer_events` audit log). The generic
 * DB layer has no GROUP BY, so state breakdowns are expressed as filtered
 * counts. Offline-safe: every figure resolves to zero when Supabase is
 * unconfigured, so the endpoints never throw in a chain-only deployment.
 */
import { defineService } from './base.js';

export interface DomainAnalytics {
  readonly domain: string;
  readonly events: number;
  readonly metrics: Readonly<Record<string, number>>;
}

export interface AnalyticsService {
  finance(): Promise<DomainAnalytics>;
  insurance(): Promise<DomainAnalytics>;
  governance(): Promise<DomainAnalytics>;
  marketplace(): Promise<DomainAnalytics>;
  settlement(): Promise<DomainAnalytics>;
  rewards(): Promise<DomainAnalytics>;
  reputation(): Promise<DomainAnalytics>;
}

/** Build an {@link AnalyticsService} bound to the request context. */
export const createAnalyticsService = defineService<AnalyticsService>((ctx) => {
  const { db } = ctx;

  const eventsFor = (group: string): Promise<number> =>
    db.count('indexer_events', { group_name: group });

  const build = (
    domain: string,
    events: number,
    metrics: Readonly<Record<string, number>>,
  ): DomainAnalytics => ({ domain, events, metrics });

  return {
    async finance(): Promise<DomainAnalytics> {
      const [events, listings, receivables, pools] = await Promise.all([
        eventsFor('finance'),
        db.count('financing_listings'),
        db.count('receivables'),
        db.count('pools'),
      ]);
      return build('finance', events, { listings, receivables, pools });
    },

    async insurance(): Promise<DomainAnalytics> {
      const [events, policies, claims] = await Promise.all([
        eventsFor('insurance'),
        db.count('policies'),
        db.count('claims'),
      ]);
      return build('insurance', events, { policies, claims });
    },

    async governance(): Promise<DomainAnalytics> {
      const [events, proposals, disputes] = await Promise.all([
        eventsFor('governance'),
        db.count('proposals'),
        db.count('disputes'),
      ]);
      return build('governance', events, { proposals, disputes });
    },

    async marketplace(): Promise<DomainAnalytics> {
      const [events, listings, auctions] = await Promise.all([
        eventsFor('marketplace'),
        db.count('listings'),
        db.count('auctions'),
      ]);
      return build('marketplace', events, { listings, auctions });
    },

    async settlement(): Promise<DomainAnalytics> {
      const [events, funded, released, refunded, disputed] = await Promise.all([
        eventsFor('settlement'),
        db.count('deals', { state: 'funded' }),
        db.count('deals', { state: 'released' }),
        db.count('deals', { state: 'refunded' }),
        db.count('deals', { state: 'disputed' }),
      ]);
      return build('settlement', events, {
        funded,
        released,
        refunded,
        disputed,
      });
    },

    async rewards(): Promise<DomainAnalytics> {
      const [events, rewards] = await Promise.all([
        eventsFor('rewards'),
        db.count('rewards'),
      ]);
      return build('rewards', events, { rewards });
    },

    async reputation(): Promise<DomainAnalytics> {
      const events = await eventsFor('reputation');
      return build('reputation', events, {});
    },
  };
});
