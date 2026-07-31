// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IStakingRewards
/// @notice Stake PROOF/LP tokens to earn emissions.
/// @dev deps (AddressBook): EmissionsController, GovernanceToken.
interface IStakingRewards {
    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardPaid(address indexed account, uint256 reward);

    error ZeroAmount();
    error InsufficientStaked(address account, uint256 requested, uint256 available);

    /// @notice Stake `amount` of the staking token.
    function stake(uint256 amount) external;

    /// @notice Withdraw staked tokens without claiming rewards.
    function withdraw(uint256 amount) external;

    /// @notice Claim accrued rewards.
    function getReward() external;

    /// @notice Withdraw all staked tokens and claim rewards in one call.
    function exit() external;

    function earned(address account) external view returns (uint256);
    function stakedOf(address account) external view returns (uint256);
}
