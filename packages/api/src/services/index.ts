/**
 * Service-layer barrel.
 *
 * Re-exports the service convention (`base.ts`) and every domain service so
 * routes/exports/reports can import from one place. This is a plain barrel, NOT
 * a runtime registry: services are stateless factories consumed directly by the
 * route that needs them, so a route may equally import
 * `../services/<domain>.js` directly.
 *
 * Fill-agent convention: ADD `src/services/<domain>.ts` (see `base.ts`), then
 * append ONE re-export line below. Adding a service never requires editing any
 * other file.
 */
export * from './base.js';
export * from './support/resourceService.js';
export * from './filters.js';
export * from './admin.js';
export * from './aml.js';
export * from './analytics.js';
export * from './auctions.js';
export * from './auth.js';
export * from './bills-of-exchange.js';
export * from './bonds.js';
export * from './carbon.js';
export * from './certificates-origin.js';
export * from './claims.js';
export * from './credit-lines.js';
export * from './customs.js';
export * from './disputes.js';
export * from './dpp-compliance.js';
export * from './dpp-lifecycle.js';
export * from './duties.js';
export * from './dynamic-discounting.js';
export * from './esg.js';
export * from './export-licenses.js';
export * from './exports.js';
export * from './factoring.js';
export * from './feeds.js';
export * from './financing.js';
export * from './governance.js';
export * from './guarantees.js';
export * from './halal.js';
export * from './insurance.js';
export * from './invoices.js';
export * from './letters-of-credit.js';
export * from './marketplace.js';
export * from './materials.js';
export * from './notifications.js';
export * from './passports.js';
export * from './phytosanitary.js';
export * from './po-financing.js';
export * from './pools.js';
export * from './recalls.js';
export * from './recycling.js';
export * from './repairability.js';
export * from './reports.js';
export * from './rewards.js';
export * from './sanctions.js';
export * from './securitization.js';
export * from './subscriptions.js';
export * from './suppliers.js';
export * from './trade-compliance.js';
export * from './tranches.js';
export * from './webhooks.js';
