/**
 * Exports service — dump a read-model table to CSV or JSON.
 *
 * Powers data portability for the web app's "Export" buttons and offline
 * analysis. Only a WHITELIST of read-model tables is exportable (never an
 * arbitrary table name — that would be a data-exfiltration surface), and every
 * export is bounded by the same pagination clamps as the list endpoints. CSV
 * serialization is a pure function of the rows (RFC-4180 quoting), so it is
 * deterministic and unit-testable offline.
 */
import type { FilterValue } from '../lib/db.js';
import type { Pagination } from '../lib/pagination.js';
import { validationError } from '../lib/errors.js';
import { defineService } from './base.js';

/** Tables an operator may export. Kept in sync with the indexer projections. */
export const EXPORTABLE_TABLES = [
  'suppliers',
  'deals',
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
  'notifications',
  'indexer_events',
] as const;

export type ExportableTable = (typeof EXPORTABLE_TABLES)[number];

export type ExportFormat = 'csv' | 'json';

export interface ExportInput {
  readonly resource: string;
  readonly pagination: Pagination;
  readonly filters?: Readonly<Record<string, FilterValue>>;
}

export interface ExportResult {
  readonly resource: ExportableTable;
  readonly count: number;
  readonly rows: readonly Record<string, unknown>[];
}

export interface ExportsService {
  /** The tables an operator may export. */
  resources(): readonly ExportableTable[];
  /** Fetch a bounded window of a whitelisted table. */
  export(input: ExportInput): Promise<ExportResult>;
  /** Serialize rows to RFC-4180 CSV (pure). */
  toCsv(rows: readonly Record<string, unknown>[]): string;
}

const isExportable = (name: string): name is ExportableTable =>
  (EXPORTABLE_TABLES as readonly string[]).includes(name);

/** Union of every key across rows, preserving first-seen order for stability. */
const columnsOf = (
  rows: readonly Record<string, unknown>[],
): readonly string[] => {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return [...seen];
};

/** Quote a single CSV field per RFC-4180 (escape quotes, wrap when needed). */
const csvField = (value: unknown): string => {
  const raw =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  if (/[",\n\r]/u.test(raw)) {
    return `"${raw.replace(/"/gu, '""')}"`;
  }
  return raw;
};

/** Build an {@link ExportsService} bound to the request context. */
export const createExportsService = defineService<ExportsService>((ctx) => ({
  resources(): readonly ExportableTable[] {
    return EXPORTABLE_TABLES;
  },

  async export({ resource, pagination, filters }): Promise<ExportResult> {
    if (!isExportable(resource)) {
      throw validationError(
        `resource '${resource}' is not exportable`,
        { allowed: EXPORTABLE_TABLES },
      );
    }
    const rows = await ctx.db.list<Record<string, unknown>>(resource, {
      limit: pagination.limit,
      offset: pagination.offset,
      ...(filters !== undefined ? { filters } : {}),
      order: { column: 'created_at', ascending: false },
    });
    return { resource, count: rows.length, rows };
  },

  toCsv(rows): string {
    if (rows.length === 0) return '';
    const columns = columnsOf(rows);
    const header = columns.map(csvField).join(',');
    const lines = rows.map((row) =>
      columns.map((col) => csvField(row[col])).join(','),
    );
    return [header, ...lines].join('\r\n');
  },
}));
