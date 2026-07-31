/**
 * Rewards & loyalty group handler (M10) — LoyaltyPoints, RewardsDistributor,
 * StakingRewards, ReferralProgram, EmissionsController. Captures award/claim/
 * referral events to the audit table for the rewards and referrals routers.
 */
import { makeHandler } from './base.js';

export default makeHandler('rewards');
