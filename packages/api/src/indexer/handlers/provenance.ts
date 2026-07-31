/**
 * Provenance group handler (M1) — ProvenanceRegistry, CheckpointOracle,
 * ProvenanceFactory, BatchMetadataStore. Captures batch/checkpoint events to the
 * audit table; read-model projection is layered on by the provenance router.
 */
import { makeHandler } from './base.js';

export default makeHandler('provenance');
