// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IColdChainMonitor
/// @notice Monitors temperature/humidity excursions for cold-chain shipments. A profile sets the allowed
///         min/max band for a batch; keepers push readings, and any out-of-band reading records a breach.
///         Breach state can trigger parametric insurance payouts and quality holds downstream.
/// @dev deps (AddressBook): CheckpointOracle, ProvenanceRegistry, PolicyManager (parametric payout).
interface IColdChainMonitor {
    struct Profile {
        bytes32 batchId;
        int256 minTemp;
        int256 maxTemp;
        uint16 maxHumidityBps;
        uint32 breachCount;
        bool breached;
        bool active;
    }

    struct Reading {
        int256 temp;
        uint16 humidityBps;
        bytes32 dataHash;
        uint64 timestamp;
        bool breach;
    }

    event ProfileSet(bytes32 indexed batchId, int256 minTemp, int256 maxTemp, uint16 maxHumidityBps);
    event ReadingRecorded(bytes32 indexed batchId, uint256 indexed index, int256 temp, uint16 humidityBps, bool breach);
    event Breached(bytes32 indexed batchId, int256 temp, uint16 humidityBps, uint32 breachCount);
    event ProfileClosed(bytes32 indexed batchId);

    error ProfileExists(bytes32 batchId);
    error UnknownProfile(bytes32 batchId);
    error ProfileInactive(bytes32 batchId);
    error InvalidBand(int256 minTemp, int256 maxTemp);

    /// @notice Create a cold-chain monitoring profile for a batch. KEEPER_ROLE or REGISTRAR_ROLE.
    function setProfile(bytes32 batchId, int256 minTemp, int256 maxTemp, uint16 maxHumidityBps) external;

    /// @notice Push a sensor reading; flags and records a breach if outside the band. KEEPER_ROLE only.
    /// @return breach True if this reading was out of band.
    function pushReading(bytes32 batchId, int256 temp, uint16 humidityBps, bytes32 dataHash) external returns (bool breach);

    /// @notice Close monitoring for a batch (delivered/terminated).
    function closeProfile(bytes32 batchId) external;

    /// @notice True if the batch has recorded any breach.
    function isBreached(bytes32 batchId) external view returns (bool);

    /// @notice Number of readings recorded for a batch.
    function readingCount(bytes32 batchId) external view returns (uint256);

    function readingAt(bytes32 batchId, uint256 index) external view returns (Reading memory);
    function profileOf(bytes32 batchId) external view returns (Profile memory);
}
