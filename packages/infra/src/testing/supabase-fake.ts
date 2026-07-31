/**
 * A small in-memory fake of the Supabase/PostgREST query builder for offline
 * tests. It implements the subset of the fluent API the infra package uses
 * (select/insert/upsert/update/delete + eq/neq/gt/gte/lt/lte/like/ilike/in +
 * order/range/limit + single/maybeSingle + count/head) against a real backing
 * store, so repositories/queue/outbox/migration tests exercise genuine CRUD.
 *
 * Excluded from the published build (see tsconfig.build.json) — test-only.
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Filter = { op: string; column: string; value: unknown };

const FIXED_TS = "2026-07-31T00:00:00.000Z";

export interface FakeSupabase {
  /** Minimal structural stand-in for a SupabaseClient. */
  client: { from(table: string): QueryBuilder };
  /** Direct access to the backing tables for assertions/seeding. */
  tables: Map<string, Row[]>;
}

/** Build a fake client seeded with the given tables. */
export function createFakeSupabase(seed: Record<string, Row[]> = {}): FakeSupabase {
  const tables = new Map<string, Row[]>();
  for (const [name, rows] of Object.entries(seed)) {
    tables.set(name, rows.map((r) => ({ ...r })));
  }
  const client = {
    from(table: string): QueryBuilder {
      if (!tables.has(table)) tables.set(table, []);
      return new QueryBuilder(tables, table);
    },
  };
  return { client, tables };
}

interface RunResult {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

class QueryBuilder {
  private readonly filters: Filter[] = [];
  private selectRequested = false;
  private countMode = false;
  private headMode = false;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rangeBounds: { from: number; to: number } | null = null;
  private limitN: number | null = null;
  private mutation:
    | { type: "insert" | "upsert"; payload: Row; onConflict?: string }
    | { type: "update"; payload: Row }
    | { type: "delete" }
    | null = null;

  constructor(
    private readonly tables: Map<string, Row[]>,
    private readonly table: string,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }): this {
    this.selectRequested = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }

  insert(payload: Row): this {
    this.mutation = { type: "insert", payload };
    return this;
  }

  upsert(payload: Row, opts?: { onConflict?: string }): this {
    this.mutation = { type: "upsert", payload, ...(opts?.onConflict ? { onConflict: opts.onConflict } : {}) };
    return this;
  }

  update(payload: Row): this {
    this.mutation = { type: "update", payload };
    return this;
  }

  delete(): this {
    this.mutation = { type: "delete" };
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.pushFilter("eq", column, value);
  }
  neq(column: string, value: unknown): this {
    return this.pushFilter("neq", column, value);
  }
  gt(column: string, value: unknown): this {
    return this.pushFilter("gt", column, value);
  }
  gte(column: string, value: unknown): this {
    return this.pushFilter("gte", column, value);
  }
  lt(column: string, value: unknown): this {
    return this.pushFilter("lt", column, value);
  }
  lte(column: string, value: unknown): this {
    return this.pushFilter("lte", column, value);
  }
  like(column: string, value: string): this {
    return this.pushFilter("like", column, value);
  }
  ilike(column: string, value: string): this {
    return this.pushFilter("ilike", column, value);
  }
  in(column: string, value: unknown[]): this {
    return this.pushFilter("in", column, value);
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: opts?.ascending ?? true };
    return this;
  }
  range(from: number, to: number): this {
    this.rangeBounds = { from, to };
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  async single(): Promise<RunResult> {
    const res = this.run();
    const rows = Array.isArray(res.data) ? res.data : [];
    if (res.error) return res;
    if (rows.length === 0) return { data: null, error: { message: "no rows" } };
    return { data: rows[0], error: null };
  }

  async maybeSingle(): Promise<RunResult> {
    const res = this.run();
    const rows = Array.isArray(res.data) ? res.data : [];
    if (res.error) return res;
    return { data: rows[0] ?? null, error: null };
  }

  // Thenable so `await builder` resolves like a PostgREST query.
  then<T>(
    resolve: (value: RunResult) => T,
    reject?: (reason: unknown) => T,
  ): Promise<T> {
    try {
      return Promise.resolve(resolve(this.run()));
    } catch (error) {
      return reject ? Promise.resolve(reject(error)) : Promise.reject(error);
    }
  }

  // ---------------------------------------------------------------------------

  private pushFilter(op: string, column: string, value: unknown): this {
    this.filters.push({ op, column, value });
    return this;
  }

  private rows(): Row[] {
    const rows = this.tables.get(this.table);
    if (rows === undefined) {
      const created: Row[] = [];
      this.tables.set(this.table, created);
      return created;
    }
    return rows;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => applyFilter(row, f));
  }

  private run(): RunResult {
    if (this.mutation !== null) return this.runMutation();
    return this.runSelect();
  }

  private runSelect(): RunResult {
    let rows = this.rows().filter((r) => this.matches(r));
    if (this.countMode) {
      const count = rows.length;
      return { data: this.headMode ? null : rows.map(clone), error: null, count };
    }
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1));
    }
    if (this.rangeBounds) {
      rows = rows.slice(this.rangeBounds.from, this.rangeBounds.to + 1);
    }
    if (this.limitN !== null) {
      rows = rows.slice(0, this.limitN);
    }
    return { data: rows.map(clone), error: null };
  }

  private runMutation(): RunResult {
    const store = this.rows();
    const mutation = this.mutation!;
    if (mutation.type === "insert" || mutation.type === "upsert") {
      const record = withDefaults(mutation.payload);
      if (mutation.type === "upsert" && mutation.onConflict !== undefined) {
        const key = mutation.onConflict;
        const idx = store.findIndex((r) => r[key] === record[key]);
        if (idx >= 0) {
          const merged = { ...store[idx], ...mutation.payload, updated_at: FIXED_TS };
          store[idx] = merged;
          return { data: [clone(merged)], error: null };
        }
      }
      store.push(record);
      return { data: [clone(record)], error: null };
    }
    if (mutation.type === "update") {
      const affected: Row[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const current = store[i] as Row;
        if (this.matches(current)) {
          const merged = { ...current, ...mutation.payload, updated_at: FIXED_TS };
          store[i] = merged;
          affected.push(merged);
        }
      }
      return { data: affected.map(clone), error: null };
    }
    // delete
    const remaining = store.filter((r) => !this.matches(r));
    this.tables.set(this.table, remaining);
    return { data: [], error: null };
  }
}

function withDefaults(payload: Row): Row {
  const row: Row = { ...payload };
  if (row.id === undefined) row.id = randomUUID();
  if (row.created_at === undefined) row.created_at = FIXED_TS;
  if (row.updated_at === undefined) row.updated_at = FIXED_TS;
  return row;
}

function clone(row: Row): Row {
  return { ...row };
}

function applyFilter(row: Row, filter: Filter): boolean {
  const actual = row[filter.column];
  switch (filter.op) {
    case "eq":
      return actual === filter.value;
    case "neq":
      return actual !== filter.value;
    case "gt":
      return compare(actual, filter.value) > 0;
    case "gte":
      return compare(actual, filter.value) >= 0;
    case "lt":
      return compare(actual, filter.value) < 0;
    case "lte":
      return compare(actual, filter.value) <= 0;
    case "like":
    case "ilike":
      return likeMatch(String(actual), String(filter.value), filter.op === "ilike");
    case "in":
      return Array.isArray(filter.value) && filter.value.includes(actual);
    default:
      return false;
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function likeMatch(value: string, pattern: string, insensitive: boolean): boolean {
  const rx = new RegExp(
    `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`,
    insensitive ? "i" : "",
  );
  return rx.test(value);
}
