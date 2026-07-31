// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IHarvestRegistry
/// @notice On-chain record of agricultural harvest events: a producer registers a harvest lot (crop, farm
///         geolocation, quantity, harvest date, season) which becomes the provenance root for downstream
///         grading, storage receipts and commodity tokenization.
/// @dev deps (AddressBook): ProvenanceRegistry, GradingRegistry, SupplierRegistry.
interface IHarvestRegistry {
    enum HarvestState {
        None,
        Registered,
        Graded,
        Stored,
        Consumed
    }

    struct Harvest {
        bytes32 harvestId;
        address producer;
        bytes32 crop;
        bytes32 farmGeohash;
        bytes32 season;
        uint256 quantityKg;
        uint64 harvestedAt;
        bytes32 metadataHash;
        HarvestState state;
    }

    event HarvestRegistered(
        bytes32 indexed harvestId, address indexed producer, bytes32 indexed crop, uint256 quantityKg, bytes32 season
    );
    event HarvestGraded(bytes32 indexed harvestId, bytes32 grade);
    event HarvestStored(bytes32 indexed harvestId, bytes32 indexed receiptId);
    event QuantityAdjusted(bytes32 indexed harvestId, uint256 oldQuantityKg, uint256 newQuantityKg);
    event StateChanged(bytes32 indexed harvestId, HarvestState state);

    error HarvestExists(bytes32 harvestId);
    error UnknownHarvest(bytes32 harvestId);
    error NotProducer(bytes32 harvestId);
    error InvalidState(bytes32 harvestId, HarvestState expected, HarvestState actual);
    error ZeroQuantity();

    /// @notice Register a harvest lot. REGISTRAR_ROLE or an accredited producer.
    function registerHarvest(
        bytes32 harvestId,
        address producer,
        bytes32 crop,
        bytes32 farmGeohash,
        bytes32 season,
        uint256 quantityKg,
        uint64 harvestedAt,
        bytes32 metadataHash
    ) external;

    /// @notice Correct the recorded quantity of a harvest before it is stored (e.g. shrinkage/moisture).
    function adjustQuantity(bytes32 harvestId, uint256 newQuantityKg) external;

    /// @notice Mark a harvest as graded and record the assigned grade class.
    function markGraded(bytes32 harvestId, bytes32 grade) external;

    /// @notice Bind a harvest to the storage receipt issued when it is warehoused.
    function markStored(bytes32 harvestId, bytes32 receiptId) external;

    function harvestOf(bytes32 harvestId) external view returns (Harvest memory);
}
