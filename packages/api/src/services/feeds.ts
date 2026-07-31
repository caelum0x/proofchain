/**
 * Feeds service — syndication of recent on-chain activity as JSON Feed / RSS.
 *
 * Turns the append-only `indexer_events` audit log (scoped to a module group)
 * into a standard syndication document so dashboards, bots, and feed readers can
 * subscribe without bespoke API clients. Both builders are PURE functions of the
 * fetched rows (JSON Feed 1.1 + RSS 2.0 with XML escaping), keeping them
 * deterministic and offline-testable. Group names mirror the indexer's module
 * groups (see `/analytics`).
 */
import type { FilterValue } from '../lib/db.js';
import { validationError } from '../lib/errors.js';
import { defineService } from './base.js';

/** Module groups a feed can be built for (mirror the indexer groups). */
export const FEED_GROUPS = [
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

export type FeedGroup = (typeof FEED_GROUPS)[number];

/** A raw indexer event row used to build feed items. */
interface EventRow {
  readonly id?: string;
  readonly contract?: string;
  readonly event_name?: string;
  readonly block_number?: string | number;
  readonly tx_hash?: string;
  readonly args?: Record<string, unknown> | null;
  readonly created_at?: string;
}

export interface FeedItem {
  readonly id: string;
  readonly title: string;
  readonly content_text: string;
  readonly date_published: string | null;
}

export interface JsonFeed {
  readonly version: string;
  readonly title: string;
  readonly items: readonly FeedItem[];
}

export interface FeedsService {
  /** Groups a feed can be built for. */
  groups(): readonly FeedGroup[];
  /** Build a JSON Feed 1.1 document for a group. */
  jsonFeed(group: string, limit: number): Promise<JsonFeed>;
  /** Build an RSS 2.0 XML document for a group. */
  rss(group: string, limit: number): Promise<string>;
}

const isFeedGroup = (name: string): name is FeedGroup =>
  (FEED_GROUPS as readonly string[]).includes(name);

/** Escape a string for safe inclusion in XML text/attribute content. */
const xmlEscape = (value: string): string =>
  value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');

const itemId = (row: EventRow): string =>
  row.id ??
  `${row.contract ?? 'contract'}-${row.event_name ?? 'event'}-${
    row.block_number ?? '0'
  }-${row.tx_hash ?? ''}`;

const itemTitle = (row: EventRow): string =>
  `${row.event_name ?? 'Event'} on ${row.contract ?? 'contract'}`;

const toItem = (row: EventRow): FeedItem => ({
  id: itemId(row),
  title: itemTitle(row),
  content_text: JSON.stringify(row.args ?? {}),
  date_published: row.created_at ?? null,
});

/** Build a {@link FeedsService} bound to the request context. */
export const createFeedsService = defineService<FeedsService>((ctx) => {
  const fetchRows = async (group: string, limit: number): Promise<EventRow[]> => {
    if (!isFeedGroup(group)) {
      throw validationError(`unknown feed group '${group}'`, {
        allowed: FEED_GROUPS,
      });
    }
    const filters: Record<string, FilterValue> = { group_name: group };
    return ctx.db.list<EventRow>('indexer_events', {
      filters,
      order: { column: 'created_at', ascending: false },
      limit,
    });
  };

  return {
    groups(): readonly FeedGroup[] {
      return FEED_GROUPS;
    },

    async jsonFeed(group, limit): Promise<JsonFeed> {
      const rows = await fetchRows(group, limit);
      return {
        version: 'https://jsonfeed.org/version/1.1',
        title: `ProofChain — ${group} activity`,
        items: rows.map(toItem),
      };
    },

    async rss(group, limit): Promise<string> {
      const rows = await fetchRows(group, limit);
      const items = rows
        .map((row) => {
          const item = toItem(row);
          const pubDate =
            item.date_published !== null
              ? `\n      <pubDate>${xmlEscape(
                  new Date(item.date_published).toUTCString(),
                )}</pubDate>`
              : '';
          return `    <item>
      <title>${xmlEscape(item.title)}</title>
      <guid isPermaLink="false">${xmlEscape(item.id)}</guid>
      <description>${xmlEscape(item.content_text)}</description>${pubDate}
    </item>`;
        })
        .join('\n');
      return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ProofChain — ${xmlEscape(group)} activity</title>
    <description>Recent on-chain ${xmlEscape(group)} events</description>
${items}
  </channel>
</rss>`;
    },
  };
});
