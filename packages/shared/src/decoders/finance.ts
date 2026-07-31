/**
 * `finance` domain event decoders.
 *
 * Thin, strictly-typed wrappers over the core {@link decodeContractEvent} that
 * decode a raw log against a specific finance contract ABI, assert the expected
 * event name, and validate/normalize the args into the immutable payload types
 * from `../types/finance`. Each returns `null` when the log is a different event
 * of that contract (or does not match its ABI), and throws `ValidationError`
 * only when a matched event carries a structurally invalid payload.
 *
 * Re-exported by `../decoders/index.ts`.
 */
import { z } from "zod";

import type { ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema } from "../types/core";
import type { Bytes32 } from "../types/core";
import type {
  InvoiceCancelledEvent,
  InvoiceClaimedEvent,
  InvoiceFundedEvent,
  InvoiceListedEvent,
  MaxGradeUpdatedEvent,
  PoolAllocatedEvent,
  PoolDepositedEvent,
  PoolReconciledEvent,
  PoolWithdrawnEvent,
  ReceivableMintedEvent,
  ReceivableRegisteredEvent,
  RepaidEvent,
  YieldDistributedEvent,
} from "../types/finance";
import { decodeContractEvent } from "./core";

// Local zod leaves whose *output* types are the branded primitives. `AddressSchema`
// already transforms to the branded `Address`; `Bytes32Schema` needs the cast.
const address = AddressSchema;
const bytes32 = Bytes32Schema.transform((v) => v as Bytes32);

/**
 * Build a decoder for one named event of one contract. On an ABI/name miss it
 * returns `null`; on a matched-but-malformed payload it throws.
 */
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

export const decodeReceivableRegistered: (
  log: unknown,
) => ReceivableRegisteredEvent | null = makeEventDecoder(
  "ReceivableRegistry",
  "ReceivableRegistered",
  z.object({
    batchId: bytes32,
    faceValue: z.bigint(),
    dueDate: z.bigint(),
    obligor: address,
    token: address,
  }),
);

export const decodeReceivableMinted: (
  log: unknown,
) => ReceivableMintedEvent | null = makeEventDecoder(
  "InvoiceNFT",
  "ReceivableMinted",
  z.object({ batchId: bytes32, tokenId: z.bigint(), to: address }),
);

export const decodeInvoiceListed: (log: unknown) => InvoiceListedEvent | null =
  makeEventDecoder(
    "InvoiceFinancing",
    "Listed",
    z.object({
      batchId: bytes32,
      supplier: address,
      token: address,
      askAmount: z.bigint(),
    }),
  );

export const decodeInvoiceFunded: (log: unknown) => InvoiceFundedEvent | null =
  makeEventDecoder(
    "InvoiceFinancing",
    "Funded",
    z.object({ batchId: bytes32, lender: address, amount: z.bigint() }),
  );

export const decodeInvoiceClaimed: (
  log: unknown,
) => InvoiceClaimedEvent | null = makeEventDecoder(
  "InvoiceFinancing",
  "Claimed",
  z.object({
    batchId: bytes32,
    lender: address,
    principal: z.bigint(),
    remainderToSupplier: z.bigint(),
  }),
);

export const decodeInvoiceCancelled: (
  log: unknown,
) => InvoiceCancelledEvent | null = makeEventDecoder(
  "InvoiceFinancing",
  "Cancelled",
  z.object({ batchId: bytes32 }),
);

export const decodePoolDeposited: (log: unknown) => PoolDepositedEvent | null =
  makeEventDecoder(
    "FinancingPool",
    "Deposited",
    z.object({ lender: address, assets: z.bigint(), shares: z.bigint() }),
  );

export const decodePoolWithdrawn: (log: unknown) => PoolWithdrawnEvent | null =
  makeEventDecoder(
    "FinancingPool",
    "Withdrawn",
    z.object({ lender: address, assets: z.bigint(), shares: z.bigint() }),
  );

export const decodePoolAllocated: (log: unknown) => PoolAllocatedEvent | null =
  makeEventDecoder(
    "FinancingPool",
    "Allocated",
    z.object({ batchId: bytes32, amount: z.bigint() }),
  );

export const decodePoolReconciled: (
  log: unknown,
) => PoolReconciledEvent | null = makeEventDecoder(
  "FinancingPool",
  "Reconciled",
  z.object({ batchId: bytes32, principal: z.bigint(), returned: z.bigint() }),
);

export const decodeMaxGradeUpdated: (
  log: unknown,
) => MaxGradeUpdatedEvent | null = makeEventDecoder(
  "FinancingPool",
  "MaxGradeUpdated",
  z.object({ maxGrade: z.number() }),
);

export const decodeRepaid: (log: unknown) => RepaidEvent | null =
  makeEventDecoder(
    "RepaymentController",
    "Repaid",
    z.object({
      batchId: bytes32,
      lender: address,
      principalPlusFee: z.bigint(),
      remainder: z.bigint(),
    }),
  );

export const decodeYieldDistributed: (
  log: unknown,
) => YieldDistributedEvent | null = makeEventDecoder(
  "YieldDistributor",
  "YieldDistributed",
  z.object({ poolId: bytes32, token: address, amount: z.bigint() }),
);
