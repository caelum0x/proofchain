// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IFleetRegistry
/// @notice Registry of transport assets (trucks, reefers, vessels, aircraft) operated by carriers, with
///         capacity, emission class, and a bound telematics device key. Assets can be commissioned,
///         suspended for maintenance, and decommissioned; route/cold-chain modules verify the device key.
/// @dev deps (AddressBook): CarrierRegistry, IoTSensorRegistry.
interface IFleetRegistry {
    enum AssetType {
        Truck,
        Reefer,
        Van,
        Vessel,
        Aircraft,
        RailCar
    }

    enum AssetState {
        None,
        Active,
        Maintenance,
        Decommissioned
    }

    struct Asset {
        bytes32 assetId;
        address carrier;
        AssetType assetType;
        uint256 capacityKg;
        uint16 emissionClass;
        address deviceKey;
        AssetState state;
    }

    event AssetRegistered(bytes32 indexed assetId, address indexed carrier, AssetType assetType, uint256 capacityKg);
    event DeviceKeySet(bytes32 indexed assetId, address indexed deviceKey);
    event AssetStateChanged(bytes32 indexed assetId, AssetState state);

    error AssetExists(bytes32 assetId);
    error UnknownAsset(bytes32 assetId);
    error NotCarrier(bytes32 assetId);
    error InvalidState(bytes32 assetId, AssetState expected, AssetState actual);
    error ZeroCapacity();

    /// @notice Register a fleet asset for a carrier. REGISTRAR_ROLE or the carrier.
    function registerAsset(bytes32 assetId, address carrier, AssetType assetType, uint256 capacityKg, uint16 emissionClass)
        external;

    /// @notice Bind/rotate the telematics device key that signs this asset's readings.
    function setDeviceKey(bytes32 assetId, address deviceKey) external;

    /// @notice Move an asset into maintenance.
    function setMaintenance(bytes32 assetId) external;

    /// @notice Return a maintained asset to active service.
    function reactivate(bytes32 assetId) external;

    /// @notice Permanently decommission an asset.
    function decommission(bytes32 assetId) external;

    /// @notice True if the asset is Active and its device key matches.
    function isActiveDevice(bytes32 assetId, address deviceKey) external view returns (bool);

    function assetOf(bytes32 assetId) external view returns (Asset memory);
}
