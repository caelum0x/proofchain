/**
 * Reputation & bonds group handler (M4) — ReputationEngine, SupplierBond,
 * StakeManager, SlashingController, ScoreOracle. Captures outcome/bond/slash
 * events to the audit table for the reputation and bonds routers.
 */
import { makeHandler } from './base.js';

export default makeHandler('reputation');
