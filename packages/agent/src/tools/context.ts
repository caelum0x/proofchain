/**
 * Shared, side-effect-free view helpers for the tool-calling loop. Both the
 * orchestrator (to seed the opening message) and the builtin tools (to answer
 * get_provenance / parse_document) render provenance + documents through these,
 * so the model always sees one consistent shape.
 */
import type { ParsedDocument, ProvenanceData } from '../domain/types.js';

export const provenanceSummary = (p: ProvenanceData): unknown => ({
  batchId: p.batchId,
  exists: p.exists,
  supplier: p.supplier,
  originHash: p.originHash,
  metadataURI: p.metadataURI,
  createdAt: p.createdAt,
  checkpointCount: p.checkpoints.length,
  checkpoints: p.checkpoints,
});

export const documentDigest = (docs: readonly ParsedDocument[]): unknown =>
  docs.map((d) => ({ index: d.index, name: d.name, docType: d.docType }));
