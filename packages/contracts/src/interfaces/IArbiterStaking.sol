// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IArbiterStaking
/// @notice Stake to become an arbiter; stake is slashable for provably bad votes.
/// @dev deps (AddressBook): StakeManager, SlashingController.
interface IArbiterStaking {
    event ArbiterStaked(address indexed arbiter, uint256 amount);
    event ArbiterUnstaked(address indexed arbiter, uint256 amount);
    event MinStakeUpdated(uint256 minStake);

    error ZeroAmount();
    error BelowMinStake(uint256 provided, uint256 required);
    error StakeLocked(address arbiter);

    /// @notice Stake `amount` to become / remain an arbiter.
    function stakeArbiter(uint256 amount) external;

    /// @notice Unstake once no votes are pending.
    function unstakeArbiter(uint256 amount) external;

    function isArbiter(address account) external view returns (bool);
    function stakeOf(address account) external view returns (uint256);
    function minStake() external view returns (uint256);
}
