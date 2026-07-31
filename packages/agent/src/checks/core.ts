/**
 * Registers the builtin (core) cross-checks into the check registry. These are
 * the deterministic trade/provenance rules that ship with the engine; Fill
 * agents add domain rule packs alongside them in sibling files.
 */
import { CORE_CHECKS } from '../domain/crosscheck.js';
import { registerChecks } from './registry.js';

registerChecks(CORE_CHECKS);
