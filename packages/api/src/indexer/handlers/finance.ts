/**
 * Invoice financing / RWA group handler (M5) — InvoiceNFT, ReceivableRegistry,
 * InvoiceFinancing, FinancingPool, LenderVault, YieldDistributor,
 * RepaymentController. Captures listing/funding/allocation events to the audit
 * table for the invoices/financing/pools routers.
 */
import { makeHandler } from './base.js';

export default makeHandler('finance');
