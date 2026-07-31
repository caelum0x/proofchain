// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPaymentRouter
/// @notice Routes multi-stablecoin payments to escrow/treasury, taking protocol fees en route.
/// @dev deps (AddressBook): StablecoinRegistry, FeeManager, Treasury.
interface IPaymentRouter {
    event Routed(
        bytes32 indexed action,
        address indexed token,
        address indexed payer,
        address destination,
        uint256 amount,
        uint256 fee
    );

    error TokenNotAccepted(address token);
    error ZeroAmount();

    /// @notice Pull `amount` of `token` from the caller, collect fees, and forward net to `destination`.
    /// @return net Amount delivered to `destination` after fees.
    function pay(bytes32 action, address token, address destination, uint256 amount) external returns (uint256 net);

    /// @notice Route an already-approved payment through a named action for a specific payer.
    /// @return net Amount delivered to `destination` after fees.
    function route(bytes32 action, address token, address payer, address destination, uint256 amount)
        external
        returns (uint256 net);
}
