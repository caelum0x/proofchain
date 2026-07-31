// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IFeeManager
/// @notice Computes and collects protocol fees (bps per action) into the Treasury.
/// @dev Actions are identified by a `bytes32` key (e.g. keccak256("SETTLE")).
interface IFeeManager {
    event FeeBpsSet(bytes32 indexed action, uint16 bps);
    event FeeCollected(bytes32 indexed action, address indexed token, address indexed payer, uint256 amount);

    error InvalidBps(uint16 bps);

    /// @notice Set the fee (bps) for an action. Admin only.
    function setFeeBps(bytes32 action, uint16 bps) external;

    /// @notice Fee amount for `action` on `amount` (view, pure math).
    function feeFor(bytes32 action, uint256 amount) external view returns (uint256);

    /// @notice Fee bps configured for an action.
    function feeBps(bytes32 action) external view returns (uint16);

    /// @notice Pull the computed fee for `action` in `token` from `payer` and forward to Treasury.
    /// @return fee The amount collected.
    function collect(bytes32 action, address token, address payer, uint256 amount) external returns (uint256 fee);
}
