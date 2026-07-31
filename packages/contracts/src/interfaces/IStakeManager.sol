// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IStakeManager
/// @notice Generic stake accounting reused by bonds, arbiters, and pools.
interface IStakeManager {
    event Staked(address indexed account, address indexed token, uint256 amount);
    event Unstaked(address indexed account, address indexed token, uint256 amount);
    event Locked(address indexed account, uint256 amount);
    event Unlocked(address indexed account, uint256 amount);
    event StakeSlashed(address indexed account, uint256 amount, address indexed to);

    error ZeroAmount();
    error InsufficientStake(address account, uint256 requested, uint256 available);
    error InsufficientUnlocked(address account, uint256 requested, uint256 available);

    function stake(address token, uint256 amount) external;
    function unstake(address token, uint256 amount) external;
    function lock(address account, uint256 amount) external;
    function unlock(address account, uint256 amount) external;
    function slash(address account, uint256 amount, address to) external;

    function stakeOf(address account) external view returns (uint256);
    function lockedOf(address account) external view returns (uint256);
}
