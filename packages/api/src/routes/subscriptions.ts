/**
 * /subscriptions — Server-Sent Events (SSE) replay snapshots.
 *
 * On connect (or reconnect) a client receives the current snapshot for a channel
 * as `text/event-stream` frames, newest first, terminated by a `ping` frame. A
 * long-lived push stream is an infra concern (the indexer would keep the socket
 * open); this endpoint provides the standards-compliant, bounded, replayable
 * snapshot every SSE client reads first — and is deterministically testable.
 *   - GET /subscriptions            → available channels
 *   - GET /subscriptions/:channel   → SSE snapshot (?limit=&recipient=)
 */
import { z } from 'zod';
import { MAX_PAGE_LIMIT } from '../config/constants.js';
import { ok } from '../lib/envelope.js';
import { hexAddress, parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import {
  createSubscriptionsService,
  type SseFrame,
} from '../services/subscriptions.js';

const ChannelParams = z.object({ channel: z.string().trim().min(1) });
const StreamQuery = z.object({
  limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).default(25),
  recipient: hexAddress.optional(),
});

/** Serialize one frame into the SSE wire format (id/event/data lines). */
const encodeFrame = (frame: SseFrame): string =>
  `id: ${frame.id}\nevent: ${frame.event}\ndata: ${JSON.stringify(
    frame.data,
  )}\n\n`;

export default defineRoutes((app, ctx) => {
  const subscriptions = createSubscriptionsService(ctx);

  app.get('/subscriptions', async () =>
    ok({ channels: subscriptions.channels() }),
  );

  app.get('/subscriptions/:channel', async (request, reply) => {
    const { channel } = parseOr400(ChannelParams, request.params);
    const { limit, recipient } = parseOr400(StreamQuery, request.query);

    const frames = await subscriptions.snapshot({
      channel,
      limit,
      ...(recipient !== undefined ? { recipient } : {}),
    });

    const body =
      frames.map(encodeFrame).join('') +
      `event: ping\ndata: ${JSON.stringify({ channel, count: frames.length })}\n\n`;

    return reply
      .header('cache-control', 'no-cache')
      .header('connection', 'keep-alive')
      .type('text/event-stream; charset=utf-8')
      .send(body);
  });
});
