/**
 * Disputes & governance group handler (M7) — DisputeArbitration, ArbiterStaking,
 * GovernanceToken, ProofChainGovernor, ProofChainTimelock, ProposalRegistry.
 * Captures dispute/proposal/vote events to the audit table for the disputes and
 * governance routers.
 */
import { makeHandler } from './base.js';

export default makeHandler('governance');
