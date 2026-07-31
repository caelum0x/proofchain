/**
 * Barrel for the `@proofchain/shared` decoder layer.
 *
 * Re-exports the core viem event-log decoders plus every per-domain decoder
 * module. Domain modules are placeholders until the Domains phase fills them.
 */
export * from "./core";

// Per-domain decoder modules
export * from "./provenance";
export * from "./identity";
export * from "./reputation";
export * from "./finance";
export * from "./payments";
export * from "./insurance";
export * from "./governance";
export * from "./esg";
export * from "./marketplace";
export * from "./rewards";
export * from "./tradefinance";
export * from "./compliance";
export * from "./dpp";
export * from "./logistics";
export * from "./commodities";
export * from "./energy";
export * from "./workforce";
export * from "./data";
