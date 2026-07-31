/**
 * Core group handler (M0) — AddressBook, Pauser, AttestationRegistry, MockUSDC.
 * Events are captured to the `indexer_events` audit table; domain projections
 * are added by the router-domain agents as read models are introduced.
 */
import { makeHandler } from './base.js';

export default makeHandler('core');
