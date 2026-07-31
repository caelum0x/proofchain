/**
 * Barrel for the `@proofchain/shared` type layer.
 *
 * Re-exports the stable core types/schemas plus every per-domain module. The
 * domain modules are placeholders until the Domains phase fills them; adding a
 * new export to any of them automatically surfaces it here and from the package
 * root.
 */
export * from "./core";

// Per-domain type modules
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
