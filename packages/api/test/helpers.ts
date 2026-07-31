/**
 * Shared test helpers: a silent logger, an in-memory fake Db, and a
 * chainable fake PostgREST client for exercising the generic Db layer.
 */
import type { Logger } from '../src/logger.js';
import type { Db, FilterValue, ListOptions } from '../src/lib/db.js';

/** No-op logger — avoids pino transport noise and keeps tests dependency-light. */
export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  trace: () => undefined,
  fatal: () => undefined,
  child: () => silentLogger,
} as unknown as Logger;

export interface RecordedUpsert {
  table: string;
  row: Record<string, unknown>;
  onConflict: string;
}

export interface FakeDb extends Db {
  readonly upserts: RecordedUpsert[];
  seed(table: string, key: string, value: Record<string, unknown>): void;
}

/** In-memory Db that records writes and serves seeded rows for `getBy`. */
export const createFakeDb = (configured = true): FakeDb => {
  const upserts: RecordedUpsert[] = [];
  const store = new Map<string, Record<string, unknown>>();
  const keyOf = (table: string, k: string): string => `${table}:${k}`;

  return {
    isConfigured: configured,
    upserts,
    seed(table, key, value) {
      store.set(keyOf(table, key), value);
    },
    async list<T = Record<string, unknown>>(
      _table: string,
      _options?: ListOptions,
    ): Promise<T[]> {
      return [] as T[];
    },
    async count(): Promise<number> {
      return 0;
    },
    async getBy<T = Record<string, unknown>>(
      table: string,
      _column: string,
      value: FilterValue,
    ): Promise<T | null> {
      return (store.get(keyOf(table, String(value))) as T) ?? null;
    },
    async upsert<T = Record<string, unknown>>(
      table: string,
      row: Record<string, unknown>,
      onConflict: string,
    ): Promise<T> {
      upserts.push({ table, row, onConflict });
      // Make the write visible to getBy (keyed on the conflict column) so
      // read-after-write flows (e.g. cursor persistence) behave realistically.
      const key = row[onConflict];
      if (key !== undefined) store.set(keyOf(table, String(key)), row);
      return row as T;
    },
    async insert<T = Record<string, unknown>>(
      _table: string,
      row: Record<string, unknown>,
    ): Promise<T> {
      return row as T;
    },
  };
};

/** Captured state from one fake query chain (for assertions). */
export interface FakeQueryState {
  table: string;
  op: 'select' | 'insert' | 'upsert';
  select: string;
  filters: Record<string, FilterValue>;
  order: { column: string; ascending: boolean } | null;
  range: [number, number] | null;
  row: Record<string, unknown> | null;
  onConflict: string | null;
  count: boolean;
  head: boolean;
}

export type FakeResult = { data: unknown; error: { message: string } | null; count?: number | null };

/**
 * Build a fake PostgREST-shaped client. `respond(state)` returns the result for
 * a completed chain, letting a test both assert the built query and control the
 * response. Every returned builder is thenable + supports maybe/single.
 */
export const createFakeRawClient = (
  respond: (state: FakeQueryState) => FakeResult,
): { from: (table: string) => unknown; lastState: () => FakeQueryState | null } => {
  let last: FakeQueryState | null = null;

  const from = (table: string): unknown => {
    const state: FakeQueryState = {
      table,
      op: 'select',
      select: '*',
      filters: {},
      order: null,
      range: null,
      row: null,
      onConflict: null,
      count: false,
      head: false,
    };
    last = state;
    const result = (): FakeResult => respond(state);
    const builder: Record<string, unknown> = {
      select(sel?: string, opts?: { count?: 'exact'; head?: boolean }) {
        if (sel !== undefined) state.select = sel;
        if (opts?.count === 'exact') state.count = true;
        if (opts?.head === true) state.head = true;
        return builder;
      },
      insert(row: Record<string, unknown>) {
        state.op = 'insert';
        state.row = row;
        return builder;
      },
      upsert(row: Record<string, unknown>, opts: { onConflict: string }) {
        state.op = 'upsert';
        state.row = row;
        state.onConflict = opts.onConflict;
        return builder;
      },
      eq(column: string, value: FilterValue) {
        state.filters[column] = value;
        return builder;
      },
      order(column: string, opts: { ascending: boolean }) {
        state.order = { column, ascending: opts.ascending };
        return builder;
      },
      range(fromIdx: number, toIdx: number) {
        state.range = [fromIdx, toIdx];
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(result());
      },
      single() {
        return Promise.resolve(result());
      },
      then(
        onOk: (v: FakeResult) => unknown,
        onErr?: (e: unknown) => unknown,
      ) {
        return Promise.resolve(result()).then(onOk, onErr);
      },
    };
    return builder;
  };

  return { from, lastState: () => last };
};
