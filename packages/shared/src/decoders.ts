import {
  decodeEventLog,
  parseEventLogs,
  type Abi,
  type Hex,
  type Log,
} from "viem";
import { z } from "zod";

import { ABIS, CONTRACT_NAMES, type ContractName } from "./abis/index";
import { DecodeError, ValidationError } from "./errors";
import { HexSchema } from "./types";

/** Minimal shape of an EVM log required to decode an event. */
export interface RawEventLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

/** A successfully decoded ProofChain event, tagged with its source contract. */
export interface DecodedProofchainEvent {
  readonly contract: ContractName;
  readonly eventName: string;
  readonly args: Readonly<Record<string, unknown>>;
}

/** A viem {@link Log} enriched with the decoded event name and args. */
export type ParsedContractLog = Log & {
  readonly eventName: string;
  readonly args: Record<string, unknown>;
};

const RawEventLogSchema = z.object({
  topics: z
    .array(HexSchema)
    .min(0)
    .refine((t) => t.length <= 4, "A log has at most 4 topics"),
  data: HexSchema,
});

/**
 * Validate an arbitrary object into a {@link RawEventLog}. Throws
 * {@link ValidationError} on malformed input so bad data never reaches viem.
 */
export function parseRawEventLog(input: unknown): RawEventLog {
  const result = RawEventLogSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid event log", result.error.flatten());
  }
  return {
    topics: result.data.topics as readonly Hex[],
    data: result.data.data as Hex,
  };
}

function normalizeArgs(args: unknown): Readonly<Record<string, unknown>> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return Object.freeze({ ...(args as Record<string, unknown>) });
  }
  // Unnamed args come back as an array; expose them positionally.
  if (Array.isArray(args)) {
    return Object.freeze({ ...args } as Record<string, unknown>);
  }
  return Object.freeze({});
}

/**
 * Decode a log against a single named contract ABI.
 *
 * @returns the decoded event, or `null` when the log does not match any event
 *   in that contract's ABI (non-strict). Throws {@link ValidationError} for
 *   malformed input.
 */
export function decodeContractEvent(
  contract: ContractName,
  log: unknown,
): DecodedProofchainEvent | null {
  const { topics, data } = parseRawEventLog(log);
  const abi: Abi = ABIS[contract];
  try {
    const decoded = decodeEventLog({
      abi,
      // viem's tuple typing for topics; our validation already bounds length.
      topics: topics as [signature: Hex, ...args: Hex[]] | [],
      data,
      strict: false,
    });
    return {
      contract,
      eventName: decoded.eventName as unknown as string,
      args: normalizeArgs(decoded.args),
    };
  } catch {
    // Signature not part of this ABI — a normal, expected miss.
    return null;
  }
}

/**
 * Decode a log against every ProofChain contract ABI and return the first
 * match. Throws {@link DecodeError} when no ABI recognizes the log.
 */
export function decodeProofchainLog(log: unknown): DecodedProofchainEvent {
  const raw = parseRawEventLog(log);
  for (const contract of CONTRACT_NAMES) {
    const decoded = decodeContractEvent(contract, raw);
    if (decoded !== null) return decoded;
  }
  throw new DecodeError("No ProofChain ABI matched the provided log", {
    details: { topic0: raw.topics[0] ?? null },
  });
}

/**
 * Non-throwing variant of {@link decodeProofchainLog}. Returns `null` when the
 * log matches no known event (still throws {@link ValidationError} on
 * structurally invalid input, since that is a caller bug).
 */
export function tryDecodeProofchainLog(
  log: unknown,
): DecodedProofchainEvent | null {
  const raw = parseRawEventLog(log);
  for (const contract of CONTRACT_NAMES) {
    const decoded = decodeContractEvent(contract, raw);
    if (decoded !== null) return decoded;
  }
  return null;
}

/**
 * Batch-decode logs for a single contract using viem's `parseEventLogs`. Logs
 * whose event is not in the ABI are filtered out (non-strict). Retains block
 * metadata from the input logs.
 */
export function parseContractLogs(
  contract: ContractName,
  logs: readonly Log[],
): readonly ParsedContractLog[] {
  if (!Array.isArray(logs)) {
    throw new ValidationError("Expected an array of logs", { received: typeof logs });
  }
  const parsed = parseEventLogs({
    abi: ABIS[contract],
    logs: logs as Log[],
    strict: false,
  });
  return parsed as unknown as readonly ParsedContractLog[];
}
