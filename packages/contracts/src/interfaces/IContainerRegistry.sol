// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IContainerRegistry
/// @notice Registry of intermodal shipping containers keyed by ISO 6346 container number. Tracks owner,
///         ISO type, tare weight, and lifecycle status, plus assignment to freight bookings and the sealing
///         of a container to a batch with a tamper-evident seal id.
/// @dev deps (AddressBook): FreightBooking, ProvenanceRegistry, CarrierRegistry.
interface IContainerRegistry {
    enum ContainerStatus {
        None,
        Available,
        Assigned,
        Sealed,
        InTransit,
        Discharged,
        Retired
    }

    struct Container {
        bytes32 containerId;
        address owner;
        bytes32 isoType;
        uint32 tareKg;
        uint32 maxGrossKg;
        ContainerStatus status;
        bytes32 bookingId;
        bytes32 batchId;
        bytes32 sealId;
    }

    event ContainerRegistered(bytes32 indexed containerId, address indexed owner, bytes32 isoType, uint32 tareKg);
    event ContainerAssigned(bytes32 indexed containerId, bytes32 indexed bookingId);
    event ContainerSealed(bytes32 indexed containerId, bytes32 indexed batchId, bytes32 sealId);
    event StatusChanged(bytes32 indexed containerId, ContainerStatus status);
    event OwnerChanged(bytes32 indexed containerId, address indexed newOwner);
    event ContainerRetired(bytes32 indexed containerId);

    error ContainerExists(bytes32 containerId);
    error UnknownContainer(bytes32 containerId);
    error NotOwner(bytes32 containerId);
    error InvalidStatus(bytes32 containerId, ContainerStatus expected, ContainerStatus actual);
    error ZeroSeal();
    error InvalidWeights(uint32 tareKg, uint32 maxGrossKg);

    /// @notice Register a container. REGISTRAR_ROLE or the owner.
    function registerContainer(bytes32 containerId, address owner, bytes32 isoType, uint32 tareKg, uint32 maxGrossKg)
        external;

    /// @notice Assign an available container to a freight booking.
    function assign(bytes32 containerId, bytes32 bookingId) external;

    /// @notice Seal a container to a batch with a tamper-evident seal id.
    function seal(bytes32 containerId, bytes32 batchId, bytes32 sealId) external;

    /// @notice Advance a container's transport status (in-transit/discharged).
    function setStatus(bytes32 containerId, ContainerStatus status) external;

    /// @notice Transfer ownership of a container.
    function transferOwner(bytes32 containerId, address newOwner) external;

    /// @notice Retire a container from service.
    function retire(bytes32 containerId) external;

    function containerOf(bytes32 containerId) external view returns (Container memory);
}
