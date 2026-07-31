/**
 * Risk barrel — the auto-collection manifest.
 *
 * Importing this module registers the builtin fraud model. Fill agents add a
 * risk lens by creating `src/risk/<model>.ts` (which calls `registerRiskModel`)
 * and APPENDING one side-effect import line below. The registry itself is never
 * edited.
 */
import './fraud.js';

export * from './registry.js';
