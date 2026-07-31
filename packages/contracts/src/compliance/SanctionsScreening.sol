// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { ISanctionsScreening } from "../interfaces/ISanctionsScreening.sol";

/// @title SanctionsScreening
/// @notice On-chain denied-party register. Compliance officers block/clear on-chain addresses and
///         off-chain identity commitments (OFAC/EU/UN/UK lists). Other modules gate actions on the
///         `isSanctioned` / `isEntitySanctioned` views.
/// @dev Inherits {ProofChainAccess} for AddressBook resolution + AccessControl. Every state change
///      emits an event. No funds move here; this is a pure registry consumed by peers.
contract SanctionsScreening is ProofChainAccess, ISanctionsScreening {
    mapping(address => SanctionEntry) private _addressEntries;
    mapping(bytes32 => SanctionEntry) private _entityEntries;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial COMPLIANCE_OFFICER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.COMPLIANCE_OFFICER_ROLE, admin);
    }

    /// @inheritdoc ISanctionsScreening
    function listAddress(address account, ListSource source, bytes32 reasonHash)
        external
        onlyRole(Roles.COMPLIANCE_OFFICER_ROLE)
    {
        _requireNotGloballyPaused();
        if (account == address(0)) revert ZeroAddress();
        if (_addressEntries[account].blocked) revert AlreadyListed();

        _addressEntries[account] = SanctionEntry({
            blocked: true,
            source: source,
            reasonHash: reasonHash,
            addedAt: uint64(block.timestamp),
            clearedAt: 0
        });

        emit AddressListed(account, source, reasonHash);
    }

    /// @inheritdoc ISanctionsScreening
    function clearAddress(address account) external onlyRole(Roles.COMPLIANCE_OFFICER_ROLE) {
        _requireNotGloballyPaused();
        SanctionEntry storage entry = _addressEntries[account];
        if (!entry.blocked) revert NotListed();

        entry.blocked = false;
        entry.clearedAt = uint64(block.timestamp);

        emit AddressCleared(account);
    }

    /// @inheritdoc ISanctionsScreening
    function listEntity(bytes32 entityHash, ListSource source, bytes32 reasonHash)
        external
        onlyRole(Roles.COMPLIANCE_OFFICER_ROLE)
    {
        _requireNotGloballyPaused();
        if (entityHash == bytes32(0)) revert ZeroEntity();
        if (_entityEntries[entityHash].blocked) revert AlreadyListed();

        _entityEntries[entityHash] = SanctionEntry({
            blocked: true,
            source: source,
            reasonHash: reasonHash,
            addedAt: uint64(block.timestamp),
            clearedAt: 0
        });

        emit EntityListed(entityHash, source, reasonHash);
    }

    /// @inheritdoc ISanctionsScreening
    function clearEntity(bytes32 entityHash) external onlyRole(Roles.COMPLIANCE_OFFICER_ROLE) {
        _requireNotGloballyPaused();
        SanctionEntry storage entry = _entityEntries[entityHash];
        if (!entry.blocked) revert NotListed();

        entry.blocked = false;
        entry.clearedAt = uint64(block.timestamp);

        emit EntityCleared(entityHash);
    }

    /// @inheritdoc ISanctionsScreening
    function isSanctioned(address account) external view returns (bool) {
        return _addressEntries[account].blocked;
    }

    /// @inheritdoc ISanctionsScreening
    function isEntitySanctioned(bytes32 entityHash) external view returns (bool) {
        return _entityEntries[entityHash].blocked;
    }

    /// @inheritdoc ISanctionsScreening
    function entryOf(address account) external view returns (SanctionEntry memory) {
        return _addressEntries[account];
    }

    /// @notice Full entry for an off-chain entity commitment.
    function entityEntryOf(bytes32 entityHash) external view returns (SanctionEntry memory) {
        return _entityEntries[entityHash];
    }
}
