/**
 * `identity` domain event decoders.
 *
 * Decode raw EVM logs from the organization / supplier / buyer / carrier / KYC
 * registries against their exact ABIs, then validate and normalize the viem args
 * into the branded payload types from `../types/identity`. The `orgType` and
 * `level` fields are narrowed to their respective numeric enums (`OrgType`,
 * `KycLevel`); addresses/bytes32 keep their branded string literal types.
 *
 * Convention (mirrors `./core`): return `null` when the log is not the expected
 * event; throw `ValidationError` when the event matches but its args are
 * malformed (including an out-of-range enum value). Re-exported by `./index.ts`.
 */
import { z } from "zod";

import { AddressSchema, Bytes32Schema, KycLevel, OrgType } from "../types";
import type {
  ActorProfileEventArgs,
  IdentityEvent,
  KycRevokedArgs,
  KycSetArgs,
  OrgMembershipArgs,
  OrgRegisteredArgs,
} from "../types/identity";
import { ValidationError } from "../errors";
import { decodeContractEvent, parseRawEventLog } from "./core";

// ---------------------------------------------------------------------------
// Reusable arg-field schemas
// ---------------------------------------------------------------------------

const bytes32 = Bytes32Schema.transform((v) => v as `0x${string}`);
const address = AddressSchema;
const orgTypeArg = z
  .union([z.bigint(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.nativeEnum(OrgType));
const kycLevelArg = z
  .union([z.bigint(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.nativeEnum(KycLevel));

function parseArgs<S extends z.ZodTypeAny>(
  schema: S,
  args: Readonly<Record<string, unknown>>,
): z.infer<S> {
  const result = schema.safeParse(args);
  if (!result.success) {
    throw new ValidationError(
      "Malformed identity event args",
      result.error.flatten(),
    );
  }
  return Object.freeze(result.data);
}

// ---------------------------------------------------------------------------
// Per-event zod schemas
// ---------------------------------------------------------------------------

const orgRegisteredSchema = z.object({
  orgId: bytes32,
  name: z.string(),
  orgType: orgTypeArg,
  admin: address,
});

const orgMembershipSchema = z.object({
  orgId: bytes32,
  member: address,
});

const actorProfileSchema = z.object({
  account: address,
  name: z.string(),
  uri: z.string(),
});

const kycSetSchema = z.object({
  account: address,
  level: kycLevelArg,
  provider: address,
});

const kycRevokedSchema = z.object({
  account: address,
  provider: address,
});

// ---------------------------------------------------------------------------
// Single-event decoders
// ---------------------------------------------------------------------------

/** Decode an `OrganizationRegistry.OrgRegistered` log, or `null`. */
export function decodeOrgRegistered(log: unknown): OrgRegisteredArgs | null {
  const ev = decodeContractEvent("OrganizationRegistry", log);
  if (ev === null || ev.eventName !== "OrgRegistered") return null;
  return parseArgs(orgRegisteredSchema, ev.args);
}

/**
 * Decode an `OrganizationRegistry.MemberAdded` or `MemberRemoved` log (both
 * share a shape), or `null`. Inspect the emitting event name separately if you
 * need to distinguish add from remove.
 */
export function decodeOrgMembership(log: unknown): OrgMembershipArgs | null {
  const ev = decodeContractEvent("OrganizationRegistry", log);
  if (
    ev === null ||
    (ev.eventName !== "MemberAdded" && ev.eventName !== "MemberRemoved")
  ) {
    return null;
  }
  return parseArgs(orgMembershipSchema, ev.args);
}

/**
 * Decode a supplier/buyer/carrier `*Registered` or `*Updated` profile log from
 * the given registry, or `null`.
 */
export function decodeActorProfileEvent(
  registry: "SupplierRegistry" | "BuyerRegistry" | "CarrierRegistry",
  log: unknown,
): ActorProfileEventArgs | null {
  const ev = decodeContractEvent(registry, log);
  if (ev === null) return null;
  const known: Record<typeof registry, readonly string[]> = {
    SupplierRegistry: ["SupplierRegistered", "SupplierUpdated"],
    BuyerRegistry: ["BuyerRegistered", "BuyerUpdated"],
    CarrierRegistry: ["CarrierRegistered", "CarrierUpdated"],
  };
  if (!known[registry].includes(ev.eventName)) return null;
  return parseArgs(actorProfileSchema, ev.args);
}

/** Decode a `KYCRegistry.KycSet` log, or `null`. */
export function decodeKycSet(log: unknown): KycSetArgs | null {
  const ev = decodeContractEvent("KYCRegistry", log);
  if (ev === null || ev.eventName !== "KycSet") return null;
  return parseArgs(kycSetSchema, ev.args);
}

/** Decode a `KYCRegistry.KycRevoked` log, or `null`. */
export function decodeKycRevoked(log: unknown): KycRevokedArgs | null {
  const ev = decodeContractEvent("KYCRegistry", log);
  if (ev === null || ev.eventName !== "KycRevoked") return null;
  return parseArgs(kycRevokedSchema, ev.args);
}

// ---------------------------------------------------------------------------
// Aggregate decoder
// ---------------------------------------------------------------------------

/**
 * Decode a log into the tagged {@link IdentityEvent} union, trying every
 * identity contract in turn. Returns `null` when the log is not a recognized
 * identity event. Throws `ValidationError` on structurally invalid input.
 */
export function decodeIdentityEvent(log: unknown): IdentityEvent | null {
  const raw = parseRawEventLog(log);

  const org = decodeContractEvent("OrganizationRegistry", raw);
  if (org !== null) {
    if (org.eventName === "OrgRegistered") {
      return { contract: "OrganizationRegistry", eventName: "OrgRegistered", args: parseArgs(orgRegisteredSchema, org.args) };
    }
    if (org.eventName === "MemberAdded") {
      return { contract: "OrganizationRegistry", eventName: "MemberAdded", args: parseArgs(orgMembershipSchema, org.args) };
    }
    if (org.eventName === "MemberRemoved") {
      return { contract: "OrganizationRegistry", eventName: "MemberRemoved", args: parseArgs(orgMembershipSchema, org.args) };
    }
  }

  const sup = decodeContractEvent("SupplierRegistry", raw);
  if (sup !== null) {
    if (sup.eventName === "SupplierRegistered") {
      return { contract: "SupplierRegistry", eventName: "SupplierRegistered", args: parseArgs(actorProfileSchema, sup.args) };
    }
    if (sup.eventName === "SupplierUpdated") {
      return { contract: "SupplierRegistry", eventName: "SupplierUpdated", args: parseArgs(actorProfileSchema, sup.args) };
    }
  }

  const buy = decodeContractEvent("BuyerRegistry", raw);
  if (buy !== null) {
    if (buy.eventName === "BuyerRegistered") {
      return { contract: "BuyerRegistry", eventName: "BuyerRegistered", args: parseArgs(actorProfileSchema, buy.args) };
    }
    if (buy.eventName === "BuyerUpdated") {
      return { contract: "BuyerRegistry", eventName: "BuyerUpdated", args: parseArgs(actorProfileSchema, buy.args) };
    }
  }

  const car = decodeContractEvent("CarrierRegistry", raw);
  if (car !== null) {
    if (car.eventName === "CarrierRegistered") {
      return { contract: "CarrierRegistry", eventName: "CarrierRegistered", args: parseArgs(actorProfileSchema, car.args) };
    }
    if (car.eventName === "CarrierUpdated") {
      return { contract: "CarrierRegistry", eventName: "CarrierUpdated", args: parseArgs(actorProfileSchema, car.args) };
    }
  }

  const kyc = decodeContractEvent("KYCRegistry", raw);
  if (kyc !== null) {
    if (kyc.eventName === "KycSet") {
      return { contract: "KYCRegistry", eventName: "KycSet", args: parseArgs(kycSetSchema, kyc.args) };
    }
    if (kyc.eventName === "KycRevoked") {
      return { contract: "KYCRegistry", eventName: "KycRevoked", args: parseArgs(kycRevokedSchema, kyc.args) };
    }
  }

  return null;
}
