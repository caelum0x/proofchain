// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IFleetRegistry } from "../interfaces/IFleetRegistry.sol";
import { ICarrierRegistry } from "../interfaces/ICarrierRegistry.sol";

/// @title FleetRegistry
/// @notice Registry of transport assets (trucks, reefers, vessels, aircraft, rail cars) operated by
///         carriers. Each asset carries a capacity, emission class, and a bound telematics device
///         key used by the route/cold-chain modules to authenticate signed readings. Assets move
///         through active → maintenance → decommissioned lifecycle states.
/// @dev Deps resolved via the {AddressBook}. Registration is open to `REGISTRAR_ROLE` or the
///      carrier themselves; subsequent mutations are restricted to the asset's carrier (or a
///      registrar). The {CarrierRegistry} is an OPTIONAL enforcement hook.
contract FleetRegistry is ProofChainAccess, IFleetRegistry {
    mapping(bytes32 => Asset) private _assets;

    /// @notice The carrier is not registered in the wired {CarrierRegistry}.
    error CarrierNotRegistered(address carrier);

    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IFleetRegistry
    function registerAsset(
        bytes32 assetId,
        address carrier,
        AssetType assetType,
        uint256 capacityKg,
        uint16 emissionClass
    ) external {
        _requireNotGloballyPaused();
        if (carrier == address(0)) revert ZeroAddress();
        if (!hasRole(Roles.REGISTRAR_ROLE, msg.sender) && msg.sender != carrier) {
            revert NotCarrier(assetId);
        }
        if (_assets[assetId].state != AssetState.None) revert AssetExists(assetId);
        if (capacityKg == 0) revert ZeroCapacity();
        _requireRegisteredCarrier(carrier);

        _assets[assetId] = Asset({
            assetId: assetId,
            carrier: carrier,
            assetType: assetType,
            capacityKg: capacityKg,
            emissionClass: emissionClass,
            deviceKey: address(0),
            state: AssetState.Active
        });

        emit AssetRegistered(assetId, carrier, assetType, capacityKg);
    }

    /// @inheritdoc IFleetRegistry
    function setDeviceKey(bytes32 assetId, address deviceKey) external {
        _requireNotGloballyPaused();
        Asset storage a = _requireController(assetId);
        if (a.state == AssetState.Decommissioned) {
            revert InvalidState(assetId, AssetState.Active, a.state);
        }

        a.deviceKey = deviceKey;
        emit DeviceKeySet(assetId, deviceKey);
    }

    /// @inheritdoc IFleetRegistry
    function setMaintenance(bytes32 assetId) external {
        _requireNotGloballyPaused();
        Asset storage a = _requireController(assetId);
        if (a.state != AssetState.Active) revert InvalidState(assetId, AssetState.Active, a.state);

        a.state = AssetState.Maintenance;
        emit AssetStateChanged(assetId, AssetState.Maintenance);
    }

    /// @inheritdoc IFleetRegistry
    function reactivate(bytes32 assetId) external {
        _requireNotGloballyPaused();
        Asset storage a = _requireController(assetId);
        if (a.state != AssetState.Maintenance) {
            revert InvalidState(assetId, AssetState.Maintenance, a.state);
        }

        a.state = AssetState.Active;
        emit AssetStateChanged(assetId, AssetState.Active);
    }

    /// @inheritdoc IFleetRegistry
    function decommission(bytes32 assetId) external {
        _requireNotGloballyPaused();
        Asset storage a = _requireController(assetId);
        if (a.state == AssetState.Decommissioned) {
            revert InvalidState(assetId, AssetState.Active, a.state);
        }

        a.state = AssetState.Decommissioned;
        emit AssetStateChanged(assetId, AssetState.Decommissioned);
    }

    /// @inheritdoc IFleetRegistry
    function isActiveDevice(bytes32 assetId, address deviceKey) external view returns (bool) {
        Asset storage a = _assets[assetId];
        return a.state == AssetState.Active && deviceKey != address(0) && a.deviceKey == deviceKey;
    }

    /// @inheritdoc IFleetRegistry
    function assetOf(bytes32 assetId) external view returns (Asset memory) {
        return _assets[assetId];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Load an existing asset and require the caller to be its carrier or a registrar.
    function _requireController(bytes32 assetId) private view returns (Asset storage a) {
        a = _assets[assetId];
        if (a.state == AssetState.None) revert UnknownAsset(assetId);
        if (msg.sender != a.carrier && !hasRole(Roles.REGISTRAR_ROLE, msg.sender)) {
            revert NotCarrier(assetId);
        }
    }

    /// @dev Enforce carrier registration when a {CarrierRegistry} is wired; skip otherwise.
    function _requireRegisteredCarrier(address carrier) private view {
        address reg = _addrOrZero(Keys.CARRIER_REGISTRY);
        if (reg != address(0) && !ICarrierRegistry(reg).isCarrier(carrier)) {
            revert CarrierNotRegistered(carrier);
        }
    }
}
