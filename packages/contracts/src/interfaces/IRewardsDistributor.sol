// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IRewardsDistributor
/// @notice Merkle/streaming rewards distribution to participants.
interface IRewardsDistributor {
    event RootSet(bytes32 indexed root, uint256 indexed epoch);
    event Claimed(address indexed account, uint256 indexed epoch, uint256 amount);

    error InvalidProof(address account);
    error AlreadyClaimed(address account, uint256 epoch);
    error UnknownEpoch(uint256 epoch);

    /// @notice Publish a new merkle root for an epoch. Admin only.
    function setRoot(uint256 epoch, bytes32 root, address token) external;

    /// @notice Claim rewards for the caller against a published root.
    function claim(uint256 epoch, uint256 amount, bytes32[] calldata proof) external;

    function isClaimed(uint256 epoch, address account) external view returns (bool);
}
