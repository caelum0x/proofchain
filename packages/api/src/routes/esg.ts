/**
 * /esg — ESG scores & attestations (M8: ESGRegistry, SustainabilityOracle).
 *
 * Serves the `esg` projection table (per-subject score + attestation URI).
 * A subject is a batchId or an org address (stored as text).
 *   - GET /esg               → list ESG records
 *   - GET /esg/search        → filter by subject / minimum score
 *   - GET /esg/:subject      → the latest ESG record for a subject
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  IdSchema,
  getLatestOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const SearchQuery = z.object({
  subject: z.string().trim().min(1).max(128).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/esg', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'esg',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/esg/search', async (request) => {
    const pagination = paginate(request.query);
    const { subject } = parseOrThrow(
      SearchQuery,
      request.query,
      'esg search query',
    );
    return listTable(ctx.db, {
      table: 'esg',
      pagination,
      filters: { subject },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/esg/:subject', async (request) => {
    const { subject } = request.params as { subject: string };
    const value = parseOrThrow(IdSchema, subject, 'esg subject');
    // `subject` is indexed but not unique — return the latest record for it.
    return getLatestOr404(ctx.db, 'esg', 'subject', value, 'ESG record');
  });
});
