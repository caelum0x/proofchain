/**
 * Auctions repository — typed data access for the `auctions` marketplace table
 * (M9 English auctions). See `deals.ts` for the fill convention; never
 * hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Auction lifecycle states (mirrors the schema CHECK constraint). */
export const AuctionStatus = z.enum(["active", "settled", "cancelled"]);
export type AuctionStatus = z.infer<typeof AuctionStatus>;

/** Fields accepted when creating/upserting an auction. */
export const AuctionInput = z.object({
  id: z.string().min(1),
  asset: z.string().nullable().optional(),
  tokenId: Uint256String.nullable().optional(),
  seller: AddressHex.nullable().optional(),
  highestBid: Uint256String.optional(),
  highestBidder: AddressHex.nullable().optional(),
  endTime: z.string().nullable().optional(),
  status: AuctionStatus.optional(),
});
export type AuctionInput = z.infer<typeof AuctionInput>;

/** An auction row as stored/returned. */
export const Auction = z.object({
  id: z.string(),
  asset: z.string().nullable(),
  tokenId: Uint256String.nullable(),
  seller: AddressHex.nullable(),
  highestBid: Uint256String,
  highestBidder: AddressHex.nullable(),
  endTime: z.string().nullable(),
  status: AuctionStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Auction = z.infer<typeof Auction>;

const config: RepositoryConfig<Auction, AuctionInput> = {
  table: "auctions",
  primaryKey: "id",
  entitySchema: Auction,
  insertSchema: AuctionInput,
  toRow: (a) => ({
    id: a.id,
    asset: a.asset ?? null,
    token_id: a.tokenId ?? null,
    seller: a.seller ?? null,
    highest_bid: a.highestBid ?? "0",
    highest_bidder: a.highestBidder ?? null,
    end_time: a.endTime ?? null,
    status: a.status ?? "active",
  }),
  fromRow: (row) => ({
    id: row.id,
    asset: row.asset ?? null,
    tokenId: toAmountOrNull(row.token_id),
    seller: row.seller ?? null,
    highestBid: toAmount(row.highest_bid),
    highestBidder: row.highest_bidder ?? null,
    endTime: normalizeTimestampOrNull(row.end_time),
    status: row.status,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `auctions` table. */
export class AuctionsRepository extends BaseRepository<Auction, AuctionInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All auctions in the given status (e.g. live "active"), newest first. */
  findByStatus(status: AuctionStatus): Promise<Result<readonly Auction[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All auctions listed by the given seller. */
  findBySeller(seller: string): Promise<Result<readonly Auction[]>> {
    return this.find({ filters: [{ column: "seller", op: "eq", value: seller }] });
  }
}

/** Factory: build an `AuctionsRepository` over the (possibly null) client. */
export function createAuctionsRepository(
  client: SupabaseClient | null,
): AuctionsRepository {
  return new AuctionsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function toAmountOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeTimestampOrNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return normalizeTimestamp(value);
}
