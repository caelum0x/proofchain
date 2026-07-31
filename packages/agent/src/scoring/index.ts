/**
 * Scoring barrel — the auto-collection manifest.
 *
 * Importing this module registers the builtin `model` + `rules` scorers. Fill
 * agents add a dimension by creating `src/scoring/<dimension>.ts` (which calls
 * `registerScorer`) and APPENDING one side-effect import line below. The
 * registry itself is never edited.
 */
import './core.js';

export * from './registry.js';
