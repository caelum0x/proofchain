// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISupplierBond
/// @notice Suppliers stake an ERC20 bond that can be locked/slashed against misbehavior.
/// @dev deps (AddressBook): StablecoinRegistry (accepted bond token), SlashingController.
interface ISupplierBond {
    event BondDeposited(address indexed supplier, address indexed token, uint256 amount);
    event BondWithdrawn(address indexed supplier, address indexed token, uint256 amount);
    event BondSlashed(address indexed supplier, uint256 amount, address indexed to);

    error ZeroAmount();
    error TokenNotAccepted(address token);
    error InsufficientUnlockedBond(address supplier, uint256 requested, uint256 available);
    error NotSlasher(address caller);

    /// @notice Deposit `amount` of an accepted token as bond.
    function depositBond(address token, uint256 amount) external;

    /// @notice Withdraw unlocked bond back to the supplier.
    function withdrawBond(address token, uint256 amount) external;

    /// @notice Slash `amount` of a supplier's bond to `to`. SlashingController only.
    function slashBond(address supplier, uint256 amount, address to) external;

    function bondOf(address supplier) external view returns (uint256);
    function lockedOf(address supplier) external view returns (uint256);
}
