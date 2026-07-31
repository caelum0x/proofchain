/**
 * Internal domain types for the verification pipeline. These are distinct from
 * the on-chain-facing types in `@proofchain/shared` (which describe the verdict
 * envelope). Kept small and immutable.
 */
import type { Finding } from '../shared.js';

export type Hex = `0x${string}`;

/** A single line item extracted from an invoice. */
export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** Structured fields extracted from one supplied document. */
export interface ParsedDocumentFields {
  total?: number;
  currency?: string;
  lineItems?: LineItem[];
  quantity?: number;
  supplierName?: string;
  buyerName?: string;
  originHash?: string;
  /** ISO date string, if present. */
  date?: string;
  parties?: string[];
}

/**
 * The document types the base engine ships with. Fill agents add more by
 * registering a parser (see src/parsers/registry.ts) — the registry, not this
 * union, is the runtime source of truth for known types.
 */
export type KnownDocumentType = 'invoice' | 'bill_of_lading' | 'unknown';

/**
 * A document type id. Extensible: known literals keep editor autocomplete while
 * `(string & {})` admits any type a registered parser declares.
 */
export type DocumentType = KnownDocumentType | (string & {});

/** A supplied document after parsing. */
export interface ParsedDocument {
  index: number;
  name: string;
  docType: DocumentType;
  fields: ParsedDocumentFields;
  /** sha256 (hex, no 0x prefix) of the raw document bytes. */
  sha256: string;
}

/** On-chain provenance snapshot for a batch. */
export interface Checkpoint {
  location: string;
  timestamp: number; // unix seconds
  dataHash: Hex;
}

export interface ProvenanceData {
  batchId: Hex;
  exists: boolean;
  supplier: Hex;
  originHash: Hex;
  metadataURI: string;
  createdAt: number; // unix seconds
  checkpoints: Checkpoint[];
}

/** On-chain attestation snapshot. */
export interface OnchainAttestation {
  batchId: Hex;
  score: number;
  verdictHash: Hex;
  verdictURI: string;
  attestedAt: number;
  agent: Hex;
  exists: boolean;
}

/** Input document as received on the API. */
export interface InputDocument {
  name: string;
  mimeType: string;
  dataBase64?: string;
  url?: string;
}

/** Input to the cross-check rule engine. */
export interface CrossCheckInput {
  provenance: ProvenanceData;
  documents: ParsedDocument[];
}

/** Result of reconciling model score with the deterministic rule score. */
export interface ScoreReconciliation {
  finalScore: number;
  ruleScore: number;
  modelScore: number;
  /** Which side won (the stricter/lower one). */
  source: 'model' | 'rules';
  passed: boolean;
  threshold: number;
}

/** Output of the Claude tool-calling loop. */
export interface OrchestratorResult {
  modelScore: number;
  summary: string;
  findings: Finding[];
  iterations: number;
  toolCalls: number;
}
