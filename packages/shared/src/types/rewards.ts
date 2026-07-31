/**
 * `rewards` domain types.
 *
 * Mirrors the on-chain incentive layer — Merkle-based {RewardsDistributor}
 * epochs, ERC20 {LoyaltyPoints}, the {ReferralProgram}, Synthetix-style
 * {StakingRewards}, and the governance-tuned {EmissionsController} — plus the
 * request/response DTOs the api/web layers exchange for these flows.
 *
 * The primary struct mirror read straight off-chain ({@link RewardEpoch}) lives
 * in `./core`; this module adds the event payloads and boundary DTOs. Every
 * field is `readonly`; `bigint` is used for uint256 amounts / epochs / rates,
 * and the branded `Address` / `Bytes32` / `Hex` types come from `./core`.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32, Hex } from "./core";

// ---------------------------------------------------------------------------
// RewardsDistributor event payloads
// ---------------------------------------------------------------------------

/** Decoded `RewardsDistributor.RootSet`. */
export interface RewardRootSetEvent {
  readonly root: Bytes32;
  readonly epoch: bigint;
}

/** Decoded `RewardsDistributor.Claimed`. */
export interface RewardClaimedEvent {
  readonly account: Address;
  readonly epoch: bigint;
  readonly amount: bigint;
}

// ---------------------------------------------------------------------------
// LoyaltyPoints event payloads
// ---------------------------------------------------------------------------

/** Decoded `LoyaltyPoints.Awarded`. */
export interface LoyaltyAwardedEvent {
  readonly to: Address;
  readonly amount: bigint;
}

/** Decoded `LoyaltyPoints.TransferabilityUpdated`. */
export interface LoyaltyTransferabilityUpdatedEvent {
  readonly transferable: boolean;
}

// ---------------------------------------------------------------------------
// ReferralProgram event payloads
// ---------------------------------------------------------------------------

/** Decoded `ReferralProgram.Referred`. */
export interface ReferredEvent {
  readonly referrer: Address;
  readonly referee: Address;
}

/** Decoded `ReferralProgram.ConversionRecorded`. */
export interface ConversionRecordedEvent {
  readonly referee: Address;
  readonly value: bigint;
  readonly reward: bigint;
}

/** Decoded `ReferralProgram.ReferralClaimed`. */
export interface ReferralClaimedEvent {
  readonly referrer: Address;
  readonly amount: bigint;
}

/** Decoded `ReferralProgram.RewardBpsUpdated`. */
export interface ReferralRewardBpsUpdatedEvent {
  readonly oldBps: bigint;
  readonly newBps: bigint;
}

// ---------------------------------------------------------------------------
// StakingRewards event payloads
// ---------------------------------------------------------------------------

/** Decoded `StakingRewards.Staked`. */
export interface RewardStakedEvent {
  readonly account: Address;
  readonly amount: bigint;
}

/** Decoded `StakingRewards.Withdrawn`. */
export interface RewardWithdrawnEvent {
  readonly account: Address;
  readonly amount: bigint;
}

/** Decoded `StakingRewards.RewardPaid`. */
export interface RewardPaidEvent {
  readonly account: Address;
  readonly reward: bigint;
}

/** Decoded `StakingRewards.RewardRateSynced`. */
export interface RewardRateSyncedEvent {
  readonly rate: bigint;
}

// ---------------------------------------------------------------------------
// EmissionsController event payload
// ---------------------------------------------------------------------------

/** Decoded `EmissionsController.EmissionRateSet`. */
export interface EmissionRateSetEvent {
  readonly epoch: bigint;
  readonly rate: bigint;
}

// ---------------------------------------------------------------------------
// Request / response DTOs (api + web boundary)
//
// Big integers cross the JSON boundary as decimal strings.
// ---------------------------------------------------------------------------

/** A single Merkle allocation `(account, amount)` committed by an epoch root. */
export interface RewardAllocation {
  readonly account: Address;
  readonly amount: string;
}

/** Body for claiming a Merkle reward against a published epoch root. */
export interface ClaimRewardRequest {
  readonly epoch: string;
  readonly amount: string;
  readonly proof: readonly Hex[];
}

/** Body for staking (or withdrawing) tokens in {StakingRewards}. */
export interface RewardStakeRequest {
  readonly amount: string;
}

/** Body for first-touch referral attribution. */
export interface ReferRequest {
  readonly referrer: Address;
}

/** Read model for a staker's position in {StakingRewards}. */
export interface StakingPosition {
  readonly account: Address;
  readonly staked: bigint;
  readonly earned: bigint;
}

/** Read model for a referrer's attribution + claimable balance. */
export interface ReferralView {
  readonly referrer: Address;
  readonly pendingReward: bigint;
  readonly rewardBps: number;
}

/** Read model for a published {RewardsDistributor} epoch. */
export interface RewardEpochView {
  readonly epoch: bigint;
  readonly root: Bytes32;
  readonly token: Address;
  readonly claimed: boolean;
}
