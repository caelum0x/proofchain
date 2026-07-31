/**
 * Hashing helpers. sha256 for document integrity; keccak256 (via viem) for the
 * on-chain verdict hash so it matches Solidity's bytes32 expectations.
 */
import { createHash } from 'node:crypto';
import { keccak256, stringToBytes } from 'viem';
import type { Hex } from '../domain/types.js';

/** Lowercase hex sha256 (no 0x prefix) of raw bytes. */
export const sha256Hex = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/** keccak256 of a canonical string, as a 0x-prefixed bytes32. */
export const keccakOfString = (value: string): Hex => keccak256(stringToBytes(value));
