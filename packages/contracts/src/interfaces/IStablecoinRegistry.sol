// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IStablecoinRegistry
/// @notice Allowlist of accepted settlement tokens with their decimals.
interface IStablecoinRegistry {
    struct TokenInfo {
        address token;
        uint8 decimals;
        bool accepted;
    }

    event TokenAdded(address indexed token, uint8 decimals);
    event TokenRemoved(address indexed token);

    error TokenAlreadyAdded(address token);
    error TokenNotAccepted(address token);

    /// @notice Add an accepted token. Admin only.
    function addToken(address token, uint8 decimals) external;

    /// @notice Remove a token from the allowlist. Admin only.
    function removeToken(address token) external;

    function isAccepted(address token) external view returns (bool);
    function decimalsOf(address token) external view returns (uint8);
    function tokens() external view returns (address[] memory);
}
