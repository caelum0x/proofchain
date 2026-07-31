// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ITreasury
/// @notice Holds protocol fees; supports deposits from fee collectors and admin withdrawals.
interface ITreasury {
    event Deposit(address indexed from, address indexed token, uint256 amount);
    event Withdraw(address indexed to, address indexed token, uint256 amount);

    error ZeroAmount();
    error InsufficientBalance(address token, uint256 requested, uint256 available);

    /// @notice Pull `amount` of `token` from the caller into the treasury.
    function deposit(address token, uint256 amount) external;

    /// @notice Withdraw `amount` of `token` to `to`. TREASURER_ROLE only.
    function withdraw(address token, address to, uint256 amount) external;

    /// @notice Treasury balance of `token`.
    function balanceOf(address token) external view returns (uint256);
}
