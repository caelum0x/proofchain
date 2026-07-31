/**
 * Typed BaseRepository over the Supabase client.
 *
 * A repository encapsulates data access for a single table behind a consistent,
 * typed interface (CRUD + query). It follows the same contract as the rest of
 * the infra package:
 *
 *   * Never throws across the boundary — every method returns a `Result<T>`.
 *   * No-op-safe when unconfigured: constructed with a `null` client (i.e. when
 *     Supabase is not configured), reads resolve to empty results and writes
 *     resolve to a structured `NOT_CONFIGURED` error envelope. This mirrors
 *     `createSupabaseStore()` so callers never special-case a missing DB.
 *   * Every row crossing the boundary is validated with a zod schema, so a
 *     corrupt row can never silently propagate into the app.
 *
 * Fill convention: one file per table under `src/repositories/`, exporting a
 * `create<Table>Repository(client)` factory built on this class. See
 * `deals.ts` for the canonical example. Never edit the generated barrel by
 * hand — run `pnpm run barrels` to regenerate `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import {
  InfraErrorCode,
  ok,
  err,
  toEnvelope,
  type Result,
} from "../errors.js";

/** Supported PostgREST filter operators for `QueryFilter`. */
export type FilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in";

/** A single column predicate applied to a query. */
export interface QueryFilter {
  readonly column: string;
  readonly op: FilterOp;
  readonly value: unknown;
}

/** Declarative query specification for `find` / `count`. */
export interface QuerySpec {
  readonly filters?: readonly QueryFilter[];
  readonly orderBy?: { readonly column: string; readonly ascending?: boolean };
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Configuration binding a repository to a table. `entitySchema` validates the
 * mapped (camelCase) domain object on the way out of the DB; `insertSchema`,
 * when supplied, validates typed input on the way in.
 */
export interface RepositoryConfig<Entity, Insert> {
  /** Table name in the database. */
  readonly table: string;
  /** Primary-key column (snake_case) used for by-id lookups and upsert conflicts. */
  readonly primaryKey: string;
  /** Zod schema for a full domain entity (validated on every read). */
  readonly entitySchema: ZodType<Entity>;
  /** Optional zod schema validating typed input before a write. */
  readonly insertSchema?: ZodType<Insert>;
  /** Map a typed insert into a DB row (camelCase -> snake_case). */
  readonly toRow: (input: Insert) => Record<string, unknown>;
  /** Map a DB row into the domain shape (snake_case -> camelCase). */
  readonly fromRow: (row: Record<string, unknown>) => unknown;
}

const NOT_CONFIGURED_MSG =
  "Supabase is not configured (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY); operation skipped.";

/**
 * Generic, typed repository. Subclass it (or use it directly) to expose typed
 * data access for one table. Safe to construct with a `null` client.
 */
export class BaseRepository<Entity, Insert> {
  protected readonly client: SupabaseClient | null;
  protected readonly config: RepositoryConfig<Entity, Insert>;

  constructor(
    client: SupabaseClient | null,
    config: RepositoryConfig<Entity, Insert>,
  ) {
    this.client = client;
    this.config = config;
  }

  /** True when backed by a live Supabase client. */
  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** The table this repository is bound to. */
  get table(): string {
    return this.config.table;
  }

  /** Insert a new row and return the validated entity. */
  async create(input: Insert): Promise<Result<Entity>> {
    const validated = this.validateInput(input);
    if (validated !== null) return validated;
    if (this.client === null) return this.writeNotConfigured<Entity>();
    return this.writeSingle((c) =>
      c.from(this.config.table).insert(this.config.toRow(input)).select("*").single(),
    );
  }

  /** Insert or update on the primary key and return the validated entity. */
  async upsert(input: Insert): Promise<Result<Entity>> {
    const validated = this.validateInput(input);
    if (validated !== null) return validated;
    if (this.client === null) return this.writeNotConfigured<Entity>();
    return this.writeSingle((c) =>
      c
        .from(this.config.table)
        .upsert(this.config.toRow(input), { onConflict: this.config.primaryKey })
        .select("*")
        .single(),
    );
  }

  /** Fetch a single row by primary key, or `null` if absent. */
  async findById(id: string): Promise<Result<Entity | null>> {
    return this.findOne(this.config.primaryKey, id);
  }

  /** Fetch the first row matching `column = value`, or `null` if absent. */
  async findOne(column: string, value: unknown): Promise<Result<Entity | null>> {
    if (this.client === null) return ok<Entity | null>(null);
    try {
      const { data, error } = await this.client
        .from(this.config.table)
        .select("*")
        .eq(column, value as never)
        .maybeSingle();
      if (error) {
        return err(InfraErrorCode.SUPABASE, error.message, {
          table: this.config.table,
          column,
        });
      }
      if (data === null || data === undefined) return ok<Entity | null>(null);
      return this.mapAndValidate<Entity | null>(data as Record<string, unknown>);
    } catch (error) {
      return this.caught<Entity | null>("findOne", error);
    }
  }

  /** Fetch all rows matching the query spec (validated individually). */
  async find(spec: QuerySpec = {}): Promise<Result<readonly Entity[]>> {
    if (this.client === null) return ok<readonly Entity[]>([]);
    try {
      let query = this.client.from(this.config.table).select("*");
      query = applyFilters(query, spec.filters);
      if (spec.orderBy) {
        query = query.order(spec.orderBy.column, {
          ascending: spec.orderBy.ascending ?? true,
        });
      }
      const range = resolveRange(spec.limit, spec.offset);
      if (range !== null) query = query.range(range.from, range.to);

      const { data, error } = await query;
      if (error) {
        return err(InfraErrorCode.SUPABASE, error.message, { table: this.config.table });
      }
      const rows = (data ?? []) as unknown[];
      const out: Entity[] = [];
      for (const row of rows) {
        const parsed = this.config.entitySchema.safeParse(
          this.config.fromRow(row as Record<string, unknown>),
        );
        if (!parsed.success) return this.validationErr(parsed.error.issues);
        out.push(parsed.data);
      }
      return ok<readonly Entity[]>(out);
    } catch (error) {
      return this.caught<readonly Entity[]>("find", error);
    }
  }

  /** Count rows matching the spec (server-side `count: exact`, no rows fetched). */
  async count(spec: QuerySpec = {}): Promise<Result<number>> {
    if (this.client === null) return ok(0);
    try {
      let query = this.client
        .from(this.config.table)
        .select("*", { count: "exact", head: true });
      query = applyFilters(query, spec.filters);
      const { count, error } = await query;
      if (error) {
        return err(InfraErrorCode.SUPABASE, error.message, { table: this.config.table });
      }
      return ok(count ?? 0);
    } catch (error) {
      return this.caught<number>("count", error);
    }
  }

  /**
   * Patch specific columns of a row by primary key and return the updated
   * entity. `patch` keys are DB columns (snake_case); values are sent as-is.
   */
  async update(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Result<Entity>> {
    if (this.client === null) return this.writeNotConfigured<Entity>();
    if (Object.keys(patch).length === 0) {
      return err(InfraErrorCode.VALIDATION, "update requires at least one column");
    }
    return this.writeSingle((c) =>
      c
        .from(this.config.table)
        .update(patch)
        .eq(this.config.primaryKey, id as never)
        .select("*")
        .single(),
    );
  }

  /** Delete a row by primary key. Resolves `true` regardless of prior existence. */
  async delete(id: string): Promise<Result<boolean>> {
    if (this.client === null) return this.writeNotConfigured<boolean>();
    try {
      const { error } = await this.client
        .from(this.config.table)
        .delete()
        .eq(this.config.primaryKey, id as never);
      if (error) {
        return err(InfraErrorCode.SUPABASE, error.message, { table: this.config.table });
      }
      return ok(true);
    } catch (error) {
      return this.caught<boolean>("delete", error);
    }
  }

  // ---------------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------------

  private validateInput(input: Insert): Result<Entity> | null {
    if (this.config.insertSchema === undefined) return null;
    const parsed = this.config.insertSchema.safeParse(input);
    if (parsed.success) return null;
    return this.validationErr<Entity>(parsed.error.issues);
  }

  private async writeSingle(
    run: (
      client: SupabaseClient,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ): Promise<Result<Entity>> {
    if (this.client === null) return this.writeNotConfigured<Entity>();
    try {
      const { data, error } = await run(this.client);
      if (error) {
        return err(InfraErrorCode.SUPABASE, error.message, { table: this.config.table });
      }
      return this.mapAndValidate<Entity>(data as Record<string, unknown>);
    } catch (error) {
      return this.caught<Entity>("write", error);
    }
  }

  private mapAndValidate<R extends Entity | Entity | null>(
    row: Record<string, unknown>,
  ): Result<R> {
    const parsed = this.config.entitySchema.safeParse(this.config.fromRow(row));
    if (!parsed.success) return this.validationErr<R>(parsed.error.issues);
    return ok(parsed.data as R);
  }

  private writeNotConfigured<R>(): Result<R> {
    return err<R>(InfraErrorCode.NOT_CONFIGURED, NOT_CONFIGURED_MSG, {
      table: this.config.table,
    });
  }

  private validationErr<R>(issues: unknown): Result<R> {
    return err<R>(InfraErrorCode.VALIDATION, `Invalid ${this.config.table} row`, {
      issues,
    });
  }

  private caught<R>(op: string, error: unknown): Result<R> {
    return err<R>(InfraErrorCode.SUPABASE, `${op} on ${this.config.table} failed`, {
      cause: toEnvelope(error),
    });
  }
}

// -----------------------------------------------------------------------------
// query helpers
// -----------------------------------------------------------------------------

/** Minimal shape of the PostgREST builder methods we chain onto. */
interface FilterBuilder {
  eq(column: string, value: never): this;
  neq(column: string, value: never): this;
  gt(column: string, value: never): this;
  gte(column: string, value: never): this;
  lt(column: string, value: never): this;
  lte(column: string, value: never): this;
  like(column: string, pattern: string): this;
  ilike(column: string, pattern: string): this;
  in(column: string, values: never): this;
}

function applyFilters<B extends FilterBuilder>(
  builder: B,
  filters: readonly QueryFilter[] | undefined,
): B {
  if (filters === undefined) return builder;
  let out = builder;
  for (const f of filters) {
    out = applyFilter(out, f);
  }
  return out;
}

function applyFilter<B extends FilterBuilder>(builder: B, f: QueryFilter): B {
  switch (f.op) {
    case "eq":
      return builder.eq(f.column, f.value as never);
    case "neq":
      return builder.neq(f.column, f.value as never);
    case "gt":
      return builder.gt(f.column, f.value as never);
    case "gte":
      return builder.gte(f.column, f.value as never);
    case "lt":
      return builder.lt(f.column, f.value as never);
    case "lte":
      return builder.lte(f.column, f.value as never);
    case "like":
      return builder.like(f.column, String(f.value));
    case "ilike":
      return builder.ilike(f.column, String(f.value));
    case "in":
      return builder.in(f.column, (Array.isArray(f.value) ? f.value : [f.value]) as never);
    default:
      return builder;
  }
}

/** Translate limit/offset into a PostgREST inclusive `range`, or null if unset. */
function resolveRange(
  limit: number | undefined,
  offset: number | undefined,
): { from: number; to: number } | null {
  if (limit === undefined && offset === undefined) return null;
  const from = offset ?? 0;
  const to = limit === undefined ? Number.MAX_SAFE_INTEGER : from + limit - 1;
  return { from, to };
}
