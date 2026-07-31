/**
 * `insurance` domain event decoders.
 *
 * Strictly-typed wrappers over the core {@link decodeContractEvent} for the
 * policy, claims, capital-pool, and risk-pool contracts. Each decoder targets
 * one event of one contract, returns `null` on an ABI/name miss, and throws
 * `ValidationError` only when a matched event carries an invalid payload.
 *
 * Re-exported by `../decoders/index.ts`.
 */
import { z } from "zod";

import type { ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema } from "../types/core";
import type { Bytes32 } from "../types/core";
import type {
  ClaimApprovedEvent,
  ClaimFiledEvent,
  ClaimPaidEvent,
  ClaimRejectedEvent,
  PolicyCancelledEvent,
  PolicyIssuedEvent,
  PoolCapitalDepositedEvent,
  PoolCapitalWithdrawnEvent,
  PoolPaidOutEvent,
  RiskPoolCoveredEvent,
  RiskPoolToppedUpEvent,
  UnderwrittenEvent,
} from "../types/insurance";
import { decodeContractEvent } from "./core";

const address = AddressSchema;
const bytes32 = Bytes32Schema.transform((v) => v as Bytes32);

function makeEventDecoder<N extends string, S extends z.ZodTypeAny>(
  contract: ContractName,
  eventName: N,
  schema: S,
): (log: unknown) => (z.infer<S> & { readonly eventName: N }) | null {
  return (log: unknown) => {
    const decoded = decodeContractEvent(contract, log);
    if (decoded === null || decoded.eventName !== eventName) {
      return null;
    }
    const parsed = schema.safeParse(decoded.args);
    if (!parsed.success) {
      throw new ValidationError(
        `Malformed ${eventName} event payload`,
        parsed.error.flatten(),
      );
    }
    return Object.freeze({
      eventName,
      ...(parsed.data as object),
    }) as z.infer<S> & { readonly eventName: N };
  };
}

export const decodePolicyIssued: (log: unknown) => PolicyIssuedEvent | null =
  makeEventDecoder(
    "PolicyManager",
    "PolicyIssued",
    z.object({
      policyId: bytes32,
      batchId: bytes32,
      holder: address,
      coverage: z.bigint(),
      premium: z.bigint(),
    }),
  );

export const decodePolicyCancelled: (
  log: unknown,
) => PolicyCancelledEvent | null = makeEventDecoder(
  "PolicyManager",
  "PolicyCancelled",
  z.object({ policyId: bytes32 }),
);

export const decodeClaimFiled: (log: unknown) => ClaimFiledEvent | null =
  makeEventDecoder(
    "ClaimsProcessor",
    "ClaimFiled",
    z.object({
      claimId: bytes32,
      policyId: bytes32,
      claimant: address,
      amount: z.bigint(),
    }),
  );

export const decodeClaimApproved: (log: unknown) => ClaimApprovedEvent | null =
  makeEventDecoder(
    "ClaimsProcessor",
    "ClaimApproved",
    z.object({ claimId: bytes32, arbiter: address }),
  );

export const decodeClaimRejected: (log: unknown) => ClaimRejectedEvent | null =
  makeEventDecoder(
    "ClaimsProcessor",
    "ClaimRejected",
    z.object({ claimId: bytes32, arbiter: address }),
  );

export const decodeClaimPaid: (log: unknown) => ClaimPaidEvent | null =
  makeEventDecoder(
    "ClaimsProcessor",
    "ClaimPaid",
    z.object({ claimId: bytes32, to: address, amount: z.bigint() }),
  );

export const decodeUnderwritten: (log: unknown) => UnderwrittenEvent | null =
  makeEventDecoder(
    "InsurancePool",
    "Underwritten",
    z.object({ policyId: bytes32, coverage: z.bigint() }),
  );

export const decodePoolCapitalDeposited: (
  log: unknown,
) => PoolCapitalDepositedEvent | null = makeEventDecoder(
  "InsurancePool",
  "Deposited",
  z.object({ provider: address, token: address, amount: z.bigint() }),
);

export const decodePoolCapitalWithdrawn: (
  log: unknown,
) => PoolCapitalWithdrawnEvent | null = makeEventDecoder(
  "InsurancePool",
  "Withdrawn",
  z.object({ provider: address, token: address, amount: z.bigint() }),
);

export const decodePoolPaidOut: (log: unknown) => PoolPaidOutEvent | null =
  makeEventDecoder(
    "InsurancePool",
    "PaidOut",
    z.object({ policyId: bytes32, to: address, amount: z.bigint() }),
  );

export const decodeRiskPoolToppedUp: (
  log: unknown,
) => RiskPoolToppedUpEvent | null = makeEventDecoder(
  "RiskPool",
  "ToppedUp",
  z.object({ from: address, token: address, amount: z.bigint() }),
);

export const decodeRiskPoolCovered: (
  log: unknown,
) => RiskPoolCoveredEvent | null = makeEventDecoder(
  "RiskPool",
  "Covered",
  z.object({ policyId: bytes32, to: address, amount: z.bigint() }),
);
