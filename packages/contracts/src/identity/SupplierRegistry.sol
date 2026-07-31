// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { ISupplierRegistry } from "../interfaces/ISupplierRegistry.sol";

/// @title SupplierRegistry
/// @notice Self-service registry of supplier profiles. Any account may register itself once and
///         later update its own display name / metadata URI.
/// @dev Peers (none required here) would be resolved via {ProofChainAccess} `_addr`.
contract SupplierRegistry is ProofChainAccess, ISupplierRegistry {
    mapping(address => Profile) private _profiles;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ISupplierRegistry
    function registerSupplier(string calldata name, string calldata uri) external {
        _requireNotGloballyPaused();
        if (bytes(name).length == 0) revert EmptyName();
        if (_profiles[msg.sender].exists) revert AlreadyRegistered(msg.sender);

        _profiles[msg.sender] = Profile({
            account: msg.sender,
            name: name,
            uri: uri,
            registeredAt: uint64(block.timestamp),
            exists: true
        });

        emit SupplierRegistered(msg.sender, name, uri);
    }

    /// @inheritdoc ISupplierRegistry
    function updateSupplier(string calldata name, string calldata uri) external {
        _requireNotGloballyPaused();
        if (bytes(name).length == 0) revert EmptyName();
        Profile storage profile = _profiles[msg.sender];
        if (!profile.exists) revert NotRegistered(msg.sender);

        profile.name = name;
        profile.uri = uri;

        emit SupplierUpdated(msg.sender, name, uri);
    }

    /// @inheritdoc ISupplierRegistry
    function profileOf(address account) external view returns (Profile memory) {
        return _profiles[account];
    }

    /// @inheritdoc ISupplierRegistry
    function isSupplier(address account) external view returns (bool) {
        return _profiles[account].exists;
    }
}
