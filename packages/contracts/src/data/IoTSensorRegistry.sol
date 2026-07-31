// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IIoTSensorRegistry } from "../interfaces/IIoTSensorRegistry.sol";

/// @title IoTSensorRegistry
/// @notice Registry of IoT sensor devices whose signed readings feed the platform's oracles (cold-chain,
///         route, energy meters). Each device is registered against an owner and a unique device signing
///         key, then commissioned onto the asset/batch it monitors. Readings are only trusted while a
///         sensor is Commissioned and uncompromised, and device keys can be rotated on-chain.
/// @dev Downstream consumers (ColdChainMonitor, RouteAttestation, OracleAggregator, RenewableEnergy) call
///      {isTrustedDevice} / {sensorOfDevice} through the {IIoTSensorRegistry} interface resolved via the
///      {AddressBook}. No peer wiring is hardcoded here — this contract is the ground truth for device trust.
contract IoTSensorRegistry is ProofChainAccess, IIoTSensorRegistry {
    /// @dev sensorId => sensor record.
    mapping(bytes32 => Sensor) private _sensors;

    /// @dev deviceKey => the sensorId it currently signs for (0 if the key is free).
    mapping(address => bytes32) private _deviceToSensor;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IIoTSensorRegistry
    function registerSensor(
        bytes32 sensorId,
        address owner,
        address deviceKey,
        SensorType sensorType,
        bytes32 metadataHash
    ) external override {
        _requireNotGloballyPaused();
        if (owner == address(0)) revert ZeroAddress();
        if (deviceKey == address(0)) revert ZeroDeviceKey();
        // A REGISTRAR may onboard on behalf of an owner; otherwise the owner registers their own device.
        if (msg.sender != owner && !hasRole(Roles.REGISTRAR_ROLE, msg.sender)) revert NotOwner(sensorId);
        if (_sensors[sensorId].status != SensorStatus.None) revert SensorExists(sensorId);
        if (_deviceToSensor[deviceKey] != bytes32(0)) revert DeviceKeyInUse(deviceKey);

        _sensors[sensorId] = Sensor({
            sensorId: sensorId,
            owner: owner,
            deviceKey: deviceKey,
            sensorType: sensorType,
            assetId: bytes32(0),
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp),
            status: SensorStatus.Registered
        });
        _deviceToSensor[deviceKey] = sensorId;

        emit SensorRegistered(sensorId, owner, deviceKey, sensorType);
    }

    /// @inheritdoc IIoTSensorRegistry
    function commission(bytes32 sensorId, bytes32 assetId) external override {
        _requireNotGloballyPaused();
        Sensor storage s = _requireOwned(sensorId);
        if (s.status != SensorStatus.Registered) {
            revert InvalidStatus(sensorId, SensorStatus.Registered, s.status);
        }

        s.assetId = assetId;
        s.status = SensorStatus.Commissioned;
        emit SensorCommissioned(sensorId, assetId);
    }

    /// @inheritdoc IIoTSensorRegistry
    function decommission(bytes32 sensorId) external override {
        _requireNotGloballyPaused();
        Sensor storage s = _requireOwned(sensorId);
        if (s.status != SensorStatus.Registered && s.status != SensorStatus.Commissioned) {
            revert InvalidStatus(sensorId, SensorStatus.Commissioned, s.status);
        }

        s.status = SensorStatus.Decommissioned;
        emit SensorDecommissioned(sensorId);
    }

    /// @inheritdoc IIoTSensorRegistry
    function flagCompromised(bytes32 sensorId, bytes32 reason) external override {
        _requireNotGloballyPaused();
        Sensor storage s = _sensors[sensorId];
        if (s.status == SensorStatus.None) revert UnknownSensor(sensorId);
        // Either the operator's own security team (owner) or a trusted keeper can quarantine a device.
        if (msg.sender != s.owner && !hasRole(Roles.KEEPER_ROLE, msg.sender)) revert NotOwner(sensorId);
        if (s.status == SensorStatus.Compromised) {
            revert InvalidStatus(sensorId, SensorStatus.Commissioned, s.status);
        }

        s.status = SensorStatus.Compromised;
        emit SensorCompromised(sensorId, reason);
    }

    /// @inheritdoc IIoTSensorRegistry
    function rotateDeviceKey(bytes32 sensorId, address newKey) external override {
        _requireNotGloballyPaused();
        Sensor storage s = _requireOwned(sensorId);
        if (newKey == address(0)) revert ZeroDeviceKey();
        if (s.status == SensorStatus.Decommissioned) {
            revert InvalidStatus(sensorId, SensorStatus.Commissioned, s.status);
        }
        if (_deviceToSensor[newKey] != bytes32(0)) revert DeviceKeyInUse(newKey);

        address oldKey = s.deviceKey;
        _deviceToSensor[oldKey] = bytes32(0);
        _deviceToSensor[newKey] = sensorId;
        s.deviceKey = newKey;

        emit DeviceKeyRotated(sensorId, oldKey, newKey);
    }

    /// @inheritdoc IIoTSensorRegistry
    function isTrustedDevice(bytes32 sensorId, address deviceKey) external view override returns (bool) {
        Sensor storage s = _sensors[sensorId];
        return s.status == SensorStatus.Commissioned && s.deviceKey == deviceKey && deviceKey != address(0);
    }

    /// @inheritdoc IIoTSensorRegistry
    function sensorOfDevice(address deviceKey) external view override returns (bytes32) {
        return _deviceToSensor[deviceKey];
    }

    /// @inheritdoc IIoTSensorRegistry
    function sensorOf(bytes32 sensorId) external view override returns (Sensor memory) {
        return _sensors[sensorId];
    }

    /// @dev Load a known sensor and assert `msg.sender` is its owner.
    function _requireOwned(bytes32 sensorId) private view returns (Sensor storage s) {
        s = _sensors[sensorId];
        if (s.status == SensorStatus.None) revert UnknownSensor(sensorId);
        if (msg.sender != s.owner) revert NotOwner(sensorId);
    }
}
