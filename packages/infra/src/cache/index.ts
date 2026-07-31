/**
 * Cache subsystem entrypoint.
 *
 * A single in-memory TTL cache primitive. Additional cache strategies can be
 * added as sibling files and re-exported here.
 */
export { TtlCache, type TtlCacheOptions } from "./ttl.js";
