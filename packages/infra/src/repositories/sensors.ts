/**
 * Sensors repository — typed data access for the `sensors` IoT registry table
 * (data/oracle layer). Tracks registered devices and their latest reading. See
 * `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Bytes32Hex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Sensor operational states (mirrors the schema CHECK constraint). */
export const SensorStatus = z.enum(["active", "inactive", "faulty"]);
export type SensorStatus = z.infer<typeof SensorStatus>;

/** Fields accepted when creating/upserting a sensor. */
export const SensorInput = z.object({
  id: z.string().min(1),
  deviceId: z.string().min(1),
  batchId: Bytes32Hex.nullable().optional(),
  sensorType: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  lastReading: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  status: SensorStatus.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type SensorInput = z.infer<typeof SensorInput>;

/** A sensor row as stored/returned. */
export const Sensor = z.object({
  id: z.string(),
  deviceId: z.string(),
  batchId: Bytes32Hex.nullable(),
  sensorType: z.string().nullable(),
  location: z.string().nullable(),
  lastReading: z.number().nullable(),
  unit: z.string().nullable(),
  status: SensorStatus,
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Sensor = z.infer<typeof Sensor>;

const config: RepositoryConfig<Sensor, SensorInput> = {
  table: "sensors",
  primaryKey: "id",
  entitySchema: Sensor,
  insertSchema: SensorInput,
  toRow: (s) => ({
    id: s.id,
    device_id: s.deviceId,
    batch_id: s.batchId ?? null,
    sensor_type: s.sensorType ?? null,
    location: s.location ?? null,
    last_reading: s.lastReading ?? null,
    unit: s.unit ?? null,
    status: s.status ?? "active",
    metadata: s.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    deviceId: row.device_id,
    batchId: row.batch_id ?? null,
    sensorType: row.sensor_type ?? null,
    location: row.location ?? null,
    lastReading: toNumberOrNull(row.last_reading),
    unit: row.unit ?? null,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `sensors` table. */
export class SensorsRepository extends BaseRepository<Sensor, SensorInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** The registered sensor for the given device id, if any. */
  findByDevice(deviceId: string): Promise<Result<Sensor | null>> {
    return this.findOne("device_id", deviceId);
  }

  /** All sensors attached to the given batch. */
  findByBatch(batchId: string): Promise<Result<readonly Sensor[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All sensors in the given operational status (e.g. "faulty"). */
  findByStatus(status: SensorStatus): Promise<Result<readonly Sensor[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }
}

/** Factory: build a `SensorsRepository` over the (possibly null) client. */
export function createSensorsRepository(
  client: SupabaseClient | null,
): SensorsRepository {
  return new SensorsRepository(client);
}

function toNumberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
