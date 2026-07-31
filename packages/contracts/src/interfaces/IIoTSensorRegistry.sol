// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IIoTSensorRegistry
/// @notice Registry of IoT sensor devices whose signed readings feed the platform's oracles (cold-chain,
///         route, energy meters). Each device is registered with an owner, a device public key and type,
///         then commissioned/decommissioned; readings are only trusted when the signer is a live device.
/// @dev deps (AddressBook): ColdChainMonitor, RouteAttestation, OracleAggregator, RenewableEnergyCertificate.
interface IIoTSensorRegistry {
    enum SensorType {
        Temperature,
        Humidity,
        Gps,
        Shock,
        EnergyMeter,
        FlowMeter,
        Other
    }

    enum SensorStatus {
        None,
        Registered,
        Commissioned,
        Decommissioned,
        Compromised
    }

    struct Sensor {
        bytes32 sensorId;
        address owner;
        address deviceKey;
        SensorType sensorType;
        bytes32 assetId;
        bytes32 metadataHash;
        uint64 registeredAt;
        SensorStatus status;
    }

    event SensorRegistered(bytes32 indexed sensorId, address indexed owner, address indexed deviceKey, SensorType sensorType);
    event SensorCommissioned(bytes32 indexed sensorId, bytes32 assetId);
    event SensorDecommissioned(bytes32 indexed sensorId);
    event SensorCompromised(bytes32 indexed sensorId, bytes32 reason);
    event DeviceKeyRotated(bytes32 indexed sensorId, address indexed oldKey, address indexed newKey);

    error SensorExists(bytes32 sensorId);
    error UnknownSensor(bytes32 sensorId);
    error NotOwner(bytes32 sensorId);
    error InvalidStatus(bytes32 sensorId, SensorStatus expected, SensorStatus actual);
    error DeviceKeyInUse(address deviceKey);
    error ZeroDeviceKey();

    /// @notice Register a sensor device. REGISTRAR_ROLE or the owner.
    function registerSensor(bytes32 sensorId, address owner, address deviceKey, SensorType sensorType, bytes32 metadataHash)
        external;

    /// @notice Commission a sensor and bind it to an asset/batch it monitors.
    function commission(bytes32 sensorId, bytes32 assetId) external;

    /// @notice Decommission a sensor from service.
    function decommission(bytes32 sensorId) external;

    /// @notice Flag a sensor as compromised so its readings are no longer trusted. KEEPER_ROLE / owner.
    function flagCompromised(bytes32 sensorId, bytes32 reason) external;

    /// @notice Rotate a sensor's signing device key. Owner only.
    function rotateDeviceKey(bytes32 sensorId, address newKey) external;

    /// @notice True if the address is the live device key of a commissioned, uncompromised sensor.
    function isTrustedDevice(bytes32 sensorId, address deviceKey) external view returns (bool);

    /// @notice Sensor id currently bound to a device key (0 if none).
    function sensorOfDevice(address deviceKey) external view returns (bytes32);

    function sensorOf(bytes32 sensorId) external view returns (Sensor memory);
}
