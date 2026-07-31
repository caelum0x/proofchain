/**
 * Certificates repository — typed data access for the `certificates` compliance
 * table (certificate of origin, phytosanitary, halal, …). See `deals.ts` for the
 * fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Certificate lifecycle states (mirrors the schema CHECK constraint). */
export const CertificateStatus = z.enum(["valid", "revoked", "expired"]);
export type CertificateStatus = z.infer<typeof CertificateStatus>;

/** Fields accepted when creating/upserting a certificate. */
export const CertificateInput = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  batchId: Bytes32Hex.nullable().optional(),
  holder: AddressHex.nullable().optional(),
  issuer: AddressHex.nullable().optional(),
  status: CertificateStatus.optional(),
  uri: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CertificateInput = z.infer<typeof CertificateInput>;

/** A certificate row as stored/returned. */
export const Certificate = z.object({
  id: z.string(),
  kind: z.string(),
  batchId: Bytes32Hex.nullable(),
  holder: AddressHex.nullable(),
  issuer: AddressHex.nullable(),
  status: CertificateStatus,
  uri: z.string().nullable(),
  expiresAt: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Certificate = z.infer<typeof Certificate>;

const config: RepositoryConfig<Certificate, CertificateInput> = {
  table: "certificates",
  primaryKey: "id",
  entitySchema: Certificate,
  insertSchema: CertificateInput,
  toRow: (c) => ({
    id: c.id,
    kind: c.kind,
    batch_id: c.batchId ?? null,
    holder: c.holder ?? null,
    issuer: c.issuer ?? null,
    status: c.status ?? "valid",
    uri: c.uri ?? null,
    expires_at: c.expiresAt ?? null,
    metadata: c.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    kind: row.kind,
    batchId: row.batch_id ?? null,
    holder: row.holder ?? null,
    issuer: row.issuer ?? null,
    status: row.status,
    uri: row.uri ?? null,
    expiresAt: normalizeTimestampOrNull(row.expires_at),
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `certificates` table. */
export class CertificatesRepository extends BaseRepository<
  Certificate,
  CertificateInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All certificates covering the given batch, newest first. */
  findByBatch(batchId: string): Promise<Result<readonly Certificate[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All certificates held by the given address. */
  findByHolder(holder: string): Promise<Result<readonly Certificate[]>> {
    return this.find({ filters: [{ column: "holder", op: "eq", value: holder }] });
  }

  /** All certificates of the given kind (e.g. "origin", "halal"). */
  findByKind(kind: string): Promise<Result<readonly Certificate[]>> {
    return this.find({ filters: [{ column: "kind", op: "eq", value: kind }] });
  }
}

/** Factory: build a `CertificatesRepository` over the (possibly null) client. */
export function createCertificatesRepository(
  client: SupabaseClient | null,
): CertificatesRepository {
  return new CertificatesRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeTimestampOrNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return normalizeTimestamp(value);
}
