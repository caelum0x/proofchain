/**
 * Containers repository — typed data access for the `containers` logistics table.
 * See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Bytes32Hex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Container lifecycle states (mirrors the schema CHECK constraint). */
export const ContainerStatus = z.enum([
  "empty",
  "loaded",
  "sealed",
  "in_transit",
  "delivered",
]);
export type ContainerStatus = z.infer<typeof ContainerStatus>;

/** Fields accepted when creating/upserting a container. */
export const ContainerInput = z.object({
  id: z.string().min(1),
  containerNumber: z.string().nullable().optional(),
  freightId: z.string().nullable().optional(),
  batchId: Bytes32Hex.nullable().optional(),
  status: ContainerStatus.optional(),
  location: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ContainerInput = z.infer<typeof ContainerInput>;

/** A container row as stored/returned. */
export const Container = z.object({
  id: z.string(),
  containerNumber: z.string().nullable(),
  freightId: z.string().nullable(),
  batchId: Bytes32Hex.nullable(),
  status: ContainerStatus,
  location: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Container = z.infer<typeof Container>;

const config: RepositoryConfig<Container, ContainerInput> = {
  table: "containers",
  primaryKey: "id",
  entitySchema: Container,
  insertSchema: ContainerInput,
  toRow: (c) => ({
    id: c.id,
    container_number: c.containerNumber ?? null,
    freight_id: c.freightId ?? null,
    batch_id: c.batchId ?? null,
    status: c.status ?? "empty",
    location: c.location ?? null,
    metadata: c.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    containerNumber: row.container_number ?? null,
    freightId: row.freight_id ?? null,
    batchId: row.batch_id ?? null,
    status: row.status,
    location: row.location ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `containers` table. */
export class ContainersRepository extends BaseRepository<
  Container,
  ContainerInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All containers belonging to the given freight booking, newest first. */
  findByFreight(freightId: string): Promise<Result<readonly Container[]>> {
    return this.find({
      filters: [{ column: "freight_id", op: "eq", value: freightId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** The container carrying the given ISO container number, if any. */
  findByNumber(containerNumber: string): Promise<Result<Container | null>> {
    return this.findOne("container_number", containerNumber);
  }

  /** All containers in the given status (e.g. "in_transit"). */
  findByStatus(status: ContainerStatus): Promise<Result<readonly Container[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }
}

/** Factory: build a `ContainersRepository` over the (possibly null) client. */
export function createContainersRepository(
  client: SupabaseClient | null,
): ContainersRepository {
  return new ContainersRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
