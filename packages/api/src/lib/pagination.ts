/**
 * Pagination helpers shared by list routers. Parses `?limit=&offset=` query
 * params defensively (untrusted input) and clamps them to safe bounds so a
 * client can never request an unbounded scan.
 */
import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../config/constants.js';
import type { PageMeta } from './envelope.js';

export const PaginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof PaginationQuery>;

/**
 * Parse pagination from an arbitrary query object, applying defaults + clamps.
 * Invalid values fall back to defaults rather than throwing, so a stray query
 * param never 400s a read endpoint.
 */
export const parsePagination = (query: unknown): Pagination => {
  const parsed = PaginationQuery.safeParse(query ?? {});
  return parsed.success ? parsed.data : { limit: DEFAULT_PAGE_LIMIT, offset: 0 };
};

/** Build a `PageMeta` block from a total count and the applied pagination. */
export const pageMeta = (total: number, pagination: Pagination): PageMeta => ({
  total,
  limit: pagination.limit,
  offset: pagination.offset,
});
