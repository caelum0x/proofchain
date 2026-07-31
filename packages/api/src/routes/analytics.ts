/**
 * /analytics — network overview + time series.
 *
 * Aggregates the read model into dashboard-ready figures:
 *   - GET /analytics            → totals per domain + indexed-event counts per module group
 *   - GET /analytics/events     → recent cross-module event feed (paged)
 *   - GET /analytics/timeseries → daily event counts over a bounded recent window
 *
 * All figures come from Supabase (`indexer_events` + projection tables). Counts
 * run concurrently; the time series is bucketed in the API layer from a bounded
 * window (the generic DB layer has no GROUP BY).
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { ok } from '../lib/envelope.js';
import { listEvents, paginate, parseOrThrow } from '../lib/resourceRoutes.js';
import { MAX_PAGE_LIMIT } from '../config/constants.js';

/** Module groups the indexer routes events to (mirrors SPEC2 M0–M10). */
const GROUPS = [
  'core',
  'provenance',
  'settlement',
  'identity',
  'reputation',
  'finance',
  'insurance',
  'governance',
  'esg',
  'marketplace',
  'rewards',
] as const;

/** Projection tables whose row counts summarize each domain's activity. */
const DOMAIN_TABLES = [
  'receivables',
  'financing_listings',
  'pools',
  'policies',
  'claims',
  'disputes',
  'proposals',
  'listings',
  'auctions',
  'rewards',
] as const;

const TimeseriesQuery = z.object({
  group: z.enum(GROUPS).optional(),
  days: z.coerce.number().int().min(1).max(90).default(14),
});

/** UTC day bucket (YYYY-MM-DD) for a timestamptz string; null if unparseable. */
const dayBucket = (createdAt: unknown): string | null => {
  if (typeof createdAt !== 'string') return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

export default defineRoutes((app, ctx) => {
  // Network overview: domain row counts + per-group event counts.
  app.get('/analytics', async () => {
    const [domainCounts, groupCounts, totalEvents] = await Promise.all([
      Promise.all(DOMAIN_TABLES.map((t) => ctx.db.count(t))),
      Promise.all(
        GROUPS.map((g) => ctx.db.count('indexer_events', { group_name: g })),
      ),
      ctx.db.count('indexer_events'),
    ]);

    const domains: Record<string, number> = {};
    DOMAIN_TABLES.forEach((table, i) => {
      domains[table] = domainCounts[i] ?? 0;
    });

    const events: Record<string, number> = {};
    GROUPS.forEach((group, i) => {
      events[group] = groupCounts[i] ?? 0;
    });

    return ok({
      totals: { indexedEvents: totalEvents },
      domains,
      eventsByGroup: events,
    });
  });

  // Recent cross-module event feed.
  app.get('/analytics/events', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, { pagination });
  });

  // Daily event counts over a bounded recent window.
  app.get('/analytics/timeseries', async (request) => {
    const { group, days } = parseOrThrow(
      TimeseriesQuery,
      request.query,
      'timeseries query',
    );
    const rows = await ctx.db.list<{ created_at: string }>('indexer_events', {
      ...(group !== undefined ? { filters: { group_name: group } } : {}),
      order: { column: 'created_at', ascending: false },
      limit: MAX_PAGE_LIMIT,
    });

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const bucket = dayBucket(row.created_at);
      if (bucket === null) continue;
      if (new Date(row.created_at).getTime() < cutoff) continue;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }

    const series = [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return ok({
      ...(group !== undefined ? { group } : {}),
      days,
      sampled: rows.length,
      window: MAX_PAGE_LIMIT,
      series,
    });
  });
});
