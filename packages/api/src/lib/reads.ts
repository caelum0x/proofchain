/**
 * Router read helpers shared by the resource routers under `src/routes/`.
 *
 * These keep every list/detail/search handler small and consistent:
 *   - `hexBatchId` / `hexAddress` — zod schemas for on-chain identifiers.
 *   - `parseOr400` — turn a failed zod parse into a typed VALIDATION_ERROR
 *     (the central error handler only special-cases Fastify's own `validation`
 *     array and `ApiError`, so a raw `ZodError` would otherwise become a 500).
 *   - `resolveContract` — look up a contract's address+ABI by name WITHOUT the
 *     narrow `ContractName` union (the API is typechecked against a 4-contract
 *     test double; production resolves the full set). Returns null when the
 *     contract is not deployed/known so callers can fall back to the DB or 404.
 *   - `readView` — call a view function via viem, wrapping failures as a typed
 *     CHAIN_ERROR so nothing leaks a raw RPC/driver message.
 *   - `jsonSafe` — deep-convert bigints to strings so Fastify can serialize
 *     on-chain reads (uint64/uint256 come back as bigint, which JSON rejects).
 */
import { z } from 'zod';
import type { Abi, Address } from 'viem';
import type { AppContext } from '../context.js';
import { chainError, errorMessage, validationError } from './errors.js';

const HEX_BATCH_ID = /^0x[0-9a-fA-F]{64}$/u;
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/u;

/** A 32-byte hex identifier (batchId, orgId, verdict/data hash). */
export const hexBatchId = z
  .string()
  .regex(HEX_BATCH_ID, 'must be a 0x-prefixed 32-byte hex string')
  .transform((v) => v.toLowerCase());

/** A 20-byte hex EVM address. */
export const hexAddress = z
  .string()
  .regex(HEX_ADDRESS, 'must be a 0x-prefixed 20-byte hex address')
  .transform((v) => v.toLowerCase());

/** True when a string is a well-formed 32-byte hex id. */
export const isHexBatchId = (v: string): boolean => HEX_BATCH_ID.test(v);
/** True when a string is a well-formed 20-byte hex address. */
export const isHexAddress = (v: string): boolean => HEX_ADDRESS.test(v);

/**
 * Parse `data` with `schema`, throwing a typed VALIDATION_ERROR (HTTP 400) on
 * failure instead of a raw ZodError. Use for `request.params` / `request.query`.
 * Generic over the schema (not its output) so schemas that transform their input
 * — e.g. `z.enum(['true','false']).transform(Boolean)` — infer correctly.
 */
export const parseOr400 = <S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): z.output<S> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw validationError('Invalid request parameters', result.error.issues);
  }
  return result.data;
};

/** A deployed contract resolved to the pieces viem needs for a read. */
export interface ResolvedContract {
  readonly address: Address;
  readonly abi: Abi;
}

/**
 * Resolve a contract's address+ABI by name. Accessed through a `string`-typed
 * view of the chain reader so routers can reference the full platform contract
 * set even though the package is typechecked against a 4-contract double.
 * Returns null when the contract has no known ABI or resolved address.
 */
export const resolveContract = (
  ctx: AppContext,
  name: string,
): ResolvedContract | null => {
  const addressOf = ctx.chain.addressOf as (n: string) => Address | undefined;
  const abiOf = ctx.chain.abiOf as (n: string) => Abi | undefined;
  const address = addressOf(name);
  const abi = abiOf(name);
  if (address === undefined || abi === undefined) return null;
  return { address, abi };
};

/** Minimal viem `readContract` surface — avoids fighting viem's overloads. */
interface ReadableClient {
  readContract(args: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}

/**
 * Call a contract view function, returning the raw viem result. Wraps any RPC
 * failure as a typed CHAIN_ERROR (never leaks the underlying provider message).
 */
export const readView = async (
  ctx: AppContext,
  contract: ResolvedContract,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<unknown> => {
  const client = ctx.chain.client as unknown as ReadableClient;
  try {
    return await client.readContract({
      address: contract.address,
      abi: contract.abi,
      functionName,
      args,
    });
  } catch (err) {
    throw chainError(`Failed to read ${functionName}`, {
      cause: errorMessage(err),
    });
  }
};

/** Deep-convert bigints to decimal strings so the value is JSON-serializable. */
export const jsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        jsonSafe(v),
      ]),
    );
  }
  return value;
};
