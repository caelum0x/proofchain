/**
 * Tokenization & ESG group handler (M8) — BatchNFT, WarehouseReceipt,
 * CarbonCreditToken, ESGRegistry, SustainabilityOracle, OffsetMarketplace.
 * Captures mint/retire/emissions events to the audit table for the nft, esg and
 * carbon routers.
 */
import { makeHandler } from './base.js';

export default makeHandler('esg');
