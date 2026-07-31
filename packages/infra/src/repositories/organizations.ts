/**
 * Organizations repository — typed data access for the `organizations` identity
 * table (M3). See `deals.ts` for the canonical fill convention. Never edit the
 * generated `index.ts` barrel by hand — run `pnpm run barrels`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting an organization. */
export const OrganizationInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  orgType: z.string().nullable().optional(),
  admin: AddressHex.nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type OrganizationInput = z.infer<typeof OrganizationInput>;

/** An organization row as stored/returned. */
export const Organization = z.object({
  id: z.string(),
  name: z.string(),
  orgType: z.string().nullable(),
  admin: AddressHex.nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Organization = z.infer<typeof Organization>;

const config: RepositoryConfig<Organization, OrganizationInput> = {
  table: "organizations",
  primaryKey: "id",
  entitySchema: Organization,
  insertSchema: OrganizationInput,
  toRow: (o) => ({
    id: o.id,
    name: o.name,
    org_type: o.orgType ?? null,
    admin: o.admin ?? null,
    metadata: o.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    name: row.name,
    orgType: row.org_type ?? null,
    admin: row.admin ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `organizations` table. */
export class OrganizationsRepository extends BaseRepository<
  Organization,
  OrganizationInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All organizations administered by the given address. */
  findByAdmin(admin: string): Promise<Result<readonly Organization[]>> {
    return this.find({
      filters: [{ column: "admin", op: "eq", value: admin }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All organizations of the given type (e.g. "supplier", "buyer"). */
  findByType(orgType: string): Promise<Result<readonly Organization[]>> {
    return this.find({
      filters: [{ column: "org_type", op: "eq", value: orgType }],
      orderBy: { column: "name", ascending: true },
    });
  }
}

/** Factory: build an `OrganizationsRepository` over the (possibly null) client. */
export function createOrganizationsRepository(
  client: SupabaseClient | null,
): OrganizationsRepository {
  return new OrganizationsRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
