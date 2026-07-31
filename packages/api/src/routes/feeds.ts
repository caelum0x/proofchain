/**
 * /feeds — syndication of recent on-chain activity (JSON Feed / RSS).
 *
 * Thin HTTP surface over `FeedsService`. The index returns the available groups
 * in the standard envelope; a group feed returns the STANDARD syndication
 * document (JSON Feed 1.1 or RSS 2.0) with its native content type so feed
 * readers consume it directly.
 *   - GET /feeds           → available feed groups
 *   - GET /feeds/:group    → group feed (?format=json|rss&limit=)
 */
import { z } from 'zod';
import { MAX_PAGE_LIMIT } from '../config/constants.js';
import { ok } from '../lib/envelope.js';
import { parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import { createFeedsService } from '../services/feeds.js';

const GroupParams = z.object({ group: z.string().trim().min(1) });
const FeedQuery = z.object({
  format: z.enum(['json', 'rss']).default('json'),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).default(25),
});

export default defineRoutes((app, ctx) => {
  const feeds = createFeedsService(ctx);

  app.get('/feeds', async () => ok({ groups: feeds.groups() }));

  app.get('/feeds/:group', async (request, reply) => {
    const { group } = parseOr400(GroupParams, request.params);
    const { format, limit } = parseOr400(FeedQuery, request.query);

    if (format === 'rss') {
      const xml = await feeds.rss(group, limit);
      return reply.type('application/rss+xml; charset=utf-8').send(xml);
    }

    const feed = await feeds.jsonFeed(group, limit);
    return reply.type('application/feed+json; charset=utf-8').send(feed);
  });
});
