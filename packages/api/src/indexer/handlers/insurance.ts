/**
 * Insurance group handler (M6) — InsurancePool, PolicyManager, ClaimsProcessor,
 * PremiumCalculator, RiskPool. Captures policy/claim events to the audit table
 * for the insurance and claims routers.
 */
import { makeHandler } from './base.js';

export default makeHandler('insurance');
