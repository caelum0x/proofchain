/**
 * /notifications — app-level notification feed.
 *
 * Serves the append-only `notifications` table (recipient, kind, payload, read
 * flag). Read-only surface for the web app's notification center.
 *   - GET /notifications              → recent notifications (paged)
 *   - GET /notifications/search       → filter by recipient / kind / read
 *   - GET /notifications/unread-count → unread count for a recipient
 *   - GET /notifications/:id          → one notification
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { ok } from '../lib/envelope.js';
import {
  AddressSchema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const UuidSchema = z
  .string()
  .trim()
  .uuid('must be a UUID');

const SearchQuery = z.object({
  recipient: AddressSchema.optional(),
  kind: z.string().trim().min(1).max(64).optional(),
  read: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

const UnreadQuery = z.object({
  recipient: AddressSchema,
});

export default defineRoutes((app, ctx) => {
  app.get('/notifications', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'notifications',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/notifications/search', async (request) => {
    const pagination = paginate(request.query);
    const { recipient, kind, read } = parseOrThrow(
      SearchQuery,
      request.query,
      'notification search query',
    );
    return listTable(ctx.db, {
      table: 'notifications',
      pagination,
      filters: { recipient, kind, read },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/notifications/unread-count', async (request) => {
    const { recipient } = parseOrThrow(
      UnreadQuery,
      request.query,
      'unread-count query',
    );
    const count = await ctx.db.count('notifications', {
      recipient,
      read: false,
    });
    return ok({ recipient, unread: count });
  });

  app.get('/notifications/:id', async (request) => {
    const { id } = request.params as { id: string };
    const notificationId = parseOrThrow(UuidSchema, id, 'notification id');
    return getRowOr404(
      ctx.db,
      'notifications',
      'id',
      notificationId,
      'Notification',
    );
  });
});
