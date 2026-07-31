/**
 * Cross-check barrel — the auto-collection manifest.
 *
 * Importing this module registers the builtin checks. Fill agents add a domain
 * rule pack by creating `src/checks/<domain>.ts` (which calls `registerCheck`)
 * and APPENDING one side-effect import line below. The registry itself is never
 * edited.
 */
import './core.js';
// Domain rule packs (each registers its CrossChecks as a side effect).
import './trade.js';
import './customs.js';
import './quality.js';
import './cold_chain.js';
import './sanctions.js';
import './quantity_price.js';
import './dpp_completeness.js';
import './origin.js';
import './weight.js';
import './dates.js';
import './parties.js';
import './financing_eligibility.js';

export * from './registry.js';
