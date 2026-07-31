/**
 * `payments` domain event decoders.
 *
 * Strictly-typed wrappers over the core {@link decodeContractEvent} for the
 * settlement, routing, fee, and treasury contracts. Each decoder targets one
 * event of one contract, returns `null` on an ABI/name miss, and throws
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
  ArbiterReleasedEvent,
  EscrowCreatedEvent,
  EscrowDisputedEvent,
  EscrowFundedEvent,
  EscrowRefundedEvent,
  EscrowReleasedEvent,
  FeeBpsSetEvent,
  FeeCollectedEvent,
  FullySettledEvent,
  PassThresholdUpdatedEvent,
  PayeeSetEvent,
  PaymentRoutedEvent,
  TokenAddedEvent,
  TokenRemovedEvent,
  TreasuryDepositEvent,
  TreasuryWithdrawEvent,
} from "../types/payments";
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

export const decodeEscrowFunded: (log: unknown) => EscrowFundedEvent | null =
  makeEventDecoder(
    "SettlementEscrow",
    "Funded",
    z.object({
      batchId: bytes32,
      buyer: address,
      supplier: address,
      token: address,
      amount: z.bigint(),
    }),
  );

export const decodeEscrowReleased: (
  log: unknown,
) => EscrowReleasedEvent | null = makeEventDecoder(
  "SettlementEscrow",
  "Released",
  z.object({ batchId: bytes32, supplier: address, amount: z.bigint() }),
);

export const decodeEscrowRefunded: (
  log: unknown,
) => EscrowRefundedEvent | null = makeEventDecoder(
  "SettlementEscrow",
  "Refunded",
  z.object({ batchId: bytes32, buyer: address, amount: z.bigint() }),
);

export const decodeEscrowDisputed: (
  log: unknown,
) => EscrowDisputedEvent | null = makeEventDecoder(
  "SettlementEscrow",
  "Disputed",
  z.object({ batchId: bytes32, score: z.number() }),
);

export const decodePayeeSet: (log: unknown) => PayeeSetEvent | null =
  makeEventDecoder(
    "SettlementEscrow",
    "PayeeSet",
    z.object({ batchId: bytes32, payee: address }),
  );

export const decodeArbiterReleased: (
  log: unknown,
) => ArbiterReleasedEvent | null = makeEventDecoder(
  "SettlementEscrow",
  "ArbiterReleased",
  z.object({ batchId: bytes32, payee: address, amount: z.bigint() }),
);

export const decodePassThresholdUpdated: (
  log: unknown,
) => PassThresholdUpdatedEvent | null = makeEventDecoder(
  "SettlementEscrow",
  "PassThresholdUpdated",
  z.object({ oldT: z.number(), newT: z.number() }),
);

export const decodeFullySettled: (log: unknown) => FullySettledEvent | null =
  makeEventDecoder(
    "SettlementRouter",
    "FullySettled",
    z.object({ batchId: bytes32, released: z.boolean(), score: z.number() }),
  );

export const decodeEscrowCreated: (log: unknown) => EscrowCreatedEvent | null =
  makeEventDecoder(
    "EscrowFactory",
    "EscrowCreated",
    z.object({ salt: bytes32, escrow: address, admin: address }),
  );

export const decodePaymentRouted: (log: unknown) => PaymentRoutedEvent | null =
  makeEventDecoder(
    "PaymentRouter",
    "Routed",
    z.object({
      action: bytes32,
      token: address,
      payer: address,
      destination: address,
      amount: z.bigint(),
      fee: z.bigint(),
    }),
  );

export const decodeTokenAdded: (log: unknown) => TokenAddedEvent | null =
  makeEventDecoder(
    "StablecoinRegistry",
    "TokenAdded",
    z.object({ token: address, decimals: z.number() }),
  );

export const decodeTokenRemoved: (log: unknown) => TokenRemovedEvent | null =
  makeEventDecoder(
    "StablecoinRegistry",
    "TokenRemoved",
    z.object({ token: address }),
  );

export const decodeFeeBpsSet: (log: unknown) => FeeBpsSetEvent | null =
  makeEventDecoder(
    "FeeManager",
    "FeeBpsSet",
    z.object({ action: bytes32, bps: z.number() }),
  );

export const decodeFeeCollected: (log: unknown) => FeeCollectedEvent | null =
  makeEventDecoder(
    "FeeManager",
    "FeeCollected",
    z.object({
      action: bytes32,
      token: address,
      payer: address,
      amount: z.bigint(),
    }),
  );

export const decodeTreasuryDeposit: (
  log: unknown,
) => TreasuryDepositEvent | null = makeEventDecoder(
  "Treasury",
  "Deposit",
  z.object({ from: address, token: address, amount: z.bigint() }),
);

export const decodeTreasuryWithdraw: (
  log: unknown,
) => TreasuryWithdrawEvent | null = makeEventDecoder(
  "Treasury",
  "Withdraw",
  z.object({ to: address, token: address, amount: z.bigint() }),
);
