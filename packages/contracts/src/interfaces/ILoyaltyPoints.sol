// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ILoyaltyPoints
/// @notice ERC20 loyalty points awarded for on-time clean deliveries; optionally non-transferable.
interface ILoyaltyPoints is IERC20 {
    event Awarded(address indexed to, uint256 amount);
    event TransferabilityUpdated(bool transferable);

    error ZeroAddress();
    error ZeroAmount();
    error NonTransferable();

    /// @notice Award points to a participant. MINTER_ROLE only.
    function award(address to, uint256 amount) external;

    /// @notice Whether points can currently be transferred between accounts.
    function transferable() external view returns (bool);
}
