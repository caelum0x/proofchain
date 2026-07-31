// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { Roles } from "../core/Roles.sol";
import { ILoyaltyPoints } from "../interfaces/ILoyaltyPoints.sol";

/// @title LoyaltyPoints
/// @notice ERC20 loyalty points awarded for on-time, clean deliveries. Points are optionally
///         non-transferable (soulbound): when transferability is disabled, holders can receive
///         freshly-minted points and burn them, but cannot move balances between accounts.
/// @dev `MINTER_ROLE` holders (the {RewardsDistributor}, {SettlementRouter}, or an off-chain
///      keeper) call {award} to issue points. Transferability is a `DEFAULT_ADMIN_ROLE` switch so
///      governance can flip points to a tradeable loyalty currency later without redeploying.
contract LoyaltyPoints is ERC20, AccessControl, ILoyaltyPoints {
    /// @notice Whether point balances can currently be transferred between accounts.
    bool private _transferable;

    /// @param admin Address granted DEFAULT_ADMIN_ROLE (role administration + transferability switch).
    /// @param minter Address granted MINTER_ROLE (the initial rewards issuer).
    /// @param transferable_ Initial transferability; `false` makes points soulbound at launch.
    constructor(address admin, address minter, bool transferable_) ERC20("ProofChain Loyalty", "LOYAL") {
        if (admin == address(0) || minter == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.MINTER_ROLE, minter);
        _transferable = transferable_;
        emit TransferabilityUpdated(transferable_);
    }

    /// @inheritdoc ILoyaltyPoints
    function award(address to, uint256 amount) external onlyRole(Roles.MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
        emit Awarded(to, amount);
    }

    /// @notice Enable or disable peer-to-peer transfers of points. DEFAULT_ADMIN_ROLE only.
    function setTransferable(bool transferable_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _transferable = transferable_;
        emit TransferabilityUpdated(transferable_);
    }

    /// @inheritdoc ILoyaltyPoints
    function transferable() external view returns (bool) {
        return _transferable;
    }

    /// @dev Enforces soulbound behaviour. Mints (`from == 0`) and burns (`to == 0`) are always
    ///      permitted; peer transfers are gated on the transferability switch.
    function _update(address from, address to, uint256 value) internal override {
        if (!_transferable && from != address(0) && to != address(0)) {
            revert NonTransferable();
        }
        super._update(from, to, value);
    }
}
