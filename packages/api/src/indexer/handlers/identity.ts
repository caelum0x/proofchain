/**
 * Identity group handler (M3) — Organization/Supplier/Buyer/Carrier/KYC
 * registries. Captures registration/membership events to the audit table for the
 * suppliers/buyers/carriers/organizations routers to project into read models.
 */
import { makeHandler } from './base.js';

export default makeHandler('identity');
