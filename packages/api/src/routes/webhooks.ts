/**
 * /webhooks — outbound webhook subscription management.
 *
 * Integrators register an endpoint + event topics they want pushed; the platform
 * fans matching events out and records each attempt. This router is the thin
 * HTTP surface over `WebhooksService` (validate, call, envelope).
 *   - POST /webhooks                 → register a subscription
 *   - GET  /webhooks                 → list subscriptions (paged)
 *   - GET  /webhooks/:id             → one subscription
 *   - GET  /webhooks/:id/deliveries  → delivery attempts (paged)
 */
import { z } from 'zod';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import { parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import { createWebhooksService } from '../services/webhooks.js';

const RegisterBody = z.object({
  url: z.string().url('url must be a valid URL'),
  events: z.array(z.string().trim().min(1)).min(1, 'at least one event topic'),
});

const IdParams = z.object({ id: z.string().trim().uuid('must be a UUID') });

export default defineRoutes((app, ctx) => {
  const webhooks = createWebhooksService(ctx);

  app.post('/webhooks', async (request) => {
    const { url, events } = parseOr400(RegisterBody, request.body);
    const created = await webhooks.register({ url, events });
    return ok(created);
  });

  app.get('/webhooks', async (request) => {
    const pagination = parsePagination(request.query);
    const { rows, total } = await webhooks.list(pagination);
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/webhooks/:id', async (request) => {
    const { id } = parseOr400(IdParams, request.params);
    const row = await webhooks.get(id);
    if (row === null) throw notFound(`Webhook ${id} not found`);
    return ok(row);
  });

  app.get('/webhooks/:id/deliveries', async (request) => {
    const { id } = parseOr400(IdParams, request.params);
    const pagination = parsePagination(request.query);
    const { rows, total } = await webhooks.deliveries(id, pagination);
    return okPage(rows, pageMeta(total, pagination));
  });
});
