// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IRecyclingRegistry
/// @notice End-of-life register for Digital Product Passports. An accredited recycler records collection,
///         processing, and material recovery for a passport, closing the loop by reporting recovered mass
///         per material stream. Marks the passport's end-of-life once recovery is confirmed.
/// @dev deps (AddressBook): DigitalProductPassport, MaterialComposition, DPPLifecycleRegistry.
interface IRecyclingRegistry {
    enum RecycleState {
        None,
        Collected,
        Processing,
        Recovered,
        Disposed
    }

    struct RecycleRecord {
        bytes32 recordId;
        uint256 tokenId;
        address recycler;
        uint256 inputMassGrams;
        uint256 recoveredMassGrams;
        bytes32 facilityId;
        RecycleState state;
        uint64 updatedAt;
    }

    event Collected(bytes32 indexed recordId, uint256 indexed tokenId, address indexed recycler, uint256 inputMassGrams);
    event Processing(bytes32 indexed recordId);
    event Recovered(bytes32 indexed recordId, uint256 recoveredMassGrams, uint16 recoveryRateBps);
    event Disposed(bytes32 indexed recordId, uint256 residualMassGrams);

    error RecordExists(bytes32 recordId);
    error UnknownRecord(bytes32 recordId);
    error InvalidState(bytes32 recordId, RecycleState expected, RecycleState actual);
    error UnknownPassport(uint256 tokenId);
    error ZeroMass();
    error RecoveredExceedsInput(uint256 recovered, uint256 input);

    /// @notice Record collection of an end-of-life product. CERTIFIER_ROLE (accredited recycler).
    function recordCollection(bytes32 recordId, uint256 tokenId, uint256 inputMassGrams, bytes32 facilityId) external;

    /// @notice Mark a record as in processing.
    function startProcessing(bytes32 recordId) external;

    /// @notice Record recovered material mass and compute the recovery rate.
    function recordRecovery(bytes32 recordId, uint256 recoveredMassGrams) external;

    /// @notice Record residual disposal for the record.
    function recordDisposal(bytes32 recordId, uint256 residualMassGrams) external;

    function recordOf(bytes32 recordId) external view returns (RecycleRecord memory);
}
