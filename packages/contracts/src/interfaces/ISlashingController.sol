// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISlashingController
/// @notice Slashes bonds/stakes on proven fraud and routes proceeds to the Treasury.
/// @dev deps (AddressBook): SupplierBond, StakeManager, Treasury.
interface ISlashingController {
    event Slashed(address indexed who, uint256 amount, bytes32 indexed reason, address indexed to);

    error ZeroAmount();
    error NotSlasher(address caller);

    /// @notice Slash `amount` from `who` for `reason`. SLASHER_ROLE only.
    function slash(address who, uint256 amount, bytes32 reason) external;
}
