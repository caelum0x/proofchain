/**
 * `identity` domain types.
 *
 * The on-chain struct mirrors and enums for this domain (`Organization`,
 * `OrgType`, `ActorProfile`/`Supplier|Buyer|CarrierProfile`, `KycStatus`,
 * `KycLevel`, `Identity`, `ActorRole`) live in `./core` and are re-exported from
 * the package root. This module adds:
 *
 *  - **Decoded-event payload types** — the typed shape each key identity event
 *    normalizes to (produced by `../decoders/identity`).
 *  - **Request / read-model DTOs** — request bodies and aggregate identity views
 *    the `api`/`web` packages exchange, plus zod schemas that validate them.
 *
 * Every field is `readonly`; `bigint` mirrors uint256/uint64 and `number` mirrors
 * uint8. Branded `Address` / `Bytes32` come from `./core`.
 *
 * Re-exported by `../types/index.ts`.
 */
import { z } from "zod";

import {
  AddressSchema,
  Bytes32Schema,
  KycLevel,
  OrgType,
  type ActorProfile,
  type Address,
  type Bytes32,
  type Identity,
  type KycStatus,
  type Organization,
} from "./core";

// ---------------------------------------------------------------------------
// Local branded arg schemas
// ---------------------------------------------------------------------------

const bytes32 = Bytes32Schema as unknown as z.ZodType<Bytes32>;
const address = AddressSchema as unknown as z.ZodType<Address>;

// ---------------------------------------------------------------------------
// Decoded event payloads
// ---------------------------------------------------------------------------

/** `OrganizationRegistry.OrgRegistered`. */
export interface OrgRegisteredArgs {
  readonly orgId: Bytes32;
  readonly name: string;
  readonly orgType: OrgType;
  readonly admin: Address;
}

/** `OrganizationRegistry.MemberAdded` / `MemberRemoved` (identical shape). */
export interface OrgMembershipArgs {
  readonly orgId: Bytes32;
  readonly member: Address;
}

/**
 * `SupplierRegistry.SupplierRegistered|Updated`,
 * `BuyerRegistry.BuyerRegistered|Updated`,
 * `CarrierRegistry.CarrierRegistered|Updated` — all share this shape.
 */
export interface ActorProfileEventArgs {
  readonly account: Address;
  readonly name: string;
  readonly uri: string;
}

/** `KYCRegistry.KycSet`. */
export interface KycSetArgs {
  readonly account: Address;
  readonly level: KycLevel;
  readonly provider: Address;
}

/** `KYCRegistry.KycRevoked`. */
export interface KycRevokedArgs {
  readonly account: Address;
  readonly provider: Address;
}

/**
 * Discriminated union of every decoded identity event, tagged by its source
 * contract and event name. Returned by `decodeIdentityEvent`.
 */
export type IdentityEvent =
  | { readonly contract: "OrganizationRegistry"; readonly eventName: "OrgRegistered"; readonly args: OrgRegisteredArgs }
  | { readonly contract: "OrganizationRegistry"; readonly eventName: "MemberAdded"; readonly args: OrgMembershipArgs }
  | { readonly contract: "OrganizationRegistry"; readonly eventName: "MemberRemoved"; readonly args: OrgMembershipArgs }
  | { readonly contract: "SupplierRegistry"; readonly eventName: "SupplierRegistered"; readonly args: ActorProfileEventArgs }
  | { readonly contract: "SupplierRegistry"; readonly eventName: "SupplierUpdated"; readonly args: ActorProfileEventArgs }
  | { readonly contract: "BuyerRegistry"; readonly eventName: "BuyerRegistered"; readonly args: ActorProfileEventArgs }
  | { readonly contract: "BuyerRegistry"; readonly eventName: "BuyerUpdated"; readonly args: ActorProfileEventArgs }
  | { readonly contract: "CarrierRegistry"; readonly eventName: "CarrierRegistered"; readonly args: ActorProfileEventArgs }
  | { readonly contract: "CarrierRegistry"; readonly eventName: "CarrierUpdated"; readonly args: ActorProfileEventArgs }
  | { readonly contract: "KYCRegistry"; readonly eventName: "KycSet"; readonly args: KycSetArgs }
  | { readonly contract: "KYCRegistry"; readonly eventName: "KycRevoked"; readonly args: KycRevokedArgs };

/** All identity event names, useful for indexer topic filtering. */
export const IDENTITY_EVENT_NAMES = [
  "OrgRegistered",
  "MemberAdded",
  "MemberRemoved",
  "SupplierRegistered",
  "SupplierUpdated",
  "BuyerRegistered",
  "BuyerUpdated",
  "CarrierRegistered",
  "CarrierUpdated",
  "KycSet",
  "KycRevoked",
] as const;

export type IdentityEventName = (typeof IDENTITY_EVENT_NAMES)[number];

// ---------------------------------------------------------------------------
// Request DTOs (api/web → chain writes)
// ---------------------------------------------------------------------------

/** Body for `OrganizationRegistry.registerOrg`. */
export interface RegisterOrgRequest {
  readonly orgId: Bytes32;
  readonly name: string;
  readonly orgType: OrgType;
  readonly metadataURI: string;
}

export const RegisterOrgRequestSchema: z.ZodType<RegisterOrgRequest> = z.object({
  orgId: bytes32,
  name: z.string().min(1, "name must not be empty"),
  orgType: z.nativeEnum(OrgType),
  metadataURI: z.string(),
});

/** Body for `OrganizationRegistry.addMember` / `removeMember`. */
export interface OrgMemberRequest {
  readonly orgId: Bytes32;
  readonly member: Address;
}

export const OrgMemberRequestSchema: z.ZodType<OrgMemberRequest> = z.object({
  orgId: bytes32,
  member: address,
});

/**
 * Body for the self-service `register*` / `update*` calls on the
 * Supplier/Buyer/Carrier registries (all share this shape).
 */
export interface ActorProfileRequest {
  readonly name: string;
  readonly uri: string;
}

export const ActorProfileRequestSchema: z.ZodType<ActorProfileRequest> = z.object({
  name: z.string().min(1, "name must not be empty"),
  uri: z.string(),
});

/** Body for `KYCRegistry.setKyc`. */
export interface SetKycRequest {
  readonly account: Address;
  readonly level: KycLevel;
}

export const SetKycRequestSchema: z.ZodType<SetKycRequest> = z.object({
  account: address,
  level: z.nativeEnum(KycLevel),
});

// ---------------------------------------------------------------------------
// Read-model DTOs (aggregate identity views for api/web)
// ---------------------------------------------------------------------------

/**
 * Unified identity summary for an address: the resolver's best-known
 * role/org/name plus KYC status and (when available) the full organization.
 */
export interface IdentitySummary {
  readonly account: Address;
  readonly identity: Identity;
  readonly kyc: KycStatus;
  readonly organization: Organization | null;
}

/** A typed actor profile tagged with the registry it was read from. */
export interface ActorProfileView {
  readonly registry: "SupplierRegistry" | "BuyerRegistry" | "CarrierRegistry";
  readonly profile: ActorProfile;
}
