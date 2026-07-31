/**
 * Marketplace group handler (M9) — ListingRegistry, FinancingMarketplace,
 * AuctionHouse, OrderBook, BidManager. Captures listing/offer/auction/bid events
 * to the audit table for the marketplace and auctions routers.
 */
import { makeHandler } from './base.js';

export default makeHandler('marketplace');
