// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ISlashingController } from "../interfaces/ISlashingController.sol";
import { ISupplierBond } from "../interfaces/ISupplierBond.sol";
import { IStakeManager } from "../interfaces/IStakeManager.sol";

/// @title SlashingController
/// @notice Seizes supplier bonds and generic stakes on proven fraud and routes the proceeds into
///         the protocol {Treasury}.
/// @dev SLASHER_ROLE holders (arbitration / governance) trigger slashing. The controller itself is
///      the registered {SupplierBond} slasher (resolved through the AddressBook) and holds
///      SLASHER_ROLE on the {StakeManager}. Seized funds are transferred straight to the Treasury
///      address by the underlying bond/stake contract, so this controller never custodies tokens.
///      Peers resolve via the AddressBook; only peer interfaces are imported.
contract SlashingController is ProofChainAccess, ReentrancyGuard, ISlashingController {
    event StakeSlashed(address indexed who, uint256 amount, bytes32 indexed reason, address indexed to);

    error NothingToSlash(address who);

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ISlashingController
    /// @notice Slash `amount` from `who`'s supplier bond for `reason`, routing proceeds to the Treasury.
    function slash(address who, uint256 amount, bytes32 reason)
        external
        override
        nonReentrant
        onlyRole(Roles.SLASHER_ROLE)
    {
        if (amount == 0) revert ISlashingController.ZeroAmount();
        if (who == address(0)) revert ZeroAddress();

        ISupplierBond bond = ISupplierBond(_addr(Keys.SUPPLIER_BOND));
        if (bond.bondOf(who) == 0) revert NothingToSlash(who);

        address treasury = _addr(Keys.TREASURY);
        bond.slashBond(who, amount, treasury);

        emit Slashed(who, amount, reason, treasury);
    }

    /// @notice Slash `amount` from `who`'s generic stake for `reason`, routing proceeds to the Treasury.
    /// @dev Complements {slash} (which targets supplier bonds) for arbiter/pool stake seizures.
    function slashStake(address who, uint256 amount, bytes32 reason)
        external
        nonReentrant
        onlyRole(Roles.SLASHER_ROLE)
    {
        if (amount == 0) revert ISlashingController.ZeroAmount();
        if (who == address(0)) revert ZeroAddress();

        IStakeManager stakeManager = IStakeManager(_addr(Keys.STAKE_MANAGER));
        if (stakeManager.stakeOf(who) == 0) revert NothingToSlash(who);

        address treasury = _addr(Keys.TREASURY);
        stakeManager.slash(who, amount, treasury);

        emit StakeSlashed(who, amount, reason, treasury);
    }
}
