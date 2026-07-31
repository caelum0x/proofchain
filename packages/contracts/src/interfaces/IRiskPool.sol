// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IRiskPool
/// @notice Reinsurance tranche that absorbs tail losses beyond the primary InsurancePool.
interface IRiskPool {
    event ToppedUp(address indexed from, address indexed token, uint256 amount);
    event Covered(bytes32 indexed policyId, address indexed to, uint256 amount);

    error ZeroAmount();
    error InsufficientReserves(uint256 requested, uint256 available);
    error NotAuthorized(address caller);

    /// @notice Add reserves to the risk pool.
    function topUp(address token, uint256 amount) external;

    /// @notice Cover a shortfall for a policy from the tranche. InsurancePool/ClaimsProcessor only.
    function cover(bytes32 policyId, address token, address to, uint256 amount) external;

    function reserves(address token) external view returns (uint256);
}
