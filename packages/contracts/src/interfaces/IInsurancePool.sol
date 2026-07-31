// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IInsurancePool
/// @notice Capital pool backing shipment/credit insurance.
/// @dev deps (AddressBook): StablecoinRegistry, RiskPool.
interface IInsurancePool {
    event Underwritten(bytes32 indexed policyId, uint256 coverage);
    event Deposited(address indexed provider, address indexed token, uint256 amount);
    event Withdrawn(address indexed provider, address indexed token, uint256 amount);
    event PaidOut(bytes32 indexed policyId, address indexed to, uint256 amount);

    error ZeroAmount();
    error TokenNotAccepted(address token);
    error InsufficientCapital(uint256 requested, uint256 available);
    error NotAuthorized(address caller);

    /// @notice Reserve `coverage` capital against a policy. PolicyManager only.
    function underwrite(bytes32 policyId, uint256 coverage) external;

    /// @notice Provide capital to the pool.
    function deposit(address token, uint256 amount) external;

    /// @notice Pull premium capital into the pool on behalf of a policy holder. PolicyManager only.
    /// @return received Amount actually received (fee-on-transfer safe).
    function depositFrom(address token, address from, uint256 amount) external returns (uint256 received);

    /// @notice Withdraw free (un-reserved) capital.
    function withdraw(address token, uint256 amount) external;

    /// @notice Pay a claim from reserved capital. ClaimsProcessor only.
    function payout(bytes32 policyId, address to, uint256 amount) external;

    function availableCapital(address token) external view returns (uint256);
    function reservedCapital() external view returns (uint256);
}
