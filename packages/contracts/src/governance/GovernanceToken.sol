// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { Roles } from "../core/Roles.sol";
import { IGovernanceToken } from "../interfaces/IGovernanceToken.sol";

/// @title GovernanceToken
/// @notice The PROOF governance token: a standard {ERC20Votes} token with a role-gated `mint`.
/// @dev Voting power tracking (checkpoints + delegation) is provided by OpenZeppelin
///      {ERC20Votes}/{Votes}. `MINTER_ROLE` holders (the governance timelock, a distributor, or
///      an initial admin) can issue new supply. `ERC20Permit` enables gasless approvals and the
///      `delegateBySig` flow inherited from {Votes}. All external inputs are validated with
///      custom errors and every mint emits an event for indexing.
contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes, AccessControl, IGovernanceToken {
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (role administration).
    /// @param minter Address granted MINTER_ROLE (initial issuer / distributor / timelock).
    constructor(address admin, address minter)
        ERC20("ProofChain Governance", "PROOF")
        ERC20Permit("ProofChain Governance")
    {
        if (admin == address(0) || minter == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.MINTER_ROLE, minter);
    }

    /// @inheritdoc IGovernanceToken
    function mint(address to, uint256 amount) external onlyRole(Roles.MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
        emit Minted(to, amount);
    }

    // --- required multiple-inheritance overrides -------------------------------------------

    /// @dev Resolves the {ERC20} / {ERC20Votes} `_update` diamond so transfers move voting power.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    /// @dev Resolves the {ERC20Permit} / {Nonces} `nonces` diamond.
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
