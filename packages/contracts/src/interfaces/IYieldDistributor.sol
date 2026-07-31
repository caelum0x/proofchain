// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IYieldDistributor
/// @notice Splits repayment yield to pool depositors.
interface IYieldDistributor {
    event YieldDistributed(bytes32 indexed poolId, address indexed token, uint256 amount);

    error ZeroAmount();
    error NothingToDistribute(bytes32 poolId);

    /// @notice Distribute accrued yield for a pool to its depositors.
    function distribute(bytes32 poolId) external;

    /// @notice Yield currently pending distribution for a pool.
    function pendingYield(bytes32 poolId) external view returns (uint256);
}
