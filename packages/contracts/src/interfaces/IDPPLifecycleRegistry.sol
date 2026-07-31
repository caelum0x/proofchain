// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDPPLifecycleRegistry
/// @notice Append-only lifecycle event log for a Digital Product Passport: manufacturing, sale, repair,
///         refurbishment, ownership transfer, and end-of-life. Each event commits to an off-chain payload
///         hash and is attributed to the actor, giving the passport a tamper-evident history.
/// @dev deps (AddressBook): DigitalProductPassport.
interface IDPPLifecycleRegistry {
    enum EventType {
        Manufactured,
        QualityChecked,
        Sold,
        Transferred,
        Serviced,
        Repaired,
        Refurbished,
        Recycled,
        Disposed
    }

    struct LifecycleEvent {
        uint256 tokenId;
        EventType eventType;
        address actor;
        bytes32 dataHash;
        string location;
        uint64 timestamp;
    }

    event LifecycleRecorded(
        uint256 indexed tokenId, uint256 indexed index, EventType eventType, address indexed actor, bytes32 dataHash
    );

    error UnknownPassport(uint256 tokenId);
    error IndexOutOfRange(uint256 tokenId, uint256 index);
    error NotAuthorized(uint256 tokenId);

    /// @notice Append a lifecycle event to a passport's history. REGISTRAR_ROLE or passport owner.
    /// @return index The new event's index in the passport's log.
    function record(uint256 tokenId, EventType eventType, bytes32 dataHash, string calldata location)
        external
        returns (uint256 index);

    /// @notice Number of lifecycle events recorded for a passport.
    function eventCount(uint256 tokenId) external view returns (uint256);

    /// @notice Fetch a single lifecycle event by index.
    function eventAt(uint256 tokenId, uint256 index) external view returns (LifecycleEvent memory);
}
