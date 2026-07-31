// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { ICarrierRegistry } from "../interfaces/ICarrierRegistry.sol";

/// @title CarrierRegistry
/// @notice Self-service registry of logistics carrier profiles. Downstream modules (e.g. the
///         {CheckpointOracle}) can gate checkpoint pushes on `isCarrier`.
contract CarrierRegistry is ProofChainAccess, ICarrierRegistry {
    mapping(address => Profile) private _profiles;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc ICarrierRegistry
    function registerCarrier(string calldata name, string calldata uri) external {
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

        emit CarrierRegistered(msg.sender, name, uri);
    }

    /// @inheritdoc ICarrierRegistry
    function updateCarrier(string calldata name, string calldata uri) external {
        _requireNotGloballyPaused();
        if (bytes(name).length == 0) revert EmptyName();
        Profile storage profile = _profiles[msg.sender];
        if (!profile.exists) revert NotRegistered(msg.sender);

        profile.name = name;
        profile.uri = uri;

        emit CarrierUpdated(msg.sender, name, uri);
    }

    /// @inheritdoc ICarrierRegistry
    function profileOf(address account) external view returns (Profile memory) {
        return _profiles[account];
    }

    /// @inheritdoc ICarrierRegistry
    function isCarrier(address account) external view returns (bool) {
        return _profiles[account].exists;
    }
}
