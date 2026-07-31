/**
 * Tool barrel — the auto-collection manifest.
 *
 * Importing this module registers the four builtin tools. Fill agents add a
 * capability by creating `src/tools/<tool>.ts` (which calls `registerTool`) and
 * APPENDING one side-effect import line below. The registry itself is never
 * edited.
 */
import './core.js';
// Fill-agent capability tools (one file each, self-registering).
import './get_checkpoints.js';
import './get_attestation.js';
import './run_check.js';
import './score_dimension.js';
import './estimate_risk.js';
import './lookup_reputation.js';
import './lookup_sanctions.js';
import './get_policy.js';
import './get_receivable.js';
import './fetch_esg.js';
import './get_kyc.js';

export * from './registry.js';
