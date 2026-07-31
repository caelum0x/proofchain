// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { Roles } from "../core/Roles.sol";
import { ITrancheToken } from "../interfaces/ITrancheToken.sol";

/// @title TrancheToken
/// @notice ERC20 share of a single securitization tranche. Investors receive freshly-minted shares
///         when they buy into a tranche and burn them on redemption. Mint/burn are restricted to
///         `MINTER_ROLE`, which the deployment grants to the {ReceivableSecuritization} contract.
/// @dev Immutable `poolId`/`seniority` metadata binds the token to its waterfall position. This
///      contract deliberately does NOT resolve peers via the AddressBook: it is a leaf value token
///      whose only trusted caller (the securitization) is expressed through `MINTER_ROLE`.
contract TrancheToken is ERC20, AccessControl, ITrancheToken {
    /// @notice Pool this tranche token belongs to.
    bytes32 private immutable _poolId;

    /// @notice Seniority rank of this tranche (0 = most senior; losses hit higher ranks first).
    uint16 private immutable _seniority;

    /// @notice A required address argument was the zero address.
    error ZeroAddress();

    /// @param name_ ERC20 name (e.g. "ProofChain Senior Tranche").
    /// @param symbol_ ERC20 symbol.
    /// @param poolId_ Securitization pool this tranche belongs to.
    /// @param seniority_ Waterfall seniority (0 = most senior).
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (role administration).
    /// @param minter Address granted MINTER_ROLE (the securitization contract).
    constructor(
        string memory name_,
        string memory symbol_,
        bytes32 poolId_,
        uint16 seniority_,
        address admin,
        address minter
    ) ERC20(name_, symbol_) {
        if (admin == address(0) || minter == address(0)) revert ZeroAddress();
        _poolId = poolId_;
        _seniority = seniority_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.MINTER_ROLE, minter);
    }

    /// @inheritdoc ITrancheToken
    function poolId() external view returns (bytes32) {
        return _poolId;
    }

    /// @inheritdoc ITrancheToken
    function seniority() external view returns (uint16) {
        return _seniority;
    }

    /// @inheritdoc ITrancheToken
    function mint(address to, uint256 amount) external onlyRole(Roles.MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// @inheritdoc ITrancheToken
    function burn(address from, uint256 amount) external onlyRole(Roles.MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = balanceOf(from);
        if (bal < amount) revert InsufficientBalance(from, amount, bal);
        _burn(from, amount);
        emit Burned(from, amount);
    }
}
