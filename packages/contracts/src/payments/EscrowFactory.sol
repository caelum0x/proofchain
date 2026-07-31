// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { IEscrowFactory } from "../interfaces/IEscrowFactory.sol";
import { SettlementEscrow } from "../SettlementEscrow.sol";
import { Keys } from "../core/Keys.sol";

/// @title EscrowFactory
/// @notice Deploys per-deal or per-organization {SettlementEscrow} instances, all bound to the
///         shared AttestationRegistry / ProvenanceRegistry resolved via the AddressBook.
/// @dev Uses CREATE2 (salted deployment) for deterministic, collision-guarded addresses. Only
///      DEFAULT_ADMIN_ROLE may create escrows; each new escrow is handed its own `admin`.
contract EscrowFactory is ProofChainAccess, IEscrowFactory {
    mapping(bytes32 => address) private _escrowOf;
    address[] private _allEscrows;

    /// @param addressBook_ Deployed AddressBook (resolves AttestationRegistry & ProvenanceRegistry).
    /// @param admin Address granted DEFAULT_ADMIN_ROLE (the only role that may create escrows).
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IEscrowFactory
    function createEscrow(bytes32 salt, address admin)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (address escrow)
    {
        if (admin == address(0)) revert ZeroAddress();
        if (_escrowOf[salt] != address(0)) revert EscrowAlreadyCreated(salt);

        address attestationRegistry = _addr(Keys.ATTESTATION_REGISTRY);
        address provenanceRegistry = _addr(Keys.PROVENANCE_REGISTRY);

        escrow = address(new SettlementEscrow{ salt: salt }(admin, attestationRegistry, provenanceRegistry));

        _escrowOf[salt] = escrow;
        _allEscrows.push(escrow);

        emit EscrowCreated(salt, escrow, admin);
        return escrow;
    }

    /// @inheritdoc IEscrowFactory
    function escrowOf(bytes32 salt) external view override returns (address) {
        return _escrowOf[salt];
    }

    /// @inheritdoc IEscrowFactory
    function allEscrows() external view override returns (address[] memory) {
        return _allEscrows;
    }
}
